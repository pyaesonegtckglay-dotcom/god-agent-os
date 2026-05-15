'use client'

import { useEffect, useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Zap, Send, ChevronRight, Activity, Globe, Terminal, 
  Code2, Eye, Bug, Rocket, MessageSquare, Brain,
  Cpu, MemoryStick, Wifi, ArrowRight
} from 'lucide-react'
import { useAppStore } from '@/store/useAppStore'
import { createWebSocket } from '@/lib/api'

const SPACES_CONFIG = [
  { id: 'core',          name: 'Core Space',          icon: '🧠', color: '#7c3aed', desc: 'Planning & Orchestration',    role: 'cognition' },
  { id: 'browser',       name: 'Browser Space',       icon: '🌐', color: '#2563eb', desc: 'Web Research & Navigation',   role: 'automation' },
  { id: 'sandbox',       name: 'Sandbox Space',       icon: '💻', color: '#059669', desc: 'Code Execution & Testing',    role: 'execution' },
  { id: 'coding',        name: 'Coding Space',        icon: '🔧', color: '#d97706', desc: 'Code Generation & Review',    role: 'execution' },
  { id: 'vision',        name: 'Vision Space',        icon: '👁️', color: '#db2777', desc: 'UI Design & Image Analysis',  role: 'visual_intelligence' },
  { id: 'debug',         name: 'Debug Space',         icon: '🐛', color: '#dc2626', desc: 'Error Analysis & Self-Heal',  role: 'repair' },
  { id: 'deploy',        name: 'Deploy Space',        icon: '🚀', color: '#0891b2', desc: 'Cloud Deploy & CI/CD',        role: 'automation' },
  { id: 'communication', name: 'Comm Space',          icon: '💬', color: '#8b5cf6', desc: 'Messaging & Documentation',   role: 'automation' },
]

const ROLES_CONFIG = [
  { id: 'cognition',          name: 'Cognition',          icon: '🧠', desc: 'The Thinker — Plans & Analyzes' },
  { id: 'automation',         name: 'Automation',         icon: '⚙️', desc: 'The Operator — Executes Workflows' },
  { id: 'execution',          name: 'Execution',          icon: '⚡', desc: 'The Doer — Writes & Runs Code' },
  { id: 'repair',             name: 'Repair',             icon: '🔧', desc: 'The Fixer — Heals Errors' },
  { id: 'visual_intelligence',name: 'Visual Intel',       icon: '👁️', desc: 'The Observer — Sees & Creates UI' },
]

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  space?: string
  agentRole?: string
  timestamp: number
}

