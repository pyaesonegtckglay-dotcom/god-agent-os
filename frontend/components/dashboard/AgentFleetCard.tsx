'use client'

import { motion } from 'framer-motion'
type Agent = { id: string; name: string; status: string; icon: string; role: string; space: string; color?: string; description?: string; tasks?: number; model?: string; tasksCompleted?: number; uptime?: string; efficiency?: number; [key: string]: any }
import { cn, getStatusColor } from '@/lib/utils'
import { ChevronRight } from 'lucide-react'

interface AgentFleetCardProps {
  agent: Agent
  delay?: number
  onClick?: () => void
}

export default function AgentFleetCard({ agent, delay = 0, onClick }: AgentFleetCardProps) {
  const statusColor = getStatusColor(agent.status)

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay, ease: [0.4, 0, 0.2, 1] }}
      onClick={onClick}
      className="card p-4 cursor-pointer group relative overflow-hidden"
    >
      {/* Accent line */}
      <div className="absolute top-0 left-0 right-0 h-[2px] opacity-60 rounded-t-2xl"
        style={{ background: `linear-gradient(90deg, ${agent.color}, transparent)` }} />

      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
          style={{ background: `${agent.color}15`, border: `1px solid ${agent.color}20` }}>
          {agent.icon}
        </div>
        <div className={cn('badge', `badge-${agent.status}`)}>
          <div className="w-1.5 h-1.5 rounded-full" style={{ background: statusColor }} />
          {agent.status}
        </div>
      </div>

      {/* Info */}
      <div className="mb-3">
        <div className="text-sm font-semibold text-white leading-snug">{agent.name}</div>
        <div className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>{agent.role}</div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 gap-2 mb-3">
        <div>
          <div className="text-xs text-slate-500 mb-1">Efficiency</div>
          <div className="progress-bar">
            <div className="progress-fill"
              style={{ width: `${agent.efficiency}%`, background: `linear-gradient(90deg, ${agent.color}80, ${agent.color})` }} />
          </div>
          <div className="text-xs font-semibold mt-1" style={{ color: agent.color }}>{agent.efficiency}%</div>
        </div>
        <div>
          <div className="text-xs text-slate-500 mb-1">Uptime</div>
          <div className="progress-bar">
            <div className="progress-fill"
              style={{ width: `${agent.uptime}%`, background: `linear-gradient(90deg, #22d3ee60, #22d3ee)` }} />
          </div>
          <div className="text-xs font-semibold mt-1 text-cyan-400">{agent.uptime}%</div>
        </div>
      </div>

      {/* Last Action */}
      <div className="flex items-center gap-1.5 text-xs text-slate-500 group-hover:text-slate-400 transition-colors">
        <span className="truncate">{agent.lastAction}</span>
        <span className="flex-shrink-0">· {agent.lastActionTime}</span>
      </div>

      <ChevronRight size={14} className="absolute right-3 bottom-3 text-slate-700 group-hover:text-purple-400 transition-colors" />
    </motion.div>
  )
}
