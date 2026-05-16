'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Plus,
  Search,
  Send,
  Brain,
  Globe,
  Terminal,
  Code2,
  Eye,
  Bug,
  Rocket,
  MessageSquare,
  Loader2,
  RefreshCw,
} from 'lucide-react'
import { useAppStore } from '@/store/useAppStore'
import { createWebSocket, getSessions, getSessionHistory, orchestrate } from '@/lib/api'

const SPACES_CONFIG = [
  { id: 'core',          name: 'Core Space',    icon: '🧠', color: '#7c3aed', desc: 'Planning & orchestration', role: 'cognition' },
  { id: 'browser',       name: 'Browser Space', icon: '🌐', color: '#2563eb', desc: 'Research & extraction', role: 'automation' },
  { id: 'sandbox',       name: 'Sandbox Space', icon: '💻', color: '#059669', desc: 'Execution & testing', role: 'execution' },
  { id: 'coding',        name: 'Coding Space',  icon: '🔧', color: '#d97706', desc: 'Code generation', role: 'execution' },
  { id: 'vision',        name: 'Vision Space',  icon: '👁️', color: '#db2777', desc: 'UI & image understanding', role: 'visual_intelligence' },
  { id: 'debug',         name: 'Debug Space',   icon: '🐛', color: '#dc2626', desc: 'Repair & diagnostics', role: 'repair' },
  { id: 'deploy',        name: 'Deploy Space',  icon: '🚀', color: '#0891b2', desc: 'Deployment workflows', role: 'automation' },
  { id: 'communication', name: 'Comm Space',    icon: '💬', color: '#8b5cf6', desc: 'Docs & messaging', role: 'automation' },
] as const

const QUICK_ACTIONS = [
  { text: 'Search latest AI trends', icon: Globe, color: '#2563eb' },
  { text: 'Write a production FastAPI service', icon: Code2, color: '#d97706' },
  { text: 'Run a Python hello-world example', icon: Terminal, color: '#059669' },
  { text: 'Debug a deployment error log', icon: Bug, color: '#dc2626' },
  { text: 'Generate a modern React dashboard UI', icon: Eye, color: '#db2777' },
  { text: 'Prepare a deployment plan for Hugging Face and Vercel', icon: Rocket, color: '#0891b2' },
]

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  space?: string
  agentRole?: string
  timestamp: number
}

interface SessionSummary {
  id: string
  title: string
  lastActive: number
}

const welcomeMessage: Message = {
  id: 'welcome',
  role: 'assistant',
  content:
    'GOD AGENT OS v9.0.1 is ready.\\n\\nI can route work across Core, Browser, Sandbox, Coding, Vision, Debug, Deploy, and Communication spaces. Start a new request or use any quick action below.',
  timestamp: Date.now(),
}

