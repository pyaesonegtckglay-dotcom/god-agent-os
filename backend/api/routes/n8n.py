"""
N8N Workflow Proxy Routes — God Agent OS
Proxies requests to the user's n8n instance for real workflow monitoring
"""
import os
import time
import httpx
import structlog
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import Optional, Any, Dict

router = APIRouter()
log = structlog.get_logger()

# ── N8N Config (env or defaults) ─────────────────────────────────────────────
def get_n8n_config() -> tuple[str, str]:
    url = os.environ.get("N8N_URL", "").rstrip("/")
    api_key = os.environ.get("N8N_API_KEY", "")
    return url, api_key


def n8n_headers(api_key: str) -> dict:
    return {
        "X-N8N-API-KEY": api_key,
        "Content-Type": "application/json",
        "Accept": "application/json",
    }


async def n8n_get(path: str, timeout: float = 10.0) -> Any:
    url, api_key = get_n8n_config()
    if not url:
        raise HTTPException(status_code=503, detail="N8N_URL not configured. Set it in Connectors.")
    async with httpx.AsyncClient(timeout=timeout) as client:
        try:
            resp = await client.get(f"{url}/api/v1{path}", headers=n8n_headers(api_key))
            resp.raise_for_status()
            return resp.json()
        except httpx.HTTPStatusError as e:
            raise HTTPException(status_code=e.response.status_code, detail=f"N8N error: {e.response.text[:200]}")
        except httpx.RequestError as e:
            raise HTTPException(status_code=503, detail=f"Cannot reach N8N at {url}: {str(e)}")


async def n8n_post(path: str, data: dict, timeout: float = 15.0) -> Any:
    url, api_key = get_n8n_config()
    if not url:
        raise HTTPException(status_code=503, detail="N8N_URL not configured.")
    async with httpx.AsyncClient(timeout=timeout) as client:
        try:
            resp = await client.post(f"{url}/api/v1{path}", headers=n8n_headers(api_key), json=data)
            resp.raise_for_status()
            return resp.json()
        except httpx.HTTPStatusError as e:
            raise HTTPException(status_code=e.response.status_code, detail=f"N8N error: {e.response.text[:200]}")
        except httpx.RequestError as e:
            raise HTTPException(status_code=503, detail=f"Cannot reach N8N: {str(e)}")


# ── Status ────────────────────────────────────────────────────────────────────
@router.get("/status")
async def n8n_status():
    """Check if N8N is reachable and return connection info."""
    url, api_key = get_n8n_config()
    if not url:
        return {
            "connected": False,
            "url": None,
            "error": "N8N_URL not configured",
            "timestamp": time.time(),
        }
    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            resp = await client.get(f"{url}/api/v1/workflows?limit=1", headers=n8n_headers(api_key))
            ok = resp.status_code == 200
            return {
                "connected": ok,
                "url": url,
                "status_code": resp.status_code,
                "timestamp": time.time(),
            }
    except Exception as e:
        return {
            "connected": False,
            "url": url,
            "error": str(e),
            "timestamp": time.time(),
        }


# ── Workflows ─────────────────────────────────────────────────────────────────
@router.get("/workflows")
async def list_workflows(limit: int = 50, active: Optional[bool] = None):
    """List all n8n workflows."""
    path = f"/workflows?limit={limit}"
    if active is not None:
        path += f"&active={str(active).lower()}"
    data = await n8n_get(path)
    workflows = data.get("data", [])

    # Normalize response
    result = []
    for wf in workflows:
        result.append({
            "id": wf.get("id"),
            "name": wf.get("name", "Unnamed"),
            "active": wf.get("active", False),
            "created_at": wf.get("createdAt"),
            "updated_at": wf.get("updatedAt"),
            "node_count": len(wf.get("nodes", [])),
            "tags": [t.get("name") for t in wf.get("tags", [])],
        })
    return {"workflows": result, "total": len(result)}


@router.get("/workflows/{workflow_id}")
async def get_workflow(workflow_id: str):
    """Get a single workflow by ID."""
    return await n8n_get(f"/workflows/{workflow_id}")


class ActivateRequest(BaseModel):
    active: bool


