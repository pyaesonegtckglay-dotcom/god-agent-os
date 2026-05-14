/**
 * God Mode+ Global State — Zustand Store
 * Manages: messages, agents, tasks, themes, locale, connectors
 */

import { create } from 'zustand'
import { nanoid } from './nanoid'

export type Theme = 'dark' | 'light' | 'amoled' | 'neon' | 'glass'
export type Locale = 'en' | 'my'
export type AgentName = 'chat' | 'planner' | 'coding' | 'debug' | 'memory' | 'connector' | 'deploy' | 'workflow' | 'sandbox' | 'ui'
export type ActivePanel = 'timeline' | 'tasks' | 'memory' | 'connectors' | 'sandbox'

export interface Message {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  streaming?: boolean
  timestamp: number
  agent?: AgentName
  metadata?: Record<string, any>
}

export interface AgentStatus {
  name: AgentName
  status: 'idle' | 'thinking' | 'executing' | 'complete' | 'error'
  currentTask?: string
  lastActive?: number
}

export interface TaskEvent {
  id: string
  type: string
  data: Record<string, any>
  timestamp: number
  agent?: AgentName
}

export interface ConnectorInfo {
  id: string
  name: string
  connected: boolean
  icon: string
  color: string
  category: string
  description: string
}

interface GodStore {
  // Session
  sessionId: string
  
  // Messages
  messages: Message[]
  isStreaming: boolean
  streamingMessageId: string | null
  
  // Mode
  mode: 'agent' | 'chat'
  setMode: (m: 'agent' | 'chat') => void
  
  // Theme & Locale
  theme: Theme
  locale: Locale
  setTheme: (t: Theme) => void
  setLocale: (l: Locale) => void
  
  // Panels
  activePanel: ActivePanel
  setActivePanel: (p: ActivePanel) => void
  sidebarOpen: boolean
  setSidebarOpen: (v: boolean) => void
  
  // Active task
  activeTaskId: string | null
  setActiveTaskId: (id: string | null) => void
  
  // Task events (execution timeline)
  events: TaskEvent[]
  addEvent: (e: Omit<TaskEvent, 'id' | 'timestamp'>) => void
  clearEvents: () => void
  
  // Agent statuses
  agents: Record<AgentName, AgentStatus>
  updateAgentStatus: (name: AgentName, s: Partial<AgentStatus>) => void
  
  // Connectors
  connectors: ConnectorInfo[]
  setConnectors: (c: ConnectorInfo[]) => void
  
  // Message actions
  addMessage: (m: Omit<Message, 'id' | 'timestamp'>) => string
  appendChunk: (id: string, chunk: string) => void
  updateMessage: (id: string, updates: Partial<Message>) => void
  setStreaming: (v: boolean, id: string | null) => void
  clearMessages: () => void
}

const AGENT_NAMES: AgentName[] = ['chat','planner','coding','debug','memory','connector','deploy','workflow','sandbox','ui']

const defaultAgents: Record<AgentName, AgentStatus> = Object.fromEntries(
  AGENT_NAMES.map(n => [n, { name: n, status: 'idle' }])
) as Record<AgentName, AgentStatus>

export const useAgentStore = create<GodStore>((set, get) => ({
  sessionId: `sess_${nanoid(16)}`,
  
  messages: [],
  isStreaming: false,
  streamingMessageId: null,
  
  mode: 'agent',
  setMode: (mode) => set({ mode }),
  
  theme: 'dark',
  locale: 'en',
  setTheme: (theme) => {
    set({ theme })
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-theme', theme)
    }
  },
  setLocale: (locale) => set({ locale }),
  
  activePanel: 'timeline',
  setActivePanel: (activePanel) => set({ activePanel }),
  sidebarOpen: true,
  setSidebarOpen: (v) => set({ sidebarOpen: v }),
  
  activeTaskId: null,
  setActiveTaskId: (id) => set({ activeTaskId: id }),
  
  events: [],
  addEvent: (e) => set(s => ({
    events: [...s.events.slice(-200), { ...e, id: nanoid(8), timestamp: Date.now() }]
  })),
  clearEvents: () => set({ events: [] }),
  
  agents: defaultAgents,
  updateAgentStatus: (name, updates) => set(s => ({
    agents: { ...s.agents, [name]: { ...s.agents[name], ...updates } }
  })),
  
  connectors: [],
  setConnectors: (connectors) => set({ connectors }),
  
  addMessage: (m) => {
    const id = nanoid(12)
    set(s => ({
      messages: [...s.messages, { ...m, id, timestamp: Date.now() }]
    }))
    return id
  },
  
  appendChunk: (id, chunk) => set(s => ({
    messages: s.messages.map(m =>
      m.id === id ? { ...m, content: m.content + chunk } : m
    )
  })),
  
  updateMessage: (id, updates) => set(s => ({
    messages: s.messages.map(m => m.id === id ? { ...m, ...updates } : m)
  })),
  
  setStreaming: (isStreaming, streamingMessageId) => set({ isStreaming, streamingMessageId }),
  
  clearMessages: () => set({ messages: [], events: [] }),
}))
