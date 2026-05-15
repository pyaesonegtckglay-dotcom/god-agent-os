"""
AIRouter v8 — God Agent OS
Multi-provider AI router with KeyPool failover.
Supports: Gemini, SambaNova, OpenAI, Groq, Cerebras, OpenRouter, Anthropic
Primary LLMs: Gemini (6 keys) + SambaNova (9 keys) — fully pooled
"""

import asyncio
import json
import os
import time
from typing import Any, Dict, List, Optional

import httpx
import structlog

from ai_router.key_pool import KeyPoolRegistry

log = structlog.get_logger()

# ─── Provider Definitions ─────────────────────────────────────────────────────

PROVIDER_CONFIG = [
    # Priority 1 — SambaNova (fast, free tier)
    {
        "name": "sambanova",
        "key_env": "SAMBANOVA_API_KEYS",
        "base_url": "https://api.sambanova.ai/v1",
        "default_model": "Meta-Llama-3.3-70B-Instruct",
        "type": "openai_compat",
        "max_tokens": 4096,
        "priority": 1,
    },
    # Priority 2 — Gemini (Google AI)
    {
        "name": "gemini",
        "key_env": "GEMINI_API_KEYS",
        "base_url": "https://generativelanguage.googleapis.com",
        "default_model": "gemini-1.5-flash",
        "type": "gemini",
        "max_tokens": 8192,
        "priority": 2,
    },
    # Priority 3 — OpenAI
    {
        "name": "openai",
        "key_env": "OPENAI_API_KEY",
        "base_url": os.environ.get("OPENAI_BASE_URL", "https://api.openai.com/v1"),
        "default_model": os.environ.get("DEFAULT_MODEL", "gpt-4o"),
        "type": "openai_compat",
        "max_tokens": 4096,
        "priority": 3,
    },
    # Priority 4 — Groq
    {
        "name": "groq",
        "key_env": "GROQ_API_KEY",
        "base_url": "https://api.groq.com/openai/v1",
        "default_model": "llama-3.3-70b-versatile",
        "type": "openai_compat",
        "max_tokens": 4096,
        "priority": 4,
    },
    # Priority 5 — Cerebras
    {
        "name": "cerebras",
        "key_env": "CEREBRAS_API_KEY",
        "base_url": "https://api.cerebras.ai/v1",
        "default_model": "llama3.1-70b",
        "type": "openai_compat",
        "max_tokens": 4096,
        "priority": 5,
    },
    # Priority 6 — OpenRouter
    {
        "name": "openrouter",
        "key_env": "OPENROUTER_API_KEY",
        "base_url": "https://openrouter.ai/api/v1",
        "default_model": "meta-llama/llama-3.3-70b-instruct:free",
        "type": "openai_compat",
        "max_tokens": 4096,
        "priority": 6,
    },
    # Priority 7 — Anthropic
    {
        "name": "anthropic",
        "key_env": "ANTHROPIC_API_KEY",
        "base_url": "https://api.anthropic.com/v1",
        "default_model": "claude-3-5-sonnet-20241022",
        "type": "anthropic",
        "max_tokens": 4096,
        "priority": 7,
    },
]


