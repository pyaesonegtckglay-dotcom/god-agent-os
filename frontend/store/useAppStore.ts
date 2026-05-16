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
export type ThemeMode = 'dark' | 'light'

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
  themeMode: ThemeMode
  spaces: Record<Space, SpaceStatus>
  setCurrentPage: (page: Page) => void
  setActiveSpace: (space: Space | null) => void
  setCurrentRole: (role: Role) => void
  setSidebarOpen: (open: boolean) => void
  setThemeMode: (mode: ThemeMode) => void
  activateSpace: (space: Space, role?: Role) => void
  deactivateSpace: (space: Space) => void
}

const STORAGE_KEY = 'god-agent-os-ui'

function getPersistedState() {
  if (typeof window === 'undefined') {
    return { currentPage: 'dashboard' as Page, sidebarOpen: true, themeMode: 'dark' as ThemeMode }
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    const parsed = raw ? JSON.parse(raw) : {}
    return {
      currentPage: (parsed.currentPage || 'dashboard') as Page,
      sidebarOpen: parsed.sidebarOpen ?? true,
      themeMode: (parsed.themeMode || 'dark') as ThemeMode,
    }
  } catch {
    return { currentPage: 'dashboard' as Page, sidebarOpen: true, themeMode: 'dark' as ThemeMode }
  }
}

function persist(partial: Partial<Pick<AppState, 'currentPage' | 'sidebarOpen' | 'themeMode'>>) {
  if (typeof window === 'undefined') return
  try {
    const current = getPersistedState()
    const next = { ...current, ...partial }
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  } catch {}
}

function applyTheme(mode: ThemeMode) {
  if (typeof document === 'undefined') return
  document.documentElement.setAttribute('data-theme', mode)
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

const persisted = getPersistedState()
applyTheme(persisted.themeMode)

export const useAppStore = create<AppState>((set) => ({
  currentPage: persisted.currentPage,
  activeSpace: null,
  currentRole: 'cognition',
  sidebarOpen: persisted.sidebarOpen,
  themeMode: persisted.themeMode,
  spaces: initialSpaces,

  setCurrentPage: (page) => {
    persist({ currentPage: page })
    set({ currentPage: page })
  },
  setActiveSpace: (space) => set({ activeSpace: space }),
  setCurrentRole: (role) => set({ currentRole: role }),
  setSidebarOpen: (open) => {
    persist({ sidebarOpen: open })
    set({ sidebarOpen: open })
  },
  setThemeMode: (mode) => {
    applyTheme(mode)
    persist({ themeMode: mode })
    set({ themeMode: mode })
  },

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
      },
    },
  })),

  deactivateSpace: (space) => set((state) => ({
    spaces: {
      ...state.spaces,
      [space]: { ...state.spaces[space], active: false },
    },
  })),
}))
