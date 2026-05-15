"""
GOD AGENT OS — Multi-Provider AI Router v8
Primary Providers (in rotation): Gemini -> Sambanova -> GitHub Models
Task-aware routing with key pool management, failover, and streaming.
"""

import asyncio
import json
import os
import time
from typing import Any, Dict, List, Optional, Tuple

import httpx
import structlog

log = structlog.get_logger()

# ─── Provider Definitions ─────────────────────────────────────────────────────

PROVIDERS = {
    "gemini": {
        "name": "gemini",
        "type": "gemini",
        "base_url": "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent",
        "key_env": "GEMINI_KEY",
        "default_model": "gemini-2.0-flash",
        "max_tokens": 8192,
        "priority_tasks": ["language", "research", "content", "general"],
    },
    "sambanova": {
        "name": "sambanova",
        "type": "openai",
        "base_url": "https://api.sambanova.ai/v1",
        "key_env": "SAMBANOVA_KEY",
        "default_model": "Meta-Llama-3.3-70B-Instruct",
        "max_tokens": 8192,
        "priority_tasks": ["reasoning", "engineering", "planning", "analysis"],
    },
    "github": {
        "name": "github",
        "type": "openai",
        "base_url": "https://models.inference.ai.azure.com",
        "key_env": "GITHUB_KEY",
        "default_model": "gpt-4o",
        "max_tokens": 4096,
        "priority_tasks": ["planning", "engineering", "general"],
    },
    "groq": {
        "name": "groq",
        "type": "openai",
        "base_url": "https://api.groq.com/openai/v1",
        "key_env": "GROQ_API_KEY",
        "default_model": "llama-3.3-70b-versatile",
        "max_tokens": 8192,
        "priority_tasks": ["general"],
    },
    "openai": {
        "name": "openai",
        "type": "openai",
        "base_url": "https://api.openai.com/v1",
        "key_env": "OPENAI_API_KEY",
        "default_model": "gpt-4o",
        "max_tokens": 4096,
        "priority_tasks": ["general"],
    },
}

PRIMARY_ORDER = ["gemini", "sambanova", "github"]
FALLBACK_ORDER = ["groq", "openai"]

MAX_RETRIES_PER_KEY = 2
KEY_COOLDOWN_SECONDS = 300
KEY_MAX_FAILS = 3


class KeyPool:
    """Manages a pool of API keys with fail tracking and cooldowns."""

    def __init__(self, raw_keys: str):
        self._keys: List[Dict] = []
        for k in raw_keys.split(","):
            k = k.strip()
            if k:
                self._keys.append({"key": k, "fails": 0, "cooldown_until": 0.0})

    def pick(self) -> Optional[Dict]:
        now = time.time()
        available = [k for k in self._keys if k["cooldown_until"] < now]
        if not available:
            return None
        available.sort(key=lambda x: x["fails"])
        return available[0]

    def mark_fail(self, key_obj: Dict):
        key_obj["fails"] += 1
        if key_obj["fails"] >= KEY_MAX_FAILS:
            key_obj["cooldown_until"] = time.time() + KEY_COOLDOWN_SECONDS
            log.warning("Key cooled down", key_prefix=key_obj["key"][:8])

    def mark_success(self, key_obj: Dict):
        key_obj["fails"] = 0
        key_obj["cooldown_until"] = 0.0

    def has_keys(self) -> bool:
        return len(self._keys) > 0

    def count(self) -> int:
        return len(self._keys)


def classify_task(prompt: str = "") -> str:
    p = prompt.lower()
    if any(w in p for w in ["code", "function", "implement", "build", "develop", "api", "class", "debug"]):
        return "engineering"
    if any(w in p for w in ["plan", "strategy", "workflow", "json", "automate", "pipeline"]):
        return "planning"
    if any(w in p for w in ["analyze", "reasoning", "why", "explain", "evaluate", "compare"]):
        return "reasoning"
    if any(w in p for w in ["research", "find", "search", "discover", "investigate"]):
        return "research"
    if any(w in p for w in ["write", "content", "blog", "article", "copy", "generate text", "summarize"]):
        return "content"
    if any(w in p for w in ["translate", "language", "convert"]):
        return "language"
    if any(w in p for w in ["data", "csv", "metrics", "report", "insight"]):
        return "analysis"
    return "general"


def get_provider_order(task_type: str) -> List[str]:
    ordered = sorted(PRIMARY_ORDER, key=lambda p: (
        0 if task_type in PROVIDERS[p]["priority_tasks"] else 1
    ))
    return ordered + [f for f in FALLBACK_ORDER if os.environ.get(PROVIDERS[f]["key_env"], "")]


async def call_gemini(base_url: str, key: str, messages: List[Dict], max_tokens: int) -> Tuple[bool, str]:
    url = f"{base_url}?key={key}"
    parts = []
    for msg in messages:
        parts.append({"text": msg.get("content", "")})
    body = {
        "contents": [{"parts": parts}],
        "generationConfig": {"maxOutputTokens": max_tokens, "temperature": 0.7},
    }
    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            resp = await client.post(url, json=body)
            if resp.status_code == 200:
                data = resp.json()
                text = data.get("candidates", [{}])[0].get("content", {}).get("parts", [{}])[0].get("text", "")
                return True, text
            else:
                return False, f"HTTP {resp.status_code}: {resp.text[:200]}"
    except Exception as e:
        return False, str(e)


