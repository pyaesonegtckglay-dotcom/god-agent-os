'use client'

import { useAgentStore } from '@/hooks/useAgentStore'
import { TimelineEvent, TaskStep } from '@/types'
import { formatDistanceToNow } from 'date-fns'
import { memo, useState } from 'react'
import {
  CheckCircle, XCircle, Clock, Loader2, AlertTriangle,
  ChevronDown, ChevronRight, Code2, Terminal, GitBranch,
  Brain, Search, TestTube, Globe, Zap, Database
} from 'lucide-react'

const TOOL_ICONS: Record<string, any> = {
  code: Code2, shell: Terminal, github: GitBranch, memory: Brain,
  search: Search, test: TestTube, browser: Globe, file: Database,
  none: Zap,
}

const STATUS_STYLES: Record<string, string> = {
  running: 'text-blue-400 bg-blue-400/10 border-blue-400/30',
  completed: 'text-green-400 bg-green-400/10 border-green-400/30',
  failed: 'text-red-400 bg-red-400/10 border-red-400/30',
  warning: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/30',
  pending: 'text-slate-500 bg-slate-500/10 border-slate-500/30',
}

const StatusIcon = ({ status }: { status: string }) => {
  if (status === 'running') return <Loader2 size={12} className="text-blue-400 animate-spin" />
  if (status === 'completed') return <CheckCircle size={12} className="text-green-400" />
  if (status === 'failed') return <XCircle size={12} className="text-red-400" />
  if (status === 'warning') return <AlertTriangle size={12} className="text-yellow-400" />
  return <Clock size={12} className="text-slate-500" />
}

