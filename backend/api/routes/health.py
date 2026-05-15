"""
Health + Status Routes — God Mode+ v3.0
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
    orchestrator = getattr(request.app.state, "orchestrator", None)
    ai_router = getattr(request.app.state, "ai_router", None)
    connector_manager = getattr(request.app.state, "connector_manager", None)

    stats = ws.get_stats()
    cs = connector_manager.get_summary() if connector_manager else {}
    ai_stats = ai_router.get_stats() if ai_router else {}

    kernel = getattr(request.app.state, "kernel", None)
    kernel_status = kernel.get_status() if kernel else {}
    
    return {
        "status": "healthy",
        "name": "GOD AGENT OS v9 — General Autonomous Agent OS",
        "version": "9.0.0",
        "powered_by": "Pyae Sone",
        "architecture": "Space-Role Paradigm",
        "spaces": kernel_status.get("spaces", []),
        "timestamp": time.time(),
        "platform": {
            "mode": "god_mode_plus",
            "agents": orchestrator.get_status()["agents"] if orchestrator else [],
            "agent_count": orchestrator.get_status()["total_agents"] if orchestrator else 0,
        },
        "ai_router": {
            "providers": {k: v["available"] for k, v in ai_stats.items()},
            "ai_ready": any(v["available"] for v in ai_stats.values()),
        },
        "connectors": {
            "connected": cs.get("connected", 0),
            "total": cs.get("total", 0),
            "ai_ready": cs.get("ai_ready", False),
        },
        "task_engine": {
            "queue_size": engine._queue.qsize(),
            "active_tasks": len(engine._active),
        },
        "websocket": {
            "connections": stats["total_connections"],
            "rooms": list(stats["rooms"].keys()),
        },
        "phases": [
            "Phase 1: God Agent Orchestrator ✅",
            "Phase 2: Sandbox Agent ✅",
            "Phase 3: Connector System ✅",
            "Phase 4: Autonomous Coding Engine ✅",
            "Phase 5: Memory System ✅",
            "Phase 6: Real-time Streaming ✅",
            "Phase 7: Workflow Factor OS ✅",
            "Phase 8: Modern UI Rebuild ✅",
            "Phase 9: Multi-Model AI Router ✅",
            "Phase 10-12: Observability + Security + God Mode+ ✅",
        ],
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
