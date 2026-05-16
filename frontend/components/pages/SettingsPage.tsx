'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  Settings, Key, Cpu, Bell, Shield, Globe, Palette, Zap,
  Check, Eye, EyeOff, Save, RefreshCw, ExternalLink, Copy, AlertCircle
} from 'lucide-react'
import { useAppStore, type Theme, type Locale } from '@/store/useAppStore'
import { getHealth, getAIStats } from '@/lib/api'

// ─── Types ────────────────────────────────────────────────────────────────────

interface ApiKeyEntry {
  id: string
  label: string
  key: string
  color: string
  provider: string
}

const THEMES: { id: Theme; label: string; my: string; icon: string; desc: string }[] = [
  { id: 'dark',   label: 'Dark',   my: 'မှောင်',  icon: '🌑', desc: 'Deep dark background' },
  { id: 'amoled', label: 'AMOLED', my: 'AMOLED',  icon: '⬛', desc: 'Pure black for OLED screens' },
  { id: 'neon',   label: 'Neon',   my: 'Neon',    icon: '💜', desc: 'Purple neon glow effect' },
  { id: 'glass',  label: 'Glass',  my: 'ဖန်ထည်', icon: '🔮', desc: 'Glassmorphism blur style' },
]

// ─── ApiKeyField ──────────────────────────────────────────────────────────────

