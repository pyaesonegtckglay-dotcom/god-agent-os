"""
ConnectorAgent — GitHub, HuggingFace, Vercel, n8n, Telegram, Discord integrations
"""
import json
import os
from typing import Dict, List, Optional
import httpx
import structlog
from .base_agent import BaseAgent

log = structlog.get_logger()


class ConnectorAgent(BaseAgent):
    def __init__(self, ws_manager=None, ai_router=None):
        super().__init__("ConnectorAgent", ws_manager, ai_router)

    async def run(self, task: str, context: Dict = {}, **kwargs) -> str:
        session_id = kwargs.get("session_id", "")
        task_id = kwargs.get("task_id", "")

        task_lower = task.lower()

        if "github" in task_lower:
            return await self.github_operation(task, task_id=task_id, session_id=session_id)
        elif "huggingface" in task_lower or "hf" in task_lower:
            return await self.hf_operation(task, task_id=task_id, session_id=session_id)
        elif "vercel" in task_lower:
            return await self.vercel_operation(task, task_id=task_id, session_id=session_id)
        else:
            return await self._generic_connector(task, task_id=task_id, session_id=session_id)

    # ─── GitHub ───────────────────────────────────────────────────────────────

    async def github_operation(self, task: str, task_id: str = "", session_id: str = "") -> str:
        token = os.environ.get("GITHUB_TOKEN", "")
        if not token:
            return "⚠️ GITHUB_TOKEN not set. Please add it to environment variables."

        headers = {
            "Authorization": f"token {token}",
            "Accept": "application/vnd.github.v3+json",
        }

        task_lower = task.lower()

        try:
            async with httpx.AsyncClient(timeout=30) as client:
                if "create repo" in task_lower or "new repo" in task_lower:
                    return await self._github_create_repo(client, headers, task, task_id, session_id)
                elif "list repo" in task_lower:
                    return await self._github_list_repos(client, headers, task_id, session_id)
                elif "commit" in task_lower:
                    return f"✅ GitHub commit operation noted. Use SandboxAgent for actual commits."
                elif "issue" in task_lower:
                    return await self._github_create_issue(client, headers, task, task_id, session_id)
                else:
                    return await self._github_user_info(client, headers, task_id, session_id)
        except Exception as e:
            return f"❌ GitHub error: {str(e)}"

    async def _github_user_info(self, client, headers, task_id, session_id) -> str:
        resp = await client.get("https://api.github.com/user", headers=headers)
        if resp.status_code == 200:
            data = resp.json()
            await self.emit(task_id, "connector_result", {
                "connector": "github",
                "action": "user_info",
                "user": data.get("login"),
            }, session_id)
            return f"✅ GitHub connected as **{data.get('login')}** ({data.get('public_repos')} repos)"
        return f"❌ GitHub auth failed: {resp.status_code}"

    async def _github_create_repo(self, client, headers, task, task_id, session_id) -> str:
        # Extract repo name from task using simple heuristic
        words = task.split()
        name_candidates = [w for w in words if w.replace("-", "").replace("_", "").isalnum() and len(w) > 3]
        repo_name = name_candidates[-1] if name_candidates else "god-agent-project"

        payload = {
            "name": repo_name,
            "description": "Created by God Agent Platform",
            "private": False,
            "auto_init": True,
        }
        resp = await client.post("https://api.github.com/user/repos", headers=headers, json=payload)
        if resp.status_code == 201:
            data = resp.json()
            await self.emit(task_id, "connector_result", {
                "connector": "github",
                "action": "repo_created",
                "repo": data.get("full_name"),
                "url": data.get("html_url"),
            }, session_id)
            return f"✅ GitHub repo created: [{data.get('full_name')}]({data.get('html_url')})"
        return f"❌ Failed to create repo: {resp.status_code} — {resp.text[:200]}"

    async def _github_list_repos(self, client, headers, task_id, session_id) -> str:
        resp = await client.get("https://api.github.com/user/repos?per_page=10&sort=updated", headers=headers)
        if resp.status_code == 200:
            repos = resp.json()
            lines = [f"- [{r['full_name']}]({r['html_url']}) ⭐{r['stargazers_count']}" for r in repos[:10]]
            return "📦 **Your GitHub Repos:**\n\n" + "\n".join(lines)
        return f"❌ Failed to list repos: {resp.status_code}"

    async def _github_create_issue(self, client, headers, task, task_id, session_id) -> str:
        return "✅ GitHub issue creation requires repo context. Specify: 'create issue in owner/repo: title'"

    # ─── HuggingFace ──────────────────────────────────────────────────────────

    async def hf_operation(self, task: str, task_id: str = "", session_id: str = "") -> str:
        token = os.environ.get("HF_TOKEN", "")
        if not token:
            return "⚠️ HF_TOKEN not set. Add HuggingFace token to environment."

        headers = {"Authorization": f"Bearer {token}"}
        try:
            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.get("https://huggingface.co/api/whoami", headers=headers)
                if resp.status_code == 200:
                    data = resp.json()
                    await self.emit(task_id, "connector_result", {
                        "connector": "huggingface",
                        "user": data.get("name"),
                    }, session_id)
                    return f"✅ HuggingFace connected as **{data.get('name')}**"
                return f"❌ HF auth failed: {resp.status_code}"
        except Exception as e:
            return f"❌ HuggingFace error: {str(e)}"

    # ─── Vercel ───────────────────────────────────────────────────────────────

    async def vercel_operation(self, task: str, task_id: str = "", session_id: str = "") -> str:
        token = os.environ.get("VERCEL_TOKEN", "")
        if not token:
            return "⚠️ VERCEL_TOKEN not set. Add Vercel token to environment."

        headers = {"Authorization": f"Bearer {token}"}
        try:
            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.get("https://api.vercel.com/v2/user", headers=headers)
                if resp.status_code == 200:
                    data = resp.json()
                    user = data.get("user", {})
                    await self.emit(task_id, "connector_result", {
                        "connector": "vercel",
                        "user": user.get("username"),
                    }, session_id)
                    return f"✅ Vercel connected as **{user.get('username')}** ({user.get('email')})"
                return f"❌ Vercel auth failed: {resp.status_code}"
        except Exception as e:
            return f"❌ Vercel error: {str(e)}"

    async def _generic_connector(self, task: str, task_id: str = "", session_id: str = "") -> str:
        return (
            "🔌 **Available Connectors:**\n\n"
            "| Connector | Status | Env Var |\n"
            "|-----------|--------|---------||\n"
            f"| GitHub | {'✅' if os.environ.get('GITHUB_TOKEN') else '❌'} | GITHUB_TOKEN |\n"
            f"| HuggingFace | {'✅' if os.environ.get('HF_TOKEN') else '❌'} | HF_TOKEN |\n"
            f"| Vercel | {'✅' if os.environ.get('VERCEL_TOKEN') else '❌'} | VERCEL_TOKEN |\n"
            f"| OpenAI | {'✅' if os.environ.get('OPENAI_API_KEY') else '❌'} | OPENAI_API_KEY |\n"
            f"| Groq | {'✅' if os.environ.get('GROQ_API_KEY') else '❌'} | GROQ_API_KEY |\n"
            f"| OpenRouter | {'✅' if os.environ.get('OPENROUTER_API_KEY') else '❌'} | OPENROUTER_API_KEY |\n"
        )

    def get_connector_status(self) -> Dict:
        """Return status of all connectors."""
        connectors = {
            "github": bool(os.environ.get("GITHUB_TOKEN")),
            "huggingface": bool(os.environ.get("HF_TOKEN")),
            "vercel": bool(os.environ.get("VERCEL_TOKEN")),
            "openai": bool(os.environ.get("OPENAI_API_KEY")),
            "groq": bool(os.environ.get("GROQ_API_KEY")),
            "cerebras": bool(os.environ.get("CEREBRAS_API_KEY")),
            "openrouter": bool(os.environ.get("OPENROUTER_API_KEY")),
            "anthropic": bool(os.environ.get("ANTHROPIC_API_KEY")),
            "n8n": bool(os.environ.get("N8N_URL")),
            "telegram": bool(os.environ.get("TELEGRAM_BOT_TOKEN")),
            "discord": bool(os.environ.get("DISCORD_BOT_TOKEN")),
        }
        return {
            "connectors": connectors,
            "connected_count": sum(connectors.values()),
            "total": len(connectors),
        }
