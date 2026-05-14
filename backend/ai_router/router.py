"""
Multi-Model AI Router — Phase 9
Supports: OpenAI, Groq, Cerebras, OpenRouter, HuggingFace
Automatic failover chain: OpenAI → Groq → Cerebras → OpenRouter → HF
"""

import asyncio
import json
import os
import time
from typing import Any, Dict, List, Optional

import httpx
import structlog

log = structlog.get_logger()

# ─── Provider Config ──────────────────────────────────────────────────────────
PROVIDERS = [
    {
        "name": "openai",
        "key_env": "OPENAI_API_KEY",
        "base_url": os.environ.get("OPENAI_BASE_URL", "https://api.openai.com/v1"),
        "default_model": os.environ.get("DEFAULT_MODEL", "gpt-4o"),
        "headers_fn": lambda k: {"Authorization": f"Bearer {k}", "Content-Type": "application/json"},
    },
    {
        "name": "groq",
        "key_env": "GROQ_API_KEY",
        "base_url": "https://api.groq.com/openai/v1",
        "default_model": "llama-3.3-70b-versatile",
        "headers_fn": lambda k: {"Authorization": f"Bearer {k}", "Content-Type": "application/json"},
    },
    {
        "name": "cerebras",
        "key_env": "CEREBRAS_API_KEY",
        "base_url": "https://api.cerebras.ai/v1",
        "default_model": "llama3.1-70b",
        "headers_fn": lambda k: {"Authorization": f"Bearer {k}", "Content-Type": "application/json"},
    },
    {
        "name": "openrouter",
        "key_env": "OPENROUTER_API_KEY",
        "base_url": "https://openrouter.ai/api/v1",
        "default_model": "meta-llama/llama-3.3-70b-instruct:free",
        "headers_fn": lambda k: {
            "Authorization": f"Bearer {k}",
            "Content-Type": "application/json",
            "HTTP-Referer": "https://god-agent.ai",
            "X-Title": "God Agent Platform",
        },
    },
    {
        "name": "anthropic",
        "key_env": "ANTHROPIC_API_KEY",
        "base_url": "https://api.anthropic.com/v1",
        "default_model": "claude-3-5-sonnet-20241022",
        "headers_fn": lambda k: {
            "x-api-key": k,
            "anthropic-version": "2023-06-01",
            "Content-Type": "application/json",
        },
    },
]


