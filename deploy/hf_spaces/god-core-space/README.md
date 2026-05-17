---
title: GOD AGENT OS v12 — Autonomous AI Agent Runtime
emoji: 🤖
colorFrom: purple
colorTo: indigo
sdk: docker
pinned: true
license: mit
short_description: True autonomous agent OS — real E2B execution, tool calling, streaming
---

# GOD AGENT OS v12 — True Autonomous Agent Runtime

Real autonomous agent like Manus/Devin — actual code execution, not explanations.

## Features
- ✅ Real E2B sandbox execution
- ✅ Token-by-token streaming
- ✅ Tool calling (Python, shell, file ops)
- ✅ Live Computer Use panel
- ✅ Multi-provider AI (Gemini/Sambanova/GitHub/Groq)
- ✅ Local subprocess fallback

## Environment Variables (Secrets)
Set these in HF Space Settings → Secrets:

| Variable | Description | Required |
|----------|-------------|----------|
| `E2B_API_KEY` | E2B sandbox API key | Recommended |
| `GEMINI_KEY` | Google Gemini API key | Recommended |
| `SAMBANOVA_KEY` | SambaNova API key | Optional |
| `GITHUB_KEY` | GitHub Models token | Optional |
| `GROQ_API_KEY` | Groq API key | Optional |
