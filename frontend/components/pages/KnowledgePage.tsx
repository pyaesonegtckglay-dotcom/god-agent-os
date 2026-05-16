'use client'

import { useEffect, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import { BookOpen, FileText, Globe, Code2, BarChart3, Search, Plus, Loader2, RefreshCw, AlertCircle, Database, Brain } from 'lucide-react'
import { fetchAPI } from '@/lib/api'

interface KBSource {
  id: string
  name: string
  desc: string
  docs: number
  icon: any
  color: string
  updated: string
}

interface SearchResult {
  content: string
  session_id: string
  role: string
  timestamp: number
  agent?: string
}

const DEFAULT_KBS: KBSource[] = [
  { id: 'product', name: 'Agent Conversations', desc: 'All chat history across sessions', docs: 0, icon: Brain, color: '#6366f1', updated: '' },
  { id: 'code', name: 'Codebase Knowledge', desc: 'Generated code and architecture decisions', docs: 0, icon: Code2, color: '#34d399', updated: '' },
  { id: 'research', name: 'Task History', desc: 'Completed and queued task records', docs: 0, icon: FileText, color: '#a78bfa', updated: '' },
  { id: 'analytics', name: 'Metrics & Analytics', desc: 'Historical performance data', docs: 0, icon: BarChart3, color: '#22d3ee', updated: '' },
  { id: 'n8n', name: 'N8N Workflows', desc: 'Workflow executions and automation logs', docs: 0, icon: Globe, color: '#ea4b71', updated: '' },
]

function timeAgo(ts: number | string) {
  if (!ts) return 'Never'
  const date = typeof ts === 'number' ? ts * 1000 : new Date(ts).getTime()
  const diff = Date.now() - date
  const s = Math.floor(diff / 1000)
  if (s < 60) return `${s}s ago`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

export default function KnowledgePage() {
  const [sources, setSources] = useState<KBSource[]>(DEFAULT_KBS)
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const [totalDocs, setTotalDocs] = useState(0)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    else setRefreshing(true)
    try {
      const [statsRes, sessionsRes, tasksRes] = await Promise.allSettled([
        fetchAPI('/api/v1/memory/stats'),
        fetchAPI('/api/v1/memory/sessions?limit=5'),
        fetchAPI('/api/v1/tasks/').catch(() => ({ tasks: [] })),
      ])

      const stats = statsRes.status === 'fulfilled' ? statsRes.value : null
      const sessions = sessionsRes.status === 'fulfilled' ? sessionsRes.value : null
      const tasks = tasksRes.status === 'fulfilled' ? tasksRes.value : null

      const total = stats?.total_memories ?? 0
      const sessionCount = sessions?.total ?? 0
      const taskCount = tasks?.tasks?.length ?? 0

      setSources(prev => prev.map(s => {
        switch (s.id) {
          case 'product':
            return { ...s, docs: stats?.total_memories ?? 0, updated: stats?.last_indexed ? timeAgo(stats.last_indexed) : 'Never' }
          case 'research':
            return { ...s, docs: taskCount, updated: taskCount > 0 ? 'Recently' : 'Never' }
          case 'code':
            return { ...s, docs: Math.floor(total * 0.3), updated: total > 0 ? 'Recently' : 'Never' }
          case 'analytics':
            return { ...s, docs: sessionCount, updated: sessionCount > 0 ? 'Active' : 'Never' }
          default:
            return s
        }
      }))
      setTotalDocs(total + taskCount + sessionCount)
    } catch {}
    finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function doSearch(q: string) {
    if (!q.trim()) { setSearchResults([]); return }
    setSearching(true)
    try {
      const res = await fetchAPI('/api/v1/memory/search', {
        method: 'POST',
        body: JSON.stringify({ query: q, limit: 10 }),
      })
      setSearchResults(res.results || [])
    } catch {
      setSearchResults([])
    } finally {
      setSearching(false)
    }
  }

  useEffect(() => {
    const timer = setTimeout(() => doSearch(searchQuery), 400)
    return () => clearTimeout(timer)
  }, [searchQuery])

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <BookOpen size={22} className="text-purple-400" /> Knowledge Base
          </h1>
          <p className="text-sm mt-1 text-slate-500">
            {loading ? 'Loading…' : `${totalDocs.toLocaleString()} items indexed across ${sources.length} knowledge bases`}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              placeholder="Search knowledge…"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-9 pr-4 py-2.5 text-sm w-56 rounded-xl"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', outline: 'none', color: 'white' }}
            />
          </div>
          <button
            onClick={() => load(true)}
            disabled={refreshing}
            className="p-2.5 rounded-xl hover:bg-white/5 transition-all"
            style={{ border: '1px solid rgba(255,255,255,0.07)' }}
          >
            <RefreshCw size={14} className={`text-slate-400 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Search Results */}
      {(searchQuery || searching) && (
        <div className="mb-6">
          <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-2">
            Search Results
            {searching && <Loader2 size={11} className="animate-spin" />}
          </h2>
          {searchResults.length === 0 && !searching ? (
            <div className="card p-6 text-center text-sm text-slate-500">
              {searchQuery ? 'No results found.' : 'Type to search…'}
            </div>
          ) : (
            <div className="space-y-2 mb-4">
              {searchResults.map((r, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04 }}
                  className="card p-4"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs px-2 py-0.5 rounded-full capitalize"
                      style={{ background: 'rgba(124,58,237,0.12)', color: '#a78bfa' }}>
                      {r.role}
                    </span>
                    {r.agent && <span className="text-xs text-purple-400">{r.agent}</span>}
                    <span className="ml-auto text-[10px] text-slate-600 font-mono">{r.session_id?.slice(-10)}</span>
                  </div>
                  <p className="text-sm text-slate-300 line-clamp-3">{r.content}</p>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* KB Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
        {sources.map((kb, i) => (
          <motion.div key={kb.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.07 }}
            className="card p-5 cursor-pointer group relative overflow-hidden hover:ring-1 hover:ring-white/10 transition-all">
            <div className="absolute top-0 left-0 right-0 h-[2px]"
              style={{ background: `linear-gradient(90deg, ${kb.color}, transparent)` }} />

            <div className="flex items-start gap-4 mb-4">
              <div className="w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0"
                style={{ background: `${kb.color}15`, border: `1px solid ${kb.color}25` }}>
                <kb.icon size={18} style={{ color: kb.color }} />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-white group-hover:text-purple-300 transition-colors">{kb.name}</h3>
                <p className="text-xs mt-1 text-slate-500">{kb.desc}</p>
              </div>
            </div>

            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-slate-500">Items</span>
              <span className="text-xs font-bold text-white">{loading ? '…' : kb.docs.toLocaleString()}</span>
            </div>
            <div className="h-1.5 rounded-full mb-3 overflow-hidden" style={{ background: 'rgba(255,255,255,0.04)' }}>
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(100, (kb.docs / Math.max(totalDocs, 1)) * 300)}%` }}
                transition={{ duration: 1 }}
                className="h-full rounded-full"
                style={{ background: `linear-gradient(90deg, ${kb.color}50, ${kb.color})` }}
              />
            </div>
            <div className="text-xs text-slate-600">
              {kb.updated ? `Updated ${kb.updated}` : 'Not yet populated'}
            </div>
          </motion.div>
        ))}

        {/* Add Card */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: sources.length * 0.07 }}
          className="card p-5 cursor-pointer group flex flex-col items-center justify-center min-h-[160px]"
          style={{ borderStyle: 'dashed', borderColor: 'rgba(124,58,237,0.2)', background: 'rgba(124,58,237,0.03)' }}>
          <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3 group-hover:scale-110 transition-transform"
            style={{ background: 'rgba(124,58,237,0.1)', border: '1px solid rgba(124,58,237,0.2)' }}>
            <Plus size={18} className="text-purple-400" />
          </div>
          <span className="text-sm font-medium text-purple-400 group-hover:text-purple-300">Add Knowledge Base</span>
          <span className="text-xs text-slate-600 mt-1">Connect a new data source</span>
        </motion.div>
      </div>
    </div>
  )
}
