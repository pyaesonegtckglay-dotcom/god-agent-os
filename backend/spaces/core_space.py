"""
🧠 Core Space — The Central Nervous System
Manages memory, planning, and overall orchestration.
"""
import json
from typing import Dict
import structlog
from .base_space import BaseSpace

log = structlog.get_logger()


class CoreSpace(BaseSpace):
    space_name = "core"
    space_description = "Central nervous system — planning, memory, and orchestration."
    available_roles = ["cognition", "automation"]
    
    def __init__(self, ws_manager=None, ai_router=None):
        super().__init__(ws_manager, ai_router)
        self.register_tool("plan", self._plan_task, "Break complex goals into executable steps")
        self.register_tool("summarize", self._summarize, "Summarize information concisely")
        self.register_tool("analyze", self._analyze, "Deep analysis of content or problems")
    
    async def _plan_task(self, task: str, **kwargs) -> str:
        return f"Planning task: {task}"
    
    async def _summarize(self, content: str, **kwargs) -> str:
        return f"Summary of: {content[:50]}..."
    
    async def _analyze(self, content: str, **kwargs) -> str:
        return f"Analysis of: {content[:50]}..."
    
    async def execute(self, task: str, role: str, session_id: str, context: Dict = None) -> str:
        context = context or {}
        
        system_prompt = self.get_space_prompt(role, task, context)
        
        try:
            response = await self.ai_router.complete(
                prompt=task,
                system=system_prompt,
                max_tokens=2048,
                stream_callback=None,
            )
            return response.get("content", "I couldn't process that request.")
        except Exception as e:
            log.error(f"CoreSpace error: {e}")
            return f"Core Space error: {str(e)}"
