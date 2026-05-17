"""
Real Tool Router — Autonomous Agent Function Calling
Routes LLM intent to real execution: E2B sandbox, file ops, shell, git, etc.
"""

import asyncio
import hashlib
import json
import os
import time
import uuid
from typing import Any, AsyncGenerator, Dict, List, Optional, Tuple

import httpx
import structlog

log = structlog.get_logger()

# ─── Tool Definitions (for LLM function calling) ──────────────────────────────

TOOL_DEFINITIONS = [
    {
        "name": "execute_python",
        "description": "Execute Python code in a real sandbox and return actual stdout/stderr output. Use this for ANY Python code execution, calculations, data processing, etc.",
        "parameters": {
            "type": "object",
            "properties": {
                "code": {
                    "type": "string",
                    "description": "The Python code to execute"
                },
                "description": {
                    "type": "string",
                    "description": "What this code does"
                }
            },
            "required": ["code"]
        }
    },
    {
        "name": "execute_shell",
        "description": "Execute a shell/terminal command and return real output. Use for file operations, system commands, installing packages, etc.",
        "parameters": {
            "type": "object",
            "properties": {
                "command": {
                    "type": "string",
                    "description": "The shell command to execute"
                },
                "cwd": {
                    "type": "string",
                    "description": "Working directory (default: /tmp)"
                }
            },
            "required": ["command"]
        }
    },
    {
        "name": "write_file",
        "description": "Create or overwrite a file with the given content. Returns confirmation with file size.",
        "parameters": {
            "type": "object",
            "properties": {
                "path": {
                    "type": "string",
                    "description": "File path to write"
                },
                "content": {
                    "type": "string",
                    "description": "File content"
                }
            },
            "required": ["path", "content"]
        }
    },
    {
        "name": "read_file",
        "description": "Read the contents of a file from the sandbox filesystem.",
        "parameters": {
            "type": "object",
            "properties": {
                "path": {
                    "type": "string",
                    "description": "File path to read"
                }
            },
            "required": ["path"]
        }
    },
    {
        "name": "delete_file",
        "description": "Delete a file from the sandbox filesystem.",
        "parameters": {
            "type": "object",
            "properties": {
                "path": {
                    "type": "string",
                    "description": "File path to delete"
                }
            },
            "required": ["path"]
        }
    },
    {
        "name": "list_files",
        "description": "List files and directories in a given path.",
        "parameters": {
            "type": "object",
            "properties": {
                "path": {
                    "type": "string",
                    "description": "Directory path to list"
                }
            },
            "required": ["path"]
        }
    },
    {
        "name": "web_search",
        "description": "Search the web for information. Returns relevant results.",
        "parameters": {
            "type": "object",
            "properties": {
                "query": {
                    "type": "string",
                    "description": "Search query"
                }
            },
            "required": ["query"]
        }
    },
    {
        "name": "install_package",
        "description": "Install a Python package using pip.",
        "parameters": {
            "type": "object",
            "properties": {
                "package": {
                    "type": "string",
                    "description": "Package name (e.g., 'requests', 'numpy')"
                }
            },
            "required": ["package"]
        }
    },
]

# Tool name → display info
TOOL_DISPLAY = {
    "execute_python": {"icon": "🐍", "label": "Python Execution"},
    "execute_shell": {"icon": "💻", "label": "Terminal"},
    "write_file": {"icon": "📝", "label": "Write File"},
    "read_file": {"icon": "📖", "label": "Read File"},
    "delete_file": {"icon": "🗑️", "label": "Delete File"},
    "list_files": {"icon": "📁", "label": "List Files"},
    "web_search": {"icon": "🔍", "label": "Web Search"},
    "install_package": {"icon": "📦", "label": "Install Package"},
}


