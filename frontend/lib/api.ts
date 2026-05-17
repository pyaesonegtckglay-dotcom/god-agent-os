/**
 * God Agent OS v12 — API Client
 * Real autonomous agent — E2B execution + live streaming
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

export interface ToolResult {
  tool: string
  success: boolean
  sandboxId?: string
  stdout?: string
  stderr?: string
  exitCode?: number
  output?: string
  durationMs?: number
}

export interface ComputerUseStepEvent {
  type: 'thinking' | 'coding' | 'terminal' | 'file' | 'browsing' | 'git' | 'deploy' | 'executing' | 'complete' | 'error'
  title: string
  detail?: string
  status?: 'running' | 'done' | 'error'
  tool?: string
  sandboxId?: string
  stdout?: string
  exitCode?: number
}

/**
 * Stream from autonomous agent — handles v12 event protocol
 * Events: llm_chunk, tool_executing, tool_result, agent_complete, stream_end, error
 */
export async function streamOrchestrate(
  message: string,
  sessionId: string,
  onChunk: (chunk: string) => void,
  onDone: (full: string) => void,
  onError: (err: string) => void,
  onComputerUseStep?: (step: ComputerUseStepEvent) => void,
  onToolResult?: (result: ToolResult) => void,
): Promise<AbortController> {
  const base = getApiBase()
  const controller = new AbortController()

  try {
    // Use /api/v1/agent — intent router (chat OR real E2B execute)
    const res = await fetch(`${base}/api/v1/agent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        message,
        stream: true,
        session_id: sessionId,
      }),
    })

    if (!res.ok) {
      const text = await res.text()
      onError(`Backend error ${res.status}: ${text.slice(0, 200)}`)
      return controller
    }

    const reader = res.body?.getReader()
    const decoder = new TextDecoder()
    let full = ''
    let buffer = ''

    if (!reader) {
      onError('No response body')
      return controller
    }

    // Emit initial thinking step
    onComputerUseStep?.({
      type: 'thinking',
      title: `Analyzing: ${message.slice(0, 60)}...`,
      status: 'running',
    })

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''  // Keep incomplete line in buffer

      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed.startsWith('data:')) continue

        const jsonStr = trimmed.slice(5).trim()
        if (!jsonStr || jsonStr === '[DONE]') {
          onDone(full)
          return controller
        }

        try {
          const event = JSON.parse(jsonStr)
          const eventType = event.type || ''
          const data = event.data || {}

          switch (eventType) {
            case 'llm_chunk': {
              const chunk = data.chunk || ''
              if (chunk) {
                full += chunk
                onChunk(chunk)
              }
              break
            }

            case 'thinking_start': {
              onComputerUseStep?.({
                type: 'thinking',
                title: `Reasoning (iteration ${data.iteration || 1})...`,
                status: 'running',
              })
              break
            }

            case 'agent_thinking': {
              onComputerUseStep?.({
                type: 'thinking',
                title: data.message ? `Processing: ${String(data.message).slice(0, 60)}` : 'Thinking...',
                status: 'running',
              })
              break
            }

            case 'agent_iteration': {
              onComputerUseStep?.({
                type: 'thinking',
                title: `Planning step ${data.iteration || 1}...`,
                status: 'running',
              })
              break
            }

            case 'tool_executing': {
              const toolName = data.tool || ''
              const stepType = getStepType(toolName)
              onComputerUseStep?.({
                type: stepType,
                title: `${getToolLabel(toolName)}: ${formatArgs(data.args)}`,
                status: 'running',
                tool: toolName,
              })
              break
            }

            case 'tool_result': {
              const toolName = data.tool || ''
              const stepType = getStepType(toolName)
              const raw = data.raw || {}
              const success = data.success !== false
              const sandboxId = data.sandbox_id || raw.sandbox_id || 'local'
              const stdout = raw.stdout || raw.output || ''
              const stderr = raw.stderr || ''
              const exitCode = raw.exit_code ?? 0

              onComputerUseStep?.({
                type: success ? stepType : 'error',
                title: success
                  ? `✅ ${getToolLabel(toolName)} completed (sandbox: ${sandboxId})`
                  : `❌ ${getToolLabel(toolName)} failed`,
                detail: stdout ? stdout.slice(0, 300) : (stderr ? stderr.slice(0, 200) : undefined),
                status: 'done',
                tool: toolName,
                sandboxId,
                stdout: stdout.slice(0, 500),
                exitCode,
              })

              onToolResult?.({
                tool: toolName,
                success,
                sandboxId,
                stdout: stdout.slice(0, 2000),
                stderr: stderr.slice(0, 500),
                exitCode,
                output: data.result?.slice(0, 2000),
                durationMs: raw._duration_ms,
              })

              // Inject tool output into chat as a system block
              if (data.result) {
                const resultBlock = `\n\n**Tool: ${getToolLabel(toolName)}** (${sandboxId})\n${data.result.slice(0, 1500)}`
                full += resultBlock
                onChunk(resultBlock)
              }
              break
            }

            case 'agent_complete': {
              onComputerUseStep?.({
                type: 'complete',
                title: `✅ Task complete — ${data.tools_called || 0} tools executed, ${data.iterations || 1} iterations`,
                status: 'done',
              })
              break
            }

            case 'stream_end': {
              const finalResponse = data.full_response || full
              onDone(finalResponse)
              return controller
            }

            case 'error': {
              onError(data.error || 'Unknown error')
              return controller
            }

            // Legacy events from older API
            case 'agent_start': {
              onComputerUseStep?.({
                type: 'thinking',
                title: `Agent started: ${String(data.message || '').slice(0, 60)}`,
                status: 'running',
              })
              break
            }

            case 'tool_called': {
              const toolName = data.tool || ''
              onComputerUseStep?.({
                type: getStepType(toolName),
                title: `Calling: ${getToolLabel(toolName)}`,
                status: 'running',
                tool: toolName,
              })
              break
            }

            case 'computer_use_step': {
              onComputerUseStep?.({
                type: (data.type as ComputerUseStepEvent['type']) || 'executing',
                title: data.title || '',
                detail: data.detail,
                status: data.status === 'done' ? 'done' : 'running',
              })
              break
            }
          }
        } catch (_e) {
          // Skip malformed JSON lines
        }
      }
    }

    onDone(full)
  } catch (e: unknown) {
    const msg = (e as Error).message || String(e)
    if (!msg.includes('abort')) onError(msg)
  }

  return controller
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getStepType(toolName: string): ComputerUseStepEvent['type'] {
  const map: Record<string, ComputerUseStepEvent['type']> = {
    execute_python: 'coding',
    execute_shell: 'terminal',
    write_file: 'file',
    read_file: 'file',
    delete_file: 'file',
    list_files: 'file',
    web_search: 'browsing',
    install_package: 'terminal',
    git_clone: 'git',
    git_commit: 'git',
    git_push: 'git',
    deploy: 'deploy',
  }
  return map[toolName] || 'executing'
}

function getToolLabel(toolName: string): string {
  const map: Record<string, string> = {
    execute_python: '🐍 Python Execution',
    execute_shell: '💻 Shell Command',
    write_file: '📝 Write File',
    read_file: '📖 Read File',
    delete_file: '🗑️ Delete File',
    list_files: '📁 List Files',
    web_search: '🔍 Web Search',
    install_package: '📦 Install Package',
  }
  return map[toolName] || toolName
}

function formatArgs(args: Record<string, unknown> | undefined): string {
  if (!args) return ''
  const key = Object.keys(args)[0]
  if (!key) return ''
  const val = String(args[key] || '').slice(0, 60)
  return val
}

// ─── Direct Tool Execution ────────────────────────────────────────────────────

export async function executeTool(
  tool: string,
  args: Record<string, unknown>,
  sessionId: string,
) {
  return fetchAPI('/api/v1/execute', {
    method: 'POST',
    body: JSON.stringify({ tool, args, session_id: sessionId }),
  })
}

// ─── Sandbox Info ─────────────────────────────────────────────────────────────

export async function getSandboxInfo(sessionId: string) {
  return fetchAPI(`/api/v1/sandbox/${sessionId}`)
}

// ─── Computer Use ─────────────────────────────────────────────────────────────

export async function getComputerUseSteps(sessionId: string) {
  return fetchAPI(`/api/v1/computer-use/${sessionId}`)
}

// ─── Spaces ──────────────────────────────────────────────────────────────────

export async function getSpaces() {
  return fetchAPI('/api/v1/spaces')
}

// ─── Agents ──────────────────────────────────────────────────────────────────

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

// ─── Direct execute (E2B sandbox, no LLM) ────────────────────────────────────

export interface ExecuteEvent {
  type: 'agent_start' | 'tool_executing' | 'sandbox_ready' | 'stdout' | 'stderr' | 'result' | 'tool_result' | 'agent_complete' | 'stream_end' | 'error'
  data?: any
  text?: string
  sandbox_id?: string
  backend?: string
  exit_code?: number
  success?: boolean
  duration_ms?: number
  session_id?: string
  error?: string
}

/**
 * Execute code directly in E2B sandbox with SSE streaming.
 * Returns AbortController so caller can cancel.
 */
export async function executeCode(
  opts: { language?: string; code: string; sessionId: string; timeout?: number },
  onEvent: (ev: ExecuteEvent) => void,
): Promise<AbortController> {
  const base = getApiBase()
  const controller = new AbortController()
  try {
    const res = await fetch(`${base}/api/v1/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        language: opts.language || 'python',
        code: opts.code,
        session_id: opts.sessionId,
        timeout: opts.timeout || 60,
        stream: true,
      }),
    })
    if (!res.ok || !res.body) {
      onEvent({ type: 'error', error: `HTTP ${res.status}` })
      return controller
    }
    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''
      for (const line of lines) {
        const t = line.trim()
        if (!t.startsWith('data:')) continue
        try {
          const ev = JSON.parse(t.slice(5).trim())
          onEvent(ev)
        } catch {}
      }
    }
  } catch (e: unknown) {
    const msg = (e as Error).message || String(e)
    if (!msg.includes('abort')) onEvent({ type: 'error', error: msg })
  }
  return controller
}

export async function killSandbox(sessionId: string) {
  return fetchAPI(`/api/v1/sandbox/${sessionId}`, { method: 'DELETE' })
}

export async function getSandboxInfo(sessionId: string) {
  return fetchAPI(`/api/v1/sandbox/${sessionId}`)
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
