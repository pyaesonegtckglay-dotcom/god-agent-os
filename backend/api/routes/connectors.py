"""
Connectors API — Manus-style connector management
"""
from fastapi import APIRouter, Request, HTTPException
from pydantic import BaseModel
from typing import Optional
from connectors.manager import ConnectorManager

router = APIRouter()
connector_manager = ConnectorManager()


class SetTokenRequest(BaseModel):
    connector_id: str
    token: str


@router.get("/")
async def get_all_connectors():
    return {"connectors": connector_manager.get_all()}


@router.get("/connected")
async def get_connected():
    return {"connectors": connector_manager.get_connected()}


@router.get("/summary")
async def get_summary():
    return connector_manager.get_summary()


@router.get("/category/{category}")
async def get_by_category(category: str):
    return {"connectors": connector_manager.get_by_category(category)}


@router.post("/set-token")
async def set_token(req: SetTokenRequest):
    connector_manager.set_token(req.connector_id, req.token)
    return {"status": "ok", "connector": req.connector_id, "connected": True}


@router.get("/{connector_id}/status")
async def get_status(connector_id: str):
    return {
        "connector_id": connector_id,
        "connected": connector_manager.is_connected(connector_id),
    }
