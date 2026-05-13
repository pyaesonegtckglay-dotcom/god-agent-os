'use client'

import { useEffect, useState } from 'react'
import { useAgentStore } from '@/hooks/useAgentStore'
import { useAgentWebSocket } from '@/hooks/useWebSocket'
import TopBar from '@/components/layout/TopBar'
import Sidebar from '@/components/layout/Sidebar'
import ChatPanel from '@/components/chat/ChatPanel'
import ExecutionTimeline from '@/components/timeline/ExecutionTimeline'
import TasksPanel from '@/components/layout/TasksPanel'
import MemoryPanel from '@/components/layout/MemoryPanel'

export default function HomePage() {
  const { activePanel, activeTaskId } = useAgentStore()
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  // Connect to global log stream + active task stream
  useAgentWebSocket(undefined)
  useAgentWebSocket(activeTaskId || undefined)

  if (!mounted) return (
    <div className="flex items-center justify-center h-screen bg-[#0f1017]">
      <div className="text-center">
        <div className="text-4xl mb-4">🤖</div>
        <div className="text-slate-400 text-sm">Loading Devin Agent...</div>
        <div className="flex gap-1 justify-center mt-3">
          {[0,1,2].map(i => <div key={i} className="typing-dot" style={{animationDelay:`${i*0.2}s`}} />)}
        </div>
      </div>
    </div>
  )

  const RightPanel = () => {
    switch (activePanel) {
      case 'timeline': return <ExecutionTimeline />
      case 'tasks':    return <TasksPanel />
      case 'memory':   return <MemoryPanel />
      default:         return <ExecutionTimeline />
    }
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-[#0f1017]">
      {/* Top bar */}
      <TopBar />

      {/* Main layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left sidebar */}
        <Sidebar />

        {/* Center: Chat */}
        <div className="flex-1 min-w-0 border-r border-[#2a2b3d]">
          <ChatPanel />
        </div>

        {/* Right: Timeline / Tasks / Memory */}
        <div className="w-[420px] flex-shrink-0 hidden lg:block">
          <RightPanel />
        </div>
      </div>
    </div>
  )
}
