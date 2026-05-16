"""
Memory API Routes — Persistent agent memory
"""

import time
from fastapi import APIRouter, HTTPException, Query
from core.models import MemorySaveRequest, MemorySearchRequest
from memory.db import save_memory, search_memory, get_project_memory, get_history, list_sessions

router = APIRouter()


@router.get("/", summary="List all memories")
async def list_memories(
    session_id: str = Query(default=""),
    limit: int = Query(default=50, le=200),
):
    """Return recent memories — used by the frontend Memory page."""
    try:
        from memory.db import search_memory as _search
        import aiosqlite
        from memory.db import DB_PATH
        import json

        async with aiosqlite.connect(DB_PATH) as db:
            db.row_factory = aiosqlite.Row
            if session_id:
                async with db.execute(
                    "SELECT * FROM memory WHERE session_id = ? ORDER BY updated_at DESC LIMIT ?",
                    (session_id, limit)
                ) as cursor:
                    rows = await cursor.fetchall()
            else:
                async with db.execute(
                    "SELECT * FROM memory ORDER BY updated_at DESC LIMIT ?", (limit,)
                ) as cursor:
                    rows = await cursor.fetchall()

            memories = []
            for r in rows:
                d = dict(r)
                try:
                    d["metadata"] = json.loads(d.get("metadata") or "{}")
                except Exception:
                    d["metadata"] = {}
                # Format date for frontend
                ts = d.get("created_at") or d.get("updated_at")
                if ts:
                    import datetime
                    d["date"] = datetime.datetime.fromtimestamp(ts).strftime("%Y-%m-%d %H:%M")
                memories.append(d)

        # Count sessions
        sessions = await list_sessions(limit=100)

        return {
            "memories": memories,
            "total": len(memories),
            "sessions": len(sessions),
            "storage": f"{round(sum(len(m.get('content','')) for m in memories) / 1024, 1)} KB",
        }
    except Exception as e:
        return {"memories": [], "total": 0, "sessions": 0, "storage": "0 KB", "error": str(e)}


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


@router.get("/history/{session_id}", summary="Get conversation history")
async def history(session_id: str, limit: int = Query(default=50, le=200)):
    results = await get_history(session_id, limit=limit)
    return {"session_id": session_id, "history": results, "total": len(results)}
