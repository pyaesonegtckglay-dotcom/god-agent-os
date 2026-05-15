# Multi-Model AI Router — GOD AGENT OS v8
# Primary: Gemini → Sambanova → GitHub Models (task-aware rotation)
from .router import AIRouter
from .router_v8 import GodModeRouter, get_router, classify_task, get_provider_order

__all__ = ["AIRouter", "GodModeRouter", "get_router", "classify_task", "get_provider_order"]
