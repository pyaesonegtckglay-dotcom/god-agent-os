"""
GOD AGENT OS — Clean Phase-1 Backend
=====================================
Stability-first rebuild. One pipeline, no dead code.

Endpoints:
  GET  /health                       — real status + provider availability
  GET  /api/v1/health                — alias
  GET  /api/v1/system/status         — extended status
  POST /api/v1/chat            (SSE) — LLM-only streaming chat (NO sandbox)
  POST /api/v1/execute         (SSE) — real E2B sandbox execution
  POST /api/v1/agent           (SSE) — intent-routed: chat OR execute
  POST /api/v1/orchestrate     (SSE) — alias of /api/v1/agent (legacy)
  POST /api/v1/kernel/orchestrate    — alias of /api/v1/agent (legacy, frontend)
  GET  /api/v1/sandbox/{session}     — sandbox info
  DELETE /api/v1/sandbox/{session}   — kill sandbox
  WS   /ws/{session_id}              — same events over WebSocket

Execution rules (per spec):
  * Normal chat (greetings, explanations, brainstorming) → LLM only, no E2B
  * Execution intent (code, shell, files, packages) → real E2B sandbox
  * Intent detection: keyword heuristic + LLM tie-breaker (cheap, sync)
"""

from __future__ import annotations

import asyncio
import json
import os
import re
import time
import uuid
from contextlib import asynccontextmanager
from typing import Any, AsyncGenerator, Dict, List, Optional, Tuple

import httpx
import structlog
from fastapi import FastAPI, HTTPException, Request, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse, StreamingResponse

# ─────────────────────────────────────────────────────────────────────────────
# Logging
# ─────────────────────────────────────────────────────────────────────────────
structlog.configure(
    processors=[
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.stdlib.add_log_level,
        structlog.dev.ConsoleRenderer(),
    ]
)
log = structlog.get_logger()

# ─────────────────────────────────────────────────────────────────────────────
# Environment
# ─────────────────────────────────────────────────────────────────────────────
E2B_API_KEY = os.environ.get("E2B_API_KEY", "").strip()

# Multiple keys can be comma-separated; we just pick the first non-empty.
def _first_key(*env_names: str) -> str:
    for name in env_names:
        v = os.environ.get(name, "")
        if v:
            return v.split(",")[0].strip()
    return ""

SAMBANOVA_KEY = _first_key("SAMBANOVA_KEY", "SAMBANOVA_API_KEY", "SAMBANOVA_API_KEYS")
GEMINI_KEY    = _first_key("GEMINI_KEY", "GEMINI_API_KEY", "GEMINI_API_KEYS")
GITHUB_LLM_KEY= _first_key("GITHUB_KEY", "GITHUB_API_KEY", "GITHUB_MODELS_TOKEN", "GITHUB_API_KEYS")
OPENAI_KEY    = _first_key("OPENAI_API_KEY")
GROQ_KEY      = _first_key("GROQ_API_KEY")
ANTHROPIC_KEY = _first_key("ANTHROPIC_API_KEY")
HF_TOKEN      = _first_key("HF_TOKEN", "HUGGINGFACE_TOKEN")

VERSION = "13.0.0-phase1"

# ─────────────────────────────────────────────────────────────────────────────
# LLM Providers — OpenAI-compatible streaming (most stable, no tool-calling)
# ─────────────────────────────────────────────────────────────────────────────
# Order: most stable & fastest first. We deliberately do NOT use Gemini for
# tool-calling here — Phase 1 is text-only streaming.
PROVIDERS: List[Dict[str, Any]] = [
    {
        "name": "sambanova",
        "key": SAMBANOVA_KEY,
        "url": "https://api.sambanova.ai/v1/chat/completions",
        "model": "Meta-Llama-3.3-70B-Instruct",
    },
    {
        "name": "groq",
        "key": GROQ_KEY,
        "url": "https://api.groq.com/openai/v1/chat/completions",
        "model": "llama-3.3-70b-versatile",
    },
    {
        "name": "github",
        "key": GITHUB_LLM_KEY,
        "url": "https://models.inference.ai.azure.com/chat/completions",
        "model": "gpt-4o-mini",
    },
    {
        "name": "openai",
        "key": OPENAI_KEY,
        "url": "https://api.openai.com/v1/chat/completions",
        "model": "gpt-4o-mini",
    },
    {
        "name": "anthropic",
        "key": ANTHROPIC_KEY,
        "url": "https://api.anthropic.com/v1/messages",  # different protocol; handled specially
        "model": "claude-3-5-haiku-20241022",
    },
    {
        "name": "gemini",
        "key": GEMINI_KEY,
        "url": "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:streamGenerateContent",
        "model": "gemini-2.0-flash",
    },
]


def active_providers() -> List[str]:
    return [p["name"] for p in PROVIDERS if p["key"]]


# ─────────────────────────────────────────────────────────────────────────────
# Streaming helpers
# ─────────────────────────────────────────────────────────────────────────────
SYSTEM_PROMPT_CHAT = (
    "You are God Agent OS, a helpful autonomous AI assistant. "
    "Answer clearly and concisely. Use Markdown when helpful. "
    "Do NOT pretend to execute code — if execution is needed, the system "
    "will route the request to a real sandbox automatically."
)


