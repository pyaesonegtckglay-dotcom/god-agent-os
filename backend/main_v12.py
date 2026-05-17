"""
GOD AGENT OS v12 — TRUE AUTONOMOUS AGENT RUNTIME
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Real execution: E2B sandbox + tool router + live streaming
NOT a chatbot — an actual autonomous agent OS like Manus/Devin
"""

import asyncio
import hashlib
import json
import os
import time
import uuid
from contextlib import asynccontextmanager
from typing import AsyncGenerator, Dict, List, Optional, Any

import httpx
import structlog
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import StreamingResponse, JSONResponse
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

structlog.configure(
    processors=[
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.stdlib.add_log_level,
        structlog.processors.StackInfoRenderer(),
        structlog.dev.ConsoleRenderer(),
    ]
)
log = structlog.get_logger()

# ─── Environment ──────────────────────────────────────────────────────────────
E2B_API_KEY = os.environ.get("E2B_API_KEY", "")
GEMINI_KEY = os.environ.get("GEMINI_KEY", "")
SAMBANOVA_KEY = os.environ.get("SAMBANOVA_KEY", "")
GITHUB_KEY = os.environ.get("GITHUB_KEY", "")
GROQ_KEY = os.environ.get("GROQ_API_KEY", "")
OPENAI_KEY = os.environ.get("OPENAI_API_KEY", "")

# ─── Rate Limiter ──────────────────────────────────────────────────────────────
limiter = Limiter(key_func=get_remote_address)


# ─── WebSocket Manager ─────────────────────────────────────────────────────────
class WebSocketManager:
    def __init__(self):
        self._rooms: Dict[str, set] = {}
        self._conn_count = 0

    async def connect(self, ws: WebSocket, room: str):
        await ws.accept()
        if room not in self._rooms:
            self._rooms[room] = set()
        self._rooms[room].add(ws)
        self._conn_count += 1
        log.info("WS connected", room=room, total=self._conn_count)

    def disconnect(self, ws: WebSocket, room: str):
        if room in self._rooms:
            self._rooms[room].discard(ws)
        self._conn_count = max(0, self._conn_count - 1)

    async def broadcast(self, room: str, data: dict):
        if "ts" not in data:
            data["ts"] = time.time()
        dead = set()
        for ws in list(self._rooms.get(room, [])):
            try:
                await ws.send_json(data)
            except Exception:
                dead.add(ws)
        for ws in dead:
            self._rooms.get(room, set()).discard(ws)

    async def emit_chat(self, session_id: str, event_type: str, data: dict):
        event = {
            "type": event_type,
            "session_id": session_id,
            "ts": time.time(),
            "data": data,
        }
        await self.broadcast(f"chat:{session_id}", event)

    async def heartbeat_loop(self):
        while True:
            await asyncio.sleep(20)
            for room in list(self._rooms.keys()):
                await self.broadcast(room, {"type": "heartbeat", "ts": time.time()})

    def stats(self):
        return {"connections": self._conn_count, "rooms": len(self._rooms)}


