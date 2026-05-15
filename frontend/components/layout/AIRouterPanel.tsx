'use client'

import { useEffect, useState } from 'react'
import { useAgentStore } from '@/hooks/useAgentStore'
import { Cpu, Key, RefreshCw, CheckCircle2, XCircle, AlertCircle, Zap, Activity } from 'lucide-react'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:7860'

interface ProviderStat {
  calls: number
  errors: number
  avg_latency_ms: number
  available: boolean
  key_count: number
  available_keys: number
  priority: number
}

interface KeyInfo {
  key_preview: string
  available: boolean
  failures: number
  calls: number
  cooldown_remaining_s: number
}

interface PoolStatus {
  provider: string
  total_keys: number
  available_keys: number
  keys: KeyInfo[]
}

const PROVIDER_ICONS: Record<string, string> = {
  sambanova: '⚡',
  gemini: '✨',
  openai: '🤖',
  groq: '🦙',
  cerebras: '🧠',
  openrouter: '🔀',
  anthropic: '🪄',
}

const PROVIDER_COLORS: Record<string, string> = {
  sambanova: '#f97316',
  gemini: '#4285f4',
  openai: '#10a37f',
  groq: '#f59e0b',
  cerebras: '#8b5cf6',
  openrouter: '#6366f1',
  anthropic: '#d97706',
}

