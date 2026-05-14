"""
PlannerAgent — Breaks goals into executable task graphs (Manus-style)
"""
import json
from typing import Dict, List
import structlog
from .base_agent import BaseAgent

log = structlog.get_logger()

PLANNER_SYSTEM = """You are an elite software architect and project planner.
Break down user goals into detailed, executable task graphs.
Think like Devin/Manus — autonomous, thorough, production-minded.

Always respond with valid JSON task plans.
"""

PLANNER_PROMPT = """Break this goal into a detailed execution plan.

Goal: {goal}
Context: {context}

Respond ONLY with valid JSON:
{{
  "title": "Plan title",
  "steps": [
    {{
      "id": "step_1",
      "name": "Step name",
      "description": "Detailed description",
      "agent": "coding|debug|connector|deploy|workflow|sandbox|memory",
      "tool": "code|shell|file|github|memory|search|test|none",
      "depends_on": [],
      "estimated_seconds": 15,
      "can_parallel": false
    }}
  ],
  "estimated_duration": 120,
  "tools_needed": ["code", "shell"],
  "agents_needed": ["coding", "debug"],
  "complexity": "simple|moderate|complex"
}}"""


class PlannerAgent(BaseAgent):
    def __init__(self, ws_manager=None, ai_router=None):
        super().__init__("PlannerAgent", ws_manager, ai_router)

    async def run(self, task: str, context: Dict = {}, **kwargs) -> str:
        session_id = kwargs.get("session_id", "")
        task_id = kwargs.get("task_id", "")

        await self.emit(task_id, "agent_start", {"agent": "PlannerAgent", "goal": task[:80]}, session_id)

        ctx_str = json.dumps(context.get("memory", []))[:300] if context.get("memory") else "No prior context"
        prompt = PLANNER_PROMPT.format(goal=task, context=ctx_str)

        messages = [
            {"role": "system", "content": PLANNER_SYSTEM},
            {"role": "user", "content": prompt},
        ]

        raw = await self.llm(messages, task_id=task_id, session_id=session_id, temperature=0.2, max_tokens=2000)

        try:
            start = raw.find("{")
            end = raw.rfind("}") + 1
            if start >= 0 and end > start:
                plan = json.loads(raw[start:end])
            else:
                plan = json.loads(raw)

            await self.emit(task_id, "plan_ready", {
                "title": plan.get("title", "Execution Plan"),
                "steps": len(plan.get("steps", [])),
                "estimated_duration": plan.get("estimated_duration", 60),
                "agents_needed": plan.get("agents_needed", []),
            }, session_id)

            return json.dumps(plan)

        except Exception as e:
            log.warning("Plan parse failed", error=str(e))
            fallback = self._fallback_plan(task)
            await self.emit(task_id, "plan_ready", {"title": "Fallback Plan", "steps": len(fallback["steps"])}, session_id)
            return json.dumps(fallback)

    def _fallback_plan(self, goal: str) -> Dict:
        return {
            "title": f"Plan: {goal[:50]}",
            "steps": [
                {"id": "step_1", "name": "Analyze Requirements", "description": f"Analyze: {goal[:60]}", "agent": "coding", "tool": "none", "depends_on": [], "estimated_seconds": 10, "can_parallel": False},
                {"id": "step_2", "name": "Design Solution", "description": "Design the architecture", "agent": "coding", "tool": "code", "depends_on": ["step_1"], "estimated_seconds": 20, "can_parallel": False},
                {"id": "step_3", "name": "Implement", "description": "Write implementation code", "agent": "coding", "tool": "code", "depends_on": ["step_2"], "estimated_seconds": 30, "can_parallel": False},
                {"id": "step_4", "name": "Test & Debug", "description": "Test and fix errors", "agent": "debug", "tool": "test", "depends_on": ["step_3"], "estimated_seconds": 20, "can_parallel": False},
                {"id": "step_5", "name": "Document", "description": "Write documentation", "agent": "coding", "tool": "file", "depends_on": ["step_4"], "estimated_seconds": 10, "can_parallel": True},
            ],
            "estimated_duration": 90,
            "tools_needed": ["code", "test"],
            "agents_needed": ["coding", "debug"],
            "complexity": "moderate",
        }

    async def build_task_graph(self, plan_json: str) -> List[Dict]:
        """Build execution order respecting dependencies."""
        try:
            plan = json.loads(plan_json)
            steps = plan.get("steps", [])
            # Topological sort by dependencies
            ordered = []
            visited = set()
            
            def visit(step_id):
                if step_id in visited:
                    return
                visited.add(step_id)
                step = next((s for s in steps if s["id"] == step_id), None)
                if step:
                    for dep in step.get("depends_on", []):
                        visit(dep)
                    ordered.append(step)
            
            for step in steps:
                visit(step["id"])
            return ordered
        except Exception:
            return []
