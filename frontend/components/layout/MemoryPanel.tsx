'use client'

import { useAgentStore } from '@/hooks/useAgentStore'
import { searchMemory } from '@/lib/api'
import { useState } from 'react'
import { Search, Brain, Loader2 } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

const TYPE_COLORS: Record<string, string> = {
  conversation: 'text-blue-400 bg-blue-400/10',
  task: 'text-green-400 bg-green-400/10',
  project: 'text-purple-400 bg-purple-400/10',
  execution: 'text-cyan-400 bg-cyan-400/10',
  tool: 'text-yellow-400 bg-yellow-400/10',
  error: 'text-red-400 bg-red-400/10',
  repo: 'text-orange-400 bg-orange-400/10',
  planning: 'text-indigo-400 bg-indigo-400/10',
}

export default function MemoryPanel() {
  const { sessionId } = useAgentStore()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!query.trim()) return
    setLoading(true)
    try {
      const data = await searchMemory(query, sessionId)
      setResults(data.results || [])
    } catch {
      setResults([])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col h-full bg-[#0f1017]">
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#2a2b3d]">
        <div className="flex items-center gap-2">
          <Brain size={14} className="text-brand-400" />
          <span className="text-sm font-semibold text-slate-200">Agent Memory</span>
        </div>
      </div>

      {/* Search */}
      <div className="px-4 py-3 border-b border-[#2a2b3d]">
        <form onSubmit={handleSearch} className="flex gap-2">
          <div className="flex-1 relative">
            <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search memories..."
              className="w-full bg-[#1a1b26] border border-[#2a2b3d] text-slate-200 text-xs rounded-lg pl-7 pr-3 py-2 outline-none focus:border-brand-500 placeholder-slate-600"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="px-3 py-2 bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white text-xs rounded-lg transition-all flex items-center gap-1"
          >
            {loading ? <Loader2 size={12} className="animate-spin" /> : <Search size={12} />}
          </button>
        </form>
      </div>

      {/* Results */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {results.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <Brain size={32} className="text-slate-700 mb-3" />
            <p className="text-sm text-slate-500">Search agent memories</p>
            <p className="text-xs text-slate-600 mt-1">Tasks, conversations, code, plans</p>
          </div>
        )}
        {results.map((mem) => {
          const typeStyle = TYPE_COLORS[mem.memory_type] || 'text-slate-400 bg-slate-400/10'
          const time = formatDistanceToNow(new Date(mem.created_at * 1000), { addSuffix: true })
          return (
            <div key={mem.id} className="rounded-lg border border-[#2a2b3d] bg-[#13141c] p-3">
              <div className="flex items-center justify-between mb-1.5">
                <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${typeStyle}`}>
                  {mem.memory_type}
                </span>
                <span className="text-[10px] text-slate-600">{time}</span>
              </div>
              <p className="text-[11px] text-slate-300 leading-relaxed line-clamp-3">
                {mem.content}
              </p>
              {mem.key && (
                <p className="text-[10px] text-slate-600 font-mono mt-1">{mem.key}</p>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
