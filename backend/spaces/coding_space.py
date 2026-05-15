"""
🔧 Coding Space — The Development Environment
Code generation, refactoring, analysis, and manipulation.
"""
import re
from typing import Dict
import structlog
from .base_space import BaseSpace

log = structlog.get_logger()

CODING_SYSTEM = """You are GOD AGENT OS v9 — Coding Space Expert.

You excel at:
- Writing production-quality code in ANY language (Python, JS, TS, Go, Rust, Java, C++, etc.)
- Code review and refactoring
- Algorithm design and optimization
- Architecture patterns (MVC, microservices, event-driven)
- API design (REST, GraphQL, gRPC)
- Database schemas and queries
- Testing strategies (unit, integration, e2e)
- DevOps and CI/CD configurations

Always write clean, well-documented, production-ready code.
Include error handling, type hints, and comments.
"""


class CodingSpace(BaseSpace):
    space_name = "coding"
    space_description = "Development environment — code generation, refactoring, and analysis."
    available_roles = ["execution", "cognition", "automation"]
    
    def __init__(self, ws_manager=None, ai_router=None):
        super().__init__(ws_manager, ai_router)
        self.register_tool("generate_code", self._generate_code, "Generate code from requirements")
        self.register_tool("review_code", self._review_code, "Review and suggest improvements")
        self.register_tool("refactor", self._refactor, "Refactor existing code")
        self.register_tool("generate_tests", self._generate_tests, "Generate test cases")
        self.register_tool("generate_api", self._generate_api, "Generate REST API boilerplate")
    
    async def _generate_code(self, task: str, language: str = "python", **kwargs) -> str:
        return f"Generating {language} code for: {task}"
    
    async def _review_code(self, code: str, **kwargs) -> str:
        return f"Reviewing code..."
    
    async def _refactor(self, code: str, **kwargs) -> str:
        return f"Refactoring code..."
    
    async def _generate_tests(self, code: str, **kwargs) -> str:
        return f"Generating tests..."
    
    async def _generate_api(self, spec: str, **kwargs) -> str:
        return f"Generating API..."
    
    async def execute(self, task: str, role: str, session_id: str, context: Dict = None) -> str:
        context = context or {}
        
        await self.stream_update(session_id, f"🔧 Coding Space activated — {role} role")
        
        # Detect language from task
        lang_hints = {
            "python": ["python", "py", "fastapi", "django", "flask", "pandas", "numpy"],
            "typescript": ["typescript", "ts", "next.js", "nextjs", "react", "vue", "angular"],
            "javascript": ["javascript", "js", "node", "express"],
            "go": ["golang", "go lang"],
            "rust": ["rust", "cargo"],
            "java": ["java", "spring", "maven"],
        }
        
        detected_lang = "python"
        task_lower = task.lower()
        for lang, hints in lang_hints.items():
            if any(h in task_lower for h in hints):
                detected_lang = lang
                break
        
        mem_context = ""
        if context.get("short_term_memory"):
            recent = context["short_term_memory"][-3:]
            mem_context = "\n".join([f"- {m.get('content','')[:80]}" for m in recent])
        
        enhanced_system = f"""{CODING_SYSTEM}

Active Role: {role.upper()}
Detected Language: {detected_lang}
Recent Context: {mem_context or 'None'}

Format all code in proper markdown code blocks with language tags.
Include:
1. The complete, working code
2. Brief explanation
3. Usage examples
4. Any important notes"""
        
        try:
            response = await self.ai_router.complete(
                prompt=task,
                system=enhanced_system,
                max_tokens=4096,
            )
            return response.get("content", "Coding Space could not generate code.")
        except Exception as e:
            log.error(f"CodingSpace error: {e}")
            return f"Coding Space error: {str(e)}"