@router.patch("/workflows/{workflow_id}/activate")
async def toggle_workflow(workflow_id: str, req: ActivateRequest):
    """Activate or deactivate a workflow."""
    url, api_key = get_n8n_config()
    if not url:
        raise HTTPException(status_code=503, detail="N8N not configured")
    action = "activate" if req.active else "deactivate"
    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.patch(
            f"{url}/api/v1/workflows/{workflow_id}",
            headers=n8n_headers(api_key),
            json={"active": req.active},
        )
        if resp.status_code not in (200, 204):
            raise HTTPException(status_code=resp.status_code, detail=resp.text[:200])
    return {"status": "ok", "workflow_id": workflow_id, "active": req.active}


# ── Executions ────────────────────────────────────────────────────────────────
@router.get("/executions")
async def list_executions(workflow_id: Optional[str] = None, limit: int = 20, status: Optional[str] = None):
    """List recent executions."""
    path = f"/executions?limit={limit}&includeData=false"
    if workflow_id:
        path += f"&workflowId={workflow_id}"
    if status:
        path += f"&status={status}"
    data = await n8n_get(path)
    executions = data.get("data", [])
    result = []
    for ex in executions:
        result.append({
            "id": ex.get("id"),
            "workflow_id": ex.get("workflowId"),
            "workflow_name": ex.get("workflowData", {}).get("name", "Unknown"),
            "status": ex.get("status", "unknown"),
            "started_at": ex.get("startedAt"),
            "stopped_at": ex.get("stoppedAt"),
            "finished": ex.get("finished", False),
            "mode": ex.get("mode", "manual"),
        })
    return {"executions": result, "total": len(result)}


@router.post("/workflows/{workflow_id}/execute")
async def execute_workflow(workflow_id: str):
    """Manually trigger a workflow."""
    data = await n8n_post(f"/workflows/{workflow_id}/execute", {})
    return {"status": "triggered", "workflow_id": workflow_id, "data": data}


# ── Stats ─────────────────────────────────────────────────────────────────────
@router.get("/stats")
async def n8n_stats():
    """Aggregate stats: total workflows, active, recent runs."""
    try:
        wf_data = await n8n_get("/workflows?limit=250")
        workflows = wf_data.get("data", [])
        total = len(workflows)
        active_count = sum(1 for w in workflows if w.get("active", False))

        ex_data = await n8n_get("/executions?limit=20&includeData=false")
        executions = ex_data.get("data", [])
        success = sum(1 for e in executions if e.get("status") == "success")
        failed = sum(1 for e in executions if e.get("status") in ("error", "failed", "crashed"))

        return {
            "total_workflows": total,
            "active_workflows": active_count,
            "paused_workflows": total - active_count,
            "recent_executions": len(executions),
            "recent_success": success,
            "recent_failed": failed,
            "success_rate": round((success / len(executions) * 100) if executions else 0, 1),
            "timestamp": time.time(),
        }
    except HTTPException:
        raise
    except Exception as e:
        log.error("n8n_stats failed", error=str(e))
        return {
            "total_workflows": 0,
            "active_workflows": 0,
            "paused_workflows": 0,
            "recent_executions": 0,
            "recent_success": 0,
            "recent_failed": 0,
            "success_rate": 0,
            "timestamp": time.time(),
            "error": str(e),
        }


# ── Config ────────────────────────────────────────────────────────────────────
class N8NConfigRequest(BaseModel):
    url: str
    api_key: str


@router.post("/config")
async def set_n8n_config(req: N8NConfigRequest):
    """Save n8n URL and API key as environment variables (runtime only)."""
    os.environ["N8N_URL"] = req.url.rstrip("/")
    os.environ["N8N_API_KEY"] = req.api_key
    log.info("N8N config updated", url=req.url)
    return {"status": "ok", "url": req.url, "configured": True}


@router.get("/config")
async def get_n8n_config_status():
    """Return current n8n config (masked key)."""
    url, api_key = get_n8n_config()
    return {
        "url": url or None,
        "configured": bool(url),
        "api_key_set": bool(api_key),
        "api_key_preview": f"{api_key[:12]}..." if len(api_key) > 12 else ("***" if api_key else None),
    }
