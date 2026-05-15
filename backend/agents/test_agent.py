"""
TestAgent v7 — Autonomous test generation, execution, and quality assurance
Like Devin's self-testing loop + Genspark's QA automation
"""
import asyncio
import json
import os
import re
from typing import Dict, List
import structlog
from .base_agent import BaseAgent

log = structlog.get_logger()

TEST_SYSTEM = """You are an elite autonomous test engineer.
You generate comprehensive tests: unit, integration, e2e, performance.
You analyze code for bugs, edge cases, and security vulnerabilities.
You write pytest (Python) and Jest/Vitest (TypeScript) tests.
Always aim for 80%+ test coverage and meaningful assertions.
"""


class TestAgent(BaseAgent):
    def __init__(self, ws_manager=None, ai_router=None):
        super().__init__("TestAgent", ws_manager, ai_router)
        self.workspace = os.environ.get("WORKSPACE_DIR", "/tmp/god_workspace")

    async def run(self, task: str, context: Dict = {}, **kwargs) -> str:
        session_id = kwargs.get("session_id", "")
        task_id = kwargs.get("task_id", "")
        await self.emit(task_id, "agent_start", {"agent": "TestAgent", "task": task[:80]}, session_id)

        t = task.lower()
        if any(k in t for k in ["generate test", "write test", "create test"]):
            return await self._generate_tests(task, context, task_id, session_id)
        if any(k in t for k in ["run test", "execute test", "pytest", "jest"]):
            return await self._run_tests(task, context, task_id, session_id)
        if any(k in t for k in ["coverage", "quality", "audit"]):
            return await self._quality_audit(task, context, task_id, session_id)
        return await self._generate_tests(task, context, task_id, session_id)

    async def _generate_tests(self, task: str, context: Dict, task_id: str, session_id: str) -> str:
        code = context.get("code", "")
        language = context.get("language", "python")
        await self.emit(task_id, "tool_called", {
            "agent": "TestAgent", "tool": "generate_tests", "step": "Generating tests"
        }, session_id)
        msgs = [
            {"role": "system", "content": TEST_SYSTEM},
            {"role": "user", "content": (
                f"Task: {task}\nLanguage: {language}\n\n"
                f"Code to test:\n{code[:3000] if code else 'Generate tests for: ' + task}\n\n"
                "Generate comprehensive tests with:\n"
                "1. Happy path tests\n2. Edge case tests\n3. Error handling tests\n"
                "4. Mocks for external dependencies\n5. Clear test descriptions"
            )},
        ]
        result = await self.llm(msgs, task_id=task_id, session_id=session_id, temperature=0.2, max_tokens=8192)
        # Save test file to workspace
        test_filename = f"test_{re.sub(r'[^a-z0-9]', '_', task.lower()[:30])}.py"
        test_path = os.path.join(self.workspace, "tests", test_filename)
        os.makedirs(os.path.dirname(test_path), exist_ok=True)
        code_blocks = re.findall(r'```(?:python|py)?\n(.*?)```', result, re.DOTALL)
        if code_blocks:
            with open(test_path, "w") as f:
                f.write(code_blocks[0])
            await self.emit(task_id, "file_written", {"path": test_path}, session_id)
        return result

    async def _run_tests(self, task: str, context: Dict, task_id: str, session_id: str) -> str:
        repo_path = context.get("repo_path", self.workspace)
        await self.emit(task_id, "tool_called", {
            "agent": "TestAgent", "tool": "run_tests", "step": "Executing tests"
        }, session_id)
        # Detect test runner
        if os.path.exists(os.path.join(repo_path, "package.json")):
            cmd = ["npm", "test", "--", "--watchAll=false"]
        else:
            cmd = ["python", "-m", "pytest", "-v", "--tb=short"]
        try:
            proc = await asyncio.create_subprocess_exec(
                *cmd, cwd=repo_path,
                stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE,
            )
            stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=120)
            output = stdout.decode() + stderr.decode()
            passed = len(re.findall(r'PASSED|✓|pass', output, re.I))
            failed = len(re.findall(r'FAILED|✗|fail', output, re.I))
            await self.emit(task_id, "tests_complete", {"passed": passed, "failed": failed}, session_id)
            return f"**Test Results:** ✅ {passed} passed | ❌ {failed} failed\n\n```\n{output[:3000]}\n```"
        except Exception as e:
            return f"❌ Test run error: {str(e)}"

    async def _quality_audit(self, task: str, context: Dict, task_id: str, session_id: str) -> str:
        code = context.get("code", "")
        msgs = [
            {"role": "system", "content": TEST_SYSTEM},
            {"role": "user", "content": (
                f"Task: {task}\n\nCode:\n{code[:3000]}\n\n"
                "Provide quality audit: coverage estimate, complexity score, bugs found, security issues, and recommendations."
            )},
        ]
        return await self.llm(msgs, task_id=task_id, session_id=session_id, temperature=0.3, max_tokens=4096)
