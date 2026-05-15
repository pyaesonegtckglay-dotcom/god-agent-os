"""
🚀 GOD AGENT OS v7 — Autonomous Engineering Operating System
Manus + Genspark + Devin (OneHand) Combined
Version: 7.0.0
"""

import asyncio
import json
import logging
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

# ─── v7 God Agent Ecosystem ────────────────────────────────────────────────────
from ai_router.router import AIRouter
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
# v7 new agents
from agents.browser_agent import BrowserAgent
from agents.file_agent import FileAgent
from agents.git_agent import GitAgent
from agents.test_agent import TestAgent
from agents.vision_agent import VisionAgent
from connectors.manager import ConnectorManager

# ─── Structured Logging ────────────────────────────────────────────────────────
structlog.configure(
    processors=[
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.stdlib.add_log_level,
        structlog.processors.StackInfoRenderer(),
        structlog.dev.ConsoleRenderer(),
    ]
)
log = structlog.get_logger()

# ─── Rate Limiter ──────────────────────────────────────────────────────────────
limiter = Limiter(key_func=get_remote_address)

# ─── Global Managers ──────────────────────────────────────────────────────────
ws_manager = WebSocketManager()
task_engine = TaskEngine(ws_manager)
ai_router = AIRouter(ws_manager)
connector_manager = ConnectorManager()


# ─── Build v7 God Agent Ecosystem ─────────────────────────────────────────────
def build_orchestrator_v7() -> GodAgentOrchestratorV7:
    orchestrator = GodAgentOrchestratorV7(ws_manager=ws_manager, ai_router=ai_router)

    # ── Core agents (v3 retained) ──────────────────────────────────────────
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

    # ── v7 NEW agents ──────────────────────────────────────────────────────
    orchestrator.register_agent("browser",    BrowserAgent(ws_manager, ai_router))
    orchestrator.register_agent("file",       FileAgent(ws_manager, ai_router))
    orchestrator.register_agent("git",        GitAgent(ws_manager, ai_router))
    orchestrator.register_agent("test",       TestAgent(ws_manager, ai_router))
    orchestrator.register_agent("vision",     VisionAgent(ws_manager, ai_router))

    log.info("🤖 GOD AGENT v7 Ecosystem initialized", agents=16)
    return orchestrator


orchestrator = build_orchestrator_v7()


@asynccontextmanager
async def lifespan(app: FastAPI):
    log.info("🚀 Starting GOD AGENT OS v7 — Autonomous Engineering Platform...")
    await init_db()
    await task_engine.start()
    asyncio.create_task(ws_manager.heartbeat_loop())
    log.info("✅ GOD AGENT v7 — All 16 agents online")
    log.info("🤖 Core: Chat, Planner, Coding, Debug, Memory, Connector, Deploy, Workflow, Sandbox, UI, Reasoning")
    log.info("⚡ v7 New: Browser, File, Git, Test, Vision")
    log.info("🌐 AI Router: OpenAI → Groq → Cerebras → OpenRouter → Anthropic (auto-failover)")
    yield
    log.info("🛑 Shutting down GOD AGENT v7...")
    await task_engine.stop()
    log.info("✅ Shutdown complete")