async def _stream_openai_compat(
    provider: Dict[str, Any],
    messages: List[Dict[str, str]],
    temperature: float = 0.7,
    max_tokens: int = 2048,
) -> AsyncGenerator[str, None]:
    """Stream tokens from any OpenAI-compatible /chat/completions endpoint."""
    headers = {
        "Authorization": f"Bearer {provider['key']}",
        "Content-Type": "application/json",
    }
    payload = {
        "model": provider["model"],
        "messages": messages,
        "stream": True,
        "temperature": temperature,
        "max_tokens": max_tokens,
    }
    async with httpx.AsyncClient(timeout=httpx.Timeout(120.0, connect=15.0)) as client:
        async with client.stream("POST", provider["url"], json=payload, headers=headers) as resp:
            if resp.status_code != 200:
                body = (await resp.aread())[:300].decode("utf-8", "ignore")
                log.warning("LLM provider failed", provider=provider["name"], status=resp.status_code, body=body)
                raise RuntimeError(f"{provider['name']} HTTP {resp.status_code}: {body}")

            async for line in resp.aiter_lines():
                if not line or not line.startswith("data:"):
                    continue
                data_str = line[5:].strip()
                if data_str in ("", "[DONE]"):
                    if data_str == "[DONE]":
                        return
                    continue
                try:
                    obj = json.loads(data_str)
                    delta = obj["choices"][0].get("delta", {})
                    content = delta.get("content")
                    if content:
                        yield content
                except Exception:
                    continue


async def _stream_gemini(
    provider: Dict[str, Any],
    messages: List[Dict[str, str]],
    temperature: float = 0.7,
    max_tokens: int = 2048,
) -> AsyncGenerator[str, None]:
    """Stream from Gemini SSE endpoint — text-only (no tools)."""
    system_text = ""
    contents: List[Dict[str, Any]] = []
    for m in messages:
        role = m.get("role", "user")
        content = m.get("content", "")
        if role == "system":
            system_text = content
            continue
        g_role = "user" if role == "user" else "model"
        contents.append({"role": g_role, "parts": [{"text": content}]})
    if not contents:
        contents = [{"role": "user", "parts": [{"text": "Hello"}]}]

    body: Dict[str, Any] = {
        "contents": contents,
        "generationConfig": {"maxOutputTokens": max_tokens, "temperature": temperature},
    }
    if system_text:
        body["systemInstruction"] = {"parts": [{"text": system_text}]}

    url = f"{provider['url']}?alt=sse&key={provider['key']}"
    async with httpx.AsyncClient(timeout=httpx.Timeout(120.0, connect=15.0)) as client:
        async with client.stream("POST", url, json=body) as resp:
            if resp.status_code != 200:
                err = (await resp.aread())[:300].decode("utf-8", "ignore")
                raise RuntimeError(f"gemini HTTP {resp.status_code}: {err}")
            async for line in resp.aiter_lines():
                if not line.startswith("data:"):
                    continue
                data_str = line[5:].strip()
                if not data_str:
                    continue
                try:
                    obj = json.loads(data_str)
                    parts = obj.get("candidates", [{}])[0].get("content", {}).get("parts", [])
                    for p in parts:
                        if "text" in p and p["text"]:
                            yield p["text"]
                except Exception:
                    continue


async def _stream_anthropic(
    provider: Dict[str, Any],
    messages: List[Dict[str, str]],
    temperature: float = 0.7,
    max_tokens: int = 2048,
) -> AsyncGenerator[str, None]:
    """Stream from Anthropic Messages API."""
    system_text = ""
    msgs: List[Dict[str, Any]] = []
    for m in messages:
        if m.get("role") == "system":
            system_text = m.get("content", "")
            continue
        msgs.append({"role": m["role"], "content": m["content"]})

    payload: Dict[str, Any] = {
        "model": provider["model"],
        "max_tokens": max_tokens,
        "temperature": temperature,
        "messages": msgs,
        "stream": True,
    }
    if system_text:
        payload["system"] = system_text

    headers = {
        "x-api-key": provider["key"],
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
    }
    async with httpx.AsyncClient(timeout=httpx.Timeout(120.0, connect=15.0)) as client:
        async with client.stream("POST", provider["url"], json=payload, headers=headers) as resp:
            if resp.status_code != 200:
                err = (await resp.aread())[:300].decode("utf-8", "ignore")
                raise RuntimeError(f"anthropic HTTP {resp.status_code}: {err}")
            async for line in resp.aiter_lines():
                if not line.startswith("data:"):
                    continue
                data_str = line[5:].strip()
                if not data_str or data_str == "[DONE]":
                    continue
                try:
                    obj = json.loads(data_str)
                    if obj.get("type") == "content_block_delta":
                        d = obj.get("delta", {})
                        if d.get("type") == "text_delta":
                            t = d.get("text", "")
                            if t:
                                yield t
                except Exception:
                    continue