class AIRouterV8:
    """
    God Agent OS v8 AI Router.
    - KeyPool-based multi-key management per provider
    - Gemini + SambaNova as primary LLMs
    - Full failover chain
    - Streaming support via WebSocket
    """

    def __init__(self, ws_manager=None):
        self.ws = ws_manager
        self._registry = KeyPoolRegistry()
        self._stats: Dict[str, Dict] = {}
        self._setup_pools()

    def _setup_pools(self):
        """Initialize key pools from environment variables."""
        for cfg in PROVIDER_CONFIG:
            env_val = os.environ.get(cfg["key_env"], "")
            if env_val:
                self._registry.register(cfg["name"], env_val)
                self._stats[cfg["name"]] = {"calls": 0, "errors": 0, "latency": []}
            elif cfg["name"] not in self._stats:
                self._stats[cfg["name"]] = {"calls": 0, "errors": 0, "latency": []}

    def _get_available_providers(self) -> List[Dict]:
        """Return providers with at least one available key, sorted by priority."""
        available = []
        for cfg in sorted(PROVIDER_CONFIG, key=lambda x: x["priority"]):
            pool = self._registry.get(cfg["name"])
            # Also check single-key env vars (for backward compat)
            env_val = os.environ.get(cfg["key_env"], "")
            if (pool and pool.available_count() > 0) or (env_val and not pool):
                # Register single keys on-the-fly if not pooled
                if not pool and env_val:
                    self._registry.register(cfg["name"], env_val)
                    if cfg["name"] not in self._stats:
                        self._stats[cfg["name"]] = {"calls": 0, "errors": 0, "latency": []}
                available.append(cfg)
        return available

    # ─── Main Entry Point ──────────────────────────────────────────────────────

    async def complete(
        self,
        messages: List[Dict],
        task_id: str = "",
        session_id: str = "",
        temperature: float = 0.7,
        max_tokens: int = 4096,
        preferred_model: str = "",
        stream: bool = True,
    ) -> str:
        """Route request through available providers with KeyPool failover."""
        providers = self._get_available_providers()

        if not providers:
            return await self._demo_stream(messages, task_id, session_id)

        last_error = None
        for cfg in providers:
            pool = self._registry.get(cfg["name"])
            if not pool:
                continue

            key = pool.pick()
            if not key:
                continue

            try:
                start = time.time()
                result = await self._call_provider(
                    cfg, key, messages, task_id, session_id,
                    temperature, max_tokens, preferred_model
                )
                elapsed = time.time() - start
                pool.mark_success(key)
                self._stats[cfg["name"]]["calls"] += 1
                self._stats[cfg["name"]]["latency"].append(elapsed)
                log.info("AIRouter v8 success", provider=cfg["name"], ms=round(elapsed * 1000))
                return result
            except Exception as e:
                last_error = e
                pool.mark_fail(key)
                self._stats[cfg["name"]]["errors"] += 1
                log.warning("AIRouter v8 failover", provider=cfg["name"], error=str(e)[:200])
                continue

        log.error("All AI providers failed", error=str(last_error))
        return await self._demo_stream(messages, task_id, session_id)

    async def _call_provider(
        self, cfg: Dict, key: str, messages: List[Dict],
        task_id: str, session_id: str, temperature: float,
        max_tokens: int, preferred_model: str
    ) -> str:
        """Dispatch to the correct call method based on provider type."""
        ptype = cfg["type"]
        if ptype == "gemini":
            return await self._gemini_call(cfg, key, messages, task_id, session_id, temperature, max_tokens, preferred_model)
        elif ptype == "anthropic":
            return await self._anthropic_call(cfg, key, messages, task_id, session_id, temperature, max_tokens)
        else:
            return await self._openai_compat_call(cfg, key, messages, task_id, session_id, temperature, max_tokens, preferred_model)

    # ─── Gemini API ────────────────────────────────────────────────────────────

    async def _gemini_call(
        self, cfg: Dict, key: str, messages: List[Dict],
        task_id: str, session_id: str, temperature: float,
        max_tokens: int, preferred_model: str
    ) -> str:
        model = preferred_model or cfg["default_model"]
        url = f"{cfg['base_url']}/v1beta/models/{model}:streamGenerateContent?key={key}&alt=sse"

        # Convert messages to Gemini format
        system_instruction = None
        contents = []
        for m in messages:
            if m["role"] == "system":
                system_instruction = {"parts": [{"text": m["content"]}]}
            else:
                role = "user" if m["role"] == "user" else "model"
                contents.append({"role": role, "parts": [{"text": m["content"]}]})

        payload: Dict[str, Any] = {
            "contents": contents,
            "generationConfig": {
                "temperature": temperature,
                "maxOutputTokens": max_tokens,
            },
        }
        if system_instruction:
            payload["systemInstruction"] = system_instruction

        full_text = ""
        async with httpx.AsyncClient(timeout=120) as client:
            async with client.stream("POST", url, json=payload, headers={"Content-Type": "application/json"}) as resp:
                resp.raise_for_status()
                async for line in resp.aiter_lines():
                    if not line.startswith("data:"):
                        continue
                    chunk_str = line[5:].strip()
                    if not chunk_str or chunk_str == "[DONE]":
                        continue
                    try:
                        data = json.loads(chunk_str)
                        for cand in data.get("candidates", []):
                            for part in cand.get("content", {}).get("parts", []):
                                delta = part.get("text", "")
                                if delta:
                                    full_text += delta
                                    await self._emit_chunk(delta, task_id, session_id)
                    except Exception:
                        pass
        return full_text

    # ─── OpenAI-compatible ─────────────────────────────────────────────────────

    async def _openai_compat_call(
        self, cfg: Dict, key: str, messages: List[Dict],
        task_id: str, session_id: str, temperature: float,
        max_tokens: int, preferred_model: str
    ) -> str:
        model = preferred_model or cfg["default_model"]
        headers = {
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json",
        }
        if cfg["name"] == "openrouter":
            headers["HTTP-Referer"] = "https://god-agent.ai"
            headers["X-Title"] = "God Agent OS"

        payload = {
            "model": model,
            "messages": messages,
            "stream": True,
            "temperature": temperature,
            "max_tokens": max_tokens,
        }
        full_text = ""
        async with httpx.AsyncClient(timeout=120) as client:
            async with client.stream(
                "POST", f"{cfg['base_url']}/chat/completions",
                headers=headers, json=payload
            ) as resp:
                resp.raise_for_status()
                async for line in resp.aiter_lines():
                    if not line.startswith("data:"):
                        continue
                    chunk = line[6:].strip()
                    if chunk == "[DONE]":
                        break
                    try:
                        data = json.loads(chunk)
                        delta = data["choices"][0]["delta"].get("content", "")
                        if delta:
                            full_text += delta
                            await self._emit_chunk(delta, task_id, session_id)
                    except Exception:
                        pass
        return full_text

    # ─── Anthropic ─────────────────────────────────────────────────────────────

    async def _anthropic_call(
        self, cfg: Dict, key: str, messages: List[Dict],
        task_id: str, session_id: str, temperature: float, max_tokens: int
    ) -> str:
        headers = {
            "x-api-key": key,
            "anthropic-version": "2023-06-01",
            "Content-Type": "application/json",
        }
        system = ""
        filtered = []
        for m in messages:
            if m["role"] == "system":
                system = m["content"]
            else:
                filtered.append(m)
        payload: Dict[str, Any] = {
            "model": cfg["default_model"],
            "max_tokens": max_tokens,
            "messages": filtered,
            "stream": True,
            "temperature": temperature,
        }
        if system:
            payload["system"] = system
        full_text = ""
        async with httpx.AsyncClient(timeout=120) as client:
            async with client.stream(
                "POST", f"{cfg['base_url']}/messages",
                headers=headers, json=payload
            ) as resp:
                resp.raise_for_status()
                async for line in resp.aiter_lines():
                    if not line.startswith("data:"):
                        continue
                    try:
                        data = json.loads(line[5:].strip())
                        if data.get("type") == "content_block_delta":
                            delta = data["delta"].get("text", "")
                            if delta:
                                full_text += delta
                                await self._emit_chunk(delta, task_id, session_id)
                    except Exception:
                        pass
        return full_text

    # ─── Demo Stream ───────────────────────────────────────────────────────────

    async def _demo_stream(self, messages: List[Dict], task_id: str, session_id: str) -> str:
        last_user = next((m["content"] for m in reversed(messages) if m["role"] == "user"), "Hello")
        response = (
            "🤖 **God Agent OS v8** (Demo Mode)\n\n"
            f"Received: *{last_user[:100]}*\n\n"
            "To enable full AI power, set API keys in environment variables:\n"
            "- `GEMINI_API_KEYS` (Google Gemini — multiple keys supported)\n"
            "- `SAMBANOVA_API_KEYS` (SambaNova — multiple keys supported)\n"
            "- `OPENAI_API_KEY`, `GROQ_API_KEY`, `ANTHROPIC_API_KEY`\n\n"
            "**Active Capabilities:**\n"
            "- ⚡ 16-agent autonomous orchestration\n"
            "- 🔑 Multi-key pool with automatic failover\n"
            "- 🧠 Persistent memory system\n"
            "- 🔌 Connector ecosystem\n"
            "- 📡 Real-time WebSocket streaming\n"
        )
        full_text = ""
        for word in response.split():
            chunk = word + " "
            full_text += chunk
            await asyncio.sleep(0.02)
            await self._emit_chunk(chunk, task_id, session_id, demo=True)
        return full_text

    # ─── Emit Helper ───────────────────────────────────────────────────────────

    async def _emit_chunk(self, chunk: str, task_id: str, session_id: str, demo: bool = False):
        if not self.ws:
            return
        payload = {"chunk": chunk, "demo": demo}
        if task_id:
            await self.ws.emit(task_id, "llm_chunk", payload, session_id=session_id)
        elif session_id:
            await self.ws.emit_chat(session_id, "llm_chunk", payload)

    # ─── Stats ─────────────────────────────────────────────────────────────────

    def get_stats(self) -> Dict:
        result = {}
        for cfg in PROVIDER_CONFIG:
            name = cfg["name"]
            s = self._stats.get(name, {"calls": 0, "errors": 0, "latency": []})
            pool = self._registry.get(name)
            lat = s["latency"][-20:]
            avg_lat = round(sum(lat) / max(len(lat), 1) * 1000, 1) if lat else 0
            result[name] = {
                "calls": s["calls"],
                "errors": s["errors"],
                "avg_latency_ms": avg_lat,
                "available": bool(os.environ.get(cfg["key_env"], "")),
                "key_count": len(pool) if pool else 0,
                "available_keys": pool.available_count() if pool else 0,
                "priority": cfg["priority"],
            }
        return result

    def get_pool_status(self) -> Dict:
        return self._registry.all_status()
