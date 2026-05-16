"""
GOD AGENT OS — Multi-Provider AI Router v10
Primary: Gemini (6 keys) → SambaNova (9 keys) → GitHub Models (9 keys)
Fallback: Groq → OpenAI → Demo
Auto-failover, round-robin KeyPool, task-type routing.
"""

from __future__ import annotations

import os
import time
from typing import Any, Dict, List, Optional, Tuple

import httpx
import structlog

log = structlog.get_logger()

# ─── Provider Definitions ─────────────────────────────────────────────────────
PROVIDERS: Dict[str, Dict[str, Any]] = {
    "gemini": {
        "name": "gemini",
        "type": "gemini",
        "base_url": "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent",
        "key_env": "GEMINI_KEY",
        "default_model": "gemini-2.0-flash",
        "max_tokens": 8192,
        "priority_tasks": ["language", "research", "content", "general", "analysis"],
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
KEY_COOLDOWN_SECONDS = 300
KEY_MAX_FAILS = 3
MAX_RETRIES_PER_KEY = 2


# ─── KeyPool ──────────────────────────────────────────────────────────────────

class KeyPool:
    """Round-robin key pool with failure tracking and cooldown."""

    def __init__(self, provider: str, raw_keys: str):
        self.provider = provider
        self._keys: List[Dict[str, Any]] = []
        for key in raw_keys.split(","):
            key = key.strip()
            if key:
                self._keys.append({
                    "key": key,
                    "fails": 0,
                    "cooldown_until": 0.0,
                    "calls": 0,
                })
        log.info("key_pool_init", provider=provider, keys=len(self._keys))

    def pick(self) -> Optional[Dict[str, Any]]:
        now = time.time()
        available = [item for item in self._keys if item["cooldown_until"] < now]
        if not available:
            # All in cooldown — return soonest
            if self._keys:
                soonest = min(self._keys, key=lambda x: x["cooldown_until"])
                log.warning("all_keys_cooldown", provider=self.provider,
                           wait_s=round(soonest["cooldown_until"] - now, 1))
                return soonest
            return None
        available.sort(key=lambda item: item["fails"])
        return available[0]

    def mark_fail(self, key_obj: Dict[str, Any]):
        key_obj["fails"] += 1
        if key_obj["fails"] >= KEY_MAX_FAILS:
            key_obj["cooldown_until"] = time.time() + KEY_COOLDOWN_SECONDS
            log.warning("key_cooled_down", provider=self.provider,
                       key_prefix=key_obj["key"][:8])

    def mark_success(self, key_obj: Dict[str, Any]):
        key_obj["fails"] = 0
        key_obj["cooldown_until"] = 0.0
        key_obj["calls"] += 1

    def has_keys(self) -> bool:
        return bool(self._keys)

    def count(self) -> int:
        return len(self._keys)

    def available_count(self) -> int:
        now = time.time()
        return sum(1 for k in self._keys if k["cooldown_until"] < now)

    def status(self) -> Dict[str, Any]:
        now = time.time()
        return {
            "provider": self.provider,
            "total_keys": len(self._keys),
            "available_keys": self.available_count(),
            "keys": [
                {
                    "key_prefix": k["key"][:8] + "...",
                    "fails": k["fails"],
                    "calls": k["calls"],
                    "available": k["cooldown_until"] < now,
                    "cooldown_s": max(0, round(k["cooldown_until"] - now, 1)),
                }
                for k in self._keys
            ],
        }


# ─── Task Classifier ──────────────────────────────────────────────────────────

def classify_task(prompt: str = "") -> str:
    p = (prompt or "").lower()
    if any(w in p for w in ["code", "function", "implement", "build", "develop", "api", "class", "debug", "script", "program"]):
        return "engineering"
    if any(w in p for w in ["plan", "strategy", "workflow", "json", "automate", "pipeline", "step", "task"]):
        return "planning"
    if any(w in p for w in ["analyze", "reasoning", "why", "explain", "evaluate", "compare", "think"]):
        return "reasoning"
    if any(w in p for w in ["research", "find", "search", "discover", "investigate", "browse", "web"]):
        return "research"
    if any(w in p for w in ["write", "content", "blog", "article", "copy", "generate text", "summarize", "essay"]):
        return "content"
    if any(w in p for w in ["translate", "language", "convert", "myanmar", "burmese"]):
        return "language"
    if any(w in p for w in ["data", "csv", "metrics", "report", "insight", "chart", "graph"]):
        return "analysis"
    return "general"


def get_provider_order(task_type: str, preferred: str = "") -> List[str]:
    ordered = sorted(
        PRIMARY_ORDER,
        key=lambda p: 0 if task_type in PROVIDERS[p]["priority_tasks"] else 1
    )
    result = ordered + [p for p in FALLBACK_ORDER if os.environ.get(PROVIDERS[p]["key_env"], "")]
    if preferred and preferred in PROVIDERS and preferred in result:
        result = [preferred] + [p for p in result if p != preferred]
    return result


# ─── API Calls ────────────────────────────────────────────────────────────────

async def call_gemini(
    base_url: str, key: str,
    messages: List[Dict[str, str]], max_tokens: int
) -> Tuple[bool, str]:
    url = f"{base_url}?key={key}"
    # Build contents from messages
    contents = []
    system_text = ""
    for msg in messages:
        role = msg.get("role", "user")
        content = msg.get("content", "")
        if role == "system":
            system_text = content
        elif role == "user":
            contents.append({"role": "user", "parts": [{"text": content}]})
        elif role == "assistant":
            contents.append({"role": "model", "parts": [{"text": content}]})

    if not contents:
        contents = [{"role": "user", "parts": [{"text": "Hello"}]}]

    body: Dict[str, Any] = {
        "contents": contents,
        "generationConfig": {
            "maxOutputTokens": min(max_tokens, 8192),
            "temperature": 0.7,
        },
    }
    if system_text:
        body["systemInstruction"] = {"parts": [{"text": system_text}]}

    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            resp = await client.post(url, json=body)
            if resp.status_code == 200:
                data = resp.json()
                candidates = data.get("candidates", [])
                if candidates:
                    text = candidates[0].get("content", {}).get("parts", [{}])[0].get("text", "")
                    if text:
                        return True, text
                return False, f"Empty response: {str(data)[:200]}"
            return False, f"HTTP {resp.status_code}: {resp.text[:300]}"
    except Exception as exc:
        return False, str(exc)


async def call_openai_compat(
    base_url: str, key: str, model: str,
    messages: List[Dict[str, str]], max_tokens: int
) -> Tuple[bool, str]:
    url = f"{base_url}/chat/completions"
    headers = {
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
    }
    body = {
        "model": model,
        "messages": messages,
        "max_tokens": max_tokens,
        "temperature": 0.7,
    }
    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            resp = await client.post(url, json=body, headers=headers)
            if resp.status_code == 200:
                data = resp.json()
                choices = data.get("choices", [])
                if choices:
                    content = choices[0].get("message", {}).get("content", "")
                    if content:
                        return True, content
                return False, f"Empty choices: {str(data)[:200]}"
            return False, f"HTTP {resp.status_code}: {resp.text[:300]}"
    except Exception as exc:
        return False, str(exc)


# ─── Main Router ──────────────────────────────────────────────────────────────

class AIRouterV10:
    """
    God Agent OS AI Router v10.
    Multi-provider routing: Gemini (6 keys) → SambaNova (9 keys) → GitHub (9 keys) → fallback.
    """

    VERSION = "10.0"

    def __init__(self, ws_manager=None):
        self.ws = ws_manager
        self._pools: Dict[str, KeyPool] = {}
        self._stats: Dict[str, Dict[str, Any]] = {
            name: {"calls": 0, "errors": 0, "latency_ms": [], "last_used": 0.0}
            for name in PROVIDERS
        }
        self._load_pools()

    def _load_pools(self):
        """Load key pools from environment variables."""
        for name, cfg in PROVIDERS.items():
            raw = os.environ.get(cfg["key_env"], "").strip()
            if raw:
                self._pools[name] = KeyPool(name, raw)
        loaded = list(self._pools.keys())
        log.info("router_v10_loaded", providers=loaded, total=len(loaded))

    def reload_pools(self):
        """Hot-reload pools (e.g., after env var update)."""
        self._pools.clear()
        self._load_pools()

    def get_stats(self) -> Dict[str, Any]:
        return {
            name: {
                "available": name in self._pools and self._pools[name].has_keys(),
                "keys": self._pools[name].count() if name in self._pools else 0,
                "calls": self._stats[name]["calls"],
                "errors": self._stats[name]["errors"],
                "avg_latency_ms": (
                    round(
                        sum(self._stats[name]["latency_ms"][-20:]) /
                        max(len(self._stats[name]["latency_ms"][-20:]), 1),
                        1,
                    )
                    if self._stats[name]["latency_ms"] else 0
                ),
            }
            for name in PROVIDERS
        }

    def get_pool_status(self) -> Dict[str, Any]:
        return {
            name: (
                self._pools[name].status()
                if name in self._pools
                else {"provider": name, "total_keys": 0, "available_keys": 0, "keys": []}
            )
            for name in PROVIDERS
        }

    def get_status(self) -> Dict[str, Any]:
        return {
            "version": self.VERSION,
            "providers": self.get_stats(),
            "primary_order": PRIMARY_ORDER,
            "fallback_order": FALLBACK_ORDER,
            "active_providers": [n for n in self._pools if self._pools[n].has_keys()],
        }

    def _normalize_messages(
        self,
        messages: Optional[List[Dict[str, str]]] = None,
        prompt: str = "",
        system: str = "",
    ) -> Tuple[List[Dict[str, str]], bool]:
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
        preferred_model: str = "",
        stream: bool = False,
        prompt: str = "",
        system: str = "",
        **_: Any,
    ) -> Any:
        normalized_messages, return_dict = self._normalize_messages(
            messages=messages, prompt=prompt, system=system
        )
        user_msg = next(
            (msg.get("content", "") for msg in reversed(normalized_messages) if msg.get("role") == "user"),
            "",
        )
        task_type = classify_task(user_msg)
        order = get_provider_order(task_type, preferred=preferred_provider)

        log.info("routing", task_type=task_type, order=order[:3], session=session_id[:8] if session_id else "")
        last_error = "No providers available — set GEMINI_KEY, SAMBANOVA_KEY, or GITHUB_KEY"

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
                        ok, text = await call_gemini(
                            cfg["base_url"], key_obj["key"],
                            normalized_messages, min(max_tokens, cfg["max_tokens"])
                        )
                    else:
                        ok, text = await call_openai_compat(
                            cfg["base_url"], key_obj["key"], model,
                            normalized_messages, min(max_tokens, cfg["max_tokens"])
                        )

                    elapsed = int((time.time() - t0) * 1000)

                    if ok and text.strip():
                        pool.mark_success(key_obj)
                        self._stats[provider_name]["calls"] += 1
                        self._stats[provider_name]["latency_ms"].append(elapsed)
                        self._stats[provider_name]["last_used"] = time.time()
                        log.info("llm_success", provider=provider_name, ms=elapsed, task_type=task_type)

                        if self.ws and (task_id or session_id):
                            await self._emit_response(text, task_id, session_id)

                        payload = {
                            "content": text,
                            "provider": provider_name,
                            "task_type": task_type,
                            "latency_ms": elapsed,
                            "model": model,
                        }
                        return payload if return_dict else text

                    pool.mark_fail(key_obj)
                    last_error = text
                    self._stats[provider_name]["errors"] += 1
                    log.warning("llm_fail", provider=provider_name, error=text[:150])

                except Exception as exc:
                    pool.mark_fail(key_obj)
                    self._stats[provider_name]["errors"] += 1
                    last_error = str(exc)
                    log.error("llm_exception", provider=provider_name, error=str(exc)[:200])

        # All failed — return demo
        demo = await self._demo_response(normalized_messages, task_type)
        log.warning("all_providers_failed", last_error=last_error[:200])
        payload = {
            "content": demo,
            "provider": "demo",
            "task_type": task_type,
            "error": last_error,
        }
        return payload if return_dict else demo

    async def _emit_response(self, text: str, task_id: str, session_id: str):
        """Emit response through WebSocket if available."""
        try:
            if task_id and hasattr(self.ws, "emit"):
                await self.ws.emit(task_id, "llm_response", {"content": text}, session_id=session_id)
            elif session_id and hasattr(self.ws, "emit_chat"):
                await self.ws.emit_chat(session_id, "llm_response", {"content": text})
        except Exception:
            pass

    async def _demo_response(self, messages: List[Dict[str, str]], task_type: str) -> str:
        user_msg = next(
            (msg.get("content", "") for msg in reversed(messages) if msg.get("role") == "user"),
            "Hello"
        )
        active = list(self._pools.keys())
        return (
            "🤖 **GOD AGENT OS v10 — Demo Mode**\n\n"
            f"Task type detected: `{task_type}`\n"
            f"Your request: *{user_msg[:200]}*\n\n"
            f"**Active providers:** {active or 'none'}\n\n"
            "**To enable real AI, set environment variables:**\n"
            "```\n"
            "GEMINI_KEY=AIza...,AIza...  (comma-separated, 6 keys)\n"
            "SAMBANOVA_KEY=uuid,...      (comma-separated, 9 keys)\n"
            "GITHUB_KEY=ghp_...,ghp_... (comma-separated, 9 keys)\n"
            "```\n\n"
            "**God Agent OS v10 Features:**\n"
            "- 🔑 Multi-key pool routing with auto-failover\n"
            "- 🧠 22 distributed worker spaces\n"
            "- 🤖 16 autonomous agents\n"
            "- 💬 Persistent chat history\n"
            "- ⚡ Real-time WebSocket streaming\n"
            "- 🌐 Manus-like UI experience\n"
        )


# ─── Singleton ────────────────────────────────────────────────────────────────

_router_instance: Optional[AIRouterV10] = None


def get_router_v10(ws_manager=None) -> AIRouterV10:
    global _router_instance
    if _router_instance is None:
        _router_instance = AIRouterV10(ws_manager)
    return _router_instance


# Alias for compatibility
AIRouterV8 = AIRouterV10
GodModeRouter = AIRouterV10
