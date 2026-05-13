"""
Task API Routes — CRUD + Streaming + WebSocket
"""

import asyncio
import json
import time
from typing import Optional

from fastapi import APIRouter, HTTPException, Request, Query
from fastapi.responses import StreamingResponse

from core.models import (
    TaskCreateRequest, TaskCancelRequest, TaskRetryRequest, TaskResponse, TaskStatus
)
from memory.db import get_task, list_tasks, get_task_events, update_task_status

router = APIRouter()


def get_engine(request: Request):
    return request.app.state.task_engine


def get_ws(request: Request):
    return request.app.state.ws_manager


# ─── Create Task ───────────────────────────────────────────────────────────────

@router.post("/create", summary="Create & queue a new agent task")
async def create_task(req: TaskCreateRequest, request: Request):
    engine = get_engine(request)
    task_id = await engine.submit(req)
    task = await get_task(task_id)
    return {
        "task_id": task_id,
        "status": "queued",
        "goal": req.goal,
        "session_id": req.session_id,
        "stream_url": f"/api/v1/tasks/{task_id}/stream",
        "ws_url": f"/ws/tasks/{task_id}",
        "created_at": task["created_at"] if task else time.time(),
    }


# ─── Get Task ──────────────────────────────────────────────────────────────────

@router.get("/{task_id}", summary="Get task details")
async def get_task_detail(task_id: str):
    task = await get_task(task_id)
    if not task:
        raise HTTPException(status_code=404, detail=f"Task {task_id} not found")
    return task


# ─── Get Task Status ───────────────────────────────────────────────────────────

@router.get("/{task_id}/status", summary="Get task status only")
async def get_task_status(task_id: str):
    task = await get_task(task_id)
    if not task:
        raise HTTPException(status_code=404, detail=f"Task {task_id} not found")
    return {
        "task_id": task_id,
        "status": task["status"],
        "retry_count": task.get("retry_count", 0),
        "created_at": task.get("created_at"),
        "started_at": task.get("started_at"),
        "completed_at": task.get("completed_at"),
    }


# ─── Cancel Task ───────────────────────────────────────────────────────────────

@router.post("/{task_id}/cancel", summary="Cancel a running task")
async def cancel_task(task_id: str, req: TaskCancelRequest, request: Request):
    task = await get_task(task_id)
    if not task:
        raise HTTPException(status_code=404, detail=f"Task {task_id} not found")
    if task["status"] in ("completed", "failed", "cancelled"):
        raise HTTPException(status_code=400, detail=f"Task already {task['status']}")
    engine = get_engine(request)
    await engine.cancel(task_id, req.reason)
    return {"task_id": task_id, "status": "cancelled", "reason": req.reason}


# ─── Retry Task ────────────────────────────────────────────────────────────────

@router.post("/{task_id}/retry", summary="Retry a failed task")
async def retry_task(task_id: str, request: Request):
    task = await get_task(task_id)
    if not task:
        raise HTTPException(status_code=404, detail=f"Task {task_id} not found")
    if task["status"] not in ("failed", "cancelled"):
        raise HTTPException(status_code=400, detail="Only failed/cancelled tasks can be retried")
    engine = get_engine(request)
    await engine.retry(task_id)
    return {"task_id": task_id, "status": "queued", "message": "Task requeued for retry"}


# ─── Stream Task Events (SSE) ──────────────────────────────────────────────────

@router.get("/{task_id}/stream", summary="Stream task events via SSE")
async def stream_task(task_id: str, request: Request):
    task = await get_task(task_id)
    if not task:
        raise HTTPException(status_code=404, detail=f"Task {task_id} not found")

    async def event_generator():
        # First, replay all stored events
        events = await get_task_events(task_id)
        for ev in events:
            data = json.dumps({
                "type": ev["event_type"],
                "task_id": task_id,
                "timestamp": ev["timestamp"],
                "data": json.loads(ev["data"]) if ev.get("data") else {},
            })
            yield f"data: {data}\n\n"

        # Then stream live events via WS manager buffer
        ws = get_ws(request)
        room = f"task:{task_id}"
        last_count = len(events)
        
        # Poll for new events (for SSE fallback)
        for _ in range(600):  # max 5 minutes
            await asyncio.sleep(0.5)
            current_task = await get_task(task_id)
            if current_task and current_task["status"] in ("completed", "failed", "cancelled"):
                yield f"data: {json.dumps({'type': 'stream_end', 'task_id': task_id, 'status': current_task['status']})}\n\n"
                break
            # heartbeat
            yield f"data: {json.dumps({'type': 'heartbeat', 'timestamp': time.time()})}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )


# ─── List Tasks ────────────────────────────────────────────────────────────────

@router.get("/", summary="List tasks")
async def list_all_tasks(
    session_id: str = Query(default=""),
    limit: int = Query(default=50, le=200),
):
    tasks = await list_tasks(session_id=session_id, limit=limit)
    return {"tasks": tasks, "total": len(tasks)}


# ─── Task Events History ───────────────────────────────────────────────────────

@router.get("/{task_id}/events", summary="Get all events for a task")
async def task_events(task_id: str):
    task = await get_task(task_id)
    if not task:
        raise HTTPException(status_code=404, detail=f"Task {task_id} not found")
    events = await get_task_events(task_id)
    return {"task_id": task_id, "events": events, "total": len(events)}