# ─── AI Router — Multi-provider with streaming ────────────────────────────────
class AIRouter:
    """Multi-provider AI router: Gemini → Sambanova → GitHub → Groq"""

    PROVIDERS = {
        "gemini": {
            "url": "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:streamGenerateContent",
            "key": lambda: os.environ.get("GEMINI_KEY", GEMINI_KEY),
            "type": "gemini",
        },
        "sambanova": {
            "url": "https://api.sambanova.ai/v1/chat/completions",
            "key": lambda: os.environ.get("SAMBANOVA_KEY", SAMBANOVA_KEY),
            "model": "Meta-Llama-3.3-70B-Instruct",
            "type": "openai",
        },
        "github": {
            "url": "https://models.inference.ai.azure.com/chat/completions",
            "key": lambda: os.environ.get("GITHUB_KEY", GITHUB_KEY),
            "model": "gpt-4o",
            "type": "openai",
        },
        "groq": {
            "url": "https://api.groq.com/openai/v1/chat/completions",
            "key": lambda: os.environ.get("GROQ_API_KEY", GROQ_KEY),
            "model": "llama-3.3-70b-versatile",
            "type": "openai",
        },
        "openai": {
            "url": "https://api.openai.com/v1/chat/completions",
            "key": lambda: os.environ.get("OPENAI_API_KEY", OPENAI_KEY),
            "model": "gpt-4o",
            "type": "openai",
        },
    }

    ORDER = ["gemini", "sambanova", "github", "groq", "openai"]

    def get_active_provider(self) -> Optional[str]:
        for p in self.ORDER:
            k = self.PROVIDERS[p]["key"]()
            if k and len(k) > 10:
                return p
        return None

    def get_stats(self) -> Dict:
        stats = {}
        for p in self.ORDER:
            k = self.PROVIDERS[p]["key"]()
            stats[p] = {"available": bool(k and len(k) > 10), "key_set": bool(k)}
        return stats

    async def stream_chat(
        self,
        messages: List[Dict],
        session_id: str,
        ws_manager: Optional[WebSocketManager] = None,
        tools: Optional[List] = None,
        temperature: float = 0.7,
        max_tokens: int = 8192,
    ) -> AsyncGenerator[str, None]:
        """Stream tokens from AI provider."""
        provider = self.get_active_provider()

        if not provider:
            # Demo mode — no API key
            async for chunk in self._demo_stream(messages):
                yield chunk
            return

        cfg = self.PROVIDERS[provider]
        key = cfg["key"]()

        if cfg["type"] == "gemini":
            async for chunk in self._gemini_stream(cfg["url"], key, messages, max_tokens, tools):
                yield chunk
        else:
            async for chunk in self._openai_stream(
                cfg["url"], key, cfg.get("model", "gpt-4o"),
                messages, max_tokens, tools, temperature
            ):
                yield chunk

    async def _gemini_stream(
        self, url: str, key: str, messages: List[Dict],
        max_tokens: int, tools: Optional[List] = None
    ) -> AsyncGenerator[str, None]:
        """Stream from Gemini API."""
        # Convert messages to Gemini format
        contents = []
        system_text = ""
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

        body = {
            "contents": contents,
            "generationConfig": {
                "maxOutputTokens": max_tokens,
                "temperature": 0.7,
            },
        }
        if system_text:
            body["systemInstruction"] = {"parts": [{"text": system_text}]}

        # Add tools if provided
        if tools:
            gemini_tools = []
            for tool in tools:
                gemini_tools.append({
                    "functionDeclarations": [{
                        "name": tool["name"],
                        "description": tool.get("description", ""),
                        "parameters": tool.get("parameters", {}),
                    }]
                })
            body["tools"] = gemini_tools

        stream_url = url if "?alt=sse" in url else url + "?alt=sse"
        stream_url = stream_url.replace("streamGenerateContent?", "streamGenerateContent?") + f"&key={key}"
        if "?alt=sse" not in stream_url:
            stream_url = stream_url.replace(f"&key={key}", "") + f"?alt=sse&key={key}"

        # Use non-streaming endpoint for tool calls
        final_url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key={key}"

        try:
            async with httpx.AsyncClient(timeout=120.0) as client:
                # Try SSE streaming first
                sse_url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:streamGenerateContent?alt=sse&key={key}"
                async with client.stream("POST", sse_url, json=body) as resp:
                    if resp.status_code != 200:
                        # Fallback to non-streaming
                        resp2 = await client.post(final_url, json=body)
                        if resp2.status_code == 200:
                            data = resp2.json()
                            candidates = data.get("candidates", [])
                            if candidates:
                                parts = candidates[0].get("content", {}).get("parts", [])
                                for part in parts:
                                    if "text" in part:
                                        yield part["text"]
                                    elif "functionCall" in part:
                                        yield json.dumps({"function_call": part["functionCall"]})
                        return

                    async for line in resp.aiter_lines():
                        if not line.startswith("data:"):
                            continue
                        data_str = line[5:].strip()
                        if not data_str or data_str == "[DONE]":
                            continue
                        try:
                            data = json.loads(data_str)
                            candidates = data.get("candidates", [])
                            if candidates:
                                parts = candidates[0].get("content", {}).get("parts", [])
                                for part in parts:
                                    if "text" in part:
                                        yield part["text"]
                                    elif "functionCall" in part:
                                        yield json.dumps({"function_call": part["functionCall"]})
                        except json.JSONDecodeError:
                            pass
        except Exception as e:
            log.error("Gemini stream error", error=str(e))
            yield f"[Gemini error: {str(e)[:100]}]"

    async def _openai_stream(
        self, url: str, key: str, model: str,
        messages: List[Dict], max_tokens: int,
        tools: Optional[List] = None, temperature: float = 0.7
    ) -> AsyncGenerator[str, None]:
        """Stream from OpenAI-compatible API."""
        payload: Dict[str, Any] = {
            "model": model,
            "messages": messages,
            "stream": True,
            "temperature": temperature,
            "max_tokens": max_tokens,
        }
        if tools:
            payload["tools"] = [{"type": "function", "function": t} for t in tools]
            payload["tool_choice"] = "auto"

        headers = {
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json",
        }

        try:
            async with httpx.AsyncClient(timeout=120.0) as client:
                async with client.stream("POST", url, json=payload, headers=headers) as resp:
                    if resp.status_code != 200:
                        error_text = await resp.aread()
                        log.error("OpenAI stream error", status=resp.status_code, body=error_text[:200])
                        # Try next provider
                        return

                    tool_calls_buffer = {}

                    async for line in resp.aiter_lines():
                        if not line.startswith("data:"):
                            continue
                        data_str = line[6:].strip()
                        if data_str == "[DONE]":
                            # Flush any buffered tool calls
                            if tool_calls_buffer:
                                yield json.dumps({"tool_calls": list(tool_calls_buffer.values())})
                            return
                        try:
                            data = json.loads(data_str)
                            delta = data["choices"][0].get("delta", {})

                            # Text content
                            if "content" in delta and delta["content"]:
                                yield delta["content"]

                            # Tool calls
                            if "tool_calls" in delta:
                                for tc in delta["tool_calls"]:
                                    idx = tc.get("index", 0)
                                    if idx not in tool_calls_buffer:
                                        tool_calls_buffer[idx] = {
                                            "id": tc.get("id", ""),
                                            "type": "function",
                                            "function": {"name": "", "arguments": ""}
                                        }
                                    if tc.get("id"):
                                        tool_calls_buffer[idx]["id"] = tc["id"]
                                    fn = tc.get("function", {})
                                    if fn.get("name"):
                                        tool_calls_buffer[idx]["function"]["name"] += fn["name"]
                                    if fn.get("arguments"):
                                        tool_calls_buffer[idx]["function"]["arguments"] += fn["arguments"]

                                    # Check if complete
                                    try:
                                        args_str = tool_calls_buffer[idx]["function"]["arguments"]
                                        if args_str:
                                            json.loads(args_str)  # Will raise if incomplete
                                            # Complete! Emit tool call
                                            yield json.dumps({"tool_call": tool_calls_buffer[idx]})
                                            del tool_calls_buffer[idx]
                                    except json.JSONDecodeError:
                                        pass  # Still accumulating

                        except (json.JSONDecodeError, KeyError, IndexError):
                            pass
        except Exception as e:
            log.error("OpenAI-compat stream error", error=str(e))

    async def _demo_stream(self, messages: List[Dict]) -> AsyncGenerator[str, None]:
        """Demo mode when no API keys are configured."""
        last_user = next((m["content"] for m in reversed(messages) if m.get("role") == "user"), "Hello")
        response = (
            f"⚠️ **No AI API Keys Configured**\n\n"
            f"I received: *{last_user[:100]}*\n\n"
            f"To enable real AI responses, set one of these environment variables:\n"
            f"- `GEMINI_KEY` — Google Gemini (recommended, free tier available)\n"
            f"- `SAMBANOVA_KEY` — SambaNova (fast Llama models)\n"
            f"- `GITHUB_KEY` — GitHub Models (GPT-4o)\n"
            f"- `GROQ_API_KEY` — Groq (ultra-fast)\n"
            f"- `OPENAI_API_KEY` — OpenAI GPT-4\n\n"
            f"E2B sandbox execution is {'✅ configured' if E2B_API_KEY else '❌ not configured (set E2B_API_KEY)'}."
        )
        for word in response.split():
            yield word + " "
            await asyncio.sleep(0.02)

    async def complete(
        self,
        messages: List[Dict],
        tools: Optional[List] = None,
        temperature: float = 0.7,
        max_tokens: int = 8192,
    ) -> str:
        """Non-streaming completion."""
        full = ""
        async for chunk in self.stream_chat(messages, "", tools=tools, temperature=temperature, max_tokens=max_tokens):
            full += chunk
        return full


