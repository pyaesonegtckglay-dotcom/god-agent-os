"""
MemoryAgent — Persistent long-term memory system (Phase 5)
SQLite-backed with semantic search simulation
"""
import json
import time
from typing import Dict, List, Optional
import structlog
from .base_agent import BaseAgent
from memory.db import save_memory, search_memory, get_history, get_project_memory

log = structlog.get_logger()


class MemoryAgent(BaseAgent):
    def __init__(self, ws_manager=None, ai_router=None):
        super().__init__("MemoryAgent", ws_manager, ai_router)

    async def run(self, task: str, context: Dict = {}, **kwargs) -> str:
        session_id = kwargs.get("session_id", "")
        task_id = kwargs.get("task_id", "")

        # Determine if retrieve or save
        task_lower = task.lower()
        if any(k in task_lower for k in ["remember", "save", "store", "record"]):
            content = context.get("content", task)
            await self.save(content, session_id=session_id, memory_type="user_directive")
            return f"✅ Saved to memory: {content[:100]}"
        else:
            results = await self.retrieve(task, session_id=session_id)
            if results:
                return "📚 **Memory Retrieved:**\n\n" + "\n".join(f"- {r['content'][:200]}" for r in results[:5])
            return "No relevant memories found."

    async def save(
        self,
        content: str,
        session_id: str = "",
        project_id: str = "",
        memory_type: str = "general",
        key: str = "",
        metadata: Dict = {},
    ):
        """Save content to persistent memory."""
        await save_memory(
            content=content,
            memory_type=memory_type,
            session_id=session_id,
            project_id=project_id,
            key=key,
            metadata=metadata,
        )

    async def retrieve(
        self,
        query: str,
        session_id: str = "",
        project_id: str = "",
        limit: int = 10,
    ) -> List[Dict]:
        """Retrieve relevant memories."""
        return await search_memory(query[:100], session_id=session_id, project_id=project_id, limit=limit)

    async def get_conversation_history(self, session_id: str, limit: int = 20) -> List[Dict]:
        """Get conversation history for a session."""
        return await get_history(session_id, limit=limit)

    async def save_interaction(
        self,
        user_message: str,
        assistant_response: str,
        session_id: str = "",
        intent: Dict = {},
    ):
        """Save a full interaction to memory."""
        await save_memory(
            content=user_message,
            memory_type="conversation",
            session_id=session_id,
            key="user_message",
            metadata={"intent": intent.get("intent", ""), "timestamp": time.time()},
        )
        await save_memory(
            content=assistant_response,
            memory_type="conversation",
            session_id=session_id,
            key="assistant_response",
            metadata={"agent": intent.get("primary_agent", "chat"), "timestamp": time.time()},
        )

    async def save_coding_style(self, style_notes: str, session_id: str = ""):
        """Remember user's coding preferences."""
        await save_memory(
            content=style_notes,
            memory_type="user_preference",
            session_id=session_id,
            key="coding_style",
            metadata={"category": "coding_style"},
        )

    async def save_project_context(self, project_id: str, context: Dict):
        """Save project-specific context."""
        await save_memory(
            content=json.dumps(context),
            memory_type="project_context",
            project_id=project_id,
            key="project_context",
            metadata={"timestamp": time.time()},
        )

    async def get_project_context(self, project_id: str) -> Optional[Dict]:
        """Get project context."""
        results = await get_project_memory(project_id, memory_type="project_context", limit=1)
        if results:
            try:
                return json.loads(results[0]["content"])
            except Exception:
                return {"raw": results[0]["content"]}
        return None

    async def build_context_for_agent(self, session_id: str, query: str) -> Dict:
        """Build rich context dict for agents from memory."""
        history = await self.get_conversation_history(session_id, limit=10)
        relevant = await self.retrieve(query, session_id=session_id, limit=5)

        return {
            "history": [{"role": "user" if i % 2 == 0 else "assistant", "content": h["content"]} for i, h in enumerate(reversed(history))],
            "relevant_memories": [r["content"][:200] for r in relevant],
            "session_id": session_id,
        }
