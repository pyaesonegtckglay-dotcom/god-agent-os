'use client'

import { useEffect, useMemo, useState } from 'react'
import { Settings, Cpu, Bell, Shield, Palette, CheckCircle2, Loader2 } from 'lucide-react'
import { useAppStore } from '@/store/useAppStore'
import { getConnectorSummary, getConnectors } from '@/lib/api'

const SETTINGS_KEY = 'god-agent-os-settings'

export default function SettingsPage() {
  const { themeMode, setThemeMode } = useAppStore()
  const [notificationsEnabled, setNotificationsEnabled] = useState(true)
  const [streamMode, setStreamMode] = useState(true)
  const [summary, setSummary] = useState<any>(null)
  const [connectors, setConnectors] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(SETTINGS_KEY)
      const parsed = raw ? JSON.parse(raw) : {}
      setNotificationsEnabled(parsed.notificationsEnabled ?? true)
      setStreamMode(parsed.streamMode ?? true)
    } catch {}
  }, [])

  useEffect(() => {
    window.localStorage.setItem(
      SETTINGS_KEY,
      JSON.stringify({ notificationsEnabled, streamMode }),
    )
  }, [notificationsEnabled, streamMode])

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        const [summaryData, connectorsData] = await Promise.all([getConnectorSummary(), getConnectors()])
        setSummary(summaryData)
        setConnectors(connectorsData.connectors || [])
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const connectedConnectors = useMemo(() => connectors.filter((item) => item.connected), [connectors])

  return (
    <div className="h-full overflow-y-auto p-6" style={{ background: 'var(--void)', color: 'var(--text-primary)' }}>
      <div className="max-w-5xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Settings size={22} className="text-violet-500" /> Settings
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
            Configure live UI preferences, connector readiness, and operator defaults.
          </p>
        </div>

        <div className="grid lg:grid-cols-[1.2fr_0.8fr] gap-6">
          <div className="space-y-6">
            <section className="p-5 rounded-3xl" style={{ background: 'var(--bg-2)', border: '1px solid var(--border)' }}>
              <div className="flex items-center gap-2 mb-4 text-sm font-semibold"><Palette size={16} className="text-violet-500" /> Appearance</div>
              <div className="grid sm:grid-cols-2 gap-3">
                {[
                  { id: 'dark', label: 'Dark mode', desc: 'Optimized for long-running operator sessions.' },
                  { id: 'light', label: 'Light mode', desc: 'Clean daytime workspace for review and planning.' },
                ].map((option) => (
                  <button
                    key={option.id}
                    onClick={() => setThemeMode(option.id as 'dark' | 'light')}
                    className="text-left p-4 rounded-2xl transition-all"
                    style={{
                      background: themeMode === option.id ? 'rgba(124,58,237,0.12)' : 'var(--bg-3)',
                      border: `1px solid ${themeMode === option.id ? 'rgba(124,58,237,0.24)' : 'var(--border)'}`,
                    }}
                  >
                    <div className="text-sm font-semibold mb-1">{option.label}</div>
                    <div className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{option.desc}</div>
                  </button>
                ))}
              </div>
            </section>

            <section className="p-5 rounded-3xl" style={{ background: 'var(--bg-2)', border: '1px solid var(--border)' }}>
              <div className="flex items-center gap-2 mb-4 text-sm font-semibold"><Bell size={16} className="text-violet-500" /> Experience</div>
              <div className="space-y-3">
                {[
                  {
                    label: 'Real-time notifications',
                    description: 'Show task completion and routing updates in the notification center.',
                    value: notificationsEnabled,
                    toggle: setNotificationsEnabled,
                  },
                  {
                    label: 'Live stream mode',
                    description: 'Prefer live event updates from WebSocket routes whenever available.',
                    value: streamMode,
                    toggle: setStreamMode,
                  },
                ].map((item) => (
                  <div key={item.label} className="flex items-center justify-between p-4 rounded-2xl" style={{ background: 'var(--bg-3)', border: '1px solid var(--border)' }}>
                    <div>
                      <div className="text-sm font-semibold">{item.label}</div>
                      <div className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>{item.description}</div>
                    </div>
                    <button
                      onClick={() => item.toggle(!item.value)}
                      className="w-12 h-7 rounded-full relative"
                      style={{ background: item.value ? '#7c3aed' : 'var(--surface-5)' }}
                    >
                      <span className="absolute top-1 left-1 w-5 h-5 rounded-full bg-white transition-all" style={{ transform: item.value ? 'translateX(20px)' : 'translateX(0)' }} />
                    </button>
                  </div>
                ))}
              </div>
            </section>

            <section className="p-5 rounded-3xl" style={{ background: 'var(--bg-2)', border: '1px solid var(--border)' }}>
              <div className="flex items-center gap-2 mb-4 text-sm font-semibold"><Shield size={16} className="text-violet-500" /> Secrets guidance</div>
              <div className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                Runtime connector tokens can be updated from the Connectors page for immediate use. For persistent deployments, the same values should also exist in your hosting platform secrets so they survive restarts.
              </div>
            </section>
          </div>

          <div className="space-y-6">
            <section className="p-5 rounded-3xl" style={{ background: 'var(--bg-2)', border: '1px solid var(--border)' }}>
              <div className="flex items-center gap-2 mb-4 text-sm font-semibold"><Cpu size={16} className="text-violet-500" /> Connector health</div>
              {loading ? (
                <div className="text-sm flex items-center gap-2" style={{ color: 'var(--text-secondary)' }}><Loader2 size={16} className="animate-spin" /> Loading backend status...</div>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-3 mb-4">
                    <div className="p-4 rounded-2xl" style={{ background: 'var(--bg-3)', border: '1px solid var(--border)' }}>
                      <div className="text-2xl font-bold text-green-500">{summary?.connected ?? connectedConnectors.length}</div>
                      <div className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>Connected</div>
                    </div>
                    <div className="p-4 rounded-2xl" style={{ background: 'var(--bg-3)', border: '1px solid var(--border)' }}>
                      <div className="text-2xl font-bold text-violet-500">{summary?.total ?? connectors.length}</div>
                      <div className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>Available</div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    {connectedConnectors.slice(0, 8).map((connector) => (
                      <div key={connector.id} className="p-3 rounded-2xl flex items-center justify-between" style={{ background: 'var(--bg-3)', border: '1px solid var(--border)' }}>
                        <div>
                          <div className="text-sm font-semibold">{connector.name}</div>
                          <div className="text-[11px] mt-1" style={{ color: 'var(--text-secondary)' }}>{connector.env_key}</div>
                        </div>
                        <CheckCircle2 size={16} className="text-green-500" />
                      </div>
                    ))}
                    {connectedConnectors.length === 0 && (
                      <div className="text-xs p-4 rounded-2xl text-center" style={{ background: 'var(--bg-3)', color: 'var(--text-secondary)' }}>
                        No runtime connectors are configured yet.
                      </div>
                    )}
                  </div>
                </>
              )}
            </section>
          </div>
        </div>
      </div>
    </div>
  )
}
