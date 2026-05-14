"""
SandboxAgent — Persistent VS Code sandbox execution (Devin-style)
Controls file system, terminal, git operations in workspace
"""
import asyncio
import json
import os
import subprocess
import tempfile
from typing import Dict, List, Optional
import structlog
from .base_agent import BaseAgent

log = structlog.get_logger()

WORKSPACE = os.environ.get("WORKSPACE_DIR", "/tmp/god_workspace")


class SandboxAgent(BaseAgent):
    def __init__(self, ws_manager=None, ai_router=None):
        super().__init__("SandboxAgent", ws_manager, ai_router)
        os.makedirs(WORKSPACE, exist_ok=True)

    async def run(self, task: str, context: Dict = {}, **kwargs) -> str:
        session_id = kwargs.get("session_id", "")
        task_id = kwargs.get("task_id", "")

        task_lower = task.lower()

        if "execute" in task_lower or "run" in task_lower or "terminal" in task_lower:
            cmd = context.get("command", task)
            return await self.execute(cmd, task_id=task_id, session_id=session_id)
        elif "write file" in task_lower or "create file" in task_lower:
            filename = context.get("filename", "output.txt")
            content = context.get("content", "")
            return await self.write_file(filename, content, task_id=task_id, session_id=session_id)
        elif "read file" in task_lower:
            filename = context.get("filename", "")
            return await self.read_file(filename, task_id=task_id, session_id=session_id)
        elif "git" in task_lower:
            return await self.git_operation(task, task_id=task_id, session_id=session_id)
        else:
            return await self.execute(task, task_id=task_id, session_id=session_id)

    # ─── Terminal Execution ───────────────────────────────────────────────────

    async def execute(
        self,
        command: str,
        cwd: str = "",
        timeout: int = 30,
        task_id: str = "",
        session_id: str = "",
    ) -> str:
        """Execute shell command in sandbox workspace."""
        work_dir = cwd or WORKSPACE

        # Safety: block dangerous commands
        blocked = ["rm -rf /", ":(){ :|:& };:", "mkfs", "shutdown", "reboot", "halt", "dd if=/dev/"]
        for b in blocked:
            if b in command:
                return f"❌ Blocked dangerous command: {command[:50]}"

        await self.emit(task_id, "sandbox_exec", {
            "command": command[:200],
            "cwd": work_dir,
        }, session_id)

        try:
            proc = await asyncio.create_subprocess_shell(
                command,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                cwd=work_dir,
            )
            stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=timeout)
            output = stdout.decode("utf-8", errors="replace")
            err = stderr.decode("utf-8", errors="replace")

            result = output[:3000]
            if err and proc.returncode != 0:
                result += f"\n⚠️ stderr:\n{err[:500]}"

            await self.emit(task_id, "sandbox_result", {
                "command": command[:100],
                "exit_code": proc.returncode,
                "output_length": len(output),
                "success": proc.returncode == 0,
            }, session_id)

            return result or f"Command executed (exit code: {proc.returncode})"
        except asyncio.TimeoutError:
            return f"⚠️ Command timed out after {timeout}s"
        except Exception as e:
            return f"❌ Execution error: {str(e)}"

    # ─── File Operations ──────────────────────────────────────────────────────

    async def write_file(
        self,
        filename: str,
        content: str,
        task_id: str = "",
        session_id: str = "",
    ) -> str:
        """Write file to workspace."""
        filepath = os.path.join(WORKSPACE, filename)
        os.makedirs(os.path.dirname(filepath), exist_ok=True)
        try:
            with open(filepath, "w", encoding="utf-8") as f:
                f.write(content)
            await self.emit(task_id, "file_written", {
                "filename": filename,
                "size": len(content),
                "lines": len(content.split("\n")),
                "path": filepath,
            }, session_id)
            return f"✅ File written: `{filename}` ({len(content)} chars, {len(content.split(chr(10)))} lines)"
        except Exception as e:
            return f"❌ Write failed: {str(e)}"

    async def read_file(
        self,
        filename: str,
        task_id: str = "",
        session_id: str = "",
    ) -> str:
        """Read file from workspace."""
        filepath = os.path.join(WORKSPACE, filename)
        try:
            with open(filepath, "r", encoding="utf-8") as f:
                content = f.read()
            await self.emit(task_id, "file_read", {
                "filename": filename,
                "size": len(content),
            }, session_id)
            return content[:5000]
        except FileNotFoundError:
            return f"❌ File not found: {filename}"
        except Exception as e:
            return f"❌ Read failed: {str(e)}"

    async def list_files(self, path: str = "") -> List[str]:
        """List files in workspace."""
        target = os.path.join(WORKSPACE, path) if path else WORKSPACE
        try:
            result = []
            for root, dirs, files in os.walk(target):
                # Skip hidden and cache dirs
                dirs[:] = [d for d in dirs if not d.startswith(".") and d != "__pycache__" and d != "node_modules"]
                for f in files:
                    rel = os.path.relpath(os.path.join(root, f), WORKSPACE)
                    result.append(rel)
                if len(result) > 100:
                    break
            return result
        except Exception:
            return []

    # ─── Git Operations ───────────────────────────────────────────────────────

    async def git_operation(
        self,
        task: str,
        repo_path: str = "",
        task_id: str = "",
        session_id: str = "",
    ) -> str:
        """Perform git operations in workspace."""
        work_dir = repo_path or WORKSPACE
        task_lower = task.lower()

        if "clone" in task_lower:
            # Extract URL
            words = task.split()
            urls = [w for w in words if "github.com" in w or "gitlab.com" in w or ".git" in w]
            if urls:
                url = urls[0]
                return await self.execute(f"git clone {url}", cwd=WORKSPACE, task_id=task_id, session_id=session_id)
            return "❌ No git URL found in task."

        elif "commit" in task_lower:
            msg = task.replace("commit", "").strip() or "God Agent automated commit"
            cmds = [
                "git add -A",
                f'git commit -m "{msg}"',
            ]
            results = []
            for cmd in cmds:
                r = await self.execute(cmd, cwd=work_dir, task_id=task_id, session_id=session_id)
                results.append(r)
            return "\n".join(results)

        elif "push" in task_lower:
            return await self.execute("git push", cwd=work_dir, task_id=task_id, session_id=session_id)

        elif "status" in task_lower:
            return await self.execute("git status", cwd=work_dir, task_id=task_id, session_id=session_id)

        elif "log" in task_lower:
            return await self.execute("git log --oneline -10", cwd=work_dir, task_id=task_id, session_id=session_id)

        elif "init" in task_lower:
            return await self.execute("git init && git add -A", cwd=work_dir, task_id=task_id, session_id=session_id)

        else:
            return await self.execute(task, cwd=work_dir, task_id=task_id, session_id=session_id)

    # ─── Package Management ───────────────────────────────────────────────────

    async def install_packages(
        self,
        packages: List[str],
        manager: str = "pip",
        task_id: str = "",
        session_id: str = "",
    ) -> str:
        """Install packages in workspace."""
        pkg_str = " ".join(packages)
        if manager == "pip":
            cmd = f"pip install {pkg_str}"
        elif manager == "npm":
            cmd = f"npm install {pkg_str}"
        elif manager == "pnpm":
            cmd = f"pnpm add {pkg_str}"
        else:
            cmd = f"{manager} install {pkg_str}"

        await self.emit(task_id, "installing_packages", {
            "manager": manager,
            "packages": packages,
        }, session_id)
        return await self.execute(cmd, task_id=task_id, session_id=session_id)

    # ─── Workspace Info ───────────────────────────────────────────────────────

    async def get_workspace_info(self) -> Dict:
        """Get workspace status."""
        files = await self.list_files()
        try:
            disk = await self.execute("df -h /tmp | tail -1")
        except Exception:
            disk = "N/A"
        return {
            "path": WORKSPACE,
            "file_count": len(files),
            "files": files[:20],
            "disk_usage": disk,
        }
