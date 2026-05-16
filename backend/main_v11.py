"""
GOD AGENT OS v11 — Fixed & Production Ready
Bugs fixed:
- TaskEngine(ws_manager) only — removed ai_router arg
- init_db() — no arguments
- task_engine.start() — not run()
- ws_manager.emit_chat() — not emit_task()
- ConnectorManager() — sync init, no await needed
"""

import asyncio
import json
import os
import time
import uuid
from contextlib import asynccontextmanager
from typing import Dict, List

import structlog
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import StreamingResponse
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

from api.websocket_manager import WebSocketManager
from core.task_engine import TaskEngine
from memory.db import init_db
from ai_router.router_v10 import AIRouterV10
from agents.orchestrator_v7 import GodAgentOrchestratorV7
from agents.chat_agent import ChatAgent
from agents.planner_agent import PlannerAgent
from agents.coding_agent import CodingAgent
from agents.debug_agent import DebugAgent
from agents.memory_agent import MemoryAgent
from agents.connector_agent import ConnectorAgent
from agents.deploy_agent import DeployAgent
from agents.workflow_agent import WorkflowAgent
from agents.sandbox_agent import SandboxAgent
from agents.ui_agent import UIAgent
from agents.reasoning_agent import ReasoningAgent
from agents.browser_agent import BrowserAgent
from agents.file_agent import FileAgent
from agents.git_agent import GitAgent
from agents.test_agent import TestAgent
from agents.vision_agent import VisionAgent
from connectors.manager import ConnectorManager
from api.routes import tasks, chat, memory, health, connectors, agents as agents_router
from api.routes import github

structlog.configure(
    processors=[
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.stdlib.add_log_level,
        structlog.processors.StackInfoRenderer(),
        structlog.dev.ConsoleRenderer(),
    ]
)
log = structlog.get_logger()

limiter = Limiter(key_func=get_remote_address)

ws_manager: WebSocketManager = None
task_engine: TaskEngine = None
ai_router: AIRouterV10 = None
orchestrator: GodAgentOrchestratorV7 = None
connector_manager: ConnectorManager = None

computer_use_sessions: Dict[str, List[Dict]] = {}


def add_computer_use_step(session_id: str, step_type: str, data: Dict):
    if session_id not in computer_use_sessions:
        computer_use_sessions[session_id] = []
    computer_use_sessions[session_id].append({
        "id": uuid.uuid4().hex[:8],
        "type": step_type,
        "data": data,
        "timestamp": time.time(),
        "status": "running",
    })
    computer_use_sessions[session_id] = computer_use_sessions[session_id][-100:]


@asynccontextmanager
async def lifespan(app: FastAPI):
    global ws_manager, task_engine, ai_router, orchestrator, connector_manager

    log.info("GOD AGENT OS v11 starting...")

    # FIX: init_db() takes no arguments
    await init_db()

    ai_router = AIRouterV10()
    ws_manager = WebSocketManager()

    # FIX: TaskEngine only takes ws_manager
    task_engine = TaskEngine(ws_manager)

    orchestrator = GodAgentOrchestratorV7(ws_manager, ai_router)
    agents_map = {
        "chat":      ChatAgent(ws_manager, ai_router),
        "planner":   PlannerAgent(ws_manager, ai_router),
        "coding":    CodingAgent(ws_manager, ai_router),
        "debug":     DebugAgent(ws_manager, ai_router),
        "memory":    MemoryAgent(ws_manager, ai_router),
        "connector": ConnectorAgent(ws_manager, ai_router),
        "deploy":    DeployAgent(ws_manager, ai_router),
        "workflow":  WorkflowAgent(ws_manager, ai_router),
        "sandbox":   SandboxAgent(ws_manager, ai_router),
        "ui":        UIAgent(ws_manager, ai_router),
        "reasoning": ReasoningAgent(ws_manager, ai_router),
        "browser":   BrowserAgent(ws_manager, ai_router),
        "file":      FileAgent(ws_manager, ai_router),
        "git":       GitAgent(ws_manager, ai_router),
        "test":      TestAgent(ws_manager, ai_router),
        "vision":    VisionAgent(ws_manager, ai_router),
    }
    for name, agent in agents_map.items():
        orchestrator.register_agent(name, agent)

    # FIX: ConnectorManager is sync — no await initialize()
    connector_manager = ConnectorManager()

    app.state.ws_manager = ws_manager
    app.state.task_engine = task_engine
    app.state.ai_router = ai_router
    app.state.orchestrator = orchestrator
    app.state.connector_manager = connector_manager

    # FIX: use start() not run()
    asyncio.create_task(task_engine.start())

    log.info("GOD AGENT OS v11 ready!", agents=len(agents_map))
    yield

    log.info("Shutting down...")
    await task_engine.stop()


