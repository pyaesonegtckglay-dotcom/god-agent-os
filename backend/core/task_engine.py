"""
Task Engine — Heart of the Autonomous Agent
Manages task lifecycle, planning, execution, self-healing
"""

import asyncio
import json
import os
import time
import uuid
from typing import Dict, Optional, List

import structlog

from core.models import TaskStatus, TaskPlan, TaskStep, TaskCreateRequest
from api.websocket_manager import WebSocketManager
from memory.db import (
    create_task, update_task_status, get_task, save_task_event,
    save_memory, get_task_events
)

log = structlog.get_logger()

MAX_RETRIES = 3
MAX_CONCURRENT = 5


class TaskEngine:
    def __init__(self, ws_manager: WebSocketManager):
        self.ws = ws_manager
        self._queue: asyncio.Queue = asyncio.Queue()
        self._active: Dict[str, asyncio.Task] = {}
        self._running = False
        self._workers: List[asyncio.Task] = []

    async def start(self):
        self._running = True
        for i in range(MAX_CONCURRENT):
            worker = asyncio.create_task(self._worker(i))
            self._workers.append(worker)
        log.info("TaskEngine started", workers=MAX_CONCURRENT)

    async def stop(self):
        self._running = False
        for w in self._workers:
            w.cancel()
        log.info("TaskEngine stopped")

    # ─── Public API ────────────────────────────────────────────────────────────

    async def submit(self, req: TaskCreateRequest) -> str:
        task_id = f"task_{uuid.uuid4().hex[:10]}"
        await create_task(
            task_id=task_id,
            goal=req.goal,
            session_id=req.session_id,
            project_id=req.project_id,
            metadata={**req.metadata, "github_repo": req.github_repo, "auto_commit": req.auto_commit},
        )
        await self.ws.emit(task_id, "task_created", {
            "goal": req.goal,
            "session_id": req.session_id,
            "stream_url": f"/api/v1/tasks/{task_id}/stream",
            "ws_url": f"/ws/tasks/{task_id}",
        }, session_id=req.session_id)
        await self._queue.put((task_id, req))
        await self.ws.emit(task_id, "task_queued", {
            "position": self._queue.qsize(),
        }, session_id=req.session_id)
        log.info("Task submitted", task_id=task_id, goal=req.goal[:60])
        return task_id

    async def cancel(self, task_id: str, reason: str = "User cancelled"):
        if task_id in self._active:
            self._active[task_id].cancel()
            del self._active[task_id]
        await update_task_status(task_id, "cancelled", error=reason)
        await self.ws.emit(task_id, "task_failed", {"reason": reason, "status": "cancelled"})

    async def retry(self, task_id: str):
        task = await get_task(task_id)
        if not task:
            return
        req = TaskCreateRequest(
            goal=task["goal"],
            session_id=task["session_id"] or "",
            project_id=task["project_id"] or "",
            metadata=task.get("metadata") or {},
        )
        retry_count = (task.get("retry_count") or 0) + 1
        await update_task_status(task_id, "queued", retry_count=retry_count)
        await self.ws.emit(task_id, "retry_attempt", {"count": retry_count})
        await self._queue.put((task_id, req))

    async def handle_chat_message(self, session_id: str, content: str, websocket=None):
        """Handle real-time chat message with streaming response."""
        from core.agent import AgentCore
        agent = AgentCore(self.ws)
        await agent.stream_chat(session_id=session_id, user_message=content)

    # ─── Worker Loop ───────────────────────────────────────────────────────────

    async def _worker(self, worker_id: int):
        log.info(f"Worker {worker_id} started")
        while self._running:
            try:
                task_id, req = await asyncio.wait_for(self._queue.get(), timeout=1.0)
                worker_task = asyncio.create_task(self._execute(task_id, req))
                self._active[task_id] = worker_task
                await worker_task
                self._active.pop(task_id, None)
                self._queue.task_done()
            except asyncio.TimeoutError:
                continue
            except asyncio.CancelledError:
                break
            except Exception as e:
                log.error(f"Worker {worker_id} error", error=str(e))

    async def _execute(self, task_id: str, req: TaskCreateRequest):
        """Full task execution lifecycle."""
        from core.agent import AgentCore
        agent = AgentCore(self.ws)
        
        try:
            # ── Initializing ────────────────────────────────────────────────
            await update_task_status(task_id, "initializing")
            await self.ws.emit(task_id, "task_started", {
                "goal": req.goal,
                "status": "initializing",
            }, session_id=req.session_id)
            await save_task_event(task_id, "task_started", {"goal": req.goal})

            # ── Planning ────────────────────────────────────────────────────
            await update_task_status(task_id, "planning")
            await self.ws.emit(task_id, "step_started", {
                "step": "Planning",
                "status": "planning",
                "description": "Generating execution plan...",
            }, session_id=req.session_id)

            plan = await agent.plan(goal=req.goal, task_id=task_id, session_id=req.session_id)

            await update_task_status(task_id, "executing", plan=plan.model_dump())
            await self.ws.emit(task_id, "plan_generated", {
                "steps": [s.model_dump() for s in plan.steps],
                "estimated_duration": plan.estimated_duration,
                "tools_needed": plan.tools_needed,
            }, session_id=req.session_id)
            await save_task_event(task_id, "plan_generated", {"steps_count": len(plan.steps)})

            # ── Execute Steps ────────────────────────────────────────────────
            results = []
            for i, step in enumerate(plan.steps):
                await self.ws.emit(task_id, "step_started", {
                    "step": step.name,
                    "step_id": step.id,
                    "index": i,
                    "total": len(plan.steps),
                    "tool": step.tool,
                }, session_id=req.session_id)

                step_result = await agent.execute_step(
                    step=step,
                    task_id=task_id,
                    session_id=req.session_id,
                    context={"goal": req.goal, "previous_results": results},
                )
                results.append(step_result)

                await self.ws.emit(task_id, "step_completed", {
                    "step": step.name,
                    "step_id": step.id,
                    "index": i,
                    "output": step_result[:500] if isinstance(step_result, str) else str(step_result)[:500],
                    "status": "completed",
                }, session_id=req.session_id)
                await save_task_event(task_id, "step_completed", {"step": step.name, "index": i})

            # ── Finalize ─────────────────────────────────────────────────────
            await update_task_status(task_id, "finalizing")
            await self.ws.emit(task_id, "step_started", {
                "step": "Finalizing",
                "description": "Compiling results...",
            }, session_id=req.session_id)

            final_result = await agent.finalize(
                goal=req.goal,
                steps=plan.steps,
                results=results,
                task_id=task_id,
                session_id=req.session_id,
            )

            await update_task_status(task_id, "completed", result=final_result)
            await self.ws.emit(task_id, "task_completed", {
                "result": final_result,
                "steps_completed": len(plan.steps),
                "duration": time.time(),
            }, session_id=req.session_id)

            # Save to memory
            await save_memory(
                content=f"Task: {req.goal}\nResult: {final_result}",
                memory_type="task",
                session_id=req.session_id,
                project_id=req.project_id,
                key=task_id,
            )
            await self.ws.emit(task_id, "memory_updated", {
                "type": "task",
                "key": task_id,
            }, session_id=req.session_id)

            log.info("Task completed", task_id=task_id)

        except asyncio.CancelledError:
            await update_task_status(task_id, "cancelled")
            await self.ws.emit(task_id, "task_failed", {"reason": "cancelled"})
        except Exception as e:
            log.error("Task failed", task_id=task_id, error=str(e))
            task_data = await get_task(task_id)
            retry_count = (task_data or {}).get("retry_count", 0)

            await self.ws.emit(task_id, "error", {
                "error": str(e),
                "retry_count": retry_count,
                "will_retry": retry_count < MAX_RETRIES,
            }, session_id=req.session_id)

            if retry_count < MAX_RETRIES:
                await update_task_status(task_id, "retrying", retry_count=retry_count + 1)
                await asyncio.sleep(2 ** retry_count)
                await self.ws.emit(task_id, "retry_attempt", {"count": retry_count + 1})
                await self._execute(task_id, req)
            else:
                await update_task_status(task_id, "failed", error=str(e))
                await self.ws.emit(task_id, "task_failed", {
                    "error": str(e),
                    "retry_count": retry_count,
                }, session_id=req.session_id)
