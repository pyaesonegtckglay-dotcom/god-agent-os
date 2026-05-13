"""
Chat + Goal API Routes — Real-time streaming responses
"""

import asyncio
import json
import time
import uuid

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import StreamingResponse

from core.models import ChatRequest, GoalRequest, TaskCreateRequest
from memory.db import save_memory, get_history

router = APIRouter()


def get_engine(request: Request):
    return request.app.state.task_engine


def get_ws(request: Request):
    return request.app.state.ws_manager


# ─── Chat (REST + SSE streaming) ───────────────────────────────────────────────

@router.post("/chat", summary="Chat with the agent")
async def chat(req: ChatRequest, request: Request):
    from core.agent import AgentCore
    ws = get_ws(request)
    agent = AgentCore(ws)

    messages = [{"role": m.role, "content": m.content} for m in req.messages]

    if req.stream:
        async def stream_gen():
            async def _run():
                result = await agent.llm_stream(
                    messages=messages,
                    session_id=req.session_id,
                    model=req.model,
                    temperature=req.temperature,
                    max_tokens=req.max_tokens,
                )
                await save_memory(
                    content=result,
                    memory_type="conversation",
                    session_id=req.session_id,
                    project_id=req.project_id,
                    key="assistant",
                )
                # Save user message too
                user_msg = next((m["content"] for m in reversed(messages) if m["role"] == "user"), "")
                await save_memory(
                    content=user_msg,
                    memory_type="conversation",
                    session_id=req.session_id,
                    project_id=req.project_id,
                    key="user",
                )
                return result

            room_buffer = []
            original_emit_chat = ws.emit_chat
            async def capture_emit(sid, etype, data):
                if etype == "llm_chunk":
                    chunk = data.get("chunk", "")
                    room_buffer.append(chunk)
                    yield_data = json.dumps({"type": etype, "data": data, "session_id": sid})
                    return yield_data
                return None

            # Stream tokens directly
            full = ""
            from core.agent import AgentCore as _A
            import httpx
            import os
            OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY", "")
            ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY", "")

            if OPENAI_API_KEY:
                headers = {
                    "Authorization": f"Bearer {OPENAI_API_KEY}",
                    "Content-Type": "application/json",
                }
                payload = {
                    "model": req.model,
                    "messages": messages,
                    "stream": True,
                    "temperature": req.temperature,
                    "max_tokens": req.max_tokens,
                }
                from core.agent import OPENAI_BASE_URL
                async with httpx.AsyncClient(timeout=120) as client:
                    async with client.stream("POST", f"{OPENAI_BASE_URL}/chat/completions",
                                             headers=headers, json=payload) as resp:
                        async for line in resp.aiter_lines():
                            if not line.startswith("data:"):
                                continue
                            chunk_str = line[6:].strip()
                            if chunk_str == "[DONE]":
                                break
                            try:
                                data = json.loads(chunk_str)
                                delta = data["choices"][0]["delta"].get("content", "")
                                if delta:
                                    full += delta
                                    yield f"data: {json.dumps({'type': 'llm_chunk', 'data': {'chunk': delta}, 'session_id': req.session_id})}\n\n"
                            except Exception:
                                pass
            else:
                # Demo streaming
                demo = (
                    f"Hello! I'm your Devin-style AI Agent. I received: '{req.messages[-1].content[:80]}'. "
                    f"Set OPENAI_API_KEY or ANTHROPIC_API_KEY for real AI responses. "
                    f"I support real-time streaming, task planning, GitHub automation, and more!"
                )
                for word in demo.split():
                    chunk = word + " "
                    full += chunk
                    await asyncio.sleep(0.04)
                    yield f"data: {json.dumps({'type': 'llm_chunk', 'data': {'chunk': chunk}, 'session_id': req.session_id})}\n\n"

            yield f"data: {json.dumps({'type': 'stream_end', 'data': {'full_response': full}, 'session_id': req.session_id})}\n\n"

        return StreamingResponse(
            stream_gen(),
            media_type="text/event-stream",
            headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
        )
    else:
        # Non-streaming
        agent = AgentCore(get_ws(request))
        result = await agent.llm_stream(messages, session_id=req.session_id)
        return {
            "response": result,
            "session_id": req.session_id,
            "model": req.model,
            "timestamp": time.time(),
        }


@router.post("/chat/stream", summary="Explicit streaming chat endpoint")
async def chat_stream(req: ChatRequest, request: Request):
    req.stream = True
    return await chat(req, request)


# ─── Goal API (create task from goal) ─────────────────────────────────────────

@router.post("/goal", summary="Submit a high-level goal to the agent")
async def submit_goal(req: GoalRequest, request: Request):
    engine = get_engine(request)
    task_req = TaskCreateRequest(
        goal=req.goal,
        session_id=req.session_id,
        project_id=req.project_id,
        stream=req.stream,
        metadata={"source": "goal_api", "github_repo": req.github_repo},
    )
    task_id = await engine.submit(task_req)
    return {
        "task_id": task_id,
        "goal": req.goal,
        "status": "queued",
        "session_id": req.session_id,
        "ws_url": f"/ws/tasks/{task_id}",
        "stream_url": f"/api/v1/tasks/{task_id}/stream",
    }


@router.post("/goal/stream", summary="Submit goal with SSE streaming response")
async def submit_goal_stream(req: GoalRequest, request: Request):
    req.stream = True
    return await submit_goal(req, request)


# ─── Execute (direct tool execution) ──────────────────────────────────────────

@router.post("/execute", summary="Execute a tool directly")
async def execute(
    tool: str,
    task: str,
    request: Request,
    session_id: str = "",
):
    from tools.executor import ToolExecutor
    ws = get_ws(request)
    executor = ToolExecutor(ws)
    result = await executor.run(
        tool=tool,
        task=task,
        session_id=session_id,
    )
    return {"tool": tool, "task": task, "result": result, "session_id": session_id}


# ─── Plan (generate plan without executing) ───────────────────────────────────

@router.post("/plan", summary="Generate execution plan for a goal")
async def generate_plan(req: GoalRequest, request: Request):
    from core.agent import AgentCore
    ws = get_ws(request)
    agent = AgentCore(ws)
    task_id = f"plan_{uuid.uuid4().hex[:8]}"
    plan = await agent.plan(goal=req.goal, task_id=task_id, session_id=req.session_id)
    return {
        "goal": req.goal,
        "plan": plan.model_dump(),
        "session_id": req.session_id,
        "task_id": task_id,
    }
