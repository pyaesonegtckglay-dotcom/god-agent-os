'use client'

import { Menu, Zap, Settings, Bell, Activity } from 'lucide-react'
import { useAppStore } from '@/store/useAppStore'
import { SPACE_CATALOG, SPACE_COLORS } from '@/lib/spaceCatalog'

export default function TopBar() {
  const { sidebarOpen, setSidebarOpen, activeSpace, currentRole, spaces } = useAppStore()
  const activeSpaces = Object.values(spaces).filter(space => space.active)
  const activeSpec = SPACE_CATALOG.find(space => space.id === activeSpace)

  return (
    <header className="h-12 flex items-center justify-between px-3 border-b shrink-0" style={{ background: '#0a0b14', borderColor: '#1e2035' }}>
      <div className="flex items-center gap-3">
        <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-1.5 rounded-lg hover:bg-white/5 transition-colors">
          <Menu size={16} className="text-slate-400" />
        </button>
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center shadow-lg">
            <Zap size={14} className="text-white" />
          </div>
          <div className="hidden sm:block">
            <span className="text-sm font-bold text-white">GOD AGENT OS</span>
            <span className="text-[10px] ml-1.5 px-1.5 py-0.5 rounded-full text-violet-300 font-semibold" style={{ background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.3)' }}>v10 · 22 Spaces</span>
          </div>
        </div>
      </div>

      <div className="hidden md:flex items-center gap-2">
        {activeSpec ? (
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium" style={{ background: `${SPACE_COLORS[activeSpec.id]}20`, border: `1px solid ${SPACE_COLORS[activeSpec.id]}40`, color: SPACE_COLORS[activeSpec.id] }}>
            <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: SPACE_COLORS[activeSpec.id] }} />
            {spaces[activeSpec.id]?.icon} {activeSpec.name.toUpperCase()} — {currentRole.replace('_', ' ').toUpperCase()}
          </div>
        ) : (
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#64748b' }}>
            <div className="w-1.5 h-1.5 rounded-full bg-slate-500" />
            22 Spaces Ready
          </div>
        )}
        {activeSpaces.length > 0 && (
          <div className="flex gap-1">
            {activeSpaces.slice(0, 5).map(space => (
              <div key={space.name} className="w-2 h-2 rounded-full animate-pulse" style={{ background: SPACE_COLORS[space.name] || '#7c3aed' }} />
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center gap-1">
        <div className="flex items-center gap-1.5 px-2 py-1 rounded text-xs text-slate-500">
          <Activity size={11} className="text-green-400" />
          <span className="hidden sm:inline text-green-400 font-medium">Distributed runtime online</span>
        </div>
        <button className="p-1.5 rounded-lg hover:bg-white/5 transition-colors"><Bell size={15} className="text-slate-500" /></button>
        <button className="p-1.5 rounded-lg hover:bg-white/5 transition-colors"><Settings size={15} className="text-slate-500" /></button>
      </div>
    </header>
  )
}
