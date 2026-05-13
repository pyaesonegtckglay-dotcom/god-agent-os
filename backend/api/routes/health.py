"""
Health + Status Routes
"""

import time
import os
import psutil
from fastapi import APIRouter, Request

router = APIRouter()


@router.get("/health", summary="Health check")
async def health(request: Request):
    ws = request.app.state.ws_manager
    engine = request.app.state.task_engine
    stats = ws.get_stats()
    return {
        "status": "healthy",
        "version": "2.0.0",
        "timestamp": time.time(),
        "websocket_connections": stats["total_connections"],
        "websocket_rooms": list(stats["rooms"].keys()),
        "task_queue_size": engine._queue.qsize(),
        "active_tasks": len(engine._active),
        "llm": {
            "openai": bool(os.environ.get("OPENAI_API_KEY")),
            "anthropic": bool(os.environ.get("ANTHROPIC_API_KEY")),
            "model": os.environ.get("DEFAULT_MODEL", "gpt-4o"),
        },
        "github": bool(os.environ.get("GITHUB_TOKEN")),
    }


@router.get("/metrics", summary="System metrics")
async def metrics():
    cpu = psutil.cpu_percent(interval=0.1)
    mem = psutil.virtual_memory()
    disk = psutil.disk_usage("/")
    return {
        "cpu_percent": cpu,
        "memory": {
            "total_mb": round(mem.total / 1024 / 1024),
            "used_mb": round(mem.used / 1024 / 1024),
            "percent": mem.percent,
        },
        "disk": {
            "total_gb": round(disk.total / 1024 / 1024 / 1024, 1),
            "used_gb": round(disk.used / 1024 / 1024 / 1024, 1),
            "percent": disk.percent,
        },
        "timestamp": time.time(),
    }
