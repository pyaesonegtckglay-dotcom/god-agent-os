---
title: Autonomous Coding System
emoji: 🤖
colorFrom: purple
colorTo: indigo
sdk: docker
pinned: false
license: mit
app_port: 7860
---

# GOD AGENT OS v11 — Backend API
**16-Agent Autonomous Engineering OS | God Mode**  
*Powered by Pyae Sone*

## Runtime Overview
- 16 autonomous agents (Chat, Planner, Coder, Debug, Test, File, Git, Browser, Vision, Sandbox, Deploy, Connector, Memory, Workflow, UI, Reasoning)
- 22 logical worker spaces (all running in this single backend)
- Multi-provider AI Router: Gemini → SambaNova → GitHub Models → Groq → OpenAI
- WebSocket + REST + SSE streaming

## Key Endpoints
- `GET /` — Root info
- `GET /health` — Health check
- `GET /api/docs` — Swagger UI
- `GET /api/v1/system/status` — Full system status
- `GET /api/v1/agents` — List all 16 agents
- `GET /api/v1/spaces` — All 22 spaces status
- `POST /api/v1/chat` — Chat with streaming
- `POST /api/v1/orchestrate` — God Mode orchestration
- `WS /ws/{session_id}` — Real-time WebSocket
- `WS /ws/computer-use/{session_id}` — Computer-use event stream

## Environment Variables
Set these in HF Space secrets:
- `GEMINI_KEY` — Google Gemini API key(s), comma-separated
- `SAMBANOVA_KEY` — SambaNova API key(s), comma-separated  
- `GITHUB_KEY` — GitHub Models API key(s), comma-separated
- `GROQ_API_KEY` — Groq API key (optional fallback)
- `OPENAI_API_KEY` — OpenAI API key (optional fallback)
- `GITHUB_TOKEN` — GitHub token for Git operations
- `HF_TOKEN` — HuggingFace token
- `VERCEL_TOKEN` — Vercel deploy token