const TimelineItem = memo(({ event, isLast }: { event: TimelineEvent; isLast: boolean }) => {
  const [expanded, setExpanded] = useState(false)
  const ToolIcon = event.tool ? (TOOL_ICONS[event.tool] || Zap) : null
  const hasData = event.data && Object.keys(event.data).length > 0
  const time = formatDistanceToNow(new Date(event.timestamp * 1000), { addSuffix: true })

  return (
    <div className="flex gap-3 group">
      {/* Connector line */}
      <div className="flex flex-col items-center flex-shrink-0">
        <div className={`w-6 h-6 rounded-full flex items-center justify-center border flex-shrink-0 ${STATUS_STYLES[event.status] || STATUS_STYLES.pending}`}>
          <StatusIcon status={event.status} />
        </div>
        {!isLast && <div className="w-px flex-1 bg-[#2a2b3d] mt-1 min-h-[16px]" />}
      </div>

      {/* Content */}
      <div className="pb-3 flex-1 min-w-0">
        <div
          className={`rounded-lg p-2.5 border transition-all ${
            event.status === 'running'
              ? 'bg-[#1a1f3a] border-blue-500/30'
              : 'bg-[#13141c] border-[#2a2b3d] hover:border-[#3a3b5a]'
          } ${hasData ? 'cursor-pointer' : ''}`}
          onClick={() => hasData && setExpanded(!expanded)}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              {ToolIcon && (
                <span className="flex-shrink-0 p-1 rounded bg-[#1a1b26]">
                  <ToolIcon size={10} className="text-brand-400" />
                </span>
              )}
              <span className="text-xs font-medium text-slate-200 truncate">{event.label}</span>
            </div>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <span className="text-[10px] text-slate-600">{time}</span>
              {hasData && (
                expanded
                  ? <ChevronDown size={10} className="text-slate-500" />
                  : <ChevronRight size={10} className="text-slate-500" />
              )}
            </div>
          </div>

          {event.description && (
            <p className="text-[11px] text-slate-500 mt-1 truncate">{event.description}</p>
          )}

          {/* Expanded data */}
          {expanded && hasData && (
            <div className="mt-2 pt-2 border-t border-[#2a2b3d]">
              <pre className="text-[10px] text-slate-400 font-mono overflow-auto max-h-32 whitespace-pre-wrap break-all">
                {JSON.stringify(event.data, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  )
})
TimelineItem.displayName = 'TimelineItem'

// ─── Step Progress Bar ────────────────────────────────────────────────────────

const StepProgress = ({ steps }: { steps: TaskStep[] }) => {
  if (!steps.length) return null
  const completed = steps.filter(s => s.status === 'completed').length
  const percent = Math.round((completed / steps.length) * 100)

  return (
    <div className="px-4 py-3 border-b border-[#2a2b3d] bg-[#13141c]">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[11px] font-medium text-slate-400">Execution Progress</span>
        <span className="text-[11px] font-mono text-brand-400">{completed}/{steps.length} steps</span>
      </div>
      <div className="h-1.5 bg-[#2a2b3d] rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-brand-500 to-blue-400 rounded-full transition-all duration-500"
          style={{ width: `${percent}%` }}
        />
      </div>
      <div className="mt-2 flex flex-wrap gap-1">
        {steps.map((step) => (
          <div
            key={step.id}
            title={step.name}
            className={`h-1.5 rounded-full flex-1 min-w-[8px] max-w-[32px] transition-all ${
              step.status === 'completed' ? 'bg-terminal-green' :
              step.status === 'running' ? 'bg-blue-400 animate-pulse' :
              step.status === 'failed' ? 'bg-red-400' :
              'bg-[#2a2b3d]'
            }`}
          />
        ))}
      </div>
    </div>
  )
}

// ─── Main Timeline Component ──────────────────────────────────────────────────

export default function ExecutionTimeline() {
  const { timeline, activeSteps, activeTaskId, tasks, clearTimeline } = useAgentStore()
  const activeTask = tasks.find(t => t.id === activeTaskId)

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      queued: 'status-queued',
      planning: 'status-planning',
      executing: 'status-executing',
      completed: 'status-completed',
      failed: 'status-failed',
      retrying: 'status-retrying',
    }
    return styles[status] || 'status-queued'
  }

  return (
    <div className="flex flex-col h-full bg-[#0f1017]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#2a2b3d]">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-slate-200">Execution Timeline</span>
          {activeTask && (
            <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${getStatusBadge(activeTask.status)}`}>
              {activeTask.status}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-slate-600 font-mono">{timeline.length} events</span>
          {timeline.length > 0 && (
            <button
              onClick={clearTimeline}
              className="text-[10px] text-slate-500 hover:text-slate-300 transition-colors px-2 py-0.5 rounded border border-[#2a2b3d] hover:border-[#3a3b5a]"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Active task info */}
      {activeTask && (
        <div className="px-4 py-2.5 bg-[#13141c] border-b border-[#2a2b3d]">
          <p className="text-[11px] text-slate-400 font-mono truncate">
            <span className="text-slate-600">Goal: </span>{activeTask.goal.slice(0, 100)}
          </p>
          {activeTask.retry_count > 0 && (
            <p className="text-[10px] text-yellow-400 mt-0.5">↻ Retry #{activeTask.retry_count}</p>
          )}
        </div>
      )}

      {/* Step progress */}
      <StepProgress steps={activeSteps} />

      {/* Timeline events */}
      <div className="flex-1 overflow-y-auto p-4">
        {timeline.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="text-4xl mb-3 opacity-30">⏱️</div>
            <p className="text-sm text-slate-500">No events yet</p>
            <p className="text-xs text-slate-600 mt-1">Submit a task to see live execution</p>
          </div>
        ) : (
          <div className="space-y-0">
            {[...timeline].reverse().map((event, i) => (
              <TimelineItem
                key={event.id}
                event={event}
                isLast={i === timeline.length - 1}
              />
            ))}
          </div>
        )}
      </div>

      {/* Active task result */}
      {activeTask?.result && (
        <div className="px-4 py-3 border-t border-[#2a2b3d] bg-[#13141c]">
          <div className="text-[10px] text-terminal-green font-mono mb-1">✓ Result</div>
          <p className="text-[11px] text-slate-300 line-clamp-3">{activeTask.result}</p>
        </div>
      )}
    </div>
  )
}
