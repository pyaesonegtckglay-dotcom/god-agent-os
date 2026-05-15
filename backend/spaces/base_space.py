"""
Base Space — Abstract interface for all Spaces in the Space-Role Architecture.
"""
from abc import ABC, abstractmethod
from typing import Any, Dict, Optional
import structlog

log = structlog.get_logger()


class BaseSpace(ABC):
    """
    Abstract base class for all Spaces.
    Each Space provides a distinct domain of interaction with specific tools.
    """
    
    space_name: str = "base"
    space_description: str = "Base Space"
    available_roles: list = ["cognition", "automation", "execution"]
    
    def __init__(self, ws_manager=None, ai_router=None):
        self.ws = ws_manager
        self.ai_router = ai_router
        self._tools: Dict[str, callable] = {}
        self._initialized = False
        log.info(f"📦 {self.__class__.__name__} Space created")
    
    def register_tool(self, name: str, func: callable, description: str = ""):
        """Register a tool in this Space."""
        self._tools[name] = {"func": func, "description": description}
    
    def get_tools(self) -> Dict[str, str]:
        return {name: info["description"] for name, info in self._tools.items()}
    
    async def execute_tool(self, tool_name: str, **kwargs) -> Any:
        """Execute a registered tool."""
        if tool_name not in self._tools:
            raise ValueError(f"Tool '{tool_name}' not found in {self.space_name} Space")
        return await self._tools[tool_name]["func"](**kwargs)
    
    def get_space_prompt(self, role: str, task: str, context: Dict) -> str:
        """Build the system prompt for this Space + Role combination."""
        role_prompts = {
            "cognition": "You are in COGNITION ROLE — analyze, plan, and think deeply.",
            "automation": "You are in AUTOMATION ROLE — execute workflows and interact with systems.",
            "execution": "You are in EXECUTION ROLE — write and run code, perform computational work.",
            "repair": "You are in REPAIR ROLE — analyze errors, find root causes, implement fixes.",
            "visual_intelligence": "You are in VISUAL INTELLIGENCE ROLE — interpret and generate visual content.",
        }
        
        mem_context = ""
        if context.get("short_term_memory"):
            recent = context["short_term_memory"][-3:]
            mem_context = "\n".join([f"- [{m['type']}]: {str(m.get('content',''))[:100]}" for m in recent])
        
        return f"""You are GOD AGENT OS v9 — General Autonomous Agent OS.

Active Space: {self.space_name.upper()} SPACE
{self.space_description}

{role_prompts.get(role, role_prompts['cognition'])}

Available Tools in this Space:
{chr(10).join([f'- {name}: {desc}' for name, desc in self.get_tools().items()])}

Recent Context:
{mem_context or 'No previous context'}

Be concise, accurate, and action-oriented. Return results directly."""
    
    @abstractmethod
    async def execute(self, task: str, role: str, session_id: str, context: Dict = None) -> str:
        """Execute a task in this Space with the given Role."""
        pass
    
    async def stream_update(self, session_id: str, message: str, space: str = None):
        """Send a streaming update to the client."""
        if self.ws:
            await self.ws.broadcast_to_room(f"chat:{session_id}", {
                "type": "space_update",
                "space": space or self.space_name,
                "message": message,
            })
    
    def get_info(self) -> Dict:
        return {
            "name": self.space_name,
            "description": self.space_description,
            "available_roles": self.available_roles,
            "tools": list(self._tools.keys()),
        }
