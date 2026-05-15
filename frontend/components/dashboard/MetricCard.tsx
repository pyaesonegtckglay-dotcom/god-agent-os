'use client'

import { motion } from 'framer-motion'
import { TrendingUp, TrendingDown } from 'lucide-react'
import { cn } from '@/lib/utils'

interface MetricCardProps {
  label: string
  value: string | number
  unit?: string
  trend?: string
  trendUp?: boolean
  icon: React.ReactNode
  iconColor: string
  delay?: number
}

export default function MetricCard({ label, value, unit, trend, trendUp = true, icon, iconColor, delay = 0 }: MetricCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay, ease: [0.4, 0, 0.2, 1] }}
      className="card p-5 group cursor-default"
    >
      <div className="flex items-start justify-between mb-4">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110"
          style={{ background: `${iconColor}15`, border: `1px solid ${iconColor}25` }}>
          <div style={{ color: iconColor }}>{icon}</div>
        </div>
        {trend && (
          <div className={cn('flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full',
            trendUp ? 'text-green-400 bg-green-400/10' : 'text-red-400 bg-red-400/10'
          )}>
            {trendUp ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
            {trend}
          </div>
        )}
      </div>

      <div className="flex items-end gap-1.5">
        <span className="text-3xl font-bold text-white leading-none">{value}</span>
        {unit && <span className="text-sm font-medium text-slate-400 mb-0.5">{unit}</span>}
      </div>
      <div className="text-xs font-medium mt-1.5" style={{ color: 'var(--text-secondary)' }}>{label}</div>
    </motion.div>
  )
}
