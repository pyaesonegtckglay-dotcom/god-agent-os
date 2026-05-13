'use client'

import { useAgentStore } from '@/hooks/useAgentStore'
import { Task } from '@/types'
import { formatDistanceToNow } from 'date-fns'
import { RefreshCcw, XCircle, ChevronDown, ChevronUp, Terminal } from 'lucide-react'
import { useState } from 'react'
import { retryTask, cancelTask } from '@/lib/api'

const STATUS_BADGE: Record<string, string> = {
  queued: 'bg-slate-800 text-slate-400 border-slate-700',
  initializing: 'bg-blue-900/30 text-blue-400 border-blue-700/30',
  planning: 'bg-purple-900/30 text-purple-400 border-purple-700/30',
  executing: 'bg-cyan-900/30 text-cyan-400 border-cyan-700/30',
  retrying: 'bg-yellow-900/30 text-yellow-400 border-yellow-700/30',
  completed: 'bg-green-900/30 text-green-400 border-green-700/30',
  failed: 'bg-red-900/30 text-red-400 border-red-700/30',
  cancelled: 'bg-slate-800 text-slate-500 border-slate-700',
}

function TaskCard({ task }: { task: Task }) {
  const [expanded, setExpanded] = useState(false)
  const store = useAgentStore()
  const isActive = store.activeTaskId === task.id
  const time = formatDistanceToNow(new Date(task.created_at * 1000), { addSuffix: true })
  const duration = task.completed_at && task.started_at
    ? `${Math.round(task.completed_at - task.started_at)}s`
    : null

  return (
    <div className={`rounded-xl border transition-all ${
      isActive ? 'border-brand-500/40 bg-[#1a1f3a]' : 'border-[#2a2b3d] bg-[#13141c] hover:border-[#3a3b5a]'
    }`}>
      <div
        className="p-3 cursor-pointer"
        onClick={() => { store.setActiveTask(task.id); setExpanded(!expanded) }}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <p className="text-xs text-slate-200 leading-relaxed line-clamp-2">{task.goal}</p>
            <div className="flex items-center gap-2 mt-1.5">
              <span className={`text-[10px] px-1.5 py-0.5 rounded border font-medium ${STATUS_BADGE[task.status] || STATUS_BADGE.queued}`}>
                {task.status}
              </span>
              <span className="text-[10px] text-slate-600 font-mono">{task.id.slice(0, 14)}</span>
              {duration && <span className="text-[10px] text-slate-600">⏱ {duration}</span>}
              {task.retry_count > 0 && (
                <span className="text-[10px] text-yellow-500">↻ {task.retry_count}</span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            {task.status === 'failed' && (
              <button
                onClick={(e) => { e.stopPropagation(); retryTask(task.id) }}
                className="p-1.5 rounded-lg bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-400 transition-all"
                title="Retry"
              >
                <RefreshCcw size={11} />
              </button>
            )}
            {['queued','executing','planning'].includes(task.status) && (
              <button
                onClick={(e) => { e.stopPropagation(); cancelTask(task.id) }}
                className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-all"
                title="Cancel"
              >
                <XCircle size={11} />
              </button>
            )}
            {expanded ? <ChevronUp size={12} className="text-slate-500" /> : <ChevronDown size={12} className="text-slate-500" />}
          </div>
        </div>
      </div>

      {expanded && (
        <div className="px-3 pb-3 border-t border-[#2a2b3d] pt-2.5 space-y-2">
          {/* Plan steps */}
          {task.plan?.steps && task.plan.steps.length > 0 && (
            <div>
              <p className="text-[10px] text-slate-500 font-semibold mb-1.5">📋 Plan ({task.plan.steps.length} steps)</p>
              <div className="space-y-1">
                {task.plan.steps.map((step, i) => (
                  <div key={step.id} className="flex items-center gap-2 text-[11px]">
                    <span className="text-slate-600 font-mono w-4">{i+1}.</span>
                    <span className={
                      step.status === 'completed' ? 'text-terminal-green' :
                      step.status === 'running' ? 'text-blue-400' :
                      step.status === 'failed' ? 'text-red-400' :
                      'text-slate-500'
                    }>{step.name}</span>
                    {step.tool && <span className="text-[9px] text-slate-600 bg-[#1a1b26] px-1 rounded">{step.tool}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Result */}
          {task.result && (
            <div>
              <p className="text-[10px] text-slate-500 font-semibold mb-1">✅ Result</p>
              <div className="terminal p-2 text-[11px] text-terminal-green max-h-24 overflow-y-auto">
                {task.result.slice(0, 500)}
              </div>
            </div>
          )}

          {/* Error */}
          {task.error && (
            <div>
              <p className="text-[10px] text-slate-500 font-semibold mb-1">❌ Error</p>
              <div className="terminal p-2 text-[11px] text-red-400 max-h-24 overflow-y-auto">
                {task.error}
              </div>
            </div>
          )}

          <div className="flex items-center gap-3 text-[10px] text-slate-600 pt-1">
            <span>Created {time}</span>
            {task.session_id && <span className="font-mono">sess: {task.session_id.slice(0,10)}</span>}
          </div>
        </div>
      )}
    </div>
  )
}

export default function TasksPanel() {
  const { tasks } = useAgentStore()
  const active = tasks.filter(t => ['queued','initializing','planning','executing','retrying'].includes(t.status))
  const done = tasks.filter(t => ['completed','failed','cancelled'].includes(t.status))

  return (
    <div className="flex flex-col h-full bg-[#0f1017]">
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#2a2b3d]">
        <span className="text-sm font-semibold text-slate-200">Task Manager</span>
        <span className="text-[10px] text-slate-600">{tasks.length} total</span>
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {tasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <Terminal size={32} className="text-slate-700 mb-3" />
            <p className="text-sm text-slate-500">No tasks yet</p>
            <p className="text-xs text-slate-600 mt-1">Submit a goal to create tasks</p>
          </div>
        ) : (
          <>
            {active.length > 0 && (
              <div>
                <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-2 px-1">
                  Active ({active.length})
                </p>
                <div className="space-y-2">{active.map(t => <TaskCard key={t.id} task={t} />)}</div>
              </div>
            )}
            {done.length > 0 && (
              <div>
                <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-2 px-1 mt-3">
                  Completed ({done.length})
                </p>
                <div className="space-y-2">{done.map(t => <TaskCard key={t.id} task={t} />)}</div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
