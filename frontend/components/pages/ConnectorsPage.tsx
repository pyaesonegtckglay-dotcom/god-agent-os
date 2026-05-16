'use client'

import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { Plus, CheckCircle, XCircle, Loader2, Key, RefreshCw } from 'lucide-react'
import { getConnectors, setConnectorToken } from '@/lib/api'

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
            <button
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white"
              style={{ background: 'linear-gradient(135deg, #7c3aed, #4f46e5)' }}
              onClick={() => setSelectedConnector(connectors[0] || null)}
              disabled={connectors.length === 0}
            >
              <Plus size={14} /> Add / Update Token
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-2xl text-sm" style={{ background: 'rgba(220,38,38,0.1)', border: '1px solid rgba(220,38,38,0.2)', color: '#dc2626' }}>
            {error}
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          {[
            { label: 'Connected', value: connectedCount, color: '#22c55e' },
            { label: 'Available', value: connectors.length - connectedCount, color: '#64748b' },
            { label: 'AI', value: connectors.filter((c) => c.category === 'ai' && c.connected).length, color: '#7c3aed' },
            { label: 'Messaging', value: connectors.filter((c) => c.category === 'messaging' && c.connected).length, color: '#0891b2' },
          ].map((stat) => (
            <div key={stat.label} className="p-4 rounded-2xl" style={{ background: 'var(--bg-2)', border: '1px solid var(--border)' }}>
              <div className="text-2xl font-bold" style={{ color: stat.color }}>{stat.value}</div>
              <div className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>{stat.label}</div>
            </div>
          ))}
        </div>

        <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className="flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-all"
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
                style={{ background: 'var(--bg-2)', border: `1px solid ${connector.connected ? 'rgba(34,197,94,0.2)' : 'var(--border)'}` }}
              >
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div>
                    <div className="text-sm font-semibold">{connector.name}</div>
                    <div className="text-[11px] mt-1 uppercase tracking-[0.2em]" style={{ color: 'var(--text-secondary)' }}>{connector.category}</div>
                  </div>
                  {connector.connected ? <CheckCircle size={18} className="text-green-500" /> : <XCircle size={18} style={{ color: 'var(--text-secondary)' }} />}
                </div>

                <p className="text-xs leading-relaxed mb-3" style={{ color: 'var(--text-secondary)' }}>{connector.description}</p>

                <div className="text-[11px] mb-3" style={{ color: 'var(--text-secondary)' }}>
                  Env key: <span className="font-mono">{connector.env_key}</span>
                  {connector.token_preview ? <span className="ml-2">• {connector.token_preview}</span> : null}
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

        {selectedConnector && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              className="w-full max-w-md p-6 rounded-3xl"
              style={{ background: 'var(--bg-2)', border: '1px solid var(--border)' }}
            >
              <div className="mb-4">
                <h3 className="text-lg font-bold">{selectedConnector.connected ? 'Update token' : 'Connect'} {selectedConnector.name}</h3>
                <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
                  Tokens are applied to the running backend environment immediately. For permanent deployment, also configure the same secret in your hosting platform.
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
                    placeholder={`Enter ${selectedConnector.env_key}`}
                    className="flex-1 bg-transparent outline-none text-sm"
                    style={{ color: 'var(--text-primary)' }}
                  />
                </div>
              </div>

              <div className="flex gap-3">
                <button onClick={() => { setSelectedConnector(null); setApiKey('') }} className="flex-1 py-2.5 rounded-2xl text-sm" style={{ background: 'var(--bg-3)', border: '1px solid var(--border)' }}>
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
