"""
🚀 GOD AGENT OS v10 — Distributed 22-Space Agent OS
Powered by Pyae Sone
"""

import asyncio
import json
import os
import time
import uuid
from contextlib import asynccontextmanager
from typing import Optional

import structlog
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

from api.routes import tasks, chat, memory, health
from api.routes import connectors, agents as agents_router
from api.websocket_manager import WebSocketManager
from core.task_engine import TaskEngine
from memory.db import init_db

# ─── v10 AI Router (Gemini + SambaNova + GitHub KeyPool routing) ─────────────
from ai_router.router_v10 import AIRouterV10 as AIRouterV8

# ─── v9 Agent Kernel & Spaces ─────────────────────────────────────────────────
from kernel.agent_kernel import AgentKernel
from spaces import SPACE_CATALOG, build_all_spaces

# ─── Legacy Agent Ecosystem (backward compatibility) ──────────────────────────
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

# ─── API Routes ───────────────────────────────────────────────────────────────
from api.routes import github

# ─── Structured Logging ───────────────────────────────────────────────────────
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

# ─── Global Managers ──────────────────────────────────────────────────────────
ws_manager = WebSocketManager()
task_engine = TaskEngine(ws_manager)
ai_router = AIRouterV8(ws_manager)
connector_manager = ConnectorManager()


def build_kernel() -> AgentKernel:
    """Build and configure the distributed 22-space Agent Kernel."""
    kernel = AgentKernel(ws_manager=ws_manager, ai_router=ai_router)
    for space_name, space_instance in build_all_spaces(ws_manager=ws_manager, ai_router=ai_router).items():
        kernel.register_space(space_name, space_instance)
    log.info("🧠 GOD AGENT OS distributed kernel initialized", spaces=len(SPACE_CATALOG))
    return kernel


def build_legacy_orchestrator() -> GodAgentOrchestratorV7:
    """Build legacy v7 orchestrator for backward compatibility."""
    orchestrator = GodAgentOrchestratorV7(ws_manager=ws_manager, ai_router=ai_router)
    orchestrator.register_agent("chat",       ChatAgent(ws_manager, ai_router))
    orchestrator.register_agent("planner",    PlannerAgent(ws_manager, ai_router))
    orchestrator.register_agent("coding",     CodingAgent(ws_manager, ai_router))
    orchestrator.register_agent("debug",      DebugAgent(ws_manager, ai_router))
    orchestrator.register_agent("memory",     MemoryAgent(ws_manager, ai_router))
    orchestrator.register_agent("connector",  ConnectorAgent(ws_manager, ai_router))
    orchestrator.register_agent("deploy",     DeployAgent(ws_manager, ai_router))
    orchestrator.register_agent("workflow",   WorkflowAgent(ws_manager, ai_router))
    orchestrator.register_agent("sandbox",    SandboxAgent(ws_manager, ai_router))
    orchestrator.register_agent("ui",         UIAgent(ws_manager, ai_router))
    orchestrator.register_agent("reasoning",  ReasoningAgent(ws_manager, ai_router))
    orchestrator.register_agent("browser",    BrowserAgent(ws_manager, ai_router))
    orchestrator.register_agent("file",       FileAgent(ws_manager, ai_router))
    orchestrator.register_agent("git",        GitAgent(ws_manager, ai_router))
    orchestrator.register_agent("test",       TestAgent(ws_manager, ai_router))
    orchestrator.register_agent("vision",     VisionAgent(ws_manager, ai_router))
    log.info("🤖 Legacy v7 Orchestrator initialized", agents=16)
    return orchestrator


# Initialize both kernel and legacy orchestrator
kernel = build_kernel()
orchestrator = build_legacy_orchestrator()


@asynccontextmanager
async def lifespan(app: FastAPI):
    log.info("🚀 Starting GOD AGENT OS v10 — Distributed 22-Space Architecture...")
    await init_db()
    await task_engine.start()
    asyncio.create_task(ws_manager.heartbeat_loop())
    stats = ai_router.get_stats()
    active = [name for name, s in stats.items() if s["available"]]
    log.info("✅ GOD AGENT v10 — 22 Spaces + 16 Legacy Agents online")
    log.info(f"🔑 Active AI providers: {active}")
    log.info("🌐 Routing: SambaNova → Gemini → OpenAI → Groq → Cerebras")
    log.info("📦 Spaces: distributed 22-space runtime online")
    yield
    log.info("🛑 Shutting down GOD AGENT OS v9...")
    await task_engine.stop()


app = FastAPI(
    title="🤖 GOD AGENT OS v10",
    description="Distributed 22-Space Autonomous Agent OS | Powered by Pyae Sone",
    version="10.0.0",
    lifespan=lifespan,
    docs_url="/api/docs",
    redoc_url="/api/redoc",
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.state.ws_manager = ws_manager
app.state.task_engine = task_engine
app.state.ai_router = ai_router
app.state.kernel = kernel
app.state.orchestrator = orchestrator
app.state.connector_manager = connector_manager

app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])
app.add_middleware(GZipMiddleware, minimum_size=1000)


