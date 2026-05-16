'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { RefreshCw, ExternalLink, CheckCircle, XCircle, Loader, Zap } from 'lucide-react'
import { getSpaces } from '@/lib/api'
import { useAppStore } from '@/store/useAppStore'

interface SpaceInfo {
  id: string
  name: string
  role: string
  agent: string | null
  icon: string
  status: 'active' | 'inactive'
  online: boolean
  backend: string
  tasks_completed: number
}

const ROLE_COLORS: Record<string, string> = {
  orchestration: '#a78bfa',
  code_generation: '#34d399',
  execution: '#f59e0b',
  files: '#60a5fa',
  research: '#22d3ee',
  ui_gen: '#f472b6',
  ui: '#f472b6',
  debugging: '#ef4444',
  testing: '#84cc16',
  qa: '#4ade80',
  git: '#fb923c',
  deployment: '#a855f7',
  integration: '#06b6d4',
  memory: '#818cf8',
  knowledge: '#6366f1',
  automation: '#c084fc',
  events: '#94a3b8',
  ai_routing: '#22d3ee',
  monitoring: '#4ade80',
  sessions: '#fbbf24',
  auth: '#f87171',
}

export default function SpacesPage() {
  const { locale } = useAppStore()
  const [spaces, setSpaces] = useState<SpaceInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [backendUrl, setBackendUrl] = useState('')

  const load = async () => {
    setLoading(true)
    try {
      const data = await getSpaces()
      setSpaces(data.spaces || [])
      setBackendUrl(data.backend_url || '')
    } catch (e) {
      // Show placeholder spaces if backend is offline
      setSpaces([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const active = spaces.filter(s => s.status === 'active').length

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <Zap size={20} style={{ color: 'var(--accent-bright)' }} />
            {locale === 'my' ? '22 Worker Spaces' : '22 Worker Spaces'}
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
            {locale === 'my'
              ? `${active}/22 space လုပ်ဆောင်နေသည် · Backend: ${backendUrl || 'N/A'}`
              : `${active}/22 spaces active · All running inside main backend`}
          </p>
        </div>
        <button onClick={load} className="btn btn-secondary text-xs" disabled={loading}>
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
          {locale === 'my' ? 'ပြန်စစ်' : 'Refresh'}
        </button>
      </div>

      {/* Architecture Note */}
      <div className="mb-4 p-4 rounded-xl"
        style={{ background: 'rgba(124,58,237,0.06)', border: '1px solid rgba(124,58,237,0.15)' }}>
        <div className="flex items-start gap-3">
          <div className="text-xl mt-0.5">ℹ️</div>
          <div>
            <div className="text-sm font-semibold text-white mb-1">
              {locale === 'my' ? 'Architecture မှတ်ချက်' : 'Architecture Note'}
            </div>
            <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
              {locale === 'my'
                ? 'Hugging Face ရှိ 22 static spaces များသည် placeholder HTML သာဖြစ်သည်။ စစ်မှန်သော 22 agent spaces အားလုံးသည် main backend (autonomous-coding-system space) အတွင်းတွင် run နေသည်။ Architecture plan မှာ ဆက်လက်ချဲ့ထွင်ရန်ဖြစ်သည်။'
                : '22 HuggingFace "spaces" were placeholder HTML pages. All 22 real agent spaces now run inside the main backend (autonomous-coding-system). The distributed HF architecture is the future roadmap.'}
            </p>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40 gap-3">
          <Loader size={18} style={{ color: 'var(--accent)', animation: 'spin 1s linear infinite' }} />
          <span className="text-sm" style={{ color: 'var(--text-muted)' }}>
            {locale === 'my' ? 'Space status စစ်ဆေးနေသည်...' : 'Checking space status...'}
          </span>
        </div>
      ) : spaces.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-40 gap-2">
          <XCircle size={24} style={{ color: '#f87171' }} />
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            {locale === 'my' ? 'Backend ချိတ်ဆက်မရသောကြောင့် space status ရယူ၍မရပါ' : 'Cannot reach backend to get space status'}
          </p>
          <button onClick={load} className="btn btn-secondary text-xs">Retry</button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {spaces.map((space, i) => {
            const color = ROLE_COLORS[space.role] || '#7c3aed'
            return (
              <motion.div
                key={space.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
                className="card p-4 relative overflow-hidden"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl"
                    style={{ background: `${color}12`, border: `1px solid ${color}20` }}>
                    {space.icon}
                  </div>
                  <div className="flex items-center gap-1">
                    {space.online ? (
                      <CheckCircle size={13} style={{ color: '#22c55e' }} />
                    ) : (
                      <XCircle size={13} style={{ color: '#ef4444' }} />
                    )}
                  </div>
                </div>
                <div className="text-xs font-bold text-white mb-1">{space.name}</div>
                <div className="text-[10px] px-1.5 py-0.5 rounded-full inline-block mb-2"
                  style={{ background: `${color}12`, color, border: `1px solid ${color}20` }}>
                  {space.role.replace(/_/g, ' ')}
                </div>
                {space.agent && (
                  <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                    Agent: {space.agent}
                  </div>
                )}
                <div className="text-[10px] mt-1" style={{ color: 'var(--text-muted)' }}>
                  {space.status === 'active' ? (
                    <span style={{ color: '#4ade80' }}>● Active in backend</span>
                  ) : (
                    <span style={{ color: '#94a3b8' }}>◦ System space</span>
                  )}
                </div>
              </motion.div>
            )
          })}
        </div>
      )}
    </div>
  )
}