app = FastAPI(
    title="GOD AGENT OS v11",
    description="Autonomous Engineering OS",
    version="11.0.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    lifespan=lifespan,
)

app.state_limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(GZipMiddleware, minimum_size=1000)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router, prefix="/api/v1", tags=["health"])
app.include_router(chat.router, prefix="/api/v1", tags=["chat"])
app.include_router(tasks.router, prefix="/api/v1/tasks", tags=["tasks"])
app.include_router(memory.router, prefix="/api/v1/memory", tags=["memory"])
app.include_router(connectors.router, prefix="/api/v1/connectors", tags=["connectors"])
app.include_router(agents_router.router, prefix="/api/v1/agents", tags=["agents"])
app.include_router(github.router, prefix="/api/v1/github", tags=["github"])


@app.websocket("/ws/{session_id}")
async def websocket_endpoint(websocket: WebSocket, session_id: str):
    # FIX: connect takes (websocket, room) — use chat: prefix
    await ws_manager.connect(websocket, f"chat:{session_id}")
    try:
        while True:
            data = await websocket.receive_json()
            event_type = data.get("type", "")

            if event_type == "ping":
                await websocket.send_json({"type": "pong", "ts": time.time()})

            elif event_type == "message":
                message = data.get("message", "")
                task_id = uuid.uuid4().hex[:12]
                # FIX: use emit_chat() not emit_task()
                await ws_manager.emit_chat(session_id, "task_start", {
                    "task_id": task_id,
                    "message": message[:100],
                })
                asyncio.create_task(_run_ws_task(message, task_id, session_id))

            elif event_type == "stop":
                task_id = data.get("task_id", "")
                if task_id:
                    await task_engine.cancel(task_id)

    except WebSocketDisconnect:
        ws_manager.disconnect(websocket, f"chat:{session_id}")


async def _run_ws_task(message: str, task_id: str, session_id: str):
    try:
        result = await orchestrator.orchestrate(
            user_message=message,
            task_id=task_id,
            session_id=session_id,
        )
        await ws_manager.emit_chat(session_id, "task_complete", {
            "task_id": task_id,
            "result": result[:2000] if result else "",
        })
    except Exception as e:
        await ws_manager.emit_chat(session_id, "task_error", {
            "task_id": task_id,
            "error": str(e),
        })


@app.get("/api/v1/computer-use/{session_id}")
async def get_computer_use_steps(session_id: str):
    steps = computer_use_sessions.get(session_id, [])
    return {"session_id": session_id, "steps": steps, "count": len(steps)}


@app.websocket("/ws/computer-use/{session_id}")
async def computer_use_ws(websocket: WebSocket, session_id: str):
    await websocket.accept()
    try:
        last_idx = 0
        while True:
            steps = computer_use_sessions.get(session_id, [])
            if len(steps) > last_idx:
                for step in steps[last_idx:]:
                    await websocket.send_json({"type": "computer_use_step", "step": step})
                last_idx = len(steps)
            await asyncio.sleep(0.5)
    except WebSocketDisconnect:
        pass


