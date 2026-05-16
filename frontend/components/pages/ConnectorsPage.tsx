'use client'

import { useEffect, useMemo, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import {
  Plus, CheckCircle, XCircle, Loader2, Key, RefreshCw,
  Link2, Workflow, AlertCircle, ExternalLink, Save,
} from 'lucide-react'
import { getConnectors, setConnectorToken, n8nSetConfig, n8nGetConfig, n8nStatus } from '@/lib/api'

interface Connector {
  id: string
  name: string
  icon: string
  description: string
  connected: boolean
  category: string
  env_key: string
  color?: string
  token_preview?: string | null
}

interface N8NPanel {
  url: string
  apiKey: string
  connected: boolean | null
  loading: boolean
  saving: boolean
  error: string
  success: string
}

// ── N8N Special Connector Panel ───────────────────────────────────────────────
function N8NConnectorPanel() {
  const [state, setState] = useState<N8NPanel>({
    url: '',
    apiKey: '',
    connected: null,
    loading: true,
    saving: false,
    error: '',
    success: '',
  })

  const load = useCallback(async () => {
    setState(s => ({ ...s, loading: true, error: '' }))
    try {
      const [cfg, statusRes] = await Promise.allSettled([n8nGetConfig(), n8nStatus()])
      const cfgVal = cfg.status === 'fulfilled' ? cfg.value : null
      const statusVal = statusRes.status === 'fulfilled' ? statusRes.value : null
      setState(s => ({
        ...s,
        url: cfgVal?.url || 'https://pyae1994-n8n-aiven-v1.hf.space',
        apiKey: '',
        connected: statusVal?.connected ?? false,
        loading: false,
      }))
    } catch {
      setState(s => ({ ...s, loading: false, connected: false }))
    }
  }, [])

  useEffect(() => { load() }, [load])

  async function save() {
    if (!state.url.trim()) {
      setState(s => ({ ...s, error: 'N8N URL is required.' }))
      return
    }
    setState(s => ({ ...s, saving: true, error: '', success: '' }))
    try {
      await n8nSetConfig(state.url.trim(), state.apiKey.trim())
      // test connection
      const statusRes = await n8nStatus()
      setState(s => ({
        ...s,
        saving: false,
        connected: statusRes.connected,
        success: statusRes.connected
          ? 'N8N connected successfully!'
          : 'Config saved, but N8N is not reachable.',
      }))
      // fire notification
      const event = new CustomEvent('god-agent-notification', {
        detail: {
          id: `n8n_connect_${Date.now()}`,
          title: statusRes.connected ? 'N8N Connected' : 'N8N Config Saved',
          description: statusRes.connected
            ? `Connected to ${state.url}`
            : 'Saved config, but cannot reach n8n right now.',
          type: statusRes.connected ? 'success' : 'warning',
          timestamp: Date.now(),
        },
      })
      window.dispatchEvent(event)
    } catch (e: any) {
      setState(s => ({ ...s, saving: false, error: e?.message || 'Failed to save config.' }))
    }
  }

  return (
    <div className="p-5 rounded-2xl mb-6"
      style={{
        background: 'linear-gradient(135deg, rgba(234,75,113,0.06), rgba(124,58,237,0.06))',
        border: `1px solid ${state.connected ? 'rgba(234,75,113,0.35)' : 'rgba(234,75,113,0.15)'}`,
      }}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl"
            style={{ background: '#ea4b7115' }}>
            ⚡
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-white">n8n Workflow Automation</h3>
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${state.connected ? 'text-green-400 bg-green-400/10' : 'text-red-400 bg-red-400/10'}`}>
                {state.loading ? 'Checking…' : state.connected ? '● Connected' : '○ Disconnected'}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">Connect your n8n instance to monitor workflows in the Workflows tab</p>
          </div>
        </div>
        {state.connected && (
          <a href="https://pyae1994-n8n-aiven-v1.hf.space" target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-xs font-medium text-pink-400 hover:text-pink-300 transition-colors">
            <ExternalLink size={12} /> Open n8n
          </a>
        )}
      </div>

      {state.loading ? (
        <div className="flex items-center gap-2 text-sm text-slate-500"><Loader2 size={14} className="animate-spin" /> Loading config…</div>
      ) : (
        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-slate-400 block mb-1.5">N8N URL</label>
            <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl" style={{ background: 'var(--bg-3)', border: '1px solid var(--border)' }}>
              <Link2 size={13} className="text-slate-500 flex-shrink-0" />
              <input
                type="url"
                value={state.url}
                onChange={e => setState(s => ({ ...s, url: e.target.value }))}
                placeholder="https://your-n8n-instance.com"
                className="flex-1 bg-transparent outline-none text-sm text-white placeholder-slate-600"
              />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-400 block mb-1.5">API Key</label>
            <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl" style={{ background: 'var(--bg-3)', border: '1px solid var(--border)' }}>
              <Key size={13} className="text-slate-500 flex-shrink-0" />
              <input
                type="password"
                value={state.apiKey}
                onChange={e => setState(s => ({ ...s, apiKey: e.target.value }))}
                placeholder="eyJhbGci… (leave blank to keep existing)"
                className="flex-1 bg-transparent outline-none text-sm text-white placeholder-slate-600"
              />
            </div>
            <p className="text-[10px] text-slate-600 mt-1">
              Find your API key in n8n → Settings → API → Create API Key
            </p>
          </div>

          {state.error && (
            <div className="flex items-center gap-2 text-xs text-red-400 p-2 rounded-lg bg-red-400/10">
              <AlertCircle size={12} />{state.error}
            </div>
          )}
          {state.success && (
            <div className="flex items-center gap-2 text-xs text-green-400 p-2 rounded-lg bg-green-400/10">
              <CheckCircle size={12} />{state.success}
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <button
              onClick={save}
              disabled={state.saving}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-50 transition-all hover:opacity-90"
              style={{ background: 'linear-gradient(135deg, #ea4b71, #c2355a)' }}
            >
              {state.saving ? <><Loader2 size={13} className="animate-spin" /> Saving…</> : <><Save size={13} /> Save & Connect</>}
            </button>
            <button
              onClick={load}
              className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium text-slate-300 hover:bg-white/5 transition-all"
              style={{ border: '1px solid var(--border)' }}
            >
              <RefreshCw size={13} className={state.loading ? 'animate-spin' : ''} /> Test
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function ConnectorsPage() {
  const [connectors, setConnectors] = useState<Connector[]>([])
  const [selectedCategory, setSelectedCategory] = useState('All')
  const [selectedConnector, setSelectedConnector] = useState<Connector | null>(null)
  const [apiKey, setApiKey] = useState('')
  const [connecting, setConnecting] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const categories = useMemo(() => ['All', ...Array.from(new Set(connectors.map((c) => c.category)))], [connectors])
  const filtered = selectedCategory === 'All' ? connectors : connectors.filter((c) => c.category === selectedCategory)
  const connectedCount = connectors.filter((c) => c.connected).length

  async function loadConnectors() {
    setLoading(true)
    setError('')
    try {
      const data = await getConnectors()
      setConnectors(data.connectors || [])
    } catch (err: any) {
      setError(err?.message || 'Failed to load connectors.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadConnectors()
  }, [])

  async function connectConnector(connector: Connector) {
    if (!apiKey.trim()) return
    setConnecting(true)
    try {
      await setConnectorToken(connector.id, apiKey.trim())
      await loadConnectors()
      setSelectedConnector(null)
      setApiKey('')
      const event = new CustomEvent('god-agent-notification', {
        detail: {
          id: `connector_${connector.id}_${Date.now()}`,
          title: `${connector.name} Connected`,
          description: `${connector.name} connector is now active.`,
          type: 'success',
          timestamp: Date.now(),
        },
      })
      window.dispatchEvent(event)
    } catch (err: any) {
      setError(err?.message || `Failed to connect ${connector.name}.`)
    } finally {
      setConnecting(false)
    }
  }

  async function disconnectConnector(connector: Connector) {
    try {
      await setConnectorToken(connector.id, '')
      await loadConnectors()
    } catch (err: any) {
      setError(err?.message || `Failed to disconnect ${connector.name}.`)
    }
  }

  return (
    <div className="h-full overflow-y-auto p-6" style={{ background: 'var(--void)', color: 'var(--text-primary)' }}>
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6 gap-4">
          <div>
            <h1 className="text-2xl font-bold mb-1">Connectors</h1>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              {connectedCount} of {connectors.length} services connected
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={loadConnectors}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium"
              style={{ background: 'var(--bg-3)', border: '1px solid var(--border)' }}
            >
              <RefreshCw size={14} /> Refresh
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-2xl text-sm flex items-center gap-2"
            style={{ background: 'rgba(220,38,38,0.1)', border: '1px solid rgba(220,38,38,0.2)', color: '#dc2626' }}>
            <AlertCircle size={14} />{error}
            <button onClick={() => setError('')} className="ml-auto opacity-60 hover:opacity-100 text-xs">✕</button>
          </div>
        )}

        {/* N8N Special Panel */}
        <N8NConnectorPanel />

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          {[
            { label: 'Connected', value: connectedCount, color: '#22c55e' },
            { label: 'Available', value: connectors.length - connectedCount, color: '#64748b' },
            { label: 'AI', value: connectors.filter((c) => c.category === 'ai' && c.connected).length, color: '#7c3aed' },
            { label: 'Workflow', value: connectors.filter((c) => c.category === 'workflow' && c.connected).length, color: '#ea4b71' },
          ].map((stat) => (
            <div key={stat.label} className="p-4 rounded-2xl" style={{ background: 'var(--bg-2)', border: '1px solid var(--border)' }}>
              <div className="text-2xl font-bold" style={{ color: stat.color }}>{stat.value}</div>
              <div className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>{stat.label}</div>
            </div>
          ))}
        </div>

        {/* Category filter */}
        <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className="flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-all capitalize"
              style={{
                background: selectedCategory === cat ? 'rgba(124,58,237,0.14)' : 'var(--bg-3)',
                color: selectedCategory === cat ? '#8b5cf6' : 'var(--text-secondary)',
                border: `1px solid ${selectedCategory === cat ? 'rgba(124,58,237,0.25)' : 'var(--border)'}`,
              }}
            >
              {cat}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="py-16 flex items-center justify-center" style={{ color: 'var(--text-secondary)' }}>
            <Loader2 size={18} className="animate-spin mr-2" /> Loading connectors...
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filtered.map((connector, i) => (
              <motion.div
                key={connector.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                className="p-4 rounded-2xl"
                style={{
                  background: 'var(--bg-2)',
                  border: `1px solid ${connector.connected ? 'rgba(34,197,94,0.2)' : 'var(--border)'}`,
                }}
              >
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div>
                    <div className="text-sm font-semibold">{connector.name}</div>
                    <div className="text-[11px] mt-1 uppercase tracking-[0.2em]" style={{ color: 'var(--text-secondary)' }}>
                      {connector.category}
                    </div>
                  </div>
                  {connector.connected
                    ? <CheckCircle size={18} className="text-green-500" />
                    : <XCircle size={18} style={{ color: 'var(--text-secondary)' }} />}
                </div>

                <p className="text-xs leading-relaxed mb-3" style={{ color: 'var(--text-secondary)' }}>{connector.description}</p>

                <div className="text-[11px] mb-3" style={{ color: 'var(--text-secondary)' }}>
                  Env: <span className="font-mono">{connector.env_key}</span>
                  {connector.token_preview ? <span className="ml-2 text-green-400">• {connector.token_preview}</span> : null}
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => { setSelectedConnector(connector); setApiKey('') }}
                    className="flex-1 py-2 rounded-xl text-xs font-medium text-white"
                    style={{ background: 'linear-gradient(135deg, #7c3aed, #4f46e5)' }}
                  >
                    {connector.connected ? 'Update token' : 'Connect'}
                  </button>
                  {connector.connected && (
                    <button
                      onClick={() => disconnectConnector(connector)}
                      className="flex-1 py-2 rounded-xl text-xs font-medium"
                      style={{ background: 'rgba(220,38,38,0.08)', color: '#dc2626', border: '1px solid rgba(220,38,38,0.2)' }}
                    >
                      Disconnect
                    </button>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        )}

        {/* Connect modal */}
        {selectedConnector && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={(e) => { if (e.target === e.currentTarget) { setSelectedConnector(null); setApiKey('') } }}>
            <motion.div
              initial={{ opacity: 0, scale: 0.97, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              className="w-full max-w-md p-6 rounded-3xl"
              style={{ background: 'var(--bg-2)', border: '1px solid var(--border)' }}
            >
              <div className="mb-4">
                <h3 className="text-lg font-bold">{selectedConnector.connected ? 'Update token —' : 'Connect'} {selectedConnector.name}</h3>
                <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
                  Token is applied to the running backend immediately. For permanent deployment, also set it in HF Spaces secrets.
                </p>
              </div>

              <div className="mb-4">
                <label className="text-xs font-medium block mb-2" style={{ color: 'var(--text-secondary)' }}>
                  {selectedConnector.env_key}
                </label>
                <div className="flex items-center gap-2 px-3 py-3 rounded-2xl" style={{ background: 'var(--bg-3)', border: '1px solid var(--border)' }}>
                  <Key size={14} style={{ color: 'var(--text-secondary)' }} />
                  <input
                    type="password"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && apiKey.trim()) connectConnector(selectedConnector) }}
                    placeholder={`Enter ${selectedConnector.env_key}`}
                    className="flex-1 bg-transparent outline-none text-sm"
                    style={{ color: 'var(--text-primary)' }}
                    autoFocus
                  />
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => { setSelectedConnector(null); setApiKey('') }}
                  className="flex-1 py-2.5 rounded-2xl text-sm"
                  style={{ background: 'var(--bg-3)', border: '1px solid var(--border)' }}
                >
                  Cancel
                </button>
                <button
                  onClick={() => connectConnector(selectedConnector)}
                  disabled={connecting || !apiKey.trim()}
                  className="flex-1 py-2.5 rounded-2xl text-sm font-medium text-white disabled:opacity-50 flex items-center justify-center gap-2"
                  style={{ background: 'linear-gradient(135deg, #7c3aed, #4f46e5)' }}
                >
                  {connecting ? <><Loader2 size={14} className="animate-spin" /> Saving...</> : 'Save token'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </div>
    </div>
  )
}
