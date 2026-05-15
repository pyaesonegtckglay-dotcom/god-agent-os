'use client'

import { motion } from 'framer-motion'
import { BarChart3, TrendingUp, Clock, CheckSquare, Zap } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, AreaChart, Area } from 'recharts'

const WEEKLY_DATA = [
  { day: 'Mon', tasks: 28, efficiency: 91 },
  { day: 'Tue', tasks: 35, efficiency: 94 },
  { day: 'Wed', tasks: 42, efficiency: 96 },
  { day: 'Thu', tasks: 31, efficiency: 89 },
  { day: 'Fri', tasks: 55, efficiency: 98 },
  { day: 'Sat', tasks: 22, efficiency: 92 },
  { day: 'Sun', tasks: 34, efficiency: 97 },
]

const AGENT_PERF = [
  { name: 'Code', tasks: 62, success: 99 },
  { name: 'Data', tasks: 83, success: 98 },
  { name: 'Research', tasks: 47, success: 92 },
  { name: 'Content', tasks: 31, success: 95 },
  { name: 'Design', tasks: 24, success: 90 },
]

const customTooltipStyle = {
  background: 'rgba(14,17,33,0.95)',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: 10,
  padding: '8px 12px',
  fontSize: 12,
  color: '#e2e8f0',
}

export default function AnalyticsPage() {
  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-white flex items-center gap-2">
          <BarChart3 size={22} className="text-purple-400" /> Analytics
        </h1>
        <p className="text-sm mt-1 text-slate-500">Performance insights across all agents and tasks</p>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Tasks This Week', value: '247', delta: '+37%', color: '#6366f1', icon: CheckSquare },
          { label: 'Avg Efficiency', value: '95.2%', delta: '+3.1%', color: '#22c55e', icon: TrendingUp },
          { label: 'Time Saved', value: '128h', delta: '+55%', color: '#22d3ee', icon: Clock },
          { label: 'Success Rate', value: '98.6%', delta: '+1.2%', color: '#a78bfa', icon: Zap },
        ].map(kpi => (
          <div key={kpi.label} className="card p-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center"
                style={{ background: `${kpi.color}15` }}>
                <kpi.icon size={13} style={{ color: kpi.color }} />
              </div>
              <span className="text-xs text-slate-500">{kpi.label}</span>
            </div>
            <div className="text-2xl font-bold text-white">{kpi.value}</div>
            <div className="text-xs mt-1 font-semibold text-green-400">{kpi.delta} vs last week</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4">
        {/* Tasks Chart */}
        <div className="card p-5">
          <h3 className="text-sm font-bold text-white mb-4">Weekly Task Completion</h3>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={WEEKLY_DATA}>
              <defs>
                <linearGradient id="taskGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#7c3aed" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#7c3aed" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="day" tick={{ fill: '#475569', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#475569', fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={customTooltipStyle} />
              <Area type="monotone" dataKey="tasks" stroke="#8b5cf6" strokeWidth={2} fill="url(#taskGrad)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Efficiency Chart */}
        <div className="card p-5">
          <h3 className="text-sm font-bold text-white mb-4">Agent Efficiency Scores</h3>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={AGENT_PERF} barSize={28}>
              <XAxis dataKey="name" tick={{ fill: '#475569', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis domain={[80, 100]} tick={{ fill: '#475569', fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={customTooltipStyle} />
              <Bar dataKey="success" fill="#22d3ee" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Agent Performance Table */}
      <div className="card p-5">
        <h3 className="text-sm font-bold text-white mb-4">Agent Performance Breakdown</h3>
        <div className="space-y-3">
          {AGENT_PERF.map(agent => (
            <div key={agent.name} className="flex items-center gap-4">
              <span className="text-sm text-slate-400 w-24">{agent.name}</span>
              <div className="flex-1 progress-bar">
                <motion.div className="progress-fill"
                  initial={{ width: 0 }} animate={{ width: `${agent.success}%` }}
                  transition={{ duration: 1 }}
                  style={{ background: 'linear-gradient(90deg, #7c3aed60, #22d3ee)' }} />
              </div>
              <span className="text-xs font-bold text-white w-12 text-right">{agent.success}%</span>
              <span className="text-xs text-slate-600 w-16 text-right">{agent.tasks} tasks</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
