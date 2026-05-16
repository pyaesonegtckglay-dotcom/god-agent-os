"""
GOD AGENT OS — Multi-Provider AI Router v8/v10 compatibility layer.
Primary providers: Gemini -> SambaNova -> GitHub Models.
Supports both legacy `messages=[...]` calls and newer `prompt/system` style calls.
"""

from __future__ import annotations

import os
import time
from typing import Any, Dict, List, Optional, Tuple

import httpx
import structlog

log = structlog.get_logger()

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
    def __init__(self, raw_keys: str):
        self._keys: List[Dict[str, Any]] = []
        for key in raw_keys.split(","):
            key = key.strip()
            if key:
                self._keys.append({"key": key, "fails": 0, "cooldown_until": 0.0})

    def pick(self) -> Optional[Dict[str, Any]]:
        now = time.time()
        available = [item for item in self._keys if item["cooldown_until"] < now]
        if not available:
            return None
        available.sort(key=lambda item: item["fails"])
        return available[0]

    def mark_fail(self, key_obj: Dict[str, Any]):
        key_obj["fails"] += 1
        if key_obj["fails"] >= KEY_MAX_FAILS:
            key_obj["cooldown_until"] = time.time() + KEY_COOLDOWN_SECONDS
            log.warning("key_cooled_down", key_prefix=key_obj["key"][:8])

    def mark_success(self, key_obj: Dict[str, Any]):
        key_obj["fails"] = 0
        key_obj["cooldown_until"] = 0.0

    def has_keys(self) -> bool:
        return bool(self._keys)

    def count(self) -> int:
        return len(self._keys)

    def status(self) -> List[Dict[str, Any]]:
        now = time.time()
        result = []
        for item in self._keys:
            result.append({
                "key_prefix": item["key"][:8],
                "fails": item["fails"],
                "cooldown_seconds": max(0, int(item["cooldown_until"] - now)),
                "available": item["cooldown_until"] < now,
            })
        return result


def classify_task(prompt: str = "") -> str:
    p = (prompt or "").lower()
    if any(word in p for word in ["code", "function", "implement", "build", "develop", "api", "class", "debug"]):
        return "engineering"
    if any(word in p for word in ["plan", "strategy", "workflow", "json", "automate", "pipeline"]):
        return "planning"
    if any(word in p for word in ["analyze", "reasoning", "why", "explain", "evaluate", "compare"]):
        return "reasoning"
    if any(word in p for word in ["research", "find", "search", "discover", "investigate"]):
        return "research"
    if any(word in p for word in ["write", "content", "blog", "article", "copy", "generate text", "summarize"]):
        return "content"
    if any(word in p for word in ["translate", "language", "convert"]):
        return "language"
    if any(word in p for word in ["data", "csv", "metrics", "report", "insight"]):
        return "analysis"
    return "general"


def get_provider_order(task_type: str) -> List[str]:
    ordered = sorted(PRIMARY_ORDER, key=lambda provider: 0 if task_type in PROVIDERS[provider]["priority_tasks"] else 1)
    return ordered + [provider for provider in FALLBACK_ORDER if os.environ.get(PROVIDERS[provider]["key_env"], "")]


async def call_gemini(base_url: str, key: str, messages: List[Dict[str, str]], max_tokens: int) -> Tuple[bool, str]:
    url = f"{base_url}?key={key}"
    parts = [{"text": message.get("content", "")} for message in messages if message.get("content")]
    body = {
        "contents": [{"parts": parts or [{"text": "Hello"}]}],
        "generationConfig": {"maxOutputTokens": max_tokens, "temperature": 0.7},
    }
    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            resp = await client.post(url, json=body)
            if resp.status_code == 200:
                data = resp.json()
                text = data.get("candidates", [{}])[0].get("content", {}).get("parts", [{}])[0].get("text", "")
                return True, text
            return False, f"HTTP {resp.status_code}: {resp.text[:200]}"
    except Exception as exc:
        return False, str(exc)


async def call_openai_compat(base_url: str, key: str, model: str, messages: List[Dict[str, str]], max_tokens: int) -> Tuple[bool, str]:
    url = f"{base_url}/chat/completions"
    headers = {"Authorization": f"Bearer {key}", "Content-Type": "application/json"}
    body = {"model": model, "messages": messages, "max_tokens": max_tokens, "temperature": 0.7}
    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            resp = await client.post(url, json=body, headers=headers)
            if resp.status_code == 200:
                data = resp.json()
                return True, data["choices"][0]["message"]["content"]
            return False, f"HTTP {resp.status_code}: {resp.text[:200]}"
    except Exception as exc:
        return False, str(exc)


