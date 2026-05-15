'use client'

import { useEffect, useState } from 'react'
import { useAgentStore } from '@/hooks/useAgentStore'
import { getConnectors } from '@/lib/api'
const setConnectorToken = (id: string, token: string) => fetch('/api/v1/connectors/' + id + '/token', { method: 'POST', body: JSON.stringify({ token }), headers: { 'Content-Type': 'application/json' } })
import { Plug, CheckCircle2, XCircle, Eye, EyeOff, ChevronRight, RefreshCw, Zap } from 'lucide-react'

const CATEGORY_LABELS: Record<string, string> = {
  ai: '🤖 AI Providers',
  code: '💻 Code & Dev',
  deploy: '🚀 Deployment',
  workflow: '⚙️ Workflow',
  messaging: '💬 Messaging',
  infra: '🏗️ Infrastructure',
}

const CATEGORY_ORDER = ['ai', 'code', 'deploy', 'workflow', 'messaging', 'infra']

interface Connector {
  id: string
  name: string
  connected: boolean
  color: string
  description: string
  category: string
  token_preview?: string
}

export default function ConnectorsPanel() {
  const { locale } = useAgentStore()
  const [connectors, setConnectors] = useState<Connector[]>([])
  const [loading, setLoading] = useState(true)
  const [tokenInputs, setTokenInputs] = useState<Record<string, string>>({})
  const [showToken, setShowToken] = useState<Record<string, boolean>>({})
  const [saving, setSaving] = useState<Record<string, boolean>>({})
  const [activeCategory, setActiveCategory] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    try {
      const data = await getConnectors()
      setConnectors(data.connectors || [])
    } catch {}
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const saveToken = async (id: string) => {
    const token = tokenInputs[id]?.trim()
    if (!token) return
    setSaving(s => ({ ...s, [id]: true }))
    try {
      await setConnectorToken(id, token)
      setConnectors(prev => prev.map(c => c.id === id ? { ...c, connected: true, token_preview: token.slice(0, 8) + '...' } : c))
      setTokenInputs(s => ({ ...s, [id]: '' }))
    } catch {}
    setSaving(s => ({ ...s, [id]: false }))
  }

  const byCategory = CATEGORY_ORDER.reduce((acc, cat) => {
    const items = connectors.filter(c => c.category === cat)
    if (items.length) acc[cat] = items
    return acc
  }, {} as Record<string, Connector[]>)

  const connected = connectors.filter(c => c.connected)
  const total = connectors.length

  return (
    <div className="flex flex-col h-full" style={{ background: 'var(--bg-2)' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b shrink-0"
        style={{ borderColor: 'var(--border)', background: 'var(--bg-3)' }}>
        <div className="flex items-center gap-2">
          <Plug size={14} className="text-indigo-400" />
          <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
            {locale === 'my' ? 'ချိတ်ဆက်မှုများ' : 'Connectors'}
          </span>
          <span className="text-[10px] px-1.5 py-0.5 rounded-full"
            style={{ background: connected.length > 0 ? 'rgba(34,197,94,0.15)' : 'rgba(99,102,241,0.15)', color: connected.length > 0 ? '#4ade80' : '#818cf8', border: `1px solid ${connected.length > 0 ? 'rgba(34,197,94,0.3)' : 'rgba(99,102,241,0.3)'}` }}>
            {connected.length}/{total}
          </span>
        </div>
        <button onClick={load} className="p-1.5 rounded-lg hover:bg-white/5 transition-colors" title="Refresh">
          <RefreshCw size={12} style={{ color: 'var(--text-muted)' }} />
        </button>
      </div>

      {/* Summary bar */}
      {connected.length > 0 && (
        <div className="px-3 py-2 border-b flex flex-wrap gap-1.5"
          style={{ borderColor: 'var(--border)', background: 'rgba(34,197,94,0.05)' }}>
          {connected.slice(0, 6).map(c => (
            <div key={c.id} className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-medium"
              style={{ background: `${c.color}15`, color: c.color, border: `1px solid ${c.color}30` }}>
              <CheckCircle2 size={8} />
              {c.name}
            </div>
          ))}
          {connected.length > 6 && (
            <div className="text-[9px] px-2 py-0.5 rounded-full" style={{ background: 'var(--bg-3)', color: 'var(--text-muted)' }}>
              +{connected.length - 6} more
            </div>
          )}
        </div>
      )}

      {/* Connectors list */}
      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        {loading ? (
          <div className="space-y-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-16 rounded-xl shimmer" style={{ borderRadius: '12px' }} />
            ))}
          </div>
        ) : (
          Object.entries(byCategory).map(([cat, items]) => (
            <div key={cat}>
              <p className="text-[10px] font-semibold uppercase tracking-wider mb-2 px-1"
                style={{ color: 'var(--text-muted)' }}>
                {CATEGORY_LABELS[cat] || cat}
              </p>
              <div className="space-y-2">
                {items.map(c => (
                  <ConnectorCard
                    key={c.id}
                    connector={c}
                    tokenInput={tokenInputs[c.id] || ''}
                    showToken={showToken[c.id] || false}
                    saving={saving[c.id] || false}
                    onTokenChange={(v) => setTokenInputs(s => ({ ...s, [c.id]: v }))}
                    onToggleShow={() => setShowToken(s => ({ ...s, [c.id]: !s[c.id] }))}
                    onSave={() => saveToken(c.id)}
                  />
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Footer hint */}
      <div className="p-3 border-t" style={{ borderColor: 'var(--border)' }}>
        <p className="text-[10px] text-center" style={{ color: 'var(--text-muted)' }}>
          {locale === 'my'
            ? 'Token များ env var တွင် ထည့်သွင်းနိုင်သည် — Runtime တွင်လည်း ထည့်နိုင်သည်'
            : 'Add tokens via env vars or set them at runtime above'}
        </p>
      </div>
    </div>
  )
}

function ConnectorCard({ connector: c, tokenInput, showToken, saving, onTokenChange, onToggleShow, onSave }: {
  connector: Connector
  tokenInput: string
  showToken: boolean
  saving: boolean
  onTokenChange: (v: string) => void
  onToggleShow: () => void
  onSave: () => void
}) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="rounded-xl overflow-hidden transition-all"
      style={{
        background: 'var(--bg-3)',
        border: `1px solid ${c.connected ? c.color + '40' : 'var(--border)'}`,
        boxShadow: c.connected ? `0 0 12px ${c.color}10` : 'none',
      }}>
      <button className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-white/5 transition-colors"
        onClick={() => !c.connected && setExpanded(!expanded)}>
        {/* Color dot */}
        <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ background: `${c.color}15`, border: `1px solid ${c.color}30` }}>
          <div className="w-3 h-3 rounded-full" style={{ background: c.color }} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>{c.name}</span>
            {c.connected && <CheckCircle2 size={10} className="text-green-400" />}
          </div>
          <p className="text-[10px] truncate" style={{ color: 'var(--text-muted)' }}>{c.description}</p>
        </div>

        <div className="flex items-center gap-1.5 flex-shrink-0">
          {c.connected ? (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full text-green-400"
              style={{ background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.25)' }}>
              Connected
            </span>
          ) : (
            <ChevronRight size={12} style={{ color: 'var(--text-muted)', transform: expanded ? 'rotate(90deg)' : 'rotate(0)', transition: 'transform 0.2s' }} />
          )}
        </div>
      </button>

      {/* Token input (expanded) */}
      {expanded && !c.connected && (
        <div className="px-3 pb-3 border-t" style={{ borderColor: 'var(--border)' }}>
          <p className="text-[10px] mt-2 mb-1.5" style={{ color: 'var(--text-muted)' }}>
            Add API token to connect:
          </p>
          <div className="flex gap-1.5">
            <div className="flex-1 flex items-center gap-1 px-2 py-1.5 rounded-lg"
              style={{ background: 'var(--bg-0)', border: '1px solid var(--border)' }}>
              <input
                type={showToken ? 'text' : 'password'}
                value={tokenInput}
                onChange={e => onTokenChange(e.target.value)}
                placeholder="Token..."
                className="flex-1 bg-transparent text-[11px] outline-none"
                style={{ color: 'var(--text-primary)' }}
                onKeyDown={e => e.key === 'Enter' && onSave()}
              />
              <button onClick={onToggleShow} className="text-slate-500 hover:text-slate-300">
                {showToken ? <EyeOff size={10} /> : <Eye size={10} />}
              </button>
            </div>
            <button onClick={onSave} disabled={!tokenInput.trim() || saving}
              className="px-2.5 py-1.5 rounded-lg text-[11px] font-medium disabled:opacity-40 transition-all"
              style={{ background: 'var(--brand)', color: '#fff' }}>
              {saving ? '...' : <Zap size={11} />}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
