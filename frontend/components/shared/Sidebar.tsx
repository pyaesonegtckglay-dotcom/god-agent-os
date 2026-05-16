'use client'

import { LayoutDashboard, Box, Bot, ListTodo, Brain, BookOpen, GitBranch, BarChart2, Settings, Zap, Plug } from 'lucide-react'
import { useAppStore } from '@/store/useAppStore'
import type { Page } from '@/store/useAppStore'
import { SPACE_CATALOG } from '@/lib/spaceCatalog'

const NAV_ITEMS: { id: Page; label: string; icon: any }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'spaces', label: 'Spaces', icon: Box },
  { id: 'agents', label: 'Agents', icon: Bot },
  { id: 'connectors', label: 'Connectors', icon: Plug },
  { id: 'tasks', label: 'Tasks', icon: ListTodo },
  { id: 'memory', label: 'Memory', icon: Brain },
  { id: 'knowledge', label: 'Knowledge', icon: BookOpen },
  { id: 'workflows', label: 'Workflows', icon: GitBranch },
  { id: 'analytics', label: 'Analytics', icon: BarChart2 },
  { id: 'settings', label: 'Settings', icon: Settings },
]

export default function Sidebar() {
  const { currentPage, setCurrentPage, sidebarOpen, spaces, activeSpace } = useAppStore()
  if (!sidebarOpen) return null

  return (
    <aside className="w-60 flex-shrink-0 flex flex-col border-r h-full overflow-y-auto" style={{ background: '#07080f', borderColor: '#1e2035' }}>
      <div className="p-3 border-b" style={{ borderColor: '#1e2035' }}>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-violet-500/20">
            <Zap size={16} className="text-white" />
          </div>
          <div>
            <div className="text-xs font-bold text-white">GOD AGENT OS</div>
            <div className="text-[9px] text-violet-400 font-medium">v10 · 22 Spaces</div>
          </div>
        </div>
      </div>

      <nav className="p-2 flex-1">
        <div className="space-y-0.5">
          {NAV_ITEMS.map(item => {
            const Icon = item.icon
            const active = currentPage === item.id
            return (
              <button key={item.id} onClick={() => setCurrentPage(item.id)} className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${active ? 'bg-violet-500/15 text-violet-300 border border-violet-500/20' : 'text-slate-500 hover:text-slate-300 hover:bg-white/4'}`}>
                <Icon size={13} />
                {item.label}
              </button>
            )
          })}
        </div>

        <div className="mt-4">
          <div className="px-2 mb-2 text-[9px] font-bold text-slate-600 uppercase tracking-widest">Active Spaces</div>
          <div className="grid grid-cols-2 gap-1">
            {SPACE_CATALOG.map(space => {
              const isActive = spaces[space.id]?.active
              const isSelected = activeSpace === space.id
              return (
                <div key={space.id} className="flex flex-col items-center p-1.5 rounded-lg text-center transition-all cursor-pointer" style={{ background: isSelected || isActive ? `${space.color}15` : 'rgba(255,255,255,0.03)', border: `1px solid ${isSelected || isActive ? `${space.color}40` : 'transparent'}` }}>
                  <span className="text-sm">{space.icon}</span>
                  <span className="text-[8px] mt-0.5" style={{ color: isActive ? space.color : '#475569' }}>{space.shortName}</span>
                  {isActive && <div className="w-1 h-1 rounded-full mt-0.5 animate-pulse" style={{ background: space.color }} />}
                </div>
              )
            })}
          </div>
        </div>
      </nav>

      <div className="p-3 border-t" style={{ borderColor: '#1e2035' }}>
        <div className="text-[9px] text-slate-600 text-center">Distributed worker-space runtime</div>
      </div>
    </aside>
  )
}
