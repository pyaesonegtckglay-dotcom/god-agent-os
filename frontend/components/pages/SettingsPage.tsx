'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Settings, Key, Zap, Bell, Shield, Cpu, ChevronRight, Check, Eye, EyeOff } from 'lucide-react'

const PROVIDER_CONFIGS = [
  { name: 'Gemini', model: 'gemini-2.0-flash', status: 'active', color: '#22d3ee', keys: 6, type: 'Primary' },
  { name: 'Sambanova', model: 'Meta-Llama-3.3-70B', status: 'active', color: '#a78bfa', keys: 9, type: 'Primary' },
  { name: 'GitHub Models', model: 'gpt-4o', status: 'active', color: '#34d399', keys: 9, type: 'Primary' },
]

const SETTING_SECTIONS = [
  { id: 'providers', label: 'AI Providers', icon: Cpu },
  { id: 'keys', label: 'API Keys', icon: Key },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'security', label: 'Security', icon: Shield },
]

function ApiKeyField({ label, value, color }: { label: string; value: string; color: string }) {
  const [show, setShow] = useState(false)
  const display = show ? value : value.slice(0, 8) + '••••••••••••••••' + value.slice(-4)
  return (
    <div className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-white/[0.02] transition-colors" style={{ border: '1px solid rgba(255,255,255,0.06)' }}>
      <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: color }} />
      <span className="text-sm text-slate-400 w-28 flex-shrink-0">{label}</span>
      <code className="text-xs flex-1 text-slate-300 font-mono">{display}</code>
      <button onClick={() => setShow(!show)} className="text-slate-600 hover:text-slate-400 transition-colors">
        {show ? <EyeOff size={14} /> : <Eye size={14} />}
      </button>
    </div>
  )
}

export default function SettingsPage() {
  const [activeSection, setActiveSection] = useState('providers')
  const [godModeToggle, setGodModeToggle] = useState(true)
  const [autoRotate, setAutoRotate] = useState(true)
  const [streamMode, setStreamMode] = useState(true)

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-white flex items-center gap-2">
          <Settings size={22} className="text-purple-400" /> Settings
        </h1>
        <p className="text-sm mt-1 text-slate-500">Configure God Agent OS — AI providers, keys, and preferences</p>
      </div>

      <div className="flex gap-6">
        {/* Sidebar Nav */}
        <div className="w-48 flex-shrink-0 space-y-1">
          {SETTING_SECTIONS.map(sec => (
            <button key={sec.id} onClick={() => setActiveSection(sec.id)}
              className={`nav-item w-full text-left ${activeSection === sec.id ? 'active' : ''}`}>
              <sec.icon size={15} />
              {sec.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0 space-y-4">

          {activeSection === 'providers' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <h2 className="text-sm font-bold text-white mb-4">AI Provider Configuration</h2>

              <div className="space-y-3 mb-6">
                {PROVIDER_CONFIGS.map(p => (
                  <div key={p.name} className="card p-4 flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg flex-shrink-0"
                      style={{ background: `${p.color}15`, border: `1px solid ${p.color}25` }}>
                      <Cpu size={16} style={{ color: p.color }} />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-white text-sm">{p.name}</span>
                        <span className="text-xs px-2 py-0.5 rounded-full font-semibold"
                          style={{ background: `${p.color}15`, color: p.color }}>{p.type}</span>
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5">{p.model} · {p.keys} keys configured</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-green-400" />
                      <span className="text-xs text-green-400 font-medium">Active</span>
                      <Check size={14} className="text-green-400" />
                    </div>
                  </div>
                ))}
              </div>

              {/* Toggle settings */}
              <div className="space-y-3">
                {[
                  { label: 'God Mode', desc: 'Full autonomous operation mode', state: godModeToggle, toggle: setGodModeToggle, color: '#a78bfa' },
                  { label: 'Auto-Rotate Keys', desc: 'Automatically rotate API keys on rate limit', state: autoRotate, toggle: setAutoRotate, color: '#22d3ee' },
                  { label: 'Stream Mode', desc: 'Real-time streaming output from all providers', state: streamMode, toggle: setStreamMode, color: '#34d399' },
                ].map(item => (
                  <div key={item.label} className="card p-4 flex items-center gap-4">
                    <div className="flex-1">
                      <div className="text-sm font-semibold text-white">{item.label}</div>
                      <div className="text-xs text-slate-500 mt-0.5">{item.desc}</div>
                    </div>
                    <button onClick={() => item.toggle(!item.state)}
                      className="w-10 h-5.5 rounded-full relative transition-all flex-shrink-0"
                      style={{
                        background: item.state ? item.color : 'rgba(255,255,255,0.1)',
                        width: 44, height: 24
                      }}>
                      <div className="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all"
                        style={{ left: item.state ? 21 : 2 }} />
                    </button>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {activeSection === 'keys' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <h2 className="text-sm font-bold text-white mb-4">API Key Management</h2>
              <div className="card p-5 space-y-2">
                <ApiKeyField label="Gemini Key 1" value="GEMINI_KEY_1_CONFIGURED" color="#22d3ee" />
                <ApiKeyField label="Gemini Key 2" value="GEMINI_KEY_2_CONFIGURED" color="#22d3ee" />
                <ApiKeyField label="Sambanova Key 1" value="SAMBANOVA_KEY_1_CONFIGURED" color="#a78bfa" />
                <ApiKeyField label="GitHub Key 1" value="GITHUB_KEY_1_CONFIGURED" color="#34d399" />
              </div>
              <p className="text-xs text-slate-600 mt-3">Keys are stored securely in environment variables. Never commit to version control.</p>
            </motion.div>
          )}

          {activeSection === 'notifications' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <h2 className="text-sm font-bold text-white mb-4">Notification Preferences</h2>
              <div className="card p-5">
                <p className="text-sm text-slate-500">Configure notification settings for agent activity, task completion, and system alerts.</p>
              </div>
            </motion.div>
          )}

          {activeSection === 'security' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <h2 className="text-sm font-bold text-white mb-4">Security Settings</h2>
              <div className="card p-5">
                <p className="text-sm text-slate-500">Manage authentication, access control, and audit logging.</p>
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  )
}
