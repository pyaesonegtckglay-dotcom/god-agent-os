'use client'

import { useState, useRef, useEffect } from 'react'
import { Menu, Zap, Settings, Bell, Activity, Sun, Moon, Globe, ChevronDown, Cpu, MonitorPlay } from 'lucide-react'
import { useAppStore, type Theme, type Locale } from '@/store/useAppStore'

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
  const themeRef = useRef<HTMLDivElement>(null)
  const langRef = useRef<HTMLDivElement>(null)

  // Close dropdowns on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (themeRef.current && !themeRef.current.contains(e.target as Node)) setThemeOpen(false)
      if (langRef.current && !langRef.current.contains(e.target as Node)) setLangOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const currentTheme = THEMES.find(t => t.id === theme) || THEMES[0]
  const currentLocale = LOCALES.find(l => l.id === locale) || LOCALES[0]

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
              {locale === 'my' ? 'GOD AGENT OS' : 'GOD AGENT OS'}
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
          style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.2)', color: '#4ade80' }}
        >
          <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
          <Activity size={10} />
          <span>{locale === 'my' ? 'Backend Online' : 'Backend Online'}</span>
        </div>

        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs"
          style={{ background: 'rgba(124,58,237,0.1)', border: '1px solid rgba(124,58,237,0.2)', color: '#a78bfa' }}>
          <Cpu size={10} />
          <span>16 Agents · 22 Spaces</span>
        </div>
      </div>

      {/* Right - Controls */}
      <div className="flex items-center gap-1">

        {/* Computer Use Toggle (Manus-style) */}
        <button
          onClick={() => setComputerUseOpen(!isComputerUseOpen)}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all"
          style={{
            background: isComputerUseOpen ? 'rgba(124,58,237,0.15)' : 'transparent',
            color: isComputerUseOpen ? '#a78bfa' : 'var(--text-muted)',
            border: isComputerUseOpen ? '1px solid rgba(124,58,237,0.25)' : '1px solid transparent',
          }}
          title={locale === 'my' ? 'Computer ကြည့်ရန်' : 'Computer Use View'}
        >
          <MonitorPlay size={14} />
          <span className="hidden sm:inline">
            {locale === 'my' ? 'Computer' : 'Computer Use'}
          </span>
        </button>

        {/* Language Toggle */}
        <div className="relative" ref={langRef}>
          <button
            onClick={() => { setLangOpen(!langOpen); setThemeOpen(false) }}
            className="flex items-center gap-1 px-2 py-1.5 rounded-lg hover:bg-white/5 transition-colors text-xs"
            style={{ color: 'var(--text-secondary)' }}
            title="Language"
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
            onClick={() => { setThemeOpen(!themeOpen); setLangOpen(false) }}
            className="flex items-center gap-1 px-2 py-1.5 rounded-lg hover:bg-white/5 transition-colors text-xs"
            style={{ color: 'var(--text-secondary)' }}
            title="Theme"
          >
            <span>{currentTheme.icon}</span>
            <ChevronDown size={10} />
          </button>
          {themeOpen && (
            <div
              className="absolute right-0 top-full mt-1 py-1 rounded-xl shadow-xl z-50 min-w-[140px] animate-fade-in"
              style={{ background: 'var(--surface-3)', border: '1px solid var(--border)' }}
            >
              <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
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
        <button
          className="p-1.5 rounded-lg hover:bg-white/5 transition-colors"
          style={{ color: 'var(--text-muted)' }}
          title="Notifications"
        >
          <Bell size={15} />
        </button>

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
