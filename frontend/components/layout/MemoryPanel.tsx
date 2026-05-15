'use client'

import { useEffect, useState } from 'react'
import { useAgentStore } from '@/hooks/useAgentStore'
import { getMemory } from '@/lib/api'
const searchMemory = (q: string) => fetch('/api/v1/memory/search?q=' + encodeURIComponent(q)).then(r => r.json())
import { Brain, Search, RefreshCw, MessageSquare, Settings, Code2, User } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

const TYPE_META: Record<string, { icon: React.ElementType; color: string; label: string }> = {
  conversation:    { icon: MessageSquare, color: '#22d3ee', label: 'Conversation' },
  user_preference: { icon: User,          color: '#fbbf24', label: 'Preference' },
  user_directive:  { icon: User,          color: '#fbbf24', label: 'Directive' },
  project_context: { icon: Code2,         color: '#34d399', label: 'Project' },
  general:         { icon: Brain,         color: '#818cf8', label: 'General' },
}

export default function MemoryPanel() {
  const { sessionId, locale } = useAgentStore()
  const [memories, setMemories] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [searching, setSearching] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const data = await getMemory()
      setMemories(Array.isArray(data) ? data : data.memories || [])
    } catch {}
    setLoading(false)
  }

  const search = async () => {
    if (!query.trim()) { load(); return }
    setSearching(true)
    try {
      const data = await searchMemory(query)
      setMemories(Array.isArray(data) ? data : data.results || [])
    } catch {}
    setSearching(false)
  }

  useEffect(() => { load() }, [sessionId])

  return (
    <div className="flex flex-col h-full" style={{ background: 'var(--bg-2)' }}>
      <div className="flex items-center justify-between px-4 py-2.5 border-b shrink-0"
        style={{ borderColor: 'var(--border)', background: 'var(--bg-3)' }}>
        <div className="flex items-center gap-2">
          <Brain size={14} className="text-yellow-400" />
          <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
            {locale === 'my' ? 'မှတ်ဉာဏ်' : 'Memory'}
          </span>
          {memories.length > 0 && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full"
              style={{ background: 'rgba(251,191,36,0.15)', color: '#fbbf24', border: '1px solid rgba(251,191,36,0.3)' }}>
              {memories.length}
            </span>
          )}
        </div>
        <button onClick={load} className="p-1.5 rounded-lg hover:bg-white/5 transition-colors">
          <RefreshCw size={12} style={{ color: 'var(--text-muted)' }} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Search */}
      <div className="px-3 py-2 border-b" style={{ borderColor: 'var(--border)' }}>
        <div className="flex gap-1.5">
          <div className="flex-1 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg"
            style={{ background: 'var(--bg-3)', border: '1px solid var(--border)' }}>
            <Search size={11} style={{ color: 'var(--text-muted)' }} />
            <input
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && search()}
              placeholder={locale === 'my' ? 'မှတ်ဉာဏ်ရှာဖွေရန်...' : 'Search memory...'}
              className="flex-1 bg-transparent text-[11px] outline-none"
              style={{ color: 'var(--text-primary)' }}
            />
          </div>
          <button onClick={search} disabled={searching}
            className="px-2.5 py-1.5 rounded-lg text-[11px] disabled:opacity-40 transition-all"
            style={{ background: 'var(--brand)', color: '#fff' }}>
            <Search size={11} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {loading ? (
          <div className="space-y-2">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-16 rounded-xl shimmer" />
            ))}
          </div>
        ) : memories.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 py-8">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center"
              style={{ background: 'var(--bg-3)', border: '1px solid var(--border)' }}>
              <Brain size={20} style={{ color: 'var(--text-muted)' }} />
            </div>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              {locale === 'my' ? 'မှတ်ဉာဏ်မရှိသေးပါ' : 'No memories yet'}
            </p>
            <p className="text-[11px] text-center max-w-xs" style={{ color: 'var(--text-muted)' }}>
              {locale === 'my'
                ? 'Conversation များ မှတ်ဉာဏ်တွင် သိမ်းဆည်းမည်'
                : 'Conversations and context will be saved here automatically'}
            </p>
          </div>
        ) : (
          memories.map((mem: any, i: number) => {
            const tm = TYPE_META[mem.memory_type] || TYPE_META.general
            const Icon = tm.icon
            return (
              <div key={mem.id || i} className="rounded-xl p-3 transition-all"
                style={{ background: 'var(--bg-3)', border: '1px solid var(--border)' }}>
                <div className="flex items-center gap-2 mb-1.5">
                  <Icon size={11} style={{ color: tm.color }} />
                  <span className="text-[9px] px-1.5 py-0.5 rounded-full font-medium"
                    style={{ background: `${tm.color}15`, color: tm.color, border: `1px solid ${tm.color}30` }}>
                    {tm.label}
                  </span>
                  {mem.key && (
                    <span className="text-[9px] font-mono" style={{ color: 'var(--text-muted)' }}>
                      {mem.key}
                    </span>
                  )}
                  <span className="text-[9px] ml-auto" style={{ color: 'var(--text-muted)' }}>
                    {mem.created_at ? formatDistanceToNow(new Date(mem.created_at * 1000), { addSuffix: true }) : ''}
                  </span>
                </div>
                <p className="text-[11px] leading-relaxed line-clamp-3" style={{ color: 'var(--text-secondary)' }}>
                  {mem.content}
                </p>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
