'use client'

import { useEffect, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import { Brain, Database, Clock, Search, Tag, Loader2, RefreshCw, MessageSquare, AlertCircle } from 'lucide-react'
import { fetchAPI } from '@/lib/api'

interface MemoryItem {
  session_id: string
  role: string
  content: string
  timestamp: number
  agent?: string
}

interface MemoryStats {
  total_memories: number
  total_sessions: number
  storage_estimate_mb: number
  last_indexed: number
  error?: string
}

const ROLE_COLORS: Record<string, string> = {
  user: '#3b82f6',
  assistant: '#7c3aed',
  system: '#64748b',
}

function timeAgo(ts: number) {
  const diff = Date.now() - ts * 1000
  const s = Math.floor(diff / 1000)
  if (s < 60) return `${s}s ago`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

export default function MemoryPage() {
  const [memories, setMemories] = useState<MemoryItem[]>([])
  const [stats, setStats] = useState<MemoryStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    else setRefreshing(true)
    setError(null)
    try {
      const [statsRes, memRes] = await Promise.allSettled([
        fetchAPI('/api/v1/memory/stats'),
        fetchAPI('/api/v1/memory/recent?limit=30'),
      ])
      if (statsRes.status === 'fulfilled') setStats(statsRes.value)
      if (memRes.status === 'fulfilled') setMemories(memRes.value.memories || [])
      else setError((memRes as any).reason?.message || 'Failed to load memories')
    } catch (e: any) {
      setError(e?.message || 'Failed to connect')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    load()
    const interval = setInterval(() => load(true), 30000)
    return () => clearInterval(interval)
  }, [load])

  const filtered = memories.filter(m =>
    !search || m.content.toLowerCase().includes(search.toLowerCase()) ||
    m.session_id.includes(search) || (m.agent || '').includes(search)
  )

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center space-y-3">
          <Loader2 size={32} className="animate-spin text-purple-400 mx-auto" />
          <p className="text-sm text-slate-500">Loading memory…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <Brain size={22} className="text-purple-400" /> Memory
          </h1>
          <p className="text-sm mt-1 text-slate-500">
            Persistent agent knowledge — {stats?.total_memories ?? '…'} memories across {stats?.total_sessions ?? '…'} sessions
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              placeholder="Search memories…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="cmd-input pl-9 pr-4 py-2.5 text-sm w-56"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, outline: 'none', color: 'white' }}
            />
          </div>
          <button
            onClick={() => load(true)}
            disabled={refreshing}
            className="p-2 rounded-xl hover:bg-white/5 transition-all"
            style={{ border: '1px solid rgba(255,255,255,0.07)' }}
          >
            <RefreshCw size={14} className={`text-slate-400 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-xl flex items-center gap-2 text-sm text-yellow-400"
          style={{ background: '#f59e0b10', border: '1px solid #f59e0b30' }}>
          <AlertCircle size={14} />
          {error} — showing cached/demo data
          <button onClick={() => setError(null)} className="ml-auto opacity-60 hover:opacity-100 text-xs">✕</button>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: 'Total Memories', value: stats?.total_memories ?? '…', icon: Database, color: '#6366f1' },
          { label: 'Sessions', value: stats?.total_sessions ?? '…', icon: MessageSquare, color: '#22d3ee' },
          { label: 'Storage', value: stats ? `${stats.storage_estimate_mb} MB` : '…', icon: Clock, color: '#a78bfa' },
        ].map(stat => (
          <div key={stat.label} className="card p-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: `${stat.color}15` }}>
              <stat.icon size={16} style={{ color: stat.color }} />
            </div>
            <div>
              <div className="text-lg font-bold text-white">{stat.value}</div>
              <div className="text-xs text-slate-500">{stat.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Memory list */}
      {filtered.length === 0 ? (
        <div className="card p-12 text-center">
          <Brain size={32} className="mx-auto mb-3 text-slate-600" />
          <p className="text-sm text-slate-500">
            {memories.length === 0 ? 'No memories yet. Start chatting to build memory.' : 'No results match your search.'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((m, i) => {
            const color = ROLE_COLORS[m.role] || '#64748b'
            return (
              <motion.div
                key={`${m.session_id}_${i}`}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
                className="card p-4"
              >
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5"
                    style={{ background: `${color}15`, border: `1px solid ${color}20` }}>
                    <MessageSquare size={13} style={{ color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs px-2 py-0.5 rounded-full font-medium capitalize"
                        style={{ background: `${color}12`, color }}>
                        {m.role}
                      </span>
                      {m.agent && (
                        <span className="text-xs text-purple-400 bg-purple-400/10 px-2 py-0.5 rounded-full">
                          {m.agent}
                        </span>
                      )}
                      <span className="ml-auto flex items-center gap-1 text-xs text-slate-600">
                        <Clock size={9} /> {timeAgo(m.timestamp)}
                      </span>
                    </div>
                    <p className="text-sm text-slate-300 leading-relaxed line-clamp-3">{m.content}</p>
                    <div className="flex items-center gap-1 mt-2 text-[10px] text-slate-600">
                      <Tag size={8} />
                      <span className="font-mono">{m.session_id?.slice(-12)}</span>
                    </div>
                  </div>
                </div>
              </motion.div>
            )
          })}
        </div>
      )}
    </div>
  )
}