function emitNotification(title: string, description: string) {
  if (typeof window === 'undefined') return
  window.dispatchEvent(
    new CustomEvent('god-agent-notification', {
      detail: {
        id: `notif_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        title,
        description,
        timestamp: Date.now(),
      },
    }),
  )
}

function formatRelativeTime(timestamp?: number) {
  if (!timestamp) return 'Just now'
  const diff = Date.now() - timestamp
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

function toSessionTitle(text?: string) {
  return (text || 'New chat').replace(/\s+/g, ' ').trim().slice(0, 50) || 'New chat'
}

export default function DashboardPage() {
  const { activeSpace, currentRole, activateSpace, spaces } = useAppStore()

  const [sessions, setSessions] = useState<SessionSummary[]>([])
  const [sessionSearch, setSessionSearch] = useState('')
  const [currentSessionId, setCurrentSessionId] = useState('')
  const [messages, setMessages] = useState<Message[]>([welcomeMessage])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [wsStatus, setWsStatus] = useState<'connecting' | 'connected' | 'disconnected'>('disconnected')
  const [activeSpaceIndicator, setActiveSpaceIndicator] = useState<string | null>(null)

  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const filteredSessions = useMemo(() => {
    const q = sessionSearch.trim().toLowerCase()
    if (!q) return sessions
    return sessions.filter((session) => session.title.toLowerCase().includes(q))
  }, [sessionSearch, sessions])

  const refreshSessions = useCallback(async (preferredSessionId?: string) => {
    try {
      const data = await getSessions()
      const next = (data.sessions || []).map((session: any) => ({
        id: session.id,
        title: session.title || toSessionTitle(session.metadata?.title || session.id),
        lastActive: session.last_active || session.created_at || Date.now(),
      }))

      setSessions(next)

      if (!currentSessionId && next[0]?.id) {
        setCurrentSessionId(preferredSessionId || next[0].id)
      }
    } catch {
      // Ignore and keep current local state
    }
  }, [currentSessionId])

  const startNewChat = useCallback(() => {
    const sessionId = `session_${Date.now()}`
    setCurrentSessionId(sessionId)
    setMessages([welcomeMessage])
    setInput('')
    setIsLoading(false)
    setActiveSpaceIndicator(null)
    setSessions((prev) => [{ id: sessionId, title: 'New chat', lastActive: Date.now() }, ...prev.filter((item) => item.id !== sessionId)])
    emitNotification('New chat created', 'A fresh session is ready for a new task.')
    requestAnimationFrame(() => inputRef.current?.focus())
  }, [])

  const loadSession = useCallback(async (sessionId: string) => {
    setCurrentSessionId(sessionId)
    setLoadingHistory(true)

    try {
      const data = await getSessionHistory(sessionId)
      const history = (data.history || []).map((item: any, index: number) => ({
        id: `${item.id || `${sessionId}_${index}`}`,
        role: (item.metadata?.role || item.key || 'assistant') === 'user' ? 'user' : 'assistant',
        content: item.content,
        space: item.metadata?.space,
        agentRole: item.metadata?.agent_role,
        timestamp: item.created_at ? item.created_at * 1000 : Date.now(),
      }))

      setMessages(history.length > 0 ? history : [welcomeMessage])
    } catch {
      setMessages([welcomeMessage])
    } finally {
      setLoadingHistory(false)
    }
  }, [])

  useEffect(() => {
    refreshSessions()
  }, [refreshSessions])

  useEffect(() => {
    if (!currentSessionId) return
    loadSession(currentSessionId)
  }, [currentSessionId, loadSession])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isLoading])

  useEffect(() => {
    if (!currentSessionId) return

    const connectWS = () => {
      try {
        const ws = createWebSocket(`/ws/chat/${currentSessionId}`)
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
              activateSpace(msg.space, msg.role)
              emitNotification('Space activated', `${msg.space} space is handling the current task.`)
            }

            if (msg.type === 'kernel_status') {
              setIsLoading(true)
            }

            if (msg.type === 'chat_response') {
              const content = msg.content || msg.message || msg.data?.content || ''
              if (!content) return

              setMessages((prev) => {
                const last = prev[prev.length - 1]
                if (last?.role === 'assistant' && last.content === content) return prev
                return [
                  ...prev,
                  {
                    id: `assistant_${Date.now()}`,
                    role: 'assistant',
                    content,
                    space: msg.space,
                    agentRole: msg.role,
                    timestamp: Date.now(),
                  },
                ]
              })

              setIsLoading(false)
              setActiveSpaceIndicator(msg.space || null)
              emitNotification('Response ready', 'The agent finished the latest request.')
              refreshSessions(currentSessionId)
            }
          } catch {
            // Ignore malformed events
          }
        }

        ws.onclose = () => {
          setWsStatus('disconnected')
          reconnectTimerRef.current = setTimeout(connectWS, 2500)
        }

        ws.onerror = () => {
          setWsStatus('disconnected')
          ws.close()
        }
      } catch {
        setWsStatus('disconnected')
      }
    }

    connectWS()
    return () => {
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current)
      wsRef.current?.close()
    }
  }, [currentSessionId, activateSpace, refreshSessions])

  const upsertLocalSession = useCallback((sessionId: string, title: string) => {
    setSessions((prev) => {
      const existing = prev.find((item) => item.id === sessionId)
      const nextItem = { id: sessionId, title: toSessionTitle(title), lastActive: Date.now() }
      if (!existing) return [nextItem, ...prev]
      return [nextItem, ...prev.filter((item) => item.id !== sessionId)]
    })
  }, [])

  const sendPreparedMessage = useCallback(async (text: string) => {
    if (!currentSessionId) startNewChat()
    if (!text.trim() || isLoading) return

    const targetSessionId = currentSessionId || `session_${Date.now()}`
    if (!currentSessionId) setCurrentSessionId(targetSessionId)

    const userMessage: Message = {
      id: `user_${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: Date.now(),
    }

    setMessages((prev) => [...prev.filter((m) => m.id !== 'welcome' || prev.length === 1), userMessage])
    setInput('')
    setIsLoading(true)
    upsertLocalSession(targetSessionId, text)

    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'chat_message',
        content: text,
        session_id: targetSessionId,
      }))
      return
    }

    try {
      const data = await orchestrate(text, targetSessionId)
      if (data.result) {
        setMessages((prev) => [
          ...prev,
          {
            id: `assistant_${Date.now()}`,
            role: 'assistant',
            content: data.result,
            timestamp: Date.now(),
          },
        ])
        emitNotification('Response ready', 'The agent answered through REST fallback.')
      }
    } catch (error: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: `assistant_error_${Date.now()}`,
          role: 'assistant',
          content: `Connection problem: ${error?.message || 'Unable to reach backend.'}`,
          timestamp: Date.now(),
        },
      ])
      emitNotification('Connection issue', 'Backend fallback request failed.')
    } finally {
      setIsLoading(false)
      refreshSessions(targetSessionId)
    }
  }, [currentSessionId, isLoading, refreshSessions, startNewChat, upsertLocalSession])

  const handleSend = useCallback(async () => {
    await sendPreparedMessage(input.trim())
  }, [input, sendPreparedMessage])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="flex h-full" style={{ background: 'var(--void)', color: 'var(--text-primary)' }}>
      <aside className="w-[280px] border-r flex-shrink-0 flex flex-col" style={{ background: 'var(--panel)', borderColor: 'var(--border)' }}>
        <div className="p-4 border-b" style={{ borderColor: 'var(--border)' }}>
          <button
            onClick={startNewChat}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-2xl text-sm font-semibold text-white"
            style={{ background: 'linear-gradient(135deg, #7c3aed, #4f46e5)' }}
          >
            <Plus size={16} />
            New Chat
          </button>

          <div className="mt-3 flex items-center gap-2 px-3 py-2 rounded-xl"
            style={{ background: 'var(--bg-3)', border: '1px solid var(--border)' }}
          >
            <Search size={14} style={{ color: 'var(--text-secondary)' }} />
            <input
              value={sessionSearch}
              onChange={(e) => setSessionSearch(e.target.value)}
              placeholder="Search chats"
              className="flex-1 bg-transparent outline-none text-sm"
              style={{ color: 'var(--text-primary)' }}
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
          {filteredSessions.map((session) => {
            const active = session.id === currentSessionId
            return (
              <button
                key={session.id}
                onClick={() => loadSession(session.id)}
                className="w-full text-left p-3 rounded-2xl transition-all"
                style={{
                  background: active ? 'rgba(124,58,237,0.12)' : 'transparent',
                  border: `1px solid ${active ? 'rgba(124,58,237,0.25)' : 'transparent'}`,
                }}
              >
                <div className="text-sm font-semibold truncate" style={{ color: active ? '#8b5cf6' : 'var(--text-primary)' }}>
                  {session.title}
                </div>
                <div className="text-[11px] mt-1" style={{ color: 'var(--text-secondary)' }}>
                  {formatRelativeTime(session.lastActive)}
                </div>
              </button>
            )
          })}

          {filteredSessions.length === 0 && (
            <div className="p-4 text-center text-xs rounded-2xl" style={{ background: 'var(--bg-3)', color: 'var(--text-secondary)' }}>
              No saved chats yet.
            </div>
          )}
        </div>
      </aside>

      <section className="flex-1 min-w-0 flex flex-col">
        <div className="h-10 px-4 border-b flex items-center justify-between text-xs" style={{ borderColor: 'var(--border)', background: 'var(--bg-1)' }}>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full" style={{ background: wsStatus === 'connected' ? '#22c55e' : wsStatus === 'connecting' ? '#f59e0b' : '#ef4444' }} />
            <span style={{ color: 'var(--text-secondary)' }}>
              {wsStatus === 'connected' ? 'Live connection active' : wsStatus === 'connecting' ? 'Connecting...' : 'Offline fallback mode'}
            </span>
          </div>
          <button onClick={() => refreshSessions(currentSessionId)} className="flex items-center gap-1.5" style={{ color: 'var(--text-secondary)' }}>
            <RefreshCw size={12} /> Refresh
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {loadingHistory ? (
            <div className="h-full flex items-center justify-center">
              <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                <Loader2 size={16} className="animate-spin" /> Loading conversation...
              </div>
            </div>
          ) : (
            <AnimatePresence initial={false}>
              {messages.map((msg) => (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2 }}
                  className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}
                >
                  <div className={`w-9 h-9 rounded-2xl flex items-center justify-center text-sm flex-shrink-0 ${msg.role === 'user' ? 'bg-indigo-600 text-white' : 'text-white'}`}
                    style={msg.role === 'assistant' ? { background: 'linear-gradient(135deg, #7c3aed, #4f46e5)' } : {}}>
                    {msg.role === 'user' ? '👤' : '🤖'}
                  </div>

                  <div className={`max-w-[80%] flex flex-col gap-1 ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                    {msg.space && (
                      <div className="text-[10px] px-1" style={{ color: 'var(--text-secondary)' }}>
                        {SPACES_CONFIG.find((space) => space.id === msg.space)?.icon} {msg.space.toUpperCase()} · {(msg.agentRole || '').replace('_', ' ')}
                      </div>
                    )}

                    <div
                      className="px-4 py-3 rounded-3xl text-sm leading-relaxed whitespace-pre-wrap"
                      style={{
                        background: msg.role === 'user' ? 'linear-gradient(135deg, #6366f1, #4f46e5)' : 'var(--bg-2)',
                        color: msg.role === 'user' ? '#fff' : 'var(--text-primary)',
                        border: msg.role === 'user' ? 'none' : '1px solid var(--border)',
                      }}
                    >
                      {msg.content}
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          )}

          {isLoading && (
            <div className="flex gap-3 items-start">
              <div className="w-9 h-9 rounded-2xl flex items-center justify-center text-white" style={{ background: 'linear-gradient(135deg, #7c3aed, #4f46e5)' }}>
                🤖
              </div>
              <div className="px-4 py-3 rounded-3xl text-sm" style={{ background: 'var(--bg-2)', border: '1px solid var(--border)' }}>
                <div className="flex items-center gap-2" style={{ color: 'var(--text-secondary)' }}>
                  <Loader2 size={14} className="animate-spin" />
                  {activeSpaceIndicator ? `${activeSpaceIndicator} space is working...` : 'Agent kernel is analyzing your request...'}
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        <div className="px-4 pb-3">
          <div className="flex gap-2 overflow-x-auto pb-3">
            {QUICK_ACTIONS.map((action) => {
              const Icon = action.icon
              return (
                <button
                  key={action.text}
                  onClick={() => sendPreparedMessage(action.text)}
                  className="flex-shrink-0 flex items-center gap-2 px-3 py-2 rounded-full text-xs font-medium transition-all"
                  style={{ background: `${action.color}14`, color: action.color, border: `1px solid ${action.color}30` }}
                >
                  <Icon size={13} />
                  {action.text}
                </button>
              )
            })}
          </div>

          <div className="p-3 rounded-3xl" style={{ background: 'var(--bg-2)', border: '1px solid var(--border)' }}>
            <div className="flex gap-3 items-end">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                rows={1}
                placeholder="Ask anything. Every request is routed to the right space and stored in history."
                className="flex-1 bg-transparent resize-none outline-none text-sm leading-relaxed"
                style={{ color: 'var(--text-primary)', maxHeight: '140px' }}
              />
              <button
                onClick={handleSend}
                disabled={!input.trim() || isLoading}
                className="w-11 h-11 rounded-2xl flex items-center justify-center disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg, #7c3aed, #4f46e5)' }}
              >
                <Send size={16} className="text-white" />
              </button>
            </div>
            <div className="text-[11px] mt-2" style={{ color: 'var(--text-secondary)' }}>
              Press Enter to send · Shift+Enter for a new line · Chats persist across refreshes.
            </div>
          </div>
        </div>
      </section>

      <aside className="w-[280px] border-l flex-shrink-0 hidden xl:flex flex-col" style={{ background: 'var(--panel)', borderColor: 'var(--border)' }}>
        <div className="p-4 border-b" style={{ borderColor: 'var(--border)' }}>
          <div className="text-xs font-bold uppercase tracking-[0.2em]" style={{ color: 'var(--text-secondary)' }}>
            Space router
          </div>
          <div className="mt-2 text-sm font-semibold">8 Spaces · 5 Roles</div>
          <div className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
            Current role: {currentRole.replace('_', ' ')}
          </div>
        </div>

        <div className="p-4 grid grid-cols-2 gap-2">
          {SPACES_CONFIG.map((space) => {
            const state = spaces[space.id]
            const isActive = activeSpace === space.id || state?.active
            return (
              <div
                key={space.id}
                className="p-3 rounded-2xl"
                style={{
                  background: isActive ? `${space.color}12` : 'var(--bg-3)',
                  border: `1px solid ${isActive ? `${space.color}40` : 'var(--border)'}`,
                }}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-lg">{space.icon}</span>
                  {isActive && <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: space.color }} />}
                </div>
                <div className="text-xs font-semibold" style={{ color: isActive ? space.color : 'var(--text-primary)' }}>
                  {space.name}
                </div>
                <div className="text-[10px] mt-1 leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                  {space.desc}
                </div>
              </div>
            )
          })}
        </div>

        <div className="px-4 pb-4 mt-auto">
          <div className="p-4 rounded-2xl" style={{ background: 'var(--bg-3)', border: '1px solid var(--border)' }}>
            <div className="flex items-center gap-2 text-sm font-semibold mb-2">
              <Brain size={16} className="text-violet-500" />
              Manus-like essentials
            </div>
            <ul className="space-y-2 text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              <li>• Persistent chat history with session switching</li>
              <li>• Real backend-triggered quick actions</li>
              <li>• Live space activation feedback</li>
              <li>• Notification center and theme persistence</li>
            </ul>
          </div>
        </div>
      </aside>
    </div>
  )
}
