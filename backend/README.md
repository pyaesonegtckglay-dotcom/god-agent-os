---
title: God Agent OS v10 Backend
emoji: 🤖
colorFrom: purple
colorTo: indigo
sdk: docker
pinned: false
license: mit
app_port: 7860
---

# GOD AGENT OS v10 — Backend API
**Distributed 22-Space Architecture | Autonomous Agent OS**
*Powered by Pyae Sone*

## Runtime Overview
- 22 distributed worker spaces
- God Core Space orchestration
- KeyPool routing for Gemini, SambaNova, and GitHub model endpoints
- WebSocket + REST control plane
- Backward-compatible legacy agent fleet

## Primary APIs
- `GET /` — system runtime summary
- `GET /api/v1/spaces` — list all worker spaces
- `POST /api/v1/spaces/{name}/execute` — execute in a worker space
- `POST /api/v1/kernel/orchestrate` — main orchestration endpoint
- `GET /api/v1/ai/pool-status` — key pool visibility
- `WS /ws/chat/{session_id}` — live orchestration channel
- `GET /api/docs` — Swagger UI
