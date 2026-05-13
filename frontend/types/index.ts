// ─── Core Types ────────────────────────────────────────────────────────────────

export type TaskStatus =
  | 'queued' | 'initializing' | 'planning' | 'executing'
  | 'streaming' | 'waiting_input' | 'retrying' | 'finalizing'
  | 'completed' | 'failed' | 'cancelled'

export type EventType =
  | 'task_created' | 'task_queued' | 'task_started' | 'plan_generated'
  | 'step_started' | 'step_progress' | 'tool_called' | 'tool_result'
  | 'llm_chunk' | 'memory_updated' | 'retry_attempt' | 'step_completed'
  | 'warning' | 'error' | 'task_completed' | 'task_failed'
  | 'heartbeat' | 'connected' | 'stream_start' | 'stream_end'
  | 'agent_event'

export interface StreamEvent {
  id?: string
  type: EventType | string
  task_id?: string
  session_id?: string
  timestamp: number
  data: Record<string, any>
}

export interface TaskStep {
  id: string
  name: string
  description: string
  tool?: string
  status: 'pending' | 'running' | 'completed' | 'failed'
  output?: string
  error?: string
  started_at?: number
  completed_at?: number
  duration_ms?: number
}

export interface TaskPlan {
  goal: string
  steps: TaskStep[]
  estimated_duration: number
  tools_needed: string[]
  created_at: number
}

export interface Task {
  id: string
  goal: string
  status: TaskStatus
  session_id: string
  project_id: string
  plan?: TaskPlan
  result?: string
  error?: string
  metadata?: Record<string, any>
  created_at: number
  started_at?: number
  completed_at?: number
  retry_count: number
  ws_url?: string
  stream_url?: string
}

export interface Message {
  id: string
  role: 'user' | 'assistant' | 'system' | 'tool'
  content: string
  timestamp: number
  streaming?: boolean
  task_id?: string
  metadata?: Record<string, any>
}

export interface TimelineEvent {
  id: string
  type: string
  label: string
  description?: string
  timestamp: number
  status: 'pending' | 'running' | 'completed' | 'failed' | 'warning'
  tool?: string
  data?: Record<string, any>
  duration_ms?: number
}

export interface AgentSession {
  id: string
  project_id: string
  tasks: Task[]
  messages: Message[]
  timeline: TimelineEvent[]
  active_task_id?: string
  created_at: number
  last_active: number
}

export type ToolIcon = {
  [key: string]: string
}
