// ─── Zustand Global State Store ───────────────────────────────────────────────

import { create } from 'zustand'
import { Message, Task, TimelineEvent, AgentSession, TaskStep } from '@/types'
import { nanoid } from './nanoid'

interface AgentStore {
  // Session
  sessionId: string
  projectId: string
  setSessionId: (id: string) => void
  setProjectId: (id: string) => void

  // Messages (chat panel)
  messages: Message[]
  addMessage: (msg: Omit<Message, 'id' | 'timestamp'>) => string
  updateMessage: (id: string, updates: Partial<Message>) => void
  appendChunk: (id: string, chunk: string) => void
  clearMessages: () => void

  // Tasks
  tasks: Task[]
  activeTaskId: string | null
  setActiveTask: (id: string | null) => void
  addTask: (task: Task) => void
  updateTask: (id: string, updates: Partial<Task>) => void
  getTask: (id: string) => Task | undefined

  // Timeline events
  timeline: TimelineEvent[]
  addTimelineEvent: (event: Omit<TimelineEvent, 'id'>) => void
  updateTimelineEvent: (id: string, updates: Partial<TimelineEvent>) => void
  clearTimeline: () => void

  // Active steps
  activeSteps: TaskStep[]
  setActiveSteps: (steps: TaskStep[]) => void
  updateActiveStep: (name: string, updates: Partial<TaskStep>) => void

  // Connection status
  wsConnected: boolean
  wsRetries: number
  setWsConnected: (connected: boolean, retries?: number) => void

  // UI state
  sidebarOpen: boolean
  activePanel: 'chat' | 'timeline' | 'tasks' | 'memory'
  setSidebarOpen: (open: boolean) => void
  setActivePanel: (panel: 'chat' | 'timeline' | 'tasks' | 'memory') => void

  // Streaming
  isStreaming: boolean
  streamingMessageId: string | null
  setStreaming: (active: boolean, msgId?: string | null) => void

  // Backend health
  backendHealth: any
  setBackendHealth: (health: any) => void
}

function uid() {
  return Math.random().toString(36).slice(2, 10)
}

export const useAgentStore = create<AgentStore>((set, get) => ({
  sessionId: `sess_${uid()}`,
  projectId: '',
  setSessionId: (id) => set({ sessionId: id }),
  setProjectId: (id) => set({ projectId: id }),

  messages: [],
  addMessage: (msg) => {
    const id = uid()
    const full: Message = {
      ...msg,
      id,
      timestamp: Date.now() / 1000,
    }
    set((s) => ({ messages: [...s.messages, full] }))
    return id
  },
  updateMessage: (id, updates) =>
    set((s) => ({
      messages: s.messages.map((m) => (m.id === id ? { ...m, ...updates } : m)),
    })),
  appendChunk: (id, chunk) =>
    set((s) => ({
      messages: s.messages.map((m) =>
        m.id === id ? { ...m, content: m.content + chunk } : m
      ),
    })),
  clearMessages: () => set({ messages: [] }),

  tasks: [],
  activeTaskId: null,
  setActiveTask: (id) => set({ activeTaskId: id }),
  addTask: (task) =>
    set((s) => ({
      tasks: [task, ...s.tasks.filter((t) => t.id !== task.id)],
    })),
  updateTask: (id, updates) =>
    set((s) => ({
      tasks: s.tasks.map((t) => (t.id === id ? { ...t, ...updates } : t)),
    })),
  getTask: (id) => get().tasks.find((t) => t.id === id),

  timeline: [],
  addTimelineEvent: (event) => {
    const id = uid()
    set((s) => ({
      timeline: [
        ...s.timeline,
        { ...event, id },
      ],
    }))
  },
  updateTimelineEvent: (id, updates) =>
    set((s) => ({
      timeline: s.timeline.map((e) => (e.id === id ? { ...e, ...updates } : e)),
    })),
  clearTimeline: () => set({ timeline: [] }),

  activeSteps: [],
  setActiveSteps: (steps) => set({ activeSteps: steps }),
  updateActiveStep: (name, updates) =>
    set((s) => ({
      activeSteps: s.activeSteps.map((st) =>
        st.name === name ? { ...st, ...updates } : st
      ),
    })),

  wsConnected: false,
  wsRetries: 0,
  setWsConnected: (connected, retries = 0) =>
    set({ wsConnected: connected, wsRetries: retries }),

  sidebarOpen: true,
  activePanel: 'timeline',
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  setActivePanel: (panel) => set({ activePanel: panel }),

  isStreaming: false,
  streamingMessageId: null,
  setStreaming: (active, msgId = null) =>
    set({ isStreaming: active, streamingMessageId: msgId }),

  backendHealth: null,
  setBackendHealth: (health) => set({ backendHealth: health }),
}))
