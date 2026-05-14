'use client'

import { useAgentStore } from '@/hooks/useAgentStore'
import { t } from '@/lib/i18n'
import { Menu, Zap, Globe, Moon, Sun, MonitorSmartphone, Sparkles, Cpu } from 'lucide-react'
import type { Theme, Locale } from '@/hooks/useAgentStore'

const THEMES: { id: Theme; label: string; icon: string }[] = [
  { id: 'dark',   label: 'Dark',   icon: '🌙' },
  { id: 'light',  label: 'Light',  icon: '☀️' },
  { id: 'amoled', label: 'AMOLED', icon: '⬛' },
  { id: 'neon',   label: 'Neon',   icon: '🌊' },
  { id: 'glass',  label: 'Glass',  icon: '🔮' },
]

export default function TopBar() {
  const { theme, locale, setTheme, setLocale, sidebarOpen, setSidebarOpen, agents } = useAgentStore()

  const activeAgents = Object.values(agents).filter(a => a.status === 'executing' || a.status === 'thinking').length
  const allIdle = Object.values(agents).every(a => a.status === 'idle')

  return (
    <header className="h-12 flex items-center justify-between px-3 border-b shrink-0"
      style={{ background: 'var(--bg-2)', borderColor: 'var(--border)' }}>

      {/* Left */}
      <div className="flex items-center gap-3">
        <button onClick={() => setSidebarOpen(!sidebarOpen)}
          className="p-1.5 rounded-lg hover:bg-white/5 transition-colors">
          <Menu size={16} style={{ color: 'var(--text-secondary)' }} />
        </button>

        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg">
            <Zap size={14} className="text-white" />
          </div>
          <div className="hidden sm:block">
            <span className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>God Mode+</span>
            <span className="text-[10px] ml-1.5 px-1.5 py-0.5 rounded-full text-purple-300 font-semibold"
              style={{ background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)' }}>
              v3.0
            </span>
          </div>
        </div>
      </div>

      {/* Center — Agent Status */}
      <div className="hidden md:flex items-center gap-2">
        <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-all ${
          activeAgents > 0
            ? 'bg-indigo-500/15 border border-indigo-500/30 text-indigo-300'
            : 'bg-white/5 border border-white/10 text-slate-400'
        }`}>
          <div className={`w-1.5 h-1.5 rounded-full ${activeAgents > 0 ? 'bg-indigo-400 animate-pulse' : 'bg-slate-500'}`} />
          {activeAgents > 0 ? `${activeAgents} Agent${activeAgents > 1 ? 's' : ''} Active` : '10 Agents Ready'}
        </div>

        <div className="flex items-center gap-1">
          {(['chat','coding','debug','workflow','sandbox'] as const).map(name => {
            const a = agents[name]
            const colors: Record<string, string> = {
              chat: '#22d3ee', coding: '#34d399', debug: '#f87171',
              workflow: '#fb923c', sandbox: '#4ade80',
            }
            const isActive = a.status === 'executing' || a.status === 'thinking'
            return (
              <div key={name} title={`${name}: ${a.status}`}
                className="w-1.5 h-1.5 rounded-full transition-all duration-300"
                style={{
                  background: isActive ? colors[name] : 'var(--border)',
                  boxShadow: isActive ? `0 0 6px ${colors[name]}` : 'none',
                }}
              />
            )
          })}
        </div>
      </div>

      {/* Right */}
      <div className="flex items-center gap-1">
        {/* Theme Picker */}
        <div className="flex items-center gap-0.5 p-0.5 rounded-lg" style={{ background: 'var(--bg-3)', border: '1px solid var(--border)' }}>
          {THEMES.map(th => (
            <button key={th.id} onClick={() => setTheme(th.id)} title={th.label}
              className={`px-1.5 py-0.5 rounded-md text-[10px] transition-all ${
                theme === th.id ? 'text-white shadow' : 'text-slate-500 hover:text-slate-300'
              }`}
              style={{ background: theme === th.id ? 'var(--brand)' : 'transparent' }}>
              {th.icon}
            </button>
          ))}
        </div>

        {/* Locale */}
        <button onClick={() => setLocale(locale === 'en' ? 'my' : 'en')}
          className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs transition-all hover:bg-white/5"
          style={{ color: 'var(--text-secondary)', border: '1px solid var(--border)' }}
          title="Toggle Language / ဘာသာစကားပြောင်း">
          <Globe size={12} />
          <span>{locale === 'en' ? 'EN' : 'မြ'}</span>
        </button>

        {/* God Mode badge */}
        <div className="hidden sm:flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold text-purple-300"
          style={{ background: 'rgba(168,85,247,0.1)', border: '1px solid rgba(168,85,247,0.25)' }}>
          <Sparkles size={10} />
          GOD
        </div>
      </div>
    </header>
  )
}
