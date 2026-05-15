const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:7860'
const WS_BASE = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:7860'

export const API_URL = API_BASE
export const WS_URL = WS_BASE

export async function fetchAPI(path: string, options?: RequestInit) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  if (!res.ok) throw new Error(`API error: ${res.status}`)
  return res.json()
}

export async function getKernelStatus() {
  return fetchAPI('/api/v1/kernel/status')
}

export async function getSpaces() {
  return fetchAPI('/api/v1/spaces')
}

export async function executeInSpace(spaceName: string, task: string, role: string, sessionId: string) {
  return fetchAPI(`/api/v1/spaces/${spaceName}/execute`, {
    method: 'POST',
    body: JSON.stringify({ task, role, session_id: sessionId }),
  })
}

export async function orchestrate(message: string, sessionId: string, context?: object) {
  return fetchAPI('/api/v1/kernel/orchestrate', {
    method: 'POST',
    body: JSON.stringify({ message, session_id: sessionId, context }),
  })
}

export async function getConnectors() {
  return fetchAPI('/api/v1/connectors')
}

export async function getHealth() {
  return fetchAPI('/api/v1/health')
}

export async function getTasks() {
  return fetchAPI('/api/v1/tasks/')
}

export async function getMemory() {
  return fetchAPI('/api/v1/memory/')
}

export function createWebSocket(path: string): WebSocket {
  return new WebSocket(`${WS_BASE}${path}`)
}
