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
import ConnectorsPanel from '@/components/layout/ConnectorsPanel'
import SandboxPanel from '@/components/layout/SandboxPanel'
import { Zap } from 'lucide-react'

export default function HomePage() {
  const { activePanel, activeTaskId, theme } = useAgentStore()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    // Apply theme on mount
    document.documentElement.setAttribute('data-theme', theme)
  }, [])

  // Apply theme changes
  useEffect(() => {
    if (mounted) {
      document.documentElement.setAttribute('data-theme', theme)
    }
  }, [theme, mounted])

  // Connect WebSocket streams
  useAgentWebSocket(undefined)
  useAgentWebSocket(activeTaskId || undefined)

  if (!mounted) return (
    <div className="flex items-center justify-center h-screen" style={{ background: 'var(--bg-0)' }}>
      <div className="text-center">
        <div className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center"
          style={{ background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.25)' }}>
          <Zap size={28} className="text-indigo-400" />
        </div>
        <h2 className="text-lg font-bold mb-1" style={{ color: 'var(--text-primary)' }}>God Mode+</h2>
        <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>AI Operating System v3.0</p>
        <div className="flex gap-1.5 justify-center">
          {[0, 1, 2].map(i => (
            <div key={i} className="typing-dot" style={{ animationDelay: `${i * 0.16}s` }} />
          ))}
        </div>
      </div>
    </div>
  )

  const RightPanel = () => {
    switch (activePanel) {
      case 'timeline':   return <ExecutionTimeline />
      case 'tasks':      return <TasksPanel />
      case 'memory':     return <MemoryPanel />
      case 'connectors': return <ConnectorsPanel />
      case 'sandbox':    return <SandboxPanel />
      default:           return <ExecutionTimeline />
    }
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden" style={{ background: 'var(--bg-0)' }}>
      {/* Top Bar */}
      <TopBar />

      {/* Main 3-column layout (Manus-style) */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: Sidebar (chats, agents, panels) */}
        <Sidebar />

        {/* Center: Chat */}
        <div className="flex-1 min-w-0 border-r" style={{ borderColor: 'var(--border)' }}>
          <ChatPanel />
        </div>

        {/* Right: Timeline / Tasks / Memory / Connectors / Sandbox */}
        <div className="w-[400px] flex-shrink-0 hidden lg:block">
          <RightPanel />
        </div>
      </div>
    </div>
  )
}