@app.middleware("http")
async def log_requests(request: Request, call_next):
    start = time.time()
    response = await call_next(request)
    ms = round((time.time() - start) * 1000, 2)
    log.info("HTTP", method=request.method, path=request.url.path, status=response.status_code, ms=ms)
    return response


# ─── REST Routers ─────────────────────────────────────────────────────────────
app.include_router(health.router,        prefix="/api/v1",            tags=["health"])
app.include_router(tasks.router,         prefix="/api/v1/tasks",      tags=["tasks"])
app.include_router(chat.router,          prefix="/api/v1",            tags=["chat"])
app.include_router(memory.router,        prefix="/api/v1/memory",     tags=["memory"])
app.include_router(github.router,        prefix="/api/v1/github",     tags=["github"])
app.include_router(connectors.router,    prefix="/api/v1/connectors", tags=["connectors"])
app.include_router(agents_router.router, prefix="/api/v1/agents",     tags=["agents"])


# ─── WebSocket: Chat (v9 Kernel-powered) ──────────────────────────────────────
@app.websocket("/ws/chat/{session_id}")
async def ws_chat(websocket: WebSocket, session_id: str):
    await ws_manager.connect(websocket, room=f"chat:{session_id}")
    try:
        while True:
            data = await websocket.receive_text()
            msg = json.loads(data)
            
            if msg.get("type") == "ping":
                await websocket.send_json({"type": "pong", "timestamp": time.time()})
            
            elif msg.get("type") == "chat_message":
                # Route through v9 Agent Kernel
                asyncio.create_task(kernel.orchestrate(
                    user_message=msg.get("content", ""),
                    session_id=session_id,
                    context=msg.get("context", {}),
                ))
            
            elif msg.get("type") == "task_message":
                from core.models import TaskCreateRequest
                req = TaskCreateRequest(goal=msg.get("content", ""), session_id=session_id)
                asyncio.create_task(task_engine.submit(req))
    
    except WebSocketDisconnect:
        ws_manager.disconnect(websocket, room=f"chat:{session_id}")


@app.websocket("/ws/tasks/{task_id}")
async def ws_task(websocket: WebSocket, task_id: str):
    await ws_manager.connect(websocket, room=f"task:{task_id}")
    try:
        while True:
            data = await websocket.receive_text()
            msg = json.loads(data)
            if msg.get("type") == "ping":
                await websocket.send_json({"type": "pong", "timestamp": time.time()})
    except WebSocketDisconnect:
        ws_manager.disconnect(websocket, room=f"task:{task_id}")


@app.websocket("/ws/logs")
async def ws_logs(websocket: WebSocket):
    await ws_manager.connect(websocket, room="logs")
    try:
        while True:
            data = await websocket.receive_text()
            msg = json.loads(data)
            if msg.get("type") == "ping":
                await websocket.send_json({"type": "pong", "timestamp": time.time()})
    except WebSocketDisconnect:
        ws_manager.disconnect(websocket, room="logs")


@app.websocket("/ws/agent/status")
async def ws_agent_status(websocket: WebSocket):
    await ws_manager.connect(websocket, room="agent_status")
    try:
        while True:
            data = await websocket.receive_text()
            msg = json.loads(data)
            if msg.get("type") == "ping":
                await websocket.send_json({"type": "pong", "timestamp": time.time()})
            elif msg.get("type") == "get_status":
                await websocket.send_json({
                    "type": "agent_status",
                    "data": kernel.get_status(),
                    "legacy": orchestrator.get_status(),
                })
    except WebSocketDisconnect:
        ws_manager.disconnect(websocket, room="agent_status")


@app.websocket("/ws/sandbox/{session_id}")
async def ws_sandbox(websocket: WebSocket, session_id: str):
    await ws_manager.connect(websocket, room=f"sandbox:{session_id}")
    sandbox_space = kernel.get_space("sandbox")
    try:
        while True:
            data = await websocket.receive_text()
            msg = json.loads(data)
            if msg.get("type") == "ping":
                await websocket.send_json({"type": "pong", "timestamp": time.time()})
            elif msg.get("type") == "execute" and sandbox_space:
                cmd = msg.get("command", "")
                result = await sandbox_space._run_shell(cmd)
                await websocket.send_json({
                    "type": "terminal_output",
                    "command": cmd,
                    "output": result,
                    "timestamp": time.time()
                })
    except WebSocketDisconnect:
        ws_manager.disconnect(websocket, room=f"sandbox:{session_id}")


# ─── v9 Space-Role API Endpoints ──────────────────────────────────────────────
@app.get("/api/v1/kernel/status")
async def kernel_status():
    """Get Agent Kernel status."""
    return {
        "kernel": kernel.get_status(),
        "ai_providers": ai_router.get_stats(),
    }


