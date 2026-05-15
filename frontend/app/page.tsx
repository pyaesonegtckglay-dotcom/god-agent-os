'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Zap } from 'lucide-react'
import Sidebar from '@/components/shared/Sidebar'
import TopBar from '@/components/shared/TopBar'
import DashboardPage from '@/components/pages/DashboardPage'
import AgentsPage from '@/components/pages/AgentsPage'
import TasksPage from '@/components/pages/TasksPage'
import MemoryPage from '@/components/pages/MemoryPage'
import KnowledgePage from '@/components/pages/KnowledgePage'
import WorkflowsPage from '@/components/pages/WorkflowsPage'
import AnalyticsPage from '@/components/pages/AnalyticsPage'
import SettingsPage from '@/components/pages/SettingsPage'
import { useAppStore } from '@/store/useAppStore'

const PAGE_MAP = {
  dashboard:  DashboardPage,
  agents:     AgentsPage,
  tasks:      TasksPage,
  memory:     MemoryPage,
  knowledge:  KnowledgePage,
  workflows:  WorkflowsPage,
  analytics:  AnalyticsPage,
  settings:   SettingsPage,
}

export default function GodAgentOS() {
  const { currentPage } = useAppStore()
  const [mounted, setMounted] = useState(false)

  useEffect(() => { setMounted(true) }, [])

  if (!mounted) return (
    <div className="flex items-center justify-center h-screen" style={{ background: '#05060d' }}>
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="text-center"
      >
        <div className="w-16 h-16 rounded-2xl mx-auto mb-5 flex items-center justify-center glow-purple"
          style={{ background: 'linear-gradient(135deg, #7c3aed, #4f46e5)' }}>
          <Zap size={28} className="text-white" />
        </div>
        <div className="shimmer-text text-xl font-black mb-2">GOD AGENT OS</div>
        <div className="text-sm text-slate-600 mb-1">Autonomous AI Operating System</div>
        <div className="text-xs text-slate-700">Gemini · Sambanova · GitHub Models</div>
        <div className="flex gap-2 justify-center mt-6">
          {[0, 1, 2].map(i => (
            <div key={i} className="typing-dot" style={{ animationDelay: `${i * 0.2}s` }} />
          ))}
        </div>
      </motion.div>
    </div>
  )

  const PageComponent = PAGE_MAP[currentPage]

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: '#05060d' }}>
      <Sidebar />
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <TopBar />
        <main className="flex-1 overflow-hidden">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentPage}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
              className="h-full"
            >
              <PageComponent />
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  )
}
