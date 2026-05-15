'use client'

import { motion } from 'framer-motion'
import { useAppStore } from '@/store/useAppStore'
const useGodMode = () => ({ godModeActive: true })

export default function GodModeCard() {
  const godModeActive = true // v9 always active

  return (
    <div className="relative overflow-hidden rounded-2xl p-5"
      style={{ background: 'linear-gradient(135deg, rgba(124,58,237,0.15) 0%, rgba(59,130,246,0.1) 50%, rgba(20,24,40,0.8) 100%)', border: '1px solid rgba(124,58,237,0.25)' }}>

      {/* Cosmic Orb */}
      <div className="flex justify-center mb-4">
        <div className="cosmic-orb" style={{ width: 80, height: 80 }} />
      </div>

      {/* Status */}
      <div className="text-center">
        <div className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: 'var(--text-secondary)' }}>GOD MODE</div>
        <div className={`text-xl font-black tracking-wide mb-2 ${godModeActive ? 'gradient-text' : 'text-slate-500'}`}>
          {godModeActive ? 'ACTIVE' : 'STANDBY'}
        </div>
        <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
          {godModeActive ? 'All systems operational. You are the Architect.' : 'Enable God Mode for full autonomy.'}
        </p>
      </div>

      {/* Glow overlay */}
      {godModeActive && (
        <motion.div
          className="absolute inset-0 pointer-events-none rounded-2xl"
          animate={{ opacity: [0.3, 0.6, 0.3] }}
          transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
          style={{ background: 'radial-gradient(ellipse at 50% 0%, rgba(124,58,237,0.15) 0%, transparent 70%)' }}
        />
      )}

      {/* Status dot */}
      <div className="absolute top-3 right-3 flex items-center gap-1.5">
        <div className={`w-2 h-2 rounded-full ${godModeActive ? 'bg-green-400 animate-pulse-glow' : 'bg-slate-600'}`} />
        <span className="text-xs font-medium" style={{ color: godModeActive ? '#4ade80' : 'var(--text-muted)' }}>
          {godModeActive ? 'Live' : 'Off'}
        </span>
      </div>
    </div>
  )
}