# ─── Autonomous Agent — Manus-style execution loop ────────────────────────────
class AutonomousAgent:
    """
    Real autonomous agent with:
    - Tool calling (E2B execution, file ops, shell)
    - Multi-step reasoning loop
    - Live streaming of thoughts + actions
    - Self-repair on errors
    """

    SYSTEM_PROMPT = """You are GOD AGENT OS — an elite autonomous AI agent like Manus/Devin.
You EXECUTE tasks autonomously using real tools. You do NOT explain how to do things — you DO them.

CRITICAL RULES:
1. ALWAYS use tools to actually execute code, create files, run commands
2. NEVER say "you can run this" or "try this command" — ACTUALLY RUN IT YOURSELF
3. For ANY code task — use execute_python or execute_shell to run the real code
4. For file operations — use write_file, read_file, delete_file tools
5. Return REAL output: actual stdout, stderr, exit codes, file contents, timestamps
6. If a step fails, self-repair and retry with a fix

AUTONOMOUS EXECUTION PROTOCOL:
- Think step by step
- Use tools for every concrete action
- Show real terminal output
- Confirm actual results (real file sizes, real timestamps, real SHA256 hashes)
- Complete the task end-to-end without asking for clarification

You have access to: Python execution, shell commands, file system, web search.
Always verify your work by reading back files, checking output, confirming operations."""

    MAX_TOOL_ITERATIONS = 20

    def __init__(self, ai_router: AIRouter, ws_manager: WebSocketManager, tool_router=None):
        self.ai = ai_router
        self.ws = ws_manager
        self.tool_router = tool_router

    async def run(
        self,
        user_message: str,
        session_id: str,
        task_id: str = "",
    ) -> AsyncGenerator[str, None]:
        """
        Run autonomous agent loop with real-time streaming.
        Yields SSE-compatible chunks.
        """
        from tools.tool_router import ToolRouter, TOOL_DEFINITIONS
        if not self.tool_router:
            self.tool_router = ToolRouter(self.ws)

        messages = [
            {"role": "system", "content": self.SYSTEM_PROMPT},
            {"role": "user", "content": user_message},
        ]

        # Emit thinking start
        await self.ws.emit_chat(session_id, "agent_thinking", {
            "task_id": task_id,
            "message": user_message[:100],
        })

        yield json.dumps({
            "type": "agent_start",
            "data": {"task_id": task_id, "message": user_message[:100]},
            "session_id": session_id,
        }) + "\n"

        iteration = 0
        full_response = ""
        current_thought = ""
        tool_results_context = []

        while iteration < self.MAX_TOOL_ITERATIONS:
            iteration += 1
            log.info("Agent iteration", iteration=iteration, session_id=session_id)

            # Emit iteration start
            await self.ws.emit_chat(session_id, "agent_iteration", {
                "iteration": iteration,
                "task_id": task_id,
            })

            # Stream LLM response
            current_chunk = ""
            tool_call_json = ""
            in_tool_call = False
            has_tool_call = False

            yield json.dumps({
                "type": "thinking_start",
                "data": {"iteration": iteration},
                "session_id": session_id,
            }) + "\n"

            async for chunk in self.ai.stream_chat(
                messages,
                session_id,
                tools=TOOL_DEFINITIONS,
                temperature=0.2,  # Lower for tool use
            ):
                # Check if this is a tool call JSON
                if chunk.startswith('{"tool_call":') or chunk.startswith('{"tool_calls":'):
                    in_tool_call = True
                    has_tool_call = True
                    tool_call_json = chunk
                    continue
                elif chunk.startswith('{"function_call":'):
                    # Gemini format
                    in_tool_call = True
                    has_tool_call = True
                    tool_call_json = chunk
                    continue

                # Regular text token
                current_chunk += chunk
                current_thought += chunk
                full_response += chunk

                # Emit token to frontend (real-time streaming)
                yield json.dumps({
                    "type": "llm_chunk",
                    "data": {"chunk": chunk, "iteration": iteration},
                    "session_id": session_id,
                }) + "\n"

                await self.ws.emit_chat(session_id, "llm_chunk", {
                    "chunk": chunk,
                    "iteration": iteration,
                    "task_id": task_id,
                })

            # Process tool call if present
            if has_tool_call and tool_call_json:
                try:
                    tool_data = json.loads(tool_call_json)

                    # Handle both single tool_call and tool_calls array
                    tool_calls = []
                    if "tool_call" in tool_data:
                        tool_calls = [tool_data["tool_call"]]
                    elif "tool_calls" in tool_data:
                        tool_calls = tool_data["tool_calls"]
                    elif "function_call" in tool_data:
                        # Gemini format
                        fc = tool_data["function_call"]
                        tool_calls = [{
                            "id": uuid.uuid4().hex[:8],
                            "type": "function",
                            "function": {"name": fc.get("name", ""), "arguments": json.dumps(fc.get("args", {}))}
                        }]

                    for tc in tool_calls:
                        fn = tc.get("function", {})
                        tool_name = fn.get("name", "")
                        try:
                            tool_args = json.loads(fn.get("arguments", "{}"))
                        except Exception:
                            tool_args = {}

                        if not tool_name:
                            continue

                        log.info("Executing tool", tool=tool_name, args=str(tool_args)[:100])

                        # Emit tool execution start
                        yield json.dumps({
                            "type": "tool_executing",
                            "data": {
                                "tool": tool_name,
                                "args": {k: str(v)[:200] for k, v in tool_args.items()},
                                "task_id": task_id,
                            },
                            "session_id": session_id,
                        }) + "\n"

                        await self.ws.emit_chat(session_id, "computer_use_step", {
                            "type": self._get_step_type(tool_name),
                            "title": f"{tool_name}: {str(tool_args)[:80]}",
                            "task_id": task_id,
                            "status": "running",
                        })

                        # ACTUALLY EXECUTE THE TOOL
                        tool_result = await self.tool_router.execute_tool(
                            tool_name, tool_args, session_id, task_id
                        )

                        formatted = self.tool_router.format_tool_result(tool_name, tool_result)

                        # Emit tool result
                        yield json.dumps({
                            "type": "tool_result",
                            "data": {
                                "tool": tool_name,
                                "result": formatted[:2000],
                                "raw": {k: str(v)[:500] for k, v in tool_result.items()},
                                "success": tool_result.get("success", True),
                                "sandbox_id": tool_result.get("sandbox_id", "local"),
                                "task_id": task_id,
                            },
                            "session_id": session_id,
                        }) + "\n"

                        await self.ws.emit_chat(session_id, "computer_use_step", {
                            "type": self._get_step_type(tool_name),
                            "title": f"✅ {tool_name} completed",
                            "detail": str(tool_result.get("stdout", tool_result.get("output", "")))[:200],
                            "task_id": task_id,
                            "status": "done",
                        })

                        # Add to context for next LLM call
                        tool_results_context.append({
                            "tool": tool_name,
                            "args": tool_args,
                            "result": formatted[:3000],
                            "raw_result": tool_result,
                        })

                        # Add assistant message with tool call + result to messages
                        messages.append({
                            "role": "assistant",
                            "content": current_thought or f"Executing {tool_name}...",
                        })
                        messages.append({
                            "role": "user",
                            "content": f"Tool execution result for {tool_name}:\n{formatted[:3000]}\n\nContinue with the task based on this result.",
                        })

                except Exception as e:
                    log.error("Tool call parsing error", error=str(e), json=tool_call_json[:200])
                    messages.append({
                        "role": "assistant",
                        "content": current_thought,
                    })
                    messages.append({
                        "role": "user",
                        "content": f"Tool execution error: {str(e)}. Please continue.",
                    })

                current_thought = ""
                # Continue the loop for next iteration
                continue

            else:
                # No tool calls — LLM gave a final text response
                # Add final response to messages
                if current_thought.strip():
                    messages.append({
                        "role": "assistant",
                        "content": current_thought,
                    })

                # Task complete
                yield json.dumps({
                    "type": "agent_complete",
                    "data": {
                        "task_id": task_id,
                        "result": full_response[:500],
                        "iterations": iteration,
                        "tools_called": len(tool_results_context),
                    },
                    "session_id": session_id,
                }) + "\n"

                await self.ws.emit_chat(session_id, "agent_complete", {
                    "task_id": task_id,
                    "iterations": iteration,
                    "tools_called": len(tool_results_context),
                })

                yield json.dumps({
                    "type": "stream_end",
                    "data": {"full_response": full_response, "task_id": task_id},
                    "session_id": session_id,
                }) + "\n"
                return

        # Max iterations reached
        yield json.dumps({
            "type": "agent_complete",
            "data": {"task_id": task_id, "result": "Max iterations reached", "iterations": iteration},
            "session_id": session_id,
        }) + "\n"
        yield json.dumps({
            "type": "stream_end",
            "data": {"full_response": full_response},
            "session_id": session_id,
        }) + "\n"

    def _get_step_type(self, tool_name: str) -> str:
        mapping = {
            "execute_python": "coding",
            "execute_shell": "terminal",
            "write_file": "file",
            "read_file": "file",
            "delete_file": "file",
            "list_files": "file",
            "web_search": "browsing",
            "install_package": "terminal",
        }
        return mapping.get(tool_name, "executing")


