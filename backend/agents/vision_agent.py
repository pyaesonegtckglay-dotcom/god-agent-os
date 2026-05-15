"""
VisionAgent v7 — UI/UX generation, design-to-code, screenshot analysis
Converts designs, wireframes, and visual specs into real code
"""
import json
import os
from typing import Dict
import structlog
from .base_agent import BaseAgent

log = structlog.get_logger()

VISION_SYSTEM = """You are an elite UI/UX engineer and design-to-code specialist.
You can:
- Convert design mockups and wireframes into pixel-perfect React/Next.js components
- Generate beautiful, responsive UI components with Tailwind CSS
- Create complete page layouts with animations (Framer Motion)
- Analyze screenshots and reproduce UI components
- Generate design systems, color palettes, and typography scales
- Build dashboards, landing pages, admin panels, mobile-first UIs

Always produce production-ready code with:
- Responsive design (mobile-first)
- Accessibility (ARIA labels, semantic HTML)
- Dark/light mode support
- Smooth animations and transitions
- TypeScript types
"""


class VisionAgent(BaseAgent):
    def __init__(self, ws_manager=None, ai_router=None):
        super().__init__("VisionAgent", ws_manager, ai_router)
        self.workspace = os.environ.get("WORKSPACE_DIR", "/tmp/god_workspace")

    async def run(self, task: str, context: Dict = {}, **kwargs) -> str:
        session_id = kwargs.get("session_id", "")
        task_id = kwargs.get("task_id", "")
        await self.emit(task_id, "agent_start", {"agent": "VisionAgent", "task": task[:80]}, session_id)

        t = task.lower()
        if any(k in t for k in ["dashboard", "admin", "panel"]):
            return await self._generate_dashboard(task, context, task_id, session_id)
        if any(k in t for k in ["landing", "homepage", "hero"]):
            return await self._generate_landing_page(task, context, task_id, session_id)
        if any(k in t for k in ["component", "button", "card", "form", "modal", "nav"]):
            return await self._generate_component(task, context, task_id, session_id)
        return await self._generate_ui(task, context, task_id, session_id)

    async def _generate_dashboard(self, task: str, context: Dict, task_id: str, session_id: str) -> str:
        await self.emit(task_id, "tool_called", {
            "agent": "VisionAgent", "tool": "generate_dashboard", "step": "Generating dashboard UI"
        }, session_id)
        msgs = [
            {"role": "system", "content": VISION_SYSTEM},
            {"role": "user", "content": (
                f"Build a complete dashboard UI: {task}\n\n"
                "Requirements:\n"
                "- Dark theme with glass morphism effects\n"
                "- Sidebar navigation with icons\n"
                "- Header with user menu\n"
                "- Stats cards with trends\n"
                "- Data tables with sorting\n"
                "- Charts/graphs area\n"
                "- React + TypeScript + Tailwind CSS\n"
                "Generate the complete component code."
            )},
        ]
        return await self.llm(msgs, task_id=task_id, session_id=session_id, temperature=0.4, max_tokens=8192)

    async def _generate_landing_page(self, task: str, context: Dict, task_id: str, session_id: str) -> str:
        await self.emit(task_id, "tool_called", {
            "agent": "VisionAgent", "tool": "generate_landing", "step": "Generating landing page"
        }, session_id)
        msgs = [
            {"role": "system", "content": VISION_SYSTEM},
            {"role": "user", "content": (
                f"Create a stunning landing page: {task}\n\n"
                "Include: Hero section, Features grid, Pricing table, Testimonials, CTA, Footer\n"
                "Style: Modern, gradient backgrounds, glassmorphism, smooth animations\n"
                "Tech: Next.js + TypeScript + Tailwind + Framer Motion"
            )},
        ]
        return await self.llm(msgs, task_id=task_id, session_id=session_id, temperature=0.5, max_tokens=8192)

    async def _generate_component(self, task: str, context: Dict, task_id: str, session_id: str) -> str:
        await self.emit(task_id, "tool_called", {
            "agent": "VisionAgent", "tool": "generate_component", "step": "Generating UI component"
        }, session_id)
        msgs = [
            {"role": "system", "content": VISION_SYSTEM},
            {"role": "user", "content": (
                f"Create a polished UI component: {task}\n\n"
                "Requirements:\n"
                "- Fully typed with TypeScript\n"
                "- Responsive and accessible\n"
                "- Dark/light mode support\n"
                "- Smooth hover/focus animations\n"
                "- Props with sensible defaults"
            )},
        ]
        return await self.llm(msgs, task_id=task_id, session_id=session_id, temperature=0.4, max_tokens=8192)

    async def _generate_ui(self, task: str, context: Dict, task_id: str, session_id: str) -> str:
        msgs = [
            {"role": "system", "content": VISION_SYSTEM},
            {"role": "user", "content": f"Generate UI for: {task}\n\nContext: {json.dumps(context)[:300]}"},
        ]
        return await self.llm(msgs, task_id=task_id, session_id=session_id, temperature=0.5, max_tokens=8192)