class GodModeRouter:
    def __init__(self, ws_manager=None):
        self.ws = ws_manager
        self._pools: Dict[str, KeyPool] = {}
        self._stats: Dict[str, Dict[str, Any]] = {
            name: {"calls": 0, "errors": 0, "latency_ms": []} for name in PROVIDERS
        }
        self._load_pools()

    def _load_pools(self):
        for name, cfg in PROVIDERS.items():
            raw = os.environ.get(cfg["key_env"], "")
            if raw:
                self._pools[name] = KeyPool(raw)
                log.info("key_pool_loaded", provider=name, key_count=self._pools[name].count())

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

    def get_stats(self) -> Dict[str, Any]:
        return {
            name: {"available": name in self._pools, "calls": self._stats[name]["calls"]}
            for name in PROVIDERS
        }

    def get_pool_status(self) -> Dict[str, Any]:
        return {
            name: {
                "available": name in self._pools and self._pools[name].has_keys(),
                "keys": self._pools[name].count() if name in self._pools else 0,
                "entries": self._pools[name].status() if name in self._pools else [],
            }
            for name in PROVIDERS
        }

    def _normalize_messages(self, messages=None, prompt: str = "", system: str = "") -> Tuple[List[Dict[str, str]], bool]:
        if messages:
            return messages, False
        normalized: List[Dict[str, str]] = []
        if system:
            normalized.append({"role": "system", "content": system})
        normalized.append({"role": "user", "content": prompt or "Hello"})
        return normalized, True

    async def complete(
        self,
        messages: Optional[List[Dict[str, str]]] = None,
        task_id: str = "",
        session_id: str = "",
        temperature: float = 0.7,
        max_tokens: int = 4096,
        preferred_provider: str = "",
        stream: bool = False,
        prompt: str = "",
        system: str = "",
        preferred_model: str = "",
        **_: Any,
    ) -> Any:
        normalized_messages, return_dict = self._normalize_messages(messages=messages, prompt=prompt, system=system)
        user_msg = next((msg.get("content", "") for msg in reversed(normalized_messages) if msg.get("role") == "user"), "")
        task_type = classify_task(user_msg)

        if preferred_provider and preferred_provider in PROVIDERS:
            order = [preferred_provider] + [provider for provider in get_provider_order(task_type) if provider != preferred_provider]
        else:
            order = get_provider_order(task_type)

        log.info("routing_request", task_type=task_type, order=order[:3], task_id=task_id, session_id=session_id)
        last_error = "No providers available"

        for provider_name in order:
            if provider_name not in self._pools:
                continue

            pool = self._pools[provider_name]
            cfg = PROVIDERS[provider_name]
            model = preferred_model or cfg["default_model"]

            for _attempt in range(MAX_RETRIES_PER_KEY):
                key_obj = pool.pick()
                if key_obj is None:
                    break

                t0 = time.time()
                try:
                    if cfg["type"] == "gemini":
                        ok, text = await call_gemini(cfg["base_url"], key_obj["key"], normalized_messages, min(max_tokens, cfg["max_tokens"]))
                    else:
                        ok, text = await call_openai_compat(cfg["base_url"], key_obj["key"], model, normalized_messages, min(max_tokens, cfg["max_tokens"]))
                    elapsed = int((time.time() - t0) * 1000)

                    if ok and text.strip():
                        pool.mark_success(key_obj)
                        self._stats[provider_name]["calls"] += 1
                        self._stats[provider_name]["latency_ms"].append(elapsed)
                        payload = {"content": text, "provider": provider_name, "task_type": task_type, "latency_ms": elapsed}
                        return payload if return_dict else text

                    pool.mark_fail(key_obj)
                    last_error = text
                    self._stats[provider_name]["errors"] += 1
                    log.warning("llm_fail", provider=provider_name, error=text[:120])
                except Exception as exc:
                    pool.mark_fail(key_obj)
                    self._stats[provider_name]["errors"] += 1
                    last_error = str(exc)
                    log.error("llm_exception", provider=provider_name, error=str(exc)[:160])

        demo = await self._demo_response(normalized_messages, task_type)
        return {"content": demo, "provider": "demo", "task_type": task_type, "error": last_error} if return_dict else demo

    async def _demo_response(self, messages: List[Dict[str, str]], task_type: str) -> str:
        user_msg = next((msg.get("content", "") for msg in reversed(messages) if msg.get("role") == "user"), "Hello")
        return (
            "[GOD AGENT OS — Demo Mode]\n\n"
            f"Task type detected: {task_type}\n"
            f"Your request: '{user_msg[:160]}'\n\n"
            "Configure API keys in environment: GEMINI_KEY, SAMBANOVA_KEY, GITHUB_KEY"
        )


_router_instance: Optional[GodModeRouter] = None


def get_router(ws_manager=None) -> GodModeRouter:
    global _router_instance
    if _router_instance is None:
        _router_instance = GodModeRouter(ws_manager)
    return _router_instance


AIRouterV8 = GodModeRouter
