---
title: God Agent OS v7
emoji: 🤖
colorFrom: indigo
colorTo: purple
sdk: docker
app_port: 7860
pinned: true
license: mit
short_description: Autonomous Engineering OS — Manus + Genspark + Devin (OneHand)
---

# 🤖 GOD AGENT OS v7
**Autonomous Engineering Operating System**
*Manus + Genspark + Devin (OneHand) — Combined*

[![GitHub](https://img.shields.io/badge/GitHub-god--agent--os-blue?logo=github)](https://github.com/pyaesonegtckglay-dotcom/god-agent-os)
[![Version](https://img.shields.io/badge/version-7.0.0-indigo)](https://github.com/pyaesonegtckglay-dotcom/god-agent-os)

## 🚀 What is God Agent OS?

God Agent OS is a fully autonomous AI engineering platform that combines:
- **Manus** — Deep reasoning, multi-step planning, autonomous orchestration
- **Genspark** — Repository-scale code generation, multi-model AI routing
- **Devin/OneHand** — Self-healing code execution, browser control, file mastery

## 🤖 16-Agent Fleet (v7 NEW!)

| Agent | Capability | Status |
|-------|-----------|--------|
| 🧠 Orchestrator | Central brain, routes tasks | Core |
| 📋 Planner | Task decomposition & planning | Core |
| 💻 Coding | Production code generation | Core |
| 🐛 Debug | Self-healing error resolution | Core |
| 🌐 **Browser** | Web research & scraping | ⭐ NEW v7 |
| 📁 **File** | File system & project scaffold | ⭐ NEW v7 |
| 🔀 **Git** | Git ops & GitHub PR creation | ⭐ NEW v7 |
| 🧪 **Test** | Auto test generation & execution | ⭐ NEW v7 |
| 🎨 **Vision** | Design-to-code UI generation | ⭐ NEW v7 |
| 🖥️ Sandbox | Isolated code execution | Core |
| 🚀 Deploy | Auto-deploy to cloud | Core |
| 🔌 Connector | External integrations | Core |
| 🧠 Memory | Long-term context | Core |
| ⚙️ Workflow | n8n automation | Core |

## 🔑 Required API Keys

Set these in Space Settings → Variables and Secrets:

| Variable | Description | Required |
|----------|-------------|----------|
| `OPENAI_API_KEY` | GPT-4o | Optional |
| `GROQ_API_KEY` | Llama 3.3 70B (Free!) | Recommended |
| `OPENROUTER_API_KEY` | 100+ models | Optional |
| `ANTHROPIC_API_KEY` | Claude 3.5 | Optional |
| `GITHUB_TOKEN` | Git operations | Optional |

> **Note:** System works in demo mode without any keys. Add at least `GROQ_API_KEY` for full AI power (it's free!).

## 🌐 API Documentation

- Interactive docs: `/api/docs`
- Health check: `/health`

## 📦 Architecture

```
god-agent-os/
├── backend/          # FastAPI backend (16 agents)
│   ├── agents/       # All 16 specialized agents
│   ├── ai_router/    # Multi-model AI router (5 providers)
│   ├── api/          # REST + WebSocket endpoints
│   ├── core/         # Task engine & models
│   ├── memory/       # SQLite persistent memory
│   └── connectors/   # External service connectors
└── frontend/         # Next.js 14 UI (deployed on Vercel)
```

## 🔄 Auto-Deploy Pipeline

GitHub Push → Build Check → HF Space Deploy + Vercel Deploy

All automatic via GitHub Actions!