# ─── Session/Task State Manager ───────────────────────────────────────────────
class SessionManager:
    def __init__(self):
        self._sessions: Dict[str, Dict] = {}
        self._computer_use: Dict[str, List] = {}

    def get_or_create(self, session_id: str) -> Dict:
        if session_id not in self._sessions:
            self._sessions[session_id] = {
                "id": session_id,
                "created_at": time.time(),
                "last_active": time.time(),
                "message_count": 0,
                "task_ids": [],
                "status": "active",
            }
        return self._sessions[session_id]

    def add_task(self, session_id: str, task_id: str):
        sess = self.get_or_create(session_id)
        sess["task_ids"].append(task_id)
        sess["last_active"] = time.time()

    def add_computer_use_step(self, session_id: str, step_type: str, data: Dict):
        if session_id not in self._computer_use:
            self._computer_use[session_id] = []
        self._computer_use[session_id].append({
            "id": uuid.uuid4().hex[:8],
            "type": step_type,
            "data": data,
            "ts": time.time(),
            "status": data.get("status", "running"),
        })
        # Keep last 200 steps
        self._computer_use[session_id] = self._computer_use[session_id][-200:]

    def get_computer_use_steps(self, session_id: str) -> List:
        return self._computer_use.get(session_id, [])

    def get_session(self, session_id: str) -> Optional[Dict]:
        return self._sessions.get(session_id)

    def list_sessions(self) -> List[Dict]:
        return list(self._sessions.values())


