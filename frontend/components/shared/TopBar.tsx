'use client'

import { useEffect, useMemo, useState, useRef } from 'react'
import { Menu, Zap, Settings, Bell, Activity, Moon, Sun, Plug, X, CheckCircle, AlertTriangle, Info } from 'lucide-react'
import { useAppStore } from '@/store/useAppStore'
import { getHealth } from '@/lib/api'

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

export interface AppNotification {
  id: string
  title: string
  description: string
  timestamp: number
  type?: 'info' | 'success' | 'warning' | 'error'
  read?: boolean
}

const NOTIFICATION_KEY = 'god-agent-os-notifications'
const MAX_NOTIFICATIONS = 50

function loadPersistedNotifications(): AppNotification[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(NOTIFICATION_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function saveNotifications(notifications: AppNotification[]) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(NOTIFICATION_KEY, JSON.stringify(notifications.slice(0, MAX_NOTIFICATIONS)))
  } catch {}
}

function getNotifIcon(type?: string) {
  switch (type) {
    case 'success': return <CheckCircle size={13} className="text-green-400 flex-shrink-0" />
    case 'warning': return <AlertTriangle size={13} className="text-yellow-400 flex-shrink-0" />
    case 'error':   return <AlertTriangle size={13} className="text-red-400 flex-shrink-0" />
    default:        return <Info size={13} className="text-purple-400 flex-shrink-0" />
  }
}

