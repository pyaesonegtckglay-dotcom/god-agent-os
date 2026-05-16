'use client'

import { useEffect, useRef } from 'react'
import { X, MonitorPlay, Brain, Globe, Code2, Terminal, GitBranch, Rocket, CheckCircle, XCircle, Loader, FileText, Search, PenTool } from 'lucide-react'
import { useAppStore, type ComputerUseStep } from '@/store/useAppStore'

const STEP_ICONS: Record<string, { icon: React.ElementType; color: string; bg: string }> = {
  thinking:  { icon: Brain,       color: '#a78bfa', bg: 'rgba(124,58,237,0.12)' },
  browsing:  { icon: Globe,       color: '#22d3ee', bg: 'rgba(34,211,238,0.12)' },
  coding:    { icon: Code2,       color: '#34d399', bg: 'rgba(52,211,153,0.12)' },
  executing: { icon: Terminal,    color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
  git:       { icon: GitBranch,   color: '#60a5fa', bg: 'rgba(96,165,250,0.12)' },
  deploy:    { icon: Rocket,      color: '#f472b6', bg: 'rgba(244,114,182,0.12)' },
  complete:  { icon: CheckCircle, color: '#22c55e', bg: 'rgba(34,197,94,0.12)' },
  error:     { icon: XCircle,     color: '#ef4444', bg: 'rgba(239,68,68,0.12)'  },
  reading:   { icon: FileText,    color: '#94a3b8', bg: 'rgba(148,163,184,0.1)' },
  writing:   { icon: PenTool,     color: '#818cf8', bg: 'rgba(129,140,248,0.12)'},
  searching: { icon: Search,      color: '#fbbf24', bg: 'rgba(251,191,36,0.12)' },
}

function StepCard({ step }: { step: ComputerUseStep }) {
  const def = STEP_ICONS[step.type] || STEP_ICONS.thinking
  const Icon = def.icon

  return (
    <div
      className="computer-use-step animate-fade-in"
      style={{ borderBottom: '1px solid var(--border)' }}
    >
      <div className="computer-use-step-icon" style={{ background: def.bg }}>
        {step.status === 'running' && step.type !== 'complete' && step.type !== 'error' ? (
          <Loader size={14} style={{ color: def.color, animation: 'spin 1s linear infinite' }} />
        ) : (
          <Icon size={14} style={{ color: def.color }} />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-semibold capitalize" style={{ color: def.color }}>
            {step.type}
          </span>
          <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
            {new Date(step.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </span>
        </div>
        <div className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
          {step.title}
        </div>
        {step.detail && (
          <div className="text-[11px] mt-1 p-2 rounded-lg" style={{ background: 'var(--surface-3)', color: 'var(--text-muted)' }}>
            {step.detail}
          </div>
        )}
        {step.data && step.type === 'coding' && (() => {
          const code = step.data['code'] as string | undefined
          return code ? (
            <pre className="text-[11px] mt-1 p-2 rounded-lg overflow-x-auto" style={{ background: 'var(--surface-3)', color: '#86efac', fontFamily: 'monospace' }}>
              {code.slice(0, 200)}{code.length > 200 ? '...' : ''}
            </pre>
          ) : null
        })()}
      </div>
    </div>
  )
}

export default function ComputerUsePanel() {
  const { computerUseSteps, clearComputerUseSteps, setComputerUseOpen, locale } = useAppStore()
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [computerUseSteps.length])

  const runningSteps = computerUseSteps.filter(s => s.status === 'running').length

  return (
    <div className="computer-use-panel flex flex-col" style={{ borderLeft: '1px solid var(--border)', background: 'var(--surface-1)' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 shrink-0"
        style={{ borderBottom: '1px solid var(--border)' }}>
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center"
            style={{ background: 'rgba(124,58,237,0.12)', border: '1px solid rgba(124,58,237,0.2)' }}>
            <MonitorPlay size={14} style={{ color: '#a78bfa' }} />
          </div>
          <div>
            <div className="text-xs font-bold" style={{ color: 'var(--text-primary)' }}>
              {locale === 'my' ? 'Computer ကြည့်ရန်' : 'Computer Use'}
            </div>
            <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
              {locale === 'my' ? 'Agent လုပ်ဆောင်မှုများ' : 'Live agent activity'}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {runningSteps > 0 && (
            <div className="badge badge-purple text-[10px]">
              <Loader size={8} style={{ animation: 'spin 1s linear infinite' }} />
              {runningSteps} {locale === 'my' ? 'လုပ်နေသည်' : 'running'}
            </div>
          )}
          <button
            onClick={clearComputerUseSteps}
            className="text-[10px] px-2 py-1 rounded-md hover:bg-white/5 transition-colors"
            style={{ color: 'var(--text-muted)' }}
          >
            {locale === 'my' ? 'ရှင်းလင်း' : 'Clear'}
          </button>
          <button
            onClick={() => setComputerUseOpen(false)}
            className="p-1 rounded-md hover:bg-white/5 transition-colors"
            style={{ color: 'var(--text-muted)' }}
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Steps */}
      <div className="flex-1 overflow-y-auto">
        {computerUseSteps.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 gap-3">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center"
              style={{ background: 'rgba(124,58,237,0.08)', border: '1px solid rgba(124,58,237,0.15)' }}>
              <MonitorPlay size={20} style={{ color: '#6d28d9' }} />
            </div>
            <div className="text-center">
              <div className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>
                {locale === 'my' ? 'လုပ်ဆောင်မှုမရှိသေးပါ' : 'No activity yet'}
              </div>
              <div className="text-[10px] mt-1" style={{ color: 'var(--text-muted)' }}>
                {locale === 'my'
                  ? 'Chat မှာ task တစ်ခုပေးပြီး agent ၏ computer အသုံးပြုမှုကြည့်ပါ'
                  : 'Send a task in chat to see Manus-style agent activity here'}
              </div>
            </div>
          </div>
        ) : (
          <>
            {computerUseSteps.map(step => (
              <StepCard key={step.id} step={step} />
            ))}
            <div ref={bottomRef} />
          </>
        )}
      </div>

      {/* Footer Stats */}
      <div className="px-4 py-2.5 shrink-0 flex items-center justify-between"
        style={{ borderTop: '1px solid var(--border)' }}>
        <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
          {computerUseSteps.length} {locale === 'my' ? 'အဆင့်' : 'steps'}
        </span>
        <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
          {computerUseSteps.filter(s => s.type === 'complete').length} {locale === 'my' ? 'ပြီးဆုံး' : 'completed'}
        </span>
      </div>
    </div>
  )
}
