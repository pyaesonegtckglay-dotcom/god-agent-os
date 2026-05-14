"""
Connector Manager — Manus-style connector ecosystem
Manages OAuth tokens, connection state, API access
"""
import json
import os
import time
from typing import Dict, List, Optional
import structlog

log = structlog.get_logger()

CONNECTORS_CONFIG = [
    {
        "id": "github",
        "name": "GitHub",
        "icon": "github",
        "color": "#24292e",
        "env_key": "GITHUB_TOKEN",
        "description": "Repos, Issues, PRs, Commits",
        "scopes": ["repo", "issues", "pull_requests"],
        "category": "code",
    },
    {
        "id": "huggingface",
        "name": "HuggingFace",
        "icon": "huggingface",
        "color": "#ff9d00",
        "env_key": "HF_TOKEN",
        "description": "Spaces, Models, Datasets",
        "scopes": ["spaces", "models"],
        "category": "ai",
    },
    {
        "id": "vercel",
        "name": "Vercel",
        "icon": "vercel",
        "color": "#000000",
        "env_key": "VERCEL_TOKEN",
        "description": "Deployments, Domains, Functions",
        "scopes": ["deployments", "projects"],
        "category": "deploy",
    },
    {
        "id": "openai",
        "name": "OpenAI",
        "icon": "openai",
        "color": "#10a37f",
        "env_key": "OPENAI_API_KEY",
        "description": "GPT-4o, Embeddings, DALL-E",
        "scopes": ["chat", "embeddings"],
        "category": "ai",
    },
    {
        "id": "groq",
        "name": "Groq",
        "icon": "groq",
        "color": "#f55036",
        "env_key": "GROQ_API_KEY",
        "description": "Llama 3.3 70B — Ultra Fast",
        "scopes": ["chat"],
        "category": "ai",
    },
    {
        "id": "cerebras",
        "name": "Cerebras",
        "icon": "cerebras",
        "color": "#7c3aed",
        "env_key": "CEREBRAS_API_KEY",
        "description": "Llama 3.1 70B — Long Context",
        "scopes": ["chat"],
        "category": "ai",
    },
    {
        "id": "openrouter",
        "name": "OpenRouter",
        "icon": "openrouter",
        "color": "#6366f1",
        "env_key": "OPENROUTER_API_KEY",
        "description": "Multi-model router, free tier",
        "scopes": ["chat"],
        "category": "ai",
    },
    {
        "id": "anthropic",
        "name": "Anthropic",
        "icon": "anthropic",
        "color": "#d4a27f",
        "env_key": "ANTHROPIC_API_KEY",
        "description": "Claude 3.5 Sonnet",
        "scopes": ["chat"],
        "category": "ai",
    },
    {
        "id": "n8n",
        "name": "n8n",
        "icon": "n8n",
        "color": "#ea4b71",
        "env_key": "N8N_URL",
        "description": "Workflow automation engine",
        "scopes": ["workflows", "executions"],
        "category": "workflow",
    },
    {
        "id": "telegram",
        "name": "Telegram",
        "icon": "telegram",
        "color": "#0088cc",
        "env_key": "TELEGRAM_BOT_TOKEN",
        "description": "Bot API, messages, webhooks",
        "scopes": ["messages", "bots"],
        "category": "messaging",
    },
    {
        "id": "discord",
        "name": "Discord",
        "icon": "discord",
        "color": "#5865f2",
        "env_key": "DISCORD_BOT_TOKEN",
        "description": "Bot, channels, webhooks",
        "scopes": ["messages", "bots"],
        "category": "messaging",
    },
    {
        "id": "slack",
        "name": "Slack",
        "icon": "slack",
        "color": "#4a154b",
        "env_key": "SLACK_BOT_TOKEN",
        "description": "Messages, channels, workflows",
        "scopes": ["messages", "channels"],
        "category": "messaging",
    },
    {
        "id": "cloudflare",
        "name": "Cloudflare",
        "icon": "cloudflare",
        "color": "#f38020",
        "env_key": "CLOUDFLARE_API_TOKEN",
        "description": "Workers, KV, Pages",
        "scopes": ["workers", "kv", "pages"],
        "category": "infra",
    },
]


class ConnectorManager:
    """Manages all platform connectors — connection state, tokens, status."""

    def __init__(self):
        self._configs = {c["id"]: c for c in CONNECTORS_CONFIG}

    def get_all(self) -> List[Dict]:
        """Get all connectors with connection status."""
        result = []
        for cfg in CONNECTORS_CONFIG:
            token = os.environ.get(cfg["env_key"], "")
            result.append({
                **cfg,
                "connected": bool(token),
                "token_preview": f"{token[:8]}..." if token else None,
            })
        return result

    def get_connected(self) -> List[Dict]:
        """Get only connected connectors."""
        return [c for c in self.get_all() if c["connected"]]

    def get_by_category(self, category: str) -> List[Dict]:
        """Get connectors by category."""
        return [c for c in self.get_all() if c["category"] == category]

    def is_connected(self, connector_id: str) -> bool:
        cfg = self._configs.get(connector_id)
        if not cfg:
            return False
        return bool(os.environ.get(cfg["env_key"], ""))

    def get_token(self, connector_id: str) -> Optional[str]:
        cfg = self._configs.get(connector_id)
        if not cfg:
            return None
        return os.environ.get(cfg["env_key"]) or None

    def set_token(self, connector_id: str, token: str):
        """Set connector token at runtime (does not persist across restarts)."""
        cfg = self._configs.get(connector_id)
        if cfg:
            os.environ[cfg["env_key"]] = token
            log.info("Connector token set", connector=connector_id)

    def get_summary(self) -> Dict:
        all_c = self.get_all()
        connected = [c for c in all_c if c["connected"]]
        by_cat = {}
        for c in all_c:
            cat = c["category"]
            if cat not in by_cat:
                by_cat[cat] = {"total": 0, "connected": 0}
            by_cat[cat]["total"] += 1
            if c["connected"]:
                by_cat[cat]["connected"] += 1
        return {
            "total": len(all_c),
            "connected": len(connected),
            "by_category": by_cat,
            "ai_ready": self.is_connected("openai") or self.is_connected("groq")
                        or self.is_connected("openrouter") or self.is_connected("anthropic")
                        or self.is_connected("cerebras"),
        }
