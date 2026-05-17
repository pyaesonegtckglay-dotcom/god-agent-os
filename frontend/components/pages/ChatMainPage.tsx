'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Plus, MessageSquare, Zap, Send, Square, Code2, Globe,
  Folder, GitBranch, FlaskConical, Eye, Rocket, Bot,
  Search, Trash2, Sparkles, Terminal,
  Brain, RefreshCw, Copy, Check, ChevronRight, AlertCircle, Wifi, WifiOff
} from 'lucide-react'
import { streamOrchestrate, getHealth, type ToolResult, type ComputerUseStepEvent } from '@/lib/api'
import { useAppStore } from '@/store/useAppStore'
import ReactMarkdown from 'react-markdown'

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
  toolResults?: ToolResult[]
}

interface ChatSession {
  id: string
  title: string
  messages: Message[]
  createdAt: number
  updatedAt: number
}

// ─── Constants ───────────────────────────────────────────────────────────────

const QUICK_ACTIONS = [
  { icon: Code2,        label: 'Build REST API',        labelMy: 'REST API တည်ဆောက်',  prompt: 'Build a production-ready REST API with FastAPI, SQLite, JWT auth, and full CRUD endpoints' },
  { icon: Globe,        label: 'Web Research',           labelMy: 'Web သုတေသန',          prompt: 'Research the latest AI agent frameworks. Compare Manus, Genspark, and Devin capabilities with pros/cons' },
  { icon: Folder,       label: 'Scaffold Project',       labelMy: 'Project ဖွဲ့ဆောက်',   prompt: 'Create a full-stack project: Next.js 14 frontend + FastAPI backend + Docker + CI/CD pipeline' },
  { icon: GitBranch,    label: 'Git Operations',         labelMy: 'Git လုပ်ဆောင်',         prompt: 'Create a GitHub repository with README, .gitignore, branch protection, and initial commit' },
  { icon: FlaskConical, label: 'Generate Tests',         labelMy: 'Test ဖန်တီး',           prompt: 'Generate comprehensive pytest tests with fixtures, mocks, and edge cases for a FastAPI app' },
  { icon: Eye,          label: 'Generate UI',            labelMy: 'UI ဖန်တီး',             prompt: 'Create a stunning dark-themed admin dashboard with React, Tailwind CSS, and glassmorphism design' },
  { icon: Rocket,       label: 'Deploy to Vercel',       labelMy: 'Vercel တင်',            prompt: 'Generate Vercel deployment config with environment variables, edge functions, and CI/CD pipeline' },
  { icon: Bot,          label: 'Multi-Agent Task',       labelMy: 'Multi-Agent',           prompt: 'Build a full autonomous AI agent system: plan, code, test, and deploy a Telegram AI bot' },
]

const STORAGE_KEY = 'god_agent_v12_sessions'
const ACTIVE_KEY = 'god_agent_v12_active'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function genId() { return Math.random().toString(36).slice(2, 10) + Date.now().toString(36) }