async def stream_llm(
    messages: List[Dict[str, str]],
    temperature: float = 0.7,
    max_tokens: int = 2048,
) -> AsyncGenerator[Tuple[str, str], None]:
    """
    Yield (provider_name, token) pairs. Tries providers in PROVIDERS order,
    falling back to next on failure. Yields a 'demo' provider with a helpful
    message if NO keys are configured.
    """
    last_err: Optional[str] = None
    for p in PROVIDERS:
        if not p["key"]:
            continue
        name = p["name"]
        try:
            if name == "gemini":
                stream = _stream_gemini(p, messages, temperature, max_tokens)
            elif name == "anthropic":
                stream = _stream_anthropic(p, messages, temperature, max_tokens)
            else:
                stream = _stream_openai_compat(p, messages, temperature, max_tokens)

            emitted = False
            async for chunk in stream:
                emitted = True
                yield (name, chunk)
            if emitted:
                return
            last_err = f"{name} produced no tokens"
            log.warning("Provider produced no tokens, falling back", provider=name)
        except Exception as e:
            last_err = f"{name}: {e}"
            log.warning("Provider failed, falling back", provider=name, error=str(e)[:200])
            continue

    # No provider worked — emit a clear demo message
    demo = (
        "**[Demo mode]** No LLM provider succeeded.\n\n"
        f"Last error: `{last_err or 'no API keys configured'}`\n\n"
        "Set one of: `SAMBANOVA_KEY`, `GEMINI_KEY`, `GITHUB_KEY`, `OPENAI_API_KEY`, "
        "`GROQ_API_KEY`, `ANTHROPIC_API_KEY` in HF Space → Settings → Variables and Secrets."
    )
    for tok in re.findall(r"\S+\s*", demo):
        yield ("demo", tok)
        await asyncio.sleep(0.01)


# ─────────────────────────────────────────────────────────────────────────────
# E2B Sandbox Manager — real execution, real stdout/stderr streaming
# ─────────────────────────────────────────────────────────────────────────────
class SandboxManager:
    """Manages per-session E2B sandboxes with reuse + lazy creation."""

    def __init__(self) -> None:
        self._sandboxes: Dict[str, Any] = {}      # session_id -> Sandbox
        self._meta: Dict[str, Dict[str, Any]] = {}  # session_id -> {created_at, sandbox_id}
        self._lock = asyncio.Lock()
        self._sdk_ok = False
        try:
            from e2b_code_interpreter import Sandbox  # noqa: F401
            self._sdk_ok = True
        except Exception as e:
            log.warning("E2B SDK not importable", error=str(e))

    @property
    def available(self) -> bool:
        return self._sdk_ok and bool(E2B_API_KEY)

    async def get_or_create(self, session_id: str):
        if not self.available:
            return None
        async with self._lock:
            sbx = self._sandboxes.get(session_id)
            if sbx is not None:
                return sbx
            from e2b_code_interpreter import Sandbox  # type: ignore
            # Sandbox constructor is blocking → offload to a thread
            sbx = await asyncio.to_thread(Sandbox, api_key=E2B_API_KEY)
            self._sandboxes[session_id] = sbx
            self._meta[session_id] = {
                "sandbox_id": getattr(sbx, "sandbox_id", "unknown"),
                "created_at": time.time(),
            }
            log.info("E2B sandbox created", session_id=session_id, sandbox_id=self._meta[session_id]["sandbox_id"])
            return sbx

    async def kill(self, session_id: str) -> bool:
        async with self._lock:
            sbx = self._sandboxes.pop(session_id, None)
            self._meta.pop(session_id, None)
        if sbx is None:
            return False
        try:
            await asyncio.to_thread(sbx.kill)
            return True
        except Exception as e:
            log.warning("Sandbox kill error", error=str(e))
            return False

    def info(self, session_id: str) -> Optional[Dict[str, Any]]:
        return self._meta.get(session_id)

    def stats(self) -> Dict[str, Any]:
        return {
            "available": self.available,
            "active_sandboxes": len(self._sandboxes),
            "sessions": list(self._meta.keys()),
        }

    async def shutdown_all(self) -> None:
        async with self._lock:
            sessions = list(self._sandboxes.keys())
        for sid in sessions:
            await self.kill(sid)


sandbox_mgr = SandboxManager()


