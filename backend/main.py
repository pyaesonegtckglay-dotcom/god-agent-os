"""
🚀 GOD AGENT OS — Autonomous AI Operating System v8
Gemini + Sambanova + GitHub Models — Primary Provider Rotation
Task-aware routing: research→Gemini, code→Sambanova, plan→GitHub
"""

# ─── Inject bundled API keys (env vars take precedence) ───────────────────────
import os as _os

def _inject_key(env_var: str, value: str):
    """Set env var only if not already configured."""
    if not _os.environ.get(env_var):
        _os.environ[env_var] = value

# Keys are loaded from HF Space Secrets / Docker env vars.
# Set GEMINI_KEY, SAMBANOVA_KEY, GITHUB_KEY as comma-separated lists.
# Fallback: read from .env.keys file if present (not committed to git).
_keys_file = _os.path.join(_os.path.dirname(__file__), ".env.keys")
if _os.path.exists(_keys_file):
    with open(_keys_file) as _f:
        for _line in _f:
            _line = _line.strip()
            if _line and "=" in _line and not _line.startswith("#"):
                _k, _v = _line.split("=", 1)
                _inject_key(_k.strip(), _v.strip())

# ─── Pre-configure known service URLs (users can override via Connectors) ─────
_inject_key("N8N_URL", "https://pyae1994-n8n-aiven-v1.hf.space")
_inject_key("N8N_API_KEY", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3NjRiOWE5Yi05NWVlLTQ2N2EtOGZjNS00YmM0MTY2Nzg4NmYiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiYjk1NDAxOGUtNzlmZi00NDg2LWE4OTMtZjEzOTY5MTE4MGRkIiwiaWF0IjoxNzc2MDY0NDA0fQ.b-Q6NGk9uGT04K4DsJLbfH974U9phjnUfTYGZmW0hV4")
# ─────────────────────────────────────────────────────────────────────────────


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
from api.routes import n8n as n8n_router
from api.websocket_manager import WebSocketManager
from core.task_engine import TaskEngine
from memory.db import init_db

# ─── God Mode Agents ───────────────────────────────────────────────────────────
from ai_router.router import AIRouter
from ai_router.router_v8 import GodModeRouter, get_router as get_god_router
from agents.orchestrator import GodAgentOrchestrator
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
god_router = get_god_router(ws_manager)   # v8 primary router
connector_manager = ConnectorManager()

# ─── Build God Agent Ecosystem ────────────────────────────────────────────────
def build_orchestrator() -> GodAgentOrchestrator:
    orchestrator = GodAgentOrchestrator(ws_manager=ws_manager, ai_router=ai_router)

    # Register all specialized agents
    orchestrator.register_agent("chat",      ChatAgent(ws_manager, ai_router))
    orchestrator.register_agent("planner",   PlannerAgent(ws_manager, ai_router))
    orchestrator.register_agent("coding",    CodingAgent(ws_manager, ai_router))
    orchestrator.register_agent("debug",     DebugAgent(ws_manager, ai_router))
    orchestrator.register_agent("memory",    MemoryAgent(ws_manager, ai_router))
    orchestrator.register_agent("connector", ConnectorAgent(ws_manager, ai_router))
    orchestrator.register_agent("deploy",    DeployAgent(ws_manager, ai_router))
    orchestrator.register_agent("workflow",  WorkflowAgent(ws_manager, ai_router))
    orchestrator.register_agent("sandbox",   SandboxAgent(ws_manager, ai_router))
    orchestrator.register_agent("ui",        UIAgent(ws_manager, ai_router))

    log.info("🤖 God Agent Ecosystem initialized", agents=10)
    return orchestrator

orchestrator = build_orchestrator()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup + Shutdown lifecycle."""
    log.info("🚀 Starting GOD MODE+ AI Operating System...")
    await init_db()
    await task_engine.start()
    asyncio.create_task(ws_manager.heartbeat_loop())
    log.info("✅ GOD MODE+ Platform ready — All agents online")
    log.info("🤖 Agents: Chat, Planner, Coding, Debug, Memory, Connector, Deploy, Workflow, Sandbox, UI")
    log.info("🌐 AI Router v8: Gemini → Sambanova → GitHub Models (task-aware rotation)")
    yield
    log.info("🛑 Shutting down...")
    await task_engine.stop()
    log.info("✅ Shutdown complete")


# ─── FastAPI App ───────────────────────────────────────────────────────────────
app = FastAPI(
    title="🤖 GOD MODE+ AI Operating System",
    description="Devin + Manus + Genspark Autonomous AI Engineering Platform",
    version="3.0.0",
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
app.include_router(health.router,             prefix="/api/v1",              tags=["health"])
app.include_router(tasks.router,              prefix="/api/v1/tasks",        tags=["tasks"])
app.include_router(chat.router,               prefix="/api/v1",              tags=["chat"])
app.include_router(memory.router,             prefix="/api/v1/memory",       tags=["memory"])
app.include_router(github.router,             prefix="/api/v1/github",       tags=["github"])
app.include_router(connectors.router,         prefix="/api/v1/connectors",   tags=["connectors"])
app.include_router(agents_router.router,      prefix="/api/v1/agents",       tags=["agents"])
app.include_router(n8n_router.router,         prefix="/api/v1/n8n",          tags=["n8n"])


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
                # Route through God Agent Orchestrator
                asyncio.create_task(
                    orchestrator.orchestrate(
                        user_message=msg.get("content", ""),
                        session_id=session_id,
                        context=msg.get("context", {}),
                    )
                )
            elif msg.get("type") == "task_message":
                # Create autonomous task via task engine
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
    """Live sandbox terminal stream."""
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


# ─── Root ──────────────────────────────────────────────────────────────────────
@app.get("/")
async def root():
    cs = connector_manager.get_summary()
    return {
        "name": "🤖 GOD MODE+ AI Operating System",
        "version": "3.0.0",
        "status": "operational",
        "mode": "god_mode_plus",
        "agents": orchestrator.get_status()["agents"],
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
        "phases_complete": [
            "Phase 1: God Agent Orchestrator",
            "Phase 2: Sandbox Agent",
            "Phase 3: Connector System",
            "Phase 4: Autonomous Coding Engine",
            "Phase 5: Memory System",
            "Phase 6: Real-time Streaming",
            "Phase 7: Workflow Factor OS",
            "Phase 9: Multi-Model AI Router",
        ],
    }