class ToolRouter:
    """
    Routes tool calls to real execution engines.
    Integrates with E2B for sandboxed execution.
    """

    def __init__(self, ws_manager=None):
        self.ws = ws_manager
        from sandbox.e2b_executor import get_executor
        self.executor = get_executor()

    async def execute_tool(
        self,
        tool_name: str,
        tool_args: Dict[str, Any],
        session_id: str,
        task_id: str = "",
    ) -> Dict[str, Any]:
        """Execute a tool and return real results."""
        display = TOOL_DISPLAY.get(tool_name, {"icon": "⚙️", "label": tool_name})
        start_time = time.time()

        # Emit tool start event
        if self.ws:
            await self.ws.emit_chat(session_id, "tool_start", {
                "tool": tool_name,
                "icon": display["icon"],
                "label": display["label"],
                "args": {k: str(v)[:200] for k, v in tool_args.items()},
                "task_id": task_id,
            })

        log.info("Tool executing", tool=tool_name, session_id=session_id)

        try:
            if tool_name == "execute_python":
                result = await self._execute_python(tool_args, session_id)
            elif tool_name == "execute_shell":
                result = await self._execute_shell(tool_args, session_id)
            elif tool_name == "write_file":
                result = await self._write_file(tool_args, session_id)
            elif tool_name == "read_file":
                result = await self._read_file(tool_args, session_id)
            elif tool_name == "delete_file":
                result = await self._delete_file(tool_args, session_id)
            elif tool_name == "list_files":
                result = await self._list_files(tool_args, session_id)
            elif tool_name == "web_search":
                result = await self._web_search(tool_args, session_id)
            elif tool_name == "install_package":
                result = await self._install_package(tool_args, session_id)
            else:
                result = {"error": f"Unknown tool: {tool_name}", "success": False}

        except Exception as e:
            log.error("Tool execution error", tool=tool_name, error=str(e))
            result = {"error": str(e), "success": False}

        duration_ms = int((time.time() - start_time) * 1000)
        result["_duration_ms"] = duration_ms
        result["_tool"] = tool_name

        # Emit tool complete event
        if self.ws:
            await self.ws.emit_chat(session_id, "tool_complete", {
                "tool": tool_name,
                "icon": display["icon"],
                "label": display["label"],
                "success": result.get("success", True),
                "duration_ms": duration_ms,
                "task_id": task_id,
                "output_preview": str(result.get("stdout", result.get("content", result.get("output", ""))))[:200],
            })

        return result

    async def _execute_python(self, args: Dict, session_id: str) -> Dict:
        code = args.get("code", "")
        result = await self.executor.execute_code(code, session_id, language="python")
        return result

    async def _execute_shell(self, args: Dict, session_id: str) -> Dict:
        command = args.get("command", "")
        cwd = args.get("cwd", "/tmp")

        # Safety check
        blocked = ["rm -rf /", ":(){ :|:&", "mkfs", "shutdown", "reboot", "halt"]
        for b in blocked:
            if b in command:
                return {"stdout": "", "stderr": "⛔ Blocked dangerous command", "exit_code": 1, "success": False}

        result = await self.executor.execute_shell(command, session_id, cwd=cwd)
        return result

    async def _write_file(self, args: Dict, session_id: str) -> Dict:
        path = args.get("path", "/tmp/output.txt")
        content = args.get("content", "")

        # Normalize path
        if not path.startswith("/"):
            path = f"/tmp/workspace/{path}"

        result = await self.executor.write_file(path, content, session_id)
        if result.get("success"):
            result["output"] = f"✅ File written: {path} ({len(content)} chars, {len(content.splitlines())} lines)"
        return result

    async def _read_file(self, args: Dict, session_id: str) -> Dict:
        path = args.get("path", "")
        if not path.startswith("/"):
            path = f"/tmp/workspace/{path}"
        return await self.executor.read_file(path, session_id)

    async def _delete_file(self, args: Dict, session_id: str) -> Dict:
        path = args.get("path", "")
        if not path.startswith("/"):
            path = f"/tmp/workspace/{path}"
        result = await self.executor.delete_file(path, session_id)
        if result.get("success"):
            result["output"] = f"✅ File deleted: {path}"
        return result

    async def _list_files(self, args: Dict, session_id: str) -> Dict:
        path = args.get("path", "/tmp")
        return await self.executor.list_files(path, session_id)

    async def _web_search(self, args: Dict, session_id: str) -> Dict:
        query = args.get("query", "")
        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                # DuckDuckGo instant answers API
                resp = await client.get(
                    "https://api.duckduckgo.com/",
                    params={"q": query, "format": "json", "no_html": "1"},
                )
                if resp.status_code == 200:
                    data = resp.json()
                    abstract = data.get("AbstractText", "")
                    related = [r.get("Text", "") for r in data.get("RelatedTopics", [])[:5] if "Text" in r]
                    result_text = abstract or "\n".join(related) or f"Search completed for: {query}"
                    return {
                        "success": True,
                        "query": query,
                        "output": result_text,
                        "source": "duckduckgo",
                    }
        except Exception as e:
            log.warning("Web search failed", error=str(e))

        return {
            "success": True,
            "query": query,
            "output": f"Web search for '{query}' — integrate a search API for full results",
        }

    async def _install_package(self, args: Dict, session_id: str) -> Dict:
        package = args.get("package", "")
        if not package or not package.replace("-", "").replace("_", "").replace(".", "").isalnum():
            return {"success": False, "error": "Invalid package name"}

        result = await self.executor.execute_shell(
            f"pip install {package} -q",
            session_id,
            timeout=120,
        )
        if result.get("exit_code", 1) == 0:
            result["output"] = f"✅ Package installed: {package}"
        return result

    def format_tool_result(self, tool_name: str, result: Dict) -> str:
        """Format tool result for inclusion in LLM context."""
        if not result.get("success", True) and result.get("error"):
            return f"❌ Tool Error: {result['error']}"

        # Python/Shell execution
        stdout = result.get("stdout", "")
        stderr = result.get("stderr", "")
        exit_code = result.get("exit_code", 0)
        sandbox_id = result.get("sandbox_id", "unknown")
        duration_ms = result.get("_duration_ms", 0)

        if tool_name in ("execute_python", "execute_shell"):
            parts = []
            if stdout:
                parts.append(f"**stdout:**\n```\n{stdout[:3000]}\n```")
            if stderr and exit_code != 0:
                parts.append(f"**stderr:**\n```\n{stderr[:1000]}\n```")
            parts.append(f"**Exit code:** {exit_code} | **Sandbox:** `{sandbox_id}` | **Time:** {duration_ms}ms")
            return "\n".join(parts) if parts else f"Executed (exit: {exit_code})"

        elif tool_name == "write_file":
            if result.get("success"):
                return f"✅ **File created:** `{result.get('path', '')}` ({result.get('size', 0)} bytes) on sandbox `{sandbox_id}`"
            return f"❌ Write failed: {result.get('error', '')}"

        elif tool_name == "read_file":
            if result.get("success"):
                content = result.get("content", "")
                return f"**File contents of `{result.get('path', '')}`:**\n```\n{content[:3000]}\n```"
            return f"❌ Read failed: {result.get('error', '')}"

        elif tool_name == "delete_file":
            return result.get("output", f"Delete operation completed for {result.get('path', '')}")

        elif tool_name == "list_files":
            listing = result.get("listing", "")
            return f"**Directory listing of `{result.get('path', '')}`:**\n```\n{listing}\n```"

        elif tool_name == "web_search":
            return f"**Search results for '{result.get('query', '')}':**\n{result.get('output', '')}"

        elif tool_name == "install_package":
            if result.get("exit_code", 1) == 0:
                return f"✅ Package installed successfully"
            return f"Package install output:\n```\n{stdout[:500]}\n```"

        return result.get("output", str(result)[:500])
