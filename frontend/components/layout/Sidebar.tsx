'use client'

import { useAgentStore } from '@/hooks/useAgentStore'
import {
  MessageSquare, ListTodo, Brain, Clock, Plug, Terminal,
  Plus, Zap, Code2, Bug, Cpu,
  GitBranch, Workflow, Rocket, Palette, Bot, Globe, Folder,
  FlaskConical, Eye, Cpu as CpuIcon
} from 'lucide-react'
import type { ActivePanel, AgentName } from '@/hooks/useAgentStore'

const PANELS: { id: ActivePanel; icon: React.ElementType; labelEn: string; labelMy: string; badge?: string }[] = [
  { id: 'timeline',   icon: Clock,         labelEn: 'Timeline',    labelMy: 'အချိန်ဇယား' },
  { id: 'tasks',      icon: ListTodo,       labelEn: 'Tasks',       labelMy: 'လုပ်ငန်းများ' },
  { id: 'sandbox',    icon: Terminal,       labelEn: 'Terminal',    labelMy: 'Terminal' },
  { id: 'files',      icon: Folder,         labelEn: 'Files',       labelMy: 'ဖိုင်များ',    badge: 'v7' },
  { id: 'browser',    icon: Globe,          labelEn: 'Browser',     labelMy: 'ဘရောင်ဇာ',  badge: 'v7' },
  { id: 'memory',     icon: Brain,          labelEn: 'Memory',      labelMy: 'မှတ်ဉာဏ်' },
  { id: 'connectors', icon: Plug,           labelEn: 'Connectors',  labelMy: 'ချိတ်ဆက်မှု' },
  { id: 'ai_router',   icon: Cpu,            labelEn: 'AI Router',   labelMy: 'AI Router',    badge: 'v8' },
]

const AGENT_META: Record<string, { icon: React.ElementType; color: string; label: string; isNew?: boolean }> = {
  chat:      { icon: MessageSquare, color: '#22d3ee', label: 'Chat' },
  planner:   { icon: Zap,           color: '#a78bfa', label: 'Planner' },
  coding:    { icon: Code2,         color: '#34d399', label: 'Coding' },
  debug:     { icon: Bug,           color: '#f87171', label: 'Debug' },
  memory:    { icon: Brain,         color: '#fbbf24', label: 'Memory' },
  connector: { icon: Plug,          color: '#60a5fa', label: 'Connector' },
  deploy:    { icon: Rocket,        color: '#f472b6', label: 'Deploy' },
  workflow:  { icon: Workflow,      color: '#fb923c', label: 'Workflow' },
  sandbox:   { icon: Terminal,      color: '#4ade80', label: 'Sandbox' },
  ui:        { icon: Palette,       color: '#e879f9', label: 'UI' },
  browser:   { icon: Globe,         color: '#38bdf8', label: 'Browser',  isNew: true },
  file:      { icon: Folder,        color: '#fcd34d', label: 'File',     isNew: true },
  git:       { icon: GitBranch,     color: '#f97316', label: 'Git',      isNew: true },
  test:      { icon: FlaskConical,  color: '#a3e635', label: 'Test',     isNew: true },
  vision:    { icon: Eye,           color: '#c084fc', label: 'Vision',   isNew: true },
}

export default function Sidebar() {
  const { sidebarOpen, activePanel, setActivePanel, locale, messages, clearMessages, agents } = useAgentStore()

  if (!sidebarOpen) return null

  return (
    <aside className="w-52 flex-shrink-0 flex flex-col border-r hidden md:flex"
      style={{ background: 'var(--bg-2)', borderColor: 'var(--border)' }}>

      {/* New Chat */}
      <div className="p-3 border-b" style={{ borderColor: 'var(--border)' }}>
        <button onClick={clearMessages}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-all hover:opacity-90 active:scale-95"
          style={{ background: 'var(--brand)', color: '#fff' }}>
          <Plus size={14} />
          {locale === 'my' ? 'စကားပြောသစ်' : 'New Chat'}
        </button>
      </div>

      {/* Navigation */}
      <nav className="p-2 border-b" style={{ borderColor: 'var(--border)' }}>
        <p className="text-[10px] uppercase tracking-wider px-2 mb-1.5"
          style={{ color: 'var(--text-muted)' }}>Views</p>
        {PANELS.map(({ id, icon: Icon, labelEn, labelMy, badge }) => (
          <button key={id} onClick={() => setActivePanel(id)}
            className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all mb-0.5`}
            style={{
              background: activePanel === id ? 'var(--brand)' : 'transparent',
              color: activePanel === id ? '#fff' : 'var(--text-secondary)',
            }}>
            <Icon size={13} />
            <span className="flex-1 text-left">{locale === 'my' ? labelMy : labelEn}</span>
            {badge && (
              <span className="text-[8px] px-1 py-0.5 rounded font-bold"
                style={{
                  background: activePanel === id ? 'rgba(255,255,255,0.2)' : 'rgba(99,102,241,0.2)',
                  color: activePanel === id ? '#fff' : '#a5b4fc',
                }}>
                {badge}
              </span>
            )}
          </button>
        ))}
      </nav>

      {/* Agent Status */}
      <div className="p-2 flex-1 overflow-y-auto">
        <p className="text-[10px] uppercase tracking-wider px-2 mb-1.5"
          style={{ color: 'var(--text-muted)' }}>
          Agents ({Object.keys(AGENT_META).length})
        </p>
        {Object.entries(AGENT_META).map(([name, meta]) => {
          const agent = (agents as any)[name]
          const Icon = meta.icon
          const isActive = agent?.status === 'executing' || agent?.status === 'thinking'
          const isComplete = agent?.status === 'complete'
          const isError = agent?.status === 'error'

          return (
            <div key={name}
              className="flex items-center gap-2 px-2 py-1 rounded-lg mb-0.5 transition-all"
              style={{
                background: isActive ? `${meta.color}10` : 'transparent',
                border: isActive ? `1px solid ${meta.color}30` : '1px solid transparent',
              }}>
              <Icon size={11} style={{ color: meta.color, flexShrink: 0 }} />
              <span className="text-[11px] flex-1 truncate capitalize"
                style={{ color: isActive ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                {meta.label}
              </span>
              {meta.isNew && !isActive && (
                <span className="text-[8px] px-1 rounded" style={{ background: 'rgba(99,102,241,0.15)', color: '#a5b4fc' }}>
                  new
                </span>
              )}
              <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${isActive ? 'animate-pulse' : ''}`}
                style={{
                  background: isActive ? meta.color : isComplete ? '#22c55e' : isError ? '#ef4444' : 'var(--border)',
                  boxShadow: isActive ? `0 0 6px ${meta.color}` : 'none',
                }}
              />
            </div>
          )
        })}
      </div>

      {/* Footer */}
      <div className="p-3 border-t" style={{ borderColor: 'var(--border)' }}>
        <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-[10px]"
          style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)' }}>
          <Bot size={10} className="text-indigo-400" />
          <span style={{ color: 'var(--text-muted)' }}>God Agent OS v8.0</span>
          <div className="ml-auto w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
        </div>
      </div>
    </aside>
  )
}
