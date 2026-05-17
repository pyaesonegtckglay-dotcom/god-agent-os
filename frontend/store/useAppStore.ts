import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { SPACE_CATALOG, type WorkerRole } from '@/lib/spaceCatalog'

export type Page =
  | 'chat'
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
  | 'computer-use'

export type Space = string
export type Role = WorkerRole
export type Theme = 'dark' | 'amoled' | 'neon' | 'glass'
export type Locale = 'en' | 'my'

export interface SpaceStatus {
  name: Space
  active: boolean
  taskCount: number
  lastActive: number | null
  color: string
  icon: string
}

// ─── Computer-Use Step (Manus-style) ─────────────────────────────────────────
export interface ComputerUseStep {
  id: string
  type: 'thinking' | 'browsing' | 'coding' | 'executing' | 'terminal' | 'file' | 'git' | 'deploy' | 'complete' | 'error' | 'reading' | 'writing' | 'searching' | 'sandbox' | 'done'
  title: string
  detail?: string
  status: 'running' | 'done' | 'error'
  timestamp: number
  data?: Record<string, unknown>
}

interface AppState {
  currentPage: Page
  activeSpace: Space | null
  currentRole: Role
  sidebarOpen: boolean
  theme: Theme
  locale: Locale
  spaces: Record<string, SpaceStatus>
  computerUseSteps: ComputerUseStep[]
  isComputerUseOpen: boolean
  backendUrl: string
  // Actions
  setCurrentPage: (page: Page) => void
  setActiveSpace: (space: Space | null) => void
  setCurrentRole: (role: Role) => void
  setSidebarOpen: (open: boolean) => void
  setTheme: (theme: Theme) => void
  setLocale: (locale: Locale) => void
  activateSpace: (space: Space, role?: Role) => void
  deactivateSpace: (space: Space) => void
  addComputerUseStep: (step: Omit<ComputerUseStep, 'id' | 'timestamp'>) => void
  clearComputerUseSteps: () => void
  setComputerUseOpen: (open: boolean) => void
  setBackendUrl: (url: string) => void
}

const initialSpaces: Record<string, SpaceStatus> = Object.fromEntries(
  SPACE_CATALOG.map(space => [
    space.id,
    {
      name: space.id,
      active: false,
      taskCount: 0,
      lastActive: null,
      color: space.color,
      icon: space.icon,
    },
  ])
)

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      currentPage: 'chat',
      activeSpace: null,
      currentRole: 'cognition' as Role,
      sidebarOpen: true,
      theme: 'dark',
      locale: 'en',
      spaces: initialSpaces,
      computerUseSteps: [],
      isComputerUseOpen: false,
      backendUrl: process.env.NEXT_PUBLIC_API_URL || 'https://pyae1994-autonomous-coding-system.hf.space',

      setCurrentPage: (page) => set({ currentPage: page }),
      setActiveSpace: (space) => set({ activeSpace: space }),
      setCurrentRole: (role) => set({ currentRole: role }),
      setSidebarOpen: (open) => set({ sidebarOpen: open }),
      setTheme: (theme) => set({ theme }),
      setLocale: (locale) => set({ locale }),
      setBackendUrl: (url) => set({ backendUrl: url }),

      activateSpace: (space, role) =>
        set(state => ({
          activeSpace: space,
          currentRole: role || state.currentRole,
          spaces: {
            ...state.spaces,
            [space]: {
              ...state.spaces[space],
              active: true,
              lastActive: Date.now(),
            },
          },
        })),

      deactivateSpace: (space) =>
        set(state => ({
          spaces: {
            ...state.spaces,
            [space]: { ...state.spaces[space], active: false },
          },
        })),

      addComputerUseStep: (step) =>
        set(state => ({
          computerUseSteps: [
            ...state.computerUseSteps.slice(-99),
            {
              ...step,
              id: Math.random().toString(36).slice(2, 10),
              timestamp: Date.now(),
            },
          ],
        })),

      clearComputerUseSteps: () => set({ computerUseSteps: [] }),
      setComputerUseOpen: (open) => set({ isComputerUseOpen: open }),
    }),
    {
      name: 'god-agent-store',
      partialize: (state) => ({
        theme: state.theme,
        locale: state.locale,
        sidebarOpen: state.sidebarOpen,
        backendUrl: state.backendUrl,
      }),
    }
  )
)