# ─── FastAPI App ───────────────────────────────────────────────────────────────
app = FastAPI(
    title="🤖 GOD AGENT OS v7",
    description="Autonomous Engineering OS — Manus + Genspark + Devin (OneHand) Combined",
    version="7.0.0",
    lifespan=lifespan,
    docs_url="/api/docs",
    redoc_url="/api/redoc",
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# ─── Share state ───────────────────────────────────────────────────────────────
app.state.ws_manager = ws_manager
app.state.task_engine = task_engine
app.state.ai_router = ai_router
app.state.orchestrator = orchestrator
app.state.connector_manager = connector_manager

# ─── Middleware ────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(GZipMiddleware, minimum_size=1000)


@app.middleware("http")
async def log_requests(request: Request, call_next):
    start = time.time()
    response = await call_next(request)
    duration = round((time.time() - start) * 1000, 2)
    log.info("HTTP", method=request.method, path=request.url.path, status=response.status_code, ms=duration)
    return response


# ─── REST API Routers ──────────────────────────────────────────────────────────
app.include_router(health.router,         prefix="/api/v1",            tags=["health"])
app.include_router(tasks.router,          prefix="/api/v1/tasks",      tags=["tasks"])
app.include_router(chat.router,           prefix="/api/v1",            tags=["chat"])
app.include_router(memory.router,         prefix="/api/v1/memory",     tags=["memory"])
app.include_router(github.router,         prefix="/api/v1/github",     tags=["github"])
app.include_router(connectors.router,     prefix="/api/v1/connectors", tags=["connectors"])
app.include_router(agents_router.router,  prefix="/api/v1/agents",     tags=["agents"])


# ─── WebSocket Endpoints ───────────────────────────────────────────────────────
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
                asyncio.create_task(
                    orchestrator.orchestrate(
                        user_message=msg.get("content", ""),
                        session_id=session_id,
                        context=msg.get("context", {}),
                    )
                )
            elif msg.get("type") == "task_message":
                from core.models import TaskCreateRequest
                req = TaskCreateRequest(
                    goal=msg.get("content", ""),
                    session_id=session_id,
                )
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
                await websocket.send_json({
                    "type": "agent_status",
                    "data": orchestrator.get_status(),
                })
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
                await websocket.send_json({
                    "type": "terminal_output",
                    "command": cmd,
                    "output": result,
                    "timestamp": time.time(),
                })
    except WebSocketDisconnect:
        ws_manager.disconnect(websocket, room=f"sandbox:{session_id}")


# ─── v7 New Endpoints ──────────────────────────────────────────────────────────
@app.post("/api/v1/browser/research")
async def browser_research(request: Request):
    body = await request.json()
    query = body.get("query", "")
    session_id = body.get("session_id", "")
    browser = orchestrator.get_agent("browser")
    if not browser:
        raise HTTPException(status_code=503, detail="BrowserAgent not available")
    result = await browser.run(query, session_id=session_id)
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
    result = await vision.run(
        body.get("prompt", ""),
        context=body.get("context", {}),
        session_id=body.get("session_id", ""),
    )
    return {"result": result}


# ─── Root ──────────────────────────────────────────────────────────────────────
@app.get("/")
async def root():
    cs = connector_manager.get_summary()
    status = orchestrator.get_status()
    return {
        "name": "🤖 GOD AGENT OS v7",
        "version": "7.0.0",
        "status": "operational",
        "mode": "autonomous_engineering_os",
        "description": "Manus + Genspark + Devin (OneHand) — Autonomous Engineering Platform",
        "agents": status["agents"],
        "total_agents": status["total_agents"],
        "capabilities": status["capabilities"],
        "connectors": {
            "connected": cs["connected"],
            "total": cs["total"],
            "ai_ready": cs["ai_ready"],
        },
        "docs": "/api/docs",
        "websockets": [
            "/ws/tasks/{task_id}",
            "/ws/logs",
            "/ws/chat/{session_id}",
            "/ws/agent/status",
            "/ws/sandbox/{session_id}",
        ],
        "v7_new_features": [
            "🌐 BrowserAgent — Web research & scraping",
            "📁 FileAgent — Full file system control & project scaffolding",
            "🔀 GitAgent — Autonomous Git & GitHub PR operations",
            "🧪 TestAgent — Auto test generation & execution",
            "🎨 VisionAgent — Design-to-code UI generation",
            "⚡ 16-agent parallel orchestration",
            "🔄 Advanced self-healing loop",
            "🧠 Enhanced intent classification",
            "📊 Real-time execution timeline",
        ],
    }


if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run("main_v7:app", host="0.0.0.0", port=port, reload=False, workers=1)
