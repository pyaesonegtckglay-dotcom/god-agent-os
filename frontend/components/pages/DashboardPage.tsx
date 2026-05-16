'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Zap, Activity, Bot, Cpu, Server, RefreshCw, ExternalLink, TrendingUp, CheckCircle, AlertCircle } from 'lucide-react'
import { getHealth, getSystemStatus, getAIStats } from '@/lib/api'
import { useAppStore } from '@/store/useAppStore'

interface SystemStatus {
  status: string
  agents: { total: number; online: number }
  spaces: { total: number }
  ai_router: { active: number; providers: Record<string, { available: boolean; calls: number }> }
  features: Record<string, boolean>
}

export default function DashboardPage() {
  const { locale, setCurrentPage } = useAppStore()
  const [health, setHealth] = useState<Record<string, unknown>>({})
  const [sysStatus, setSysStatus] = useState<SystemStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  const load = async () => {
    setLoading(true)
    try {
      const [h, s] = await Promise.allSettled([getHealth(), getSystemStatus()])
      if (h.status === 'fulfilled') setHealth(h.value as Record<string, unknown>)
      if (s.status === 'fulfilled') setSysStatus(s.value as SystemStatus)
      setLastUpdated(new Date())
    } catch {}
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const isOnline = (health as { status?: string })?.status === 'healthy'
  const agentCount = sysStatus?.agents?.online || 16
  const providerCount = sysStatus?.ai_router?.active || 0
  const features = sysStatus?.features || {}

  const METRICS = [
    {
      label: locale === 'my' ? 'System Status' : 'System Status',
      value: isOnline ? (locale === 'my' ? 'Online' : 'Online') : (locale === 'my' ? 'Offline' : 'Offline'),
      icon: Activity,
      color: isOnline ? '#22c55e' : '#ef4444',
      bg: isOnline ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
      sub: 'God Mode v11',
    },
    {
      label: locale === 'my' ? 'Agents Online' : 'Agents Online',
      value: `${agentCount}/16`,
      icon: Bot,
      color: '#a78bfa',
      bg: 'rgba(167,139,250,0.1)',
      sub: 'All agents active',
    },
    {
      label: locale === 'my' ? 'AI Providers' : 'AI Providers',
      value: `${providerCount || '?'}/5`,
      icon: Cpu,
      color: '#22d3ee',
      bg: 'rgba(34,211,238,0.1)',
      sub: 'Gemini · SambaNova · GitHub',
    },
    {
      label: locale === 'my' ? 'Spaces' : 'Worker Spaces',
      value: '22',
      icon: Server,
      color: '#34d399',
      bg: 'rgba(52,211,153,0.1)',
      sub: 'All in main backend',
    },
  ]

  const FEATURE_LIST = [
    { key: 'streaming_chat', label: 'Streaming Chat', labelMy: 'Streaming Chat' },
    { key: 'computer_use', label: 'Computer Use', labelMy: 'Computer Use' },
    { key: 'god_mode', label: 'God Mode', labelMy: 'God Mode' },
    { key: 'multi_agent', label: 'Multi-Agent', labelMy: 'Multi-Agent' },
    { key: 'self_healing', label: 'Self-Healing Debug', labelMy: 'Self-Healing Debug' },
    { key: 'auto_deploy', label: 'Auto Deploy', labelMy: 'Auto Deploy' },
    { key: 'burmese_language', label: 'Burmese Language', labelMy: 'မြန်မာဘာသာ' },
    { key: 'real_time_websocket', label: 'Real-time WebSocket', labelMy: 'WebSocket' },
  ]

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <Zap size={20} style={{ color: 'var(--accent-bright)' }} />
            {locale === 'my' ? 'System Dashboard' : 'System Dashboard'}
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
            {locale === 'my' ? 'GOD AGENT OS v11 · System Overview' : 'GOD AGENT OS v11 · Real-time System Overview'}
            {lastUpdated && <span> · Updated {lastUpdated.toLocaleTimeString()}</span>}
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={load} className="btn btn-secondary text-xs" disabled={loading}>
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
            {locale === 'my' ? 'ပြန်စစ်' : 'Refresh'}
          </button>
          <a href="https://huggingface.co/spaces/PYAE1994/autonomous-coding-system" target="_blank"
            rel="noopener noreferrer" className="btn btn-secondary text-xs">
            <ExternalLink size={12} />
            HF Space
          </a>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {METRICS.map((m, i) => {
          const Icon = m.icon
          return (
            <motion.div
              key={m.label}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06 }}
              className="card p-4"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                  style={{ background: m.bg, border: `1px solid ${m.color}25` }}>
                  <Icon size={16} style={{ color: m.color }} />
                </div>
                <div className="w-2 h-2 rounded-full" style={{ background: m.color }} />
              </div>
              <div className="text-2xl font-black text-white mb-1">{m.value}</div>
              <div className="text-xs font-semibold text-white mb-0.5">{m.label}</div>
              <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{m.sub}</div>
            </motion.div>
          )
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Features */}
        <div className="card p-5">
          <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
            <TrendingUp size={15} style={{ color: 'var(--accent-bright)' }} />
            {locale === 'my' ? 'Features' : 'System Features'}
          </h3>
          <div className="grid grid-cols-2 gap-2">
            {FEATURE_LIST.map(f => {
              const enabled = features[f.key] !== false
              return (
                <div key={f.key} className="flex items-center gap-2">
                  {enabled ? (
                    <CheckCircle size={12} style={{ color: '#22c55e' }} />
                  ) : (
                    <AlertCircle size={12} style={{ color: '#f87171' }} />
                  )}
                  <span className="text-xs" style={{ color: enabled ? 'var(--text-secondary)' : 'var(--text-muted)' }}>
                    {locale === 'my' ? f.labelMy : f.label}
                  </span>
                </div>
              )
            })}
          </div>
        </div>

        {/* AI Providers */}
        <div className="card p-5">
          <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
            <Cpu size={15} style={{ color: '#22d3ee' }} />
            {locale === 'my' ? 'AI Provider Status' : 'AI Provider Status'}
          </h3>
          <div className="space-y-3">
            {[
              { name: 'Gemini', model: 'gemini-2.0-flash', color: '#22d3ee', keys: '6 keys' },
              { name: 'SambaNova', model: 'Llama-3.3-70B', color: '#a78bfa', keys: '9 keys' },
              { name: 'GitHub Models', model: 'gpt-4o', color: '#34d399', keys: '9 keys' },
              { name: 'Groq', model: 'Llama-3.3-70B', color: '#f59e0b', keys: 'fallback' },
              { name: 'OpenAI', model: 'gpt-4o', color: '#60a5fa', keys: 'fallback' },
            ].map(p => {
              const provStatus = sysStatus?.ai_router?.providers?.[p.name.toLowerCase().replace(' ', '_')]
              const available = !provStatus || provStatus.available !== false
              return (
                <div key={p.name} className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full shrink-0" style={{ background: p.color }} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-white">{p.name}</span>
                      <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{p.model}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{p.keys}</span>
                    <div className={`w-1.5 h-1.5 rounded-full ${available ? 'bg-green-400' : 'bg-red-400'}`} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="card p-5 lg:col-span-2">
          <h3 className="text-sm font-bold text-white mb-4">
            {locale === 'my' ? 'မြန်ဆန်သောလုပ်ဆောင်မှုများ' : 'Quick Actions'}
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Start Chat', labelMy: 'Chat စတင်', page: 'chat' as const, color: '#a78bfa', icon: '💬' },
              { label: 'View Agents', labelMy: 'Agent ကြည့်', page: 'agents' as const, color: '#22d3ee', icon: '🤖' },
              { label: '22 Spaces', labelMy: '22 Spaces', page: 'spaces' as const, color: '#34d399', icon: '⚡' },
              { label: 'Settings', labelMy: 'ဆက်တင်', page: 'settings' as const, color: '#f59e0b', icon: '⚙️' },
            ].map(a => (
              <button
                key={a.label}
                onClick={() => setCurrentPage(a.page)}
                className="flex flex-col items-center gap-2 p-4 rounded-xl transition-all card hover:-translate-y-0.5"
                style={{ border: `1px solid ${a.color}20`, ':hover': { borderColor: `${a.color}40` } } as React.CSSProperties}
              >
                <span className="text-2xl">{a.icon}</span>
                <span className="text-xs font-semibold text-white">
                  {locale === 'my' ? a.labelMy : a.label}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
