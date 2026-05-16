'use client'

import { useEffect, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  GitBranch, Play, Pause, Plus, Clock, CheckCircle2, Zap,
  RefreshCw, XCircle, AlertCircle, ExternalLink, Activity,
  BarChart3, Loader2, Settings, ChevronRight, Terminal,
} from 'lucide-react'
import { n8nGetWorkflows, n8nGetExecutions, n8nGetStats, n8nExecuteWorkflow, n8nToggleWorkflow, n8nStatus } from '@/lib/api'

interface N8NWorkflow {
  id: string
  name: string
  active: boolean
  created_at: string
  updated_at: string
  node_count: number
  tags: string[]
}

interface N8NExecution {
  id: string
  workflow_id: string
  workflow_name: string
  status: string
  started_at: string
  stopped_at: string
  finished: boolean
  mode: string
}

interface N8NStats {
  total_workflows: number
  active_workflows: number
  paused_workflows: number
  recent_executions: number
  recent_success: number
  recent_failed: number
  success_rate: number
  timestamp: number
  error?: string
}

const STATUS_CONFIG: Record<string, { color: string; label: string; bg: string }> = {
  success:  { color: '#22c55e', label: 'Success',  bg: '#22c55e12' },
  error:    { color: '#ef4444', label: 'Error',    bg: '#ef444412' },
  failed:   { color: '#ef4444', label: 'Failed',   bg: '#ef444412' },
  crashed:  { color: '#f97316', label: 'Crashed',  bg: '#f9731612' },
  waiting:  { color: '#f59e0b', label: 'Waiting',  bg: '#f59e0b12' },
  running:  { color: '#3b82f6', label: 'Running',  bg: '#3b82f612' },
  new:      { color: '#8b5cf6', label: 'New',      bg: '#8b5cf612' },
  unknown:  { color: '#64748b', label: 'Unknown',  bg: '#64748b12' },
}

function getStatusConf(s: string) {
  return STATUS_CONFIG[s?.toLowerCase()] || STATUS_CONFIG.unknown
}

