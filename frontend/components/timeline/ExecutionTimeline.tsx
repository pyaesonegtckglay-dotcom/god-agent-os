'use client'

import { useAgentStore } from '@/hooks/useAgentStore'
import { formatDistanceToNow } from 'date-fns'
import {
  Zap, Code2, Bug, Brain, Plug, Rocket, Workflow, Terminal,
  MessageSquare, CheckCircle2, XCircle, Clock, RefreshCw,
  ChevronDown, Trash2, Activity, Bot, Palette
} from 'lucide-react'
import { useState } from 'react'
import type { AgentName } from '@/hooks/useAgentStore'

const AGENT_META: Record<string, { icon: React.ElementType; color: string }> = {
  chat:      { icon: MessageSquare, color: '#22d3ee' },
  planner:   { icon: Zap,           color: '#a78bfa' },
  coding:    { icon: Code2,         color: '#34d399' },
  debug:     { icon: Bug,           color: '#f87171' },
  memory:    { icon: Brain,         color: '#fbbf24' },
  connector: { icon: Plug,          color: '#60a5fa' },
  deploy:    { icon: Rocket,        color: '#f472b6' },
  workflow:  { icon: Workflow,      color: '#fb923c' },
  sandbox:   { icon: Terminal,      color: '#4ade80' },
  ui:        { icon: Palette,       color: '#e879f9' },
}

const EVENT_DISPLAY: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  task_created:         { label: 'Task Created',        icon: Zap,          color: '#6366f1' },
  task_submitted:       { label: 'Task Submitted',      icon: Zap,          color: '#6366f1' },
  task_queued:          { label: 'Task Queued',         icon: Clock,        color: '#94a3b8' },
  task_started:         { label: 'Task Started',        icon: Activity,     color: '#22d3ee' },
  task_completed:       { label: 'Task Complete',       icon: CheckCircle2, color: '#22c55e' },
  task_failed:          { label: 'Task Failed',         icon: XCircle,      color: '#ef4444' },
  orchestrator_start:   { label: 'Orchestrator Start',  icon: Bot,          color: '#6366f1' },
  orchestrator_complete:{ label: 'Orchestrator Done',   icon: CheckCircle2, color: '#22c55e' },
  intent_classified:    { label: 'Intent Classified',   icon: Brain,        color: '#a78bfa' },
  agent_start:          { label: 'Agent Started',       icon: Zap,          color: '#818cf8' },
  agent_called:         { label: 'Agent Called',        icon: Bot,          color: '#818cf8' },
  plan_ready:           { label: 'Plan Ready',          icon: Zap,          color: '#a78bfa' },
  tool_called:          { label: 'Tool Called',         icon: Code2,        color: '#34d399' },
  tool_result:          { label: 'Tool Result',         icon: CheckCircle2, color: '#34d399' },
  code_generated:       { label: 'Code Generated',      icon: Code2,        color: '#34d399' },
  file_written:         { label: 'File Written',        icon: Terminal,     color: '#4ade80' },
  sandbox_exec:         { label: 'Sandbox Exec',        icon: Terminal,     color: '#4ade80' },
  sandbox_result:       { label: 'Sandbox Result',      icon: CheckCircle2, color: '#4ade80' },
  workflow_generated:   { label: 'Workflow Generated',  icon: Workflow,     color: '#fb923c' },
  deploy_plan_ready:    { label: 'Deploy Plan Ready',   icon: Rocket,       color: '#f472b6' },
  connector_result:     { label: 'Connector Result',    icon: Plug,         color: '#60a5fa' },
  self_heal_attempt:    { label: 'Self-Healing',        icon: RefreshCw,    color: '#f87171' },
  self_heal_success:    { label: 'Healed ✓',           icon: CheckCircle2, color: '#22c55e' },
  self_heal_failed:     { label: 'Heal Failed',         icon: XCircle,      color: '#ef4444' },
  retry_attempt:        { label: 'Retry',               icon: RefreshCw,    color: '#f59e0b' },
  llm_chunk:            { label: 'Streaming',           icon: Activity,     color: '#6366f1' },
  stream_start:         { label: 'Stream Start',        icon: Activity,     color: '#22d3ee' },
  stream_end:           { label: 'Stream End',          icon: CheckCircle2, color: '#22c55e' },
  debug_complete:       { label: 'Debug Complete',      icon: Bug,          color: '#f87171' },
  ui_generated:         { label: 'UI Generated',        icon: Palette,      color: '#e879f9' },
  installing_packages:  { label: 'Installing Packages', icon: Terminal,     color: '#4ade80' },
  github_op:            { label: 'GitHub Op',           icon: Plug,         color: '#60a5fa' },
}

