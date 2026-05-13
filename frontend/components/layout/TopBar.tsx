'use client'

import { useAgentStore } from '@/hooks/useAgentStore'
import { useEffect, useState } from 'react'
import { getHealth } from '@/lib/api'
import { Activity, Cpu, MemoryStick, Wifi, WifiOff, Github, ExternalLink } from 'lucide-react'

export default function TopBar() {
  const { wsConnected, backendHealth, setBackendHealth, sessionId } = useAgentStore()
  const [metrics, setMetrics] = useState<any>(null)

  useEffect(() => {
    const fetchHealth = async () => {
      const h = await getHealth()
      setBackendHealth(h)
    }
    fetchHealth()
    const interval = setInterval(fetchHealth, 30000)
    return () => clearInterval(interval)
  }, [])

  return (
    <header className="h-10 bg-[#0c0d12] border-b border-[#2a2b3d] flex items-center px-4 gap-4 flex-shrink-0">
      {/* Brand */}
      <div className="flex items-center gap-2">
        <div className="w-5 h-5 rounded bg-gradient-to-br from-brand-500 to-blue-500 flex items-center justify-center text-[9px] font-bold text-white">D</div>
        <span className="text-xs font-semibold text-slate-300 hidden sm:block">Devin Agent Platform</span>
        <span className="text-[10px] text-slate-600 hidden md:block">v2.0</span>
      </div>

      <div className="h-4 w-px bg-[#2a2b3d]" />

      {/* Backend Status */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5">
          {backendHealth ? (
            <div className="w-1.5 h-1.5 rounded-full bg-terminal-green animate-pulse" />
          ) : (
            <div className="w-1.5 h-1.5 rounded-full bg-red-400" />
          )}
          <span className={`text-[10px] ${backendHealth ? 'text-terminal-green' : 'text-red-400'}`}>
            {backendHealth ? 'API Online' : 'API Offline'}
          </span>
        </div>

        {/* WS Status */}
        <div className="flex items-center gap-1">
          {wsConnected
            ? <Wifi size={10} className="text-blue-400" />
            : <WifiOff size={10} className="text-slate-500" />
          }
          <span className={`text-[10px] ${wsConnected ? 'text-blue-400' : 'text-slate-500'}`}>
            {wsConnected ? 'WS Live' : 'WS Off'}
          </span>
        </div>

        {/* LLM status */}
        {backendHealth?.llm && (
          <div className="items-center gap-1 hidden md:flex">
            <div className={`w-1.5 h-1.5 rounded-full ${backendHealth.llm.openai || backendHealth.llm.anthropic ? 'bg-purple-400' : 'bg-slate-600'}`} />
            <span className={`text-[10px] ${backendHealth.llm.openai || backendHealth.llm.anthropic ? 'text-purple-400' : 'text-slate-500'}`}>
              {backendHealth.llm.openai ? 'GPT-4' : backendHealth.llm.anthropic ? 'Claude' : 'Demo Mode'}
            </span>
          </div>
        )}
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Session ID */}
      <div className="hidden lg:flex items-center gap-1.5 bg-[#1a1b26] px-2 py-1 rounded border border-[#2a2b3d]">
        <span className="text-[10px] text-slate-600">Session:</span>
        <span className="text-[10px] font-mono text-slate-400">{sessionId.slice(0, 14)}</span>
      </div>

      {/* GitHub */}
      {backendHealth?.github && (
        <div className="flex items-center gap-1 text-slate-400">
          <Github size={12} />
          <span className="text-[10px] text-terminal-green hidden sm:block">GitHub</span>
        </div>
      )}

      {/* Docs link */}
      <a
        href={`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:7860'}/api/docs`}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-1 text-slate-500 hover:text-slate-300 transition-colors"
        title="API Docs"
      >
        <ExternalLink size={11} />
        <span className="text-[10px] hidden sm:block">API</span>
      </a>
    </header>
  )
}