export default function DashboardPage() {
  const { activeSpace, currentRole, activateSpace, deactivateSpace, spaces } = useAppStore()
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: '🧠 **GOD AGENT OS v9** is online!\n\nSpace-Role Architecture active. I can handle ANY digital task:\n\n- 🌐 **Browser** — Web research & data extraction\n- 💻 **Sandbox** — Code execution\n- 🔧 **Coding** — Generate any code\n- 👁️ **Vision** — UI design & image analysis\n- 🐛 **Debug** — Error analysis & self-healing\n- 🚀 **Deploy** — Cloud deployments\n- 💬 **Comm** — Documentation & messaging\n\nWhat do you need?',
      timestamp: Date.now(),
    }
  ])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [sessionId] = useState(() => `session_${Date.now()}`)
  const [wsStatus, setWsStatus] = useState<'connecting' | 'connected' | 'disconnected'>('disconnected')
  const [activeSpaceIndicator, setActiveSpaceIndicator] = useState<string | null>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    connectWS()
    return () => wsRef.current?.close()
  }, [sessionId])

  function connectWS() {
    try {
      const ws = createWebSocket(`/ws/chat/${sessionId}`)
      wsRef.current = ws
      setWsStatus('connecting')

      ws.onopen = () => {
        setWsStatus('connected')
        ws.send(JSON.stringify({ type: 'ping' }))
      }

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data)
          
          if (msg.type === 'space_activated') {
            setActiveSpaceIndicator(msg.space)
            activateSpace(msg.space as any, msg.role)
          }
          
          if (msg.type === 'chat_response' || msg.type === 'agent_response') {
            const content = msg.content || msg.message || msg.data?.content || ''
            if (content) {
              setMessages(prev => {
                const last = prev[prev.length - 1]
                if (last?.role === 'assistant' && last.id.startsWith('stream_')) {
                  return [...prev.slice(0, -1), { ...last, content }]
                }
                return [...prev, {
                  id: `msg_${Date.now()}`,
                  role: 'assistant',
                  content,
                  space: msg.space,
                  agentRole: msg.role,
                  timestamp: Date.now(),
                }]
              })
              setIsLoading(false)
            }
          }
          
          if (msg.type === 'kernel_status') {
            // Kernel is thinking
          }
          
        } catch (e) {}
      }

      ws.onclose = () => {
        setWsStatus('disconnected')
        setTimeout(connectWS, 3000)
      }

      ws.onerror = () => setWsStatus('disconnected')
    } catch (e) {}
  }

  async function sendMessage() {
    if (!input.trim() || isLoading) return
    const userMsg = input.trim()
    setInput('')
    setIsLoading(true)

    setMessages(prev => [...prev, {
      id: `user_${Date.now()}`,
      role: 'user',
      content: userMsg,
      timestamp: Date.now(),
    }])

    // Send via WebSocket
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'chat_message',
        content: userMsg,
        session_id: sessionId,
      }))
      
      // Fallback: if no WS response in 15s, try REST
      setTimeout(async () => {
        setIsLoading(prev => {
          if (prev) {
            // Still loading, try REST
            fetchREST(userMsg)
          }
          return prev
        })
      }, 15000)
    } else {
      // REST fallback
      await fetchREST(userMsg)
    }
  }

  async function fetchREST(userMsg: string) {
    try {
      const res = await fetch('/api/v1/kernel/orchestrate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMsg, session_id: sessionId }),
      }).catch(() => null)
      
      if (res?.ok) {
        const data = await res.json()
        if (data.result) {
          setMessages(prev => [...prev, {
            id: `assistant_${Date.now()}`,
            role: 'assistant',
            content: data.result,
            timestamp: Date.now(),
          }])
        }
      } else {
        // Local fallback
        setMessages(prev => [...prev, {
          id: `assistant_${Date.now()}`,
          role: 'assistant',
          content: `I'm processing your request: "${userMsg}"\n\n⚠️ Backend connection in progress. The Space-Role system is initializing.`,
          timestamp: Date.now(),
        }])
      }
    } catch (e) {
      setMessages(prev => [...prev, {
        id: `err_${Date.now()}`,
        role: 'assistant',
        content: '⚠️ Connection issue. Please ensure the backend is running.',
        timestamp: Date.now(),
      }])
    }
    setIsLoading(false)
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const statusColor = wsStatus === 'connected' ? '#22c55e' : wsStatus === 'connecting' ? '#f59e0b' : '#ef4444'

  return (
    <div className="flex h-full" style={{ background: '#05060d' }}>
      
      {/* Left: Chat Panel */}
      <div className="flex flex-col flex-1 min-w-0">
        
        {/* Space Status Bar */}
        <div className="h-8 flex items-center gap-2 px-3 border-b overflow-x-auto"
          style={{ borderColor: '#1a1b2e', background: '#07080f' }}>
          {SPACES_CONFIG.map(s => {
            const spaceState = spaces[s.id as keyof typeof spaces]
            const isActive = spaceState?.active
            return (
              <div key={s.id}
                className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] whitespace-nowrap transition-all"
                style={{
                  background: isActive ? `${s.color}15` : 'transparent',
                  color: isActive ? s.color : '#374151',
                  border: `1px solid ${isActive ? s.color + '30' : 'transparent'}`,
                }}>
                <span>{s.icon}</span>
                <span className="font-medium">{s.id}</span>
                {isActive && <span className="w-1 h-1 rounded-full animate-pulse" style={{ background: s.color }} />}
              </div>
            )
          })}
          <div className="ml-auto flex items-center gap-1 text-[10px]">
            <div className="w-1.5 h-1.5 rounded-full" style={{ background: statusColor }} />
            <span style={{ color: statusColor }}>{wsStatus}</span>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <AnimatePresence initial={false}>
            {messages.map(msg => (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
                className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}
              >
                {/* Avatar */}
                <div className={`w-7 h-7 rounded-lg flex-shrink-0 flex items-center justify-center text-sm ${
                  msg.role === 'user' 
                    ? 'bg-indigo-600' 
                    : 'bg-gradient-to-br from-violet-600 to-indigo-600'
                }`}>
                  {msg.role === 'user' ? '👤' : '🤖'}
                </div>
                
                {/* Bubble */}
                <div className={`max-w-[75%] ${msg.role === 'user' ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
                  {msg.space && (
                    <div className="text-[9px] text-slate-600 px-1">
                      {SPACES_CONFIG.find(s => s.id === msg.space)?.icon} {msg.space?.toUpperCase()} SPACE · {msg.agentRole?.replace('_', ' ')}
                    </div>
                  )}
                  <div className={`px-3 py-2 rounded-2xl text-sm leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-indigo-600 text-white rounded-tr-sm'
                      : 'text-slate-200 rounded-tl-sm'
                  }`}
                  style={msg.role === 'assistant' ? { background: '#111827', border: '1px solid #1f2937' } : {}}>
                    <div className="whitespace-pre-wrap"
                      dangerouslySetInnerHTML={{ 
                        __html: msg.content
                          .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                          .replace(/```(\w+)?\n?([\s\S]*?)```/g, '<pre class="bg-black/50 p-2 rounded mt-1 overflow-x-auto text-xs"><code>$2</code></pre>')
                          .replace(/`(.*?)`/g, '<code class="bg-black/30 px-1 rounded text-xs">$1</code>')
                      }}
                    />
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
          
          {isLoading && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex gap-3 items-start"
            >
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center text-sm">🤖</div>
              <div className="px-3 py-2 rounded-2xl rounded-tl-sm" style={{ background: '#111827', border: '1px solid #1f2937' }}>
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <div className="flex gap-1">
                    {[0,1,2].map(i => (
                      <div key={i} className="w-1.5 h-1.5 rounded-full bg-violet-500 animate-bounce"
                        style={{ animationDelay: `${i * 0.15}s` }} />
                    ))}
                  </div>
                  {activeSpaceIndicator 
                    ? `${SPACES_CONFIG.find(s => s.id === activeSpaceIndicator)?.icon} ${activeSpaceIndicator} Space processing...`
                    : 'Agent Kernel analyzing...'
                  }
                </div>
              </div>
            </motion.div>
          )}
          
          <div ref={messagesEndRef} />
        </div>

        {/* Quick Prompts */}
        <div className="px-3 pb-2 flex gap-2 overflow-x-auto">
          {[
            { text: '🌐 Search latest AI trends', space: 'browser' },
            { text: '🔧 Write a Python API', space: 'coding' },
            { text: '💻 Run: print("Hello")', space: 'sandbox' },
            { text: '🚀 Generate Dockerfile', space: 'deploy' },
            { text: '🐛 Debug my error', space: 'debug' },
            { text: '👁️ Create React UI', space: 'vision' },
          ].map((prompt, i) => (
            <button key={i}
              onClick={() => { setInput(prompt.text); inputRef.current?.focus() }}
              className="flex-shrink-0 px-3 py-1.5 rounded-full text-xs text-slate-400 hover:text-slate-200 whitespace-nowrap transition-all"
              style={{ background: '#0d0e1a', border: '1px solid #1e2035' }}>
              {prompt.text}
            </button>
          ))}
        </div>

        {/* Input */}
        <div className="px-3 pb-3">
          <div className="flex gap-2 p-2 rounded-xl" style={{ background: '#0d0e1a', border: '1px solid #1e2035' }}>
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask anything — I'll route to the right Space automatically..."
              rows={1}
              className="flex-1 bg-transparent text-sm text-slate-200 placeholder-slate-600 resize-none outline-none leading-relaxed"
              style={{ maxHeight: '120px' }}
            />
            <button
              onClick={sendMessage}
              disabled={!input.trim() || isLoading}
              className="p-2 rounded-lg transition-all disabled:opacity-40 flex-shrink-0"
              style={{ background: 'linear-gradient(135deg, #7c3aed, #4f46e5)' }}>
              <Send size={14} className="text-white" />
            </button>
          </div>
          <div className="text-[9px] text-slate-700 text-center mt-1">
            Press Enter to send · Shift+Enter for new line · Powered by Pyae Sone
          </div>
        </div>
      </div>

      {/* Right: Space-Role Panel */}
      <div className="w-64 border-l flex-shrink-0 flex flex-col overflow-y-auto"
        style={{ borderColor: '#1a1b2e', background: '#07080f' }}>
        
        {/* Spaces Grid */}
        <div className="p-3 border-b" style={{ borderColor: '#1a1b2e' }}>
          <div className="text-[10px] text-slate-600 font-bold uppercase tracking-widest mb-2">Spaces</div>
          <div className="grid grid-cols-2 gap-1.5">
            {SPACES_CONFIG.map(s => {
              const spaceState = spaces[s.id as keyof typeof spaces]
              const isActive = spaceState?.active
              return (
                <div key={s.id}
                  className="p-2 rounded-lg transition-all cursor-pointer"
                  style={{
                    background: isActive ? `${s.color}10` : 'rgba(255,255,255,0.03)',
                    border: `1px solid ${isActive ? s.color + '40' : '#1e2035'}`,
                  }}>
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-base">{s.icon}</span>
                    {isActive && (
                      <div className="w-1.5 h-1.5 rounded-full animate-pulse"
                        style={{ background: s.color }} />
                    )}
                  </div>
                  <div className="text-[10px] font-semibold" style={{ color: isActive ? s.color : '#475569' }}>
                    {s.name.split(' ')[0]}
                  </div>
                  <div className="text-[8px] text-slate-600 mt-0.5">{s.desc}</div>
                  {spaceState?.taskCount > 0 && (
                    <div className="text-[8px] mt-0.5" style={{ color: s.color }}>
                      {spaceState.taskCount} tasks
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Roles */}
        <div className="p-3 border-b" style={{ borderColor: '#1a1b2e' }}>
          <div className="text-[10px] text-slate-600 font-bold uppercase tracking-widest mb-2">Roles</div>
          <div className="space-y-1">
            {ROLES_CONFIG.map(r => (
              <div key={r.id}
                className="flex items-center gap-2 p-1.5 rounded-lg transition-all"
                style={{
                  background: currentRole === r.id ? 'rgba(139,92,246,0.1)' : 'transparent',
                  border: `1px solid ${currentRole === r.id ? 'rgba(139,92,246,0.3)' : 'transparent'}`,
                }}>
                <span className="text-sm">{r.icon}</span>
                <div>
                  <div className="text-[10px] font-semibold" style={{ color: currentRole === r.id ? '#a78bfa' : '#475569' }}>
                    {r.name}
                  </div>
                  <div className="text-[8px] text-slate-600">{r.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* System Status */}
        <div className="p-3">
          <div className="text-[10px] text-slate-600 font-bold uppercase tracking-widest mb-2">System</div>
          <div className="space-y-1.5">
            {[
              { label: 'Agent Kernel', status: 'operational', color: '#22c55e' },
              { label: 'AI Router', status: 'active', color: '#22c55e' },
              { label: 'Memory', status: 'ready', color: '#22c55e' },
              { label: 'WebSocket', status: wsStatus, color: statusColor },
            ].map(item => (
              <div key={item.label} className="flex items-center justify-between">
                <span className="text-[10px] text-slate-500">{item.label}</span>
                <div className="flex items-center gap-1">
                  <div className="w-1.5 h-1.5 rounded-full" style={{ background: item.color }} />
                  <span className="text-[9px]" style={{ color: item.color }}>{item.status}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
