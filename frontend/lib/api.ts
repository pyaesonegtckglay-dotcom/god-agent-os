// ─── API Client Library ────────────────────────────────────────────────────────

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:7860'
const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:7860'

export const getApiUrl = () => API_URL
export const getWsUrl = () => WS_URL

// ─── Task API ─────────────────────────────────────────────────────────────────

export async function createTask(goal: string, sessionId: string, projectId = '') {
  const res = await fetch(`${API_URL}/api/v1/tasks/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ goal, session_id: sessionId, project_id: projectId, stream: true }),
  })
  if (!res.ok) throw new Error(`Create task failed: ${res.statusText}`)
  return res.json()
}

export async function getTask(taskId: string) {
  const res = await fetch(`${API_URL}/api/v1/tasks/${taskId}`)
  if (!res.ok) throw new Error(`Get task failed: ${res.statusText}`)
  return res.json()
}

export async function getTaskStatus(taskId: string) {
  const res = await fetch(`${API_URL}/api/v1/tasks/${taskId}/status`)
  if (!res.ok) throw new Error(`Get status failed: ${res.statusText}`)
  return res.json()
}

export async function cancelTask(taskId: string, reason = 'User cancelled') {
  const res = await fetch(`${API_URL}/api/v1/tasks/${taskId}/cancel`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reason }),
  })
  if (!res.ok) throw new Error(`Cancel failed: ${res.statusText}`)
  return res.json()
}

export async function retryTask(taskId: string) {
  const res = await fetch(`${API_URL}/api/v1/tasks/${taskId}/retry`, {
    method: 'POST',
  })
  if (!res.ok) throw new Error(`Retry failed: ${res.statusText}`)
  return res.json()
}

export async function listTasks(sessionId = '') {
  const url = sessionId
    ? `${API_URL}/api/v1/tasks/?session_id=${sessionId}`
    : `${API_URL}/api/v1/tasks/`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`List tasks failed: ${res.statusText}`)
  return res.json()
}

export async function generatePlan(goal: string, sessionId: string) {
  const res = await fetch(`${API_URL}/api/v1/plan`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ goal, session_id: sessionId, stream: false }),
  })
  if (!res.ok) throw new Error(`Plan failed: ${res.statusText}`)
  return res.json()
}

// ─── Chat API (non-streaming) ─────────────────────────────────────────────────

export async function sendChatMessage(messages: any[], sessionId: string, stream = false) {
  const res = await fetch(`${API_URL}/api/v1/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages, session_id: sessionId, stream }),
  })
  if (!res.ok) throw new Error(`Chat failed: ${res.statusText}`)
  return res.json()
}

// ─── GitHub API ───────────────────────────────────────────────────────────────

export async function getGitHubStatus() {
  try {
    const res = await fetch(`${API_URL}/api/v1/github/status`)
    if (!res.ok) return { configured: false }
    return res.json()
  } catch {
    return { configured: false }
  }
}

// ─── Health API ───────────────────────────────────────────────────────────────

export async function getHealth() {
  try {
    const res = await fetch(`${API_URL}/api/v1/health`)
    if (!res.ok) return null
    return res.json()
  } catch {
    return null
  }
}

// ─── Memory API ───────────────────────────────────────────────────────────────

export async function searchMemory(query: string, sessionId = '') {
  const res = await fetch(`${API_URL}/api/v1/memory/search`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, session_id: sessionId, limit: 10 }),
  })
  if (!res.ok) return { results: [] }
  return res.json()
}

export async function getHistory(sessionId: string) {
  const res = await fetch(`${API_URL}/api/v1/memory/history/${sessionId}`)
  if (!res.ok) return { history: [] }
  return res.json()
}
