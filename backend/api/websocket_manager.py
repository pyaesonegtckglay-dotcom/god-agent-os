"""
WebSocket Connection Manager — Production Grade
Handles rooms, heartbeats, event buffering, reconnect support
"""

import asyncio
import json
import time
import uuid
from collections import defaultdict
from typing import Dict, List, Optional, Set
import structlog

log = structlog.get_logger()


class WebSocketManager:
    def __init__(self):
        # room → set of websockets
        self._rooms: Dict[str, Set] = defaultdict(set)
        # ws → list of rooms
        self._ws_rooms: Dict[object, Set[str]] = defaultdict(set)
        # Event buffer per room (for replay on reconnect)
        self._event_buffer: Dict[str, List] = defaultdict(list)
        self._buffer_max = 100
        # Active connection count
        self._connection_count = 0

    async def connect(self, websocket, room: str):
        await websocket.accept()
        self._rooms[room].add(websocket)
        self._ws_rooms[websocket].add(room)
        self._connection_count += 1
        log.info("WS connected", room=room, total=self._connection_count)

        # Replay buffered events for this room
        buffered = self._event_buffer.get(room, [])[-20:]
        for event in buffered:
            try:
                await websocket.send_json(event)
            except Exception:
                pass

        await websocket.send_json({
            "type": "connected",
            "room": room,
            "timestamp": time.time(),
            "buffered_events": len(buffered),
        })

    def disconnect(self, websocket, room: Optional[str] = None):
        if room:
            self._rooms[room].discard(websocket)
            self._ws_rooms[websocket].discard(room)
        else:
            for r in list(self._ws_rooms.get(websocket, [])):
                self._rooms[r].discard(websocket)
            self._ws_rooms.pop(websocket, None)
        self._connection_count = max(0, self._connection_count - 1)
        log.info("WS disconnected", room=room, total=self._connection_count)

    async def broadcast(self, room: str, event: dict):
        """Broadcast event to all sockets in a room."""
        if "timestamp" not in event:
            event["timestamp"] = time.time()
        if "id" not in event:
            event["id"] = str(uuid.uuid4())[:8]

        # Buffer event
        self._event_buffer[room].append(event)
        if len(self._event_buffer[room]) > self._buffer_max:
            self._event_buffer[room].pop(0)

        dead = set()
        for ws in list(self._rooms.get(room, [])):
            try:
                await ws.send_json(event)
            except Exception:
                dead.add(ws)

        for ws in dead:
            self.disconnect(ws, room)

    async def broadcast_global(self, event: dict):
        """Broadcast to ALL connected websockets."""
        for room in list(self._rooms.keys()):
            await self.broadcast(room, event)

    async def emit(self, task_id: str, event_type: str, data: dict, session_id: str = ""):
        """Emit a structured event to a task room + logs room."""
        event = {
            "type": event_type,
            "task_id": task_id,
            "session_id": session_id,
            "timestamp": time.time(),
            "data": data,
        }
        await self.broadcast(f"task:{task_id}", event)
        await self.broadcast("logs", event)
        await self.broadcast("agent_status", {
            "type": "agent_event",
            "task_id": task_id,
            "event_type": event_type,
            "timestamp": time.time(),
        })

    async def emit_chat(self, session_id: str, event_type: str, data: dict):
        """Emit event to a chat session room."""
        event = {
            "type": event_type,
            "session_id": session_id,
            "timestamp": time.time(),
            "data": data,
        }
        await self.broadcast(f"chat:{session_id}", event)

    async def heartbeat_loop(self):
        """Send heartbeat to all connections every 15s."""
        while True:
            await asyncio.sleep(15)
            heartbeat = {
                "type": "heartbeat",
                "timestamp": time.time(),
                "connections": self._connection_count,
            }
            for room in list(self._rooms.keys()):
                await self.broadcast(room, heartbeat)

    def get_stats(self) -> dict:
        return {
            "total_connections": self._connection_count,
            "rooms": {r: len(ws) for r, ws in self._rooms.items()},
            "buffered_events": {r: len(e) for r, e in self._event_buffer.items()},
        }
