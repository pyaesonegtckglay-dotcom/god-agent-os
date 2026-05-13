---
title: Devin Agent Platform
emoji: 🤖
colorFrom: blue
colorTo: purple
sdk: docker
app_port: 7860
pinned: true
license: mit
short_description: Production-grade autonomous AI engineering platform
---

# 🤖 Devin Agent Platform v2.0

> **Manus/Devin-style Autonomous AI Engineering Platform**
> Real-time WebSocket streaming · Autonomous GitHub operations · Persistent memory

## ✨ Features

- ⚡ **Real-time WebSocket streaming** — live token-by-token LLM output
- 🗺️ **Autonomous task planning** — goal → plan → execute automatically  
- 🧠 **Persistent memory** — SQLite-backed conversation + project memory
- 🐙 **GitHub automation** — clone, commit, push, PR, issues autonomously
- 🔁 **Self-healing** — auto-retry with exponential backoff
- 📡 **SSE fallback** — Server-Sent Events for streaming compatibility
- 🌐 **REST + WebSocket API** — full-featured backend

## 🔌 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/tasks/create` | Create autonomous task |
| GET | `/api/v1/tasks/{id}` | Get task details |
| POST | `/api/v1/tasks/{id}/cancel` | Cancel task |
| POST | `/api/v1/tasks/{id}/retry` | Retry failed task |
| GET | `/api/v1/tasks/{id}/stream` | SSE task stream |
| POST | `/api/v1/chat` | Chat with agent |
| POST | `/api/v1/goal` | Submit high-level goal |
| POST | `/api/v1/plan` | Generate execution plan |
| WS | `/ws/tasks/{task_id}` | Live task WebSocket |
| WS | `/ws/logs` | Global log stream |
| WS | `/ws/chat/{session_id}` | Chat WebSocket |
| WS | `/ws/agent/status` | Agent status stream |

## 🔑 Environment Variables (HF Secrets)

```
OPENAI_API_KEY     = sk-...          (for real AI)
ANTHROPIC_API_KEY  = sk-ant-...      (alternative)
GITHUB_TOKEN       = ghp_...         (GitHub ops)
GITHUB_OWNER       = your-username   (GitHub ops)
```

## 🚀 Quick Start

Visit `/api/docs` for interactive Swagger UI.

**Demo mode** works without any API keys — set `OPENAI_API_KEY` for real AI.
