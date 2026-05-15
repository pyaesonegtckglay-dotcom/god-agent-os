"""
DebugAgent — Autonomous error detection, self-healing, retry loops
"""
import json
import re
from typing import Dict, List
import structlog
from .base_agent import BaseAgent

log = structlog.get_logger()

DEBUG_SYSTEM = """You are an expert debugging engineer with deep knowledge of:
- Python, TypeScript, JavaScript, Go, Rust errors
- Runtime exceptions, import errors, type errors
- API errors, network failures, auth issues
- Build failures, dependency conflicts
- Database errors, query optimization

When given an error:
1. Identify the root cause precisely
2. Provide the EXACT fix (code patch or config change)
3. Explain WHY it failed
4. Suggest prevention strategies

Always return actionable fixes, not just explanations.
"""


class DebugAgent(BaseAgent):
    def __init__(self, ws_manager=None, ai_router=None):
        super().__init__("DebugAgent", ws_manager, ai_router)

    async def run(self, task: str, context: Dict = {}, **kwargs) -> str:
        session_id = kwargs.get("session_id", "")
        task_id = kwargs.get("task_id", "")
        attempt = context.get("attempt", 1)

        await self.emit(task_id, "agent_start", {
            "agent": "DebugAgent",
            "attempt": attempt,
            "error": task[:100],
        }, session_id)

        messages = [
            {"role": "system", "content": DEBUG_SYSTEM},
            {"role": "user", "content": (
                "Debug and fix this issue (attempt " + str(attempt) + "):\n\n"
                + task + "\n\n"
                "Provide:\n"
                "1. Root cause analysis\n"
                "2. Exact fix (code/config)\n"
                "3. Prevention strategy"
            )},
        ]

        result = await self.llm(
            messages,
            task_id=task_id,
            session_id=session_id,
            temperature=0.1,
            max_tokens=4096,
        )

        await self.emit(task_id, "debug_complete", {
            "agent": "DebugAgent",
            "has_fix": "```" in result or "fix" in result.lower(),
            "attempt": attempt,
        }, session_id)

        return result

    async def analyze_error(self, error_output: str, source_code: str = "", task_id: str = "", session_id: str = "") -> Dict:
        """Deep error analysis with structured output."""
        if source_code:
            source_section = "Source Code:\n```\n" + source_code[:1000] + "\n```"
        else:
            source_section = ""

        messages = [
            {"role": "system", "content": DEBUG_SYSTEM},
            {"role": "user", "content": (
                "Analyze this error and provide structured diagnosis:\n\n"
                "Error:\n" + error_output[:2000] + "\n\n"
                + source_section + "\n\n"
                "Respond with JSON:\n"
                '{"error_type": "...", "root_cause": "...", "fix": "...", "prevention": "...", "severity": "low|medium|high|critical"}'
            )},
        ]
        raw = await self.llm(messages, task_id=task_id, session_id=session_id, temperature=0.1, max_tokens=1000)
        try:
            start = raw.find("{")
            end = raw.rfind("}") + 1
            return json.loads(raw[start:end])
        except Exception:
            return {"error_type": "unknown", "root_cause": error_output[:200], "fix": raw[:500], "severity": "medium"}

    async def self_heal_loop(
        self,
        code: str,
        error: str,
        max_retries: int = 3,
        task_id: str = "",
        session_id: str = "",
    ) -> str:
        """Self-healing loop — generate fix, validate, retry."""
        current_code = code
        current_error = error

        for attempt in range(1, max_retries + 1):
            await self.emit(task_id, "self_heal_attempt", {
                "attempt": attempt,
                "max_retries": max_retries,
                "error_snippet": current_error[:100],
            }, session_id)

            messages = [
                {"role": "system", "content": DEBUG_SYSTEM},
                {"role": "user", "content": (
                    "Fix attempt " + str(attempt) + "/" + str(max_retries) + ":\n\n"
                    "Error: " + current_error + "\n\n"
                    "Code:\n```\n" + current_code[:3000] + "\n```\n\n"
                    "Return ONLY the fixed code."
                )},
            ]

            fixed = await self.llm(messages, task_id=task_id, session_id=session_id, temperature=0.1, max_tokens=8192)
            fixed = self._strip_fences(fixed)

            # Validate syntax for Python
            validation = await self._validate_python(fixed)
            if validation["valid"]:
                await self.emit(task_id, "self_heal_success", {
                    "attempt": attempt,
                    "code_lines": len(fixed.split("\n")),
                }, session_id)
                return fixed
            else:
                current_code = fixed
                current_error = validation["error"]
                log.warning("Self-heal attempt failed", attempt=attempt, error=current_error[:100])

        await self.emit(task_id, "self_heal_failed", {"attempts": max_retries}, session_id)
        return current_code  # Return best attempt

    async def _validate_python(self, code: str) -> Dict:
        """Quick Python syntax validation."""
        try:
            compile(code, "<string>", "exec")
            return {"valid": True, "error": ""}
        except SyntaxError as e:
            return {"valid": False, "error": "SyntaxError: " + str(e)}
        except Exception as e:
            return {"valid": False, "error": str(e)}

    def _strip_fences(self, text: str) -> str:
        text = re.sub(r"^```[\w]*\n", "", text.strip())
        text = re.sub(r"\n```$", "", text)
        return text