export default function AIRouterPanel() {
  const { locale } = useAgentStore()
  const [stats, setStats] = useState<Record<string, ProviderStat>>({})
  const [pools, setPools] = useState<Record<string, PoolStatus>>({})
  const [loading, setLoading] = useState(true)
  const [expandedProvider, setExpandedProvider] = useState<string | null>(null)
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null)

  const load = async () => {
    setLoading(true)
    try {
      const [statsRes, poolRes] = await Promise.all([
        fetch(`${API_URL}/api/v1/ai/stats`).then(r => r.json()).catch(() => ({})),
        fetch(`${API_URL}/api/v1/ai/pool-status`).then(r => r.json()).catch(() => ({})),
      ])
      setStats(statsRes.stats || {})
      setPools(poolRes.pools || {})
      setLastRefresh(new Date())
    } catch {}
    setLoading(false)
  }

  useEffect(() => {
    load()
    const interval = setInterval(load, 30000)
    return () => clearInterval(interval)
  }, [])

  const sortedProviders = Object.entries(stats).sort(
    ([, a], [, b]) => (a.priority || 99) - (b.priority || 99)
  )

  const activeCount = sortedProviders.filter(([, s]) => s.available).length
  const totalCalls = sortedProviders.reduce((sum, [, s]) => sum + s.calls, 0)

  return (
    <div className="flex flex-col h-full" style={{ background: 'var(--bg-2)' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b shrink-0"
        style={{ borderColor: 'var(--border)', background: 'var(--bg-3)' }}>
        <div className="flex items-center gap-2">
          <Cpu size={14} className="text-indigo-400" />
          <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
            {locale === 'my' ? 'AI Router v8' : 'AI Router v8'}
          </span>
          <span className="text-[10px] px-1.5 py-0.5 rounded-full"
            style={{
              background: activeCount > 0 ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)',
              color: activeCount > 0 ? '#4ade80' : '#f87171',
              border: `1px solid ${activeCount > 0 ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`,
            }}>
            {activeCount} active
          </span>
        </div>
        <button onClick={load} disabled={loading}
          className="p-1.5 rounded-lg hover:bg-white/5 transition-colors" title="Refresh">
          <RefreshCw size={12} style={{ color: 'var(--text-muted)' }}
            className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Summary */}
      <div className="px-3 py-2 border-b flex gap-3 text-xs"
        style={{ borderColor: 'var(--border)', background: 'rgba(99,102,241,0.05)' }}>
        <div className="flex items-center gap-1">
          <Activity size={10} className="text-indigo-400" />
          <span style={{ color: 'var(--text-muted)' }}>Total calls:</span>
          <span className="font-mono font-semibold" style={{ color: 'var(--text-primary)' }}>{totalCalls}</span>
        </div>
        <div className="flex items-center gap-1">
          <Key size={10} className="text-indigo-400" />
          <span style={{ color: 'var(--text-muted)' }}>Providers:</span>
          <span className="font-mono font-semibold" style={{ color: 'var(--text-primary)' }}>
            {activeCount}/{sortedProviders.length}
          </span>
        </div>
        {lastRefresh && (
          <div className="ml-auto text-[10px]" style={{ color: 'var(--text-muted)' }}>
            {lastRefresh.toLocaleTimeString()}
          </div>
        )}
      </div>

      {/* Provider List */}
      <div className="flex-1 overflow-y-auto">
        {loading && sortedProviders.length === 0 ? (
          <div className="flex items-center justify-center h-24">
            <div className="flex gap-1">
              {[0, 1, 2].map(i => (
                <div key={i} className="w-1.5 h-1.5 rounded-full animate-bounce"
                  style={{ background: 'var(--brand)', animationDelay: `${i * 0.15}s` }} />
              ))}
            </div>
          </div>
        ) : sortedProviders.length === 0 ? (
          <div className="p-4 text-center text-xs" style={{ color: 'var(--text-muted)' }}>
            No providers configured
          </div>
        ) : (
          <div className="p-2 flex flex-col gap-1.5">
            {sortedProviders.map(([name, stat]) => {
              const pool = pools[name]
              const icon = PROVIDER_ICONS[name] || '🔌'
              const color = PROVIDER_COLORS[name] || '#6366f1'
              const isExpanded = expandedProvider === name
              const successRate = stat.calls > 0
                ? Math.round(((stat.calls - stat.errors) / stat.calls) * 100)
                : 100

              return (
                <div key={name}
                  className="rounded-xl border overflow-hidden cursor-pointer hover:border-opacity-60 transition-all"
                  style={{
                    borderColor: stat.available ? `${color}40` : 'var(--border)',
                    background: stat.available ? `${color}08` : 'var(--bg-3)',
                  }}
                  onClick={() => setExpandedProvider(isExpanded ? null : name)}>

                  {/* Provider Header */}
                  <div className="flex items-center gap-2 px-3 py-2">
                    <span className="text-sm">{icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold capitalize" style={{ color: 'var(--text-primary)' }}>
                          {name}
                        </span>
                        {stat.priority <= 2 && (
                          <span className="text-[9px] px-1 py-0.5 rounded font-bold"
                            style={{ background: `${color}25`, color }}>
                            PRIMARY
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                          {stat.calls} calls · {stat.avg_latency_ms}ms avg
                        </span>
                        {pool && (
                          <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                            · {pool.available_keys}/{pool.total_keys} keys
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {/* Success Rate Bar */}
                      {stat.calls > 0 && (
                        <div className="w-12 h-1.5 rounded-full overflow-hidden"
                          style={{ background: 'var(--bg-0)' }}>
                          <div className="h-full rounded-full transition-all"
                            style={{
                              width: `${successRate}%`,
                              background: successRate > 80 ? '#4ade80' : successRate > 50 ? '#fbbf24' : '#f87171',
                            }} />
                        </div>
                      )}
                      {stat.available ? (
                        <CheckCircle2 size={12} style={{ color: '#4ade80' }} />
                      ) : (
                        <XCircle size={12} style={{ color: '#f87171' }} />
                      )}
                    </div>
                  </div>

                  {/* Expanded Key Pool */}
                  {isExpanded && pool && pool.keys.length > 0 && (
                    <div className="px-3 pb-3 border-t" style={{ borderColor: 'var(--border)' }}>
                      <div className="pt-2 text-[10px] font-semibold mb-2" style={{ color: 'var(--text-muted)' }}>
                        KEY POOL ({pool.available_keys}/{pool.total_keys} available)
                      </div>
                      <div className="flex flex-col gap-1">
                        {pool.keys.map((k, i) => (
                          <div key={i} className="flex items-center gap-2 px-2 py-1 rounded-lg"
                            style={{ background: k.available ? 'rgba(34,197,94,0.05)' : 'rgba(239,68,68,0.05)' }}>
                            <Key size={9} style={{ color: k.available ? '#4ade80' : '#f87171' }} />
                            <span className="font-mono text-[10px] flex-1" style={{ color: 'var(--text-secondary)' }}>
                              {k.key_preview}
                            </span>
                            <span className="text-[9px]" style={{ color: 'var(--text-muted)' }}>
                              {k.calls} calls
                            </span>
                            {k.failures > 0 && (
                              <span className="text-[9px]" style={{ color: '#fbbf24' }}>
                                {k.failures} fails
                              </span>
                            )}
                            {!k.available && k.cooldown_remaining_s > 0 && (
                              <span className="text-[9px] px-1 rounded"
                                style={{ background: 'rgba(239,68,68,0.15)', color: '#f87171' }}>
                                {Math.round(k.cooldown_remaining_s)}s
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Footer Info */}
      <div className="px-3 py-2 border-t text-[10px]"
        style={{ borderColor: 'var(--border)', color: 'var(--text-muted)', background: 'var(--bg-3)' }}>
        <div className="flex items-center gap-1">
          <Zap size={9} className="text-indigo-400" />
          <span>Priority: SambaNova → Gemini → OpenAI → Groq → Cerebras → Anthropic</span>
        </div>
      </div>
    </div>
  )
}
