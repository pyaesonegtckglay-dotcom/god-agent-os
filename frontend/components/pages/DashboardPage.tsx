'use client'

import { motion } from 'framer-motion'
import { Bot, CheckSquare, Clock, TrendingUp, ChevronRight } from 'lucide-react'
import MetricCard from '@/components/dashboard/MetricCard'
import AgentFleetCard from '@/components/dashboard/AgentFleetCard'
import ActivityFeed from '@/components/dashboard/ActivityFeed'
import SystemResources from '@/components/dashboard/SystemResources'
import MissionInput from '@/components/dashboard/MissionInput'
import GodModeCard from '@/components/dashboard/GodModeCard'
import { useAppStore, AGENTS } from '@/store/useAppStore'
import CommandCenter from '@/components/dashboard/CommandCenter'

const METRICS = [
  { label: 'Total Agents', value: 12, trend: '+2 this week', trendUp: true, icon: <Bot size={18} />, iconColor: '#6366f1' },
  { label: 'Tasks Completed', value: 247, trend: '+37% this week', trendUp: true, icon: <CheckSquare size={18} />, iconColor: '#22c55e' },
  { label: 'Time Saved', value: 128, unit: 'h', trend: '+55% this week', trendUp: true, icon: <Clock size={18} />, iconColor: '#22d3ee' },
  { label: 'Success Rate', value: '98.6', unit: '%', trend: '1.2% this week', trendUp: true, icon: <TrendingUp size={18} />, iconColor: '#a78bfa' },
]

export default function DashboardPage() {
  const { setCurrentPage } = useAppStore()
  const featuredAgents = AGENTS.slice(0, 6)

  return (
    <div className="h-full overflow-y-auto">
      <div className="flex h-full">
        {/* Main content */}
        <div className="flex-1 min-w-0 p-6 overflow-y-auto">

          {/* Welcome Header */}
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
            <h1 className="text-2xl font-bold text-white">
              Welcome back, <span className="gradient-text-purple">Creator.</span>
            </h1>
            <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
              Where Intelligence, Autonomy and Execution become{' '}
              <span className="gradient-text font-semibold">Divine.</span>
            </p>
          </motion.div>

          {/* Metrics Row */}
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
            {METRICS.map((m, i) => (
              <MetricCard key={m.label} {...m} delay={i * 0.06} />
            ))}
          </div>

          {/* Mission Input */}
          <div className="mb-6">
            <MissionInput />
          </div>

          {/* Agent Fleet */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-sm font-bold text-white">Agent Fleet</h2>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>Manage your autonomous workforce</p>
              </div>
              <button onClick={() => setCurrentPage('agents')}
                className="flex items-center gap-1 text-xs font-medium text-purple-400 hover:text-purple-300 transition-colors">
                View all agents <ChevronRight size={13} />
              </button>
            </div>
            <div className="grid grid-cols-2 xl:grid-cols-3 gap-3">
              {featuredAgents.map((agent, i) => (
                <AgentFleetCard key={agent.id} agent={agent} delay={0.1 + i * 0.05}
                  onClick={() => setCurrentPage('agents')} />
              ))}
            </div>
          </div>

          {/* Command Center */}
          <CommandCenter />
        </div>

        {/* Right Panel */}
        <div className="w-72 xl:w-80 flex-shrink-0 border-l p-4 space-y-4 overflow-y-auto hide-lg"
          style={{ borderColor: 'var(--border)' }}>

          <GodModeCard />

          {/* Recent Activity */}
          <div className="card p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-white">Recent Activity</h3>
              <button className="text-xs text-purple-400 hover:text-purple-300 transition-colors">View all</button>
            </div>
            <ActivityFeed max={5} />
          </div>

          {/* System Resources */}
          <div className="card p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-white">System Resources</h3>
              <button className="text-xs text-purple-400 hover:text-purple-300 transition-colors">Details</button>
            </div>
            <SystemResources />
          </div>

          {/* Branding Footer */}
          <div className="px-1 py-2 text-center">
            <div className="text-xs font-bold text-slate-600 mb-0.5">manus + genspark</div>
            <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
              Human Creativity × AI Capability = Divine Impact
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