@app.post("/api/v1/orchestrate")
async def orchestrate_goal(request: Request):
    body = await request.json()
    message = body.get("message", "")
    session_id = body.get("session_id", uuid.uuid4().hex[:12])

    if not message:
        raise HTTPException(status_code=400, detail="Message required")

    task_id = uuid.uuid4().hex[:12]
    add_computer_use_step(session_id, "thinking", {
        "message": f"Processing: {message[:100]}",
        "task_id": task_id,
    })

    if body.get("stream", False):
        async def stream_gen():
            try:
                result = await orchestrator.orchestrate(
                    user_message=message, task_id=task_id, session_id=session_id,
                )
                add_computer_use_step(session_id, "complete", {"result": result[:200] if result else ""})
                yield f"data: {json.dumps({'type': 'complete', 'result': result, 'task_id': task_id, 'session_id': session_id})}\n\n"
            except Exception as e:
                yield f"data: {json.dumps({'type': 'error', 'error': str(e)})}\n\n"

        return StreamingResponse(
            stream_gen(),
            media_type="text/event-stream",
            headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
        )

    try:
        result = await orchestrator.orchestrate(user_message=message, task_id=task_id, session_id=session_id)
        add_computer_use_step(session_id, "complete", {"result": result[:200] if result else ""})
        return {"task_id": task_id, "session_id": session_id, "result": result, "status": "complete"}
    except Exception as e:
        log.error("Orchestration error", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/v1/agents/{agent_name}/run")
async def run_agent(agent_name: str, request: Request):
    body = await request.json()
    task = body.get("task", "")
    session_id = body.get("session_id", uuid.uuid4().hex[:12])
    task_id = uuid.uuid4().hex[:12]

    agent = orchestrator.get_agent(agent_name)
    if not agent:
        raise HTTPException(status_code=404, detail=f"Agent '{agent_name}' not found")

    try:
        result = await agent.run(
            task=task,
            context=body.get("context", {}),
            task_id=task_id,
            session_id=session_id,
        )
        return {"agent": agent_name, "task_id": task_id, "result": result, "status": "complete"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/v1/agents")
async def list_agents():
    names = ["chat", "planner", "coding", "debug", "memory", "connector",
             "deploy", "workflow", "sandbox", "ui", "reasoning",
             "browser", "file", "git", "test", "vision"]
    agents_list = []
    for name in names:
        agent = orchestrator.get_agent(name)
        agents_list.append({
            "name": name,
            "available": agent is not None,
            "class": type(agent).__name__ if agent else None,
        })
    return {"agents": agents_list, "total": len(agents_list)}


SPACE_DEFS = [
    {"id": "god-core",        "name": "God Core Space",      "role": "orchestration",   "agent": "orchestrator", "icon": "🧠"},
    {"id": "coding",          "name": "Coding Worker",        "role": "code_generation", "agent": "coding",       "icon": "⚡"},
    {"id": "sandbox",         "name": "Sandbox Worker",       "role": "execution",       "agent": "sandbox",      "icon": "🔧"},
    {"id": "terminal",        "name": "Terminal Worker",      "role": "execution",       "agent": "sandbox",      "icon": "🖥️"},
    {"id": "filesystem",      "name": "FileSystem Worker",    "role": "files",           "agent": "file",         "icon": "📁"},
    {"id": "browser",         "name": "Browser Worker",       "role": "research",        "agent": "browser",      "icon": "🌐"},
    {"id": "vision",          "name": "Vision Worker",        "role": "ui_gen",          "agent": "vision",       "icon": "👁️"},
    {"id": "ui",              "name": "UI Worker",            "role": "ui",              "agent": "ui",           "icon": "🎨"},
    {"id": "debug",           "name": "Debug Worker",         "role": "debugging",       "agent": "debug",        "icon": "🐛"},
    {"id": "test",            "name": "Test Worker",          "role": "testing",         "agent": "test",         "icon": "🧪"},
    {"id": "verification",    "name": "Verification Worker",  "role": "qa",              "agent": "test",         "icon": "✅"},
    {"id": "git",             "name": "Git Worker",           "role": "git",             "agent": "git",          "icon": "🔀"},
    {"id": "deploy",          "name": "Deploy Worker",        "role": "deployment",      "agent": "deploy",       "icon": "🚀"},
    {"id": "connector",       "name": "Connector Worker",     "role": "integration",     "agent": "connector",    "icon": "🔌"},
    {"id": "memory",          "name": "Memory Worker",        "role": "memory",          "agent": "memory",       "icon": "💾"},
    {"id": "knowledge",       "name": "Knowledge Worker",     "role": "knowledge",       "agent": "memory",       "icon": "📚"},
    {"id": "workflow",        "name": "Workflow Worker",       "role": "automation",      "agent": "workflow",     "icon": "⚙️"},
    {"id": "eventbus",        "name": "Event Bus",            "role": "events",          "agent": None,           "icon": "📡"},
    {"id": "model-router",    "name": "Model Router",         "role": "ai_routing",      "agent": None,           "icon": "🤖"},
    {"id": "observability",   "name": "Observability",        "role": "monitoring",      "agent": None,           "icon": "📊"},
    {"id": "session-runtime", "name": "Session Runtime",      "role": "sessions",        "agent": None,           "icon": "⏱️"},
    {"id": "auth-gateway",    "name": "Auth Gateway",         "role": "auth",            "agent": None,           "icon": "🔐"},
]


@app.get("/api/v1/spaces")
async def get_spaces():
    spaces_status = []
    for space in SPACE_DEFS:
        agent_name = space.get("agent")
        agent = orchestrator.get_agent(agent_name) if agent_name else None
        spaces_status.append({
            **space,
            "status": "active" if (agent is not None or agent_name is None) else "inactive",
            "online": True,
            "backend": "god-agent-os-v11",
            "tasks_completed": 0,
        })
    return {
        "spaces": spaces_status,
        "total": len(spaces_status),
        "active": len([s for s in spaces_status if s["status"] == "active"]),
        "backend_url": os.environ.get("SPACE_URL", "https://pyae1994-autonomous-coding-system.hf.space"),
    }


@app.get("/health")
@app.get("/api/v1/health")
async def health_check():
    stats = ai_router.get_stats() if ai_router else {}
    active_providers = [name for name, s in stats.items() if s.get("available")]
    return {
        "status": "healthy",
        "version": "11.0.0",
        "timestamp": time.time(),
        "agents": 16,
        "spaces": 22,
        "ai_providers": active_providers,
        "mode": "god_mode",
    }


@app.get("/api/v1/ai/stats")
async def get_ai_stats():
    return {"stats": ai_router.get_stats() if ai_router else {}}


@app.get("/api/v1/ai/pool-status")
async def get_pool_status():
    return {"pools": ai_router.get_pool_status() if ai_router else {}}


@app.get("/api/v1/system/status")
async def system_status():
    ai_stats = ai_router.get_stats() if ai_router else {}
    cs = connector_manager.get_summary() if connector_manager else {"connected": 0, "total": 0}
    return {
        "system": "god_agent_os_v11",
        "status": "operational",
        "timestamp": time.time(),
        "ai_router": {
            "providers": ai_stats,
            "active": len([v for v in ai_stats.values() if v.get("available")]),
        },
        "agents": {
            "total": 16,
            "online": 16,
        },
        "spaces": {"total": 22, "all_in_backend": True},
        "connectors": cs,
        "features": {
            "god_mode": True,
            "computer_use": True,
            "streaming": True,
            "websocket": True,
            "multi_agent": True,
            "burmese_language": True,
        },
    }


@app.get("/")
async def root():
    return {
        "name": "GOD AGENT OS v11",
        "version": "11.0.0",
        "status": "operational",
        "mode": "GOD_MODE",
        "docs": "/api/docs",
        "health": "/health",
        "agents": 16,
        "spaces": 22,
    }


if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 7860))
    uvicorn.run("main_v11:app", host="0.0.0.0", port=port, reload=False, workers=1)