async def execute_in_sandbox(
    session_id: str,
    language: str,
    code: str,
    timeout: int = 60,
) -> AsyncGenerator[Dict[str, Any], None]:
    """
    Execute code in a real E2B sandbox (or LOCAL fallback if E2B unavailable).
    Yields event dicts:
      {type: 'sandbox_ready', sandbox_id, session_id}
      {type: 'stdout', text}
      {type: 'stderr', text}
      {type: 'result', exit_code, duration_ms, sandbox_id, success}
      {type: 'error', error}
    """
    t0 = time.time()
    language = (language or "python").lower()

    # ── Real E2B path ────────────────────────────────────────────────────────
    if sandbox_mgr.available:
        try:
            sbx = await sandbox_mgr.get_or_create(session_id)
            meta = sandbox_mgr.info(session_id) or {}
            yield {
                "type": "sandbox_ready",
                "sandbox_id": meta.get("sandbox_id", "unknown"),
                "session_id": session_id,
                "backend": "e2b",
            }

            stdout_buf: List[str] = []
            stderr_buf: List[str] = []

            def on_stdout(line):  # called from SDK thread
                text = getattr(line, "line", None) or str(line)
                stdout_buf.append(text)

            def on_stderr(line):
                text = getattr(line, "line", None) or str(line)
                stderr_buf.append(text)

            if language in ("bash", "sh", "shell"):
                # Run as shell command
                exec_result = await asyncio.to_thread(
                    sbx.run_code,
                    f"import subprocess, sys\n"
                    f"r = subprocess.run({code!r}, shell=True, capture_output=True, text=True, timeout={timeout})\n"
                    f"sys.stdout.write(r.stdout)\n"
                    f"sys.stderr.write(r.stderr)\n"
                    f"sys.exit(r.returncode)\n",
                )
            else:
                exec_result = await asyncio.to_thread(sbx.run_code, code)

            # Drain logs (E2B 1.0.5 returns logs in exec_result.logs)
            for line in (getattr(exec_result.logs, "stdout", []) or []):
                yield {"type": "stdout", "text": line if line.endswith("\n") else line + "\n"}
            for line in (getattr(exec_result.logs, "stderr", []) or []):
                yield {"type": "stderr", "text": line if line.endswith("\n") else line + "\n"}

            err = getattr(exec_result, "error", None)
            exit_code = 0
            if err:
                yield {"type": "stderr", "text": f"{getattr(err, 'name', 'Error')}: {getattr(err, 'value', err)}\n"}
                exit_code = 1

            yield {
                "type": "result",
                "exit_code": exit_code,
                "success": exit_code == 0,
                "duration_ms": int((time.time() - t0) * 1000),
                "sandbox_id": meta.get("sandbox_id", "unknown"),
                "backend": "e2b",
            }
            return

        except Exception as e:
            log.error("E2B execution failed, falling back to local", error=str(e))
            yield {"type": "stderr", "text": f"[e2b fallback] {e}\n"}
            # Fall through to LOCAL

    # ── LOCAL fallback (subprocess) — clearly marked as fallback ─────────────
    import subprocess
    workdir = f"/tmp/god_workspace/{session_id}"
    os.makedirs(workdir, exist_ok=True)
    yield {
        "type": "sandbox_ready",
        "sandbox_id": f"local-{session_id}",
        "session_id": session_id,
        "backend": "local",
    }
    try:
        if language in ("bash", "sh", "shell"):
            cmd = ["bash", "-lc", code]
        else:
            # Run python via stdin to avoid filename issues
            cmd = ["python3", "-c", code]
        proc = await asyncio.create_subprocess_exec(
            *cmd,
            cwd=workdir,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )

        async def _drain(stream, evt):
            async for raw in stream:
                yield_text = raw.decode("utf-8", "replace")
                await _queue.put({"type": evt, "text": yield_text})
            await _queue.put({"_eof": evt})

        _queue: asyncio.Queue = asyncio.Queue()
        t1 = asyncio.create_task(_pipe(proc.stdout, "stdout", _queue))
        t2 = asyncio.create_task(_pipe(proc.stderr, "stderr", _queue))

        eofs = 0
        deadline = time.time() + timeout
        while eofs < 2:
            try:
                item = await asyncio.wait_for(_queue.get(), timeout=max(0.1, deadline - time.time()))
            except asyncio.TimeoutError:
                proc.kill()
                yield {"type": "stderr", "text": f"[timeout after {timeout}s]\n"}
                break
            if "_eof" in item:
                eofs += 1
                continue
            yield item

        rc = await proc.wait()
        yield {
            "type": "result",
            "exit_code": rc,
            "success": rc == 0,
            "duration_ms": int((time.time() - t0) * 1000),
            "sandbox_id": f"local-{session_id}",
            "backend": "local",
        }
    except Exception as e:
        yield {"type": "error", "error": str(e)}


async def _pipe(stream, evt: str, queue: asyncio.Queue) -> None:
    """Drain a subprocess stream line-by-line into queue."""
    try:
        while True:
            line = await stream.readline()
            if not line:
                break
            await queue.put({"type": evt, "text": line.decode("utf-8", "replace")})
    finally:
        await queue.put({"_eof": evt})


# ─────────────────────────────────────────────────────────────────────────────
# Intent router — chat vs execute
# ─────────────────────────────────────────────────────────────────────────────
EXEC_KEYWORDS = [
    "run ", "execute ", "compute ", "calculate ", "evaluate this",
    "write a file", "create a file", "create file", "write to ", "save to file",
    "list files", "ls ", "pwd ", "cat ",
    "install ", "pip install", "npm install", "apt-get",
    "python -c", "bash -c",
    "проof.txt", "proof.txt",  # from the spec example
    "current unix timestamp", "unix timestamp", "current timestamp",
    "shell command", "terminal command",
    "debug this", "test this code",
    "scrape ", "fetch url", "curl ",
]

CODE_BLOCK_RE = re.compile(r"```([a-zA-Z0-9_+\-]*)\n(.+?)```", re.DOTALL)


def detect_intent(message: str) -> Dict[str, Any]:
    """
    Lightweight intent detector. Returns:
      {intent: 'chat'|'execute', language?, code?, reason}
    Only flips to 'execute' if very confident — protects normal chat.
    """
    msg = message.strip()
    lower = msg.lower()

    # 1) explicit code block in message → execute
    m = CODE_BLOCK_RE.search(msg)
    if m:
        lang = (m.group(1) or "python").lower()
        if lang in ("py", ""):
            lang = "python"
        return {"intent": "execute", "language": lang, "code": m.group(2).strip(), "reason": "code_block"}

    # 2) execution keywords + looks like a task
    hits = [kw for kw in EXEC_KEYWORDS if kw in lower]
    if hits:
        return {"intent": "execute", "language": "python", "code": None, "reason": f"keywords:{hits[:3]}"}

    # 3) very short or greeting → chat
    if len(msg) < 200 and re.search(r"\b(hi|hello|hey|thanks|thank you|မင်္ဂလာ|ဟယ်လို)\b", lower):
        return {"intent": "chat", "reason": "greeting"}

    # default: chat (safe; user can still ask explicitly)
    return {"intent": "chat", "reason": "default"}


