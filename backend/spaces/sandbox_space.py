"""
💻 Sandbox Space — Secure Code Execution Environment
Where code is run and tested safely.
"""
import asyncio
import os
import subprocess
import tempfile
import re
from typing import Dict
import structlog
from .base_space import BaseSpace

log = structlog.get_logger()

ALLOWED_LANGUAGES = {"python", "javascript", "bash", "sh"}


class SandboxSpace(BaseSpace):
    space_name = "sandbox"
    space_description = "Secure execution environment — run Python, JavaScript, shell scripts safely."
    available_roles = ["execution", "cognition"]
    
    def __init__(self, ws_manager=None, ai_router=None):
        super().__init__(ws_manager, ai_router)
        self.workspace = "/tmp/god_sandbox"
        os.makedirs(self.workspace, exist_ok=True)
        self.register_tool("run_python", self._run_python, "Execute Python code")
        self.register_tool("run_shell", self._run_shell, "Execute shell commands")
        self.register_tool("run_javascript", self._run_javascript, "Execute JavaScript with Node.js")
    
    async def _run_python(self, code: str, timeout: int = 30, **kwargs) -> str:
        """Run Python code safely."""
        try:
            with tempfile.NamedTemporaryFile(suffix=".py", dir=self.workspace, 
                                              mode='w', delete=False) as f:
                f.write(code)
                fname = f.name
            
            proc = await asyncio.create_subprocess_exec(
                "python3", fname,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                cwd=self.workspace,
            )
            try:
                stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=timeout)
                output = stdout.decode("utf-8", errors="replace")
                errors = stderr.decode("utf-8", errors="replace")
                
                result = ""
                if output:
                    result += f"Output:\n{output}"
                if errors:
                    result += f"\nErrors:\n{errors}"
                return result or "Code executed successfully (no output)"
            except asyncio.TimeoutError:
                proc.kill()
                return "⚠️ Execution timed out (30s limit)"
        except Exception as e:
            return f"❌ Python execution error: {str(e)}"
        finally:
            try:
                os.unlink(fname)
            except Exception:
                pass
    
    async def _run_shell(self, command: str, timeout: int = 30, **kwargs) -> str:
        """Run shell command safely."""
        # Basic security: block dangerous commands
        dangerous = ["rm -rf /", "dd if=", "mkfs", ":(){ :|:& };:", "> /dev/sda"]
        for d in dangerous:
            if d in command:
                return f"⚠️ Command blocked for safety: {d}"
        
        try:
            proc = await asyncio.create_subprocess_shell(
                command,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                cwd=self.workspace,
            )
            try:
                stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=timeout)
                output = stdout.decode("utf-8", errors="replace")
                errors = stderr.decode("utf-8", errors="replace")
                result = output + (f"\n[stderr]: {errors}" if errors else "")
                return result or f"Command completed (exit code: {proc.returncode})"
            except asyncio.TimeoutError:
                proc.kill()
                return "⚠️ Command timed out (30s limit)"
        except Exception as e:
            return f"❌ Shell error: {str(e)}"
    
    async def _run_javascript(self, code: str, timeout: int = 30, **kwargs) -> str:
        """Run JavaScript with Node.js."""
        try:
            with tempfile.NamedTemporaryFile(suffix=".js", dir=self.workspace, 
                                              mode='w', delete=False) as f:
                f.write(code)
                fname = f.name
            
            proc = await asyncio.create_subprocess_exec(
                "node", fname,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                cwd=self.workspace,
            )
            try:
                stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=timeout)
                output = stdout.decode("utf-8", errors="replace")
                errors = stderr.decode("utf-8", errors="replace")
                result = output + (f"\nErrors:\n{errors}" if errors else "")
                return result or "JS executed successfully"
            except asyncio.TimeoutError:
                proc.kill()
                return "⚠️ JS execution timed out"
        except Exception as e:
            return f"❌ JS error: {str(e)}"
        finally:
            try:
                os.unlink(fname)
            except Exception:
                pass
    
    def _extract_code(self, text: str, language: str = "python") -> str:
        """Extract code from markdown code blocks."""
        patterns = [
            rf"```{language}\n(.*?)```",
            r"```\n(.*?)```",
            r"`(.*?)`",
        ]
        for pattern in patterns:
            match = re.search(pattern, text, re.DOTALL)
            if match:
                return match.group(1).strip()
        return text
    
    async def execute(self, task: str, role: str, session_id: str, context: Dict = None) -> str:
        context = context or {}
        
        await self.stream_update(session_id, f"💻 Sandbox Space activated — {role} role")
        
        system_prompt = self.get_space_prompt(role, task, context)
        
        # Ask AI to generate and optionally execute code
        code_prompt = f"""{task}

If this requires code execution, generate the code and I will run it.
Format code in ```python, ```javascript, or ```bash blocks.
After the code, explain what it does."""
        
        try:
            response = await self.ai_router.complete(
                prompt=code_prompt,
                system=system_prompt,
                max_tokens=2048,
            )
            ai_response = response.get("content", "")
            
            # Try to extract and execute Python code
            code_blocks = re.findall(r'```(?:python)?\n(.*?)```', ai_response, re.DOTALL)
            
            execution_results = []
            for code in code_blocks[:2]:  # Execute max 2 code blocks
                if code.strip():
                    result = await self._run_python(code.strip())
                    execution_results.append(f"```\n{result}\n```")
            
            final = ai_response
            if execution_results:
                final += "\n\n**Execution Results:**\n" + "\n".join(execution_results)
            
            return final
            
        except Exception as e:
            log.error(f"SandboxSpace error: {e}")
            return f"Sandbox Space error: {str(e)}"
