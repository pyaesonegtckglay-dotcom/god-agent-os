"""
💬 Communication Space — The Interaction Domain
Multi-channel messaging, email, notifications.
"""
from typing import Dict
import structlog
from .base_space import BaseSpace

log = structlog.get_logger()

COMM_SYSTEM = """You are GOD AGENT OS v9 — Communication Space Expert.

You specialize in:
- Professional email drafting and templates
- Slack/Discord message formatting
- Technical documentation writing
- README and API documentation
- Meeting notes and summaries
- Project proposals and reports
- Code comments and docstrings
- User guides and tutorials
- Marketing copy and announcements
- Multilingual communication (Burmese, English, etc.)

Writing principles:
- Clear, concise, and professional
- Appropriate tone for the audience
- Proper formatting (markdown, HTML)
- Action-oriented language
- Include call-to-action when relevant
"""


class CommunicationSpace(BaseSpace):
    space_name = "communication"
    space_description = "Interaction domain — chat, email, documentation, multi-channel messaging."
    available_roles = ["automation", "cognition"]
    
    def __init__(self, ws_manager=None, ai_router=None):
        super().__init__(ws_manager, ai_router)
        self.register_tool("draft_email", self._draft_email, "Draft professional emails")
        self.register_tool("write_docs", self._write_docs, "Write technical documentation")
        self.register_tool("create_report", self._create_report, "Create structured reports")
        self.register_tool("translate", self._translate, "Translate content between languages")
        self.register_tool("summarize_thread", self._summarize_thread, "Summarize communication threads")
    
    async def _draft_email(self, subject: str, context: str, tone: str = "professional", **kwargs) -> str:
        return f"Drafting email: {subject}"
    
    async def _write_docs(self, topic: str, format: str = "markdown", **kwargs) -> str:
        return f"Writing docs for: {topic}"
    
    async def _create_report(self, data: str, **kwargs) -> str:
        return f"Creating report from: {data[:50]}"
    
    async def _translate(self, text: str, target_lang: str = "english", **kwargs) -> str:
        return f"Translating to {target_lang}: {text[:50]}"
    
    async def _summarize_thread(self, thread: str, **kwargs) -> str:
        return f"Summarizing thread..."
    
    async def execute(self, task: str, role: str, session_id: str, context: Dict = None) -> str:
        context = context or {}
        
        await self.stream_update(session_id, f"💬 Communication Space activated — {role} role")
        
        # Detect communication type
        task_lower = task.lower()
        comm_type = "general"
        if "email" in task_lower:
            comm_type = "email"
        elif "document" in task_lower or "docs" in task_lower or "readme" in task_lower:
            comm_type = "documentation"
        elif "report" in task_lower:
            comm_type = "report"
        elif "translate" in task_lower or "ဘာသာ" in task:
            comm_type = "translation"
        elif "summary" in task_lower or "summarize" in task_lower:
            comm_type = "summary"
        elif "slack" in task_lower or "discord" in task_lower:
            comm_type = "instant_message"
        
        mem_context = ""
        if context.get("short_term_memory"):
            recent = context["short_term_memory"][-3:]
            mem_context = "\n".join([f"- {m.get('content','')[:80]}" for m in recent])
        
        enhanced_system = f"""{COMM_SYSTEM}

Active Role: {role.upper()}
Communication Type: {comm_type}
Recent Context: {mem_context or 'None'}

For Burmese language requests, respond in Burmese.
Format output appropriately for the communication type."""
        
        try:
            response = await self.ai_router.complete(
                prompt=task,
                system=enhanced_system,
                max_tokens=3000,
            )
            return response.get("content", "Communication Space could not process the request.")
        except Exception as e:
            log.error(f"CommunicationSpace error: {e}")
            return f"Communication Space error: {str(e)}"
