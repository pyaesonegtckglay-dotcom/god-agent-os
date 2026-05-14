"""
Base Agent — Abstract base for all God Mode agents
"""
from abc import ABC, abstractmethod
from typing import Any, Dict, List, Optional
import structlog

log = structlog.get_logger()


class BaseAgent(ABC):
    """Abstract base class for all agents in the God Mode ecosystem."""

    def __init__(self, name: str, ws_manager=None, ai_router=None):
        self.name = name
        self.ws = ws_manager
        self.ai_router = ai_router
        self.log = structlog.get_logger().bind(agent=name)

    @abstractmethod
    async def run(self, task: str, context: Dict = {}, **kwargs) -> str:
        """Execute the agent's primary task."""
        pass

    async def emit(self, room: str, event: str, data: Dict, session_id: str = ""):
        """Emit WebSocket event if manager available."""
        if self.ws:
            await self.ws.emit(room, event, data, session_id=session_id)

    async def emit_chat(self, session_id: str, event: str, data: Dict):
        """Emit chat WebSocket event."""
        if self.ws:
            await self.ws.emit_chat(session_id, event, data)

    async def llm(
        self,
        messages: List[Dict],
        task_id: str = "",
        session_id: str = "",
        temperature: float = 0.7,
        max_tokens: int = 4096,
        model: str = "",
    ) -> str:
        """Route LLM call through AI router."""
        if self.ai_router:
            return await self.ai_router.complete(
                messages=messages,
                task_id=task_id,
                session_id=session_id,
                temperature=temperature,
                max_tokens=max_tokens,
                preferred_model=model,
            )
        return f"[{self.name}] AI router not configured."
