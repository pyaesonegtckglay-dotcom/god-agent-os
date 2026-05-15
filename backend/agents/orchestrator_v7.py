"""
God Agent Orchestrator v7 — True Autonomous Engineering OS
Manus + Genspark + Devin (OneHand) style multi-agent coordination
"""
import asyncio
import json
import time
import uuid
from typing import Any, Dict, List, Optional
import structlog

log = structlog.get_logger()

SYSTEM_PROMPT_V7 = """You are GOD AGENT v7 — the world's most advanced autonomous AI engineering operating system.

You combine the best of:
- 🧠 **Manus** — Deep reasoning, multi-step planning, autonomous decision making
- ⚡ **Genspark** — Repository engineering, code generation at scale, multi-model AI routing  
- 🤖 **Devin/OneHand** — Self-healing code execution, real browser control, file system mastery

Your specialized agent fleet (15 agents):
- **OrchestratorAgent** — Central brain, routes & coordinates all agents
- **PlannerAgent** — Breaks complex goals into executable task graphs
- **CodingAgent** — Generates production-quality code in any language
- **DebugAgent** — Autonomous error detection and self-healing
- **TestAgent** — Generates & runs comprehensive test suites
- **FileAgent** — Full file system control, project scaffolding
- **GitAgent** — Git operations, PR creation, code review
- **BrowserAgent** — Web research, scraping, web automation
- **VisionAgent** — UI/UX generation, design-to-code
- **SandboxAgent** — Code execution in isolated environments
- **DeployAgent** — Auto-deploy to Vercel, HF, Docker, AWS
- **ConnectorAgent** — External integrations (GitHub, Slack, Notion, etc.)
- **MemoryAgent** — Long-term memory and context management
- **WorkflowAgent** — n8n/automation workflow generation
- **UIAgent** — Real-time UI state updates

Operating principles:
1. PLAN before executing — always create a step-by-step plan for complex tasks
2. EXECUTE autonomously — don't ask for confirmation on obvious steps
3. SELF-HEAL — when errors occur, automatically retry with corrections
4. PARALLELIZE — run independent tasks simultaneously
5. REMEMBER — store and recall relevant context from memory

Respond in Burmese or English based on user language.
Be decisive, thorough, and production-focused.
"""