async def llm_generate_code(user_message: str) -> Optional[Tuple[str, str]]:
    """
    Ask LLM to produce executable code for the user's task.
    Returns (language, code) or None.
    """
    sys_prompt = (
        "You are a code generator. The user wants a task done by EXECUTING code. "
        "Respond with ONLY a single fenced code block — no explanation. "
        "Prefer Python. The code must be self-contained and print results to stdout. "
        "Use real operations (e.g. write actual files under /home/user/ in the sandbox)."
    )
    messages = [
        {"role": "system", "content": sys_prompt},
        {"role": "user", "content": user_message},
    ]
    buf = ""
    async for _name, tok in stream_llm(messages, temperature=0.1, max_tokens=1024):
        buf += tok
        if len(buf) > 8000:
            break
    m = CODE_BLOCK_RE.search(buf)
    if not m:
        # Some models forget the fence — treat raw as python if it looks code-ish
        if buf.strip() and ("print(" in buf or "import " in buf or "open(" in buf):
            return ("python", buf.strip())
        return None
    lang = (m.group(1) or "python").lower()
    if lang in ("py", ""):
        lang = "python"
    return (lang, m.group(2).strip())


# ─────────────────────────────────────────────────────────────────────────────
# WebSocket manager (used by /ws/{session_id})
# ─────────────────────────────────────────────────────────────────────────────
class WSManager:
    def __init__(self) -> None:
        self._sessions: Dict[str, set] = {}

    async def connect(self, ws: WebSocket, sid: str) -> None:
        await ws.accept()
        self._sessions.setdefault(sid, set()).add(ws)

    def disconnect(self, ws: WebSocket, sid: str) -> None:
        self._sessions.get(sid, set()).discard(ws)

    async def broadcast(self, sid: str, event: Dict[str, Any]) -> None:
        dead = []
        for ws in list(self._sessions.get(sid, [])):
            try:
                await ws.send_json(event)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self._sessions.get(sid, set()).discard(ws)

    def stats(self) -> Dict[str, Any]:
        return {"sessions": len(self._sessions), "connections": sum(len(s) for s in self._sessions.values())}


ws_manager = WSManager()


# ─────────────────────────────────────────────────────────────────────────────
# FastAPI app
# ─────────────────────────────────────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    log.info(
        "God Agent OS starting",
        version=VERSION,
        e2b=sandbox_mgr.available,
        providers=active_providers(),
    )
    yield
    log.info("Shutting down — killing sandboxes")
    await sandbox_mgr.shutdown_all()


app = FastAPI(
    title="God Agent OS — Phase 1",
    version=VERSION,
    description="Stable autonomous agent backend (LLM + E2B + SSE).",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)
app.add_middleware(GZipMiddleware, minimum_size=1024)


# ─────────────────────────────────────────────────────────────────────────────
# Health
# ─────────────────────────────────────────────────────────────────────────────
def _health_payload() -> Dict[str, Any]:
    return {
        "status": "healthy",
        "version": VERSION,
        "timestamp": time.time(),
        "e2b": sandbox_mgr.available,
        "ai_providers": active_providers(),
        "ws": ws_manager.stats(),
        "sandboxes": sandbox_mgr.stats(),
        "mode": "phase1_stable",
        "features": {
            "chat_streaming": True,
            "real_execution": True,
            "e2b_sandbox": sandbox_mgr.available,
            "local_fallback": True,
            "intent_routing": True,
        },
    }


@app.get("/")
async def root():
    return {"service": "god-agent-os", "version": VERSION, "docs": "/api/docs", "health": "/health"}


@app.get("/health")
async def health():
    return _health_payload()


@app.get("/api/v1/health")
async def health_v1():
    return _health_payload()


@app.get("/api/v1/system/status")
async def system_status():
    return _health_payload()


@app.get("/api/v1/ai/stats")
async def ai_stats():
    stats = {p["name"]: {"available": bool(p["key"]), "model": p["model"]} for p in PROVIDERS}
    return {"stats": stats, "active": next((p["name"] for p in PROVIDERS if p["key"]), None)}


# ─────────────────────────────────────────────────────────────────────────────
# SSE helpers
# ─────────────────────────────────────────────────────────────────────────────
SSE_HEADERS = {
    "Cache-Control": "no-cache, no-transform",
    "X-Accel-Buffering": "no",
    "Connection": "keep-alive",
}


def sse_pack(event: Dict[str, Any]) -> str:
    return f"data: {json.dumps(event, ensure_ascii=False)}\n\n"


# ─────────────────────────────────────────────────────────────────────────────
# /api/v1/chat — LLM only, real token streaming. NO sandbox.
# ─────────────────────────────────────────────────────────────────────────────
@app.post("/api/v1/chat")
async def chat(request: Request):
    body = await request.json()
    messages: List[Dict[str, str]] = body.get("messages") or []
    session_id: str = body.get("session_id") or uuid.uuid4().hex[:12]
    stream: bool = bool(body.get("stream", True))
    temperature = float(body.get("temperature", 0.7))
    max_tokens = int(body.get("max_tokens", 2048))

    # If client sent legacy {"message": "..."} → wrap it
    if not messages and body.get("message"):
        messages = [{"role": "user", "content": str(body["message"])}]

    if not messages:
        raise HTTPException(status_code=400, detail="messages or message required")

    # Inject system prompt unless caller provided one
    if not any(m.get("role") == "system" for m in messages):
        messages = [{"role": "system", "content": SYSTEM_PROMPT_CHAT}] + messages

    task_id = uuid.uuid4().hex[:12]

    if not stream:
        full = ""
        provider_used = None
        async for prov, tok in stream_llm(messages, temperature, max_tokens):
            provider_used = prov
            full += tok
        return {"task_id": task_id, "session_id": session_id, "result": full, "provider": provider_used}

    async def gen():
        provider_used: Optional[str] = None
        yield sse_pack({"type": "agent_start", "data": {"task_id": task_id, "mode": "chat"}, "session_id": session_id})
        await ws_manager.broadcast(session_id, {"type": "agent_start", "task_id": task_id, "mode": "chat"})
        full = ""
        try:
            async for prov, tok in stream_llm(messages, temperature, max_tokens):
                if provider_used != prov:
                    provider_used = prov
                    yield sse_pack({"type": "provider", "data": {"provider": prov}, "session_id": session_id})
                full += tok
                evt = {"type": "llm_chunk", "data": {"chunk": tok}, "session_id": session_id}
                yield sse_pack(evt)
                await ws_manager.broadcast(session_id, evt)
            yield sse_pack({"type": "agent_complete", "data": {"task_id": task_id, "tools_called": 0, "iterations": 1}, "session_id": session_id})
            yield sse_pack({"type": "stream_end", "data": {"full_response": full, "task_id": task_id, "provider": provider_used}, "session_id": session_id})
        except Exception as e:
            log.exception("chat stream error")
            yield sse_pack({"type": "error", "data": {"error": str(e)}, "session_id": session_id})

    return StreamingResponse(gen(), media_type="text/event-stream", headers=SSE_HEADERS)


