// ─── WebSocket Client with Auto-Reconnect + Event Buffering ──────────────────

import { StreamEvent } from '@/types'

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:7860'

type EventHandler = (event: StreamEvent) => void

interface WSOptions {
  onEvent?: EventHandler
  onConnect?: () => void
  onDisconnect?: () => void
  onError?: (err: Event) => void
  maxRetries?: number
  heartbeatInterval?: number
}

export class AgentWebSocket {
  private ws: WebSocket | null = null
  private url: string
  private opts: WSOptions
  private retryCount = 0
  private maxRetries: number
  private retryTimer: ReturnType<typeof setTimeout> | null = null
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null
  private seenIds = new Set<string>()
  private connected = false
  private intentionalClose = false

  constructor(path: string, opts: WSOptions = {}) {
    this.url = `${WS_URL}${path}`
    this.opts = opts
    this.maxRetries = opts.maxRetries ?? 10
  }

  connect() {
    if (this.ws?.readyState === WebSocket.OPEN) return
    this.intentionalClose = false
    this._connect()
  }

  private _connect() {
    try {
      this.ws = new WebSocket(this.url)

      this.ws.onopen = () => {
        this.connected = true
        this.retryCount = 0
        this.opts.onConnect?.()
        this._startHeartbeat()
      }

      this.ws.onmessage = (e) => {
        try {
          const event: StreamEvent = JSON.parse(e.data)
          // Deduplicate
          if (event.id && this.seenIds.has(event.id)) return
          if (event.id) this.seenIds.add(event.id)
          if (this.seenIds.size > 500) {
            const arr = Array.from(this.seenIds)
            this.seenIds = new Set(arr.slice(arr.length - 300))
          }
          this.opts.onEvent?.(event)
        } catch {}
      }

      this.ws.onclose = () => {
        this.connected = false
        this._stopHeartbeat()
        this.opts.onDisconnect?.()
        if (!this.intentionalClose) this._scheduleReconnect()
      }

      this.ws.onerror = (e) => {
        this.opts.onError?.(e)
      }
    } catch (err) {
      if (!this.intentionalClose) this._scheduleReconnect()
    }
  }

  private _scheduleReconnect() {
    if (this.retryCount >= this.maxRetries) return
    const delay = Math.min(1000 * Math.pow(2, this.retryCount), 30000)
    this.retryCount++
    this.retryTimer = setTimeout(() => this._connect(), delay)
  }

  private _startHeartbeat() {
    this.heartbeatTimer = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'ping', timestamp: Date.now() / 1000 }))
      }
    }, this.opts.heartbeatInterval ?? 15000)
  }

  private _stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer)
      this.heartbeatTimer = null
    }
  }

  send(data: object) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data))
    }
  }

  disconnect() {
    this.intentionalClose = true
    if (this.retryTimer) clearTimeout(this.retryTimer)
    this._stopHeartbeat()
    this.ws?.close()
    this.ws = null
    this.connected = false
  }

  isConnected() { return this.connected }
  getRetryCount() { return this.retryCount }
}

// ─── SSE Client for task streaming ────────────────────────────────────────────

export class TaskSSEClient {
  private url: string
  private eventSource: EventSource | null = null
  private onEvent: EventHandler

  constructor(taskId: string, onEvent: EventHandler) {
    this.url = `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:7860'}/api/v1/tasks/${taskId}/stream`
    this.onEvent = onEvent
  }

  connect() {
    this.eventSource = new EventSource(this.url)
    this.eventSource.onmessage = (e) => {
      try {
        const event: StreamEvent = JSON.parse(e.data)
        this.onEvent(event)
        if (event.type === 'stream_end' || event.type === 'task_completed' || event.type === 'task_failed') {
          this.disconnect()
        }
      } catch {}
    }
    this.eventSource.onerror = () => {
      this.disconnect()
    }
  }

  disconnect() {
    this.eventSource?.close()
    this.eventSource = null
  }
}

// ─── Chat streaming via fetch (SSE) ───────────────────────────────────────────

export async function streamChatSSE(
  messages: any[],
  sessionId: string,
  onChunk: (chunk: string) => void,
  onDone: (full: string) => void,
  onError?: (err: string) => void
) {
  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:7860'
  try {
    const res = await fetch(`${API_URL}/api/v1/chat/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages, session_id: sessionId, stream: true }),
    })

    if (!res.ok) {
      onError?.(`HTTP ${res.status}: ${res.statusText}`)
      return
    }

    const reader = res.body?.getReader()
    if (!reader) return
    const decoder = new TextDecoder()
    let full = ''
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''
      for (const line of lines) {
        if (!line.startsWith('data:')) continue
        const raw = line.slice(5).trim()
        if (!raw || raw === '[DONE]') continue
        try {
          const event = JSON.parse(raw)
          if (event.type === 'llm_chunk') {
            const chunk = event.data?.chunk || ''
            full += chunk
            onChunk(chunk)
          } else if (event.type === 'stream_end') {
            onDone(event.data?.full_response || full)
            return
          }
        } catch {}
      }
    }
    onDone(full)
  } catch (err: any) {
    onError?.(err.message || 'Stream error')
  }
}
