import { create } from 'zustand'

export type Page = 
  | 'dashboard' 
  | 'spaces'
  | 'agents' 
  | 'tasks' 
  | 'memory' 
  | 'knowledge' 
  | 'workflows' 
  | 'analytics' 
  | 'settings'
  | 'connectors'

export type Space = 'core' | 'browser' | 'sandbox' | 'coding' | 'vision' | 'debug' | 'deploy' | 'communication'
export type Role = 'cognition' | 'automation' | 'execution' | 'repair' | 'visual_intelligence'

export interface SpaceStatus {
  name: Space
  active: boolean
  taskCount: number
  lastActive: number | null
  color: string
  icon: string
}

interface AppState {
  currentPage: Page
  activeSpace: Space | null
  currentRole: Role
  sidebarOpen: boolean
  spaces: Record<Space, SpaceStatus>
  setCurrentPage: (page: Page) => void
  setActiveSpace: (space: Space | null) => void
  setCurrentRole: (role: Role) => void
  setSidebarOpen: (open: boolean) => void
  activateSpace: (space: Space, role?: Role) => void
  deactivateSpace: (space: Space) => void
}

const initialSpaces: Record<Space, SpaceStatus> = {
  core:          { name: 'core',          active: false, taskCount: 0, lastActive: null, color: '#7c3aed', icon: '🧠' },
  browser:       { name: 'browser',       active: false, taskCount: 0, lastActive: null, color: '#2563eb', icon: '🌐' },
  sandbox:       { name: 'sandbox',       active: false, taskCount: 0, lastActive: null, color: '#059669', icon: '💻' },
  coding:        { name: 'coding',        active: false, taskCount: 0, lastActive: null, color: '#d97706', icon: '🔧' },
  vision:        { name: 'vision',        active: false, taskCount: 0, lastActive: null, color: '#db2777', icon: '👁️' },
  debug:         { name: 'debug',         active: false, taskCount: 0, lastActive: null, color: '#dc2626', icon: '🐛' },
  deploy:        { name: 'deploy',        active: false, taskCount: 0, lastActive: null, color: '#0891b2', icon: '🚀' },
  communication: { name: 'communication', active: false, taskCount: 0, lastActive: null, color: '#7c3aed', icon: '💬' },
}

export const useAppStore = create<AppState>((set) => ({
  currentPage: 'dashboard',
  activeSpace: null,
  currentRole: 'cognition',
  sidebarOpen: true,
  spaces: initialSpaces,

  setCurrentPage: (page) => set({ currentPage: page }),
  setActiveSpace: (space) => set({ activeSpace: space }),
  setCurrentRole: (role) => set({ currentRole: role }),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),

  activateSpace: (space, role = 'cognition') => set((state) => ({
    activeSpace: space,
    currentRole: role,
    spaces: {
      ...state.spaces,
      [space]: {
        ...state.spaces[space],
        active: true,
        lastActive: Date.now(),
        taskCount: state.spaces[space].taskCount + 1,
      }
    }
  })),

  deactivateSpace: (space) => set((state) => ({
    spaces: {
      ...state.spaces,
      [space]: { ...state.spaces[space], active: false }
    }
  })),
}))
