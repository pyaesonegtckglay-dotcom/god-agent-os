'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Search, Filter, Plus, Bot, Activity, Zap } from 'lucide-react'
import { AGENTS, Agent } from '@/store/useAppStore'
import { getStatusColor, cn } from '@/lib/utils'

const STATUS_FILTERS = ['All', 'Active', 'Processing', 'Idle', 'Error']

function AgentDetailCard({ agent }: { agent: Agent }) {
  const sc = getStatusColor(agent.status)
  return (
    <motion.div layout className="card p-5 relative overflow-hidden group">
      <div className="absolute top-0 left-0 right-0 h-[2px]"
        style={{ background: `linear-gradient(90deg, ${agent.color}, transparent)` }} />

      <div className="flex items-start gap-4 mb-4">
        <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0"
          style={{ background: `${agent.color}15`, border: `1px solid ${agent.color}25` }}>
          {agent.icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-white">{agent.name}</h3>
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold"
              style={{ background: `${sc}15`, color: sc }}>
              <div className="w-1.5 h-1.5 rounded-full" style={{ background: sc }} />
              {agent.status}
            </div>
          </div>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>{agent.role}</p>
          <p className="text-xs mt-2 text-slate-500">{agent.lastAction} · {agent.lastActionTime}</p>
        </div>
        <div className="text-right">
          <div className="text-xs text-slate-500 mb-0.5">Tasks</div>
          <div className="text-xl font-bold text-white">{agent.tasks}</div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs text-slate-500">Efficiency</span>
            <span className="text-xs font-bold" style={{ color: agent.color }}>{agent.efficiency}%</span>
          </div>
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: `${agent.efficiency}%`, background: `linear-gradient(90deg, ${agent.color}60, ${agent.color})` }} />
          </div>
        </div>
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs text-slate-500">Uptime</span>
            <span className="text-xs font-bold text-cyan-400">{agent.uptime}%</span>
          </div>
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: `${agent.uptime}%`, background: 'linear-gradient(90deg, #22d3ee60, #22d3ee)' }} />
          </div>
        </div>
      </div>

      <div className="flex gap-2 mt-4">
        <button className="flex-1 py-2 rounded-xl text-xs font-semibold transition-all hover:opacity-90"
          style={{ background: `${agent.color}18`, border: `1px solid ${agent.color}30`, color: agent.color }}>
          View Details
        </button>
        <button className="flex-1 py-2 rounded-xl text-xs font-semibold transition-all hover:opacity-90"
          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: 'var(--text-secondary)' }}>
          Assign Task
        </button>
      </div>
    </motion.div>
  )
}

export default function AgentsPage() {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('All')

  const filtered = AGENTS.filter(a =>
    (statusFilter === 'All' || a.status === statusFilter.toLowerCase()) &&
    (search === '' || a.name.toLowerCase().includes(search.toLowerCase()))
  )

  const activeCount = AGENTS.filter(a => a.status === 'active').length
  const processingCount = AGENTS.filter(a => a.status === 'processing').length

  return (
    <div className="h-full overflow-y-auto p-6">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <Bot size={22} className="text-purple-400" /> Agent Fleet
          </h1>
          <p className="text-sm mt-1 text-slate-500">
            {activeCount} active · {processingCount} processing · {AGENTS.length} total agents deployed
          </p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90"
          style={{ background: 'linear-gradient(135deg, #7c3aed, #4f46e5)', boxShadow: '0 0 20px rgba(124,58,237,0.3)' }}>
          <Plus size={15} /> Deploy Agent
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Active', value: activeCount, color: '#22c55e' },
          { label: 'Processing', value: processingCount, color: '#f59e0b' },
          { label: 'Idle', value: AGENTS.filter(a => a.status === 'idle').length, color: '#94a3b8' },
          { label: 'Total Tasks', value: AGENTS.reduce((acc, a) => acc + a.tasks, 0), color: '#6366f1' },
        ].map(stat => (
          <div key={stat.label} className="card p-4 text-center">
            <div className="text-2xl font-bold text-white">{stat.value}</div>
            <div className="text-xs mt-1 font-medium" style={{ color: stat.color }}>{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Search & Filter */}
      <div className="flex gap-3 mb-6">
        <div className="relative flex-1 max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search agents…"
            className="cmd-input w-full pl-9 pr-4 py-2.5 text-sm" />
        </div>
        <div className="flex gap-2">
          {STATUS_FILTERS.map(f => (
            <button key={f} onClick={() => setStatusFilter(f)}
              className={cn('px-3 py-2 rounded-xl text-xs font-semibold transition-all',
                statusFilter === f
                  ? 'bg-purple-600/20 text-purple-300 border border-purple-500/30'
                  : 'text-slate-500 hover:text-slate-300 border border-transparent hover:border-white/10'
              )}>
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      <motion.div layout className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
        {filtered.map((agent, i) => (
          <motion.div key={agent.id} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}>
            <AgentDetailCard agent={agent} />
          </motion.div>
        ))}
        {filtered.length === 0 && (
          <div className="col-span-3 text-center py-16 text-slate-600">No agents match the filter</div>
        )}
      </motion.div>
    </div>
  )
}
