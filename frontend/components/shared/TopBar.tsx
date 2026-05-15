'use client'

import { useState } from 'react'
import { Menu, Zap, Settings, Bell, Activity } from 'lucide-react'
import { useAppStore } from '@/store/useAppStore'

const SPACE_COLORS: Record<string, string> = {
  core: '#7c3aed',
  browser: '#2563eb',
  sandbox: '#059669',
  coding: '#d97706',
  vision: '#db2777',
  debug: '#dc2626',
  deploy: '#0891b2',
  communication: '#7c3aed',
}

export default function TopBar() {
  const { sidebarOpen, setSidebarOpen, activeSpace, currentRole, spaces } = useAppStore()
  
  const activeSpaces = Object.values(spaces).filter(s => s.active)

  return (
    <header className="h-12 flex items-center justify-between px-3 border-b shrink-0"
      style={{ background: 'var(--bg-2, #0a0b14)', borderColor: 'var(--border, #1e2035)' }}>

      {/* Left */}
      <div className="flex items-center gap-3">
        <button onClick={() => setSidebarOpen(!sidebarOpen)}
          className="p-1.5 rounded-lg hover:bg-white/5 transition-colors">
          <Menu size={16} className="text-slate-400" />
        </button>

        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center shadow-lg">
            <Zap size={14} className="text-white" />
          </div>
          <div className="hidden sm:block">
            <span className="text-sm font-bold text-white">GOD AGENT OS</span>
            <span className="text-[10px] ml-1.5 px-1.5 py-0.5 rounded-full text-violet-300 font-semibold"
              style={{ background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.3)' }}>
              v9 Space-Role
            </span>
          </div>
        </div>
      </div>

      {/* Center — Active Space indicator */}
      <div className="hidden md:flex items-center gap-2">
        {activeSpace ? (
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium"
            style={{ 
              background: `${SPACE_COLORS[activeSpace]}20`,
              border: `1px solid ${SPACE_COLORS[activeSpace]}40`,
              color: SPACE_COLORS[activeSpace],
            }}>
            <div className="w-1.5 h-1.5 rounded-full animate-pulse"
              style={{ background: SPACE_COLORS[activeSpace] }} />
            {spaces[activeSpace]?.icon} {activeSpace.toUpperCase()} SPACE — {currentRole.replace('_', ' ').toUpperCase()}
          </div>
        ) : (
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#64748b' }}>
            <div className="w-1.5 h-1.5 rounded-full bg-slate-500" />
            8 Spaces Ready
          </div>
        )}
        
        {activeSpaces.length > 0 && (
          <div className="flex gap-1">
            {activeSpaces.slice(0, 3).map(s => (
              <div key={s.name} className="w-2 h-2 rounded-full animate-pulse"
                style={{ background: SPACE_COLORS[s.name] }} />
            ))}
          </div>
        )}
      </div>

      {/* Right */}
      <div className="flex items-center gap-1">
        <div className="flex items-center gap-1.5 px-2 py-1 rounded text-xs text-slate-500">
          <Activity size={11} className="text-green-400" />
          <span className="hidden sm:inline text-green-400 font-medium">Powered by Pyae Sone</span>
        </div>
        <button className="p-1.5 rounded-lg hover:bg-white/5 transition-colors">
          <Bell size={15} className="text-slate-500" />
        </button>
        <button className="p-1.5 rounded-lg hover:bg-white/5 transition-colors">
          <Settings size={15} className="text-slate-500" />
        </button>
      </div>
    </header>
  )
}
