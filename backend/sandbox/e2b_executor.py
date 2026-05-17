"""
E2B Sandbox Executor — Real code execution via E2B API
Provides actual Python/shell execution, file ops, stdout/stderr streaming
"""

import asyncio
import os
import time
import uuid
from typing import AsyncGenerator, Dict, List, Optional

import httpx
import structlog

log = structlog.get_logger()

E2B_API_KEY = os.environ.get("E2B_API_KEY", "")
E2B_BASE_URL = "https://api.e2b.dev"
E2B_SANDBOX_TEMPLATE = "base"  # Python sandbox


class E2BSandboxSession:
    """Represents a live E2B sandbox session."""

    def __init__(self, sandbox_id: str, session_id: str):
        self.sandbox_id = sandbox_id
        self.session_id = session_id
        self.created_at = time.time()
        self.last_used = time.time()
        self.files_created: List[str] = []

    def touch(self):
        self.last_used = time.time()

    def is_expired(self, ttl_seconds: int = 1800) -> bool:
        return (time.time() - self.last_used) > ttl_seconds


class E2BExecutor:
    """
    Real sandbox executor using E2B API.
    Creates isolated sandbox environments for code execution.
    """

    def __init__(self):
        self.api_key = E2B_API_KEY
        self._sessions: Dict[str, E2BSandboxSession] = {}
        self._client = httpx.AsyncClient(
            timeout=120.0,
            headers={
                "X-API-Key": self.api_key,
                "Content-Type": "application/json",
            }
        )

    async def get_or_create_sandbox(self, session_id: str) -> Optional[str]:
        """Get existing or create new sandbox for session."""
        if not self.api_key:
            log.warning("E2B_API_KEY not set — using local fallback")
            return None

        # Reuse existing non-expired session
        if session_id in self._sessions:
            sess = self._sessions[session_id]
            if not sess.is_expired():
                sess.touch()
                return sess.sandbox_id
            else:
                # Try to close expired sandbox
                await self._close_sandbox(sess.sandbox_id)
                del self._sessions[session_id]

        # Create new sandbox
        sandbox_id = await self._create_sandbox()
        if sandbox_id:
            self._sessions[session_id] = E2BSandboxSession(sandbox_id, session_id)
            log.info("E2B sandbox created", sandbox_id=sandbox_id, session_id=session_id)
        return sandbox_id

    async def _create_sandbox(self) -> Optional[str]:
        """Create a new E2B sandbox."""
        try:
            resp = await self._client.post(
                f"{E2B_BASE_URL}/sandboxes",
                json={
                    "templateID": E2B_SANDBOX_TEMPLATE,
                    "metadata": {"source": "god-agent-os"},
                }
            )
            if resp.status_code in (200, 201):
                data = resp.json()
                return data.get("sandboxID") or data.get("sandbox_id") or data.get("id")
            else:
                log.error("E2B create sandbox failed", status=resp.status_code, body=resp.text[:200])
                return None
        except Exception as e:
            log.error("E2B create sandbox exception", error=str(e))
            return None

    async def _close_sandbox(self, sandbox_id: str):
        """Close/terminate a sandbox."""
        try:
            await self._client.delete(f"{E2B_BASE_URL}/sandboxes/{sandbox_id}")
        except Exception:
            pass

    async def execute_code(
        self,
        code: str,
        session_id: str,
        language: str = "python",
        timeout: int = 60,
    ) -> Dict:
        """Execute code in E2B sandbox and return real stdout/stderr."""
        sandbox_id = await self.get_or_create_sandbox(session_id)

        if not sandbox_id:
            # Fallback: local subprocess execution
            return await self._local_execute_code(code, language, timeout)

        try:
            # E2B code execution API
            if language == "python":
                endpoint = f"{E2B_BASE_URL}/sandboxes/{sandbox_id}/code"
                resp = await self._client.post(
                    endpoint,
                    json={
                        "code": code,
                        "language": "python3",
                        "timeout": timeout,
                    },
                    timeout=timeout + 10,
                )
            else:
                # Shell command
                endpoint = f"{E2B_BASE_URL}/sandboxes/{sandbox_id}/processes"
                resp = await self._client.post(
                    endpoint,
                    json={
                        "cmd": code,
                        "timeout": timeout,
                    },
                    timeout=timeout + 10,
                )

            if resp.status_code == 200:
                data = resp.json()
                stdout = data.get("stdout", "") or data.get("output", "") or ""
                stderr = data.get("stderr", "") or ""
                exit_code = data.get("exitCode", 0) or data.get("exit_code", 0) or 0

                # Update session files
                if session_id in self._sessions:
                    self._sessions[session_id].touch()

                return {
                    "stdout": stdout,
                    "stderr": stderr,
                    "exit_code": exit_code,
                    "sandbox_id": sandbox_id,
                    "success": exit_code == 0,
                    "execution_time_ms": data.get("duration", 0),
                }
            else:
                log.error("E2B execute failed", status=resp.status_code, body=resp.text[:300])
                # Fallback to local
                return await self._local_execute_code(code, language, timeout)

        except Exception as e:
            log.error("E2B execute exception", error=str(e))
            return await self._local_execute_code(code, language, timeout)

    async def execute_shell(
        self,
        command: str,
        session_id: str,
        timeout: int = 60,
        cwd: str = "/home/user",
    ) -> Dict:
        """Execute shell command in E2B sandbox."""
        sandbox_id = await self.get_or_create_sandbox(session_id)

        if not sandbox_id:
            return await self._local_execute_shell(command, timeout, cwd)

        try:
            resp = await self._client.post(
                f"{E2B_BASE_URL}/sandboxes/{sandbox_id}/processes",
                json={
                    "cmd": command,
                    "cwd": cwd,
                    "timeout": timeout,
                },
                timeout=timeout + 10,
            )

            if resp.status_code == 200:
                data = resp.json()
                stdout = data.get("stdout", "") or data.get("output", "") or ""
                stderr = data.get("stderr", "") or ""
                exit_code = data.get("exitCode", 0) or data.get("exit_code", 0) or 0

                if session_id in self._sessions:
                    self._sessions[session_id].touch()

                return {
                    "stdout": stdout,
                    "stderr": stderr,
                    "exit_code": exit_code,
                    "sandbox_id": sandbox_id,
                    "success": exit_code == 0,
                    "command": command,
                }
            else:
                return await self._local_execute_shell(command, timeout, cwd)

        except Exception as e:
            log.error("E2B shell execute exception", error=str(e))
            return await self._local_execute_shell(command, timeout, cwd)

    async def write_file(
        self,
        path: str,
        content: str,
        session_id: str,
    ) -> Dict:
        """Write file in E2B sandbox filesystem."""
        sandbox_id = await self.get_or_create_sandbox(session_id)

        if not sandbox_id:
            return await self._local_write_file(path, content)

        try:
            resp = await self._client.post(
                f"{E2B_BASE_URL}/sandboxes/{sandbox_id}/filesystem",
                json={"path": path, "content": content},
            )

            if resp.status_code in (200, 201):
                if session_id in self._sessions:
                    self._sessions[session_id].files_created.append(path)
                    self._sessions[session_id].touch()

                return {
                    "success": True,
                    "path": path,
                    "size": len(content),
                    "sandbox_id": sandbox_id,
                }
            else:
                return await self._local_write_file(path, content)

        except Exception as e:
            log.error("E2B write file exception", error=str(e))
            return await self._local_write_file(path, content)

    async def read_file(self, path: str, session_id: str) -> Dict:
        """Read file from E2B sandbox filesystem."""
        sandbox_id = await self.get_or_create_sandbox(session_id)

        if not sandbox_id:
            return await self._local_read_file(path)

        try:
            resp = await self._client.get(
                f"{E2B_BASE_URL}/sandboxes/{sandbox_id}/filesystem",
                params={"path": path},
            )

            if resp.status_code == 200:
                data = resp.json()
                content = data.get("content", "") or resp.text
                return {
                    "success": True,
                    "path": path,
                    "content": content,
                    "sandbox_id": sandbox_id,
                }
            else:
                return {"success": False, "error": f"File not found: {path}"}

        except Exception as e:
            return {"success": False, "error": str(e)}

    async def delete_file(self, path: str, session_id: str) -> Dict:
        """Delete file from E2B sandbox."""
        sandbox_id = await self.get_or_create_sandbox(session_id)

        if not sandbox_id:
            return await self._local_delete_file(path)

        try:
            cmd = f"rm -f {path}"
            result = await self.execute_shell(cmd, session_id)
            success = result.get("exit_code", 1) == 0
            return {
                "success": success,
                "path": path,
                "sandbox_id": sandbox_id,
            }
        except Exception as e:
            return {"success": False, "error": str(e)}

    async def list_files(self, path: str, session_id: str) -> Dict:
        """List files in E2B sandbox directory."""
        sandbox_id = await self.get_or_create_sandbox(session_id)

        if not sandbox_id:
            return await self._local_list_files(path)

        try:
            cmd = f"ls -la {path} 2>&1"
            result = await self.execute_shell(cmd, session_id)
            return {
                "success": True,
                "path": path,
                "listing": result.get("stdout", ""),
                "sandbox_id": sandbox_id,
            }
        except Exception as e:
            return {"success": False, "error": str(e)}

    def get_session_info(self, session_id: str) -> Dict:
        """Get sandbox session info."""
        if session_id in self._sessions:
            sess = self._sessions[session_id]
            return {
                "sandbox_id": sess.sandbox_id,
                "session_id": session_id,
                "created_at": sess.created_at,
                "last_used": sess.last_used,
                "files_created": sess.files_created,
                "active": not sess.is_expired(),
            }
        return {"session_id": session_id, "active": False}

    async def close_session(self, session_id: str):
        """Close sandbox session."""
        if session_id in self._sessions:
            sess = self._sessions[session_id]
            await self._close_sandbox(sess.sandbox_id)
            del self._sessions[session_id]
            log.info("E2B session closed", session_id=session_id)

    # ─── Local Fallback (when E2B not available) ──────────────────────────────

    async def _local_execute_code(self, code: str, language: str, timeout: int) -> Dict:
        """Execute code locally as fallback."""
        import tempfile
        start = time.time()

        if language == "python":
            with tempfile.NamedTemporaryFile(suffix=".py", mode="w", delete=False) as f:
                f.write(code)
                fname = f.name
            try:
                proc = await asyncio.create_subprocess_exec(
                    "python3", fname,
                    stdout=asyncio.subprocess.PIPE,
                    stderr=asyncio.subprocess.PIPE,
                )
                stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=timeout)
                duration_ms = int((time.time() - start) * 1000)
                return {
                    "stdout": stdout.decode("utf-8", errors="replace"),
                    "stderr": stderr.decode("utf-8", errors="replace"),
                    "exit_code": proc.returncode,
                    "sandbox_id": "local",
                    "success": proc.returncode == 0,
                    "execution_time_ms": duration_ms,
                }
            except asyncio.TimeoutError:
                return {"stdout": "", "stderr": f"Timeout after {timeout}s", "exit_code": -1, "sandbox_id": "local", "success": False}
            finally:
                try:
                    os.unlink(fname)
                except Exception:
                    pass
        else:
            return await self._local_execute_shell(code, timeout)

    async def _local_execute_shell(self, command: str, timeout: int, cwd: str = "/tmp") -> Dict:
        """Execute shell command locally as fallback."""
        # Safety check
        blocked = ["rm -rf /", ":(){ :|:&", "mkfs", "shutdown", "reboot", "halt", "dd if=/dev/zero"]
        for b in blocked:
            if b in command:
                return {
                    "stdout": "", "stderr": f"Blocked dangerous command",
                    "exit_code": 1, "sandbox_id": "local", "success": False,
                    "command": command,
                }

        start = time.time()
        try:
            proc = await asyncio.create_subprocess_shell(
                command,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                cwd=cwd if os.path.exists(cwd) else "/tmp",
            )
            stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=timeout)
            duration_ms = int((time.time() - start) * 1000)
            return {
                "stdout": stdout.decode("utf-8", errors="replace"),
                "stderr": stderr.decode("utf-8", errors="replace"),
                "exit_code": proc.returncode,
                "sandbox_id": "local",
                "success": proc.returncode == 0,
                "execution_time_ms": duration_ms,
                "command": command,
            }
        except asyncio.TimeoutError:
            return {
                "stdout": "", "stderr": f"Command timed out after {timeout}s",
                "exit_code": -1, "sandbox_id": "local", "success": False,
                "command": command,
            }
        except Exception as e:
            return {
                "stdout": "", "stderr": str(e),
                "exit_code": -1, "sandbox_id": "local", "success": False,
                "command": command,
            }

    async def _local_write_file(self, path: str, content: str) -> Dict:
        """Write file locally as fallback."""
        try:
            os.makedirs(os.path.dirname(os.path.abspath(path)), exist_ok=True)
            with open(path, "w", encoding="utf-8") as f:
                f.write(content)
            return {
                "success": True,
                "path": path,
                "size": len(content),
                "sandbox_id": "local",
            }
        except Exception as e:
            return {"success": False, "error": str(e), "sandbox_id": "local"}

    async def _local_read_file(self, path: str) -> Dict:
        """Read file locally as fallback."""
        try:
            with open(path, "r", encoding="utf-8") as f:
                content = f.read()
            return {
                "success": True,
                "path": path,
                "content": content,
                "sandbox_id": "local",
            }
        except FileNotFoundError:
            return {"success": False, "error": f"File not found: {path}"}
        except Exception as e:
            return {"success": False, "error": str(e)}

    async def _local_delete_file(self, path: str) -> Dict:
        """Delete file locally as fallback."""
        try:
            os.unlink(path)
            return {"success": True, "path": path, "sandbox_id": "local"}
        except Exception as e:
            return {"success": False, "error": str(e)}

    async def _local_list_files(self, path: str) -> Dict:
        """List files locally as fallback."""
        try:
            import subprocess
            result = subprocess.run(
                ["ls", "-la", path],
                capture_output=True, text=True, timeout=5
            )
            return {
                "success": True,
                "path": path,
                "listing": result.stdout,
                "sandbox_id": "local",
            }
        except Exception as e:
            return {"success": False, "error": str(e)}

    async def close(self):
        """Cleanup all sessions."""
        for sid in list(self._sessions.keys()):
            await self.close_session(sid)
        await self._client.aclose()


# Global singleton
_executor: Optional[E2BExecutor] = None


def get_executor() -> E2BExecutor:
    global _executor
    if _executor is None:
        _executor = E2BExecutor()
    return _executor
