"""
God Agent Orchestrator — Central Brain (Manus-style)
Routes user intent → correct agent → merges results
"""

import asyncio
import json
import time
import uuid
from typing import Any, Dict, List, Optional

import structlog

log = structlog.get_logger()

SYSTEM_PROMPT = """You are GOD AGENT — an elite autonomous AI operating system combining:
- Manus-style orchestration and planning
- Devin-style autonomous coding and debugging
- Genspark-style repo engineering

You coordinate multiple specialized agents:
- ChatAgent: Conversation and clarification
- PlannerAgent: Break goals into executable task graphs
- CodingAgent: Generate, edit, refactor, fix code
- DebugAgent: Detect and auto-fix errors (self-healing)
- MemoryAgent: Persistent long-term memory
- ConnectorAgent: GitHub/HF/Vercel/n8n integrations
- DeployAgent: Automated deployments
- WorkflowAgent: n8n workflow generation
- SandboxAgent: VS Code sandbox execution

You respond in Burmese or English based on user preference.
Always think step-by-step. Be autonomous, decisive, and thorough.
"""


class GodAgentOrchestrator:
    """
    Central orchestrator — routes tasks to specialized agents,
    merges results, manages agent collaboration.
    """

    def __init__(self, ws_manager=None, ai_router=None):
        self.ws = ws_manager
        self.ai_router = ai_router
        self._agents: Dict[str, Any] = {}
        self._active_tasks: Dict[str, Dict] = {}

    def register_agent(self, name: str, agent):
        self._agents[name] = agent
        log.info("Agent registered", agent=name)

    def get_agent(self, name: str):
        return self._agents.get(name)

    # ─── Intent Classification ────────────────────────────────────────────────

    async def classify_intent(self, user_message: str) -> Dict:
        """Classify user intent to route to correct agent(s)."""
        classify_prompt = f"""Classify this user request and identify which agents are needed.

User message: "{user_message}"

Respond ONLY with JSON:
{{
  "primary_agent": "chat|planner|coding|debug|connector|deploy|workflow|sandbox|memory",
  "secondary_agents": [],
  "intent": "brief description",
  "requires_planning": true/false,
  "is_code_task": true/false,
  "is_deployment": true/false,
  "is_workflow": true/false,
  "language": "en|my",
  "complexity": "simple|moderate|complex"
}}"""

        if self.ai_router:
            messages = [
                {"role": "system", "content": "You are an intent classifier. Return only valid JSON."},
                {"role": "user", "content": classify_prompt},
            ]
            raw = await self.ai_router.complete(messages, temperature=0.1, max_tokens=300)
            try:
                start = raw.find("{")
                end = raw.rfind("}") + 1
                if start >= 0 and end > start:
                    return json.loads(raw[start:end])
            except Exception:
                pass

        # Fallback heuristic classification
        msg_lower = user_message.lower()
        is_code = any(k in msg_lower for k in ["code", "build", "create", "write", "fix", "debug", "api", "function", "class", "script", "app"])
        is_deploy = any(k in msg_lower for k in ["deploy", "vercel", "github", "push", "publish", "release"])
        is_workflow = any(k in msg_lower for k in ["workflow", "n8n", "automate", "trigger", "pipeline", "schedule"])
        is_memory = any(k in msg_lower for k in ["remember", "recall", "memory", "history", "previous"])

        primary = "coding" if is_code else ("deploy" if is_deploy else ("workflow" if is_workflow else ("memory" if is_memory else "chat")))

        return {
            "primary_agent": primary,
            "secondary_agents": [],
            "intent": user_message[:80],
            "requires_planning": is_code or is_deploy,
            "is_code_task": is_code,
            "is_deployment": is_deploy,
            "is_workflow": is_workflow,
            "language": "my" if any(c > "\u1000" for c in user_message) else "en",
            "complexity": "complex" if len(user_message) > 200 else "moderate",
        }

    # ─── Main Orchestration ───────────────────────────────────────────────────

    async def orchestrate(
        self,
        user_message: str,
        session_id: str = "",
        task_id: str = "",
        context: Dict = {},
    ) -> str:
        """Main orchestration — classify → route → execute → merge."""
        exec_id = task_id or f"orch_{uuid.uuid4().hex[:8]}"

        await self._emit(session_id, task_id, "orchestrator_start", {
            "message": user_message[:100],
            "session_id": session_id,
        })

        # 1. Classify intent
        intent = await self.classify_intent(user_message)
        log.info("Intent classified", **intent)

        await self._emit(session_id, task_id, "intent_classified", {
            "primary_agent": intent["primary_agent"],
            "complexity": intent["complexity"],
            "language": intent["language"],
        })

        # 2. Build execution plan for complex tasks
        if intent.get("requires_planning") and intent.get("complexity") == "complex":
            planner = self._agents.get("planner")
            if planner:
                await self._emit(session_id, task_id, "agent_called", {"agent": "PlannerAgent"})
                plan = await planner.run(user_message, context=context, session_id=session_id, task_id=exec_id)
                context["plan"] = plan

        # 3. Route to primary agent
        primary_name = intent["primary_agent"]
        primary_agent = self._agents.get(primary_name) or self._agents.get("chat")

        if not primary_agent:
            return f"Agent '{primary_name}' not available."

        await self._emit(session_id, task_id, "agent_called", {
            "agent": primary_name,
            "intent": intent["intent"],
        })

        # 4. Execute primary agent
        result = await primary_agent.run(
            user_message,
            context={**context, "intent": intent},
            session_id=session_id,
            task_id=exec_id,
        )

        # 5. Run secondary agents in parallel if needed
        secondary_results = []
        if intent.get("secondary_agents"):
            tasks = []
            for agent_name in intent["secondary_agents"]:
                agent = self._agents.get(agent_name)
                if agent:
                    tasks.append(agent.run(user_message, context=context, session_id=session_id, task_id=exec_id))
            if tasks:
                secondary_results = await asyncio.gather(*tasks, return_exceptions=True)

        # 6. Save to memory
        memory_agent = self._agents.get("memory")
        if memory_agent:
            asyncio.create_task(memory_agent.save_interaction(
                user_message=user_message,
                assistant_response=result,
                session_id=session_id,
                intent=intent,
            ))

        await self._emit(session_id, task_id, "orchestrator_complete", {
            "primary_agent": primary_name,
            "result_length": len(result),
        })

        return result

    # ─── Self-Healing Loop ────────────────────────────────────────────────────

    async def self_heal(
        self,
        error: str,
        original_task: str,
        task_id: str = "",
        session_id: str = "",
        max_retries: int = 3,
    ) -> str:
        """Self-healing retry loop — automatically fix errors."""
        debug_agent = self._agents.get("debug")
        if not debug_agent:
            return f"Cannot self-heal: DebugAgent not available. Error: {error}"

        for attempt in range(1, max_retries + 1):
            await self._emit(session_id, task_id, "self_heal_attempt", {
                "attempt": attempt,
                "max": max_retries,
                "error": error[:200],
            })
            fix = await debug_agent.run(
                f"Fix this error: {error}\n\nOriginal task: {original_task}",
                context={"attempt": attempt},
                session_id=session_id,
                task_id=task_id,
            )
            if fix and "❌" not in fix[:10]:
                await self._emit(session_id, task_id, "self_heal_success", {
                    "attempt": attempt,
                    "fix": fix[:200],
                })
                return fix

        return f"❌ Self-healing failed after {max_retries} attempts. Last error: {error}"

    # ─── Emit Helper ─────────────────────────────────────────────────────────

    async def _emit(self, session_id: str, task_id: str, event: str, data: Dict):
        if not self.ws:
            return
        if task_id:
            await self.ws.emit(task_id, event, data, session_id=session_id)
        if session_id:
            await self.ws.emit_chat(session_id, event, data)

    # ─── Agent Status ────────────────────────────────────────────────────────

    def get_status(self) -> Dict:
        return {
            "agents": list(self._agents.keys()),
            "active_tasks": len(self._active_tasks),
            "total_agents": len(self._agents),
        }
