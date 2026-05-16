'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { RefreshCw, Loader, Bot, Play, CheckCircle, XCircle } from 'lucide-react'
import { getAgents, runAgent } from '@/lib/api'
import { useAppStore } from '@/store/useAppStore'

interface AgentInfo {
  name: string
  available: boolean
  class: string | null
}

const AGENT_META: Record<string, { icon: string; desc: string; color: string; descMy: string }> = {
  chat:        { icon: '💬', desc: 'Conversation & clarification',   descMy: 'စကားပြော',            color: '#22d3ee' },
  planner:     { icon: '📋', desc: 'Task decomposition & planning',  descMy: 'အစီအစဥ်ချ',           color: '#a78bfa' },
  coding:      { icon: '⚡', desc: 'Production code generation',     descMy: 'Code ရေးရန်',          color: '#34d399' },
  debug:       { icon: '🐛', desc: 'Self-healing error resolution',  descMy: 'Error ဖြေရှင်း',      color: '#ef4444' },
  browser:     { icon: '🌐', desc: 'Web research & scraping',        descMy: 'Web ဆိုင်ရာ',          color: '#60a5fa' },
  file:        { icon: '📁', desc: 'File system & project scaffold', descMy: 'ဖိုင် စီမံ',           color: '#fbbf24' },
  git:         { icon: '🔀', desc: 'Git ops & GitHub PR creation',   descMy: 'Git လုပ်ဆောင်',        color: '#fb923c' },
  test:        { icon: '🧪', desc: 'Auto test generation',           descMy: 'Test ဖန်တီး',           color: '#84cc16' },
  vision:      { icon: '👁️', desc: 'Design-to-code UI generation',   descMy: 'UI ဒီဇိုင်း',         color: '#f472b6' },
  sandbox:     { icon: '🔧', desc: 'Isolated code execution',        descMy: 'Code run',             color: '#f59e0b' },
  deploy:      { icon: '🚀', desc: 'Auto-deploy to cloud',           descMy: 'Deploy လုပ်',          color: '#a855f7' },
  connector:   { icon: '🔌', desc: 'External integrations',          descMy: 'ချိတ်ဆက်',            color: '#06b6d4' },
  memory:      { icon: '💾', desc: 'Long-term context storage',      descMy: 'မှတ်ဉာဏ်',            color: '#818cf8' },
  workflow:    { icon: '⚙️', desc: 'n8n workflow automation',        descMy: 'Workflow',             color: '#c084fc' },
  reasoning:   { icon: '🧠', desc: 'Deep reasoning & analysis',      descMy: 'ခွဲခြမ်းစိတ်ဖြာ',    color: '#6366f1' },
  ui:          { icon: '🎨', desc: 'Real-time UI state management',  descMy: 'UI စီမံ',              color: '#f472b6' },
  orchestrator:{ icon: '🎭', desc: 'Central orchestrator (brain)',   descMy: 'ဦးဆောင်',             color: '#7c3aed' },
}

export default function AgentsPage() {
  const { locale, addComputerUseStep } = useAppStore()
  const [agents, setAgents] = useState<AgentInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [running, setRunning] = useState<string | null>(null)
  const [testResult, setTestResult] = useState<Record<string, string>>({})

  const load = async () => {
    setLoading(true)
    try {
      const data = await getAgents()
      setAgents(data.agents || [])
    } catch {
      // Show placeholder if backend offline
      setAgents(Object.keys(AGENT_META).filter(k => k !== 'orchestrator').map(name => ({
        name,
        available: false,
        class: null,
      })))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const testAgent = async (agentName: string) => {
    setRunning(agentName)
    addComputerUseStep({ type: 'executing', title: `Testing ${agentName} agent...`, status: 'running' })
    try {
      const result = await runAgent(agentName, 'Hello! Give me a one-sentence description of your capabilities.', 'test-session')
      setTestResult(prev => ({ ...prev, [agentName]: result.result?.slice(0, 150) || 'OK' }))
      addComputerUseStep({ type: 'complete', title: `${agentName} agent responded`, status: 'done' })
    } catch (e) {
      setTestResult(prev => ({ ...prev, [agentName]: `Error: ${(e as Error).message?.slice(0, 100)}` }))
      addComputerUseStep({ type: 'error', title: `${agentName} test failed`, status: 'error' })
    } finally {
      setRunning(null)
    }
  }

  const onlineCount = agents.filter(a => a.available).length

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <Bot size={20} style={{ color: 'var(--accent-bright)' }} />
            {locale === 'my' ? 'Agent များ (16)' : 'Agent Fleet (16)'}
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
            {locale === 'my'
              ? `${onlineCount}/16 online · Manus+Devin+Genspark combined`
              : `${onlineCount}/16 online · Manus + Devin + Genspark combined`}
          </p>
        </div>
        <button onClick={load} className="btn btn-secondary text-xs" disabled={loading}>
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
          {locale === 'my' ? 'ပြန်စစ်' : 'Refresh'}
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40">
          <Loader size={20} style={{ color: 'var(--accent)', animation: 'spin 1s linear infinite' }} />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {agents.map((agent, i) => {
            const meta = AGENT_META[agent.name] || { icon: '🤖', desc: agent.class || agent.name, color: '#7c3aed', descMy: agent.name }
            const result = testResult[agent.name]
            return (
              <motion.div
                key={agent.name}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                className="card p-4"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl"
                      style={{ background: `${meta.color}12`, border: `1px solid ${meta.color}20` }}>
                      {meta.icon}
                    </div>
                    <div>
                      <div className="font-semibold text-sm text-white capitalize">{agent.name}</div>
                      <div className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
                        {locale === 'my' ? meta.descMy : meta.desc}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {agent.available ? (
                      <CheckCircle size={14} style={{ color: '#22c55e' }} />
                    ) : (
                      <XCircle size={14} style={{ color: '#f87171' }} />
                    )}
                  </div>
                </div>

                {result && (
                  <div className="text-[11px] p-2 rounded-lg mb-3 leading-relaxed"
                    style={{ background: 'var(--surface-3)', color: result.startsWith('Error') ? '#f87171' : '#86efac' }}>
                    {result}
                  </div>
                )}

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <div className={`w-1.5 h-1.5 rounded-full ${agent.available ? 'bg-green-400 animate-pulse' : 'bg-slate-600'}`} />
                    <span className="text-[10px]" style={{ color: agent.available ? '#4ade80' : 'var(--text-muted)' }}>
                      {agent.available ? (locale === 'my' ? 'Online' : 'Online') : (locale === 'my' ? 'Offline' : 'Offline')}
                    </span>
                  </div>
                  <button
                    onClick={() => testAgent(agent.name)}
                    disabled={!agent.available || running === agent.name}
                    className="btn btn-secondary text-[11px] py-1 px-2.5 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {running === agent.name ? (
                      <><Loader size={10} style={{ animation: 'spin 1s linear infinite' }} /> Testing...</>
                    ) : (
                      <><Play size={10} /> {locale === 'my' ? 'စမ်းသပ်' : 'Test'}</>
                    )}
                  </button>
                </div>
              </motion.div>
            )
          })}
        </div>
      )}
    </div>
  )
}
