"""
Health + Status Routes — GOD AGENT OS v11
"""

import time
import os
import psutil
from fastapi import APIRouter, Request

router = APIRouter()


@router.get("/health", summary="Health check")
async def health(request: Request):
    ws = getattr(request.app.state, "ws_manager", None)
    engine = getattr(request.app.state, "task_engine", None)
    orchestrator = getattr(request.app.state, "orchestrator", None)
    ai_router = getattr(request.app.state, "ai_router", None)
    connector_manager = getattr(request.app.state, "connector_manager", None)

    ws_stats = ws.get_stats() if ws else {"total_connections": 0, "rooms": {}}
    cs = connector_manager.get_summary() if connector_manager else {"connected": 0, "total": 0}
    ai_stats = ai_router.get_stats() if ai_router else {}

    orch_status = orchestrator.get_status() if orchestrator else {"agents": [], "total_agents": 0}

    return {
        "status": "healthy",
        "name": "GOD AGENT OS v11 — Autonomous Engineering OS",
        "version": "11.0.0",
        "powered_by": "Pyae Sone",
        "architecture": "Multi-Agent Orchestrator + Worker Spaces",
        "timestamp": time.time(),
        "platform": {
            "mode": "god_mode",
            "agents": orch_status.get("agents", []),
            "agent_count": orch_status.get("total_agents", 0),
        },
        "ai_router": {
            "providers": {k: v.get("available", False) for k, v in ai_stats.items()},
            "ai_ready": any(v.get("available", False) for v in ai_stats.values()),
        },
        "connectors": {
            "connected": cs.get("connected", 0),
            "total": cs.get("total", 0),
            "ai_ready": cs.get("ai_ready", False),
        },
        "task_engine": {
            "queue_size": engine._queue.qsize() if engine else 0,
            "active_tasks": len(engine._active) if engine else 0,
        },
        "websocket": {
            "connections": ws_stats.get("total_connections", 0),
            "rooms": list(ws_stats.get("rooms", {}).keys()),
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
            "Phase 9: Multi-Model AI Router v10 ✅",
            "Phase 10: v11 Production Hardening ✅",
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