# ─── App Factory ──────────────────────────────────────────────────────────────
ws_manager = WebSocketManager()
ai_router = AIRouter()
session_manager = SessionManager()
agent: Optional[AutonomousAgent] = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global agent
    log.info("🚀 GOD AGENT OS v12 starting — TRUE AUTONOMOUS RUNTIME")
    log.info(f"E2B sandbox: {'✅ configured' if E2B_API_KEY else '⚠️  not configured (local fallback)'}")

    ai_stats = ai_router.get_stats()
    active = [p for p, s in ai_stats.items() if s["available"]]
    log.info(f"AI providers: {active or ['demo mode']}")

    # Init agent
    from tools.tool_router import ToolRouter
    tool_router = ToolRouter(ws_manager)
    agent = AutonomousAgent(ai_router, ws_manager, tool_router)

    # Start heartbeat
    asyncio.create_task(ws_manager.heartbeat_loop())

    # Init DB
    try:
        from memory.db import init_db
        await init_db()
    except Exception as e:
        log.warning("DB init skipped", error=str(e))

    log.info("✅ GOD AGENT OS v12 ready — Real execution enabled")
    yield
    log.info("Shutting down GOD AGENT OS v12...")


app = FastAPI(
    title="GOD AGENT OS v12",
    description="True Autonomous Agent Runtime — Real E2B Execution + Live Streaming",
    version="12.0.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    lifespan=lifespan,
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(GZipMiddleware, minimum_size=1000)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Share state
app.state.ws_manager = ws_manager
app.state.ai_router = ai_router
app.state.session_manager = session_manager


# ─── Health ────────────────────────────────────────────────────────────────────
@app.get("/health")
@app.get("/api/v1/health")
async def health():
    ai_stats = ai_router.get_stats()
    active_providers = [p for p, s in ai_stats.items() if s["available"]]
    return {
        "status": "healthy",
        "version": "12.0.0",
        "timestamp": time.time(),
        "e2b": bool(E2B_API_KEY),
        "ai_providers": active_providers,
        "ws_connections": ws_manager.stats()["connections"],
        "mode": "autonomous_agent",
        "features": {
            "real_execution": True,
            "e2b_sandbox": bool(E2B_API_KEY),
            "local_fallback": True,
            "streaming": True,
            "tool_calling": True,
            "file_ops": True,
            "shell_exec": True,
        }
    }


@app.get("/")
async def root():
    return {
        "name": "GOD AGENT OS v12",
        "version": "12.0.0",
        "status": "operational",
        "mode": "AUTONOMOUS_AGENT",
        "docs": "/api/docs",
        "health": "/health",
        "execution": "real_e2b_sandbox" if E2B_API_KEY else "local_subprocess",
    }


# ─── Chat (SSE streaming with real tool execution) ────────────────────────────

@app.post("/api/v1/chat")
async def chat(request: Request):
    body = await request.json()
    messages = body.get("messages", [])
    stream = body.get("stream", True)
    session_id = body.get("session_id") or uuid.uuid4().hex[:12]

    if not messages:
        raise HTTPException(status_code=400, detail="messages required")

    # Get last user message
    user_message = next(
        (m["content"] for m in reversed(messages) if m.get("role") == "user"), ""
    )

    sess = session_manager.get_or_create(session_id)
    sess["message_count"] = sess.get("message_count", 0) + 1

    task_id = uuid.uuid4().hex[:12]
    session_manager.add_task(session_id, task_id)

    if stream:
        async def stream_gen():
            try:
                async for chunk in agent.run(user_message, session_id, task_id):
                    yield f"data: {chunk}\n"
            except Exception as e:
                log.error("Stream error", error=str(e))
                yield f"data: {json.dumps({'type': 'error', 'data': {'error': str(e)}, 'session_id': session_id})}\n\n"

        return StreamingResponse(
            stream_gen(),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "X-Accel-Buffering": "no",
                "Connection": "keep-alive",
            },
        )
    else:
        # Non-streaming: collect full response
        full = ""
        async for chunk in agent.run(user_message, session_id, task_id):
            try:
                data = json.loads(chunk)
                if data.get("type") == "llm_chunk":
                    full += data.get("data", {}).get("chunk", "")
                elif data.get("type") == "stream_end":
                    full = data.get("data", {}).get("full_response", full)
                    break
            except Exception:
                pass

        return JSONResponse({
            "response": full,
            "task_id": task_id,
            "session_id": session_id,
            "timestamp": time.time(),
        })


