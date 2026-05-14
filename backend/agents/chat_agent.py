"""
ChatAgent — Conversational interface with streaming, Burmese support
"""
from typing import Dict
import structlog
from .base_agent import BaseAgent

log = structlog.get_logger()

CHAT_SYSTEM = """You are God Agent — an elite autonomous AI operating system.
You support both English and Burmese (မြန်မာဘာသာ) languages.
Be helpful, precise, and autonomous. 
When users write in Burmese, respond in Burmese.
When discussing code, provide production-quality examples.
"""


class ChatAgent(BaseAgent):
    def __init__(self, ws_manager=None, ai_router=None):
        super().__init__("ChatAgent", ws_manager, ai_router)

    async def run(self, task: str, context: Dict = {}, **kwargs) -> str:
        session_id = kwargs.get("session_id", "")
        task_id = kwargs.get("task_id", "")

        history = context.get("history", [])
        messages = [{"role": "system", "content": CHAT_SYSTEM}]

        for h in history[-10:]:
            messages.append({"role": h.get("role", "user"), "content": h.get("content", "")})

        messages.append({"role": "user", "content": task})

        await self.emit_chat(session_id, "stream_start", {"agent": "ChatAgent", "status": "generating"})

        response = await self.llm(messages, task_id=task_id, session_id=session_id)

        await self.emit_chat(session_id, "stream_end", {
            "agent": "ChatAgent",
            "full_response": response,
            "status": "complete",
        })

        return response
