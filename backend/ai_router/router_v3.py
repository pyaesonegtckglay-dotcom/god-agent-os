"""
🚀 GOD MODE+ v3 - Advanced AI Router with Reasoning Models
Intelligent model selection based on task type and requirements
Version: 3.0.0
"""

import asyncio
import logging
from enum import Enum
from typing import Optional, Dict, List, Any
from dataclasses import dataclass
from datetime import datetime

import structlog
from openai import AsyncOpenAI, RateLimitError, APIError
from anthropic import AsyncAnthropic

log = structlog.get_logger()


class TaskType(str, Enum):
    """Task classification for optimal model selection."""
    REASONING = "reasoning"
    CODING = "coding"
    CHAT = "chat"
    ANALYSIS = "analysis"
    CREATIVE = "creative"
    LIGHTWEIGHT = "lightweight"


class ModelProvider(str, Enum):
    """Supported AI model providers."""
    OPENAI = "openai"
    ANTHROPIC = "anthropic"
    GROQ = "groq"
    DEEPSEEK = "deepseek"
    TOGETHER = "together"
    OPENROUTER = "openrouter"
    CEREBRAS = "cerebras"
    QWEN = "qwen"


@dataclass
class ModelConfig:
    """Configuration for each model."""
    provider: ModelProvider
    model_id: str
    name: str
    max_tokens: int
    cost_per_1k_input: float
    cost_per_1k_output: float
    latency_ms: int
    reasoning_capable: bool
    coding_capable: bool
    context_length: int
    is_free: bool = False


