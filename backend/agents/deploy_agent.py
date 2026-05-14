"""
DeployAgent — Automated deployments to Vercel, HF Spaces, GitHub Pages
"""
import json
import os
from typing import Dict
import httpx
import structlog
from .base_agent import BaseAgent

log = structlog.get_logger()

DEPLOY_SYSTEM = """You are a deployment engineer expert in:
- Vercel deployments (Next.js, React, API routes)
- HuggingFace Spaces (Docker, Gradio, Streamlit)
- GitHub Pages (static sites)
- Docker containerization
- Environment variable management

Generate precise deployment configs and commands.
"""


class DeployAgent(BaseAgent):
    def __init__(self, ws_manager=None, ai_router=None):
        super().__init__("DeployAgent", ws_manager, ai_router)

    async def run(self, task: str, context: Dict = {}, **kwargs) -> str:
        session_id = kwargs.get("session_id", "")
        task_id = kwargs.get("task_id", "")

        await self.emit(task_id, "agent_start", {"agent": "DeployAgent", "task": task[:80]}, session_id)

        task_lower = task.lower()
        if "vercel" in task_lower:
            return await self._deploy_vercel_guide(task, task_id, session_id)
        elif "huggingface" in task_lower or "hf" in task_lower or "space" in task_lower:
            return await self._deploy_hf_guide(task, task_id, session_id)
        elif "docker" in task_lower:
            return await self._generate_dockerfile(task, task_id, session_id)
        else:
            return await self._deploy_general(task, task_id, session_id)

    async def _deploy_vercel_guide(self, task: str, task_id: str, session_id: str) -> str:
        messages = [
            {"role": "system", "content": DEPLOY_SYSTEM},
            {"role": "user", "content": (
                f"Generate complete Vercel deployment guide for: {task}\n\n"
                f"Include:\n1. vercel.json config\n2. Environment variables needed\n"
                f"3. Build commands\n4. Step-by-step deployment instructions"
            )},
        ]
        result = await self.llm(messages, task_id=task_id, session_id=session_id, temperature=0.2)
        await self.emit(task_id, "deploy_plan_ready", {"platform": "vercel"}, session_id)
        return result

    async def _deploy_hf_guide(self, task: str, task_id: str, session_id: str) -> str:
        messages = [
            {"role": "system", "content": DEPLOY_SYSTEM},
            {"role": "user", "content": (
                f"Generate HuggingFace Space deployment for: {task}\n\n"
                f"Include:\n1. Dockerfile\n2. README.md with YAML header\n"
                f"3. Requirements/dependencies\n4. Space configuration"
            )},
        ]
        result = await self.llm(messages, task_id=task_id, session_id=session_id, temperature=0.2)
        await self.emit(task_id, "deploy_plan_ready", {"platform": "huggingface"}, session_id)
        return result

    async def _generate_dockerfile(self, task: str, task_id: str, session_id: str) -> str:
        messages = [
            {"role": "system", "content": DEPLOY_SYSTEM},
            {"role": "user", "content": f"Generate production Dockerfile for: {task}\nInclude multi-stage build, security best practices, health check."},
        ]
        return await self.llm(messages, task_id=task_id, session_id=session_id, temperature=0.1)

    async def _deploy_general(self, task: str, task_id: str, session_id: str) -> str:
        messages = [
            {"role": "system", "content": DEPLOY_SYSTEM},
            {"role": "user", "content": f"Create deployment plan for: {task}\n\nInclude platform recommendation, config files, and step-by-step guide."},
        ]
        return await self.llm(messages, task_id=task_id, session_id=session_id)

    async def check_vercel_deployments(self) -> str:
        """Check recent Vercel deployments."""
        token = os.environ.get("VERCEL_TOKEN", "")
        if not token:
            return "⚠️ VERCEL_TOKEN not set."
        try:
            async with httpx.AsyncClient(timeout=15) as client:
                resp = await client.get(
                    "https://api.vercel.com/v6/deployments?limit=5",
                    headers={"Authorization": f"Bearer {token}"}
                )
                if resp.status_code == 200:
                    deps = resp.json().get("deployments", [])
                    lines = [f"- {d.get('name')} → {d.get('state')} ({d.get('url', '')})" for d in deps[:5]]
                    return "🚀 **Recent Vercel Deployments:**\n\n" + "\n".join(lines)
        except Exception as e:
            return f"❌ Vercel error: {e}"
        return "No deployments found."