function getNotifBg(type?: string) {
  switch (type) {
    case 'success': return 'rgba(34,197,94,0.07)'
    case 'warning': return 'rgba(245,158,11,0.07)'
    case 'error':   return 'rgba(239,68,68,0.07)'
    default:        return 'var(--bg-3)'
  }
}

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
  const [backendOnline, setBackendOnline] = useState<boolean | null>(null)
  const notifRef = useRef<HTMLDivElement>(null)

  // ── Load persisted notifications ──────────────────────────────────────────
  useEffect(() => {
    setNotifications(loadPersistedNotifications())
  }, [])

  // ── Listen for custom notification events ─────────────────────────────────
  useEffect(() => {
    const onNotification = (event: Event) => {
      const detail = (event as CustomEvent<AppNotification>).detail
      if (!detail) return
      setNotifications((prev) => {
        const next = [{ ...detail, read: false }, ...prev].slice(0, MAX_NOTIFICATIONS)
        saveNotifications(next)
        return next
      })
    }
    window.addEventListener('god-agent-notification', onNotification as EventListener)
    return () => window.removeEventListener('god-agent-notification', onNotification as EventListener)
  }, [])

  // ── Backend health check + real notifications from WebSocket ──────────────
  useEffect(() => {
    let ws: WebSocket | null = null
    let wsRetryTimeout: ReturnType<typeof setTimeout>

    async function checkHealth() {
      try {
        await getHealth()
        const wasOffline = backendOnline === false
        setBackendOnline(true)
        if (wasOffline) {
          pushNotification({
            id: `health_${Date.now()}`,
            title: 'Backend Online',
            description: 'GOD AGENT OS backend is now reachable.',
            type: 'success',
          })
        }
      } catch {
        if (backendOnline !== false) {
          setBackendOnline(false)
          pushNotification({
            id: `health_err_${Date.now()}`,
            title: 'Backend Offline',
            description: 'Cannot reach the backend. Running in demo mode.',
            type: 'warning',
          })
        }
      }
    }

    function connectWS() {
      try {
        const wsUrl = (process.env.NEXT_PUBLIC_WS_URL || 'wss://pyae1994-autonomous-coding-system.hf.space').replace(/\/$/, '')
        ws = new WebSocket(`${wsUrl}/ws/logs`)
        ws.onopen = () => {
          setBackendOnline(true)
        }
        ws.onmessage = (event) => {
          try {
            const msg = JSON.parse(event.data)
            if (msg.type === 'task_complete') {
              pushNotification({
                id: `task_${msg.task_id || Date.now()}`,
                title: 'Task Completed',
                description: msg.summary || `Task ${msg.task_id || ''} finished successfully.`,
                type: 'success',
              })
            } else if (msg.type === 'task_error') {
              pushNotification({
                id: `err_${Date.now()}`,
                title: 'Task Error',
                description: msg.error || 'A task encountered an error.',
                type: 'error',
              })
            } else if (msg.type === 'agent_status' && msg.data?.status === 'executing') {
              pushNotification({
                id: `agent_${Date.now()}`,
                title: `Agent Active: ${msg.data?.name || 'Unknown'}`,
                description: msg.data?.currentTask || 'Agent started a new task.',
                type: 'info',
              })
            }
          } catch {}
        }
        ws.onerror = () => setBackendOnline(false)
        ws.onclose = () => {
          wsRetryTimeout = setTimeout(connectWS, 10000)
        }
      } catch {}
    }

    checkHealth()
    connectWS()
    const healthInterval = setInterval(checkHealth, 30000)

    return () => {
      clearInterval(healthInterval)
      clearTimeout(wsRetryTimeout)
      ws?.close()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Click outside to close ─────────────────────────────────────────────────
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotificationsOpen(false)
      }
    }
    if (notificationsOpen) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [notificationsOpen])

  function pushNotification(n: AppNotification) {
    setNotifications((prev) => {
      // dedupe by id
      if (prev.find(p => p.id === n.id)) return prev
      const next = [{ ...n, read: false }, ...prev].slice(0, MAX_NOTIFICATIONS)
      saveNotifications(next)
      return next
    })
  }

  function markAllRead() {
    setNotifications(prev => {
      const next = prev.map(n => ({ ...n, read: true }))
      saveNotifications(next)
      return next
    })
  }

  function clearAll() {
    setNotifications([])
    if (typeof window !== 'undefined') window.localStorage.removeItem(NOTIFICATION_KEY)
  }

  const unreadCount = notifications.filter(n => !n.read).length

  const activeSpaces = Object.values(spaces).filter((s) => s.active)
  const activeSpaceColor = activeSpace ? SPACE_COLORS[activeSpace] : '#64748b'

  const statusLabel = useMemo(() => {
    if (!activeSpace) return '8 Spaces ready'
    return `${activeSpace.toUpperCase()} SPACE · ${currentRole.replace('_', ' ').toUpperCase()}`
  }, [activeSpace, currentRole])

  return (
    <header
      className="h-14 flex items-center justify-between px-3 md:px-4 border-b shrink-0 relative z-20"
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
        {/* Backend status indicator */}
        <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl"
          style={{ background: 'var(--bg-3)', border: '1px solid var(--border)' }}>
          <Activity size={12} className={backendOnline ? 'text-green-500' : backendOnline === false ? 'text-red-400' : 'text-yellow-400 animate-pulse'} />
          <span className={`text-xs font-medium ${backendOnline ? 'text-green-600 dark:text-green-400' : backendOnline === false ? 'text-red-400' : 'text-yellow-400'}`}>
            {backendOnline === null ? 'Checking…' : backendOnline ? 'System online' : 'Backend offline'}
          </span>
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

        {/* Notifications */}
        <div className="relative" ref={notifRef}>
          <button
            onClick={() => {
              setNotificationsOpen((v) => !v)
              if (!notificationsOpen) markAllRead()
            }}
            className="p-2 rounded-xl transition-colors hover:bg-black/5 relative"
            title="Notifications"
          >
            <Bell size={16} style={{ color: 'var(--text-secondary)' }} />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full text-[10px] font-bold text-white bg-violet-600 flex items-center justify-center">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {notificationsOpen && (
            <div
              className="absolute right-0 mt-2 w-[340px] max-w-[92vw] rounded-2xl shadow-2xl z-50"
              style={{ background: 'var(--bg-2)', border: '1px solid var(--border)' }}
            >
              {/* Header */}
              <div className="flex items-center justify-between p-4 pb-3 border-b" style={{ borderColor: 'var(--border)' }}>
                <div>
                  <div className="text-sm font-bold">Notifications</div>
                  <div className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>
                    Real-time system activity
                    {backendOnline !== null && (
                      <span className={`ml-2 ${backendOnline ? 'text-green-400' : 'text-red-400'}`}>
                        · {backendOnline ? '● Live' : '○ Offline'}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {notifications.length > 0 && (
                    <button
                      onClick={clearAll}
                      className="text-[11px] font-medium hover:opacity-80"
                      style={{ color: 'var(--purple-bright, #7c3aed)' }}
                    >
                      Clear all
                    </button>
                  )}
                  <button onClick={() => setNotificationsOpen(false)} className="p-1 rounded-lg hover:bg-white/5">
                    <X size={13} style={{ color: 'var(--text-secondary)' }} />
                  </button>
                </div>
              </div>

              {/* List */}
              <div className="max-h-80 overflow-y-auto p-2 space-y-1.5">
                {notifications.length === 0 ? (
                  <div className="text-xs p-6 rounded-xl text-center" style={{ background: 'var(--bg-3)', color: 'var(--text-secondary)' }}>
                    <Bell size={18} className="mx-auto mb-2 opacity-30" />
                    No notifications yet.
                    <br />
                    <span className="opacity-60 text-[10px]">Events from agents, tasks, and n8n will appear here.</span>
                  </div>
                ) : notifications.map((item) => (
                  <div
                    key={item.id}
                    className="p-3 rounded-xl flex items-start gap-2.5 transition-all"
                    style={{ background: item.read ? 'var(--bg-3)' : getNotifBg(item.type), border: '1px solid var(--border)' }}
                  >
                    {getNotifIcon(item.type)}
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-semibold leading-tight">{item.title}</div>
                      <div className="text-[11px] leading-relaxed mt-0.5 opacity-75 line-clamp-2">{item.description}</div>
                      <div className="text-[10px] mt-1 opacity-40">
                        {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        {' · '}
                        {new Date(item.timestamp).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Footer */}
              {notifications.length > 0 && (
                <div className="p-2 border-t text-center" style={{ borderColor: 'var(--border)' }}>
                  <span className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>
                    {notifications.length} notification{notifications.length !== 1 ? 's' : ''}
                    {unreadCount > 0 && <span className="text-purple-400 ml-1">· {unreadCount} new</span>}
                  </span>
                </div>
              )}
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
