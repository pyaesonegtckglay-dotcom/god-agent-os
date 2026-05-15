'use client'

import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, Bell, Command, Sparkles, X, ArrowRight, Bot, CheckSquare, FileText, Zap } from 'lucide-react'
import { useAppStore } from '@/store/useAppStore'

const QUICK_COMMANDS = [
  { icon: Bot,       label: 'New Research Task',         shortcut: '/research',       page: 'agents' as const },
  { icon: CheckSquare, label: 'View Running Tasks',      shortcut: '/tasks',          page: 'tasks' as const },
  { icon: FileText,  label: 'Generate Report',           shortcut: '/report',         page: 'analytics' as const },
  { icon: Zap,       label: 'Deploy Application',        shortcut: '/deploy',         page: 'workflows' as const },
]

const NOTIFICATIONS = [
  { id: '1', title: 'Code Agent', message: 'Successfully deployed production API', time: '2m ago', color: '#34d399' },
  { id: '2', title: 'Research Agent', message: 'Market analysis complete — 47 insights found', time: '15m ago', color: '#6366f1' },
  { id: '3', title: 'Data Agent', message: 'Processed 1.2M data points', time: '1h ago', color: '#22d3ee' },
]

export default function TopBar() {
  const { setCurrentPage, commandPaletteOpen, setCommandPaletteOpen } = useAppStore()
  const [query, setQuery] = useState('')
  const [notifOpen, setNotifOpen] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setCommandPaletteOpen(true)
        setTimeout(() => inputRef.current?.focus(), 50)
      }
      if (e.key === 'Escape') {
        setCommandPaletteOpen(false)
        setNotifOpen(false)
        setQuery('')
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [setCommandPaletteOpen])

  const filtered = QUICK_COMMANDS.filter(c =>
    query === '' || c.label.toLowerCase().includes(query.toLowerCase()) || c.shortcut.includes(query)
  )

  return (
    <header className="flex items-center gap-4 px-4 py-3 border-b flex-shrink-0 relative z-30"
      style={{ borderColor: 'var(--border)', background: 'rgba(10,12,22,0.98)', backdropFilter: 'blur(20px)' }}>

      {/* Search / Command Trigger */}
      <div className="flex-1 max-w-xl mx-auto">
        <button
          onClick={() => { setCommandPaletteOpen(true); setTimeout(() => inputRef.current?.focus(), 50) }}
          className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-left transition-all hover:border-purple-500/30"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
        >
          <Search size={15} className="text-slate-500 flex-shrink-0" />
          <span className="flex-1 text-sm" style={{ color: 'var(--text-muted)' }}>Search agents, tasks, docs…</span>
          <div className="flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-md"
            style={{ background: 'rgba(255,255,255,0.06)', color: 'var(--text-muted)' }}>
            <Command size={10} />
            <span>K</span>
          </div>
        </button>
      </div>

      {/* Right Icons */}
      <div className="flex items-center gap-2">
        <button className="p-2 rounded-xl text-slate-500 hover:text-slate-300 hover:bg-white/5 transition-all">
          <Sparkles size={17} />
        </button>

        {/* Notifications */}
        <div className="relative">
          <button
            onClick={() => setNotifOpen(!notifOpen)}
            className="relative p-2 rounded-xl text-slate-500 hover:text-slate-300 hover:bg-white/5 transition-all"
          >
            <Bell size={17} />
            <div className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-purple-500 border border-[#0a0c16]" />
          </button>

          <AnimatePresence>
            {notifOpen && (
              <motion.div
                initial={{ opacity: 0, y: 8, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, scale: 0.95 }}
                transition={{ duration: 0.2 }}
                className="absolute right-0 top-full mt-2 w-80 glass-card overflow-hidden z-50"
              >
                <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: 'var(--border)' }}>
                  <span className="text-sm font-semibold text-white">Notifications</span>
                  <button onClick={() => setNotifOpen(false)} className="text-slate-500 hover:text-slate-300">
                    <X size={14} />
                  </button>
                </div>
                {NOTIFICATIONS.map((n) => (
                  <div key={n.id} className="flex gap-3 px-4 py-3 hover:bg-white/[0.03] transition-colors cursor-pointer border-b last:border-0"
                    style={{ borderColor: 'var(--border)' }}>
                    <div className="w-2 h-2 rounded-full flex-shrink-0 mt-1.5" style={{ background: n.color }} />
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-white">{n.title}</div>
                      <div className="text-xs mt-0.5 text-slate-400 line-clamp-1">{n.message}</div>
                      <div className="text-xs mt-1 text-slate-600">{n.time}</div>
                    </div>
                  </div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Avatar */}
        <div className="w-8 h-8 rounded-full overflow-hidden border-2 cursor-pointer"
          style={{ borderColor: 'rgba(124,58,237,0.4)', background: 'linear-gradient(135deg, #7c3aed, #4f46e5)' }}>
          <div className="w-full h-full flex items-center justify-center text-xs font-bold text-white">A</div>
        </div>
      </div>

      {/* Command Palette Modal */}
      <AnimatePresence>
        {commandPaletteOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
              onClick={() => { setCommandPaletteOpen(false); setQuery('') }}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: -16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: -16 }}
              transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
              className="fixed top-[20vh] left-1/2 -translate-x-1/2 w-full max-w-lg glass-card z-50 overflow-hidden"
            >
              <div className="flex items-center gap-3 px-4 py-3.5 border-b" style={{ borderColor: 'var(--border)' }}>
                <Search size={16} className="text-slate-500" />
                <input
                  ref={inputRef}
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder="Search agents, run commands…"
                  className="flex-1 bg-transparent text-sm text-white placeholder:text-slate-500 outline-none"
                />
                <button onClick={() => { setCommandPaletteOpen(false); setQuery('') }}
                  className="text-slate-500 hover:text-slate-300 transition-colors">
                  <X size={14} />
                </button>
              </div>
              <div className="py-2 max-h-64 overflow-y-auto">
                {filtered.map(({ icon: Icon, label, shortcut, page }) => (
                  <button key={label}
                    onClick={() => { setCurrentPage(page); setCommandPaletteOpen(false); setQuery('') }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-white/[0.04] transition-colors group">
                    <Icon size={15} className="text-purple-400 group-hover:text-purple-300" />
                    <span className="flex-1 text-sm text-left text-slate-300 group-hover:text-white">{label}</span>
                    <span className="text-xs font-mono px-2 py-0.5 rounded"
                      style={{ background: 'rgba(255,255,255,0.06)', color: 'var(--text-muted)' }}>{shortcut}</span>
                    <ArrowRight size={13} className="text-slate-600 group-hover:text-purple-400 transition-colors" />
                  </button>
                ))}
                {filtered.length === 0 && (
                  <div className="px-4 py-6 text-center text-sm text-slate-600">No results for "{query}"</div>
                )}
              </div>
              <div className="px-4 py-2 border-t flex items-center gap-4 text-xs text-slate-600"
                style={{ borderColor: 'var(--border)' }}>
                <span>↑↓ navigate</span>
                <span>↵ select</span>
                <span>esc close</span>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </header>
  )
}
