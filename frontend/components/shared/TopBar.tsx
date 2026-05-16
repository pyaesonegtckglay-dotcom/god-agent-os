'use client'

import { useEffect, useMemo, useState } from 'react'
import { Menu, Zap, Settings, Bell, Activity, Moon, Sun, Plug } from 'lucide-react'
import { useAppStore } from '@/store/useAppStore'

const SPACE_COLORS: Record<string, string> = {
  core: '#7c3aed',
  browser: '#2563eb',
  sandbox: '#059669',
  coding: '#d97706',
  vision: '#db2777',
  debug: '#dc2626',
  deploy: '#0891b2',
  communication: '#7c3aed',
}

interface AppNotification {
  id: string
  title: string
  description: string
  timestamp: number
}

const NOTIFICATION_KEY = 'god-agent-os-notifications'

export default function TopBar() {
  const {
    sidebarOpen,
    setSidebarOpen,
    activeSpace,
    currentRole,
    spaces,
    setCurrentPage,
    themeMode,
    setThemeMode,
  } = useAppStore()

  const [notifications, setNotifications] = useState<AppNotification[]>([])
  const [notificationsOpen, setNotificationsOpen] = useState(false)

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(NOTIFICATION_KEY)
      setNotifications(raw ? JSON.parse(raw) : [])
    } catch {}

    const onNotification = (event: Event) => {
      const detail = (event as CustomEvent<AppNotification>).detail
      if (!detail) return
      setNotifications((prev) => {
        const next = [detail, ...prev].slice(0, 25)
        window.localStorage.setItem(NOTIFICATION_KEY, JSON.stringify(next))
        return next
      })
    }

    window.addEventListener('god-agent-notification', onNotification as EventListener)
    return () => window.removeEventListener('god-agent-notification', onNotification as EventListener)
  }, [])

  const activeSpaces = Object.values(spaces).filter((s) => s.active)
  const activeSpaceColor = activeSpace ? SPACE_COLORS[activeSpace] : '#64748b'
  const unreadCount = notifications.length

  const statusLabel = useMemo(() => {
    if (!activeSpace) return '8 Spaces ready'
    return `${activeSpace.toUpperCase()} SPACE · ${currentRole.replace('_', ' ').toUpperCase()}`
  }, [activeSpace, currentRole])

  return (
    <header
      className="h-14 flex items-center justify-between px-3 md:px-4 border-b shrink-0 relative"
      style={{ background: 'var(--bg-2)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
    >
      <div className="flex items-center gap-3 min-w-0">
        <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-2 rounded-xl transition-colors hover:bg-black/5">
          <Menu size={16} style={{ color: 'var(--text-secondary)' }} />
        </button>

        <div className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center shadow-lg">
            <Zap size={16} className="text-white" />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-bold truncate">GOD AGENT OS</div>
            <div className="text-[10px] font-medium" style={{ color: 'var(--text-secondary)' }}>
              v9.0.1 · Manus-like workspace
            </div>
          </div>
        </div>
      </div>

      <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-full"
        style={{ background: activeSpace ? `${activeSpaceColor}16` : 'var(--bg-3)', border: `1px solid ${activeSpace ? `${activeSpaceColor}55` : 'var(--border)'}` }}>
        <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: activeSpaceColor }} />
        <span className="text-xs font-semibold" style={{ color: activeSpace ? activeSpaceColor : 'var(--text-secondary)' }}>
          {statusLabel}
        </span>
        {activeSpaces.length > 0 && (
          <div className="flex gap-1 ml-1">
            {activeSpaces.slice(0, 4).map((space) => (
              <div key={space.name} className="w-1.5 h-1.5 rounded-full" style={{ background: SPACE_COLORS[space.name] }} />
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center gap-1 md:gap-2">
        <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl"
          style={{ background: 'var(--bg-3)', border: '1px solid var(--border)' }}>
          <Activity size={12} className="text-green-500" />
          <span className="text-xs font-medium text-green-600 dark:text-green-400">System online</span>
        </div>

        <button
          onClick={() => setThemeMode(themeMode === 'dark' ? 'light' : 'dark')}
          className="p-2 rounded-xl transition-colors hover:bg-black/5"
          title={themeMode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {themeMode === 'dark' ? (
            <Sun size={16} style={{ color: 'var(--text-secondary)' }} />
          ) : (
            <Moon size={16} style={{ color: 'var(--text-secondary)' }} />
          )}
        </button>

        <button onClick={() => setCurrentPage('connectors')} className="p-2 rounded-xl transition-colors hover:bg-black/5" title="Connectors">
          <Plug size={16} style={{ color: 'var(--text-secondary)' }} />
        </button>

        <div className="relative">
          <button onClick={() => setNotificationsOpen((v) => !v)} className="p-2 rounded-xl transition-colors hover:bg-black/5 relative" title="Notifications">
            <Bell size={16} style={{ color: 'var(--text-secondary)' }} />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full text-[10px] font-bold text-white bg-violet-600 flex items-center justify-center">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {notificationsOpen && (
            <div
              className="absolute right-0 mt-2 w-[320px] max-w-[90vw] rounded-2xl p-3 shadow-2xl z-30"
              style={{ background: 'var(--bg-2)', border: '1px solid var(--border)' }}
            >
              <div className="flex items-center justify-between mb-3">
                <div>
                  <div className="text-sm font-bold">Notifications</div>
                  <div className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>Real-time system activity</div>
                </div>
                <button
                  onClick={() => {
                    window.localStorage.removeItem(NOTIFICATION_KEY)
                    setNotifications([])
                  }}
                  className="text-[11px] font-medium"
                  style={{ color: 'var(--purple-bright)' }}
                >
                  Clear
                </button>
              </div>

              <div className="max-h-80 overflow-y-auto space-y-2">
                {notifications.length === 0 ? (
                  <div className="text-xs p-4 rounded-xl text-center" style={{ background: 'var(--bg-3)', color: 'var(--text-secondary)' }}>
                    No notifications yet.
                  </div>
                ) : notifications.map((item) => (
                  <div key={item.id} className="p-3 rounded-xl" style={{ background: 'var(--bg-3)', border: '1px solid var(--border)' }}>
                    <div className="text-xs font-semibold mb-1">{item.title}</div>
                    <div className="text-[11px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{item.description}</div>
                    <div className="text-[10px] mt-2" style={{ color: 'var(--text-muted)' }}>
                      {new Date(item.timestamp).toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <button onClick={() => setCurrentPage('settings')} className="p-2 rounded-xl transition-colors hover:bg-black/5" title="Settings">
          <Settings size={16} style={{ color: 'var(--text-secondary)' }} />
        </button>
      </div>
    </header>
  )
}
