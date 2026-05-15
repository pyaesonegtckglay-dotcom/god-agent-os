---
title: God Agent OS v9 Backend
emoji: 🤖
colorFrom: violet
colorTo: indigo
sdk: docker
pinned: false
license: mit
app_port: 7860
---

# GOD AGENT OS v9 — Backend API
**Space-Role Architecture | General Autonomous Agent OS**
*Powered by Pyae Sone*

## Architecture

```
Agent Kernel (v9)
├── Core Space        — Planning & Orchestration
├── Browser Space     — Web Research & Navigation  
├── Sandbox Space     — Code Execution
├── Coding Space      — Code Generation
├── Vision Space      — UI Design & Image Analysis
├── Debug Space       — Error Analysis & Self-Healing
├── Deploy Space      — Cloud Deployments
└── Communication     — Docs & Messaging
```

## Roles
- **Cognition** — The Thinker
- **Automation** — The Operator
- **Execution** — The Doer
- **Repair** — The Fixer
- **Visual Intelligence** — The Observer

## API Endpoints
- `GET /` — System status
- `GET /api/v1/spaces` — List all Spaces
- `POST /api/v1/spaces/{name}/execute` — Execute in Space
- `POST /api/v1/kernel/orchestrate` — Main orchestration
- `WS /ws/chat/{session_id}` — Real-time chat
- `GET /api/docs` — Swagger UI
