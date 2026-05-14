"""
CodingAgent — Autonomous code generation, editing, refactoring (Devin/Genspark style)
"""
import json
import os
import re
from typing import Dict, List
import structlog
from .base_agent import BaseAgent

log = structlog.get_logger()

CODING_SYSTEM = """You are an elite autonomous software engineer — like Devin combined with Genspark.
You write production-quality code that is:
- Clean, readable, well-structured
- Properly typed (TypeScript/Python type hints)
- Error-handled and resilient
- Documented with clear comments
- Following best practices for the language/framework

When generating code:
1. Think about the full architecture first
2. Write complete, runnable code (not snippets)
3. Include proper imports
4. Add error handling
5. Include brief usage examples in comments

Support: Python, TypeScript, JavaScript, Go, Rust, SQL, Shell, YAML, JSON
"""


class CodingAgent(BaseAgent):
    def __init__(self, ws_manager=None, ai_router=None):
        super().__init__("CodingAgent", ws_manager, ai_router)

    async def run(self, task: str, context: Dict = {}, **kwargs) -> str:
        session_id = kwargs.get("session_id", "")
        task_id = kwargs.get("task_id", "")

        await self.emit(task_id, "agent_start", {
            "agent": "CodingAgent",
            "task": task[:80],
        }, session_id)

        # Build context-aware messages
        prev_results = context.get("previous_results", [])
        project_ctx = context.get("project_context", "")
        plan = context.get("plan", "")

        system_content = CODING_SYSTEM
        if project_ctx:
            system_content += f"\n\nProject Context:\n{project_ctx[:1000]}"

        user_content = f"Task: {task}"
        if plan:
            user_content += f"\n\nExecution Plan:\n{plan[:500]}"
        if prev_results:
            user_content += f"\n\nPrevious results:\n" + "\n".join(str(r)[:200] for r in prev_results[-3:])

        messages = [
            {"role": "system", "content": system_content},
            {"role": "user", "content": user_content},
        ]

        await self.emit(task_id, "tool_called", {
            "agent": "CodingAgent",
            "tool": "code_generation",
            "step": task[:60],
        }, session_id)

        result = await self.llm(
            messages,
            task_id=task_id,
            session_id=session_id,
            temperature=0.2,
            max_tokens=8192,
        )

        # Extract code blocks for display
        code_blocks = self._extract_code_blocks(result)
        await self.emit(task_id, "code_generated", {
            "agent": "CodingAgent",
            "code_blocks": len(code_blocks),
            "total_lines": sum(len(b.split("\n")) for b in code_blocks),
            "languages": list(set(self._detect_language(b) for b in code_blocks)),
        }, session_id)

        return result

    async def generate_file(
        self,
        filename: str,
        description: str,
        task_id: str = "",
        session_id: str = "",
        context: Dict = {},
    ) -> str:
        """Generate a complete file with proper structure."""
        messages = [
            {"role": "system", "content": CODING_SYSTEM},
            {"role": "user", "content": (
                f"Generate a complete, production-ready file.\n"
                f"Filename: {filename}\n"
                f"Description: {description}\n"
                f"Context: {json.dumps(context)[:500]}\n\n"
                f"Return ONLY the file content, no explanation."
            )},
        ]
        content = await self.llm(messages, task_id=task_id, session_id=session_id, temperature=0.1, max_tokens=8192)

        # Strip markdown code fences if present
        content = self._strip_code_fences(content)

        # Write to workspace
        workspace = os.environ.get("WORKSPACE_DIR", "/tmp/god_workspace")
        filepath = os.path.join(workspace, filename)
        os.makedirs(os.path.dirname(filepath), exist_ok=True)
        with open(filepath, "w") as f:
            f.write(content)

        await self.emit(task_id, "file_written", {
            "filename": filename,
            "size": len(content),
            "lines": len(content.split("\n")),
        }, session_id)

        return content

    async def refactor(
        self,
        code: str,
        instructions: str,
        task_id: str = "",
        session_id: str = "",
    ) -> str:
        """Refactor existing code based on instructions."""
        messages = [
            {"role": "system", "content": CODING_SYSTEM},
            {"role": "user", "content": (
                f"Refactor this code based on these instructions:\n"
                f"Instructions: {instructions}\n\n"
                f"Original code:\n```\n{code}\n```\n\n"
                f"Return ONLY the refactored code."
            )},
        ]
        return await self.llm(messages, task_id=task_id, session_id=session_id, temperature=0.1, max_tokens=8192)

    async def scan_repository(self, repo_path: str) -> Dict:
        """Scan repository and build project intelligence graph."""
        import subprocess
        try:
            result = subprocess.run(
                ["find", repo_path, "-type", "f", "-name", "*.py", "-o",
                 "-name", "*.ts", "-o", "-name", "*.js", "-o", "-name", "*.go"],
                capture_output=True, text=True, timeout=10
            )
            files = result.stdout.strip().split("\n")[:50]

            # Read key files
            key_files = {}
            for f in ["package.json", "requirements.txt", "tsconfig.json", "pyproject.toml", "go.mod"]:
                path = os.path.join(repo_path, f)
                if os.path.exists(path):
                    with open(path) as fp:
                        key_files[f] = fp.read()[:1000]

            return {
                "files": files,
                "key_configs": key_files,
                "total_files": len(files),
            }
        except Exception as e:
            return {"error": str(e), "files": [], "key_configs": {}}

    def _extract_code_blocks(self, text: str) -> List[str]:
        pattern = r"```[\w]*\n(.*?)```"
        return re.findall(pattern, text, re.DOTALL)

    def _strip_code_fences(self, text: str) -> str:
        text = re.sub(r"^```[\w]*\n", "", text.strip())
        text = re.sub(r"\n```$", "", text)
        return text

    def _detect_language(self, code: str) -> str:
        if "def " in code and "import " in code:
            return "python"
        if "function " in code or "const " in code or "interface " in code:
            return "typescript"
        if "package main" in code:
            return "go"
        return "unknown"