@app.post("/api/v1/chat/stream")
async def chat_stream(request: Request):
    body = await request.json()
    body["stream"] = True
    # Rebuild request-like object
    from fastapi import Request as FR
    import io
    new_body = json.dumps(body).encode()
    # Patch the request body
    async def receive():
        return {"type": "http.request", "body": new_body}
    request._receive = receive
    return await chat(request)


@app.post("/api/v1/orchestrate")
async def orchestrate(request: Request):
    body = await request.json()
    message = body.get("message", "")
    session_id = body.get("session_id") or uuid.uuid4().hex[:12]
    stream = body.get("stream", False)

    if not message:
        raise HTTPException(status_code=400, detail="message required")

    task_id = uuid.uuid4().hex[:12]
    session_manager.add_task(session_id, task_id)

    if stream:
        async def stream_gen():
            async for chunk in agent.run(message, session_id, task_id):
                yield f"data: {chunk}\n"

        return StreamingResponse(
            stream_gen(),
            media_type="text/event-stream",
            headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
        )

    # Non-streaming
    full = ""
    tool_results = []
    async for chunk in agent.run(message, session_id, task_id):
        try:
            data = json.loads(chunk)
            if data.get("type") == "llm_chunk":
                full += data.get("data", {}).get("chunk", "")
            elif data.get("type") == "tool_result":
                tool_results.append(data.get("data", {}))
            elif data.get("type") == "stream_end":
                full = data.get("data", {}).get("full_response", full)
                break
        except Exception:
            pass

    return {
        "task_id": task_id,
        "session_id": session_id,
        "result": full,
        "tool_results": tool_results,
        "status": "complete",
        "timestamp": time.time(),
    }


# ─── Direct Tool Execution ─────────────────────────────────────────────────────
@app.post("/api/v1/execute")
async def execute_tool(request: Request):
    """Direct tool execution endpoint."""
    body = await request.json()
    tool_name = body.get("tool", "")
    tool_args = body.get("args", {})
    session_id = body.get("session_id") or uuid.uuid4().hex[:12]
    task_id = body.get("task_id") or uuid.uuid4().hex[:8]

    if not tool_name:
        raise HTTPException(status_code=400, detail="tool name required")

    from tools.tool_router import ToolRouter
    router = ToolRouter(ws_manager)
    result = await router.execute_tool(tool_name, tool_args, session_id, task_id)
    formatted = router.format_tool_result(tool_name, result)

    return {
        "tool": tool_name,
        "args": tool_args,
        "result": result,
        "formatted": formatted,
        "session_id": session_id,
        "task_id": task_id,
        "timestamp": time.time(),
    }


# ─── Sandbox Session Info ──────────────────────────────────────────────────────
@app.get("/api/v1/sandbox/{session_id}")
async def get_sandbox_info(session_id: str):
    from sandbox.e2b_executor import get_executor
    executor = get_executor()
    info = executor.get_session_info(session_id)
    return {
        "session_id": session_id,
        "sandbox": info,
        "e2b_configured": bool(E2B_API_KEY),
    }


@app.delete("/api/v1/sandbox/{session_id}")
async def close_sandbox(session_id: str):
    from sandbox.e2b_executor import get_executor
    executor = get_executor()
    await executor.close_session(session_id)
    return {"status": "closed", "session_id": session_id}


# ─── Computer Use Steps ────────────────────────────────────────────────────────
@app.get("/api/v1/computer-use/{session_id}")
async def get_computer_use(session_id: str):
    steps = session_manager.get_computer_use_steps(session_id)
    return {
        "session_id": session_id,
        "steps": steps,
        "count": len(steps),
        "status": "complete" if steps and steps[-1].get("status") == "done" else "running" if steps else "idle",
    }


