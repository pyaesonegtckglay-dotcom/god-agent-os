"""
🚀 Devin-Style Autonomous AI Engineering Platform
Production-Grade FastAPI + WebSocket Backend
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
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, Depends, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

from api.routes import tasks, chat, memory, github, health
from api.websocket_manager import WebSocketManager
from core.task_engine import TaskEngine
from memory.db import init_db

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

# ─── Global Managers (shared state) ───────────────────────────────────────────
ws_manager = WebSocketManager()
task_engine = TaskEngine(ws_manager)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup + Shutdown lifecycle."""
    log.info("🚀 Starting Devin Agent Platform...")
    await init_db()
    await task_engine.start()
    asyncio.create_task(ws_manager.heartbeat_loop())
    log.info("✅ Platform ready")
    yield
    log.info("🛑 Shutting down...")
    await task_engine.stop()
    log.info("✅ Shutdown complete")


# ─── FastAPI App ───────────────────────────────────────────────────────────────
app = FastAPI(
    title="🤖 Devin Agent Platform",
    description="Production-Grade Autonomous AI Engineering Platform",
    version="2.0.0",
    lifespan=lifespan,
    docs_url="/api/docs",
    redoc_url="/api/redoc",
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# ─── Middleware ────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(GZipMiddleware, minimum_size=1000)


# ─── Request Logging ───────────────────────────────────────────────────────────
@app.middleware("http")
async def log_requests(request: Request, call_next):
    start = time.time()
    response = await call_next(request)
    duration = round((time.time() - start) * 1000, 2)
    log.info("HTTP", method=request.method, path=request.url.path, status=response.status_code, ms=duration)
    return response


# ─── Inject shared state into routes ──────────────────────────────────────────
app.state.ws_manager = ws_manager
app.state.task_engine = task_engine


# ─── REST API Routers ──────────────────────────────────────────────────────────
app.include_router(health.router, prefix="/api/v1", tags=["health"])
app.include_router(tasks.router, prefix="/api/v1/tasks", tags=["tasks"])
app.include_router(chat.router, prefix="/api/v1", tags=["chat"])
app.include_router(memory.router, prefix="/api/v1/memory", tags=["memory"])
app.include_router(github.router, prefix="/api/v1/github", tags=["github"])


# ─── WebSocket Endpoints ───────────────────────────────────────────────────────
@app.websocket("/ws/tasks/{task_id}")
async def ws_task(websocket: WebSocket, task_id: str):
    """Live streaming for specific task execution."""
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
    """Global live log stream."""
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
    """Real-time chat streaming per session."""
    await ws_manager.connect(websocket, room=f"chat:{session_id}")
    try:
        while True:
            data = await websocket.receive_text()
            msg = json.loads(data)
            if msg.get("type") == "ping":
                await websocket.send_json({"type": "pong", "timestamp": time.time()})
            elif msg.get("type") == "chat_message":
                # Trigger streaming chat response
                asyncio.create_task(
                    task_engine.handle_chat_message(session_id, msg.get("content", ""), websocket)
                )
    except WebSocketDisconnect:
        ws_manager.disconnect(websocket, room=f"chat:{session_id}")


@app.websocket("/ws/agent/status")
async def ws_agent_status(websocket: WebSocket):
    """Global agent status stream."""
    await ws_manager.connect(websocket, room="agent_status")
    try:
        while True:
            data = await websocket.receive_text()
            msg = json.loads(data)
            if msg.get("type") == "ping":
                await websocket.send_json({"type": "pong", "timestamp": time.time()})
    except WebSocketDisconnect:
        ws_manager.disconnect(websocket, room="agent_status")


# ─── Root ──────────────────────────────────────────────────────────────────────
@app.get("/")
async def root():
    return {
        "name": "🤖 Devin Agent Platform",
        "version": "2.0.0",
        "status": "operational",
        "docs": "/api/docs",
        "websockets": ["/ws/tasks/{task_id}", "/ws/logs", "/ws/chat/{session_id}", "/ws/agent/status"],
    }
