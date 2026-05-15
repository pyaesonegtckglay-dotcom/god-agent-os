'use client'

import { motion, AnimatePresence } from 'framer-motion'
import {
  LayoutDashboard, Bot, CheckSquare, Brain, BookOpen,
  GitBranch, BarChart3, Settings, ChevronLeft, Zap,
  Activity, Menu, X
} from 'lucide-react'
import { useAppStore, NavPage } from '@/store/useAppStore'
import { cn } from '@/lib/utils'

const NAV_ITEMS: { page: NavPage; label: string; icon: React.ElementType; badge?: string }[] = [
  { page: 'dashboard',  label: 'Dashboard',  icon: LayoutDashboard },
  { page: 'agents',     label: 'Agents',     icon: Bot, badge: '12' },
  { page: 'tasks',      label: 'Tasks',      icon: CheckSquare, badge: '3' },
  { page: 'memory',     label: 'Memory',     icon: Brain },
  { page: 'knowledge',  label: 'Knowledge',  icon: BookOpen },
  { page: 'workflows',  label: 'Workflows',  icon: GitBranch },
  { page: 'analytics',  label: 'Analytics',  icon: BarChart3 },
  { page: 'settings',   label: 'Settings',   icon: Settings },
]

export default function Sidebar() {
  const { currentPage, setCurrentPage, sidebarCollapsed, toggleSidebar, godModeActive, toggleGodMode } = useAppStore()

  return (
    <motion.aside
      animate={{ width: sidebarCollapsed ? 64 : 220 }}
      transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
      className="flex flex-col h-full flex-shrink-0 border-r overflow-hidden"
      style={{ borderColor: 'var(--border)', background: 'rgba(10,12,22,0.95)', backdropFilter: 'blur(20px)' }}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-5 border-b" style={{ borderColor: 'var(--border)' }}>
        <div className="relative flex-shrink-0">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center glow-purple"
            style={{ background: 'linear-gradient(135deg, #7c3aed, #4f46e5)' }}>
            <Zap size={16} className="text-white" />
          </div>
          {godModeActive && (
            <div className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-green-400 border-2 border-[#0a0c16]" />
          )}
        </div>
        <AnimatePresence>
          {!sidebarCollapsed && (
            <motion.div
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -8 }}
              transition={{ duration: 0.2 }}
              className="min-w-0"
            >
              <div className="text-sm font-bold text-white leading-none">GOD AGENT OS</div>
              <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>by manus + genspark</div>
            </motion.div>
          )}
        </AnimatePresence>
        <button
          onClick={toggleSidebar}
          className="ml-auto text-slate-500 hover:text-slate-300 transition-colors flex-shrink-0"
        >
          {sidebarCollapsed ? <Menu size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
        {NAV_ITEMS.map(({ page, label, icon: Icon, badge }) => {
          const isActive = currentPage === page
          return (
            <button
              key={page}
              onClick={() => setCurrentPage(page)}
              className={cn(
                'nav-item w-full text-left relative group',
                isActive && 'active'
              )}
              title={sidebarCollapsed ? label : undefined}
            >
              <Icon size={17} className="flex-shrink-0" style={{ color: isActive ? '#a78bfa' : undefined }} />
              <AnimatePresence>
                {!sidebarCollapsed && (
                  <motion.span
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex-1 text-left"
                  >
                    {label}
                  </motion.span>
                )}
              </AnimatePresence>
              {badge && !sidebarCollapsed && (
                <span className="ml-auto text-xs px-1.5 py-0.5 rounded-full font-semibold"
                  style={{ background: isActive ? 'rgba(124,58,237,0.3)' : 'rgba(255,255,255,0.07)', color: isActive ? '#c084fc' : 'var(--text-muted)' }}>
                  {badge}
                </span>
              )}
            </button>
          )
        })}
      </nav>

      {/* System Status */}
      <div className="px-2 pb-2">
        <div className="border-t mb-2" style={{ borderColor: 'var(--border)' }} />
        {!sidebarCollapsed && (
          <div className="px-2 mb-2">
            <div className="flex items-center gap-2 mb-1">
              <Activity size={11} className="text-green-400" />
              <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>System Status</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse-glow" />
              <span className="text-xs text-green-400 font-medium">All Systems Operational</span>
            </div>
          </div>
        )}

        {/* God Mode Toggle */}
        <div className={cn(
          'flex items-center gap-2 px-2 py-2 rounded-xl cursor-pointer transition-all',
          sidebarCollapsed ? 'justify-center' : '',
          godModeActive ? 'glass-purple' : 'glass'
        )} onClick={toggleGodMode}>
          <div className={cn('w-6 h-3.5 rounded-full relative transition-all flex-shrink-0',
            godModeActive ? 'bg-purple-600' : 'bg-slate-700'
          )}>
            <div className={cn('absolute top-0.5 w-2.5 h-2.5 rounded-full transition-all',
              godModeActive ? 'right-0.5 bg-white' : 'left-0.5 bg-slate-400'
            )} />
          </div>
          {!sidebarCollapsed && (
            <span className="text-xs font-semibold" style={{ color: godModeActive ? '#a78bfa' : 'var(--text-muted)' }}>
              God Mode {godModeActive ? 'ON' : 'OFF'}
            </span>
          )}
        </div>
      </div>
    </motion.aside>
  )
}