# ─────────────────────────────────────────────────────────────────────────────
# /api/v1/execute — REAL E2B execution with live stdout/stderr streaming
# ─────────────────────────────────────────────────────────────────────────────
@app.post("/api/v1/execute")
async def execute(request: Request):
    body = await request.json()

    # Accept multiple schemas:
    #   {language, code}             ← primary (Phase 1)
    #   {tool, args:{code,...}}      ← legacy v12 schema
    language: Optional[str] = body.get("language")
    code: Optional[str] = body.get("code")
    if not code and body.get("tool"):
        args = body.get("args") or {}
        tool = body.get("tool")
        if tool in ("execute_python", "python"):
            language = "python"
            code = args.get("code")
        elif tool in ("execute_shell", "shell", "bash"):
            language = "bash"
            code = args.get("command") or args.get("code")
        elif tool == "write_file":
            language = "python"
            path = args.get("path", "/home/user/out.txt").replace("'", "\\'")
            content = (args.get("content") or "").replace("\\", "\\\\").replace("'''", "\\'\\'\\'")
            code = f"open('{path}','w').write('''{content}''')\nprint('wrote', '{path}')"
        elif tool == "read_file":
            language = "python"
            path = args.get("path", "/home/user/out.txt").replace("'", "\\'")
            code = f"print(open('{path}').read())"
    session_id: str = body.get("session_id") or uuid.uuid4().hex[:12]
    timeout = int(body.get("timeout") or 60)
    stream: bool = bool(body.get("stream", True))

    if not code:
        raise HTTPException(status_code=400, detail="code (or tool+args) required")
    language = (language or "python").lower()

    task_id = uuid.uuid4().hex[:12]

    if not stream:
        # Collect everything and return as JSON
        stdout, stderr, exit_code, sandbox_id, backend = "", "", None, None, None
        async for ev in execute_in_sandbox(session_id, language, code, timeout):
            t = ev.get("type")
            if t == "stdout":
                stdout += ev.get("text", "")
            elif t == "stderr":
                stderr += ev.get("text", "")
            elif t == "sandbox_ready":
                sandbox_id = ev.get("sandbox_id"); backend = ev.get("backend")
            elif t == "result":
                exit_code = ev.get("exit_code")
            elif t == "error":
                stderr += ev.get("error", "")
        return {
            "task_id": task_id, "session_id": session_id, "sandbox_id": sandbox_id, "backend": backend,
            "language": language, "stdout": stdout, "stderr": stderr, "exit_code": exit_code,
            "success": exit_code == 0,
        }

    async def gen():
        yield sse_pack({"type": "agent_start", "data": {"task_id": task_id, "mode": "execute", "language": language}, "session_id": session_id})
        yield sse_pack({"type": "tool_executing", "data": {"tool": f"execute_{language}", "args": {"code": code[:200]}}, "session_id": session_id})
        await ws_manager.broadcast(session_id, {"type": "tool_executing", "tool": f"execute_{language}"})
        stdout_acc = ""
        stderr_acc = ""
        result_meta: Dict[str, Any] = {}
        try:
            async for ev in execute_in_sandbox(session_id, language, code, timeout):
                # Mirror to WS
                await ws_manager.broadcast(session_id, ev)
                if ev["type"] == "stdout":
                    stdout_acc += ev["text"]
                elif ev["type"] == "stderr":
                    stderr_acc += ev["text"]
                elif ev["type"] == "result":
                    result_meta = ev
                yield sse_pack(ev)

            tool_result = {
                "tool": f"execute_{language}",
                "success": bool(result_meta.get("success")),
                "sandbox_id": result_meta.get("sandbox_id"),
                "raw": {
                    "stdout": stdout_acc[-2000:],
                    "stderr": stderr_acc[-2000:],
                    "exit_code": result_meta.get("exit_code"),
                    "_duration_ms": result_meta.get("duration_ms"),
                    "backend": result_meta.get("backend"),
                },
                "result": (stdout_acc or stderr_acc)[-1500:],
            }
            yield sse_pack({"type": "tool_result", "data": tool_result, "session_id": session_id})
            yield sse_pack({"type": "agent_complete", "data": {"task_id": task_id, "tools_called": 1, "iterations": 1}, "session_id": session_id})
            yield sse_pack({"type": "stream_end", "data": {"task_id": task_id, "full_response": stdout_acc[-2000:]}, "session_id": session_id})
        except Exception as e:
            log.exception("execute stream error")
            yield sse_pack({"type": "error", "data": {"error": str(e)}, "session_id": session_id})

    return StreamingResponse(gen(), media_type="text/event-stream", headers=SSE_HEADERS)


