"""
🧠 God Agent OS v9 — Agent Kernel
The Central Nervous System of the Space-Role Architecture.
Replaces GodAgentOrchestratorV7 with a generalized, modular kernel.
"""
import asyncio
import json
import time
import uuid
from typing import Any, Dict, List, Optional
import structlog
from spaces.catalog import SPACE_CATALOG

from memory.db import save_memory, upsert_session

log = structlog.get_logger()
SPACE_IDS = [space["id"] for space in SPACE_CATALOG]

KERNEL_SYSTEM_PROMPT = f"""You are GOD AGENT OS v10 — a distributed autonomous agent operating system.

Architecture: Distributed Worker Space Paradigm
- SPACES: {', '.join(SPACE_IDS)}
- ROLES: Cognition (Thinker), Automation (Operator), Execution (Doer), Repair (Fixer), Visual Intelligence (Observer)

You are infinitely extensible. For any digital task, select the best worker space and role combination.
Prioritize god-core-space for orchestration, model-router-space for model strategy, deploy-worker-space for deployment, verification-worker-space for quality gates, and auth-gateway-space for permission concerns.
Respond in Burmese or English based on user language.
Be decisive, thorough, and production-focused.
"""

INTENT_CLASSIFICATION_PROMPT = """Classify this request for the Space-Role autonomous agent system.

User message: "{message}"

Available Spaces: god-core-space, coding-worker-space, sandbox-worker-space, terminal-worker-space, filesystem-worker-space, browser-worker-space, vision-worker-space, ui-worker-space, debug-worker-space, test-worker-space, verification-worker-space, git-worker-space, deploy-worker-space, connector-worker-space, memory-worker-space, knowledge-worker-space, workflow-worker-space, eventbus-space, observability-space, session-runtime-space, model-router-space, auth-gateway-space
Available Roles: cognition, automation, execution, repair, visual_intelligence

Respond ONLY with valid JSON:
{{
  "primary_space": "space_name",
  "secondary_spaces": ["space1", "space2"],
  "role": "role_name", 
  "intent": "brief description",
  "complexity": "low|medium|high",
  "requires_planning": true/false,
  "parallel_tasks": []
}}"""


class ContextManager:
    """Maintains task state, active Space, and current Role."""
    
    def __init__(self):
        self._contexts: Dict[str, Dict] = {}
    
    def get(self, session_id: str) -> Dict:
        if session_id not in self._contexts:
            self._contexts[session_id] = {
                "session_id": session_id,
                "active_space": "god-core-space",
                "current_role": "cognition",
                "task_history": [],
                "short_term_memory": [],
                "created_at": time.time(),
                "last_active": time.time(),
            }
        self._contexts[session_id]["last_active"] = time.time()
        return self._contexts[session_id]
    
    def update(self, session_id: str, updates: Dict):
        ctx = self.get(session_id)
        ctx.update(updates)
    
    def add_to_memory(self, session_id: str, entry: Dict):
        ctx = self.get(session_id)
        ctx["short_term_memory"].append({**entry, "timestamp": time.time()})
        # Keep only last 20 entries
        if len(ctx["short_term_memory"]) > 20:
            ctx["short_term_memory"] = ctx["short_term_memory"][-20:]
    
    def get_all_sessions(self) -> List[str]:
        return list(self._contexts.keys())


class ToolRegistry:
    """Centralized registry of all tools, categorized by Space."""
    
    def __init__(self):
        self._tools: Dict[str, Dict[str, Any]] = {}
        self._space_tools: Dict[str, List[str]] = {
            **{space_id: [] for space_id in SPACE_IDS},
        }
    
    def register(self, name: str, func, space: str, description: str):
        self._tools[name] = {"func": func, "space": space, "description": description}
        if space in self._space_tools:
            self._space_tools[space].append(name)
    
    def get_tools_for_space(self, space: str) -> List[str]:
        return self._space_tools.get(space, [])
    
    def execute(self, tool_name: str, **kwargs) -> Any:
        if tool_name not in self._tools:
            raise ValueError(f"Tool '{tool_name}' not found in registry")
        return self._tools[tool_name]["func"](**kwargs)
    
    def get_all_tools_summary(self) -> Dict:
        return {space: tools for space, tools in self._space_tools.items()}


