'use client'

import { motion } from 'framer-motion'
import { GitBranch, Play, Pause, Plus, Clock, CheckCircle2, Zap } from 'lucide-react'

const WORKFLOWS = [
  { id: 1, name: 'Daily Research Pipeline', desc: 'Research → Analyze → Summarize → Report', status: 'active', runs: 47, lastRun: '2h ago', color: '#6366f1', schedule: 'Daily 9:00 AM' },
  { id: 2, name: 'Code Review Automation', desc: 'PR Detect → AI Review → Comment → Approve', status: 'active', runs: 23, lastRun: '1h ago', color: '#34d399', schedule: 'On PR event' },
  { id: 3, name: 'Content Generation Loop', desc: 'Research → Write → Review → Publish', status: 'paused', runs: 12, lastRun: '1d ago', color: '#a78bfa', schedule: 'Weekly' },
  { id: 4, name: 'Deploy Pipeline', desc: 'Build → Test → Stage → Deploy → Monitor', status: 'active', runs: 89, lastRun: '30m ago', color: '#22d3ee', schedule: 'On push to main' },
  { id: 5, name: 'Market Intelligence', desc: 'Scrape → Parse → Analyze → Alert', status: 'idle', runs: 7, lastRun: '3d ago', color: '#f59e0b', schedule: 'Weekly' },
]

const STATUS_CONFIG = {
  active: { color: '#22c55e', label: 'Active' },
  paused: { color: '#f59e0b', label: 'Paused' },
  idle:   { color: '#94a3b8', label: 'Idle' },
}

export default function WorkflowsPage() {
  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <GitBranch size={22} className="text-purple-400" /> Workflows
          </h1>
          <p className="text-sm mt-1 text-slate-500">Autonomous multi-agent pipelines · {WORKFLOWS.filter(w => w.status === 'active').length} running</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white hover:opacity-90 transition-all"
          style={{ background: 'linear-gradient(135deg, #7c3aed, #4f46e5)', boxShadow: '0 0 20px rgba(124,58,237,0.3)' }}>
          <Plus size={15} /> New Workflow
        </button>
      </div>

      <div className="space-y-3">
        {WORKFLOWS.map((wf, i) => {
          const sc = STATUS_CONFIG[wf.status as keyof typeof STATUS_CONFIG]
          return (
            <motion.div key={wf.id} initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.07 }} className="card p-5 group cursor-pointer">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: `${wf.color}15`, border: `1px solid ${wf.color}25` }}>
                  <GitBranch size={18} style={{ color: wf.color }} />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold text-white">{wf.name}</h3>
                    <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                      style={{ background: `${sc.color}12`, color: sc.color }}>
                      {sc.label}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 font-mono">{wf.desc}</p>
                  <div className="flex items-center gap-4 mt-2 text-xs text-slate-600">
                    <span className="flex items-center gap-1"><Zap size={10} /> {wf.runs} runs</span>
                    <span className="flex items-center gap-1"><Clock size={10} /> {wf.lastRun}</span>
                    <span>{wf.schedule}</span>
                  </div>
                </div>

                <div className="flex gap-2">
                  <button className="w-8 h-8 rounded-xl flex items-center justify-center transition-all hover:bg-white/10"
                    style={{ border: '1px solid rgba(255,255,255,0.08)' }}>
                    {wf.status === 'active' ? <Pause size={13} className="text-slate-400" /> : <Play size={13} className="text-green-400" />}
                  </button>
                </div>
              </div>
            </motion.div>
          )
        })}
      </div>
    </div>
  )
}
