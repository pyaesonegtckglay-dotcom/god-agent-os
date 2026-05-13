"""
Agent Core — Planner + Executor + Self-Heal Loop
LLM-powered with OpenAI/Anthropic support, streaming tokens
"""

import asyncio
import json
import os
import time
from typing import Any, Dict, List, Optional

import httpx
import structlog

from core.models import TaskPlan, TaskStep
from api.websocket_manager import WebSocketManager
from memory.db import save_memory, get_history, search_memory

log = structlog.get_logger()

OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY", "")
ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY", "")
DEFAULT_MODEL = os.environ.get("DEFAULT_MODEL", "gpt-4o")
OPENAI_BASE_URL = os.environ.get("OPENAI_BASE_URL", "https://api.openai.com/v1")


SYSTEM_PROMPT = """You are an elite autonomous AI software engineer — like Devin or Manus.
You can plan, code, debug, refactor, test, and deploy software autonomously.
You think step-by-step, write production-quality code, and self-heal on errors.
Always respond in structured JSON when asked for plans or structured output.
"""

PLANNER_PROMPT = """You are a senior software architect. Given a goal, produce a detailed execution plan.

Respond ONLY with valid JSON:
{
  "steps": [
    {
      "name": "Step name",
      "description": "What this step does",
      "tool": "code|shell|file|browser|github|memory|search|test|none",
      "estimated_seconds": 10
    }
  ],
  "estimated_duration": 60,
  "tools_needed": ["code", "shell"]
}

Goal: {goal}
Context: {context}
"""


