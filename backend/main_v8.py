"""
🚀 GOD AGENT OS v8 — Autonomous Engineering Operating System
Manus + Genspark + Devin (OneHand) Combined
Version: 8.0.0 — KeyPool Multi-API Routing (Gemini + SambaNova Primary LLMs)
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

from api.routes import tasks, chat, memory, github, health
from api.routes import connectors, agents as agents_router
from api.websocket_manager import WebSocketManager
from core.task_engine import TaskEngine
from memory.db import init_db

# ─── v8 AI Router (KeyPool-based) ─────────────────────────────────────────────
from ai_router.router_v8 import AIRouterV8

# ─── Agent Ecosystem ──────────────────────────────────────────────────────────
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


def build_orchestrator() -> GodAgentOrchestratorV7:
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
    log.info("🤖 GOD AGENT v8 Ecosystem initialized", agents=16)
    return orchestrator


orchestrator = build_orchestrator()


@asynccontextmanager
async def lifespan(app: FastAPI):
    log.info("🚀 Starting GOD AGENT OS v8 — KeyPool Multi-API Edition...")
    await init_db()
    await task_engine.start()
    asyncio.create_task(ws_manager.heartbeat_loop())
    # Print router status
    stats = ai_router.get_stats()
    active = [name for name, s in stats.items() if s["available"]]
    log.info("✅ GOD AGENT v8 — 16 agents online")
    log.info(f"🔑 Active AI providers: {active}")
    log.info("🌐 AI Routing: SambaNova → Gemini → OpenAI → Groq → Cerebras → OpenRouter → Anthropic")
    yield
    log.info("🛑 Shutting down GOD AGENT v8...")
    await task_engine.stop()


app = FastAPI(
    title="🤖 GOD AGENT OS v8",
    description="Autonomous Engineering OS — Gemini + SambaNova KeyPool Multi-API Routing",
    version="8.0.0",
    lifespan=lifespan,
    docs_url="/api/docs",
    redoc_url="/api/redoc",
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.state.ws_manager = ws_manager
app.state.task_engine = task_engine
app.state.ai_router = ai_router
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


# ─── WebSocket Endpoints ──────────────────────────────────────────────────────
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
                asyncio.create_task(orchestrator.orchestrate(
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
                await websocket.send_json({"type": "agent_status", "data": orchestrator.get_status()})
    except WebSocketDisconnect:
        ws_manager.disconnect(websocket, room="agent_status")


@app.websocket("/ws/sandbox/{session_id}")
async def ws_sandbox(websocket: WebSocket, session_id: str):
    await ws_manager.connect(websocket, room=f"sandbox:{session_id}")
    sandbox = orchestrator.get_agent("sandbox")
    try:
        while True:
            data = await websocket.receive_text()
            msg = json.loads(data)
            if msg.get("type") == "ping":
                await websocket.send_json({"type": "pong", "timestamp": time.time()})
            elif msg.get("type") == "execute" and sandbox:
                cmd = msg.get("command", "")
                result = await sandbox.execute(cmd, session_id=session_id)
                await websocket.send_json({"type": "terminal_output", "command": cmd, "output": result, "timestamp": time.time()})
    except WebSocketDisconnect:
        ws_manager.disconnect(websocket, room=f"sandbox:{session_id}")


# ─── v8 Key Pool & AI Router Status Endpoints ─────────────────────────────────
@app.get("/api/v1/ai/stats")
async def get_ai_stats():
    return {"stats": ai_router.get_stats()}


@app.get("/api/v1/ai/pool-status")
async def get_pool_status():
    return {"pools": ai_router.get_pool_status()}


@app.post("/api/v1/browser/research")
async def browser_research(request: Request):
    body = await request.json()
    browser = orchestrator.get_agent("browser")
    if not browser:
        raise HTTPException(status_code=503, detail="BrowserAgent not available")
    result = await browser.run(body.get("query", ""), session_id=body.get("session_id", ""))
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
    vision = orchestrator.get_agent("vision")
    if not vision:
        raise HTTPException(status_code=503, detail="VisionAgent not available")
    result = await vision.run(body.get("prompt", ""), context=body.get("context", {}), session_id=body.get("session_id", ""))
    return {"result": result}


# ─── Root ─────────────────────────────────────────────────────────────────────
@app.get("/")
async def root():
    cs = connector_manager.get_summary()
    status = orchestrator.get_status()
    stats = ai_router.get_stats()
    active_providers = [name for name, s in stats.items() if s["available"]]
    return {
        "name": "🤖 GOD AGENT OS v8",
        "version": "8.0.0",
        "status": "operational",
        "mode": "autonomous_engineering_os",
        "description": "KeyPool Multi-API Routing — Gemini + SambaNova Primary LLMs",
        "agents": status["agents"],
        "total_agents": status["total_agents"],
        "ai_providers": active_providers,
        "connectors": {"connected": cs["connected"], "total": cs["total"]},
        "docs": "/api/docs",
        "v8_features": [
            "🔑 KeyPool multi-key management (Gemini 6 keys + SambaNova 9 keys)",
            "🔄 Automatic key failover with cooldown tracking",
            "⚡ SambaNova → Gemini → OpenAI → Groq → Cerebras chain",
            "📊 Per-key usage stats & health monitoring",
            "🤖 16-agent autonomous fleet",
            "🌐 Real-time streaming via WebSocket",
        ],
    }


if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run("main_v8:app", host="0.0.0.0", port=port, reload=False, workers=1)