function loadSessions(): ChatSession[] {
  if (typeof window === 'undefined') return []
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') } catch { return [] }
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

// ─── Message Bubble ───────────────────────────────────────────────────────────

function MessageBubble({ msg }: { msg: Message }) {
  const [copied, setCopied] = useState(false)

  const copyContent = () => {
    navigator.clipboard.writeText(msg.content).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }

  const isUser = msg.role === 'user'

  if (isUser) {
    return (
      <div className="flex justify-end mb-4 animate-fade-in">
        <div className="max-w-[75%]">
          <div className="px-4 py-3 rounded-2xl rounded-tr-sm text-sm"
            style={{
              background: 'linear-gradient(135deg, var(--accent), #4f46e5)',
              color: 'white',
            }}>
            {msg.content}
          </div>
          <div className="text-[10px] mt-1 text-right" style={{ color: 'var(--text-muted)' }}>
            {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex gap-3 mb-4 animate-fade-in group">
      {/* Avatar */}
      <div className="w-8 h-8 rounded-xl shrink-0 flex items-center justify-center mt-0.5"
        style={{ background: 'rgba(124,58,237,0.12)', border: '1px solid rgba(124,58,237,0.2)' }}>
        <Zap size={14} style={{ color: 'var(--accent-bright)' }} />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs font-semibold" style={{ color: 'var(--accent-bright)' }}>God Agent</span>
          {msg.agent && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full"
              style={{ background: 'rgba(124,58,237,0.1)', color: '#a78bfa' }}>
              {msg.agent}
            </span>
          )}
          {msg.error && (
            <span className="badge badge-red text-[10px]">
              <AlertCircle size={9} /> Error
            </span>
          )}
          <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
            {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>

        <div className="p-4 rounded-2xl rounded-tl-sm text-sm card">
          {msg.streaming && !msg.content ? (
            <div className="flex gap-1.5 items-center" style={{ color: 'var(--text-muted)' }}>
              <div className="flex gap-1">
                {[0,1,2].map(i => (
                  <div key={i} className="w-1.5 h-1.5 rounded-full animate-bounce"
                    style={{ background: 'var(--accent)', animationDelay: `${i * 0.15}s` }} />
                ))}
              </div>
              <span className="text-xs">Thinking...</span>
            </div>
          ) : (
            <div className={`prose-god ${msg.streaming ? 'streaming-cursor' : ''}`}>
              <ReactMarkdown
                components={{
                  code: (({ className, children, ...props }: { className?: string; children?: React.ReactNode; [key: string]: unknown }) => {
                    const isBlock = className?.includes('language-')
                    return isBlock ? (
                      <pre className="code-block">
                        <code>{children}</code>
                      </pre>
                    ) : (
                      <code className="bg-purple-900/30 text-purple-200 px-1.5 py-0.5 rounded text-xs">{children}</code>
                    )
                  }) as React.ComponentType<{ className?: string; children?: React.ReactNode }>
                }}
              >
                {msg.content}
              </ReactMarkdown>
            </div>
          )}
        </div>

        {/* Copy button */}
        {!msg.streaming && msg.content && (
          <button onClick={copyContent}
            className="mt-1 flex items-center gap-1 text-[10px] px-2 py-1 rounded-md opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white/5"
            style={{ color: 'var(--text-muted)' }}>
            {copied ? <><Check size={10} /> Copied</> : <><Copy size={10} /> Copy</>}
          </button>
        )}
      </div>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ChatMainPage() {
  const { locale, addComputerUseStep, setComputerUseOpen } = useAppStore()

  const [sessions, setSessions] = useState<ChatSession[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [input, setInput] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [backendStatus, setBackendStatus] = useState<'checking' | 'online' | 'offline'>('checking')
  const [toolResultsRef, setToolResultsRef] = useState<ToolResult[]>([])

  const abortRef = useRef<AbortController | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Load sessions
  useEffect(() => {
    const saved = loadSessions()
    setSessions(saved)
    const savedId = loadActiveId()
    if (savedId && saved.find(s => s.id === savedId)) {
      setActiveId(savedId)
    } else if (saved.length > 0) {
      setActiveId(saved[0].id)
    }
  }, [])

  // Check backend
  useEffect(() => {
    getHealth()
      .then(() => setBackendStatus('online'))
      .catch(() => setBackendStatus('offline'))
  }, [])

  // Scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [sessions, activeId])

  const activeSession = sessions.find(s => s.id === activeId)

  const createSession = useCallback(() => {
    const id = genId()
    const session: ChatSession = {
      id,
      title: locale === 'my' ? 'စကားပြောသစ်' : 'New Chat',
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }
    setSessions(prev => {
      const next = [session, ...prev]
      saveSessions(next)
      return next
    })
    setActiveId(id)
    saveActiveId(id)
  }, [locale])

  const deleteSession = useCallback((id: string) => {
    setSessions(prev => {
      const next = prev.filter(s => s.id !== id)
      saveSessions(next)
      return next
    })
    if (activeId === id) {
      setActiveId(null)
    }
  }, [activeId])

  const updateSession = useCallback((id: string, updates: Partial<ChatSession>) => {
    setSessions(prev => {
      const next = prev.map(s => s.id === id ? { ...s, ...updates, updatedAt: Date.now() } : s)
      saveSessions(next)
      return next
    })
  }, [])

  const sendMessage = useCallback(async (content: string) => {
    if (!content.trim() || isStreaming) return

    let sessionId = activeId
    if (!sessionId) {
      const id = genId()
      const session: ChatSession = {
        id,
        title: content.slice(0, 30),
        messages: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }
      setSessions(prev => {
        const next = [session, ...prev]
        saveSessions(next)
        return next
      })
      setActiveId(id)
      saveActiveId(id)
      sessionId = id
    }

    // User message
    const userMsg: Message = {
      id: genId(),
      role: 'user',
      content,
      timestamp: Date.now(),
    }

    // Assistant placeholder
    const assistantMsg: Message = {
      id: genId(),
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
      streaming: true,
    }

    const assistantId = assistantMsg.id

    updateSession(sessionId, {
      messages: [...(sessions.find(s => s.id === sessionId)?.messages || []), userMsg, assistantMsg],
      title: sessions.find(s => s.id === sessionId)?.messages.length === 0
        ? content.slice(0, 35)
        : sessions.find(s => s.id === sessionId)?.title || content.slice(0, 35),
    })

    setInput('')
    setIsStreaming(true)
    setComputerUseOpen(true)

    // Add initial computer use step
    addComputerUseStep({
      type: 'thinking',
      title: locale === 'my' ? `မေးခွန်းကို ခွဲခြမ်းနေသည်...` : `Analyzing request...`,
      detail: content.slice(0, 80),
      status: 'running',
    })

    const sessionToolResults: ToolResult[] = []

    const ctrl = await streamOrchestrate(
      content,
      sessionId,
      // onChunk
      (chunk: string) => {
        setSessions(prev => prev.map(s => {
          if (s.id !== sessionId) return s
          return {
            ...s,
            messages: s.messages.map(m =>
              m.id === assistantId ? { ...m, content: m.content + chunk, streaming: true } : m
            ),
          }
        }))
      },
      // onDone
      (full: string) => {
        setSessions(prev => {
          const next = prev.map(s => {
            if (s.id !== sessionId) return s
            return {
              ...s,
              messages: s.messages.map(m =>
                m.id === assistantId ? { ...m, content: full || m.content, streaming: false } : m
              ),
              updatedAt: Date.now(),
            }
          })
          saveSessions(next)
          return next
        })
        setIsStreaming(false)
        addComputerUseStep({
          type: 'complete',
          title: locale === 'my' ? 'လုပ်ဆောင်မှုပြီးဆုံးပါပြီ' : 'Task completed',
          status: 'done',
        })
      },
      // onError
      (err: string) => {
        setSessions(prev => {
          const next = prev.map(s => {
            if (s.id !== sessionId) return s
            const errMsg = locale === 'my'
              ? `❌ Backend ချိတ်ဆက်မရပါ: ${err}\n\nBackend URL ကို Settings > API Keys တွင် စစ်ဆေးပါ။`
              : `❌ **Backend Error:** ${err}\n\nCheck backend URL in Settings → API Keys.\n\nMake sure HF Space is running: https://huggingface.co/spaces/PYAE1994/autonomous-coding-system`
            return {
              ...s,
              messages: s.messages.map(m =>
                m.id === assistantId ? { ...m, content: errMsg, streaming: false, error: true } : m
              ),
            }
          })
          saveSessions(next)
          return next
        })
        setIsStreaming(false)
        addComputerUseStep({
          type: 'error',
          title: 'Connection failed',
          detail: err.slice(0, 100),
          status: 'error',
        })
      },
      // onComputerUseStep
      (step: ComputerUseStepEvent) => {
        addComputerUseStep({
          type: (step.type as ComputerUseStep['type']) || 'executing',
          title: step.title,
          detail: step.detail,
          status: step.status === 'done' ? 'done' : 'running',
        })
      },
      // onToolResult
      (result: ToolResult) => {
        sessionToolResults.push(result)
        setToolResultsRef([...sessionToolResults])
      }
    )

    abortRef.current = ctrl
  }, [activeId, isStreaming, sessions, locale, addComputerUseStep, setComputerUseOpen, updateSession])

  const stopStreaming = () => {
    abortRef.current?.abort()
    setIsStreaming(false)
    setSessions(prev => prev.map(s => ({
      ...s,
      messages: s.messages.map(m => m.streaming ? { ...m, streaming: false } : m),
    })))
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage(input)
    }
  }

  const handleQuickAction = (prompt: string) => {
    setInput(prompt)
    textareaRef.current?.focus()
  }

  return (
    <div className="flex h-full overflow-hidden">
      {/* Sessions Sidebar */}
      <div className="w-56 shrink-0 flex flex-col border-r" style={{ background: 'var(--surface-1)', borderColor: 'var(--border)' }}>
        <div className="p-3 shrink-0">
          <button
            onClick={createSession}
            className="btn btn-primary w-full justify-center text-xs"
          >
            <Plus size={13} />
            {locale === 'my' ? 'စကားပြောသစ်' : 'New Chat'}
          </button>
        </div>

        {/* Backend Status */}
        <div className="px-3 pb-2">
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs"
            style={{
              background: backendStatus === 'online' ? 'rgba(34,197,94,0.08)' : backendStatus === 'offline' ? 'rgba(239,68,68,0.08)' : 'rgba(245,158,11,0.08)',
              color: backendStatus === 'online' ? '#4ade80' : backendStatus === 'offline' ? '#f87171' : '#fbbf24',
            }}>
            {backendStatus === 'online' ? <Wifi size={10} /> : backendStatus === 'offline' ? <WifiOff size={10} /> : <RefreshCw size={10} />}
            <span>Backend: {backendStatus === 'online' ? (locale === 'my' ? 'ချိတ်ဆက်ပြီး' : 'Connected') : backendStatus === 'offline' ? (locale === 'my' ? 'ဆက်သွယ်မရ' : 'Offline') : (locale === 'my' ? 'စစ်ဆေးနေ' : 'Checking...')}</span>
          </div>
        </div>

        {/* Session List */}
        <div className="flex-1 overflow-y-auto px-2 space-y-0.5">
          {sessions.length === 0 && (
            <div className="px-2 py-4 text-center text-xs" style={{ color: 'var(--text-muted)' }}>
              {locale === 'my' ? 'စကားပြောမရှိသေးပါ' : 'No sessions yet'}
            </div>
          )}
          {sessions.map(s => (
            <div
              key={s.id}
              onClick={() => { setActiveId(s.id); saveActiveId(s.id) }}
              className="flex items-center gap-2 px-2.5 py-2 rounded-lg cursor-pointer group"
              style={{
                background: s.id === activeId ? 'rgba(124,58,237,0.12)' : 'transparent',
                border: s.id === activeId ? '1px solid rgba(124,58,237,0.2)' : '1px solid transparent',
              }}
            >
              <MessageSquare size={12} style={{ color: s.id === activeId ? 'var(--accent-bright)' : 'var(--text-muted)', flexShrink: 0 }} />
              <span className="text-xs truncate flex-1" style={{ color: s.id === activeId ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                {s.title || (locale === 'my' ? 'စကားပြောသစ်' : 'New Chat')}
              </span>
              <button
                onClick={e => { e.stopPropagation(); deleteSession(s.id) }}
                className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-red-500/20 transition-all shrink-0"
              >
                <Trash2 size={10} style={{ color: '#f87171' }} />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Main Chat */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4">
          {!activeSession ? (
            // Welcome screen
            <div className="flex flex-col items-center justify-center h-full gap-6">
              <div className="text-center">
                <div className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center"
                  style={{ background: 'linear-gradient(135deg, var(--accent), #4f46e5)' }}>
                  <Zap size={28} className="text-white" />
                </div>
                <h1 className="text-2xl font-black text-white mb-2">
                  {locale === 'my' ? 'GOD AGENT OS v12' : 'GOD AGENT OS v12'}
                </h1>
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                  {locale === 'my'
                    ? 'Code ရေး · Debug · Deploy · Browser · Git · Memory — 16 Agent + 22 Space'
                    : 'Code · Debug · Deploy · Browse · Git · Memory — 16 Agents + 22 Spaces'}
                </p>
              </div>

              {/* Quick Actions */}
              <div className="grid grid-cols-2 gap-2 max-w-lg w-full">
                {QUICK_ACTIONS.map((a, i) => (
                  <button
                    key={i}
                    onClick={() => { if (!activeId) createSession(); handleQuickAction(a.prompt) }}
                    className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left text-xs transition-all hover:-translate-y-0.5 card"
                    style={{ ':hover': { borderColor: 'var(--border-hover)' } } as React.CSSProperties}
                  >
                    <a.icon size={14} style={{ color: 'var(--accent-bright)', flexShrink: 0 }} />
                    <span style={{ color: 'var(--text-secondary)' }}>
                      {locale === 'my' ? a.labelMy : a.label}
                    </span>
                    <ChevronRight size={10} style={{ color: 'var(--text-muted)', marginLeft: 'auto', flexShrink: 0 }} />
                  </button>
                ))}
              </div>
            </div>
          ) : activeSession.messages.length === 0 ? (
            // Empty session
            <div className="flex flex-col items-center justify-center h-full gap-4">
              <Sparkles size={32} style={{ color: 'var(--accent)' }} />
              <div className="text-center">
                <p className="text-sm font-semibold text-white">
                  {locale === 'my' ? 'စကားပြောစတင်ပါ' : 'Start a conversation'}
                </p>
                <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                  {locale === 'my' ? 'မည်သည့်ရည်မှန်းချက်မဆို ပေးနိုင်သည်' : 'Give me any goal and I\'ll plan, code & execute it'}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2 max-w-lg w-full">
                {QUICK_ACTIONS.slice(0, 4).map((a, i) => (
                  <button
                    key={i}
                    onClick={() => handleQuickAction(a.prompt)}
                    className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs card transition-all hover:-translate-y-0.5"
                  >
                    <a.icon size={12} style={{ color: 'var(--accent-bright)' }} />
                    <span style={{ color: 'var(--text-secondary)' }}>
                      {locale === 'my' ? a.labelMy : a.label}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            // Messages
            <div className="max-w-3xl mx-auto">
              {activeSession.messages.map(msg => (
                <MessageBubble key={msg.id} msg={msg} />
              ))}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Input Bar */}
        <div className="p-4 shrink-0" style={{ borderTop: '1px solid var(--border)' }}>
          <div className="max-w-3xl mx-auto">
            <div className="flex gap-2 items-end">
              <div className="flex-1 relative">
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  disabled={isStreaming}
                  placeholder={locale === 'my'
                    ? 'ရည်မှန်းချက်တစ်ခုပေးပါ... ကျွန်ုပ် စီစဉ်၊ code ရေး၍ လုပ်ဆောင်မည်'
                    : "Give me a goal... I'll plan, code & execute autonomously (Shift+Enter for newline)"}
                  className="input resize-none"
                  style={{ minHeight: 44, maxHeight: 200, paddingRight: 12 }}
                  rows={1}
                  onInput={(e) => {
                    const t = e.target as HTMLTextAreaElement
                    t.style.height = 'auto'
                    t.style.height = Math.min(t.scrollHeight, 200) + 'px'
                  }}
                />
              </div>

              {isStreaming ? (
                <button
                  onClick={stopStreaming}
                  className="btn p-3 shrink-0"
                  style={{ background: 'rgba(239,68,68,0.12)', color: '#f87171', border: '1px solid rgba(239,68,68,0.2)' }}
                  title={locale === 'my' ? 'ရပ်ရန်' : 'Stop'}
                >
                  <Square size={16} />
                </button>
              ) : (
                <button
                  onClick={() => sendMessage(input)}
                  disabled={!input.trim() || isStreaming}
                  className="btn btn-primary p-3 shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"
                  title={locale === 'my' ? 'ပို့ရန်' : 'Send'}
                >
                  <Send size={16} />
                </button>
              )}
            </div>
            <div className="flex items-center gap-3 mt-2 px-1">
              <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                {isStreaming ? (
                  <span className="flex items-center gap-1" style={{ color: 'var(--accent-bright)' }}>
                    <Brain size={9} style={{ animation: 'pulse 1s infinite' }} />
                    {locale === 'my' ? 'Agent လုပ်ဆောင်နေသည်...' : 'Agent is working...'}
                  </span>
                ) : (
                  locale === 'my' ? 'Enter = ပို့ · Shift+Enter = လိုင်းသစ်' : 'Enter to send · Shift+Enter for new line'
                )}
              </span>
              <span className="ml-auto text-[10px]" style={{ color: 'var(--text-muted)' }}>
                {locale === 'my' ? 'God Mode v12 · Real Execution' : 'God Mode v12 · E2B Execution'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// End of ChatMainPage
