'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Plus, CheckCircle, XCircle, Loader, ExternalLink, Key } from 'lucide-react'

interface Connector {
  id: string
  name: string
  icon: string
  description: string
  connected: boolean
  category: string
  apiKeyField?: string
}

const CONNECTORS: Connector[] = [
  { id: 'github',      name: 'GitHub',          icon: '🐙', description: 'Repository management, PRs, Issues', connected: false, category: 'DevTools', apiKeyField: 'GitHub Token' },
  { id: 'openai',      name: 'OpenAI',          icon: '🤖', description: 'GPT-4, DALL-E, Whisper APIs',        connected: false, category: 'AI', apiKeyField: 'API Key' },
  { id: 'anthropic',   name: 'Anthropic',        icon: '🧠', description: 'Claude 3 Opus/Sonnet/Haiku',       connected: false, category: 'AI', apiKeyField: 'API Key' },
  { id: 'gemini',      name: 'Google Gemini',    icon: '✨', description: 'Gemini Pro/Flash models',           connected: true,  category: 'AI', apiKeyField: 'API Key' },
  { id: 'sambanova',   name: 'SambaNova',        icon: '⚡', description: 'Ultra-fast LLM inference',         connected: true,  category: 'AI', apiKeyField: 'API Key' },
  { id: 'vercel',      name: 'Vercel',           icon: '▲', description: 'Deploy and manage web apps',        connected: false, category: 'Deploy', apiKeyField: 'Access Token' },
  { id: 'huggingface', name: 'HuggingFace',      icon: '🤗', description: 'Models, Spaces, Datasets',         connected: false, category: 'AI', apiKeyField: 'HF Token' },
  { id: 'slack',       name: 'Slack',            icon: '💬', description: 'Team messaging and notifications',  connected: false, category: 'Comm' },
  { id: 'notion',      name: 'Notion',           icon: '📝', description: 'Knowledge management',             connected: false, category: 'Productivity' },
  { id: 'docker',      name: 'Docker',           icon: '🐳', description: 'Container management',             connected: false, category: 'DevOps' },
  { id: 'aws',         name: 'AWS',              icon: '☁️', description: 'Cloud infrastructure',             connected: false, category: 'Cloud', apiKeyField: 'Access Key' },
  { id: 'stripe',      name: 'Stripe',           icon: '💳', description: 'Payment processing',               connected: false, category: 'Finance', apiKeyField: 'Secret Key' },
]

const CATEGORIES = ['All', 'AI', 'DevTools', 'Deploy', 'DevOps', 'Comm', 'Productivity', 'Cloud', 'Finance']

