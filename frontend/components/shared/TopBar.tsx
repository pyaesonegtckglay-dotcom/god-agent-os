'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import {
  Menu, Zap, Settings, Bell, Activity, Globe,
  ChevronDown, Cpu, MonitorPlay, CheckCircle2, AlertCircle,
  Info, Trash2, X, RefreshCw, BrainCircuit
} from 'lucide-react'
import { useAppStore, type Theme, type Locale } from '@/store/useAppStore'
import { fetchAPI } from '@/lib/api'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Notification {
  id: string
  type: 'success' | 'warning' | 'info' | 'error'
  title: string
  body: string
  time: number
  read: boolean
}

// ─── Constants ────────────────────────────────────────────────────────────────

const THEMES: { id: Theme; label: string; en: string; my: string; icon: string }[] = [
  { id: 'dark',   label: 'Dark',   en: 'Dark',   my: 'မှောင်',  icon: '🌑' },
  { id: 'amoled', label: 'AMOLED', en: 'AMOLED', my: 'AMOLED',  icon: '⬛' },
  { id: 'neon',   label: 'Neon',   en: 'Neon',   my: 'Neon',    icon: '💜' },
  { id: 'glass',  label: 'Glass',  en: 'Glass',  my: 'ဖန်ထည်', icon: '🔮' },
]

const LOCALES: { id: Locale; flag: string; label: string }[] = [
  { id: 'en', flag: '🇬🇧', label: 'English' },
  { id: 'my', flag: '🇲🇲', label: 'မြန်မာ' },
]

const NOTIF_ICONS = {
  success: { icon: CheckCircle2, color: '#22c55e' },
  warning: { icon: AlertCircle,  color: '#f59e0b' },
  error:   { icon: AlertCircle,  color: '#ef4444' },
  info:    { icon: Info,          color: '#60a5fa' },
}

const STORAGE_KEY = 'god_agent_notifications_v11'

function loadNotifications(): Notification[] {
  if (typeof window === 'undefined') return []
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') } catch { return [] }
}

function saveNotifications(n: Notification[]) {
  if (typeof window === 'undefined') return
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(n.slice(0, 50))) } catch {}
}

// ─── Notification Panel ───────────────────────────────────────────────────────