# ─────────────────────────────────────────────────────────────────────────────
# /api/v1/agent — intent-routed: chat OR execute
# ─────────────────────────────────────────────────────────────────────────────
@app.post("/api/v1/agent")
async def agent(request: Request):
    body = await request.json()
    message: str = (body.get("message") or "").strip()
    if not message and body.get("messages"):
        last_user = next((m["content"] for m in reversed(body["messages"]) if m.get("role") == "user"), "")
        message = (last_user or "").strip()
    session_id: str = body.get("session_id") or uuid.uuid4().hex[:12]
    force = (body.get("intent") or "").lower()  # 'chat' | 'execute' | ''
    if not message:
        raise HTTPException(status_code=400, detail="message required")

    intent = {"intent": force, "reason": "forced"} if force in ("chat", "execute") else detect_intent(message)
    task_id = uuid.uuid4().hex[:12]

    async def gen():
        yield sse_pack({"type": "agent_start", "data": {"task_id": task_id, "intent": intent}, "session_id": session_id})
        await ws_manager.broadcast(session_id, {"type": "agent_start", "task_id": task_id, "intent": intent})

        if intent["intent"] == "chat":
            messages = [
                {"role": "system", "content": SYSTEM_PROMPT_CHAT},
                {"role": "user", "content": message},
            ]
            full = ""
            provider_used = None
            try:
                async for prov, tok in stream_llm(messages):
                    if prov != provider_used:
                        provider_used = prov
                        yield sse_pack({"type": "provider", "data": {"provider": prov}, "session_id": session_id})
                    full += tok
                    evt = {"type": "llm_chunk", "data": {"chunk": tok}, "session_id": session_id}
                    yield sse_pack(evt)
                    await ws_manager.broadcast(session_id, evt)
            except Exception as e:
                yield sse_pack({"type": "error", "data": {"error": str(e)}, "session_id": session_id})
            yield sse_pack({"type": "agent_complete", "data": {"task_id": task_id, "tools_called": 0, "iterations": 1}, "session_id": session_id})
            yield sse_pack({"type": "stream_end", "data": {"task_id": task_id, "full_response": full, "provider": provider_used}, "session_id": session_id})
            return

        # ── EXECUTE branch ────────────────────────────────────────────────
        lang = intent.get("language") or "python"
        code = intent.get("code")
        if not code:
            # Generate code with LLM
            yield sse_pack({"type": "thinking_start", "data": {"iteration": 1, "phase": "code_generation"}, "session_id": session_id})
            gen_result = await llm_generate_code(message)
            if not gen_result:
                yield sse_pack({"type": "error", "data": {"error": "could not generate executable code"}, "session_id": session_id})
                yield sse_pack({"type": "stream_end", "data": {"task_id": task_id}, "session_id": session_id})
                return
            lang, code = gen_result
            yield sse_pack({"type": "llm_chunk", "data": {"chunk": f"```{lang}\n{code}\n```\n"}, "session_id": session_id})

        yield sse_pack({"type": "tool_executing", "data": {"tool": f"execute_{lang}", "args": {"code": code[:200]}}, "session_id": session_id})

        stdout_acc, stderr_acc, meta = "", "", {}
        async for ev in execute_in_sandbox(session_id, lang, code, timeout=60):
            await ws_manager.broadcast(session_id, ev)
            if ev["type"] == "stdout":
                stdout_acc += ev["text"]
            elif ev["type"] == "stderr":
                stderr_acc += ev["text"]
            elif ev["type"] == "result":
                meta = ev
            yield sse_pack(ev)

        yield sse_pack({
            "type": "tool_result",
            "data": {
                "tool": f"execute_{lang}",
                "success": bool(meta.get("success")),
                "sandbox_id": meta.get("sandbox_id"),
                "raw": {"stdout": stdout_acc[-2000:], "stderr": stderr_acc[-2000:], "exit_code": meta.get("exit_code"), "backend": meta.get("backend")},
                "result": (stdout_acc or stderr_acc)[-1500:],
            },
            "session_id": session_id,
        })
        yield sse_pack({"type": "agent_complete", "data": {"task_id": task_id, "tools_called": 1, "iterations": 1}, "session_id": session_id})
        yield sse_pack({"type": "stream_end", "data": {"task_id": task_id, "full_response": stdout_acc[-2000:]}, "session_id": session_id})

    return StreamingResponse(gen(), media_type="text/event-stream", headers=SSE_HEADERS)


# ─────────────────────────────────────────────────────────────────────────────
# Legacy aliases (so existing frontend keeps working without redeploy)
# ─────────────────────────────────────────────────────────────────────────────
@app.post("/api/v1/orchestrate")
async def orchestrate_alias(request: Request):
    return await agent(request)


