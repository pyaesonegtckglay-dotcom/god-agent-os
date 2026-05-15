import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type NavPage = 'dashboard' | 'agents' | 'tasks' | 'memory' | 'knowledge' | 'workflows' | 'analytics' | 'settings'

export interface Agent {
  id: string
  name: string
  role: string
  status: 'active' | 'idle' | 'processing' | 'error'
  color: string
  icon: string
  tasks: number
  efficiency: number
  uptime: number
  lastAction: string
  lastActionTime: string
}

export interface Task {
  id: string
  title: string
  status: 'running' | 'completed' | 'pending' | 'failed'
  agent: string
  progress: number
  createdAt: string
  completedAt?: string
}

export interface ActivityItem {
  id: string
  agent: string
  action: string
  time: string
  type: 'success' | 'processing' | 'info' | 'warning'
  color: string
}

interface AppState {
  // Navigation
  currentPage: NavPage
  sidebarCollapsed: boolean
  commandPaletteOpen: boolean
  godModeActive: boolean

  // Data
  agents: Agent[]
  tasks: Task[]
  activity: ActivityItem[]
  metrics: {
    totalAgents: number
    tasksCompleted: number
    timeSaved: number
    successRate: number
  }
  systemResources: {
    cpu: number
    memory: number
    storage: number
    network: number
  }

  // Actions
  setCurrentPage: (page: NavPage) => void
  toggleSidebar: () => void
  setCommandPaletteOpen: (open: boolean) => void
  toggleGodMode: () => void
  updateSystemResources: (resources: Partial<AppState['systemResources']>) => void
}

export const AGENTS: Agent[] = [
  { id: '1', name: 'Research Agent', role: 'Web Intelligence', status: 'active', color: '#6366f1', icon: '🔬', tasks: 47, efficiency: 92, uptime: 99.8, lastAction: 'Completed market research analysis', lastActionTime: '2m ago' },
  { id: '2', name: 'Data Agent', role: 'Data Processing', status: 'active', color: '#22d3ee', icon: '📊', tasks: 83, efficiency: 98, uptime: 99.5, lastAction: 'Processed 1.2M data points', lastActionTime: '12m ago' },
  { id: '3', name: 'Content Agent', role: 'Content Generation', status: 'active', color: '#a78bfa', icon: '✍️', tasks: 31, efficiency: 95, uptime: 98.2, lastAction: 'Generated blog draft', lastActionTime: '25m ago' },
  { id: '4', name: 'Code Agent', role: 'Software Development', status: 'active', color: '#34d399', icon: '💻', tasks: 62, efficiency: 99, uptime: 99.9, lastAction: 'Deployed production API', lastActionTime: '1h ago' },
  { id: '5', name: 'Design Agent', role: 'UI/UX Design', status: 'active', color: '#f472b6', icon: '🎨', tasks: 24, efficiency: 90, uptime: 97.8, lastAction: 'Created UI/UX mockups', lastActionTime: '2h ago' },
  { id: '6', name: 'Workflow Agent', role: 'Automation', status: 'processing', color: '#fb923c', icon: '⚙️', tasks: 19, efficiency: 93, uptime: 98.1, lastAction: 'Running automation pipeline', lastActionTime: 'now' },
  { id: '7', name: 'Memory Agent', role: 'Knowledge Storage', status: 'idle', color: '#fbbf24', icon: '🧠', tasks: 156, efficiency: 97, uptime: 99.9, lastAction: 'Indexed 4,200 documents', lastActionTime: '3h ago' },
  { id: '8', name: 'Deploy Agent', role: 'Cloud Deployment', status: 'idle', color: '#f87171', icon: '🚀', tasks: 12, efficiency: 100, uptime: 99.7, lastAction: 'Deployed to Vercel', lastActionTime: '5h ago' },
]

export const ACTIVITY: ActivityItem[] = [
  { id: '1', agent: 'Research Agent', action: 'Completed market research analysis', time: '2m ago', type: 'success', color: '#6366f1' },
  { id: '2', agent: 'Data Agent', action: 'Processed 1.2M data points', time: '12m ago', type: 'processing', color: '#22d3ee' },
  { id: '3', agent: 'Content Agent', action: 'Generated blog draft', time: '25m ago', type: 'success', color: '#a78bfa' },
  { id: '4', agent: 'Code Agent', action: 'Deployed production API', time: '1h ago', type: 'success', color: '#34d399' },
  { id: '5', agent: 'Design Agent', action: 'Created UI/UX mockups', time: '2h ago', type: 'info', color: '#f472b6' },
  { id: '6', agent: 'Workflow Agent', action: 'Initiated automation pipeline', time: '3h ago', type: 'processing', color: '#fb923c' },
]

export const TASKS: Task[] = [
  { id: 't1', title: 'Analyze competitor pricing strategy', status: 'completed', agent: 'Research Agent', progress: 100, createdAt: '2h ago', completedAt: '2m ago' },
  { id: 't2', title: 'Generate Q4 performance report', status: 'running', agent: 'Data Agent', progress: 67, createdAt: '30m ago' },
  { id: 't3', title: 'Refactor authentication module', status: 'running', agent: 'Code Agent', progress: 45, createdAt: '1h ago' },
  { id: 't4', title: 'Create landing page copy', status: 'pending', agent: 'Content Agent', progress: 0, createdAt: '5m ago' },
  { id: 't5', title: 'Design system components v2', status: 'pending', agent: 'Design Agent', progress: 0, createdAt: '10m ago' },
  { id: 't6', title: 'Set up CI/CD pipeline', status: 'completed', agent: 'Deploy Agent', progress: 100, createdAt: '5h ago', completedAt: '4h ago' },
]

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      currentPage: 'dashboard',
      sidebarCollapsed: false,
      commandPaletteOpen: false,
      godModeActive: true,
      agents: AGENTS,
      tasks: TASKS,
      activity: ACTIVITY,
      metrics: {
        totalAgents: 12,
        tasksCompleted: 247,
        timeSaved: 128,
        successRate: 98.6,
      },
      systemResources: {
        cpu: 32,
        memory: 68,
        storage: 54,
        network: 29,
      },
      setCurrentPage: (page) => set({ currentPage: page }),
      toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
      setCommandPaletteOpen: (open) => set({ commandPaletteOpen: open }),
      toggleGodMode: () => set((state) => ({ godModeActive: !state.godModeActive })),
      updateSystemResources: (resources) =>
        set((state) => ({ systemResources: { ...state.systemResources, ...resources } })),
    }),
    { name: 'god-agent-os-store', partialize: (s) => ({ sidebarCollapsed: s.sidebarCollapsed, godModeActive: s.godModeActive }) }
  )
)