class AgentCore:
    def __init__(self, ws_manager: WebSocketManager):
        self.ws = ws_manager
        self.model = DEFAULT_MODEL

    # ─── LLM Call (with streaming) ─────────────────────────────────────────────

    async def llm_stream(
        self,
        messages: List[Dict],
        task_id: str = "",
        session_id: str = "",
        model: str = "",
        temperature: float = 0.7,
        max_tokens: int = 4096,
    ) -> str:
        """Stream LLM tokens, emitting llm_chunk events via WebSocket."""
        model = model or self.model
        full_text = ""

        if OPENAI_API_KEY:
            full_text = await self._openai_stream(
                messages, task_id, session_id, model, temperature, max_tokens
            )
        elif ANTHROPIC_API_KEY:
            full_text = await self._anthropic_stream(
                messages, task_id, session_id, temperature, max_tokens
            )
        else:
            # Demo mode — simulate streaming
            full_text = await self._demo_stream(messages, task_id, session_id)

        return full_text

    async def _openai_stream(
        self, messages, task_id, session_id, model, temperature, max_tokens
    ) -> str:
        full_text = ""
        headers = {
            "Authorization": f"Bearer {OPENAI_API_KEY}",
            "Content-Type": "application/json",
        }
        payload = {
            "model": model,
            "messages": messages,
            "stream": True,
            "temperature": temperature,
            "max_tokens": max_tokens,
        }
        async with httpx.AsyncClient(timeout=120) as client:
            async with client.stream(
                "POST", f"{OPENAI_BASE_URL}/chat/completions",
                headers=headers, json=payload
            ) as resp:
                resp.raise_for_status()
                async for line in resp.aiter_lines():
                    if not line.startswith("data:"):
                        continue
                    chunk = line[6:].strip()
                    if chunk == "[DONE]":
                        break
                    try:
                        data = json.loads(chunk)
                        delta = data["choices"][0]["delta"].get("content", "")
                        if delta:
                            full_text += delta
                            if task_id:
                                await self.ws.emit(task_id, "llm_chunk", {
                                    "chunk": delta,
                                    "accumulated": len(full_text),
                                }, session_id=session_id)
                            if session_id and not task_id:
                                await self.ws.emit_chat(session_id, "llm_chunk", {
                                    "chunk": delta,
                                })
                    except Exception:
                        pass
        return full_text

    async def _anthropic_stream(
        self, messages, task_id, session_id, temperature, max_tokens
    ) -> str:
        full_text = ""
        system = ""
        filtered = []
        for m in messages:
            if m["role"] == "system":
                system = m["content"]
            else:
                filtered.append(m)
        headers = {
            "x-api-key": ANTHROPIC_API_KEY,
            "anthropic-version": "2023-06-01",
            "Content-Type": "application/json",
        }
        payload = {
            "model": "claude-3-5-sonnet-20241022",
            "max_tokens": max_tokens,
            "messages": filtered,
            "stream": True,
        }
        if system:
            payload["system"] = system
        async with httpx.AsyncClient(timeout=120) as client:
            async with client.stream(
                "POST", "https://api.anthropic.com/v1/messages",
                headers=headers, json=payload
            ) as resp:
                resp.raise_for_status()
                async for line in resp.aiter_lines():
                    if not line.startswith("data:"):
                        continue
                    try:
                        data = json.loads(line[5:].strip())
                        if data.get("type") == "content_block_delta":
                            delta = data["delta"].get("text", "")
                            if delta:
                                full_text += delta
                                if task_id:
                                    await self.ws.emit(task_id, "llm_chunk", {
                                        "chunk": delta,
                                    }, session_id=session_id)
                                if session_id and not task_id:
                                    await self.ws.emit_chat(session_id, "llm_chunk", {
                                        "chunk": delta,
                                    })
                    except Exception:
                        pass
        return full_text

    async def _demo_stream(self, messages, task_id, session_id) -> str:
        """Demo mode — simulate LLM streaming without API key."""
        last_user = next(
            (m["content"] for m in reversed(messages) if m["role"] == "user"), "Hello"
        )
        response = (
            f"🤖 **Devin Agent** (Demo Mode)\n\n"
            f"I received your request: *{last_user[:100]}*\n\n"
            f"To enable real AI responses, set `OPENAI_API_KEY` or `ANTHROPIC_API_KEY` in your environment.\n\n"
            f"**What I can do with a real API key:**\n"
            f"- 📋 Generate detailed execution plans\n"
            f"- 💻 Write and execute code autonomously\n"
            f"- 🔧 Debug and self-heal on errors\n"
            f"- 🐙 Manage GitHub repos autonomously\n"
            f"- 🧠 Remember long-running project context\n"
            f"- 🚀 Deploy applications automatically\n"
        )
        full_text = ""
        for word in response.split():
            chunk = word + " "
            full_text += chunk
            await asyncio.sleep(0.03)
            if task_id:
                await self.ws.emit(task_id, "llm_chunk", {
                    "chunk": chunk,
                    "demo": True,
                }, session_id=session_id)
            if session_id and not task_id:
                await self.ws.emit_chat(session_id, "llm_chunk", {
                    "chunk": chunk,
                    "demo": True,
                })
        return full_text

    # ─── Planning ──────────────────────────────────────────────────────────────

    async def plan(self, goal: str, task_id: str, session_id: str = "") -> TaskPlan:
        """Generate a structured execution plan."""
        # Get context from memory
        memories = await search_memory(goal[:50], session_id=session_id)
        context = "\n".join([m["content"][:200] for m in memories[:3]])

        prompt = PLANNER_PROMPT.format(goal=goal, context=context or "No prior context")

        messages = [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": prompt},
        ]

        if not OPENAI_API_KEY and not ANTHROPIC_API_KEY:
            # Demo plan
            return self._demo_plan(goal)

        raw = await self.llm_stream(messages, task_id=task_id, session_id=session_id)

        # Extract JSON from response
        try:
            # Find JSON block
            start = raw.find("{")
            end = raw.rfind("}") + 1
            if start >= 0 and end > start:
                data = json.loads(raw[start:end])
            else:
                data = json.loads(raw)

            steps = []
            for i, s in enumerate(data.get("steps", [])):
                steps.append(TaskStep(
                    name=s.get("name", f"Step {i+1}"),
                    description=s.get("description", ""),
                    tool=s.get("tool", "none"),
                ))

            return TaskPlan(
                goal=goal,
                steps=steps if steps else [TaskStep(name="Execute goal", description=goal, tool="code")],
                estimated_duration=data.get("estimated_duration", 60),
                tools_needed=data.get("tools_needed", []),
            )
        except Exception as e:
            log.warning("Plan parse failed, using fallback", error=str(e))
            return self._demo_plan(goal)

    def _demo_plan(self, goal: str) -> TaskPlan:
        """Fallback plan for demo mode."""
        steps = [
            TaskStep(name="Analyze Requirements", description=f"Analyze: {goal[:60]}", tool="none"),
            TaskStep(name="Design Solution", description="Design the solution architecture", tool="none"),
            TaskStep(name="Implement", description="Write the implementation code", tool="code"),
            TaskStep(name="Test", description="Test the implementation", tool="test"),
            TaskStep(name="Document", description="Write documentation", tool="none"),
        ]
        return TaskPlan(
            goal=goal,
            steps=steps,
            estimated_duration=120,
            tools_needed=["code", "test"],
        )

    # ─── Step Execution ────────────────────────────────────────────────────────

    async def execute_step(
        self,
        step: TaskStep,
        task_id: str,
        session_id: str = "",
        context: Dict = {},
    ) -> str:
        """Execute a single step using the appropriate tool."""
        from tools.executor import ToolExecutor
        executor = ToolExecutor(self.ws)

        await self.ws.emit(task_id, "tool_called", {
            "tool": step.tool or "none",
            "step": step.name,
            "description": step.description,
        }, session_id=session_id)

        try:
            result = await executor.run(
                tool=step.tool or "none",
                task=step.description,
                goal=context.get("goal", ""),
                previous=context.get("previous_results", []),
                task_id=task_id,
                session_id=session_id,
            )
            await self.ws.emit(task_id, "tool_result", {
                "tool": step.tool,
                "step": step.name,
                "result": str(result)[:500],
                "success": True,
            }, session_id=session_id)
            return result
        except Exception as e:
            await self.ws.emit(task_id, "tool_result", {
                "tool": step.tool,
                "step": step.name,
                "error": str(e),
                "success": False,
            }, session_id=session_id)
            return f"Error in {step.name}: {str(e)}"

    # ─── Finalize ──────────────────────────────────────────────────────────────

    async def finalize(
        self,
        goal: str,
        steps: List[TaskStep],
        results: List[str],
        task_id: str,
        session_id: str = "",
    ) -> str:
        """Compile final result summary."""
        steps_summary = "\n".join([
            f"- {s.name}: {r[:200]}" for s, r in zip(steps, results)
        ])
        messages = [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": (
                f"Summarize the completion of this goal:\n"
                f"Goal: {goal}\n\n"
                f"Steps completed:\n{steps_summary}\n\n"
                f"Write a concise success summary with key outcomes."
            )},
        ]
        result = await self.llm_stream(messages, task_id=task_id, session_id=session_id)
        return result or f"✅ Completed: {goal}"

    # ─── Chat ──────────────────────────────────────────────────────────────────

    async def stream_chat(self, session_id: str, user_message: str):
        """Stream a conversational chat response."""
        # Save user message to memory
        await save_memory(
            content=user_message,
            memory_type="conversation",
            session_id=session_id,
            key="user_message",
        )

        # Get conversation history
        history = await get_history(session_id, limit=10)
        messages = [{"role": "system", "content": SYSTEM_PROMPT}]
        for h in reversed(history[-10:]):
            messages.append({"role": "user", "content": h["content"]})

        messages.append({"role": "user", "content": user_message})

        await self.ws.emit_chat(session_id, "stream_start", {
            "status": "generating",
        })

        response = await self.llm_stream(messages, session_id=session_id)

        # Save assistant response to memory
        await save_memory(
            content=response,
            memory_type="conversation",
            session_id=session_id,
            key="assistant_response",
        )

        await self.ws.emit_chat(session_id, "stream_end", {
            "full_response": response,
            "status": "complete",
        })

        return response