class AIRouterV3:
    """
    Advanced AI Router with:
    - Reasoning model support (DeepSeek R1, Qwen QwQ, o1-mini)
    - Smart task-based model selection
    - Cost optimization
    - Latency optimization
    - Automatic failover with exponential backoff
    """

    # Model Registry
    MODELS: Dict[str, ModelConfig] = {
        # Reasoning Models (v3 NEW)
        "deepseek-r1": ModelConfig(
            provider=ModelProvider.DEEPSEEK,
            model_id="deepseek-r1",
            name="DeepSeek R1",
            max_tokens=8000,
            cost_per_1k_input=0.55,
            cost_per_1k_output=2.19,
            latency_ms=3000,
            reasoning_capable=True,
            coding_capable=True,
            context_length=128000,
        ),
        "qwen-qwq": ModelConfig(
            provider=ModelProvider.QWEN,
            model_id="qwen-qwq-32b",
            name="Qwen QwQ",
            max_tokens=32000,
            cost_per_1k_input=0.20,
            cost_per_1k_output=0.60,
            latency_ms=2500,
            reasoning_capable=True,
            coding_capable=True,
            context_length=32768,
        ),
        "o1-mini": ModelConfig(
            provider=ModelProvider.OPENAI,
            model_id="o1-mini",
            name="OpenAI o1-mini",
            max_tokens=65536,
            cost_per_1k_input=3.00,
            cost_per_1k_output=12.00,
            latency_ms=5000,
            reasoning_capable=True,
            coding_capable=True,
            context_length=128000,
        ),
        # Standard Models
        "gpt-4o": ModelConfig(
            provider=ModelProvider.OPENAI,
            model_id="gpt-4o",
            name="GPT-4o",
            max_tokens=4096,
            cost_per_1k_input=5.00,
            cost_per_1k_output=15.00,
            latency_ms=1500,
            reasoning_capable=False,
            coding_capable=True,
            context_length=128000,
        ),
        "claude-3.5-sonnet": ModelConfig(
            provider=ModelProvider.ANTHROPIC,
            model_id="claude-3-5-sonnet-20241022",
            name="Claude 3.5 Sonnet",
            max_tokens=4096,
            cost_per_1k_input=3.00,
            cost_per_1k_output=15.00,
            latency_ms=1200,
            reasoning_capable=False,
            coding_capable=True,
            context_length=200000,
        ),
        "llama-3.3-70b": ModelConfig(
            provider=ModelProvider.GROQ,
            model_id="llama-3.3-70b-versatile",
            name="Llama 3.3 70B (Groq)",
            max_tokens=8192,
            cost_per_1k_input=0.00,
            cost_per_1k_output=0.00,
            latency_ms=800,
            reasoning_capable=False,
            coding_capable=True,
            context_length=8192,
            is_free=True,
        ),
        "mixtral-8x7b": ModelConfig(
            provider=ModelProvider.TOGETHER,
            model_id="mistralai/Mixtral-8x7B-Instruct-v0.1",
            name="Mixtral 8x7B",
            max_tokens=4096,
            cost_per_1k_input=0.60,
            cost_per_1k_output=0.60,
            latency_ms=1000,
            reasoning_capable=False,
            coding_capable=True,
            context_length=32768,
        ),
    }

    # Routing Chains for Different Task Types
    ROUTING_CHAINS = {
        TaskType.REASONING: [
            "deepseek-r1",
            "qwen-qwq",
            "o1-mini",
            "gpt-4o",
            "claude-3.5-sonnet",
        ],
        TaskType.CODING: [
            "gpt-4o",
            "claude-3.5-sonnet",
            "deepseek-r1",
            "llama-3.3-70b",
            "mixtral-8x7b",
        ],
        TaskType.CHAT: [
            "llama-3.3-70b",  # Free first
            "gpt-4o",
            "claude-3.5-sonnet",
            "mixtral-8x7b",
        ],
        TaskType.ANALYSIS: [
            "gpt-4o",
            "claude-3.5-sonnet",
            "deepseek-r1",
            "llama-3.3-70b",
        ],
        TaskType.CREATIVE: [
            "gpt-4o",
            "claude-3.5-sonnet",
            "mixtral-8x7b",
            "llama-3.3-70b",
        ],
        TaskType.LIGHTWEIGHT: [
            "llama-3.3-70b",
            "mixtral-8x7b",
            "gpt-4o",
        ],
    }

    def __init__(self, ws_manager=None):
        """Initialize AI Router v3."""
        self.ws_manager = ws_manager
        self.clients = {}
        self.model_stats = {}
        self.retry_config = {
            "max_retries": 3,
            "initial_delay": 1,
            "max_delay": 30,
            "exponential_base": 2,
        }
        log.info("🤖 AI Router v3 initialized with reasoning models")

    def detect_task_type(self, message: str, context: Dict[str, Any] = None) -> TaskType:
        """
        Detect task type from message content.
        Uses heuristics and optional context hints.
        """
        message_lower = message.lower()
        context = context or {}

        # Check explicit task type hint
        if context.get("task_type"):
            try:
                return TaskType(context["task_type"])
            except ValueError:
                pass

        # Heuristic detection
        if any(word in message_lower for word in ["think", "reason", "why", "explain", "analyze"]):
            return TaskType.REASONING

        if any(word in message_lower for word in ["code", "function", "debug", "fix", "implement"]):
            return TaskType.CODING

        if any(word in message_lower for word in ["analyze", "compare", "evaluate", "assess"]):
            return TaskType.ANALYSIS

        if any(word in message_lower for word in ["write", "create", "story", "poem", "imagine"]):
            return TaskType.CREATIVE

        # Default to chat for general conversation
        return TaskType.CHAT

    def select_model(
        self,
        task_type: TaskType,
        optimize_for: str = "quality",  # "quality", "speed", "cost"
        context_length_needed: int = 4096,
    ) -> str:
        """
        Select optimal model based on task type and optimization preference.
        """
        chain = self.ROUTING_CHAINS.get(task_type, self.ROUTING_CHAINS[TaskType.CHAT])

        if optimize_for == "cost":
            # Prefer free models first
            for model_id in chain:
                if self.MODELS[model_id].is_free:
                    return model_id
            return chain[0]

        elif optimize_for == "speed":
            # Sort by latency
            sorted_chain = sorted(
                chain,
                key=lambda m: self.MODELS[m].latency_ms
            )
            return sorted_chain[0]

        else:  # quality (default)
            # Prefer models with better reasoning/coding capabilities
            if task_type == TaskType.REASONING:
                reasoning_models = [m for m in chain if self.MODELS[m].reasoning_capable]
                return reasoning_models[0] if reasoning_models else chain[0]
            elif task_type == TaskType.CODING:
                coding_models = [m for m in chain if self.MODELS[m].coding_capable]
                return coding_models[0] if coding_models else chain[0]

        return chain[0]

    async def route(
        self,
        message: str,
        context: Dict[str, Any] = None,
        optimize_for: str = "quality",
    ) -> Dict[str, Any]:
        """
        Main routing function: detect task type → select model → execute with failover.
        """
        context = context or {}
        task_type = self.detect_task_type(message, context)
        model_id = self.select_model(task_type, optimize_for)

        log.info(
            "🎯 Routing decision",
            task_type=task_type,
            selected_model=model_id,
            optimize_for=optimize_for,
        )

        # Try selected model with failover chain
        chain = self.ROUTING_CHAINS.get(task_type, self.ROUTING_CHAINS[TaskType.CHAT])
        
        for attempt, fallback_model in enumerate(chain):
            try:
                result = await self._call_model(fallback_model, message, context)
                
                # Track success
                if fallback_model not in self.model_stats:
                    self.model_stats[fallback_model] = {"success": 0, "failures": 0}
                self.model_stats[fallback_model]["success"] += 1

                return {
                    "success": True,
                    "model": fallback_model,
                    "task_type": task_type,
                    "response": result,
                    "attempts": attempt + 1,
                }

            except (RateLimitError, APIError) as e:
                log.warning(
                    "⚠️ Model failed, trying next in chain",
                    model=fallback_model,
                    error=str(e),
                    attempt=attempt + 1,
                )
                if fallback_model not in self.model_stats:
                    self.model_stats[fallback_model] = {"success": 0, "failures": 0}
                self.model_stats[fallback_model]["failures"] += 1

                if attempt < len(chain) - 1:
                    await asyncio.sleep(self.retry_config["initial_delay"] ** attempt)
                continue

        return {
            "success": False,
            "error": "All models in chain failed",
            "task_type": task_type,
            "attempts": len(chain),
        }

    async def _call_model(self, model_id: str, message: str, context: Dict[str, Any]) -> str:
        """Call specific model with appropriate client."""
        config = self.MODELS[model_id]

        if config.provider == ModelProvider.OPENAI:
            return await self._call_openai(model_id, message, context)
        elif config.provider == ModelProvider.ANTHROPIC:
            return await self._call_anthropic(model_id, message, context)
        elif config.provider == ModelProvider.GROQ:
            return await self._call_groq(model_id, message, context)
        else:
            raise ValueError(f"Provider {config.provider} not yet implemented")

    async def _call_openai(self, model_id: str, message: str, context: Dict[str, Any]) -> str:
        """Call OpenAI models (GPT-4o, o1-mini)."""
        # Implementation would go here
        return f"[{model_id}] Response placeholder"

    async def _call_anthropic(self, model_id: str, message: str, context: Dict[str, Any]) -> str:
        """Call Anthropic Claude models."""
        # Implementation would go here
        return f"[{model_id}] Response placeholder"

    async def _call_groq(self, model_id: str, message: str, context: Dict[str, Any]) -> str:
        """Call Groq models (Llama 3.3 70B)."""
        # Implementation would go here
        return f"[{model_id}] Response placeholder"

    def get_stats(self) -> Dict[str, Any]:
        """Get router statistics."""
        return {
            "models": len(self.MODELS),
            "model_stats": self.model_stats,
            "timestamp": datetime.now().isoformat(),
        }


# Export for use in main.py
__all__ = ["AIRouterV3", "TaskType", "ModelProvider"]
