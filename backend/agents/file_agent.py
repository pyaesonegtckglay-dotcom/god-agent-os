"""
FileAgent v7 — Autonomous file system management, code editing, project scaffolding
Like Devin's file browser + OneHand's file manipulation
"""
import asyncio
import json
import os
import re
import shutil
from pathlib import Path
from typing import Dict, List, Optional
import structlog
from .base_agent import BaseAgent

log = structlog.get_logger()

FILE_SYSTEM = """You are an elite file system and project management agent.
You can:
- Create, read, edit, delete files and directories
- Scaffold complete project structures
- Analyze codebases and suggest improvements
- Generate file trees and project maps
- Apply patches and diffs to code files
- Manage project configuration files

Always provide complete, runnable file content.
"""

WORKSPACE = os.environ.get("WORKSPACE_DIR", "/tmp/god_workspace")

class FileAgent(BaseAgent):
    def __init__(self, ws_manager=None, ai_router=None):
        super().__init__("FileAgent", ws_manager, ai_router)
        os.makedirs(WORKSPACE, exist_ok=True)

    async def run(self, task: str, context: Dict = {}, **kwargs) -> str:
        session_id = kwargs.get("session_id", "")
        task_id = kwargs.get("task_id", "")

        await self.emit(task_id, "agent_start", {"agent": "FileAgent", "task": task[:80]}, session_id)

        task_lower = task.lower()
        if any(k in task_lower for k in ["create", "scaffold", "generate", "new project", "init"]):
            result = await self._scaffold_project(task, context, task_id, session_id)
        elif any(k in task_lower for k in ["read", "show", "view", "list", "tree"]):
            result = await self._read_or_list(task, task_id, session_id)
        elif any(k in task_lower for k in ["edit", "modify", "update", "change", "fix", "patch"]):
            result = await self._edit_file(task, context, task_id, session_id)
        elif any(k in task_lower for k in ["delete", "remove", "clean"]):
            result = await self._delete_files(task, task_id, session_id)
        else:
            result = await self._ai_file_task(task, context, task_id, session_id)

        return result

    async def _scaffold_project(self, task: str, context: Dict, task_id: str, session_id: str) -> str:
        """Scaffold a complete project structure."""
        await self.emit(task_id, "tool_called", {
            "agent": "FileAgent", "tool": "scaffold_project", "step": "Generating project structure"
        }, session_id)

        messages = [
            {"role": "system", "content": FILE_SYSTEM},
            {"role": "user", "content": (
                f"Task: {task}\n\n"
                "Generate a complete project scaffold. Return a JSON object with this structure:\n"
                "{\n"
                '  "project_name": "name",\n'
                '  "files": [\n'
                '    {"path": "relative/path/file.ext", "content": "full file content here"}\n'
                "  ],\n"
                '  "description": "what was created",\n'
                '  "run_commands": ["npm install", "npm run dev"]\n'
                "}\n"
                "Include all necessary files for a working project."
            )},
        ]
        response = await self.llm(messages, task_id=task_id, session_id=session_id, temperature=0.2, max_tokens=8192)

        # Parse JSON and create files
        created_files = []
        try:
            start = response.find("{")
            end = response.rfind("}") + 1
            if start >= 0 and end > start:
                data = json.loads(response[start:end])
                project_name = data.get("project_name", "project")
                project_path = os.path.join(WORKSPACE, project_name)
                os.makedirs(project_path, exist_ok=True)

                for f in data.get("files", []):
                    filepath = os.path.join(project_path, f["path"])
                    os.makedirs(os.path.dirname(filepath), exist_ok=True)
                    with open(filepath, "w") as fp:
                        fp.write(f["content"])
                    created_files.append(f["path"])
                    await self.emit(task_id, "file_written", {
                        "path": f["path"], "size": len(f["content"])
                    }, session_id)

                result = (
                    f"✅ **Project Scaffolded**: `{project_name}`\n\n"
                    f"**Files Created** ({len(created_files)}):\n"
                    + "\n".join(f"- `{f}`" for f in created_files)
                    + f"\n\n**Description:** {data.get('description', '')}\n\n"
                    + "**Run Commands:**\n"
                    + "\n".join(f"```\n{cmd}\n```" for cmd in data.get("run_commands", []))
                )
                return result
        except Exception as e:
            log.warning("Failed to parse project scaffold JSON", error=str(e))

        return response

    async def _read_or_list(self, task: str, task_id: str, session_id: str) -> str:
        """Read files or list directory structure."""
        await self.emit(task_id, "tool_called", {
            "agent": "FileAgent", "tool": "read_files", "step": "Reading file system"
        }, session_id)

        # Extract path from task
        path_match = re.search(r'["\']([^"\']+)["\']|(\S+\.\w+)', task)
        target_path = path_match.group(1) or path_match.group(2) if path_match else WORKSPACE

        if not os.path.isabs(target_path):
            target_path = os.path.join(WORKSPACE, target_path)

        if os.path.isdir(target_path):
            tree = self._get_tree(target_path)
            return f"**Directory Tree:** `{target_path}`\n\n```\n{tree}\n```"
        elif os.path.isfile(target_path):
            with open(target_path) as f:
                content = f.read()
            return f"**File:** `{target_path}`\n\n```\n{content[:4000]}\n```"
        else:
            # List workspace
            tree = self._get_tree(WORKSPACE, max_depth=3)
            return f"**Workspace:** `{WORKSPACE}`\n\n```\n{tree}\n```"

    async def _edit_file(self, task: str, context: Dict, task_id: str, session_id: str) -> str:
        """Edit a file based on instructions."""
        await self.emit(task_id, "tool_called", {
            "agent": "FileAgent", "tool": "edit_file", "step": "Editing file"
        }, session_id)

        messages = [
            {"role": "system", "content": FILE_SYSTEM},
            {"role": "user", "content": (
                f"Task: {task}\n\n"
                f"Context: {json.dumps(context)[:500]}\n\n"
                "Return a JSON with: {\"filepath\": \"path\", \"content\": \"full new file content\", \"explanation\": \"what changed\"}"
            )},
        ]
        response = await self.llm(messages, task_id=task_id, session_id=session_id, temperature=0.1, max_tokens=8192)

        try:
            start = response.find("{")
            end = response.rfind("}") + 1
            if start >= 0 and end > start:
                data = json.loads(response[start:end])
                filepath = os.path.join(WORKSPACE, data.get("filepath", "output.txt"))
                os.makedirs(os.path.dirname(filepath), exist_ok=True)
                with open(filepath, "w") as f:
                    f.write(data.get("content", ""))
                await self.emit(task_id, "file_written", {"path": data.get("filepath"), "edited": True}, session_id)
                return f"✅ **File Edited:** `{data.get('filepath')}`\n\n{data.get('explanation', '')}"
        except Exception:
            pass
        return response

    async def _delete_files(self, task: str, task_id: str, session_id: str) -> str:
        """Delete files or directories safely."""
        path_match = re.search(r'["\']([^"\']+)["\']', task)
        if path_match:
            target = os.path.join(WORKSPACE, path_match.group(1))
            if os.path.exists(target) and WORKSPACE in target:
                if os.path.isdir(target):
                    shutil.rmtree(target)
                else:
                    os.remove(target)
                await self.emit(task_id, "file_deleted", {"path": path_match.group(1)}, session_id)
                return f"✅ Deleted: `{path_match.group(1)}`"
        return "❌ Could not find file/directory to delete. Please specify the path in quotes."

    async def _ai_file_task(self, task: str, context: Dict, task_id: str, session_id: str) -> str:
        """Handle generic file tasks via AI."""
        messages = [
            {"role": "system", "content": FILE_SYSTEM},
            {"role": "user", "content": f"Task: {task}\n\nWorkspace: {WORKSPACE}\n\nContext: {json.dumps(context)[:300]}"},
        ]
        return await self.llm(messages, task_id=task_id, session_id=session_id, temperature=0.3, max_tokens=4096)

    def _get_tree(self, path: str, prefix: str = "", max_depth: int = 4, depth: int = 0) -> str:
        """Generate a directory tree string."""
        if depth > max_depth:
            return ""
        try:
            entries = sorted(os.scandir(path), key=lambda e: (e.is_file(), e.name))
        except PermissionError:
            return ""
        lines = []
        for i, entry in enumerate(entries):
            if entry.name.startswith(".") and entry.name not in [".env", ".gitignore"]:
                continue
            connector = "└── " if i == len(entries) - 1 else "├── "
            lines.append(f"{prefix}{connector}{entry.name}")
            if entry.is_dir() and depth < max_depth:
                extension = "    " if i == len(entries) - 1 else "│   "
                subtree = self._get_tree(entry.path, prefix + extension, max_depth, depth + 1)
                if subtree:
                    lines.append(subtree)
        return "\n".join(lines)

    def list_workspace(self) -> Dict:
        """List all workspace files."""
        files = []
        for root, dirs, filenames in os.walk(WORKSPACE):
            dirs[:] = [d for d in dirs if not d.startswith(".") and d != "node_modules"]
            for f in filenames:
                full_path = os.path.join(root, f)
                rel_path = os.path.relpath(full_path, WORKSPACE)
                try:
                    size = os.path.getsize(full_path)
                    files.append({"path": rel_path, "size": size})
                except Exception:
                    pass
        return {"workspace": WORKSPACE, "files": files, "total": len(files)}