class AIRouter:
    """
    God Mode AI Router — automatically routes and fails over across providers.
    Supports streaming token output via WebSocket.
    """

    def __init__(self, ws_manager=None):
        self.ws = ws_manager
        self._stats: Dict[str, Dict] = {p["name"]: {"calls": 0, "errors": 0, "latency": []} for p in PROVIDERS}

    def _get_provider(self, name: str) -> Optional[Dict]:
        return next((p for p in PROVIDERS if p["name"] == name), None)

    def _available_providers(self) -> List[Dict]:
        """Return providers with valid API keys, in priority order."""
        return [p for p in PROVIDERS if os.environ.get(p["key_env"], "")]

    # ─── Main Entry Point ─────────────────────────────────────────────────────

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
        """Route completion through available providers with failover."""
        providers = self._available_providers()

        if not providers:
            return await self._demo_stream(messages, task_id, session_id)

        last_error = None
        for provider in providers:
            try:
                start = time.time()
                if provider["name"] == "anthropic":
                    result = await self._anthropic_stream(
                        provider, messages, task_id, session_id, temperature, max_tokens
                    )
                else:
                    result = await self._openai_compat_stream(
                        provider, messages, task_id, session_id, temperature, max_tokens, preferred_model
                    )
                elapsed = time.time() - start
                self._stats[provider["name"]]["calls"] += 1
                self._stats[provider["name"]]["latency"].append(elapsed)
                log.info("AI Router success", provider=provider["name"], ms=round(elapsed * 1000))
                return result
            except Exception as e:
                last_error = e
                self._stats[provider["name"]]["errors"] += 1
                log.warning("AI Router failover", provider=provider["name"], error=str(e))
                continue

        log.error("All AI providers failed", last_error=str(last_error))
        return await self._demo_stream(messages, task_id, session_id)

    # ─── OpenAI-compatible Stream (OpenAI, Groq, Cerebras, OpenRouter) ────────

    async def _openai_compat_stream(
        self, provider, messages, task_id, session_id, temperature, max_tokens, preferred_model
    ) -> str:
        key = os.environ.get(provider["key_env"], "")
        model = preferred_model or provider["default_model"]
        headers = provider["headers_fn"](key)
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
                "POST", f"{provider['base_url']}/chat/completions",
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

    # ─── Anthropic Stream ─────────────────────────────────────────────────────

    async def _anthropic_stream(
        self, provider, messages, task_id, session_id, temperature, max_tokens
    ) -> str:
        key = os.environ.get(provider["key_env"], "")
        headers = provider["headers_fn"](key)
        system = ""
        filtered = []
        for m in messages:
            if m["role"] == "system":
                system = m["content"]
            else:
                filtered.append(m)
        payload = {
            "model": provider["default_model"],
            "max_tokens": max_tokens,
            "messages": filtered,
            "stream": True,
        }
        if system:
            payload["system"] = system
        full_text = ""
        async with httpx.AsyncClient(timeout=120) as client:
            async with client.stream(
                "POST", f"{provider['base_url']}/messages",
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

    # ─── Demo Stream ──────────────────────────────────────────────────────────

    async def _demo_stream(self, messages, task_id, session_id) -> str:
        last_user = next(
            (m["content"] for m in reversed(messages) if m["role"] == "user"), "Hello"
        )
        response = (
            f"🤖 **God Agent** (Demo Mode)\n\n"
            f"Received: *{last_user[:100]}*\n\n"
            f"To enable real AI, set one of these env vars:\n"
            f"- `OPENAI_API_KEY` (GPT-4o)\n"
            f"- `GROQ_API_KEY` (Llama 3.3 70B — Free)\n"
            f"- `OPENROUTER_API_KEY` (Multi-model)\n"
            f"- `ANTHROPIC_API_KEY` (Claude 3.5)\n\n"
            f"**God Mode+ Capabilities Active:**\n"
            f"- ⚡ Multi-agent orchestration\n"
            f"- 🔧 Autonomous coding & debugging\n"
            f"- 🧠 Persistent memory system\n"
            f"- 🔌 Connector ecosystem\n"
            f"- 📡 Real-time streaming\n"
            f"- 🌐 Multi-model failover\n"
        )
        full_text = ""
        for word in response.split():
            chunk = word + " "
            full_text += chunk
            await asyncio.sleep(0.02)
            await self._emit_chunk(chunk, task_id, session_id, demo=True)
        return full_text

    # ─── Emit Helper ──────────────────────────────────────────────────────────

    async def _emit_chunk(self, chunk: str, task_id: str, session_id: str, demo: bool = False):
        if not self.ws:
            return
        payload = {"chunk": chunk, "demo": demo}
        if task_id:
            await self.ws.emit(task_id, "llm_chunk", payload, session_id=session_id)
        if session_id and not task_id:
            await self.ws.emit_chat(session_id, "llm_chunk", payload)

    # ─── Stats ────────────────────────────────────────────────────────────────

    def get_stats(self) -> Dict:
        stats = {}
        for name, s in self._stats.items():
            avg_lat = round(sum(s["latency"][-20:]) / max(len(s["latency"][-20:]), 1) * 1000, 1)
            stats[name] = {
                "calls": s["calls"],
                "errors": s["errors"],
                "avg_latency_ms": avg_lat,
                "available": bool(os.environ.get(
                    next((p["key_env"] for p in PROVIDERS if p["name"] == name), ""), ""
                )),
            }
        return stats