@app.get("/api/v1/spaces")
async def list_spaces():
    """List all available Spaces."""
    spaces_info = {}
    for name, space in kernel._spaces.items():
        spaces_info[name] = space.get_info()
    return {"spaces": spaces_info, "total": len(spaces_info)}


@app.post("/api/v1/spaces/{space_name}/execute")
async def execute_in_space(space_name: str, request: Request):
    """Execute a task in a specific Space."""
    body = await request.json()
    task = body.get("task", "")
    role = body.get("role", "cognition")
    session_id = body.get("session_id", "api")
    
    space = kernel.get_space(space_name)
    if not space:
        raise HTTPException(status_code=404, detail=f"Space '{space_name}' not found")
    
    result = await space.execute(task=task, role=role, session_id=session_id, context=body.get("context", {}))
    return {"space": space_name, "role": role, "result": result}


@app.post("/api/v1/kernel/orchestrate")
async def kernel_orchestrate(request: Request):
    """Main orchestration endpoint."""
    body = await request.json()
    result = await kernel.orchestrate(
        user_message=body.get("message", ""),
        session_id=body.get("session_id", "api"),
        context=body.get("context", {}),
    )
    return {"result": result}


# ─── Legacy v8 Endpoints (backward compatibility) ─────────────────────────────
@app.get("/api/v1/ai/stats")
async def get_ai_stats():
    return {"stats": ai_router.get_stats()}


@app.get("/api/v1/ai/pool-status")
async def get_pool_status():
    return {"pools": ai_router.get_pool_status()}


@app.post("/api/v1/browser/research")
async def browser_research(request: Request):
    body = await request.json()
    browser_space = kernel.get_space("browser")
    if not browser_space:
        raise HTTPException(status_code=503, detail="Browser Space not available")
    result = await browser_space.execute(
        task=body.get("query", ""),
        role="automation",
        session_id=body.get("session_id", "api"),
    )
    return {"result": result}


@app.get("/api/v1/files/workspace")
async def list_workspace():
    file_agent = orchestrator.get_agent("file")
    if not file_agent:
        return {"workspace": "/tmp/god_workspace", "files": [], "total": 0}
    return file_agent.list_workspace()


@app.post("/api/v1/git/pr")
async def create_pr(request: Request):
    body = await request.json()
    git_agent = orchestrator.get_agent("git")
    if not git_agent:
        raise HTTPException(status_code=503, detail="GitAgent not available")
    result = await git_agent.create_github_pr(
        repo_owner=body.get("owner", ""),
        repo_name=body.get("repo", ""),
        title=body.get("title", ""),
        body=body.get("body", ""),
        head_branch=body.get("head_branch", "main"),
        base_branch=body.get("base_branch", "main"),
    )
    return result


@app.post("/api/v1/vision/generate")
async def generate_ui(request: Request):
    body = await request.json()
    vision_space = kernel.get_space("vision")
    if not vision_space:
        raise HTTPException(status_code=503, detail="Vision Space not available")
    result = await vision_space.execute(
        task=body.get("prompt", ""),
        role="visual_intelligence",
        session_id=body.get("session_id", "api"),
    )
    return {"result": result}


# ─── Root ─────────────────────────────────────────────────────────────────────
@app.get("/")
async def root():
    cs = connector_manager.get_summary()
    kernel_status_data = kernel.get_status()
    stats = ai_router.get_stats()
    active_providers = [name for name, s in stats.items() if s["available"]]
    return {
        "name": "🤖 GOD AGENT OS v10",
        "version": "10.0.0",
        "status": "operational",
        "mode": "general_autonomous_agent_os",
        "description": "Distributed 22-Space Architecture | Powered by Pyae Sone",
        "architecture": "Distributed Worker Space Paradigm",
        "spaces": kernel_status_data["spaces"],
        "total_spaces": kernel_status_data["total_spaces"],
        "ai_providers": active_providers,
        "connectors": {"connected": cs["connected"], "total": cs["total"]},
        "docs": "/api/docs",
        "v9_features": [
            "📦 22 distributed worker spaces across cognition, execution, verification, deployment, memory, coordination, monitoring, session, and infrastructure layers",
            "🎭 5 Cognitive Roles: Cognition | Automation | Execution | Repair | Visual Intelligence",
            "🧠 God Core Space orchestrates the worker fleet",
            "🔑 KeyPool multi-key management (Gemini + SambaNova + GitHub)",
            "🔄 Automatic worker-space routing based on intent",
            "💾 Context Manager for session-scoped runtime state",
            "⚡ Backward compatible with v8/v9 agent fleet",
            "🌐 Real-time streaming via WebSocket",
        ],
    }


if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 7860))
    uvicorn.run("main_v9:app", host="0.0.0.0", port=port, reload=False, workers=1)