function NotificationPanel({
  notifications,
  onRead,
  onClear,
  onClose,
  locale,
}: {
  notifications: Notification[]
  onRead: (id: string) => void
  onClear: () => void
  onClose: () => void
  locale: Locale
}) {
  const unread = notifications.filter(n => !n.read).length

  return (
    <div
      className="absolute right-0 top-full mt-2 w-80 rounded-2xl shadow-2xl z-[100] overflow-hidden animate-fade-in"
      style={{ background: 'var(--surface-3)', border: '1px solid var(--border)' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3"
        style={{ borderBottom: '1px solid var(--border)' }}>
        <div className="flex items-center gap-2">
          <Bell size={14} style={{ color: 'var(--accent-bright)' }} />
          <span className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
            {locale === 'my' ? 'အကြောင်းကြားချက်' : 'Notifications'}
          </span>
          {unread > 0 && (
            <span className="text-[9px] px-1.5 py-0.5 rounded-full font-bold"
              style={{ background: 'rgba(239,68,68,0.2)', color: '#f87171' }}>
              {unread}
            </span>
          )}
        </div>
        <div className="flex gap-1">
          <button onClick={onClear}
            className="text-[10px] px-2 py-1 rounded hover:bg-white/5 transition-colors"
            style={{ color: 'var(--text-muted)' }}>
            {locale === 'my' ? 'အားလုံးဖျက်' : 'Clear all'}
          </button>
          <button onClick={onClose} className="p-1 rounded hover:bg-white/5 transition-colors"
            style={{ color: 'var(--text-muted)' }}>
            <X size={12} />
          </button>
        </div>
      </div>

      {/* List */}
      <div className="max-h-80 overflow-y-auto">
        {notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 gap-2">
            <Bell size={20} style={{ color: 'rgba(124,58,237,0.3)' }} />
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              {locale === 'my' ? 'အကြောင်းကြားချက်မရှိသေးပါ' : 'No notifications yet'}
            </p>
          </div>
        ) : (
          notifications.map(n => {
            const { icon: Icon, color } = NOTIF_ICONS[n.type] || NOTIF_ICONS.info
            return (
              <div
                key={n.id}
                onClick={() => onRead(n.id)}
                className="flex items-start gap-3 px-4 py-3 cursor-pointer hover:bg-white/3 transition-colors"
                style={{
                  borderBottom: '1px solid rgba(255,255,255,0.04)',
                  background: n.read ? 'transparent' : 'rgba(124,58,237,0.04)',
                }}
              >
                <div className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                  style={{ background: `${color}15` }}>
                  <Icon size={12} style={{ color }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>
                      {n.title}
                    </span>
                    {!n.read && (
                      <span className="w-1.5 h-1.5 rounded-full shrink-0"
                        style={{ background: 'var(--accent)' }} />
                    )}
                  </div>
                  <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                    {n.body}
                  </p>
                  <span className="text-[10px] mt-1 block" style={{ color: 'var(--text-muted)' }}>
                    {new Date(n.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}

// ─── TopBar ───────────────────────────────────────────────────────────────────

export default function TopBar() {
  const {
    sidebarOpen, setSidebarOpen,
    theme, setTheme,
    locale, setLocale,
    setCurrentPage, currentPage,
    isComputerUseOpen, setComputerUseOpen,
  } = useAppStore()

  const [themeOpen, setThemeOpen] = useState(false)
  const [langOpen, setLangOpen] = useState(false)
  const [notifOpen, setNotifOpen] = useState(false)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [backendOnline, setBackendOnline] = useState(false)

  const themeRef = useRef<HTMLDivElement>(null)
  const langRef = useRef<HTMLDivElement>(null)
  const notifRef = useRef<HTMLDivElement>(null)

  // Load notifications from storage
  useEffect(() => {
    setNotifications(loadNotifications())
  }, [])

  // Add a notification helper
  const addNotification = useCallback((
    type: Notification['type'],
    title: string,
    body: string
  ) => {
    const n: Notification = {
      id: Math.random().toString(36).slice(2, 10),
      type, title, body,
      time: Date.now(),
      read: false,
    }
    setNotifications(prev => {
      const next = [n, ...prev].slice(0, 50)
      saveNotifications(next)
      return next
    })
  }, [])

  // Check backend on mount and periodically
  useEffect(() => {
    const check = async () => {
      try {
        await fetchAPI('/health')
        if (!backendOnline) {
          setBackendOnline(true)
          addNotification('success', 'Backend Connected', 'God Agent OS backend is online and ready.')
        }
      } catch {
        if (backendOnline) {
          setBackendOnline(false)
          addNotification('warning', 'Backend Offline', 'Cannot reach the HF Space backend. Check your connection.')
        }
      }
    }
    check()
    const interval = setInterval(check, 60000) // check every minute
    return () => clearInterval(interval)
  }, [backendOnline, addNotification])

  // Expose addNotification globally so chat page can call it
  useEffect(() => {
    if (typeof window !== 'undefined') {
      // @ts-ignore
      window.__godAgentAddNotification = addNotification
    }
  }, [addNotification])

  // Close dropdowns on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (themeRef.current && !themeRef.current.contains(e.target as Node)) setThemeOpen(false)
      if (langRef.current && !langRef.current.contains(e.target as Node)) setLangOpen(false)
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setNotifOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const currentTheme = THEMES.find(t => t.id === theme) || THEMES[0]
  const currentLocale = LOCALES.find(l => l.id === locale) || LOCALES[0]
  const unreadCount = notifications.filter(n => !n.read).length

  const handleMarkRead = (id: string) => {
    setNotifications(prev => {
      const next = prev.map(n => n.id === id ? { ...n, read: true } : n)
      saveNotifications(next)
      return next
    })
  }

  const handleClearAll = () => {
    setNotifications([])
    saveNotifications([])
  }

  return (
    <header
      className="h-12 flex items-center justify-between px-3 shrink-0 z-50"
      style={{ background: 'var(--surface-1)', borderBottom: '1px solid var(--border)' }}
    >
      {/* Left */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="p-1.5 rounded-lg hover:bg-white/5 transition-colors"
          title="Toggle Sidebar"
        >
          <Menu size={16} style={{ color: 'var(--text-secondary)' }} />
        </button>

        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center shadow-lg"
            style={{ background: 'linear-gradient(135deg, var(--accent), #4f46e5)' }}>
            <Zap size={14} className="text-white" />
          </div>
          <div className="hidden sm:block">
            <span className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
              GOD AGENT OS
            </span>
            <span
              className="text-[10px] ml-1.5 px-1.5 py-0.5 rounded-full font-semibold"
              style={{ background: 'rgba(124,58,237,0.15)', border: '1px solid rgba(124,58,237,0.3)', color: '#c4b5fd' }}
            >
              v11 · God Mode
            </span>
          </div>
        </div>
      </div>

      {/* Center - Status */}
      <div className="hidden md:flex items-center gap-3">
        <div
          className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium"
          style={{
            background: backendOnline ? 'rgba(34,197,94,0.1)' : 'rgba(245,158,11,0.1)',
            border: `1px solid ${backendOnline ? 'rgba(34,197,94,0.2)' : 'rgba(245,158,11,0.2)'}`,
            color: backendOnline ? '#4ade80' : '#fbbf24',
          }}
        >
          <div className="w-1.5 h-1.5 rounded-full"
            style={{ background: backendOnline ? '#4ade80' : '#fbbf24', animation: 'pulse 2s infinite' }} />
          <Activity size={10} />
          <span>{backendOnline ? 'Backend Online' : 'Backend Connecting...'}</span>
        </div>

        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs"
          style={{ background: 'rgba(124,58,237,0.1)', border: '1px solid rgba(124,58,237,0.2)', color: '#a78bfa' }}>
          <Cpu size={10} />
          <span>16 Agents · 22 Spaces</span>
        </div>
      </div>

      {/* Right - Controls */}
      <div className="flex items-center gap-1">

        {/* Computer Use Toggle */}
        <button
          onClick={() => setComputerUseOpen(!isComputerUseOpen)}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all"
          style={{
            background: isComputerUseOpen ? 'rgba(124,58,237,0.15)' : 'transparent',
            color: isComputerUseOpen ? '#a78bfa' : 'var(--text-muted)',
            border: isComputerUseOpen ? '1px solid rgba(124,58,237,0.25)' : '1px solid transparent',
          }}
          title="Computer Use View"
        >
          <MonitorPlay size={14} />
          <span className="hidden sm:inline">Computer Use</span>
        </button>

        {/* Language Toggle */}
        <div className="relative" ref={langRef}>
          <button
            onClick={() => { setLangOpen(!langOpen); setThemeOpen(false); setNotifOpen(false) }}
            className="flex items-center gap-1 px-2 py-1.5 rounded-lg hover:bg-white/5 transition-colors text-xs"
            style={{ color: 'var(--text-secondary)' }}
          >
            <Globe size={13} />
            <span className="hidden sm:inline">{currentLocale.flag}</span>
            <ChevronDown size={10} />
          </button>
          {langOpen && (
            <div
              className="absolute right-0 top-full mt-1 py-1 rounded-xl shadow-xl z-50 min-w-[130px] animate-fade-in"
              style={{ background: 'var(--surface-3)', border: '1px solid var(--border)' }}
            >
              {LOCALES.map(l => (
                <button
                  key={l.id}
                  onClick={() => { setLocale(l.id); setLangOpen(false) }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-xs hover:bg-white/5 transition-colors"
                  style={{ color: locale === l.id ? 'var(--accent-bright)' : 'var(--text-secondary)' }}
                >
                  <span>{l.flag}</span>
                  <span>{l.label}</span>
                  {locale === l.id && <span className="ml-auto text-[10px]">✓</span>}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Theme Toggle */}
        <div className="relative" ref={themeRef}>
          <button
            onClick={() => { setThemeOpen(!themeOpen); setLangOpen(false); setNotifOpen(false) }}
            className="flex items-center gap-1 px-2 py-1.5 rounded-lg hover:bg-white/5 transition-colors text-xs"
            style={{ color: 'var(--text-secondary)' }}
          >
            <span>{currentTheme.icon}</span>
            <ChevronDown size={10} />
          </button>
          {themeOpen && (
            <div
              className="absolute right-0 top-full mt-1 py-1 rounded-xl shadow-xl z-50 min-w-[140px] animate-fade-in"
              style={{ background: 'var(--surface-3)', border: '1px solid var(--border)' }}
            >
              <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider"
                style={{ color: 'var(--text-muted)' }}>
                {locale === 'my' ? 'အပြင်အဆင်' : 'Theme'}
              </div>
              {THEMES.map(t => (
                <button
                  key={t.id}
                  onClick={() => { setTheme(t.id); setThemeOpen(false) }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-xs hover:bg-white/5 transition-colors"
                  style={{ color: theme === t.id ? 'var(--accent-bright)' : 'var(--text-secondary)' }}
                >
                  <span>{t.icon}</span>
                  <span>{locale === 'my' ? t.my : t.en}</span>
                  {theme === t.id && <span className="ml-auto text-[10px]">✓</span>}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Notifications */}
        <div className="relative" ref={notifRef}>
          <button
            onClick={() => { setNotifOpen(!notifOpen); setThemeOpen(false); setLangOpen(false) }}
            className="relative p-1.5 rounded-lg hover:bg-white/5 transition-colors"
            style={{ color: notifOpen ? 'var(--accent-bright)' : 'var(--text-muted)' }}
            title={locale === 'my' ? 'အကြောင်းကြားချက်' : 'Notifications'}
          >
            <Bell size={15} />
            {unreadCount > 0 && (
              <span
                className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full text-[9px] font-bold flex items-center justify-center"
                style={{ background: '#ef4444', color: 'white' }}
              >
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {notifOpen && (
            <NotificationPanel
              notifications={notifications}
              onRead={handleMarkRead}
              onClear={handleClearAll}
              onClose={() => setNotifOpen(false)}
              locale={locale}
            />
          )}
        </div>

        {/* Settings */}
        <button
          onClick={() => setCurrentPage('settings')}
          className="p-1.5 rounded-lg hover:bg-white/5 transition-colors"
          style={{
            color: currentPage === 'settings' ? 'var(--accent-bright)' : 'var(--text-muted)',
            background: currentPage === 'settings' ? 'rgba(124,58,237,0.1)' : 'transparent',
          }}
          title="Settings"
        >
          <Settings size={15} />
        </button>
      </div>
    </header>
  )
}
