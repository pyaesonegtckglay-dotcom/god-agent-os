"""
Memory API Routes — Persistent agent memory and chat sessions
"""

import time
from fastapi import APIRouter, Query
from core.models import MemorySaveRequest, MemorySearchRequest
from memory.db import (
    save_memory,
    search_memory,
    get_project_memory,
    get_history,
    list_sessions,
    get_session,
)

router = APIRouter()


@router.post("/", summary="Save memory")
async def save(req: MemorySaveRequest):
    await save_memory(
        content=req.content,
        memory_type=req.memory_type.value,
        session_id=req.session_id,
        project_id=req.project_id,
        key=req.key,
        metadata=req.metadata,
    )
    return {"status": "saved", "memory_type": req.memory_type, "timestamp": time.time()}


@router.post("/search", summary="Search memory")
async def search(req: MemorySearchRequest):
    results = await search_memory(
        query=req.query,
        session_id=req.session_id,
        project_id=req.project_id,
        limit=req.limit,
    )
    return {"results": results, "total": len(results), "query": req.query}


@router.get("/project/{project_id}", summary="Get project memory")
async def project_memory(
    project_id: str,
    memory_type: str = Query(default=""),
    limit: int = Query(default=100, le=500),
):
    results = await get_project_memory(project_id, memory_type=memory_type, limit=limit)
    return {"project_id": project_id, "memories": results, "total": len(results)}


@router.get("/sessions", summary="List chat sessions")
async def sessions(limit: int = Query(default=100, le=500)):
    results = await list_sessions(limit=limit)
    return {"sessions": results, "total": len(results)}


@router.get("/sessions/{session_id}", summary="Get session metadata")
async def session_detail(session_id: str):
    session = await get_session(session_id)
    return {"session": session}


@router.get("/history/{session_id}", summary="Get conversation history")
async def history(session_id: str, limit: int = Query(default=100, le=500)):
    results = await get_history(session_id, limit=limit)
    return {"session_id": session_id, "history": results, "total": len(results)}
