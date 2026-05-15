# 🤖 GOD AGENT OS v7 — Autonomous Engineering Platform
> **Manus + Genspark + Devin (OneHand)** Combined

## Overview
GOD AGENT OS v7 is a production-grade autonomous AI engineering operating system with 16 specialized agents working in parallel.

## 🚀 Quick Start (HuggingFace Space)
Set environment variables in HF Space secrets:
```
OPENAI_API_KEY=sk-...        # or any below
GROQ_API_KEY=gsk_...         # Free Llama 3.3 70B
OPENROUTER_API_KEY=sk-or-... # Multi-model
ANTHROPIC_API_KEY=sk-ant-... # Claude 3.5
GITHUB_TOKEN=ghp_...         # Git operations
WORKSPACE_DIR=/tmp/god_workspace
```

## 🤖 16-Agent Fleet
| Agent | Role |
|-------|------|
| OrchestratorV7 | Central brain, routes & coordinates |
| PlannerAgent | Task graph decomposition |
| CodingAgent | Production code generation |
| DebugAgent | Self-healing error resolution |
| **BrowserAgent** ⭐ | Web research & scraping |
| **FileAgent** ⭐ | File system & project scaffolding |
| **GitAgent** ⭐ | Git operations & PR creation |
| **TestAgent** ⭐ | Test generation & execution |
| **VisionAgent** ⭐ | Design-to-code UI generation |
| SandboxAgent | Isolated code execution |
| DeployAgent | Auto-deploy to cloud platforms |
| ConnectorAgent | External integrations |
| MemoryAgent | Long-term context |
| WorkflowAgent | n8n automation |
| UIAgent | Real-time UI state |
| ReasoningAgent | Deep reasoning chains |

## API Endpoints
- `GET /` — System status
- `GET /api/docs` — Interactive API docs
- `POST /api/v1/chat/stream` — Chat with God Agent
- `POST /api/v1/tasks` — Create autonomous task
- `POST /api/v1/browser/research` — Web research
- `GET /api/v1/files/workspace` — List workspace
- `POST /api/v1/git/pr` — Create GitHub PR
- `POST /api/v1/vision/generate` — Generate UI

## WebSocket Endpoints
- `WS /ws/chat/{session_id}` — Real-time chat
- `WS /ws/tasks/{task_id}` — Task execution stream
- `WS /ws/sandbox/{session_id}` — Terminal stream
- `WS /ws/agent/status` — Agent status updates
