'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Plus, MessageSquare, Zap, Send, Square, Code2, Globe,
  Folder, GitBranch, FlaskConical, Eye, Rocket, Bot,
  Search, Trash2, ChevronRight, Sparkles, Terminal,
  Brain, Settings2, RefreshCw
} from 'lucide-react'
import { fetchAPI } from '@/lib/api'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Message {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: number
  streaming?: boolean
  agent?: string
  provider?: string
  error?: boolean
}

interface ChatSession {
  id: string
  title: string
  messages: Message[]
  createdAt: number
  updatedAt: number
  preview: string
}

// ─── Constants ───────────────────────────────────────────────────────────────

const QUICK_ACTIONS = [
  { icon: Code2,        label: 'Build REST API',        prompt: 'Build a production-ready REST API with FastAPI, SQLite, JWT auth, and full CRUD endpoints' },
  { icon: Globe,        label: 'Research Web',           prompt: 'Research the latest AI agent frameworks and compare Manus, Genspark, and Devin capabilities' },
  { icon: Folder,       label: 'Scaffold Project',       prompt: 'Create a full-stack project: Next.js 14 frontend + FastAPI backend + Docker + CI/CD pipeline' },
  { icon: GitBranch,    label: 'Git Operations',         prompt: 'Create a new GitHub repository with README, .gitignore, and initial commit' },
  { icon: FlaskConical, label: 'Generate Tests',         prompt: 'Generate comprehensive pytest tests with fixtures, mocks, and edge cases for a FastAPI app' },
  { icon: Eye,          label: 'Generate UI',            prompt: 'Create a stunning dark-themed admin dashboard with React, Tailwind, and glassmorphism' },
  { icon: Rocket,       label: 'Deploy to Vercel',       prompt: 'Generate Vercel deployment config with environment variables, edge functions, and CI/CD' },
  { icon: Bot,          label: 'Multi-Agent Task',       prompt: 'Build a full autonomous AI agent system: plan, code, test, and deploy a Telegram AI bot' },
]

const STORAGE_KEY = 'god_agent_chat_sessions'
const ACTIVE_KEY = 'god_agent_active_session'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function genId(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36)
}

function loadSessions(): ChatSession[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch { return [] }
}

function saveSessions(sessions: ChatSession[]) {
  if (typeof window === 'undefined') return
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions)) } catch {}
}

function loadActiveId(): string | null {
  if (typeof window === 'undefined') return null
  try { return localStorage.getItem(ACTIVE_KEY) } catch { return null }
}

function saveActiveId(id: string) {
  if (typeof window === 'undefined') return
  try { localStorage.setItem(ACTIVE_KEY, id) } catch {}
}

function truncate(str: string, n: number) {
  return str.length > n ? str.slice(0, n - 3) + '...' : str
}

