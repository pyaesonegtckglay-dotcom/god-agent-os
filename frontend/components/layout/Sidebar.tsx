'use client'

import { useAgentStore } from '@/hooks/useAgentStore'
import { Task } from '@/types'
import { formatDistanceToNow } from 'date-fns'
import { 
  MessageSquare, Clock, ListTodo, Brain, Settings,
  Plus, ChevronLeft, ChevronRight, Circle, Wifi, WifiOff,
  RefreshCcw, Trash2
} from 'lucide-react'
import { retryTask, cancelTask } from '@/lib/api'

const STATUS_DOT: Record<string, string> = {
  queued: 'bg-slate-500',
  initializing: 'bg-blue-400 animate-pulse',
  planning: 'bg-purple-400 animate-pulse',
  executing: 'bg-blue-400 animate-pulse',
  streaming: 'bg-cyan-400 animate-pulse',
  retrying: 'bg-yellow-400 animate-pulse',
  completed: 'bg-green-400',
  failed: 'bg-red-400',
  cancelled: 'bg-slate-600',
}

function TaskItem({ task }: { task: Task }) {
  const store = useAgentStore()
  const isActive = store.activeTaskId === task.id
  const time = formatDistanceToNow(new Date(task.created_at * 1000), { addSuffix: true })

  return (
    <button
      onClick={() => store.setActiveTask(task.id)}
      className={`w-full text-left px-3 py-2.5 rounded-lg transition-all group ${
        isActive
          ? 'bg-brand-500/15 border border-brand-500/30'
          : 'hover:bg-[#1a1b26] border border-transparent'
      }`}
    >
      <div className="flex items-start gap-2">
        <div className={`w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 ${STATUS_DOT[task.status] || 'bg-slate-500'}`} />
        <div className="flex-1 min-w-0">
          <p className="text-[11px] text-slate-300 truncate leading-relaxed">{task.goal.slice(0, 60)}</p>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className="text-[10px] text-slate-600">{time}</span>
            {task.retry_count > 0 && (
              <span className="text-[10px] text-yellow-500">↻{task.retry_count}</span>
            )}
          </div>
        </div>
        {task.status === 'failed' && (
          <button
            onClick={(e) => { e.stopPropagation(); retryTask(task.id) }}
            className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-[#2a2b3d] transition-all"
            title="Retry"
          >
            <RefreshCcw size={10} className="text-yellow-400" />
          </button>
        )}
      </div>
    </button>
  )
}

export default function Sidebar() {
  const store = useAgentStore()
  const { sidebarOpen, setSidebarOpen, activePanel, setActivePanel, tasks, wsConnected, wsRetries, clearMessages, clearTimeline } = store

  const NAV_ITEMS = [
    { id: 'chat' as const, icon: MessageSquare, label: 'Chat' },
    { id: 'timeline' as const, icon: Clock, label: 'Timeline' },
    { id: 'tasks' as const, icon: ListTodo, label: 'Tasks' },
    { id: 'memory' as const, icon: Brain, label: 'Memory' },
  ]

  const runningTasks = tasks.filter(t => ['executing', 'planning', 'retrying'].includes(t.status))
  const recentTasks = tasks.slice(0, 15)

  return (
    <>
      {/* Collapsed sidebar — icon rail */}
      <div className={`flex flex-col h-full bg-[#0c0d12] border-r border-[#2a2b3d] transition-all duration-200 ${sidebarOpen ? 'w-60' : 'w-12'}`}>
        {/* Logo + Toggle */}
        <div className="flex items-center justify-between px-3 py-3 border-b border-[#2a2b3d]">
          {sidebarOpen && (
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-brand-500 to-blue-500 flex items-center justify-center text-[10px] font-bold text-white shadow-lg">
                D
              </div>
              <div>
                <div className="text-xs font-bold text-slate-200">Devin Agent</div>
                <div className="text-[9px] text-slate-600">v2.0 Production</div>
              </div>
            </div>
          )}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-1 rounded hover:bg-[#1a1b26] text-slate-500 hover:text-slate-300 transition-all ml-auto"
          >
            {sidebarOpen ? <ChevronLeft size={14} /> : <ChevronRight size={14} />}
          </button>
        </div>

        {/* Nav items */}
        <nav className="flex flex-col gap-1 px-2 py-3">
          {NAV_ITEMS.map(({ id, icon: Icon, label }) => (
            <button
              key={id}
              onClick={() => setActivePanel(id)}
              title={!sidebarOpen ? label : undefined}
              className={`flex items-center gap-2.5 px-2 py-2 rounded-lg transition-all ${
                activePanel === id
                  ? 'bg-brand-500/15 text-brand-400 border border-brand-500/30'
                  : 'text-slate-500 hover:text-slate-300 hover:bg-[#1a1b26]'
              }`}
            >
              <Icon size={14} className="flex-shrink-0" />
              {sidebarOpen && <span className="text-xs font-medium">{label}</span>}
            </button>
          ))}
        </nav>

        {sidebarOpen && (
          <>
            <div className="px-3 mb-2">
              <div className="h-px bg-[#2a2b3d]" />
            </div>

            {/* Active tasks */}
            {runningTasks.length > 0 && (
              <div className="px-3 mb-3">
                <div className="flex items-center gap-1.5 mb-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
                  <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">
                    Running ({runningTasks.length})
                  </span>
                </div>
                <div className="space-y-1">
                  {runningTasks.map(t => <TaskItem key={t.id} task={t} />)}
                </div>
              </div>
            )}

            {/* Recent tasks */}
            {recentTasks.length > 0 && (
              <div className="px-3 flex-1 overflow-y-auto">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">
                    Recent Tasks
                  </span>
                  <span className="text-[10px] text-slate-600">{recentTasks.length}</span>
                </div>
                <div className="space-y-1">
                  {recentTasks.map(t => <TaskItem key={t.id} task={t} />)}
                </div>
              </div>
            )}
          </>
        )}

        {/* Connection status + actions */}
        <div className={`mt-auto border-t border-[#2a2b3d] px-2 py-2 ${sidebarOpen ? '' : 'flex flex-col items-center gap-2'}`}>
          {sidebarOpen ? (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                {wsConnected
                  ? <Wifi size={11} className="text-terminal-green" />
                  : <WifiOff size={11} className="text-red-400" />
                }
                <span className={`text-[10px] ${wsConnected ? 'text-terminal-green' : 'text-red-400'}`}>
                  {wsConnected ? 'Connected' : `Reconnecting${wsRetries > 0 ? ` (${wsRetries})` : ''}`}
                </span>
              </div>
              <button
                onClick={() => { clearMessages(); clearTimeline() }}
                title="Clear session"
                className="p-1 rounded hover:bg-[#1a1b26] text-slate-600 hover:text-slate-400 transition-all"
              >
                <Trash2 size={11} />
              </button>
            </div>
          ) : (
            <div title={wsConnected ? 'Connected' : 'Disconnected'}>
              {wsConnected
                ? <Wifi size={12} className="text-terminal-green" />
                : <WifiOff size={12} className="text-red-400" />
              }
            </div>
          )}
        </div>
      </div>
    </>
  )
}
