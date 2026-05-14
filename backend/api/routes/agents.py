"""
God Agent Orchestrator API Routes
"""
from fastapi import APIRouter, Request, HTTPException
from pydantic import BaseModel
from typing import Optional, Dict, Any

router = APIRouter()


class OrchestrateRequest(BaseModel):
    message: str
    session_id: str = ""
    task_id: str = ""
    context: Dict[str, Any] = {}


class SandboxExecRequest(BaseModel):
    command: str
    cwd: str = ""
    timeout: int = 30


class FileWriteRequest(BaseModel):
    filename: str
    content: str


@router.post("/orchestrate")
async def orchestrate(req: OrchestrateRequest, request: Request):
    """Route message through God Agent Orchestrator."""
    orchestrator = getattr(request.app.state, "orchestrator", None)
    if not orchestrator:
        raise HTTPException(500, "Orchestrator not initialized")
    result = await orchestrator.orchestrate(
        user_message=req.message,
        session_id=req.session_id,
        task_id=req.task_id,
        context=req.context,
    )
    return {"result": result, "session_id": req.session_id}


@router.get("/status")
async def agent_status(request: Request):
    """Get all agent statuses."""
    orchestrator = getattr(request.app.state, "orchestrator", None)
    if not orchestrator:
        return {"status": "not_initialized"}
    return orchestrator.get_status()


@router.post("/sandbox/execute")
async def sandbox_execute(req: SandboxExecRequest, request: Request):
    """Execute command in sandbox."""
    orchestrator = getattr(request.app.state, "orchestrator", None)
    if not orchestrator:
        raise HTTPException(500, "Orchestrator not initialized")
    sandbox = orchestrator.get_agent("sandbox")
    if not sandbox:
        raise HTTPException(503, "SandboxAgent not available")
    result = await sandbox.execute(req.command, cwd=req.cwd, timeout=req.timeout)
    return {"result": result, "command": req.command}


@router.post("/sandbox/file")
async def sandbox_write_file(req: FileWriteRequest, request: Request):
    """Write file to sandbox workspace."""
    orchestrator = getattr(request.app.state, "orchestrator", None)
    if not orchestrator:
        raise HTTPException(500, "Orchestrator not initialized")
    sandbox = orchestrator.get_agent("sandbox")
    if not sandbox:
        raise HTTPException(503, "SandboxAgent not available")
    result = await sandbox.write_file(req.filename, req.content)
    return {"result": result, "filename": req.filename}


@router.get("/sandbox/workspace")
async def sandbox_workspace(request: Request):
    """Get workspace info."""
    orchestrator = getattr(request.app.state, "orchestrator", None)
    if not orchestrator:
        raise HTTPException(500, "Orchestrator not initialized")
    sandbox = orchestrator.get_agent("sandbox")
    if not sandbox:
        raise HTTPException(503, "SandboxAgent not available")
    info = await sandbox.get_workspace_info()
    return info


@router.get("/ai-router/stats")
async def ai_router_stats(request: Request):
    """Get AI router statistics."""
    ai_router = getattr(request.app.state, "ai_router", None)
    if not ai_router:
        return {"stats": {}}
    return {"stats": ai_router.get_stats()}
