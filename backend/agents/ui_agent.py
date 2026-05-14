"""
UIAgent — UI component generation (React/Next.js/Tailwind)
"""
from typing import Dict
import structlog
from .base_agent import BaseAgent

log = structlog.get_logger()

UI_SYSTEM = """You are an expert React/Next.js/Tailwind CSS UI engineer.
You generate beautiful, responsive, production-ready UI components.
Always use:
- TypeScript with proper types
- Tailwind CSS for styling
- shadcn/ui components when appropriate
- Framer Motion for animations
- Lucide React for icons
- Dark mode support
- Mobile-first responsive design
- Accessibility (aria labels, semantic HTML)
"""


class UIAgent(BaseAgent):
    def __init__(self, ws_manager=None, ai_router=None):
        super().__init__("UIAgent", ws_manager, ai_router)

    async def run(self, task: str, context: Dict = {}, **kwargs) -> str:
        session_id = kwargs.get("session_id", "")
        task_id = kwargs.get("task_id", "")

        await self.emit(task_id, "agent_start", {"agent": "UIAgent", "task": task[:80]}, session_id)

        messages = [
            {"role": "system", "content": UI_SYSTEM},
            {"role": "user", "content": (
                f"Generate a complete, production-ready UI component for: {task}\n\n"
                f"Requirements:\n"
                f"- TypeScript\n- Tailwind CSS\n- Dark mode\n- Mobile responsive\n"
                f"- Include all imports\n- Export as default"
            )},
        ]
        result = await self.llm(messages, task_id=task_id, session_id=session_id, temperature=0.3, max_tokens=6000)
        await self.emit(task_id, "ui_generated", {"agent": "UIAgent"}, session_id)
        return result
