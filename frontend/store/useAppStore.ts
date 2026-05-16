import { create } from 'zustand'
import { SPACE_CATALOG, type WorkerRole } from '@/lib/spaceCatalog'

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

export type Space = string
export type Role = WorkerRole

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
  spaces: Record<string, SpaceStatus>
  setCurrentPage: (page: Page) => void
  setActiveSpace: (space: Space | null) => void
  setCurrentRole: (role: Role) => void
  setSidebarOpen: (open: boolean) => void
  activateSpace: (space: Space, role?: Role) => void
  deactivateSpace: (space: Space) => void
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
        ...(state.spaces[space] || {
          name: space,
          active: false,
          taskCount: 0,
          lastActive: null,
          color: '#7c3aed',
          icon: '⚙️',
        }),
        active: true,
        lastActive: Date.now(),
        taskCount: (state.spaces[space]?.taskCount || 0) + 1,
      },
    },
  })),

  deactivateSpace: (space) => set((state) => ({
    spaces: {
      ...state.spaces,
      [space]: {
        ...(state.spaces[space] || { name: space, taskCount: 0, lastActive: null, color: '#7c3aed', icon: '⚙️' }),
        active: false,
      },
    },
  })),
}))
