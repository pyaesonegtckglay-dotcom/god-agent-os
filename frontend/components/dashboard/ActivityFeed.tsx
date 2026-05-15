'use client'

import { motion } from 'framer-motion'
const ACTIVITY: any[] = []
import { CheckCircle2, Loader2, Info, AlertTriangle } from 'lucide-react'

const TypeIcon = ({ type }: { type: string }) => {
  const cls = 'w-3.5 h-3.5 flex-shrink-0'
  switch (type) {
    case 'success': return <CheckCircle2 className={cls} style={{ color: '#22c55e' }} />
    case 'processing': return <Loader2 className={`${cls} animate-spin`} style={{ color: '#f59e0b' }} />
    case 'warning': return <AlertTriangle className={cls} style={{ color: '#f59e0b' }} />
    default: return <Info className={cls} style={{ color: '#60a5fa' }} />
  }
}

export default function ActivityFeed({ max = 6 }: { max?: number }) {
  const items = ACTIVITY.slice(0, max)
  return (
    <div className="space-y-1">
      {items.map((item, i) => (
        <motion.div
          key={item.id}
          initial={{ opacity: 0, x: 8 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3, delay: i * 0.06 }}
          className="flex items-start gap-3 px-3 py-2.5 rounded-xl hover:bg-white/[0.03] transition-colors group cursor-default"
        >
          <div className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
            style={{ background: `${item.color}15` }}>
            <div className="w-2 h-2 rounded-full" style={{ background: item.color }} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-white truncate">{item.agent}</span>
              <span className="text-xs flex-shrink-0" style={{ color: 'var(--text-muted)' }}>{item.time}</span>
            </div>
            <div className="text-xs mt-0.5 truncate" style={{ color: 'var(--text-secondary)' }}>{item.action}</div>
          </div>
          <TypeIcon type={item.type} />
        </motion.div>
      ))}
    </div>
  )
}
