'use client'

import { useState } from 'react'
import { Globe, Search, ArrowRight, Loader2, ExternalLink, BookOpen } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

const QUICK_SEARCHES = [
  { label: 'Latest AI News', query: 'latest AI agent developments 2025' },
  { label: 'FastAPI Docs', query: 'https://fastapi.tiangolo.com' },
  { label: 'Next.js 14', query: 'Next.js 14 app router best practices' },
  { label: 'HuggingFace', query: 'https://huggingface.co' },
]

export default function BrowserPanel() {
  const [query, setQuery] = useState('')
  const [result, setResult] = useState('')
  const [loading, setLoading] = useState(false)
  const [history, setHistory] = useState<string[]>([])

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

  const search = async (q?: string) => {
    const searchQuery = q || query.trim()
    if (!searchQuery || loading) return
    setLoading(true)
    setResult('')
    setHistory(prev => [searchQuery, ...prev.slice(0, 4)])
    try {
      const resp = await fetch(`${apiUrl}/api/v1/browser/research`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: searchQuery, session_id: 'browser' }),
      })
      if (resp.ok) {
        const data = await resp.json()
        setResult(data.result || '')
      } else {
        setResult('❌ Research failed. Check if the backend is running.')
      }
    } catch (e) {
      setResult('❌ Cannot reach backend. Make sure the API server is running.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col h-full" style={{ background: 'var(--bg-1)' }}>
      {/* Header */}
      <div className="px-3 py-2.5 border-b shrink-0"
        style={{ borderColor: 'var(--border)', background: 'var(--bg-2)' }}>
        <div className="flex items-center gap-2 mb-2">
          <Globe size={13} className="text-blue-400" />
          <span className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>
            Browser Agent
          </span>
          <span className="text-[10px] px-1.5 py-0.5 rounded"
            style={{ background: 'rgba(59,130,246,0.15)', color: '#3b82f6', border: '1px solid rgba(59,130,246,0.3)' }}>
            Web Research
          </span>
        </div>

        {/* Search bar */}
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <Search size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2 opacity-40"
              style={{ color: 'var(--text-muted)' }} />
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && search()}
              placeholder="URL or search query..."
              className="w-full text-xs pl-7 pr-3 py-2 rounded-xl outline-none"
              style={{
                background: 'var(--bg-3)',
                border: '1px solid var(--border)',
                color: 'var(--text-primary)',
              }}
            />
          </div>
          <button
            onClick={() => search()}
            disabled={loading || !query.trim()}
            className="p-2 rounded-xl transition-all disabled:opacity-40"
            style={{ background: 'var(--brand)' }}>
            {loading ? <Loader2 size={13} className="text-white animate-spin" /> : <ArrowRight size={13} className="text-white" />}
          </button>
        </div>
      </div>

      {/* Quick searches */}
      <div className="flex gap-1.5 px-3 py-2 flex-wrap shrink-0 border-b"
        style={{ borderColor: 'var(--border)' }}>
        {QUICK_SEARCHES.map(({ label, query: q }) => (
          <button key={label}
            onClick={() => { setQuery(q); search(q) }}
            className="text-[10px] px-2 py-1 rounded-lg transition-all hover:opacity-80"
            style={{ background: 'var(--bg-3)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}>
            {label}
          </button>
        ))}
      </div>

      {/* Result */}
      <div className="flex-1 overflow-y-auto p-3">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-40 gap-3">
            <div className="relative">
              <Globe size={24} className="text-blue-400 animate-pulse" />
            </div>
            <p className="text-xs animate-pulse" style={{ color: 'var(--text-muted)' }}>
              Researching the web...
            </p>
          </div>
        ) : result ? (
          <div className="prose prose-sm prose-invert max-w-none text-xs"
            style={{ color: 'var(--text-secondary)' }}>
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{result}</ReactMarkdown>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-40 gap-3">
            <BookOpen size={24} className="opacity-20" style={{ color: 'var(--text-muted)' }} />
            <p className="text-xs text-center" style={{ color: 'var(--text-muted)' }}>
              Enter a URL or search query<br />to start web research
            </p>
          </div>
        )}
      </div>

      {/* History */}
      {history.length > 0 && (
        <div className="px-3 py-2 border-t shrink-0" style={{ borderColor: 'var(--border)', background: 'var(--bg-2)' }}>
          <p className="text-[10px] mb-1" style={{ color: 'var(--text-muted)' }}>Recent:</p>
          <div className="flex flex-col gap-0.5">
            {history.map((h, i) => (
              <button key={i}
                onClick={() => { setQuery(h); search(h) }}
                className="text-[10px] text-left truncate hover:opacity-80 transition-all"
                style={{ color: 'var(--text-secondary)' }}>
                → {h}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