function formatTime(ts: number) {
  const d = new Date(ts)
  const now = new Date()
  const diff = (now.getTime() - d.getTime()) / 1000
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return d.toLocaleDateString()
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ChatMainPage() {
  const [sessions, setSessions] = useState<ChatSession[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [input, setInput] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [streamingId, setStreamingId] = useState<string | null>(null)
  const [sidebarSearch, setSidebarSearch] = useState('')
  const [mounted, setMounted] = useState(false)
  const [mode, setMode] = useState<'chat' | 'agent'>('chat')

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const sessionId = useRef(genId())

  // Load from localStorage on mount
  useEffect(() => {
    const saved = loadSessions()
    const savedActiveId = loadActiveId()
    setSessions(saved)
    if (savedActiveId && saved.find(s => s.id === savedActiveId)) {
      setActiveId(savedActiveId)
    } else if (saved.length > 0) {
      setActiveId(saved[0].id)
    }
    setMounted(true)
  }, [])

  // Save sessions whenever they change
  useEffect(() => {
    if (mounted) saveSessions(sessions)
  }, [sessions, mounted])

  useEffect(() => {
    if (activeId) saveActiveId(activeId)
  }, [activeId])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [sessions, activeId])

  const activeSession = sessions.find(s => s.id === activeId) || null
  const messages = activeSession?.messages || []

  // ─── Session Management ────────────────────────────────────────────────────

  const createNewChat = useCallback(() => {
    const id = genId()
    const newSession: ChatSession = {
      id,
      title: 'New Chat',
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      preview: '',
    }
    setSessions(prev => [newSession, ...prev])
    setActiveId(id)
    setInput('')
    inputRef.current?.focus()
  }, [])

  const deleteSession = useCallback((id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setSessions(prev => {
      const next = prev.filter(s => s.id !== id)
      if (activeId === id) {
        setActiveId(next.length > 0 ? next[0].id : null)
      }
      return next
    })
  }, [activeId])

  const updateSession = useCallback((id: string, updates: Partial<ChatSession>) => {
    setSessions(prev => prev.map(s => s.id === id ? { ...s, ...updates, updatedAt: Date.now() } : s))
  }, [])

  const addMessage = useCallback((sessionId_: string, msg: Omit<Message, 'id' | 'timestamp'>): string => {
    const id = genId()
    const fullMsg: Message = { ...msg, id, timestamp: Date.now() }
    setSessions(prev => prev.map(s => {
      if (s.id !== sessionId_) return s
      const msgs = [...s.messages, fullMsg]
      const userMsgs = msgs.filter(m => m.role === 'user')
      const title = userMsgs.length > 0
        ? truncate(userMsgs[0].content, 40)
        : s.title
      const preview = truncate(fullMsg.content || '', 60)
      return { ...s, messages: msgs, title, preview, updatedAt: Date.now() }
    }))
    return id
  }, [])

  const updateMessage = useCallback((sessionId_: string, msgId: string, updates: Partial<Message>) => {
    setSessions(prev => prev.map(s => {
      if (s.id !== sessionId_) return s
      return {
        ...s,
        messages: s.messages.map(m => m.id === msgId ? { ...m, ...updates } : m),
        updatedAt: Date.now(),
      }
    }))
  }, [])

  // ─── Send Message ──────────────────────────────────────────────────────────

  const handleSubmit = useCallback(async (text?: string) => {
    const content = (text || input).trim()
    if (!content || isStreaming) return

    let sid = activeId
    if (!sid) {
      const id = genId()
      const newSession: ChatSession = {
        id, title: truncate(content, 40),
        messages: [], createdAt: Date.now(), updatedAt: Date.now(), preview: '',
      }
      setSessions(prev => [newSession, ...prev])
      setActiveId(id)
      sid = id
    }

    setInput('')
    inputRef.current?.style.setProperty('height', 'auto')

    addMessage(sid, { role: 'user', content })

    const assistantMsgId = addMessage(sid, {
      role: 'assistant', content: '', streaming: true, agent: 'thinking',
    })
    setStreamingId(assistantMsgId)
    setIsStreaming(true)

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || ''
      
      if (mode === 'agent') {
        // Agent mode — create task
        const res = await fetch(`${apiUrl}/api/v1/tasks/`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ goal: content, session_id: sessionId.current }),
        })
        const data = await res.json()
        updateMessage(sid, assistantMsgId, {
          content: `🚀 **Task Created** \`${data.task_id}\`\n\n**Goal:** ${content}\n\n**Status:** Planning → Executing\n\n> 🤖 God Agent v10 routing to specialized spaces...`,
          streaming: false, agent: 'planner', provider: 'system',
        })
      } else {
        // Chat mode — kernel orchestrate
        const res = await fetch(`${apiUrl}/api/v1/kernel/orchestrate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: content,
            session_id: sessionId.current,
            context: { chat_history: messages.slice(-10).map(m => ({ role: m.role, content: m.content })) },
          }),
        })
        const data = await res.json()
        const responseContent = data.result || data.content || data.response || 'Response received.'
        const provider = data.provider || ''
        updateMessage(sid, assistantMsgId, {
          content: responseContent,
          streaming: false,
          agent: 'god-agent',
          provider,
        })
      }
    } catch (err: any) {
      updateMessage(sid, assistantMsgId, {
        content: `❌ **Error:** ${err.message}\n\nMake sure the backend is running at \`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}\``,
        streaming: false, agent: 'debug', error: true,
      })
    } finally {
      setIsStreaming(false)
      setStreamingId(null)
    }
  }, [input, isStreaming, activeId, mode, messages, addMessage, updateMessage])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit() }
  }

  const autoResize = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value)
    e.target.style.height = 'auto'
    e.target.style.height = Math.min(e.target.scrollHeight, 160) + 'px'
  }

  const filteredSessions = sessions.filter(s =>
    !sidebarSearch || s.title.toLowerCase().includes(sidebarSearch.toLowerCase())
  )

  if (!mounted) return null

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex h-full overflow-hidden" style={{ background: '#05060d' }}>

      {/* ── Chat History Sidebar ─────────────────────────────────────────── */}
      <div className="w-64 flex-shrink-0 flex flex-col border-r overflow-hidden"
        style={{ borderColor: 'var(--border)', background: 'var(--bg-2)' }}>

        {/* New Chat Button */}
        <div className="p-3 border-b flex-shrink-0" style={{ borderColor: 'var(--border)' }}>
          <button
            onClick={createNewChat}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-sm font-semibold transition-all hover:scale-[1.01] active:scale-95"
            style={{ background: 'var(--brand)', color: '#fff' }}
          >
            <Plus size={15} />
            New Chat
          </button>
        </div>

        {/* Search */}
        <div className="px-3 py-2 flex-shrink-0">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg" style={{ background: 'var(--bg-3)', border: '1px solid var(--border)' }}>
            <Search size={12} style={{ color: 'var(--text-muted)' }} />
            <input
              value={sidebarSearch}
              onChange={e => setSidebarSearch(e.target.value)}
              placeholder="Search chats..."
              className="flex-1 bg-transparent text-xs outline-none"
              style={{ color: 'var(--text-primary)' }}
            />
          </div>
        </div>

        {/* Sessions List */}
        <div className="flex-1 overflow-y-auto px-2 pb-2">
          {filteredSessions.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 gap-2">
              <MessageSquare size={24} style={{ color: 'var(--text-muted)' }} />
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>No chats yet</span>
            </div>
          ) : (
            <AnimatePresence>
              {filteredSessions.map(session => (
                <motion.div
                  key={session.id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -8 }}
                  onClick={() => setActiveId(session.id)}
                  className="group relative flex items-start gap-2 p-2.5 rounded-xl cursor-pointer mb-1 transition-all"
                  style={{
                    background: activeId === session.id ? 'var(--bg-4)' : 'transparent',
                    border: `1px solid ${activeId === session.id ? 'rgba(99,102,241,0.3)' : 'transparent'}`,
                  }}
                  onMouseEnter={e => {
                    if (activeId !== session.id) {
                      (e.currentTarget as HTMLElement).style.background = 'var(--bg-3)'
                    }
                  }}
                  onMouseLeave={e => {
                    if (activeId !== session.id) {
                      (e.currentTarget as HTMLElement).style.background = 'transparent'
                    }
                  }}
                >
                  <MessageSquare size={13} className="mt-0.5 flex-shrink-0"
                    style={{ color: activeId === session.id ? '#818cf8' : 'var(--text-muted)' }} />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium truncate" style={{ color: activeId === session.id ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                      {session.title}
                    </div>
                    <div className="text-[10px] truncate mt-0.5" style={{ color: 'var(--text-muted)' }}>
                      {formatTime(session.updatedAt)}
                    </div>
                  </div>
                  <button
                    onClick={(e) => deleteSession(session.id, e)}
                    className="opacity-0 group-hover:opacity-100 p-1 rounded-lg transition-all hover:bg-red-500/20"
                  >
                    <Trash2 size={10} className="text-red-400" />
                  </button>
                </motion.div>
              ))}
            </AnimatePresence>
          )}
        </div>

        {/* Provider Status */}
        <div className="p-3 border-t flex-shrink-0" style={{ borderColor: 'var(--border)' }}>
          <div className="text-[10px] font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>AI PROVIDERS</div>
          <div className="flex gap-1.5 flex-wrap">
            {['Gemini', 'SambaNova', 'GitHub'].map(p => (
              <span key={p} className="text-[9px] px-2 py-0.5 rounded-full font-medium"
                style={{ background: 'rgba(99,102,241,0.12)', color: '#a5b4fc', border: '1px solid rgba(99,102,241,0.2)' }}>
                {p}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* ── Main Chat Area ────────────────────────────────────────────────── */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">

        {/* Chat Header */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b flex-shrink-0"
          style={{ borderColor: 'var(--border)', background: 'var(--bg-2)' }}>
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse flex-shrink-0" />
            <span className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
              {activeSession?.title || 'God Agent OS'}
            </span>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded flex-shrink-0"
              style={{ background: 'rgba(99,102,241,0.12)', color: '#a5b4fc', border: '1px solid rgba(99,102,241,0.25)' }}>
              v10 · 22 Spaces
            </span>
          </div>

          {/* Mode Toggle */}
          <div className="flex p-0.5 rounded-xl gap-0.5 flex-shrink-0"
            style={{ background: 'var(--bg-3)', border: '1px solid var(--border)' }}>
            <button onClick={() => setMode('agent')}
              className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition-all"
              style={{ background: mode === 'agent' ? 'var(--brand)' : 'transparent', color: mode === 'agent' ? '#fff' : 'var(--text-muted)' }}>
              <Zap size={11} />
              Agent
            </button>
            <button onClick={() => setMode('chat')}
              className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition-all"
              style={{ background: mode === 'chat' ? 'var(--bg-4)' : 'transparent', color: mode === 'chat' ? 'var(--text-primary)' : 'var(--text-muted)' }}>
              <MessageSquare size={11} />
              Chat
            </button>
          </div>
        </div>

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto px-4 py-4">
          {messages.length === 0 ? (
            /* Welcome / Empty State */
            <div className="flex flex-col items-center justify-center h-full gap-8 py-8 max-w-2xl mx-auto">
              <div className="text-center">
                <motion.div
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="w-24 h-24 rounded-3xl mx-auto mb-5 flex items-center justify-center relative"
                  style={{ background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.25)' }}
                >
                  <Zap size={40} className="text-indigo-400" />
                  <div className="absolute -top-1 -right-1 w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold text-white"
                    style={{ background: 'var(--brand)' }}>v10</div>
                </motion.div>
                <h2 className="text-2xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>
                  GOD AGENT OS v10
                </h2>
                <p className="text-sm font-medium mb-1" style={{ color: '#a5b4fc' }}>
                  General Autonomous Agent OS
                </p>
                <p className="text-xs max-w-sm mx-auto mt-2" style={{ color: 'var(--text-secondary)' }}>
                  Powered by Gemini · SambaNova · GitHub Models<br />
                  22 Worker Spaces · 16 Autonomous Agents
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2 w-full max-w-lg">
                {QUICK_ACTIONS.map(({ icon: Icon, label, prompt }) => (
                  <motion.button
                    key={label}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => handleSubmit(prompt)}
                    className="flex items-center gap-2.5 p-3 rounded-xl text-left transition-all"
                    style={{ background: 'var(--bg-3)', border: '1px solid var(--border)' }}
                    onMouseEnter={e => {
                      (e.currentTarget as HTMLElement).style.borderColor = 'rgba(99,102,241,0.5)'
                      ;(e.currentTarget as HTMLElement).style.background = 'var(--bg-4)'
                    }}
                    onMouseLeave={e => {
                      (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'
                      ;(e.currentTarget as HTMLElement).style.background = 'var(--bg-3)'
                    }}
                  >
                    <Icon size={14} className="text-indigo-400 flex-shrink-0" />
                    <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{label}</span>
                  </motion.button>
                ))}
              </div>
            </div>
          ) : (
            /* Messages */
            <div className="max-w-3xl mx-auto space-y-4">
              <AnimatePresence>
                {messages.map(msg => (
                  <motion.div
                    key={msg.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    {msg.role === 'assistant' && (
                      <div className="w-7 h-7 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5"
                        style={{ background: 'linear-gradient(135deg, #7c3aed, #4f46e5)' }}>
                        <Zap size={13} className="text-white" />
                      </div>
                    )}
                    <div className={`max-w-[78%] ${msg.role === 'user' ? 'order-first' : ''}`}>
                      <div
                        className="px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap"
                        style={{
                          background: msg.role === 'user'
                            ? 'var(--brand)'
                            : msg.error
                              ? 'rgba(239,68,68,0.1)'
                              : 'var(--bg-3)',
                          color: msg.role === 'user' ? '#fff' : msg.error ? '#fca5a5' : 'var(--text-primary)',
                          border: msg.role === 'user' ? 'none' : `1px solid ${msg.error ? 'rgba(239,68,68,0.3)' : 'var(--border)'}`,
                          borderRadius: msg.role === 'user' ? '20px 20px 4px 20px' : '4px 20px 20px 20px',
                        }}
                      >
                        {msg.streaming ? (
                          <span className="flex items-center gap-2">
                            <span style={{ color: 'var(--text-secondary)' }}>
                              {msg.content || 'Thinking'}
                            </span>
                            <span className="flex gap-1">
                              {[0,1,2].map(i => (
                                <span key={i} className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce inline-block"
                                  style={{ animationDelay: `${i * 0.2}s` }} />
                              ))}
                            </span>
                          </span>
                        ) : (
                          msg.content
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-1 px-1">
                        {msg.agent && msg.role === 'assistant' && (
                          <span className="text-[9px] font-medium" style={{ color: 'var(--text-muted)' }}>
                            {msg.agent}
                          </span>
                        )}
                        {msg.provider && msg.provider !== 'system' && msg.provider !== 'demo' && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded"
                            style={{ background: 'rgba(99,102,241,0.1)', color: '#818cf8' }}>
                            {msg.provider}
                          </span>
                        )}
                        <span className="text-[9px]" style={{ color: 'var(--text-muted)' }}>
                          {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </div>
                    {msg.role === 'user' && (
                      <div className="w-7 h-7 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5"
                        style={{ background: 'var(--bg-4)', border: '1px solid var(--border)' }}>
                        <span className="text-xs">U</span>
                      </div>
                    )}
                  </motion.div>
                ))}
              </AnimatePresence>
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Input Area */}
        <div className="px-4 pb-4 pt-2 border-t flex-shrink-0" style={{ borderColor: 'var(--border)', background: 'var(--bg-2)' }}>
          <div className="max-w-3xl mx-auto">
            <div
              className={`relative rounded-2xl transition-all ${isStreaming ? 'ring-2 ring-indigo-500/40' : 'focus-within:ring-2 focus-within:ring-indigo-500/50'}`}
              style={{ background: 'var(--bg-3)', border: '1px solid var(--border)' }}
            >
              <textarea
                ref={inputRef}
                value={input}
                onChange={autoResize}
                onKeyDown={handleKeyDown}
                placeholder={
                  mode === 'agent'
                    ? 'Describe any goal... 22 spaces will autonomously execute it'
                    : 'Ask anything... (Shift+Enter for newline)'
                }
                disabled={isStreaming}
                rows={1}
                className="w-full bg-transparent text-sm px-4 py-3 pr-14 resize-none outline-none max-h-40 overflow-auto"
                style={{ color: 'var(--text-primary)', minHeight: '48px' }}
              />
              <div className="absolute right-2.5 bottom-2.5">
                {isStreaming ? (
                  <button type="button"
                    onClick={() => { setIsStreaming(false); setStreamingId(null) }}
                    className="p-2 rounded-xl transition-all active:scale-90"
                    style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)' }}>
                    <Square size={14} className="text-red-400" />
                  </button>
                ) : (
                  <button
                    onClick={() => handleSubmit()}
                    disabled={!input.trim()}
                    className="p-2 rounded-xl transition-all disabled:opacity-30 active:scale-90"
                    style={{ background: input.trim() ? 'var(--brand)' : 'var(--bg-4)' }}>
                    <Send size={14} className="text-white" />
                  </button>
                )}
              </div>
            </div>
            <div className="flex items-center justify-between mt-1.5 px-1">
              <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                {mode === 'agent'
                  ? '⚡ Agent Mode — 22 spaces · Gemini · SambaNova · GitHub Models'
                  : '💬 Chat Mode — direct conversation with God Agent OS'}
              </span>
              <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Enter ↵</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
