/**
 * God Agent OS v11 — API Client
 * Connects to real backend (HF Space or custom URL)
 */

export const DEFAULT_BACKEND = process.env.NEXT_PUBLIC_API_URL || 'https://pyae1994-autonomous-coding-system.hf.space'

function getBackendUrl(): string {
  if (typeof window === 'undefined') return DEFAULT_BACKEND
  try {
    const stored = localStorage.getItem('god-agent-store')
    if (stored) {
      const parsed = JSON.parse(stored)
      return parsed?.state?.backendUrl || DEFAULT_BACKEND
    }
  } catch {}
  return DEFAULT_BACKEND
}

export function getApiBase(): string {
  return getBackendUrl()
}

export function getWsBase(): string {
  return getApiBase().replace(/^https?:\/\//, (m) => m === 'https://' ? 'wss://' : 'ws://')
}

export async function fetchAPI(path: string, options?: RequestInit) {
  const base = getApiBase()
  const res = await fetch(`${base}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(options?.headers || {}),
    },
    ...options,
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`API ${res.status}: ${text.slice(0, 200) || res.statusText}`)
  }
  return res.json()
}

// ─── Health ────────────────────────────────────────────────────────────────

export async function getHealth() {
  return fetchAPI('/health')
}

export async function getSystemStatus() {
  return fetchAPI('/api/v1/system/status')
}

// ─── Chat / Orchestration ─────────────────────────────────────────────────

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
}

export async function sendChat(messages: ChatMessage[], options?: {
  stream?: boolean
  session_id?: string
  model?: string
  temperature?: number
  max_tokens?: number
}) {
  return fetchAPI('/api/v1/chat', {
    method: 'POST',
    body: JSON.stringify({
      messages,
      stream: false,
      session_id: options?.session_id || '',
      model: options?.model || 'gemini-2.0-flash',
      temperature: options?.temperature ?? 0.7,
      max_tokens: options?.max_tokens ?? 4096,
    }),
  })
}

export function streamChat(messages: ChatMessage[], options?: {
  session_id?: string
  model?: string
  temperature?: number
  max_tokens?: number
}): EventSource {
  // Use fetch for SSE
  return new EventSource(`${getApiBase()}/api/v1/chat/stream`)
}

export async function orchestrate(message: string, sessionId: string, context?: object) {
  return fetchAPI('/api/v1/orchestrate', {
    method: 'POST',
    body: JSON.stringify({
      message,
      session_id: sessionId,
      stream: false,
      context: context || {},
    }),
  })
}

export async function streamOrchestrate(
  message: string,
  sessionId: string,
  onChunk: (chunk: string) => void,
  onDone: (full: string) => void,
  onError: (err: string) => void,
  onComputerUseStep?: (step: { type: string; title: string; detail?: string }) => void
) {
  const base = getApiBase()
  const controller = new AbortController()

  // Emit thinking step immediately
  onComputerUseStep?.({ type: 'thinking', title: `Analyzing request...`, detail: message.slice(0, 80) })

  try {
    // First try streaming
    const res = await fetch(`${base}/api/v1/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        messages: [{ role: 'user', content: message }],
        stream: true,
        session_id: sessionId,
      }),
    })

    if (!res.ok) {
      const text = await res.text()
      // Try non-streaming fallback
      return await _nonStreamFallback(base, message, sessionId, controller, onChunk, onDone, onError, onComputerUseStep)
    }

    const contentType = res.headers.get('content-type') || ''
    
    // If not streaming response, parse as JSON
    if (!contentType.includes('text/event-stream') && !contentType.includes('text/plain')) {
      const json = await res.json()
      const reply = json?.response || json?.message || json?.content || json?.choices?.[0]?.message?.content || JSON.stringify(json)
      if (reply) {
        onComputerUseStep?.({ type: 'complete', title: 'Response received' })
        onDone(reply)
      } else {
        onError('Empty response from backend')
      }
      return controller
    }

    const reader = res.body?.getReader()
    const decoder = new TextDecoder()
    let full = ''

    if (!reader) {
      return await _nonStreamFallback(base, message, sessionId, controller, onChunk, onDone, onError, onComputerUseStep)
    }

    onComputerUseStep?.({ type: 'thinking', title: `Processing: ${message.slice(0, 60)}...` })

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      const text = decoder.decode(value, { stream: true })
      const lines = text.split('\n')
      for (const line of lines) {
        if (!line.startsWith('data:')) continue
        const jsonStr = line.slice(5).trim()
        if (jsonStr === '[DONE]') { onDone(full); return controller }
        try {
          const event = JSON.parse(jsonStr)
          if (event.type === 'llm_chunk') {
            const chunk = event.data?.chunk || ''
            full += chunk
            onChunk(chunk)
          } else if (event.type === 'stream_end') {
            onDone(event.data?.full_response || full)
            return controller
          } else if (event.type === 'agent_start') {
            onComputerUseStep?.({
              type: 'thinking',
              title: `${event.data?.agent || 'Agent'}: ${event.data?.task?.slice(0, 60) || ''}`,
            })
          } else if (event.type === 'tool_called') {
            onComputerUseStep?.({
              type: event.data?.tool?.includes('browser') ? 'browsing' :
                    event.data?.tool?.includes('code') ? 'coding' :
                    event.data?.tool?.includes('git') ? 'git' :
                    event.data?.tool?.includes('deploy') ? 'deploy' : 'executing',
              title: event.data?.tool || 'Tool execution',
              detail: event.data?.step,
            })
          } else if (event.type === 'code_generated') {
            onComputerUseStep?.({
              type: 'coding',
              title: `Generated ${event.data?.code_blocks || 0} code blocks (${event.data?.total_lines || 0} lines)`,
              detail: event.data?.languages?.join(', '),
            })
          } else if (event.response || event.message || event.content) {
            // Direct JSON response embedded in SSE
            const reply = event.response || event.message || event.content
            full += reply
            onChunk(reply)
          }
        } catch {
          // Plain text chunk
          const chunk = line.slice(5).trim()
          if (chunk && chunk !== '[DONE]') {
            full += chunk
            onChunk(chunk)
          }
        }
      }
    }

    if (full) {
      onDone(full)
    } else {
      // Streaming gave no content, try non-streaming
      return await _nonStreamFallback(base, message, sessionId, controller, onChunk, onDone, onError, onComputerUseStep)
    }
  } catch (e: unknown) {
    const msg = (e as Error).message || String(e)
    if (msg.includes('abort')) return controller
    // Try non-streaming fallback
    return await _nonStreamFallback(base, message, sessionId, controller, onChunk, onDone, onError, onComputerUseStep)
  }
  return controller
}

