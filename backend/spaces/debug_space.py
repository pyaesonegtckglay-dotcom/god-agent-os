"""
🐛 Debug Space — The Diagnostic Environment
Error analysis, log parsing, self-healing algorithms.
"""
import re
from typing import Dict
import structlog
from .base_space import BaseSpace

log = structlog.get_logger()

DEBUG_SYSTEM = """You are GOD AGENT OS v9 — Debug Space Expert (Repair Role).

You specialize in:
- Stack trace analysis and root cause identification
- Error pattern recognition
- Self-healing code strategies
- Log analysis and anomaly detection
- Performance profiling and optimization
- Memory leak detection
- Race condition and concurrency bug analysis
- Security vulnerability scanning
- Dependency conflict resolution
- Code smell detection

When analyzing errors:
1. Identify the root cause precisely
2. Explain WHY the error occurred
3. Provide the exact fix with code
4. Suggest preventive measures
5. Add proper error handling

Be systematic and thorough. Debug like a senior engineer.
"""


class DebugSpace(BaseSpace):
    space_name = "debug"
    space_description = "Diagnostic environment — error analysis, log parsing, self-healing."
    available_roles = ["repair", "cognition", "execution"]
    
    def __init__(self, ws_manager=None, ai_router=None):
        super().__init__(ws_manager, ai_router)
        self.register_tool("analyze_error", self._analyze_error, "Analyze error traces")
        self.register_tool("parse_logs", self._parse_logs, "Parse and analyze log files")
        self.register_tool("suggest_fix", self._suggest_fix, "Suggest code fixes")
        self.register_tool("self_heal", self._self_heal, "Auto-generate healing strategies")
    
    async def _analyze_error(self, error: str, **kwargs) -> str:
        return f"Analyzing error: {error[:100]}"
    
    async def _parse_logs(self, logs: str, **kwargs) -> str:
        # Extract error patterns
        error_lines = [l for l in logs.split('\n') if any(
            kw in l.lower() for kw in ['error', 'exception', 'fatal', 'critical', 'warn']
        )]
        return "\n".join(error_lines[:20]) if error_lines else "No errors found in logs"
    
    async def _suggest_fix(self, error: str, code: str = "", **kwargs) -> str:
        return f"Suggesting fix for: {error[:100]}"
    
    async def _self_heal(self, error: str, **kwargs) -> str:
        return f"Self-healing strategy for: {error[:100]}"
    
    def _detect_error_type(self, task: str) -> str:
        task_lower = task.lower()
        if "typeerror" in task_lower or "type error" in task_lower:
            return "TypeError"
        elif "syntaxerror" in task_lower:
            return "SyntaxError"
        elif "importerror" in task_lower or "modulenot" in task_lower:
            return "ImportError"
        elif "attributeerror" in task_lower:
            return "AttributeError"
        elif "keyerror" in task_lower:
            return "KeyError"
        elif "indexerror" in task_lower:
            return "IndexError"
        elif "valueerror" in task_lower:
            return "ValueError"
        elif "connectionerror" in task_lower or "timeout" in task_lower:
            return "NetworkError"
        elif "permissionerror" in task_lower:
            return "PermissionError"
        return "Unknown Error"
    
    async def execute(self, task: str, role: str, session_id: str, context: Dict = None) -> str:
        context = context or {}
        
        await self.stream_update(session_id, f"🐛 Debug Space activated — {role} role")
        
        error_type = self._detect_error_type(task)
        
        mem_context = ""
        if context.get("short_term_memory"):
            recent = context["short_term_memory"][-3:]
            mem_context = "\n".join([f"- {m.get('content','')[:80]}" for m in recent])
        
        enhanced_system = f"""{DEBUG_SYSTEM}

Active Role: {role.upper()}
Detected Error Type: {error_type}
Recent Context: {mem_context or 'None'}

Provide:
1. Root cause analysis
2. Step-by-step fix with code
3. Prevention strategy
4. Testing recommendation"""
        
        try:
            response = await self.ai_router.complete(
                prompt=task,
                system=enhanced_system,
                max_tokens=3000,
            )
            return response.get("content", "Debug Space could not analyze the error.")
        except Exception as e:
            log.error(f"DebugSpace error: {e}")
            return f"Debug Space error: {str(e)}"