class AgentKernel:
    """
    The OS Core — replaces GodAgentOrchestratorV7.
    Manages Space routing, Role switching, and tool orchestration.
    """
    
    def __init__(self, ws_manager=None, ai_router=None):
        self.ws = ws_manager
        self.ai_router = ai_router
        self.context_manager = ContextManager()
        self.tool_registry = ToolRegistry()
        self._spaces: Dict[str, Any] = {}
        self._active_tasks: Dict[str, Dict] = {}
        self._task_history: List[Dict] = []
        self.version = "10.0.0"
        log.info("🧠 Agent Kernel v10 initialized — Distributed Worker Space Architecture")
    
    def register_space(self, name: str, space_instance):
        """Register a Space module."""
        self._spaces[name] = space_instance
        log.info(f"📦 Space registered: {name}")
    
    def get_space(self, name: str):
        return self._spaces.get(name)
    
    def get_status(self) -> Dict:
        return {
            "version": self.version,
            "architecture": "Distributed Worker Space",
            "spaces": list(self._spaces.keys()),
            "total_spaces": len(self._spaces),
            "active_tasks": len(self._active_tasks),
            "sessions": len(self.context_manager.get_all_sessions()),
            "tools": self.tool_registry.get_all_tools_summary(),
        }
    
    async def classify_intent(self, user_message: str) -> Dict:
        """Classify intent to determine Space and Role."""
        try:
            prompt = INTENT_CLASSIFICATION_PROMPT.format(message=user_message)
            response = await self.ai_router.complete(
                prompt=prompt,
                system=KERNEL_SYSTEM_PROMPT,
                max_tokens=400,
            )
            text = response.get("content", "")
            # Extract JSON
            start = text.find("{")
            end = text.rfind("}") + 1
            if start >= 0 and end > start:
                return json.loads(text[start:end])
        except Exception as e:
            log.warning(f"Intent classification failed: {e}")
        
        # Fallback
        return {
            "primary_space": "god-core-space",
            "secondary_spaces": [],
            "role": "cognition",
            "intent": user_message,
            "complexity": "medium",
            "requires_planning": True,
            "parallel_tasks": [],
        }
    
    async def route_to_space(self, space_name: str, role: str, task: str, 
                              session_id: str, context: Dict = None) -> str:
        """Route a task to the appropriate Space with the given Role."""
        space = self._spaces.get(space_name)
        if not space:
            space = self._spaces.get("god-core-space")
        
        if not space:
            return f"Space '{space_name}' not available."
        
        return await space.execute(
            task=task,
            role=role,
            session_id=session_id,
            context=context or {},
        )
    
    async def orchestrate(self, user_message: str, session_id: str, context: Dict = None) -> str:
        """Main orchestration entry point."""
        task_id = str(uuid.uuid4())[:8]
        ctx = self.context_manager.get(session_id)
        
        # Broadcast thinking state
        if self.ws:
            await self.ws.broadcast_to_room(f"chat:{session_id}", {
                "type": "kernel_status",
                "task_id": task_id,
                "status": "analyzing",
                "message": "🧠 Agent Kernel analyzing request...",
                "timestamp": time.time(),
            })
        
        # 1. Classify intent → determine Space + Role
        intent = await self.classify_intent(user_message)
        primary_space = intent.get("primary_space", "core")
        role = intent.get("role", "cognition")
        
        # Update context
        self.context_manager.update(session_id, {
            "active_space": primary_space,
            "current_role": role,
        })
        self.context_manager.add_to_memory(session_id, {
            "type": "user_message",
            "content": user_message,
            "space": primary_space,
            "role": role,
        })

        try:
            await upsert_session(
                session_id=session_id,
                title=user_message[:80],
                metadata={"active_space": primary_space, "current_role": role},
            )
            await save_memory(
                content=user_message,
                memory_type="conversation",
                session_id=session_id,
                key="user",
                metadata={"role": "user", "space": primary_space, "agent_role": role},
            )
        except Exception as persist_error:
            log.warning(f"Session persistence warning: {persist_error}")
        
        # Broadcast space activation
        if self.ws:
            await self.ws.broadcast_to_room(f"chat:{session_id}", {
                "type": "space_activated",
                "task_id": task_id,
                "space": primary_space,
                "role": role,
                "intent": intent.get("intent", ""),
                "timestamp": time.time(),
            })
        
        # 2. Route to primary Space
        try:
            # Build memory context
            mem_context = {
                "short_term_memory": ctx["short_term_memory"][-5:],
                "intent": intent,
                **(context or {}),
            }
            
            result = await self.route_to_space(
                space_name=primary_space,
                role=role,
                task=user_message,
                session_id=session_id,
                context=mem_context,
            )
            
            # 3. Handle secondary spaces if needed
            secondary_spaces = intent.get("secondary_spaces", [])
            secondary_results = {}
            for sec_space in secondary_spaces[:2]:  # Max 2 secondary spaces
                try:
                    sec_result = await self.route_to_space(
                        space_name=sec_space,
                        role="automation",
                        task=user_message,
                        session_id=session_id,
                        context={"primary_result": result, **mem_context},
                    )
                    secondary_results[sec_space] = sec_result
                except Exception as e:
                    log.warning(f"Secondary space {sec_space} failed: {e}")
            
            # Combine results
            final_result = result
            if secondary_results:
                secondary_text = "\n\n".join([f"[{k.upper()} SPACE]\n{v}" for k, v in secondary_results.items()])
                final_result = f"{result}\n\n{secondary_text}"
            
            # Store in memory
            self.context_manager.add_to_memory(session_id, {
                "type": "assistant_response",
                "content": final_result,
                "space": primary_space,
                "role": role,
            })

            try:
                await save_memory(
                    content=final_result,
                    memory_type="conversation",
                    session_id=session_id,
                    key="assistant",
                    metadata={"role": "assistant", "space": primary_space, "agent_role": role},
                )
                await upsert_session(
                    session_id=session_id,
                    title=user_message[:80],
                    metadata={"active_space": primary_space, "current_role": role},
                )
            except Exception as persist_error:
                log.warning(f"Assistant persistence warning: {persist_error}")
            
            # Track task
            self._task_history.append({
                "task_id": task_id,
                "session_id": session_id,
                "message": user_message,
                "space": primary_space,
                "role": role,
                "result_length": len(final_result),
                "timestamp": time.time(),
            })
            
            if self.ws:
                await self.ws.broadcast_to_room(f"chat:{session_id}", {
                    "type": "chat_response",
                    "task_id": task_id,
                    "content": final_result,
                    "space": primary_space,
                    "role": role,
                    "timestamp": time.time(),
                })

            return final_result
            
        except Exception as e:
            log.error(f"Orchestration error: {e}")
            # Switch to Repair role
            error_message = f"⚠️ Error in {primary_space} Space: {str(e)}\n\nDebug Space activated. Please try again."
            if self.ws:
                await self.ws.broadcast_to_room(f"chat:{session_id}", {
                    "type": "space_activated",
                    "space": "debug",
                    "role": "repair",
                    "message": "🔧 Switching to Repair role...",
                })
                await self.ws.broadcast_to_room(f"chat:{session_id}", {
                    "type": "chat_response",
                    "task_id": task_id,
                    "content": error_message,
                    "space": "debug",
                    "role": "repair",
                    "timestamp": time.time(),
                })
            return error_message
    
    def get_agent(self, name: str):
        """Backward compatibility - get space by name."""
        return self._spaces.get(name)
