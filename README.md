---
title: God Agent OS v9.0.1
emoji: 🤖
colorFrom: indigo
colorTo: purple
sdk: docker
app_port: 7860
pinned: true
license: mit
short_description: General Autonomous Agent OS v9.0.1 — Space-Role backend for Hugging Face + Vercel UI
---

# 🤖 GOD AGENT OS v9.0.1

**General Autonomous Agent OS** with a Manus-like persistent workspace, Space-Role backend, live chat session memory, functional quick actions, and connector management.

## Highlights

- **Space-Role Architecture**: Core, Browser, Sandbox, Coding, Vision, Debug, Deploy, Communication
- **Persistent Conversations**: Chat sessions and conversation history are stored in SQLite and can be reopened from the UI
- **Live Routing Feedback**: Space activation, agent responses, and notifications are emitted in real time
- **Functional Connectors UI**: Connector tokens can be updated at runtime from the frontend
- **Vercel Frontend + Hugging Face Backend**: Frontend serves the app UI while the HF Space runs FastAPI + WebSocket services

## Deployment Layout

- `frontend/` → Next.js app for Vercel
- `backend/` → FastAPI backend for Hugging Face Space
- `Dockerfile` → root Dockerfile for Hugging Face Space deployment

## Required Secrets

Configure the backend secrets on Hugging Face Space settings:

- `GEMINI_API_KEYS`
- `SAMBANOVA_API_KEYS`
- `GITHUB_API_KEYS`
- `HF_TOKEN`
- `VERCEL_TOKEN`
- Any optional provider keys you want to enable

## Local Build Checks

- Frontend: `npm run build`
- Backend syntax: `python3 -m py_compile $(find . -name '*.py' -type f)`

## Production Endpoints

- Backend health: `/api/v1/health`
- Kernel status: `/api/v1/kernel/status`
- Spaces list: `/api/v1/spaces`
- Chat sessions: `/api/v1/memory/sessions`
- Conversation history: `/api/v1/memory/history/{session_id}`