// ─── Non-streaming fallback ────────────────────────────────────────────────────

async function _nonStreamFallback(
  base: string,
  message: string,
  sessionId: string,
  controller: AbortController,
  onChunk: (chunk: string) => void,
  onDone: (full: string) => void,
  onError: (err: string) => void,
  onComputerUseStep?: (step: { type: string; title: string; detail?: string }) => void
) {
  onComputerUseStep?.({ type: 'thinking', title: 'Sending to backend...' })
  try {
    // Try /api/v1/orchestrate first
    const res = await fetch(`${base}/api/v1/orchestrate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({ message, session_id: sessionId, stream: false }),
    })
    if (res.ok) {
      const json = await res.json()
      const reply = json?.response || json?.message || json?.content || json?.result || JSON.stringify(json)
      if (reply) {
        onComputerUseStep?.({ type: 'complete', title: 'Response received' })
        onDone(reply)
        return controller
      }
    }
  } catch {}

  try {
    // Try /api/v1/chat non-streaming
    const res = await fetch(`${base}/api/v1/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        messages: [{ role: 'user', content: message }],
        stream: false,
        session_id: sessionId,
      }),
    })
    if (res.ok) {
      const json = await res.json()
      const reply = json?.response || json?.message || json?.content ||
        json?.choices?.[0]?.message?.content || JSON.stringify(json)
      if (reply) {
        onComputerUseStep?.({ type: 'complete', title: 'Response received' })
        onDone(reply)
        return controller
      }
    }
  } catch (e: unknown) {
    const msg = (e as Error).message || String(e)
    if (!msg.includes('abort')) onError(msg)
  }

  onError('No response from backend. Make sure your HF Space is running.')
  return controller
}

// ─── Spaces ─────────────────────────────────────────────────────────────────

export async function getSpaces() {
  return fetchAPI('/api/v1/spaces')
}

// ─── Agents ─────────────────────────────────────────────────────────────────

export async function getAgents() {
  return fetchAPI('/api/v1/agents')
}

export async function runAgent(agentName: string, task: string, sessionId: string) {
  return fetchAPI(`/api/v1/agents/${agentName}/run`, {
    method: 'POST',
    body: JSON.stringify({ task, session_id: sessionId }),
  })
}

// ─── Tasks ───────────────────────────────────────────────────────────────────

export async function getTasks() {
  return fetchAPI('/api/v1/tasks/')
}

export async function createTask(goal: string, sessionId: string) {
  return fetchAPI('/api/v1/chat/goal', {
    method: 'POST',
    body: JSON.stringify({ goal, session_id: sessionId }),
  })
}

// ─── Memory ──────────────────────────────────────────────────────────────────

export async function getMemory() {
  return fetchAPI('/api/v1/memory/')
}

// ─── Connectors ──────────────────────────────────────────────────────────────

export async function getConnectors() {
  return fetchAPI('/api/v1/connectors')
}

// ─── AI Stats ────────────────────────────────────────────────────────────────

export async function getAIStats() {
  return fetchAPI('/api/v1/ai/stats')
}

export async function getPoolStatus() {
  return fetchAPI('/api/v1/ai/pool-status')
}

// ─── WebSocket ────────────────────────────────────────────────────────────────

export function createWebSocket(sessionId: string): WebSocket {
  return new WebSocket(`${getWsBase()}/ws/${sessionId}`)
}

export function createComputerUseWS(sessionId: string): WebSocket {
  return new WebSocket(`${getWsBase()}/ws/computer-use/${sessionId}`)
}

// ─── Export URLs ─────────────────────────────────────────────────────────────
export const API_URL = DEFAULT_BACKEND
export const WS_URL = DEFAULT_BACKEND.replace(/^https?:\/\//, (m) => m === 'https://' ? 'wss://' : 'ws://')
