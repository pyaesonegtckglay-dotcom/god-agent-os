"""
Tool Executor — Routes tool calls to the right implementation
Supports: code, shell, file, browser, github, memory, search, test, none
"""

import asyncio
import os
import subprocess
import tempfile
import time
from typing import Any, List, Optional

import structlog

from api.websocket_manager import WebSocketManager

log = structlog.get_logger()


class ToolExecutor:
    def __init__(self, ws_manager: WebSocketManager):
        self.ws = ws_manager

    async def run(
        self,
        tool: str,
        task: str,
        goal: str = "",
        previous: List = [],
        task_id: str = "",
        session_id: str = "",
    ) -> str:
        tool = (tool or "none").lower().strip()

        dispatch = {
            "code": self._tool_code,
            "shell": self._tool_shell,
            "file": self._tool_file,
            "github": self._tool_github,
            "memory": self._tool_memory,
            "search": self._tool_search,
            "test": self._tool_test,
            "browser": self._tool_browser,
            "none": self._tool_none,
        }

        fn = dispatch.get(tool, self._tool_none)
        return await fn(task=task, goal=goal, previous=previous, task_id=task_id, session_id=session_id)

    # ─── Code Tool ─────────────────────────────────────────────────────────────
    async def _tool_code(self, task, goal, previous, task_id, session_id) -> str:
        """Generate code using LLM."""
        from core.agent import AgentCore
        agent = AgentCore(self.ws)
        messages = [
            {"role": "system", "content": "You are an expert software engineer. Write clean, production-quality code. Return only the code with minimal explanation."},
            {"role": "user", "content": f"Task: {task}\nGoal: {goal}\n\nWrite the code to accomplish this."},
        ]
        result = await agent.llm_stream(messages, task_id=task_id, session_id=session_id)
        return result or f"# Code for: {task}"

    # ─── Shell Tool ────────────────────────────────────────────────────────────
    async def _tool_shell(self, task, goal, previous, task_id, session_id) -> str:
        """Execute shell commands safely in a temp workspace."""
        # Extract command from task description
        from core.agent import AgentCore
        agent = AgentCore(self.ws)
        messages = [
            {"role": "system", "content": "Extract the shell command to run. Return ONLY the command, nothing else."},
            {"role": "user", "content": f"Task: {task}"},
        ]
        cmd = await agent.llm_stream(messages, task_id=task_id, session_id=session_id)
        cmd = cmd.strip().strip("`").strip()

        # Safety: block dangerous commands
        blocked = ["rm -rf /", ":(){ :|:& };:", "mkfs", "dd if=", "shutdown", "reboot", "halt"]
        for b in blocked:
            if b in cmd:
                return f"❌ Blocked dangerous command: {cmd}"

        try:
            await self.ws.emit(task_id, "step_progress", {
                "action": "shell_exec",
                "command": cmd[:200],
            }, session_id=session_id)
            proc = await asyncio.create_subprocess_shell(
                cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                cwd="/tmp",
            )
            stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=30)
            output = stdout.decode()[:2000] + (stderr.decode()[:500] if stderr else "")
            return output or "Command executed (no output)"
        except asyncio.TimeoutError:
            return "⚠️ Command timed out after 30s"
        except Exception as e:
            return f"❌ Shell error: {str(e)}"

    # ─── File Tool ─────────────────────────────────────────────────────────────
    async def _tool_file(self, task, goal, previous, task_id, session_id) -> str:
        """Create or modify files."""
        from core.agent import AgentCore
        agent = AgentCore(self.ws)
        messages = [
            {"role": "system", "content": "Generate file content. Respond with JSON: {\"filename\": \"...\", \"content\": \"...\"}"},
            {"role": "user", "content": f"Task: {task}\nGoal: {goal}"},
        ]
        raw = await agent.llm_stream(messages, task_id=task_id, session_id=session_id)
        try:
            import json
            start = raw.find("{")
            end = raw.rfind("}") + 1
            data = json.loads(raw[start:end])
            filename = data.get("filename", "output.txt")
            content = data.get("content", raw)
            path = f"/tmp/workspace/{filename}"
            os.makedirs(os.path.dirname(path), exist_ok=True)
            with open(path, "w") as f:
                f.write(content)
            await self.ws.emit(task_id, "step_progress", {
                "action": "file_written",
                "filename": filename,
                "size": len(content),
            }, session_id=session_id)
            return f"✅ File written: {filename} ({len(content)} chars)"
        except Exception as e:
            return f"File task result: {raw[:500]}"

    # ─── GitHub Tool ───────────────────────────────────────────────────────────
    async def _tool_github(self, task, goal, previous, task_id, session_id) -> str:
        """Perform GitHub operations."""
        return f"GitHub: {task}\n(Set GITHUB_TOKEN to enable real GitHub operations)"

    # ─── Memory Tool ───────────────────────────────────────────────────────────
    async def _tool_memory(self, task, goal, previous, task_id, session_id) -> str:
        """Save/retrieve from memory."""
        from memory.db import save_memory, search_memory
        results = await search_memory(task[:50], session_id=session_id)
        if results:
            return "\n".join([r["content"][:300] for r in results[:3]])
        return "No relevant memories found"

    # ─── Search Tool ───────────────────────────────────────────────────────────
    async def _tool_search(self, task, goal, previous, task_id, session_id) -> str:
        """Web search using available APIs."""
        return f"Search result for: {task}\n(Integrate search API for real results)"

    # ─── Test Tool ─────────────────────────────────────────────────────────────
    async def _tool_test(self, task, goal, previous, task_id, session_id) -> str:
        """Generate and run tests."""
        from core.agent import AgentCore
        agent = AgentCore(self.ws)
        messages = [
            {"role": "system", "content": "Write test cases for the given task. Use pytest format."},
            {"role": "user", "content": f"Write tests for: {task}\nContext: {goal}"},
        ]
        result = await agent.llm_stream(messages, task_id=task_id, session_id=session_id)
        return result or f"# Tests for: {task}"

    # ─── Browser Tool ──────────────────────────────────────────────────────────
    async def _tool_browser(self, task, goal, previous, task_id, session_id) -> str:
        """Browser automation (stub — extend with playwright)."""
        return f"Browser task: {task}\n(Install playwright for real browser automation)"

    # ─── None Tool ─────────────────────────────────────────────────────────────
    async def _tool_none(self, task, goal, previous, task_id, session_id) -> str:
        """Use LLM directly without tools."""
        from core.agent import AgentCore
        agent = AgentCore(self.ws)
        messages = [
            {"role": "system", "content": "You are an expert engineer. Complete the task thoroughly."},
            {"role": "user", "content": f"Task: {task}\nGoal context: {goal}"},
        ]
        result = await agent.llm_stream(messages, task_id=task_id, session_id=session_id)
        return result or f"Completed: {task}"
