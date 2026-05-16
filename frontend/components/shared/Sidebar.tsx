'use client'

import { MessageSquare, LayoutDashboard, Box, Bot, ListTodo, Brain, BookOpen, GitBranch, BarChart2, Settings, Zap, Plug, MonitorPlay } from 'lucide-react'
import { useAppStore } from '@/store/useAppStore'
import type { Page } from '@/store/useAppStore'

interface NavItem {
  id: Page
  label: string
  labelMy: string
  icon: React.ElementType
}

const NAV_ITEMS: NavItem[] = [
  { id: 'chat',        label: 'Chat',        labelMy: 'စကားပြော',    icon: MessageSquare },
  { id: 'dashboard',   label: 'Dashboard',   labelMy: 'Dashboard',    icon: LayoutDashboard },
  { id: 'spaces',      label: 'Spaces',      labelMy: 'Spaces (22)',  icon: Box },
  { id: 'agents',      label: 'Agents',      labelMy: 'Agent (16)',   icon: Bot },
  { id: 'connectors',  label: 'Connectors',  labelMy: 'ချိတ်ဆက်မှု', icon: Plug },
  { id: 'tasks',       label: 'Tasks',       labelMy: 'လုပ်ငန်းများ', icon: ListTodo },
  { id: 'memory',      label: 'Memory',      labelMy: 'မှတ်ဉာဏ်',    icon: Brain },
  { id: 'knowledge',   label: 'Knowledge',   labelMy: 'ဗဟုသုတ',      icon: BookOpen },
  { id: 'workflows',   label: 'Workflows',   labelMy: 'Workflow',     icon: GitBranch },
  { id: 'analytics',   label: 'Analytics',   labelMy: 'Analytics',   icon: BarChart2 },
  { id: 'settings',    label: 'Settings',    labelMy: 'ဆက်တင်',      icon: Settings },
]

export default function Sidebar() {
  const { currentPage, setCurrentPage, sidebarOpen, locale, isComputerUseOpen, setComputerUseOpen } = useAppStore()

  if (!sidebarOpen) return null

  return (
    <aside
      className="w-52 shrink-0 flex flex-col h-full overflow-y-auto"
      style={{ background: 'var(--surface-1)', borderRight: '1px solid var(--border)' }}
    >
      {/* Logo */}
      <div className="p-3 shrink-0" style={{ borderBottom: '1px solid var(--border)' }}>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center shadow-lg"
            style={{ background: 'linear-gradient(135deg, var(--accent), #4f46e5)', boxShadow: '0 4px 12px rgba(124,58,237,0.3)' }}>
            <Zap size={16} className="text-white" />
          </div>
          <div>
            <div className="text-xs font-bold text-white">GOD AGENT OS</div>
            <div className="text-[9px] font-medium" style={{ color: 'var(--accent-bright)' }}>
              v11 · God Mode
            </div>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="p-2 flex-1">
        <div className="space-y-0.5">
          {NAV_ITEMS.map(item => {
            const Icon = item.icon
            const active = currentPage === item.id
            return (
              <button
                key={item.id}
                onClick={() => setCurrentPage(item.id)}
                className={`nav-item w-full text-left ${active ? 'active' : ''}`}
              >
                <Icon size={13} />
                {locale === 'my' ? item.labelMy : item.label}
                {item.id === 'chat' && active && (
                  <span className="ml-auto w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                )}
              </button>
            )
          })}
        </div>

        {/* Computer Use Shortcut */}
        <div className="mt-3 pt-3" style={{ borderTop: '1px solid var(--border)' }}>
          <button
            onClick={() => setComputerUseOpen(!isComputerUseOpen)}
            className={`nav-item w-full text-left ${isComputerUseOpen ? 'active' : ''}`}
          >
            <MonitorPlay size={13} />
            {locale === 'my' ? 'Computer ကြည့်' : 'Computer Use'}
            {isComputerUseOpen && (
              <span className="ml-auto text-[9px] px-1.5 py-0.5 rounded-full"
                style={{ background: 'rgba(124,58,237,0.12)', color: 'var(--accent-bright)' }}>
                Live
              </span>
            )}
          </button>
        </div>
      </nav>

      {/* Footer */}
      <div className="p-3 shrink-0" style={{ borderTop: '1px solid var(--border)' }}>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
            {locale === 'my' ? '16 Agent Online' : '16 Agents Online'}
          </span>
        </div>
        <div className="text-[9px] mt-1" style={{ color: 'var(--text-muted)' }}>
          {locale === 'my' ? 'Gemini · SambaNova · GitHub' : 'Gemini · SambaNova · GitHub'}
        </div>
      </div>
    </aside>
  )
}