function EventCard({ event, index }: { event: any; index: number }) {
  const [expanded, setExpanded] = useState(false)
  const meta = EVENT_DISPLAY[event.type] || { label: event.type, icon: Activity, color: '#6366f1' }
  const Icon = meta.icon
  const agentMeta = event.agent ? AGENT_META[event.agent] : null
  const AgentIcon = agentMeta?.icon

  // Skip raw llm_chunk events (too noisy)
  if (event.type === 'llm_chunk') return null

  const hasData = event.data && Object.keys(event.data).length > 0
  const dataStr = hasData ? JSON.stringify(event.data, null, 2) : null

  return (
    <div className="relative pl-6 pb-3 animate-fade-in">
      {/* Line */}
      <div className="absolute left-[11px] top-5 bottom-0 w-px" style={{ background: 'var(--border)' }} />

      {/* Dot */}
      <div className="absolute left-1.5 top-1.5 w-4 h-4 rounded-full flex items-center justify-center"
        style={{ background: `${meta.color}20`, border: `1.5px solid ${meta.color}60` }}>
        <div className="w-1.5 h-1.5 rounded-full" style={{ background: meta.color }} />
      </div>

      {/* Card */}
      <div className="rounded-xl overflow-hidden transition-all"
        style={{ background: 'var(--bg-3)', border: '1px solid var(--border)' }}>
        <button
          className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-white/5 transition-colors"
          onClick={() => hasData && setExpanded(!expanded)}
        >
          <Icon size={12} style={{ color: meta.color, flexShrink: 0 }} />
          <span className="text-xs font-medium flex-1 truncate" style={{ color: 'var(--text-primary)' }}>
            {meta.label}
          </span>

          {/* Agent badge */}
          {agentMeta && AgentIcon && (
            <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-medium"
              style={{ background: `${agentMeta.color}15`, color: agentMeta.color, border: `1px solid ${agentMeta.color}30` }}>
              <AgentIcon size={8} />
              {event.agent}
            </div>
          )}

          {/* Time */}
          <span className="text-[9px] ml-1 flex-shrink-0" style={{ color: 'var(--text-muted)' }}>
            {new Date(event.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </span>

          {hasData && (
            <ChevronDown size={10} style={{ color: 'var(--text-muted)', transform: expanded ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.2s' }} />
          )}
        </button>

        {/* Data preview (collapsed) */}
        {!expanded && hasData && (
          <div className="px-3 pb-2">
            <p className="text-[10px] truncate" style={{ color: 'var(--text-muted)' }}>
              {Object.entries(event.data).filter(([k]) => k !== 'chunk').slice(0, 3).map(([k, v]) =>
                `${k}: ${typeof v === 'string' ? v.slice(0, 30) : JSON.stringify(v)}`
              ).join(' · ')}
            </p>
          </div>
        )}

        {/* Expanded data */}
        {expanded && dataStr && (
          <div className="px-3 pb-2 border-t" style={{ borderColor: 'var(--border)' }}>
            <pre className="text-[9px] mt-2 overflow-auto max-h-32 font-mono leading-relaxed"
              style={{ color: 'var(--text-secondary)' }}>
              {dataStr}
            </pre>
          </div>
        )}
      </div>
    </div>
  )
}

export default function ExecutionTimeline() {
  const { events, clearEvents, agents, locale } = useAgentStore()
  const visibleEvents = events.filter(e => e.type !== 'llm_chunk')

  const activeAgents = Object.values(agents).filter(a => a.status === 'executing' || a.status === 'thinking')

  return (
    <div className="flex flex-col h-full" style={{ background: 'var(--bg-2)' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b shrink-0"
        style={{ borderColor: 'var(--border)', background: 'var(--bg-3)' }}>
        <div className="flex items-center gap-2">
          <Activity size={14} className="text-indigo-400" />
          <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
            {locale === 'my' ? 'အချိန်ဇယား' : 'Execution Timeline'}
          </span>
          {visibleEvents.length > 0 && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full"
              style={{ background: 'rgba(99,102,241,0.15)', color: '#818cf8', border: '1px solid rgba(99,102,241,0.3)' }}>
              {visibleEvents.length}
            </span>
          )}
        </div>
        {visibleEvents.length > 0 && (
          <button onClick={clearEvents}
            className="p-1.5 rounded-lg hover:bg-red-500/10 transition-colors"
            title="Clear timeline">
            <Trash2 size={12} className="text-red-400/60 hover:text-red-400" />
          </button>
        )}
      </div>

      {/* Active Agents Banner */}
      {activeAgents.length > 0 && (
        <div className="px-3 py-2 border-b flex items-center gap-2 flex-wrap"
          style={{ borderColor: 'var(--border)', background: 'rgba(99,102,241,0.05)' }}>
          <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
          <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
            {locale === 'my' ? 'အသုံးပြုနေသော Agent များ:' : 'Active:'}
          </span>
          {activeAgents.map(a => {
            const meta = AGENT_META[a.name]
            const Icon = meta?.icon
            return Icon ? (
              <div key={a.name} className="flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px]"
                style={{ background: `${meta.color}12`, color: meta.color, border: `1px solid ${meta.color}25` }}>
                <Icon size={8} />
                {a.name}
              </div>
            ) : null
          })}
        </div>
      )}

      {/* Events */}
      <div className="flex-1 overflow-y-auto p-3">
        {visibleEvents.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-center py-8">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center"
              style={{ background: 'var(--bg-3)', border: '1px solid var(--border)' }}>
              <Activity size={20} style={{ color: 'var(--text-muted)' }} />
            </div>
            <div>
              <p className="text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
                {locale === 'my' ? 'အချိန်ဇယားအလွတ်' : 'No events yet'}
              </p>
              <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                {locale === 'my'
                  ? 'Task တစ်ခုဖန်တီးပါ — Real-time events တွေ့ရမည်'
                  : 'Create a task to see real-time execution events'}
              </p>
            </div>
          </div>
        ) : (
          <div>
            {[...visibleEvents].reverse().map((ev, i) => (
              <EventCard key={ev.id} event={ev} index={i} />
            ))}
          </div>
        )}
      </div>

      {/* Agent Grid */}
      <div className="border-t p-3 shrink-0" style={{ borderColor: 'var(--border)' }}>
        <p className="text-[10px] uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>
          {locale === 'my' ? 'Agent အားလုံး' : 'All Agents'}
        </p>
        <div className="grid grid-cols-5 gap-1">
          {Object.entries(AGENT_META).map(([name, meta]) => {
            const Icon = meta.icon
            const agent = useAgentStore.getState().agents[name as AgentName]
            const isActive = agent?.status === 'executing' || agent?.status === 'thinking'
            return (
              <div key={name} title={`${name}: ${agent?.status || 'idle'}`}
                className="flex flex-col items-center gap-1 p-1.5 rounded-lg transition-all"
                style={{
                  background: isActive ? `${meta.color}10` : 'transparent',
                  border: `1px solid ${isActive ? meta.color + '30' : 'transparent'}`,
                }}>
                <Icon size={12} style={{ color: isActive ? meta.color : 'var(--text-muted)' }} />
                <span className="text-[8px] capitalize" style={{ color: isActive ? meta.color : 'var(--text-muted)' }}>
                  {name}
                </span>
                {isActive && <div className="w-1 h-1 rounded-full animate-pulse" style={{ background: meta.color }} />}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
