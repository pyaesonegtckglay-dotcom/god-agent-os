/**
 * God Mode+ API Client
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

async function apiFetch(path: string, options?: RequestInit) {
  const res = await fetch(`${API_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  if (!res.ok) throw new Error(`API ${res.status}: ${await res.text()}`)
  return res.json()
}

// ─── Tasks ────────────────────────────────────────────────────────────────────
export async function createTask(goal: string, sessionId: string, options?: {
  githubRepo?: string
  autoCommit?: boolean
  metadata?: Record<string, any>
}) {
  return apiFetch('/api/v1/tasks/', {
    method: 'POST',
    body: JSON.stringify({
      goal,
      session_id: sessionId,
      github_repo: options?.githubRepo || '',
      auto_commit: options?.autoCommit || false,
      metadata: options?.metadata || {},
    }),
  })
}

export async function getTask(taskId: string) {
  return apiFetch(`/api/v1/tasks/${taskId}`)
}

export async function getTasks(sessionId?: string, limit = 50) {
  const q = sessionId ? `?session_id=${sessionId}&limit=${limit}` : `?limit=${limit}`
  return apiFetch(`/api/v1/tasks/${q}`)
}

export async function cancelTask(taskId: string) {
  return apiFetch(`/api/v1/tasks/${taskId}/cancel`, { method: 'POST' })
}

export async function retryTask(taskId: string) {
  return apiFetch(`/api/v1/tasks/${taskId}/retry`, { method: 'POST' })
}

export async function getTaskEvents(taskId: string) {
  return apiFetch(`/api/v1/tasks/${taskId}/events`)
}

// ─── Chat ─────────────────────────────────────────────────────────────────────
export async function streamChatSSE(
  messages: Array<{ role: string; content: string }>,
  sessionId: string,
  onChunk: (chunk: string) => void,
  onComplete: (full: string) => void,
  onError: (err: string) => void,
) {
  try {
    const res = await fetch(`${API_URL}/api/v1/chat/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages, session_id: sessionId }),
    })
    if (!res.ok) throw new Error(`${res.status}`)
    if (!res.body) throw new Error('No body')

    const reader = res.body.getReader()
    const dec = new TextDecoder()
    let full = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      const text = dec.decode(value, { stream: true })
      for (const line of text.split('\n')) {
        if (!line.startsWith('data:')) continue
        const data = line.slice(5).trim()
        if (data === '[DONE]') { onComplete(full); return }
        try {
          const obj = JSON.parse(data)
          const chunk = obj.chunk || obj.content || obj.delta || ''
          if (chunk) { full += chunk; onChunk(chunk) }
        } catch {}
      }
    }
    onComplete(full)
  } catch (e: any) {
    onError(e.message)
  }
}

// ─── Orchestrator ─────────────────────────────────────────────────────────────
export async function orchestrate(message: string, sessionId: string, context?: Record<string, any>) {
  return apiFetch('/api/v1/agents/orchestrate', {
    method: 'POST',
    body: JSON.stringify({ message, session_id: sessionId, context: context || {} }),
  })
}

// ─── Memory ───────────────────────────────────────────────────────────────────
export async function getMemory(sessionId: string, limit = 20) {
  return apiFetch(`/api/v1/memory/?session_id=${sessionId}&limit=${limit}`)
}

export async function searchMemory(query: string, sessionId?: string) {
  const q = sessionId ? `?q=${encodeURIComponent(query)}&session_id=${sessionId}` : `?q=${encodeURIComponent(query)}`
  return apiFetch(`/api/v1/memory/search${q}`)
}

// ─── Connectors ───────────────────────────────────────────────────────────────
export async function getConnectors() {
  return apiFetch('/api/v1/connectors/')
}

export async function getConnectorSummary() {
  return apiFetch('/api/v1/connectors/summary')
}

export async function setConnectorToken(connectorId: string, token: string) {
  return apiFetch('/api/v1/connectors/set-token', {
    method: 'POST',
    body: JSON.stringify({ connector_id: connectorId, token }),
  })
}

// ─── Sandbox ──────────────────────────────────────────────────────────────────
export async function sandboxExecute(command: string, cwd?: string) {
  return apiFetch('/api/v1/agents/sandbox/execute', {
    method: 'POST',
    body: JSON.stringify({ command, cwd: cwd || '' }),
  })
}

export async function sandboxWriteFile(filename: string, content: string) {
  return apiFetch('/api/v1/agents/sandbox/file', {
    method: 'POST',
    body: JSON.stringify({ filename, content }),
  })
}

export async function getWorkspaceInfo() {
  return apiFetch('/api/v1/agents/sandbox/workspace')
}

// ─── AI Router ────────────────────────────────────────────────────────────────
export async function getAIRouterStats() {
  return apiFetch('/api/v1/agents/ai-router/stats')
}

// ─── GitHub ───────────────────────────────────────────────────────────────────
export async function getGitHubStatus() {
  return apiFetch('/api/v1/github/status')
}

// ─── Health ───────────────────────────────────────────────────────────────────
export async function getHealth() {
  return apiFetch('/api/v1/health')
}