function timeAgo(dateStr: string) {
  if (!dateStr) return '–'
  const diff = Date.now() - new Date(dateStr).getTime()
  const s = Math.floor(diff / 1000)
  if (s < 60) return `${s}s ago`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

export default function WorkflowsPage() {
  const [connected, setConnected] = useState<boolean | null>(null)
  const [workflows, setWorkflows] = useState<N8NWorkflow[]>([])
  const [executions, setExecutions] = useState<N8NExecution[]>([])
  const [stats, setStats] = useState<N8NStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [selectedWorkflow, setSelectedWorkflow] = useState<N8NWorkflow | null>(null)
  const [wfExecutions, setWfExecutions] = useState<N8NExecution[]>([])
  const [loadingWfEx, setLoadingWfEx] = useState(false)
  const N8N_URL = 'https://pyae1994-n8n-aiven-v1.hf.space'

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    else setRefreshing(true)
    setError(null)
    try {
      const [statusRes, wfRes, exRes, statsRes] = await Promise.allSettled([
        n8nStatus(),
        n8nGetWorkflows(100),
        n8nGetExecutions(undefined, 20),
        n8nGetStats(),
      ])

      if (statusRes.status === 'fulfilled') {
        setConnected(statusRes.value.connected)
      }
      if (wfRes.status === 'fulfilled') {
        setWorkflows(wfRes.value.workflows || [])
      } else {
        setError(`Could not load workflows: ${(wfRes as any).reason?.message || 'Unknown error'}`)
      }
      if (exRes.status === 'fulfilled') {
        setExecutions(exRes.value.executions || [])
      }
      if (statsRes.status === 'fulfilled') {
        setStats(statsRes.value)
      }
    } catch (e: any) {
      setError(e?.message || 'Failed to connect to n8n')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    load()
    const interval = setInterval(() => load(true), 30000)
    return () => clearInterval(interval)
  }, [load])

  async function handleToggle(wf: N8NWorkflow) {
    setActionLoading(wf.id)
    try {
      await n8nToggleWorkflow(wf.id, !wf.active)
      setWorkflows(prev => prev.map(w => w.id === wf.id ? { ...w, active: !w.active } : w))
      dispatchNotification(
        `Workflow ${wf.active ? 'Paused' : 'Activated'}`,
        `"${wf.name}" is now ${wf.active ? 'paused' : 'active'}`
      )
    } catch (e: any) {
      setError(`Toggle failed: ${e?.message}`)
    } finally {
      setActionLoading(null)
    }
  }

  async function handleRun(wf: N8NWorkflow) {
    setActionLoading(`run_${wf.id}`)
    try {
      await n8nExecuteWorkflow(wf.id)
      dispatchNotification('Workflow Triggered', `"${wf.name}" execution started`)
      setTimeout(() => load(true), 2000)
    } catch (e: any) {
      setError(`Execution failed: ${e?.message}`)
    } finally {
      setActionLoading(null)
    }
  }

  async function loadWfExecutions(wf: N8NWorkflow) {
    setSelectedWorkflow(wf)
    setLoadingWfEx(true)
    try {
      const res = await n8nGetExecutions(wf.id, 10)
      setWfExecutions(res.executions || [])
    } catch {
      setWfExecutions([])
    } finally {
      setLoadingWfEx(false)
    }
  }

  function dispatchNotification(title: string, description: string) {
    const event = new CustomEvent('god-agent-notification', {
      detail: { id: `n8n_${Date.now()}`, title, description, timestamp: Date.now() },
    })
    window.dispatchEvent(event)
  }

  const activeCount = workflows.filter(w => w.active).length

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center space-y-3">
          <Loader2 size={32} className="animate-spin text-purple-400 mx-auto" />
          <p className="text-sm text-slate-500">Connecting to n8n…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full overflow-y-auto p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <GitBranch size={22} className="text-purple-400" /> Workflows
            <span className="flex items-center gap-1.5 ml-2">
              <div className={`w-2 h-2 rounded-full ${connected ? 'bg-green-400 animate-pulse' : 'bg-red-400'}`} />
              <span className={`text-xs font-normal ${connected ? 'text-green-400' : 'text-red-400'}`}>
                {connected === null ? 'checking…' : connected ? 'n8n connected' : 'n8n offline'}
              </span>
            </span>
          </h1>
          <p className="text-sm mt-1 text-slate-500">
            n8n workflow automation · {activeCount} active of {workflows.length} total
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => load(true)}
            disabled={refreshing}
            className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium text-slate-300 hover:bg-white/5 transition-all"
            style={{ border: '1px solid rgba(255,255,255,0.07)' }}
          >
            <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} />
            Refresh
          </button>
          <a
            href={N8N_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-white hover:opacity-90 transition-all"
            style={{ background: 'linear-gradient(135deg, #ea4b71, #c2355a)' }}
          >
            <ExternalLink size={13} /> Open n8n
          </a>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 p-3 rounded-xl flex items-center gap-2 text-sm text-red-400"
          style={{ background: '#ef444410', border: '1px solid #ef444430' }}>
          <AlertCircle size={15} />
          {error}
          <button onClick={() => setError(null)} className="ml-auto text-xs opacity-60 hover:opacity-100">dismiss</button>
        </div>
      )}

      {/* Stats Row */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
          {[
            { label: 'Total Workflows', value: stats.total_workflows, icon: GitBranch, color: '#7c3aed' },
            { label: 'Active', value: stats.active_workflows, icon: Activity, color: '#22c55e' },
            { label: 'Recent Runs', value: stats.recent_executions, icon: Terminal, color: '#3b82f6' },
            { label: 'Success Rate', value: `${stats.success_rate}%`, icon: CheckCircle2, color: '#f59e0b' },
          ].map((s) => (
            <div key={s.label} className="card p-3 flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: `${s.color}15` }}>
                <s.icon size={15} style={{ color: s.color }} />
              </div>
              <div>
                <div className="text-lg font-bold text-white">{s.value}</div>
                <div className="text-xs text-slate-500">{s.label}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        {/* Workflow List */}
        <div className="xl:col-span-2 space-y-2">
          <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Workflows</h2>
          {workflows.length === 0 ? (
            <div className="card p-8 text-center text-slate-500">
              {connected === false ? (
                <div>
                  <AlertCircle size={28} className="mx-auto mb-2 text-red-400" />
                  <p className="text-sm">Cannot reach n8n.</p>
                  <p className="text-xs mt-1">Check your n8n connector settings.</p>
                </div>
              ) : (
                <div>
                  <GitBranch size={28} className="mx-auto mb-2 text-slate-600" />
                  <p className="text-sm">No workflows found.</p>
                </div>
              )}
            </div>
          ) : (
            workflows.map((wf, i) => (
              <motion.div
                key={wf.id}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.04 }}
                className={`card p-4 group cursor-pointer transition-all ${selectedWorkflow?.id === wf.id ? 'ring-1 ring-purple-500/30' : ''}`}
                onClick={() => loadWfExecutions(wf)}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${wf.active ? 'bg-green-400 animate-pulse' : 'bg-slate-600'}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-white text-sm truncate group-hover:text-purple-300 transition-colors">
                        {wf.name}
                      </h3>
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full flex-shrink-0"
                        style={{
                          background: wf.active ? '#22c55e12' : '#64748b12',
                          color: wf.active ? '#22c55e' : '#64748b',
                          border: `1px solid ${wf.active ? '#22c55e20' : '#64748b20'}`,
                        }}>
                        {wf.active ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-[11px] text-slate-500">
                      <span className="flex items-center gap-1"><Zap size={9} /> {wf.node_count} nodes</span>
                      <span className="flex items-center gap-1"><Clock size={9} /> {timeAgo(wf.updated_at)}</span>
                      {wf.tags.length > 0 && (
                        <span className="text-purple-400">{wf.tags.slice(0, 2).join(', ')}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0" onClick={e => e.stopPropagation()}>
                    <button
                      onClick={() => handleRun(wf)}
                      disabled={actionLoading === `run_${wf.id}`}
                      className="w-7 h-7 rounded-lg flex items-center justify-center transition-all hover:bg-green-500/10"
                      style={{ border: '1px solid rgba(255,255,255,0.07)' }}
                      title="Run now"
                    >
                      {actionLoading === `run_${wf.id}`
                        ? <Loader2 size={11} className="animate-spin text-green-400" />
                        : <Play size={11} className="text-green-400" />}
                    </button>
                    <button
                      onClick={() => handleToggle(wf)}
                      disabled={actionLoading === wf.id}
                      className="w-7 h-7 rounded-lg flex items-center justify-center transition-all hover:bg-white/5"
                      style={{ border: '1px solid rgba(255,255,255,0.07)' }}
                      title={wf.active ? 'Pause' : 'Activate'}
                    >
                      {actionLoading === wf.id
                        ? <Loader2 size={11} className="animate-spin text-slate-400" />
                        : wf.active
                          ? <Pause size={11} className="text-slate-400" />
                          : <Play size={11} className="text-purple-400" />}
                    </button>
                    <ChevronRight size={13} className="text-slate-600 group-hover:text-slate-400 transition-colors" />
                  </div>
                </div>
              </motion.div>
            ))
          )}
        </div>

        {/* Right Panel: Executions */}
        <div>
          {selectedWorkflow ? (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Recent Runs — {selectedWorkflow.name.slice(0, 18)}{selectedWorkflow.name.length > 18 ? '…' : ''}
                </h2>
                <button onClick={() => setSelectedWorkflow(null)} className="text-xs text-slate-600 hover:text-slate-400">✕</button>
              </div>
              {loadingWfEx ? (
                <div className="card p-6 text-center"><Loader2 size={20} className="animate-spin text-purple-400 mx-auto" /></div>
              ) : wfExecutions.length === 0 ? (
                <div className="card p-6 text-center text-sm text-slate-600">No executions found</div>
              ) : (
                <div className="space-y-2">
                  {wfExecutions.map((ex) => {
                    const sc = getStatusConf(ex.status)
                    return (
                      <div key={ex.id} className="card p-3">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                            style={{ background: sc.bg, color: sc.color }}>
                            {sc.label}
                          </span>
                          <span className="text-xs text-slate-500">{ex.mode}</span>
                          <span className="ml-auto text-[10px] text-slate-600">{timeAgo(ex.started_at)}</span>
                        </div>
                        <div className="text-[10px] text-slate-600 font-mono">#{ex.id?.slice(-6)}</div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          ) : (
            <div>
              <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Recent Executions</h2>
              {executions.length === 0 ? (
                <div className="card p-6 text-center text-sm text-slate-600">No recent executions</div>
              ) : (
                <div className="space-y-2">
                  {executions.slice(0, 10).map((ex) => {
                    const sc = getStatusConf(ex.status)
                    return (
                      <motion.div
                        key={ex.id}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="card p-3"
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                            style={{ background: sc.bg, color: sc.color }}>
                            {sc.label}
                          </span>
                          <span className="text-xs text-white truncate flex-1">{ex.workflow_name}</span>
                        </div>
                        <div className="flex items-center gap-2 text-[10px] text-slate-600">
                          <Clock size={9} />{timeAgo(ex.started_at)}
                          <span>·</span>
                          <span className="capitalize">{ex.mode}</span>
                          <span className="ml-auto font-mono">#{ex.id?.slice(-6)}</span>
                        </div>
                      </motion.div>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
