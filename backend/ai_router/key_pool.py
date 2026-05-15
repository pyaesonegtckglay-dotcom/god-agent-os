"""
KeyPool — Multi-API Key Manager with Failover & Cooldown
God Agent OS v8 — Supports Gemini, SambaNova, GitHub, OpenAI, Groq, etc.
Each provider can have multiple comma-separated keys.
"""

import asyncio
import time
from collections import defaultdict
from typing import Dict, List, Optional
import structlog

log = structlog.get_logger()

COOLDOWN_SECONDS = 60   # Key cooling time after max failures
MAX_FAILURES = 3        # Max fails before cooldown


class KeyEntry:
    def __init__(self, key: str):
        self.key = key
        self.failures = 0
        self.cooldown_until = 0.0
        self.calls = 0
        self.last_used = 0.0

    def is_available(self) -> bool:
        if self.cooldown_until > time.time():
            return False
        return True

    def mark_fail(self):
        self.failures += 1
        if self.failures >= MAX_FAILURES:
            self.cooldown_until = time.time() + COOLDOWN_SECONDS
            log.warning("Key cooldown activated", failures=self.failures)

    def mark_success(self):
        self.failures = max(0, self.failures - 1)
        self.cooldown_until = 0.0
        self.calls += 1
        self.last_used = time.time()

    def status(self) -> dict:
        remaining = max(0, self.cooldown_until - time.time())
        return {
            "key_preview": self.key[:8] + "..." + self.key[-4:] if len(self.key) > 12 else "***",
            "available": self.is_available(),
            "failures": self.failures,
            "calls": self.calls,
            "cooldown_remaining_s": round(remaining, 1),
        }


class KeyPool:
    """
    Pool of API keys for a single provider.
    Round-robins through available keys with failure tracking.
    """

    def __init__(self, provider: str, keys: List[str]):
        self.provider = provider
        self._keys: List[KeyEntry] = [KeyEntry(k.strip()) for k in keys if k.strip()]
        self._index = 0

    def __len__(self) -> int:
        return len(self._keys)

    def pick(self) -> Optional[str]:
        """Pick the next available key (round-robin, skip cooling down keys)."""
        if not self._keys:
            return None
        n = len(self._keys)
        for _ in range(n):
            entry = self._keys[self._index % n]
            self._index = (self._index + 1) % n
            if entry.is_available():
                return entry.key
        # All keys in cooldown — try the one with shortest cooldown
        soonest = min(self._keys, key=lambda e: e.cooldown_until)
        log.warning(
            "All keys in cooldown, using soonest",
            provider=self.provider,
            cooldown_remaining=round(soonest.cooldown_until - time.time(), 1),
        )
        return soonest.key

    def mark_fail(self, key: str):
        for e in self._keys:
            if e.key == key:
                e.mark_fail()
                return

    def mark_success(self, key: str):
        for e in self._keys:
            if e.key == key:
                e.mark_success()
                return

    def available_count(self) -> int:
        return sum(1 for e in self._keys if e.is_available())

    def status(self) -> dict:
        return {
            "provider": self.provider,
            "total_keys": len(self._keys),
            "available_keys": self.available_count(),
            "keys": [e.status() for e in self._keys],
        }


# ─── Global Key Pool Registry ─────────────────────────────────────────────────

class KeyPoolRegistry:
    """Central registry for all provider key pools."""

    def __init__(self):
        self._pools: Dict[str, KeyPool] = {}

    def register(self, provider: str, keys_csv: str):
        """Register comma-separated keys for a provider."""
        keys = [k.strip() for k in keys_csv.split(",") if k.strip()]
        if keys:
            self._pools[provider] = KeyPool(provider, keys)
            log.info("KeyPool registered", provider=provider, count=len(keys))

    def get(self, provider: str) -> Optional[KeyPool]:
        return self._pools.get(provider)

    def all_status(self) -> dict:
        return {name: pool.status() for name, pool in self._pools.items()}