async def call_openai_compat(base_url: str, key: str, model: str, messages: List[Dict], max_tokens: int) -> Tuple[bool, str]:
    url = f"{base_url}/chat/completions"
    headers = {"Authorization": f"Bearer {key}", "Content-Type": "application/json"}
    body = {"model": model, "messages": messages, "max_tokens": max_tokens, "temperature": 0.7}
    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            resp = await client.post(url, json=body, headers=headers)
            if resp.status_code == 200:
                data = resp.json()
                text = data["choices"][0]["message"]["content"]
                return True, text
            else:
                return False, f"HTTP {resp.status_code}: {resp.text[:200]}"
    except Exception as e:
        return False, str(e)


class GodModeRouter:
    """
    Task-aware multi-provider AI router.
    Primary: Gemini, Sambanova, GitHub Models
    Fallback: Groq, OpenAI
    """

    def __init__(self, ws_manager=None):
        self.ws = ws_manager
        self._pools: Dict[str, KeyPool] = {}
        self._stats: Dict[str, Dict] = {name: {"calls": 0, "errors": 0, "latency_ms": []} for name in PROVIDERS}
        self._load_pools()

    def _load_pools(self):
        for name, cfg in PROVIDERS.items():
            raw = os.environ.get(cfg["key_env"], "")
            if raw:
                self._pools[name] = KeyPool(raw)
                log.info("Key pool loaded", provider=name, key_count=self._pools[name].count())

    def reload_pools(self):
        self._pools.clear()
        self._load_pools()

    def get_status(self) -> Dict[str, Any]:
        return {
            "providers": {
                name: {
                    "available": name in self._pools and self._pools[name].has_keys(),
                    "keys": self._pools[name].count() if name in self._pools else 0,
                    "stats": self._stats.get(name, {}),
                }
                for name in PROVIDERS
            },
            "primary_order": PRIMARY_ORDER,
        }

    # Keep backwards compatibility with old AIRouter interface
    def get_stats(self) -> Dict[str, Any]:
        return {
            name: {"available": name in self._pools, "calls": self._stats[name]["calls"]}
            for name in PROVIDERS
        }

    async def complete(
        self,
        messages: List[Dict],
        task_id: str = "",
        session_id: str = "",
        temperature: float = 0.7,
        max_tokens: int = 4096,
        preferred_provider: str = "",
        stream: bool = False,
    ) -> str:
        user_msg = next((m.get("content", "") for m in reversed(messages) if m.get("role") == "user"), "")
        task_type = classify_task(user_msg)

        if preferred_provider and preferred_provider in PROVIDERS:
            order = [preferred_provider] + [p for p in get_provider_order(task_type) if p != preferred_provider]
        else:
            order = get_provider_order(task_type)

        log.info("Routing request", task_type=task_type, order=order[:3], task_id=task_id)

        last_error = "No providers available"

        for provider_name in order:
            if provider_name not in self._pools:
                continue

            pool = self._pools[provider_name]
            cfg = PROVIDERS[provider_name]

            for attempt in range(MAX_RETRIES_PER_KEY):
                key_obj = pool.pick()
                if key_obj is None:
                    break

                t0 = time.time()
                try:
                    if cfg["type"] == "gemini":
                        ok, text = await call_gemini(cfg["base_url"], key_obj["key"], messages, max_tokens)
                    else:
                        ok, text = await call_openai_compat(
                            cfg["base_url"], key_obj["key"],
                            cfg["default_model"], messages, max_tokens
                        )

                    elapsed = int((time.time() - t0) * 1000)

                    if ok and text.strip():
                        pool.mark_success(key_obj)
                        self._stats[provider_name]["calls"] += 1
                        self._stats[provider_name]["latency_ms"].append(elapsed)
                        log.info("LLM success", provider=provider_name, ms=elapsed, task_id=task_id)
                        return text
                    else:
                        pool.mark_fail(key_obj)
                        last_error = text
                        log.warning("LLM fail", provider=provider_name, error=text[:80])

                except Exception as e:
                    pool.mark_fail(key_obj)
                    last_error = str(e)
                    self._stats[provider_name]["errors"] += 1
                    log.error("LLM exception", provider=provider_name, error=str(e)[:120])

        log.error("All providers failed, using demo response", last_error=last_error)
        return await self._demo_response(messages, task_type)

    async def _demo_response(self, messages: List[Dict], task_type: str) -> str:
        user_msg = next((m.get("content", "") for m in reversed(messages) if m.get("role") == "user"), "Hello")
        return (
            f"[GOD AGENT OS — Demo Mode]\n\n"
            f"Task type detected: {task_type}\n"
            f"Your request: '{user_msg[:100]}'\n\n"
            f"Configure API keys in environment:\n"
            f"GEMINI_KEY, SAMBANOVA_KEY, GITHUB_KEY"
        )


_router_instance: Optional[GodModeRouter] = None


def get_router(ws_manager=None) -> GodModeRouter:
    global _router_instance
    if _router_instance is None:
        _router_instance = GodModeRouter(ws_manager)
    return _router_instance


# Backwards compat alias
AIRouterV8 = GodModeRouter
