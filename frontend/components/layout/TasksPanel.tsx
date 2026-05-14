'use client'

import { useEffect, useState } from 'react'
import { useAgentStore } from '@/hooks/useAgentStore'
import { getTasks, cancelTask, retryTask } from '@/lib/api'
import { ListTodo, Play, Square, RefreshCw, Clock, CheckCircle2, XCircle, Loader2, Zap } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

const STATUS_META: Record<string, { icon: React.ElementType; color: string; label: string }> = {
  queued:    { icon: Clock,        color: '#94a3b8', label: 'Queued' },
  executing: { icon: Loader2,      color: '#6366f1', label: 'Running' },
  completed: { icon: CheckCircle2, color: '#22c55e', label: 'Done' },
  failed:    { icon: XCircle,      color: '#ef4444', label: 'Failed' },
  cancelled: { icon: Square,       color: '#64748b', label: 'Cancelled' },
}

export default function TasksPanel() {
  const { sessionId, locale, setActiveTaskId, activeTaskId } = useAgentStore()
  const [tasks, setTasks] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const load = async () => {
    setLoading(true)
    try {
      const data = await getTasks(sessionId, 30)
      setTasks(Array.isArray(data) ? data : data.tasks || [])
    } catch {}
    setLoading(false)
  }

  useEffect(() => { load() }, [sessionId])
  useEffect(() => {
    const id = setInterval(load, 5000)
    return () => clearInterval(id)
  }, [sessionId])

  const handleCancel = async (taskId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    await cancelTask(taskId)
    load()
  }

  const handleRetry = async (taskId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    await retryTask(taskId)
    load()
  }

  return (
    <div className="flex flex-col h-full" style={{ background: 'var(--bg-2)' }}>
      <div className="flex items-center justify-between px-4 py-2.5 border-b shrink-0"
        style={{ borderColor: 'var(--border)', background: 'var(--bg-3)' }}>
        <div className="flex items-center gap-2">
          <ListTodo size={14} className="text-indigo-400" />
          <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
            {locale === 'my' ? 'လုပ်ငန်းများ' : 'Tasks'}
          </span>
          {tasks.length > 0 && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full"
              style={{ background: 'rgba(99,102,241,0.15)', color: '#818cf8', border: '1px solid rgba(99,102,241,0.3)' }}>
              {tasks.length}
            </span>
          )}
        </div>
        <button onClick={load} className="p-1.5 rounded-lg hover:bg-white/5 transition-colors">
          <RefreshCw size={12} style={{ color: 'var(--text-muted)' }} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {loading && tasks.length === 0 ? (
          <div className="space-y-2">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-20 rounded-xl shimmer" />
            ))}
          </div>
        ) : tasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 py-8">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center"
              style={{ background: 'var(--bg-3)', border: '1px solid var(--border)' }}>
              <ListTodo size={20} style={{ color: 'var(--text-muted)' }} />
            </div>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              {locale === 'my' ? 'လုပ်ငန်းမရှိသေးပါ' : 'No tasks yet'}
            </p>
          </div>
        ) : (
          tasks.map(task => {
            const sm = STATUS_META[task.status] || STATUS_META.queued
            const Icon = sm.icon
            const isActive = task.id === activeTaskId
            const isRunning = task.status === 'executing' || task.status === 'queued'

            return (
              <button key={task.id} onClick={() => setActiveTaskId(isActive ? null : task.id)}
                className="w-full rounded-xl p-3 text-left transition-all hover:scale-[1.01] active:scale-[0.99]"
                style={{
                  background: isActive ? 'rgba(99,102,241,0.1)' : 'var(--bg-3)',
                  border: `1px solid ${isActive ? 'rgba(99,102,241,0.4)' : 'var(--border)'}`,
                }}>
                <div className="flex items-start gap-2">
                  <div className="mt-0.5 flex-shrink-0">
                    <Icon size={13} style={{
                      color: sm.color,
                      animation: task.status === 'executing' ? 'spin 1.5s linear infinite' : 'none',
                    }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                      {task.goal}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[9px] px-1.5 py-0.5 rounded-full font-medium"
                        style={{ background: `${sm.color}15`, color: sm.color, border: `1px solid ${sm.color}30` }}>
                        {sm.label}
                      </span>
                      <span className="text-[9px]" style={{ color: 'var(--text-muted)' }}>
                        {formatDistanceToNow(new Date(task.created_at * 1000), { addSuffix: true })}
                      </span>
                    </div>
                    <p className="text-[9px] mt-1 font-mono truncate" style={{ color: 'var(--text-muted)' }}>
                      {task.id}
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-1 ml-1">
                    {isRunning && (
                      <button onClick={e => handleCancel(task.id, e)}
                        className="p-1 rounded-lg hover:bg-red-500/10 transition-colors" title="Cancel">
                        <Square size={10} className="text-red-400" />
                      </button>
                    )}
                    {task.status === 'failed' && (
                      <button onClick={e => handleRetry(task.id, e)}
                        className="p-1 rounded-lg hover:bg-indigo-500/10 transition-colors" title="Retry">
                        <RefreshCw size={10} className="text-indigo-400" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Progress bar for running tasks */}
                {isRunning && (
                  <div className="mt-2 h-0.5 rounded-full overflow-hidden" style={{ background: 'var(--border)' }}>
                    <div className="h-full rounded-full animate-pulse" style={{ background: sm.color, width: '60%' }} />
                  </div>
                )}
              </button>
            )
          })
        )}
      </div>
    </div>
  )
}