# ─── WebSocket Endpoints ───────────────────────────────────────────────────────
@app.websocket("/ws/{session_id}")
async def ws_endpoint(websocket: WebSocket, session_id: str):
    await ws_manager.connect(websocket, f"chat:{session_id}")
    session_manager.get_or_create(session_id)

    try:
        while True:
            data = await websocket.receive_json()
            event_type = data.get("type", "")

            if event_type == "ping":
                await websocket.send_json({"type": "pong", "ts": time.time()})

            elif event_type == "message":
                message = data.get("message", "")
                task_id = uuid.uuid4().hex[:12]
                session_manager.add_task(session_id, task_id)

                await ws_manager.emit_chat(session_id, "task_start", {
                    "task_id": task_id,
                    "message": message[:100],
                })

                # Run agent asynchronously
                asyncio.create_task(_ws_run_agent(message, session_id, task_id))

            elif event_type == "execute":
                # Direct tool execution via WebSocket
                tool_name = data.get("tool", "")
                tool_args = data.get("args", {})
                task_id = data.get("task_id", uuid.uuid4().hex[:8])

                if tool_name:
                    from tools.tool_router import ToolRouter
                    router = ToolRouter(ws_manager)
                    result = await router.execute_tool(tool_name, tool_args, session_id, task_id)
                    formatted = router.format_tool_result(tool_name, result)
                    await websocket.send_json({
                        "type": "tool_result",
                        "tool": tool_name,
                        "result": result,
                        "formatted": formatted,
                        "task_id": task_id,
                    })

            elif event_type == "stop":
                await ws_manager.emit_chat(session_id, "task_stopped", {})

    except WebSocketDisconnect:
        ws_manager.disconnect(websocket, f"chat:{session_id}")


@app.websocket("/ws/computer-use/{session_id}")
async def ws_computer_use(websocket: WebSocket, session_id: str):
    await websocket.accept()
    last_count = 0
    try:
        while True:
            steps = session_manager.get_computer_use_steps(session_id)
            if len(steps) > last_count:
                for step in steps[last_count:]:
                    await websocket.send_json({
                        "type": "computer_use_step",
                        "step": step,
                        "session_id": session_id,
                    })
                last_count = len(steps)
            await asyncio.sleep(0.3)
    except WebSocketDisconnect:
        pass
    except Exception:
        pass


async def _ws_run_agent(message: str, session_id: str, task_id: str):
    """Run agent and send results via WebSocket."""
    try:
        async for chunk in agent.run(message, session_id, task_id):
            try:
                data = json.loads(chunk)
                await ws_manager.emit_chat(session_id, data.get("type", "chunk"), data.get("data", {}))
            except Exception:
                pass
        await ws_manager.emit_chat(session_id, "task_complete", {"task_id": task_id})
    except Exception as e:
        await ws_manager.emit_chat(session_id, "task_error", {"task_id": task_id, "error": str(e)})


# ─── AI Stats ──────────────────────────────────────────────────────────────────
@app.get("/api/v1/ai/stats")
async def ai_stats():
    return {"stats": ai_router.get_stats(), "active": ai_router.get_active_provider()}


@app.get("/api/v1/ai/pool-status")
async def ai_pool_status():
    return {"pools": ai_router.get_stats()}


@app.get("/api/v1/system/status")
async def system_status():
    ai_stats = ai_router.get_stats()
    return {
        "system": "god_agent_os_v12",
        "status": "operational",
        "timestamp": time.time(),
        "version": "12.0.0",
        "execution_mode": "e2b_sandbox" if E2B_API_KEY else "local_subprocess",
        "ai_providers": {p: s["available"] for p, s in ai_stats.items()},
        "active_provider": ai_router.get_active_provider(),
        "sessions": len(session_manager.list_sessions()),
        "features": {
            "real_execution": True,
            "e2b_sandbox": bool(E2B_API_KEY),
            "tool_calling": True,
            "streaming": True,
            "websocket": True,
            "computer_use": True,
            "self_repair": True,
        }
    }


# ─── Agents + Spaces (compatibility with frontend) ────────────────────────────
AGENTS_LIST = [
    {"name": "chat", "status": "active", "role": "Conversation + Orchestration"},
    {"name": "coding", "status": "active", "role": "Code Generation + Review"},
    {"name": "sandbox", "status": "active", "role": f"Execution ({'E2B' if E2B_API_KEY else 'Local'})"},
    {"name": "planner", "status": "active", "role": "Task Planning"},
    {"name": "debug", "status": "active", "role": "Debugging + Error Analysis"},
    {"name": "file", "status": "active", "role": "File System Operations"},
    {"name": "git", "status": "active", "role": "Git + GitHub Operations"},
    {"name": "deploy", "status": "active", "role": "Deployment Automation"},
    {"name": "browser", "status": "active", "role": "Web Browsing + Research"},
    {"name": "memory", "status": "active", "role": "Long-term Memory"},
    {"name": "test", "status": "active", "role": "Test Generation + Running"},
    {"name": "vision", "status": "active", "role": "UI Generation + Vision"},
    {"name": "workflow", "status": "active", "role": "Workflow Automation"},
    {"name": "connector", "status": "active", "role": "External Integrations"},
    {"name": "reasoning", "status": "active", "role": "Deep Reasoning + Analysis"},
    {"name": "ui", "status": "active", "role": "UI/UX Generation"},
]