@app.post("/api/v1/kernel/orchestrate")
async def kernel_orchestrate_alias(request: Request):
    """Legacy non-streaming endpoint used by ChatPanel.tsx."""
    body = await request.json()
    message = (body.get("message") or "").strip()
    session_id = body.get("session_id") or uuid.uuid4().hex[:12]
    if not message:
        raise HTTPException(status_code=400, detail="message required")
    intent = detect_intent(message)

    if intent["intent"] == "chat":
        messages = [
            {"role": "system", "content": SYSTEM_PROMPT_CHAT},
            {"role": "user", "content": message},
        ]
        full, prov = "", None
        async for p, tok in stream_llm(messages):
            full += tok; prov = p
        return {"session_id": session_id, "response": full, "provider": prov, "intent": "chat"}

    # execute path
    lang = intent.get("language") or "python"
    code = intent.get("code")
    if not code:
        g = await llm_generate_code(message)
        if not g:
            return {"session_id": session_id, "response": "Could not generate code.", "intent": "execute", "success": False}
        lang, code = g
    stdout, stderr, meta = "", "", {}
    async for ev in execute_in_sandbox(session_id, lang, code, timeout=60):
        if ev["type"] == "stdout": stdout += ev["text"]
        elif ev["type"] == "stderr": stderr += ev["text"]
        elif ev["type"] == "result": meta = ev
    return {
        "session_id": session_id,
        "response": (stdout or stderr)[-3000:],
        "intent": "execute",
        "code": code,
        "language": lang,
        "stdout": stdout, "stderr": stderr,
        "exit_code": meta.get("exit_code"),
        "sandbox_id": meta.get("sandbox_id"),
        "backend": meta.get("backend"),
        "success": bool(meta.get("success")),
    }


@app.post("/api/v1/chat/stream")
async def chat_stream_alias(request: Request):
    body = await request.json()
    body["stream"] = True
    async def receive():
        return {"type": "http.request", "body": json.dumps(body).encode()}
    request._receive = receive  # type: ignore
    return await chat(request)


# ─────────────────────────────────────────────────────────────────────────────
# Sandbox lifecycle
# ─────────────────────────────────────────────────────────────────────────────
@app.get("/api/v1/sandbox/{session_id}")
async def sandbox_info(session_id: str):
    return {
        "session_id": session_id,
        "sandbox": sandbox_mgr.info(session_id),
        "e2b_configured": sandbox_mgr.available,
    }


@app.delete("/api/v1/sandbox/{session_id}")
async def sandbox_kill(session_id: str):
    ok = await sandbox_mgr.kill(session_id)
    return {"status": "closed" if ok else "not_found", "session_id": session_id}


# Stub endpoints used by old frontend pages — return empty/healthy responses so UI doesn't error
@app.get("/api/v1/agents")
async def list_agents():
    return {"agents": [], "count": 0}

@app.get("/api/v1/tasks/")
async def list_tasks():
    return {"tasks": [], "count": 0}

@app.get("/api/v1/spaces")
async def list_spaces():
    return {"spaces": [], "count": 0}

@app.get("/api/v1/connectors")
async def list_connectors():
    return {"connectors": [], "count": 0}

@app.get("/api/v1/memory/")
async def memory_list():
    return {"items": [], "count": 0}

@app.get("/api/v1/ai/pool-status")
async def pool_status():
    return {"pools": {p["name"]: {"keys": 1 if p["key"] else 0, "model": p["model"]} for p in PROVIDERS}}


# ─────────────────────────────────────────────────────────────────────────────
# WebSocket — mirror of SSE events; also accepts {"type":"message"|"execute"|"ping"}
# ─────────────────────────────────────────────────────────────────────────────
@app.websocket("/ws/{session_id}")
async def websocket_endpoint(ws: WebSocket, session_id: str):
    await ws_manager.connect(ws, session_id)
    try:
        # Keep-alive loop
        while True:
            try:
                data = await asyncio.wait_for(ws.receive_json(), timeout=30.0)
            except asyncio.TimeoutError:
                await ws.send_json({"type": "ping", "ts": time.time()})
                continue
            except WebSocketDisconnect:
                break

            event_type = data.get("type")
            if event_type == "ping":
                await ws.send_json({"type": "pong", "ts": time.time()})
            elif event_type == "message":
                msg = data.get("message") or ""
                # Run agent and broadcast events
                async def _run():
                    intent = detect_intent(msg)
                    if intent["intent"] == "chat":
                        messages = [{"role": "system", "content": SYSTEM_PROMPT_CHAT}, {"role": "user", "content": msg}]
                        async for prov, tok in stream_llm(messages):
                            await ws_manager.broadcast(session_id, {"type": "llm_chunk", "data": {"chunk": tok}})
                        await ws_manager.broadcast(session_id, {"type": "stream_end", "data": {}})
                    else:
                        lang = intent.get("language") or "python"
                        code = intent.get("code")
                        if not code:
                            g = await llm_generate_code(msg)
                            if g:
                                lang, code = g
                            else:
                                await ws_manager.broadcast(session_id, {"type": "error", "data": {"error": "no code"}})
                                return
                        async for ev in execute_in_sandbox(session_id, lang, code):
                            await ws_manager.broadcast(session_id, ev)
                asyncio.create_task(_run())
            elif event_type == "execute":
                lang = (data.get("language") or "python").lower()
                code = data.get("code") or ""
                if not code:
                    await ws.send_json({"type": "error", "data": {"error": "code required"}})
                    continue
                async def _exec():
                    async for ev in execute_in_sandbox(session_id, lang, code):
                        await ws_manager.broadcast(session_id, ev)
                asyncio.create_task(_exec())
    except WebSocketDisconnect:
        pass
    finally:
        ws_manager.disconnect(ws, session_id)


# Dev entry
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app:app", host="0.0.0.0", port=int(os.environ.get("PORT", 7860)), reload=False)