class GodAgentOrchestratorV7:
    """
    v7 Central Orchestrator — 15-agent autonomous engineering OS.
    Routes tasks, coordinates parallel execution, self-heals failures.
    """

    def __init__(self, ws_manager=None, ai_router=None):
        self.ws = ws_manager
        self.ai_router = ai_router
        self._agents: Dict[str, Any] = {}
        self._active_tasks: Dict[str, Dict] = {}
        self._task_history: List[Dict] = []

    def register_agent(self, name: str, agent):
        self._agents[name] = agent
        log.info("v7 Agent registered", agent=name)

    def get_agent(self, name: str):
        return self._agents.get(name)

    # ── Intent Classification ───────────────────────────────────────────────

    async def classify_intent_v7(self, user_message: str) -> Dict:
        """Advanced intent classification for 15-agent routing."""
        classify_prompt = f"""Classify this user request for our 15-agent autonomous engineering OS.

User message: "{user_message}"

Available agents: orchestrator, planner, coding, debug, test, file, git, browser, vision, sandbox, deploy, connector, memory, workflow, ui

Respond ONLY with valid JSON:
{{
  "primary_agent": "agent_name",
  "secondary_agents": ["agent1", "agent2"],
  "parallel_tasks": [],
  "intent": "brief description",
  "requires_planning": true/false,
  "is_code_task": true/false,
  "is_deployment": true/false,
  "is_research": true/false,
  "is_ui_task": true/false,
  "is_git_task": true/false,
  "is_test_task": true/false,
  "language": "en|my",
  "complexity": "simple|moderate|complex|ultra_complex",
  "estimated_steps": 3
}}"""

        if self.ai_router:
            messages = [
                {"role": "system", "content": "You are an intent classifier. Return only valid JSON."},
                {"role": "user", "content": classify_prompt},
            ]
            raw = await self.ai_router.complete(messages, temperature=0.1, max_tokens=400)
            try:
                start = raw.find("{")
                end = raw.rfind("}") + 1
                if start >= 0 and end > start:
                    return json.loads(raw[start:end])
            except Exception:
                pass

        # Heuristic fallback
        msg = user_message.lower()
        is_code = any(k in msg for k in ["code", "build", "create", "write", "fix", "debug", "api", "function", "class", "script", "app", "backend", "frontend"])
        is_deploy = any(k in msg for k in ["deploy", "vercel", "github", "push", "publish", "release", "hf", "hugging"])
        is_research = any(k in msg for k in ["research", "search", "find", "browse", "web", "scrape", "analyze"])
        is_ui = any(k in msg for k in ["ui", "ux", "design", "component", "dashboard", "landing", "page", "frontend"])
        is_git = any(k in msg for k in ["git", "commit", "pr", "pull request", "branch", "merge", "clone"])
        is_test = any(k in msg for k in ["test", "testing", "pytest", "jest", "coverage", "qa"])
        is_file = any(k in msg for k in ["file", "folder", "directory", "scaffold", "project structure"])
        is_workflow = any(k in msg for k in ["workflow", "n8n", "automate", "trigger", "pipeline"])
        is_memory = any(k in msg for k in ["remember", "recall", "memory", "history", "previous"])

        primary = (
            "vision" if is_ui else
            "git" if is_git else
            "test" if is_test else
            "browser" if is_research else
            "file" if is_file else
            "coding" if is_code else
            "deploy" if is_deploy else
            "workflow" if is_workflow else
            "memory" if is_memory else
            "chat"
        )

        secondary = []
        if is_code and is_deploy:
            secondary.append("deploy")
        if is_code and is_test:
            secondary.append("test")
        if is_code and is_git:
            secondary.append("git")

        return {
            "primary_agent": primary,
            "secondary_agents": secondary,
            "parallel_tasks": [],
            "intent": user_message[:80],
            "requires_planning": is_code or is_deploy or len(user_message) > 150,
            "is_code_task": is_code,
            "is_deployment": is_deploy,
            "is_research": is_research,
            "is_ui_task": is_ui,
            "is_git_task": is_git,
            "is_test_task": is_test,
            "language": "my" if any(c > "\u1000" for c in user_message) else "en",
            "complexity": "ultra_complex" if len(user_message) > 500 else ("complex" if len(user_message) > 200 else "moderate"),
            "estimated_steps": 5 if is_code else 3,
        }

    # ── Main Orchestration ─────────────────────────────────────────────────

    async def orchestrate(
        self,
        user_message: str,
        session_id: str = "",
        task_id: str = "",
        context: Dict = {},
    ) -> str:
        exec_id = task_id or f"v7_{uuid.uuid4().hex[:8]}"

        await self._emit(session_id, task_id, "orchestrator_start", {
            "message": user_message[:100],
            "version": "v7",
            "agents_available": len(self._agents),
        })

        # 1. Classify intent
        intent = await self.classify_intent_v7(user_message)
        log.info("v7 Intent classified", **{k: v for k, v in intent.items() if k != "parallel_tasks"})

        await self._emit(session_id, task_id, "intent_classified", {
            "primary_agent": intent["primary_agent"],
            "secondary_agents": intent["secondary_agents"],
            "complexity": intent["complexity"],
            "language": intent["language"],
        })

        # 2. Planning phase for complex tasks
        plan_context = {}
        if intent.get("requires_planning") and intent.get("complexity") in ("complex", "ultra_complex"):
            planner = self._agents.get("planner")
            if planner:
                await self._emit(session_id, task_id, "agent_called", {
                    "agent": "PlannerAgent", "phase": "planning"
                })
                try:
                    plan = await asyncio.wait_for(
                        planner.run(user_message, context={**context, "intent": intent},
                                    session_id=session_id, task_id=exec_id),
                        timeout=60
                    )
                    plan_context["plan"] = plan
                    await self._emit(session_id, task_id, "plan_ready", {"plan_length": len(plan)})
                except asyncio.TimeoutError:
                    log.warning("PlannerAgent timed out")

        # 3. Route to primary agent
        primary_name = intent["primary_agent"]
        primary_agent = self._agents.get(primary_name) or self._agents.get("chat")

        if not primary_agent:
            return f"Agent '{primary_name}' not available."

        await self._emit(session_id, task_id, "agent_called", {
            "agent": primary_name,
            "intent": intent["intent"],
        })

        full_context = {**context, **plan_context, "intent": intent}

        # 4. Execute primary agent
        try:
            result = await asyncio.wait_for(
                primary_agent.run(user_message, context=full_context, session_id=session_id, task_id=exec_id),
                timeout=300
            )
        except asyncio.TimeoutError:
            result = f"⚠️ Primary agent ({primary_name}) timed out. Please try a more specific request."
        except Exception as e:
            log.error("Primary agent error", agent=primary_name, error=str(e))
            result = await self.self_heal(str(e), user_message, exec_id, session_id)

        # 5. Run secondary agents in parallel
        if intent.get("secondary_agents"):
            secondary_tasks = []
            for agent_name in intent["secondary_agents"]:
                agent = self._agents.get(agent_name)
                if agent:
                    secondary_tasks.append(
                        asyncio.wait_for(
                            agent.run(user_message, context={**full_context, "primary_result": result},
                                      session_id=session_id, task_id=exec_id),
                            timeout=120
                        )
                    )
            if secondary_tasks:
                secondary_results = await asyncio.gather(*secondary_tasks, return_exceptions=True)
                valid_results = [r for r in secondary_results if isinstance(r, str) and len(r) > 10]
                if valid_results:
                    result += "\n\n---\n\n" + "\n\n".join(valid_results)

        # 6. Save to memory asynchronously
        memory_agent = self._agents.get("memory")
        if memory_agent:
            asyncio.create_task(memory_agent.save_interaction(
                user_message=user_message,
                assistant_response=result,
                session_id=session_id,
                intent=intent,
            ))

        # 7. Record in task history
        self._task_history.append({
            "id": exec_id,
            "message": user_message[:200],
            "primary_agent": primary_name,
            "result_length": len(result),
            "timestamp": time.time(),
        })
        if len(self._task_history) > 100:
            self._task_history = self._task_history[-100:]

        await self._emit(session_id, task_id, "orchestrator_complete", {
            "primary_agent": primary_name,
            "result_length": len(result),
            "version": "v7",
        })

        return result

    # ── Self-Healing ───────────────────────────────────────────────────────

    async def self_heal(self, error: str, original_task: str, task_id: str = "",
                        session_id: str = "", max_retries: int = 3) -> str:
        debug_agent = self._agents.get("debug")
        if not debug_agent:
            return f"❌ Self-heal unavailable. Error: {error}"

        for attempt in range(1, max_retries + 1):
            await self._emit(session_id, task_id, "self_heal_attempt", {
                "attempt": attempt, "max": max_retries, "error": error[:200]
            })
            try:
                fix = await asyncio.wait_for(
                    debug_agent.run(
                        f"Fix this error: {error}\n\nOriginal task: {original_task}",
                        context={"attempt": attempt, "error": error},
                        session_id=session_id, task_id=task_id,
                    ),
                    timeout=60
                )
                if fix and "❌" not in fix[:10]:
                    await self._emit(session_id, task_id, "self_heal_success", {"attempt": attempt})
                    return fix
            except Exception as e:
                log.warning("Self-heal attempt failed", attempt=attempt, error=str(e))

        return f"❌ Self-healing failed after {max_retries} attempts. Error: {error}"

    # ── Helpers ────────────────────────────────────────────────────────────

    async def _emit(self, session_id: str, task_id: str, event: str, data: Dict):
        if not self.ws:
            return
        try:
            if task_id:
                await self.ws.emit(task_id, event, data, session_id=session_id)
            if session_id:
                await self.ws.emit_chat(session_id, event, data)
        except Exception:
            pass

    def get_status(self) -> Dict:
        return {
            "version": "7.0.0",
            "agents": list(self._agents.keys()),
            "total_agents": len(self._agents),
            "active_tasks": len(self._active_tasks),
            "tasks_completed": len(self._task_history),
            "capabilities": [
                "autonomous_planning", "multi_agent_parallel",
                "self_healing", "web_browsing", "file_management",
                "git_operations", "ui_generation", "test_generation",
                "deployment", "memory", "workflow_automation"
            ],
        }
