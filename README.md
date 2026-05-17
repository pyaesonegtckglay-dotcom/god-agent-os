---
title: God Agent OS — Phase 1
emoji: 🤖
colorFrom: indigo
colorTo: purple
sdk: docker
app_port: 7860
app_file: backend/app.py
pinned: true
license: mit
short_description: Stable autonomous agent backend (LLM + E2B + SSE)
---

# 🤖 God Agent OS — Phase 1 (Stability First)

A **clean, minimal, stable** autonomous AI agent backend.
One pipeline, real execution, no fake Computer Use.

## Architecture

```
Frontend (Vercel / Next.js)
   ↓ HTTPS / SSE / WS
Backend (HF Space — FastAPI)
   ├─ /api/v1/chat      → LLM-only streaming  (SambaNova → Gemini → ...)
   ├─ /api/v1/execute   → REAL E2B sandbox    (live stdout/stderr)
   ├─ /api/v1/agent     → Intent router (chat OR execute)
   └─ /ws/{session_id}  → Same events mirrored over WebSocket
```

## Endpoints

| Method | Path | Purpose |
|---|---|---|
| GET  | `/health` | Health + provider availability + E2B status |
| POST | `/api/v1/chat` | LLM-only SSE chat (no sandbox) |
| POST | `/api/v1/execute` | Real E2B execution, streams stdout/stderr |
| POST | `/api/v1/agent` | Intent-routed: chat OR execute |
| POST | `/api/v1/orchestrate` | Alias of `/api/v1/agent` |
| POST | `/api/v1/kernel/orchestrate` | Legacy non-streaming alias |
| GET  | `/api/v1/sandbox/{session_id}` | Sandbox info |
| DEL  | `/api/v1/sandbox/{session_id}` | Kill sandbox |
| WS   | `/ws/{session_id}` | WebSocket events |

## Required HF Space Secrets

| Variable | Required? | Purpose |
|---|---|---|
| `E2B_API_KEY` | **YES** | Real sandbox runtime |
| `SAMBANOVA_KEY` | one of these | Llama 3.3 70B (recommended, fastest) |
| `GEMINI_KEY`    | one of these | Gemini 2.0 Flash |
| `GITHUB_KEY`    | one of these | GitHub Models (GPT-4o-mini) |
| `OPENAI_API_KEY`| one of these | OpenAI |
| `GROQ_API_KEY`  | one of these | Groq (Llama) |
| `ANTHROPIC_API_KEY` | one of these | Claude |

## Quick Proof Test

```bash
curl -sN -X POST https://pyae1994-autonomous-coding-system.hf.space/api/v1/execute \
  -H 'Content-Type: application/json' \
  -d '{"language":"python","code":"import time,pathlib; p=pathlib.Path(\"/home/user/proof.txt\"); ts=int(time.time()); p.write_text(str(ts)); print(\"TS:\",ts,\"READBACK:\",p.read_text())","session_id":"smoke","stream":true}'
```

Expected: live SSE stream of `sandbox_ready` → `stdout` → `result` events.

## Phase Roadmap

- **Phase 1 (current)** — chat + execute + SSE/WS, stable.
- **Phase 2** — browser automation, retry/self-repair loops.
- **Phase 3** — workflows, memory, multi-agent.

## Powered by

OpenHands ideas · E2B · SambaNova/Gemini · Vercel · HuggingFace Spaces

Built by **Pyae Sone**.
