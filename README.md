---
title: God Agent OS v8
emoji: 🤖
colorFrom: indigo
colorTo: purple
sdk: docker
app_port: 7860
pinned: true
license: mit
short_description: Autonomous Engineering OS v8 — KeyPool Multi-API (Gemini + SambaNova)
---

# 🤖 GOD AGENT OS v8
**Autonomous Engineering Operating System**
*Manus + Genspark + Devin (OneHand) — KeyPool Multi-API Edition*

[![GitHub](https://img.shields.io/badge/GitHub-god--agent--os-blue?logo=github)](https://github.com/pyaesonegtckglay-dotcom/god-agent-os)
[![Version](https://img.shields.io/badge/version-8.0.0-indigo)](https://github.com/pyaesonegtckglay-dotcom/god-agent-os)
[![HF Space](https://img.shields.io/badge/HF%20Space-PYAE1994-orange)](https://huggingface.co/spaces/PYAE1994/autonomous-coding-system)

## 🚀 What is God Agent OS v8?

God Agent OS v8 is a fully autonomous AI engineering platform with **KeyPool Multi-API Routing**:
- **Gemini** (6 keys) — Google Gemini 1.5 Flash primary LLM
- **SambaNova** (9 keys) — Meta Llama 3.3 70B primary LLM
- **GitHub API** (9 keys) — Pooled Git operations
- **Automatic failover** across 7 providers

## 🔑 v8 KeyPool System

```
Priority Chain:
SambaNova (9 keys) → Gemini (6 keys) → OpenAI → Groq → Cerebras → OpenRouter → Anthropic

Each key pool:
- Round-robin key selection
- Failure tracking per key
- Automatic cooldown (60s after 3 failures)
- Real-time status dashboard in UI
```

## 🤖 16-Agent Fleet

| Agent | Capability | Status |
|-------|-----------|--------|
| 🧠 Orchestrator | Central brain, routes tasks | Core |
| 📋 Planner | Task decomposition & planning | Core |
| 💻 Coding | Production code generation | Core |
| 🐛 Debug | Self-healing error resolution | Core |
| 🌐 Browser | Web research & scraping | v7 |
| 📁 File | File system & project scaffold | v7 |
| 🔀 Git | Git ops & GitHub PR creation | v7 |
| 🧪 Test | Auto test generation & execution | v7 |
| 🎨 Vision | Design-to-code UI generation | v7 |
| 🖥️ Sandbox | Isolated code execution | Core |
| 🚀 Deploy | Auto-deploy to cloud | Core |
| 🔌 Connector | External integrations | Core |
| 🧠 Memory | Long-term context | Core |
| ⚙️ Workflow | n8n automation | Core |
| 🔍 Reasoning | Deep reasoning & analysis | Core |
| 🎨 UI | Real-time UI state | Core |

## 🔑 API Keys Configuration

Set these in Hugging Face Space → Settings → Variables:

| Variable | Description | Keys |
|----------|-------------|------|
| `GEMINI_API_KEYS` | Google Gemini (comma-separated) | 6 keys |
| `SAMBANOVA_API_KEYS` | SambaNova (comma-separated) | 9 keys |
| `GITHUB_API_KEYS` | GitHub API (comma-separated) | 9 keys |
| `OPENAI_API_KEY` | GPT-4o | Optional |
| `GROQ_API_KEY` | Llama 3.3 70B (Free) | Optional |
| `ANTHROPIC_API_KEY` | Claude 3.5 | Optional |

## 🌐 API Documentation

- Interactive docs: `/api/docs`
- Health check: `/health`
- AI Router stats: `/api/v1/ai/stats`
- Key pool status: `/api/v1/ai/pool-status`

## 📦 Architecture

```
god-agent-os/
├── backend/
│   ├── agents/         # 16 specialized agents
│   ├── ai_router/
│   │   ├── key_pool.py    # KeyPool multi-key manager (NEW v8)
│   │   ├── router_v8.py   # AIRouterV8 with KeyPool (NEW v8)
│   │   └── router.py      # Legacy router (retained)
│   ├── api/            # REST + WebSocket endpoints
│   ├── core/           # Task engine & models
│   ├── memory/         # SQLite persistent memory
│   ├── connectors/     # External service connectors
│   ├── main_v8.py      # v8 Entry point (NEW)
│   └── Dockerfile.hf   # HF Spaces Docker
└── frontend/           # Next.js 14 UI
    └── components/
        └── layout/
            └── AIRouterPanel.tsx  # v8 Key pool status UI (NEW)
```

## 🔄 Auto-Deploy Pipeline

GitHub Push → Build Check → HF Space Deploy + Vercel Deploy
