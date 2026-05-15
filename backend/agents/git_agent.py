"""
GitAgent v7 — Autonomous Git operations, PR creation, code review
Full GitHub integration like Manus/Genspark autonomous coding
"""
import asyncio
import json
import os
import re
from typing import Dict, List
import structlog
from .base_agent import BaseAgent

log = structlog.get_logger()

GIT_SYSTEM = """You are an elite autonomous Git and GitHub operations agent.
You can clone, commit, push, pull, create branches, PRs, review code,
generate commit messages, manage workflows, and handle merge conflicts.
Always write clear, conventional commit messages (feat/fix/chore/docs/refactor).
"""


class GitAgent(BaseAgent):
    def __init__(self, ws_manager=None, ai_router=None):
        super().__init__("GitAgent", ws_manager, ai_router)
        self.workspace = os.environ.get("WORKSPACE_DIR", "/tmp/god_workspace")

    async def run(self, task: str, context: Dict = {}, **kwargs) -> str:
        session_id = kwargs.get("session_id", "")
        task_id = kwargs.get("task_id", "")
        await self.emit(task_id, "agent_start", {"agent": "GitAgent", "task": task[:80]}, session_id)

        t = task.lower()
        if any(k in t for k in ["clone", "checkout"]):
            return await self._clone_repo(task, context, task_id, session_id)
        if any(k in t for k in ["commit", "push", "pull request", " pr "]):
            return await self._commit_and_push(task, context, task_id, session_id)
        if any(k in t for k in ["review", "analyze code", "audit"]):
            return await self._code_review(task, context, task_id, session_id)
        return await self._git_ai_task(task, context, task_id, session_id)

    async def _clone_repo(self, task: str, context: Dict, task_id: str, session_id: str) -> str:
        urls = re.findall(r'https?://github\.com/[^\s]+', task)
        if not urls:
            return "❌ No GitHub URL found in task."
        url = urls[0]
        repo_name = url.rstrip("/").split("/")[-1].replace(".git", "")
        dest = os.path.join(self.workspace, repo_name)
        await self.emit(task_id, "tool_called", {"agent": "GitAgent", "tool": "git_clone", "step": f"Cloning {repo_name}"}, session_id)
        token = os.environ.get("GITHUB_TOKEN", "")
        auth_url = url.replace("https://", f"https://{token}@") if token else url
        r = await self._run_cmd(["git", "clone", auth_url, dest])
        if r["returncode"] == 0:
            await self.emit(task_id, "git_cloned", {"repo": repo_name, "path": dest}, session_id)
            return f"✅ **Cloned** `{repo_name}` → `{dest}`\n```\n{r['stdout'][:500]}\n```"
        return f"❌ Clone failed:\n```\n{r['stderr'][:500]}\n```"

    async def _commit_and_push(self, task: str, context: Dict, task_id: str, session_id: str) -> str:
        repo_path = context.get("repo_path", self.workspace)
        await self.emit(task_id, "tool_called", {"agent": "GitAgent", "tool": "git_commit", "step": "Committing"}, session_id)
        msgs = [
            {"role": "system", "content": "Generate a conventional commit message. Return ONLY the one-line message."},
            {"role": "user", "content": f"Task: {task}\nContext: {json.dumps(context)[:200]}"},
        ]
        commit_msg = (await self.llm(msgs, task_id=task_id, session_id=session_id, temperature=0.3, max_tokens=80)).strip().split("\n")[0][:100]
        results = []
        for cmd in [["git", "add", "-A"], ["git", "commit", "-m", commit_msg]]:
            r = await self._run_cmd(cmd, cwd=repo_path)
            results.append(f"$ {' '.join(cmd)}\n{r['stdout']}{r['stderr']}")
        branch = context.get("branch", "main")
        r = await self._run_cmd(["git", "push", "origin", branch], cwd=repo_path)
        results.append(f"$ git push\n{r['stdout']}{r['stderr']}")
        return f"✅ **Committed:** `{commit_msg}`\n\n```\n" + "\n".join(results) + "\n```"

    async def _code_review(self, task: str, context: Dict, task_id: str, session_id: str) -> str:
        repo_path = context.get("repo_path", self.workspace)
        diff = await self._run_cmd(["git", "diff", "HEAD~1"], cwd=repo_path)
        msgs = [
            {"role": "system", "content": GIT_SYSTEM},
            {"role": "user", "content": f"Task: {task}\n\nDiff:\n{diff['stdout'][:2500]}\n\nProvide code review: summary, issues, suggestions, score (1-10)."},
        ]
        return await self.llm(msgs, task_id=task_id, session_id=session_id, temperature=0.3, max_tokens=4096)

    async def _git_ai_task(self, task: str, context: Dict, task_id: str, session_id: str) -> str:
        msgs = [
            {"role": "system", "content": GIT_SYSTEM},
            {"role": "user", "content": f"Task: {task}\nWorkspace: {self.workspace}\nContext: {json.dumps(context)[:300]}"},
        ]
        return await self.llm(msgs, task_id=task_id, session_id=session_id, temperature=0.3, max_tokens=4096)

    async def create_github_pr(self, repo_owner: str, repo_name: str, title: str, body: str,
                                head_branch: str, base_branch: str = "main",
                                task_id: str = "", session_id: str = "") -> Dict:
        import httpx
        token = os.environ.get("GITHUB_TOKEN", "")
        if not token:
            return {"error": "GITHUB_TOKEN not set"}
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
                f"https://api.github.com/repos/{repo_owner}/{repo_name}/pulls",
                headers={"Authorization": f"token {token}", "Accept": "application/vnd.github.v3+json"},
                json={"title": title, "body": body, "head": head_branch, "base": base_branch},
            )
            data = resp.json()
            if resp.status_code == 201:
                await self.emit(task_id, "pr_created", {"url": data.get("html_url")}, session_id)
                return {"success": True, "url": data.get("html_url")}
            return {"error": data.get("message", "Failed"), "status": resp.status_code}

    async def _run_cmd(self, cmd: List[str], cwd: str = None, timeout: int = 60) -> Dict:
        try:
            proc = await asyncio.create_subprocess_exec(
                *cmd, cwd=cwd or self.workspace,
                stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE,
            )
            stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=timeout)
            return {"returncode": proc.returncode,
                    "stdout": stdout.decode("utf-8", errors="replace"),
                    "stderr": stderr.decode("utf-8", errors="replace")}
        except Exception as e:
            return {"returncode": -1, "stdout": "", "stderr": str(e)}
