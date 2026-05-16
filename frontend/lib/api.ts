const HF_SPACE = 'https://pyae1994-autonomous-coding-system.hf.space'
const HF_SPACE_WS = 'wss://pyae1994-autonomous-coding-system.hf.space'

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || HF_SPACE).replace(/\/$/, '')
const WS_BASE = (process.env.NEXT_PUBLIC_WS_URL || HF_SPACE_WS).replace(/\/$/, '')

export const API_URL = API_BASE
export const WS_URL = WS_BASE

export async function fetchAPI(path: string, options?: RequestInit) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...(options?.headers || {}) },
    ...options,
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(text || `API error: ${res.status}`)
  }

  return res.json()
}

export function createWebSocket(path: string): WebSocket {
  return new WebSocket(`${WS_BASE}${path}`)
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

export async function setConnectorToken(connectorId: string, token: string) {
  return fetchAPI('/api/v1/connectors/set-token', {
    method: 'POST',
    body: JSON.stringify({ connector_id: connectorId, token }),
  })
}

export async function getConnectorSummary() {
  return fetchAPI('/api/v1/connectors/summary')
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

export async function getSessions() {
  return fetchAPI('/api/v1/memory/sessions')
}

export async function getSessionHistory(sessionId: string) {
  return fetchAPI(`/api/v1/memory/history/${sessionId}`)
}

// ── N8N API ───────────────────────────────────────────────────────────────────
export async function n8nStatus() {
  return fetchAPI('/api/v1/n8n/status')
}

export async function n8nGetWorkflows(limit = 50) {
  return fetchAPI(`/api/v1/n8n/workflows?limit=${limit}`)
}

export async function n8nGetExecutions(workflowId?: string, limit = 20) {
  const q = workflowId ? `&workflow_id=${workflowId}` : ''
  return fetchAPI(`/api/v1/n8n/executions?limit=${limit}${q}`)
}

export async function n8nGetStats() {
  return fetchAPI('/api/v1/n8n/stats')
}

export async function n8nExecuteWorkflow(workflowId: string) {
  return fetchAPI(`/api/v1/n8n/workflows/${workflowId}/execute`, { method: 'POST' })
}

export async function n8nToggleWorkflow(workflowId: string, active: boolean) {
  return fetchAPI(`/api/v1/n8n/workflows/${workflowId}/activate`, {
    method: 'PATCH',
    body: JSON.stringify({ active }),
  })
}

export async function n8nSetConfig(url: string, apiKey: string) {
  return fetchAPI('/api/v1/n8n/config', {
    method: 'POST',
    body: JSON.stringify({ url, api_key: apiKey }),
  })
}

export async function n8nGetConfig() {
  return fetchAPI('/api/v1/n8n/config')
}

// ── Analytics (from health + memory) ─────────────────────────────────────────
export async function getAnalytics() {
  return fetchAPI('/api/v1/metrics')
}

export async function getMemoryStats() {
  return fetchAPI('/api/v1/memory/stats').catch(() => null)
}
