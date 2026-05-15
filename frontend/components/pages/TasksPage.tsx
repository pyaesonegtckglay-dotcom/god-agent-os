'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { CheckSquare, Clock, Loader2, AlertCircle, Plus, ChevronRight } from 'lucide-react'
import { TASKS, Task } from '@/store/useAppStore'
import { cn } from '@/lib/utils'

const STATUS_CONFIG = {
  running:   { color: '#6366f1', label: 'Running',   icon: Loader2,     bg: 'rgba(99,102,241,0.12)' },
  completed: { color: '#22c55e', label: 'Completed', icon: CheckSquare, bg: 'rgba(34,197,94,0.12)' },
  pending:   { color: '#94a3b8', label: 'Pending',   icon: Clock,       bg: 'rgba(148,163,184,0.1)' },
  failed:    { color: '#ef4444', label: 'Failed',    icon: AlertCircle, bg: 'rgba(239,68,68,0.12)' },
}

function TaskRow({ task, delay }: { task: Task; delay: number }) {
  const cfg = STATUS_CONFIG[task.status]
  const Icon = cfg.icon
  const isRunning = task.status === 'running'
  const agentColor = '#6366f1'

  return (
    <motion.div
      initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }}
      transition={{ delay, duration: 0.3 }}
      className="card p-4 group hover:border-white/10 transition-all cursor-pointer"
    >
      <div className="flex items-center gap-4">
        <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: cfg.bg }}>
          <Icon size={14} style={{ color: cfg.color }} className={isRunning ? 'animate-spin' : ''} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-semibold text-white truncate">{task.title}</span>
            <span className="text-xs px-2 py-0.5 rounded-full flex-shrink-0 font-medium"
              style={{ background: cfg.bg, color: cfg.color }}>{cfg.label}</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-500">{task.agent}</span>
            <span className="text-xs text-slate-600">· {task.createdAt}</span>
            {task.completedAt && <span className="text-xs text-green-500">Completed {task.completedAt}</span>}
          </div>
          {task.status === 'running' && (
            <div className="mt-2 flex items-center gap-2">
              <div className="flex-1 progress-bar">
                <motion.div className="progress-fill"
                  initial={{ width: 0 }} animate={{ width: `${task.progress}%` }}
                  transition={{ duration: 1, delay: 0.2 }}
                  style={{ background: 'linear-gradient(90deg, #6366f160, #6366f1)' }} />
              </div>
              <span className="text-xs font-bold text-purple-400 w-8 text-right">{task.progress}%</span>
            </div>
          )}
        </div>

        <ChevronRight size={15} className="text-slate-700 group-hover:text-purple-400 transition-colors flex-shrink-0" />
      </div>
    </motion.div>
  )
}

export default function TasksPage() {
  const [filter, setFilter] = useState<'all' | Task['status']>('all')
  const filtered = filter === 'all' ? TASKS : TASKS.filter(t => t.status === filter)

  const counts = {
    all: TASKS.length,
    running: TASKS.filter(t => t.status === 'running').length,
    completed: TASKS.filter(t => t.status === 'completed').length,
    pending: TASKS.filter(t => t.status === 'pending').length,
    failed: TASKS.filter(t => t.status === 'failed').length,
  }

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <CheckSquare size={22} className="text-purple-400" /> Tasks
          </h1>
          <p className="text-sm mt-1 text-slate-500">{counts.running} running · {counts.pending} pending · {counts.completed} completed</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white hover:opacity-90 transition-all"
          style={{ background: 'linear-gradient(135deg, #7c3aed, #4f46e5)', boxShadow: '0 0 20px rgba(124,58,237,0.3)' }}>
          <Plus size={15} /> New Task
        </button>
      </div>

      {/* Status Tabs */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {(['all', 'running', 'completed', 'pending', 'failed'] as const).map(s => (
          <button key={s} onClick={() => setFilter(s)}
            className={cn('px-4 py-2 rounded-xl text-xs font-semibold capitalize transition-all',
              filter === s
                ? 'bg-purple-600/20 text-purple-300 border border-purple-500/30'
                : 'text-slate-500 border border-transparent hover:border-white/10 hover:text-slate-300'
            )}>
            {s} ({counts[s]})
          </button>
        ))}
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {Object.entries(STATUS_CONFIG).map(([status, cfg]) => (
          <div key={status} className="card p-4">
            <div className="text-2xl font-bold text-white">{counts[status as keyof typeof counts] || 0}</div>
            <div className="text-xs mt-1 font-semibold" style={{ color: cfg.color }}>{cfg.label}</div>
          </div>
        ))}
      </div>

      {/* Tasks List */}
      <div className="space-y-3">
        {filtered.map((task, i) => <TaskRow key={task.id} task={task} delay={i * 0.05} />)}
        {filtered.length === 0 && (
          <div className="text-center py-16 text-slate-600">No tasks with this filter</div>
        )}
      </div>
    </div>
  )
}