export default function ConnectorsPage() {
  const [connectors, setConnectors] = useState(CONNECTORS)
  const [selectedCategory, setSelectedCategory] = useState('All')
  const [selectedConnector, setSelectedConnector] = useState<Connector | null>(null)
  const [apiKey, setApiKey] = useState('')
  const [connecting, setConnecting] = useState(false)

  const filtered = selectedCategory === 'All' 
    ? connectors 
    : connectors.filter(c => c.category === selectedCategory)
  
  const connectedCount = connectors.filter(c => c.connected).length

  async function connectConnector(connector: Connector) {
    setConnecting(true)
    await new Promise(r => setTimeout(r, 1500))
    setConnectors(prev => prev.map(c => 
      c.id === connector.id ? { ...c, connected: true } : c
    ))
    setConnecting(false)
    setSelectedConnector(null)
    setApiKey('')
  }

  function disconnectConnector(id: string) {
    setConnectors(prev => prev.map(c => 
      c.id === id ? { ...c, connected: false } : c
    ))
  }

  return (
    <div className="h-full overflow-y-auto p-6" style={{ background: '#05060d' }}>
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white mb-1">Connectors</h1>
            <p className="text-slate-500 text-sm">{connectedCount} of {connectors.length} services connected</p>
          </div>
          <button className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white"
            style={{ background: 'linear-gradient(135deg, #7c3aed, #4f46e5)' }}>
            <Plus size={14} />
            Add Custom
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-3 mb-6">
          {[
            { label: 'Connected', value: connectedCount, color: '#22c55e' },
            { label: 'Available', value: connectors.length - connectedCount, color: '#64748b' },
            { label: 'AI Models', value: connectors.filter(c => c.category === 'AI' && c.connected).length, color: '#7c3aed' },
            { label: 'Deploy', value: connectors.filter(c => c.category === 'Deploy' && c.connected).length, color: '#0891b2' },
          ].map(stat => (
            <div key={stat.label} className="p-3 rounded-xl border text-center"
              style={{ background: '#07080f', borderColor: '#1e2035' }}>
              <div className="text-xl font-bold" style={{ color: stat.color }}>{stat.value}</div>
              <div className="text-[10px] text-slate-600">{stat.label}</div>
            </div>
          ))}
        </div>

        {/* Category Filter */}
        <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
          {CATEGORIES.map(cat => (
            <button key={cat}
              onClick={() => setSelectedCategory(cat)}
              className="flex-shrink-0 px-3 py-1 rounded-full text-xs font-medium transition-all"
              style={{
                background: selectedCategory === cat ? 'rgba(139,92,246,0.2)' : 'rgba(255,255,255,0.04)',
                color: selectedCategory === cat ? '#a78bfa' : '#64748b',
                border: `1px solid ${selectedCategory === cat ? 'rgba(139,92,246,0.4)' : 'transparent'}`,
              }}>
              {cat}
            </button>
          ))}
        </div>

        {/* Connectors Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {filtered.map((connector, i) => (
            <motion.div
              key={connector.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
              className="p-4 rounded-xl border transition-all"
              style={{
                background: '#07080f',
                borderColor: connector.connected ? 'rgba(34,197,94,0.2)' : '#1e2035',
              }}>
              
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{connector.icon}</span>
                  <div>
                    <div className="text-sm font-semibold text-white">{connector.name}</div>
                    <div className="text-[9px] text-slate-600">{connector.category}</div>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {connector.connected ? (
                    <CheckCircle size={14} className="text-green-400" />
                  ) : (
                    <XCircle size={14} className="text-slate-600" />
                  )}
                </div>
              </div>
              
              <p className="text-[10px] text-slate-500 mb-3">{connector.description}</p>
              
              <div className="flex gap-2">
                {connector.connected ? (
                  <button
                    onClick={() => disconnectConnector(connector.id)}
                    className="flex-1 py-1.5 rounded-lg text-xs text-red-400 transition-all hover:bg-red-500/10"
                    style={{ border: '1px solid rgba(239,68,68,0.2)' }}>
                    Disconnect
                  </button>
                ) : (
                  <button
                    onClick={() => setSelectedConnector(connector)}
                    className="flex-1 py-1.5 rounded-lg text-xs font-medium text-white transition-all"
                    style={{ background: 'rgba(139,92,246,0.2)', border: '1px solid rgba(139,92,246,0.3)' }}>
                    Connect
                  </button>
                )}
              </div>
            </motion.div>
          ))}
        </div>

        {/* Connect Modal */}
        {selectedConnector && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="w-full max-w-md p-6 rounded-2xl"
              style={{ background: '#0d0e1a', border: '1px solid #1e2035' }}>
              
              <div className="flex items-center gap-3 mb-4">
                <span className="text-3xl">{selectedConnector.icon}</span>
                <div>
                  <h3 className="text-lg font-bold text-white">Connect {selectedConnector.name}</h3>
                  <p className="text-xs text-slate-500">{selectedConnector.description}</p>
                </div>
              </div>
              
              {selectedConnector.apiKeyField && (
                <div className="mb-4">
                  <label className="text-xs text-slate-400 mb-1 block">{selectedConnector.apiKeyField}</label>
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg"
                    style={{ background: '#07080f', border: '1px solid #1e2035' }}>
                    <Key size={13} className="text-slate-600" />
                    <input
                      type="password"
                      value={apiKey}
                      onChange={e => setApiKey(e.target.value)}
                      placeholder={`Enter your ${selectedConnector.apiKeyField}...`}
                      className="flex-1 bg-transparent text-sm text-slate-200 outline-none"
                    />
                  </div>
                </div>
              )}
              
              <div className="flex gap-3">
                <button
                  onClick={() => { setSelectedConnector(null); setApiKey('') }}
                  className="flex-1 py-2 rounded-lg text-sm text-slate-400 transition-all hover:bg-white/5">
                  Cancel
                </button>
                <button
                  onClick={() => connectConnector(selectedConnector)}
                  disabled={connecting}
                  className="flex-1 py-2 rounded-lg text-sm font-medium text-white transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                  style={{ background: 'linear-gradient(135deg, #7c3aed, #4f46e5)' }}>
                  {connecting ? (
                    <><Loader size={13} className="animate-spin" /> Connecting...</>
                  ) : (
                    'Connect'
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </div>
    </div>
  )
}
