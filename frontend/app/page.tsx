'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Zap } from 'lucide-react'
import Sidebar from '@/components/shared/Sidebar'
import TopBar from '@/components/shared/TopBar'
import DashboardPage from '@/components/pages/DashboardPage'
import SpacesPage from '@/components/pages/SpacesPage'
import AgentsPage from '@/components/pages/AgentsPage'
import TasksPage from '@/components/pages/TasksPage'
import MemoryPage from '@/components/pages/MemoryPage'
import KnowledgePage from '@/components/pages/KnowledgePage'
import WorkflowsPage from '@/components/pages/WorkflowsPage'
import AnalyticsPage from '@/components/pages/AnalyticsPage'
import SettingsPage from '@/components/pages/SettingsPage'
import ConnectorsPage from '@/components/pages/ConnectorsPage'
import ChatMainPage from '@/components/pages/ChatMainPage'
import { useAppStore } from '@/store/useAppStore'

const PAGE_MAP: Record<string, React.ComponentType> = {
  chat: ChatMainPage,
  dashboard: DashboardPage,
  spaces: SpacesPage,
  agents: AgentsPage,
  tasks: TasksPage,
  memory: MemoryPage,
  knowledge: KnowledgePage,
  workflows: WorkflowsPage,
  analytics: AnalyticsPage,
  settings: SettingsPage,
  connectors: ConnectorsPage,
}

export default function GodAgentOS() {
  const { currentPage } = useAppStore()
  const [mounted, setMounted] = useState(false)
  const [loadingStep, setLoadingStep] = useState(0)

  const loadingSteps = [
    'Initializing God Core Space...',
    'Loading 22 worker spaces...',
    'Registering AI providers...',
    'Connecting model router...',
    'System Ready ✓',
  ]

  useEffect(() => {
    setMounted(true)
    const interval = setInterval(() => {
      setLoadingStep(prev => {
        if (prev >= loadingSteps.length - 1) {
          clearInterval(interval)
          return prev
        }
        return prev + 1
      })
    }, 350)
    return () => clearInterval(interval)
  }, [])

  if (!mounted) {
    return (
      <div className="flex items-center justify-center h-screen" style={{ background: '#05060d' }}>
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="text-center">
          <div className="relative w-20 h-20 mx-auto mb-6">
            <div className="absolute inset-0 rounded-2xl" style={{ background: 'linear-gradient(135deg, #7c3aed, #4f46e5)', filter: 'blur(12px)', opacity: 0.5 }} />
            <div className="relative w-full h-full rounded-2xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #7c3aed, #4f46e5)' }}>
              <Zap size={32} className="text-white" />
            </div>
          </div>
          <div className="text-2xl font-black text-white mb-1">GOD AGENT OS</div>
          <div className="text-sm text-slate-500 mb-1">General Autonomous Agent OS</div>
          <div className="text-xs text-violet-500 font-medium mb-6">22 Spaces · Gemini + SambaNova + GitHub · v10.0</div>
          <div className="space-y-1 mb-4">
            {loadingSteps.map((step, i) => (
              <div key={i} className={`text-xs transition-all duration-300 ${i <= loadingStep ? 'text-slate-400' : 'text-slate-700'}`}>
                {i < loadingStep ? '✓' : i === loadingStep ? '▶' : '○'} {step}
              </div>
            ))}
          </div>
          <div className="flex gap-2 justify-center">{[0, 1, 2].map(i => <div key={i} className="w-2 h-2 rounded-full bg-violet-500 animate-bounce" style={{ animationDelay: `${i * 0.2}s` }} />)}</div>
        </motion.div>
      </div>
    )
  }

  const PageComponent = PAGE_MAP[currentPage] || ChatMainPage
  return (
    <div className="flex h-screen overflow-hidden" style={{ background: '#05060d' }}>
      <Sidebar />
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <TopBar />
        <main className="flex-1 overflow-hidden">
          <AnimatePresence mode="wait">
            <motion.div key={currentPage} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }} className="h-full">
              <PageComponent />
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  )
}