function ApiKeyField({ label, value, color, onSave }: {
  label: string
  value: string
  color: string
  onSave: (val: string) => void
}) {
  const [show, setShow] = useState(false)
  const [editing, setEditing] = useState(false)
  const [val, setVal] = useState(value)
  const [saved, setSaved] = useState(false)

  const display = show ? val : (val ? val.slice(0, 8) + '••••••••••••' + val.slice(-4) : '(not set)')

  const handleSave = () => {
    onSave(val)
    setEditing(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="flex items-center gap-3 px-4 py-3 rounded-xl transition-colors"
      style={{ border: '1px solid var(--border)', background: 'var(--surface-3)' }}>
      <div className="w-2 h-2 rounded-full shrink-0" style={{ background: color }} />
      <span className="text-xs w-32 shrink-0" style={{ color: 'var(--text-muted)' }}>{label}</span>
      {editing ? (
        <input
          type="text"
          value={val}
          onChange={e => setVal(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSave()}
          className="input flex-1 text-xs py-1"
          placeholder="Enter API key..."
          autoFocus
        />
      ) : (
        <code className="text-xs flex-1 font-mono" style={{ color: 'var(--text-secondary)' }}>{display}</code>
      )}
      <div className="flex items-center gap-1 shrink-0">
        {editing ? (
          <button onClick={handleSave}
            className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-md"
            style={{ background: 'rgba(34,197,94,0.1)', color: '#4ade80' }}>
            {saved ? <Check size={10} /> : <Save size={10} />}
            {saved ? 'Saved' : 'Save'}
          </button>
        ) : (
          <button onClick={() => setEditing(true)}
            className="text-[10px] px-2 py-1 rounded-md hover:bg-white/5 transition-colors"
            style={{ color: 'var(--text-muted)' }}>
            Edit
          </button>
        )}
        <button onClick={() => setShow(!show)}
          className="p-1 rounded hover:bg-white/5 transition-colors"
          style={{ color: 'var(--text-muted)' }}>
          {show ? <EyeOff size={12} /> : <Eye size={12} />}
        </button>
      </div>
    </div>
  )
}

// ─── Toggle ───────────────────────────────────────────────────────────────────

function Toggle({ on, onChange, color = 'var(--accent)' }: { on: boolean; onChange: (v: boolean) => void; color?: string }) {
  return (
    <button
      onClick={() => onChange(!on)}
      className="toggle"
      style={{ background: on ? color : 'rgba(255,255,255,0.1)' }}
    >
      <div className="toggle-thumb" style={{ left: on ? 22 : 2 }} />
    </button>
  )
}

// ─── Settings ─────────────────────────────────────────────────────────────────

const SECTIONS = [
  { id: 'appearance', label: 'Appearance', labelMy: 'အပြင်', icon: Palette },
  { id: 'providers',  label: 'AI Providers', labelMy: 'AI Providers', icon: Cpu },
  { id: 'keys',       label: 'API Keys', labelMy: 'API Keys', icon: Key },
  { id: 'backend',    label: 'Backend',  labelMy: 'Backend', icon: Zap },
  { id: 'language',   label: 'Language', labelMy: 'ဘာသာစကား', icon: Globe },
  { id: 'security',   label: 'Security', labelMy: 'လုံခြုံရေး', icon: Shield },
]

export default function SettingsPage() {
  const {
    theme, setTheme,
    locale, setLocale,
    backendUrl, setBackendUrl,
  } = useAppStore()

  const [activeSection, setActiveSection] = useState('appearance')
  const [godMode, setGodMode] = useState(true)
  const [autoRotate, setAutoRotate] = useState(true)
  const [streamMode, setStreamMode] = useState(true)
  const [computeUseBanner, setComputeUseBanner] = useState(true)
  const [backendStatus, setBackendStatus] = useState<'checking' | 'ok' | 'error'>('checking')
  const [aiStats, setAiStats] = useState<Record<string, unknown>>({})
  const [backendInput, setBackendInput] = useState(backendUrl)
  const [savedBackend, setSavedBackend] = useState(false)

  const [keys, setKeys] = useState<ApiKeyEntry[]>([
    { id: 'gemini1', label: 'Gemini Key 1', key: '', color: '#22d3ee', provider: 'gemini' },
    { id: 'gemini2', label: 'Gemini Key 2', key: '', color: '#22d3ee', provider: 'gemini' },
    { id: 'samba1',  label: 'SambaNova Key 1', key: '', color: '#a78bfa', provider: 'sambanova' },
    { id: 'samba2',  label: 'SambaNova Key 2', key: '', color: '#a78bfa', provider: 'sambanova' },
    { id: 'github1', label: 'GitHub Token 1', key: '', color: '#34d399', provider: 'github' },
    { id: 'openai',  label: 'OpenAI Key', key: '', color: '#60a5fa', provider: 'openai' },
    { id: 'groq',    label: 'Groq Key', key: '', color: '#f59e0b', provider: 'groq' },
  ])

  // Check backend
  const checkBackend = async () => {
    setBackendStatus('checking')
    try {
      await getHealth()
      setBackendStatus('ok')
      const stats = await getAIStats().catch(() => ({}))
      setAiStats((stats as { stats?: Record<string, unknown> })?.stats || {})
    } catch {
      setBackendStatus('error')
    }
  }

  useEffect(() => { checkBackend() }, [])

  const saveBackendUrl = () => {
    setBackendUrl(backendInput)
    setSavedBackend(true)
    setTimeout(() => { setSavedBackend(false); checkBackend() }, 500)
  }

  const updateKey = (id: string, val: string) => {
    setKeys(prev => prev.map(k => k.id === id ? { ...k, key: val } : k))
  }

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-white flex items-center gap-2">
          <Settings size={20} style={{ color: 'var(--accent-bright)' }} />
          {locale === 'my' ? 'ဆက်တင်' : 'Settings'}
        </h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
          {locale === 'my' ? 'God Agent OS v11 ကို ပြင်ဆင်ရန်' : 'Configure God Agent OS v11 — AI, theme, keys & backend'}
        </p>
      </div>

      <div className="flex gap-6">
        {/* Nav */}
        <div className="w-48 shrink-0 space-y-0.5">
          {SECTIONS.map(sec => (
            <button
              key={sec.id}
              onClick={() => setActiveSection(sec.id)}
              className={`nav-item w-full text-left ${activeSection === sec.id ? 'active' : ''}`}
            >
              <sec.icon size={14} />
              {locale === 'my' ? sec.labelMy : sec.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0 space-y-4">

          {/* ── APPEARANCE ──────────────────────────────────────────────────── */}
          {activeSection === 'appearance' && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
              <h2 className="text-sm font-bold text-white mb-4">
                {locale === 'my' ? 'Theme ရွေးချယ်ရန်' : 'Choose Theme'}
              </h2>
              <div className="grid grid-cols-2 gap-3 mb-6">
                {THEMES.map(t => (
                  <button
                    key={t.id}
                    onClick={() => setTheme(t.id)}
                    className="p-4 rounded-xl text-left transition-all card"
                    style={{
                      border: theme === t.id ? '1.5px solid var(--accent)' : '1px solid var(--border)',
                      background: theme === t.id ? 'rgba(124,58,237,0.08)' : 'var(--surface-2)',
                    }}
                  >
                    <div className="text-2xl mb-2">{t.icon}</div>
                    <div className="font-semibold text-sm text-white flex items-center gap-2">
                      {locale === 'my' ? t.my : t.label}
                      {theme === t.id && <Check size={12} style={{ color: 'var(--accent-bright)' }} />}
                    </div>
                    <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{t.desc}</div>
                  </button>
                ))}
              </div>

              {/* UI Toggles */}
              <h3 className="text-sm font-semibold text-white mb-3">
                {locale === 'my' ? 'UI ဆက်တင်' : 'UI Settings'}
              </h3>
              <div className="space-y-2">
                {[
                  { label: 'Computer Use Panel', labelMy: 'Computer Use Panel', desc: 'Show Manus-style computer use panel by default', state: computeUseBanner, toggle: setComputeUseBanner, color: '#a78bfa' },
                  { label: 'Stream Mode', labelMy: 'Stream Mode', desc: 'Real-time token streaming from AI', state: streamMode, toggle: setStreamMode, color: '#22d3ee' },
                ].map(item => (
                  <div key={item.label} className="card p-4 flex items-center gap-4">
                    <div className="flex-1">
                      <div className="text-sm font-semibold text-white">{locale === 'my' ? item.labelMy : item.label}</div>
                      <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{item.desc}</div>
                    </div>
                    <Toggle on={item.state} onChange={item.toggle} color={item.color} />
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {/* ── AI PROVIDERS ─────────────────────────────────────────────────── */}
          {activeSection === 'providers' && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
              <h2 className="text-sm font-bold text-white mb-4">AI Provider Status</h2>

              <div className="space-y-3 mb-6">
                {[
                  { name: 'Gemini', model: 'gemini-2.0-flash', color: '#22d3ee', keys: 6, type: 'Primary', icon: '✦' },
                  { name: 'SambaNova', model: 'Meta-Llama-3.3-70B', color: '#a78bfa', keys: 9, type: 'Primary', icon: '◈' },
                  { name: 'GitHub Models', model: 'gpt-4o', color: '#34d399', keys: 9, type: 'Primary', icon: '⬡' },
                  { name: 'Groq', model: 'llama-3.3-70b', color: '#f59e0b', keys: 1, type: 'Fallback', icon: '⚡' },
                  { name: 'OpenAI', model: 'gpt-4o', color: '#60a5fa', keys: 1, type: 'Fallback', icon: '○' },
                ].map(p => {
                  const stat = (aiStats as Record<string, { available?: boolean; calls?: number }>)[p.name.toLowerCase().replace(' ', '_')] || {}
                  const available = stat.available !== false
                  return (
                    <div key={p.name} className="card p-4 flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg shrink-0"
                        style={{ background: `${p.color}15`, border: `1px solid ${p.color}25` }}>
                        <span style={{ color: p.color }}>{p.icon}</span>
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-sm text-white">{p.name}</span>
                          <span className="badge text-[10px]" style={{ background: `${p.color}15`, color: p.color, border: `1px solid ${p.color}25` }}>{p.type}</span>
                        </div>
                        <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{p.model} · {p.keys} keys</div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div className={`w-2 h-2 rounded-full ${available ? 'bg-green-400' : 'bg-red-400'}`} />
                        <span className="text-xs" style={{ color: available ? '#4ade80' : '#f87171' }}>
                          {available ? 'Active' : 'Offline'}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>

              <div className="space-y-2">
                {[
                  { label: 'God Mode', labelMy: 'God Mode', desc: 'Full autonomous operation — no confirmation needed', state: godMode, toggle: setGodMode, color: '#a78bfa' },
                  { label: 'Auto-Rotate Keys', labelMy: 'Key အလိုအလျောက်ပြောင်း', desc: 'Rotate API keys on rate limit or failure', state: autoRotate, toggle: setAutoRotate, color: '#22d3ee' },
                ].map(item => (
                  <div key={item.label} className="card p-4 flex items-center gap-4">
                    <div className="flex-1">
                      <div className="text-sm font-semibold text-white">{locale === 'my' ? item.labelMy : item.label}</div>
                      <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{item.desc}</div>
                    </div>
                    <Toggle on={item.state} onChange={item.toggle} color={item.color} />
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {/* ── API KEYS ─────────────────────────────────────────────────────── */}
          {activeSection === 'keys' && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
              <h2 className="text-sm font-bold text-white mb-2">API Key Management</h2>
              <p className="text-xs mb-4" style={{ color: 'var(--text-muted)' }}>
                {locale === 'my'
                  ? 'Keys များကို HF Space secrets တွင်သိမ်းထားသည်။ အောက်မှာ local စစ်ဆေးရန်သာ ထည့်ပါ။'
                  : 'Keys are stored in HF Space secrets. Enter here to test locally. Never commit to git.'}
              </p>
              <div className="card p-4 space-y-2">
                {keys.map(k => (
                  <ApiKeyField
                    key={k.id}
                    label={k.label}
                    value={k.key}
                    color={k.color}
                    onSave={(val) => updateKey(k.id, val)}
                  />
                ))}
              </div>
              <div className="flex items-center gap-2 mt-3 p-3 rounded-xl"
                style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.15)' }}>
                <AlertCircle size={14} style={{ color: '#fbbf24', flexShrink: 0 }} />
                <p className="text-xs" style={{ color: '#fbbf24' }}>
                  {locale === 'my'
                    ? 'စစ်မှန်သော keys များကို HF Space → Settings → Variables တွင်ထည့်ပါ'
                    : 'Add real keys in HF Space → Settings → Variables → GEMINI_KEY, SAMBANOVA_KEY, etc.'}
                </p>
              </div>
            </motion.div>
          )}

          {/* ── BACKEND ──────────────────────────────────────────────────────── */}
          {activeSection === 'backend' && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
              <h2 className="text-sm font-bold text-white mb-4">Backend Configuration</h2>

              {/* Status */}
              <div className="card p-4 mb-4 flex items-center gap-4">
                <div className={`w-3 h-3 rounded-full ${backendStatus === 'ok' ? 'bg-green-400' : backendStatus === 'error' ? 'bg-red-400' : 'bg-yellow-400 animate-pulse'}`} />
                <div className="flex-1">
                  <div className="text-sm font-semibold text-white">Backend Status</div>
                  <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                    {backendStatus === 'ok' ? '✓ Connected and healthy' : backendStatus === 'error' ? '✗ Cannot reach backend' : 'Checking...'}
                  </div>
                  <div className="text-[10px] mt-1 font-mono" style={{ color: 'var(--text-muted)' }}>{backendUrl}</div>
                </div>
                <button onClick={checkBackend}
                  className="btn btn-secondary text-xs py-1.5 px-3">
                  <RefreshCw size={11} />
                  {locale === 'my' ? 'စစ်ဆေး' : 'Test'}
                </button>
              </div>

              {/* URL Editor */}
              <div className="card p-4 mb-4">
                <label className="block text-xs font-semibold mb-2 text-white">
                  {locale === 'my' ? 'Backend URL' : 'Backend URL'}
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={backendInput}
                    onChange={e => setBackendInput(e.target.value)}
                    className="input flex-1 text-xs"
                    placeholder="https://pyae1994-autonomous-coding-system.hf.space"
                  />
                  <button onClick={saveBackendUrl} className="btn btn-primary text-xs px-3">
                    {savedBackend ? <Check size={13} /> : <Save size={13} />}
                    {savedBackend ? 'Saved' : 'Save'}
                  </button>
                </div>
              </div>

              {/* Quick Links */}
              <div className="space-y-2">
                {[
                  { label: 'HF Space (Main Backend)', url: 'https://huggingface.co/spaces/PYAE1994/autonomous-coding-system' },
                  { label: 'API Docs', url: `${backendUrl}/api/docs` },
                  { label: 'Health Check', url: `${backendUrl}/health` },
                  { label: 'GitHub Repo', url: 'https://github.com/pyaesonegtckglay-dotcom/god-agent-os' },
                ].map(link => (
                  <a key={link.label} href={link.url} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-2 p-3 rounded-xl hover:bg-white/3 transition-colors"
                    style={{ border: '1px solid var(--border)' }}>
                    <ExternalLink size={12} style={{ color: 'var(--accent-bright)' }} />
                    <span className="text-xs text-white">{link.label}</span>
                    <span className="ml-auto text-[10px] truncate max-w-[200px]" style={{ color: 'var(--text-muted)' }}>{link.url}</span>
                  </a>
                ))}
              </div>
            </motion.div>
          )}

          {/* ── LANGUAGE ─────────────────────────────────────────────────────── */}
          {activeSection === 'language' && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
              <h2 className="text-sm font-bold text-white mb-4">
                {locale === 'my' ? 'ဘာသာစကား ရွေးချယ်ရန်' : 'Language Selection'}
              </h2>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { id: 'en' as Locale, flag: '🇬🇧', label: 'English', desc: 'Interface in English' },
                  { id: 'my' as Locale, flag: '🇲🇲', label: 'မြန်မာဘာသာ', desc: 'မြန်မာဘာသာဖြင့် UI ပြသ' },
                ].map(l => (
                  <button
                    key={l.id}
                    onClick={() => setLocale(l.id)}
                    className="p-5 rounded-xl text-left card transition-all"
                    style={{
                      border: locale === l.id ? '1.5px solid var(--accent)' : '1px solid var(--border)',
                      background: locale === l.id ? 'rgba(124,58,237,0.08)' : 'var(--surface-2)',
                    }}
                  >
                    <div className="text-3xl mb-2">{l.flag}</div>
                    <div className="font-semibold text-sm text-white flex items-center gap-2">
                      {l.label}
                      {locale === l.id && <Check size={12} style={{ color: 'var(--accent-bright)' }} />}
                    </div>
                    <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{l.desc}</div>
                  </button>
                ))}
              </div>
            </motion.div>
          )}

          {/* ── SECURITY ─────────────────────────────────────────────────────── */}
          {activeSection === 'security' && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
              <h2 className="text-sm font-bold text-white mb-4">Security Settings</h2>
              <div className="space-y-3">
                <div className="card p-4">
                  <div className="text-sm font-semibold text-white mb-1">Data Storage</div>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    Chat sessions are stored locally in your browser (localStorage). No data sent to external servers except the configured backend.
                  </p>
                </div>
                <div className="card p-4">
                  <div className="text-sm font-semibold text-white mb-1">API Key Security</div>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    API keys should be stored as HF Space secrets (GEMINI_KEY, SAMBANOVA_KEY, GITHUB_KEY). Never hardcode in frontend.
                  </p>
                </div>
                <button
                  onClick={() => {
                    if (confirm('Clear all chat sessions? This cannot be undone.')) {
                      localStorage.removeItem('god_agent_v11_sessions')
                      localStorage.removeItem('god_agent_v11_active')
                      window.location.reload()
                    }
                  }}
                  className="btn w-full justify-center text-xs"
                  style={{ background: 'rgba(239,68,68,0.1)', color: '#f87171', border: '1px solid rgba(239,68,68,0.2)' }}
                >
                  Clear All Chat Data
                </button>
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  )
}