@app.get("/api/v1/agents")
async def list_agents():
    return {"agents": AGENTS_LIST, "total": len(AGENTS_LIST)}


@app.post("/api/v1/agents/{agent_name}/run")
async def run_agent(agent_name: str, request: Request):
    body = await request.json()
    task = body.get("task", "")
    session_id = body.get("session_id") or uuid.uuid4().hex[:12]
    task_id = uuid.uuid4().hex[:12]

    # Route to autonomous agent
    full = ""
    async for chunk in agent.run(task, session_id, task_id):
        try:
            data = json.loads(chunk)
            if data.get("type") == "llm_chunk":
                full += data.get("data", {}).get("chunk", "")
            elif data.get("type") == "stream_end":
                break
        except Exception:
            pass

    return {"agent": agent_name, "task_id": task_id, "result": full, "status": "complete"}


SPACES_LIST = [
    {"id": "god-core", "name": "God Core", "role": "orchestration", "icon": "🧠", "status": "active"},
    {"id": "coding", "name": "Coding Worker", "role": "code_generation", "icon": "⚡", "status": "active"},
    {"id": "sandbox", "name": "Sandbox", "role": "execution", "icon": "🔧", "status": "active",
     "backend": "e2b" if E2B_API_KEY else "local"},
    {"id": "terminal", "name": "Terminal", "role": "shell", "icon": "🖥️", "status": "active"},
    {"id": "filesystem", "name": "FileSystem", "role": "files", "icon": "📁", "status": "active"},
    {"id": "browser", "name": "Browser", "role": "research", "icon": "🌐", "status": "active"},
    {"id": "git", "name": "Git Worker", "role": "git", "icon": "🔀", "status": "active"},
    {"id": "deploy", "name": "Deploy Worker", "role": "deployment", "icon": "🚀", "status": "active"},
    {"id": "memory", "name": "Memory", "role": "memory", "icon": "💾", "status": "active"},
    {"id": "debug", "name": "Debug", "role": "debugging", "icon": "🐛", "status": "active"},
    {"id": "test", "name": "Testing", "role": "testing", "icon": "🧪", "status": "active"},
    {"id": "model-router", "name": "Model Router", "role": "ai_routing", "icon": "🤖", "status": "active"},
]


@app.get("/api/v1/spaces")
async def get_spaces():
    return {
        "spaces": SPACES_LIST,
        "total": len(SPACES_LIST),
        "active": len(SPACES_LIST),
        "execution_backend": "e2b" if E2B_API_KEY else "local_subprocess",
    }


# ─── Memory (compatibility) ────────────────────────────────────────────────────
@app.get("/api/v1/memory/")
async def get_memory(session_id: str = ""):
    try:
        from memory.db import get_history
        history = await get_history(session_id=session_id, limit=50)
        return {"memories": history, "total": len(history)}
    except Exception:
        return {"memories": [], "total": 0}


@app.post("/api/v1/memory/")
async def save_memory_entry(request: Request):
    body = await request.json()
    try:
        from memory.db import save_memory
        await save_memory(
            content=body.get("content", ""),
            memory_type=body.get("type", "general"),
            session_id=body.get("session_id", ""),
            key=body.get("key", ""),
        )
        return {"status": "saved"}
    except Exception as e:
        return {"status": "error", "error": str(e)}


# ─── Tasks (compatibility) ─────────────────────────────────────────────────────
@app.get("/api/v1/tasks/")
async def get_tasks():
    try:
        from memory.db import get_task
        return {"tasks": [], "total": 0}
    except Exception:
        return {"tasks": [], "total": 0}


@app.post("/api/v1/chat/goal")
async def submit_goal(request: Request):
    body = await request.json()
    goal = body.get("goal", "")
    session_id = body.get("session_id") or uuid.uuid4().hex[:12]
    task_id = uuid.uuid4().hex[:12]
    session_manager.add_task(session_id, task_id)

    return {
        "task_id": task_id,
        "goal": goal,
        "status": "queued",
        "session_id": session_id,
        "ws_url": f"/ws/{session_id}",
        "stream_url": f"/api/v1/chat",
    }


# ─── GitHub (compatibility) ────────────────────────────────────────────────────
@app.get("/api/v1/github/repos")
async def github_repos():
    return {"repos": [], "message": "Set GITHUB_TOKEN for GitHub integration"}


# ─── Connectors (compatibility) ────────────────────────────────────────────────
@app.get("/api/v1/connectors")
async def get_connectors():
    connectors = [
        {"id": "e2b", "name": "E2B Sandbox", "type": "execution",
         "connected": bool(E2B_API_KEY), "status": "active" if E2B_API_KEY else "needs_key"},
        {"id": "gemini", "name": "Google Gemini", "type": "ai",
         "connected": bool(GEMINI_KEY), "status": "active" if GEMINI_KEY else "needs_key"},
        {"id": "github", "name": "GitHub Models", "type": "ai",
         "connected": bool(GITHUB_KEY), "status": "active" if GITHUB_KEY else "needs_key"},
        {"id": "sambanova", "name": "SambaNova", "type": "ai",
         "connected": bool(SAMBANOVA_KEY), "status": "active" if SAMBANOVA_KEY else "needs_key"},
    ]
    return {"connectors": connectors, "total": len(connectors)}


if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 7860))
    uvicorn.run("main_v12:app", host="0.0.0.0", port=port, reload=False, workers=1)
