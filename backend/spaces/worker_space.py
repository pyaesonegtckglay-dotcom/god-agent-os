from __future__ import annotations

from typing import Any, Dict, List
import structlog

from .base_space import BaseSpace

log = structlog.get_logger()


class WorkerSpace(BaseSpace):
    available_roles = ["cognition", "automation", "execution", "repair", "visual_intelligence"]

    def __init__(self, spec: Dict[str, Any], ws_manager=None, ai_router=None):
        self.spec = spec
        self.space_name = spec["id"]
        self.space_description = spec["description"]
        self.available_roles = spec.get("roles", self.available_roles)
        super().__init__(ws_manager, ai_router)
        self._register_default_tools()

    def _register_default_tools(self):
        for responsibility in self.spec.get("responsibilities", []):
            tool_name = responsibility.lower().replace(" ", "_").replace("/", "_")
            self.register_tool(tool_name, self._generic_tool, responsibility)

    async def _generic_tool(self, **kwargs) -> str:
        return f"{self.spec['name']} executed with {kwargs}"

    def _build_specialized_prompt(self, role: str, task: str, context: Dict[str, Any]) -> str:
        responsibilities = ", ".join(self.spec.get("responsibilities", []))
        layer = self.spec.get("layer", "")
        return f"""You are {self.spec['name']} inside GOD AGENT OS v10.

Layer: {layer}
Space ID: {self.spec['id']}
Description: {self.spec['description']}
Responsibilities: {responsibilities}
Active Role: {role}

Rules:
- Stay inside this space's domain responsibilities.
- Produce concrete, production-ready output.
- When a task spans multiple domains, explain how this space contributes and what should happen next.
- Prefer structured bullets for plans, commands, patches, interfaces, contracts, and validation criteria.
- Be concise but specific.
"""

    async def execute(self, task: str, role: str, session_id: str, context: Dict = None) -> str:
        context = context or {}
        await self.stream_update(session_id, f"{self.spec['icon']} {self.spec['name']} activated — {role} role", space=self.space_name)

        if not self.ai_router:
            responsibilities = "\n".join(f"- {item}" for item in self.spec.get("responsibilities", []))
            return f"{self.spec['name']} is offline.\n\nResponsibilities:\n{responsibilities}"

        system_prompt = self._build_specialized_prompt(role, task, context)
        try:
            response = await self.ai_router.complete(prompt=task, system=system_prompt, max_tokens=2048)
            if isinstance(response, dict):
                return response.get("content", "") or f"{self.spec['name']} completed the task."
            return str(response)
        except Exception as exc:
            log.error("worker_space_execute_failed", space=self.space_name, error=str(exc))
            responsibilities = ", ".join(self.spec.get("responsibilities", []))
            return (
                f"{self.spec['name']} error: {exc}\n\n"
                f"Primary responsibilities: {responsibilities}"
            )
