'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useAgentStore } from '@/hooks/useAgentStore'
import { useChatWebSocket } from '@/hooks/useWebSocket'
import { fetchAPI } from '@/lib/api'
const createTask = (goal: any, sessionId?: string) => fetchAPI('/api/v1/tasks/', { method: 'POST', body: JSON.stringify({ goal, session_id: sessionId }) })
const streamChatSSE = async (msgs: any[], sessionId: string, onChunk: (c: string) => void, onDone: (f: string) => void, onErr: (e: string) => void) => {
  try {
    const res = await fetchAPI('/api/v1/kernel/orchestrate', { method: 'POST', body: JSON.stringify({ message: msgs[msgs.length-1]?.content || '', session_id: sessionId }) })
    onDone(res.result || 'Response received.')
  } catch(e: any) { onErr(e.message) }
}
import MessageBubble from './MessageBubble'
import {
  Send, Square, Zap, MessageSquare, Code2, GitBranch, Brain,
  Rocket, Workflow, Bot, Globe, Folder, FlaskConical, Eye, Terminal
} from 'lucide-react'

const QUICK_ACTIONS = [
  { icon: Code2,       labelEn: 'Build REST API',      labelMy: 'REST API တည်ဆောက်', prompt: 'Build a production-ready REST API with FastAPI, SQLite, JWT auth, and full CRUD endpoints' },
  { icon: Globe,       labelEn: 'Research Web',         labelMy: 'Web ရှာဖွေ',         prompt: 'Research the latest AI agent frameworks and compare Manus, Genspark, and Devin capabilities' },
  { icon: Folder,      labelEn: 'Scaffold Project',     labelMy: 'Project ဖန်တီး',     prompt: 'Create a full-stack project: Next.js 14 frontend + FastAPI backend + Docker + CI/CD pipeline' },
  { icon: GitBranch,   labelEn: 'Git Operations',       labelMy: 'Git လုပ်ဆောင်',     prompt: 'Create a new GitHub repository with proper structure, README, .gitignore, and initial commit' },
  { icon: FlaskConical,labelEn: 'Generate Tests',       labelMy: 'Test ရေး',           prompt: 'Generate comprehensive pytest tests with fixtures, mocks, and edge cases for a FastAPI app' },
  { icon: Eye,         labelEn: 'Generate UI',          labelMy: 'UI ဒီဇိုင်း',       prompt: 'Create a stunning dark-themed admin dashboard with React, Tailwind, glassmorphism, and charts' },
  { icon: Rocket,      labelEn: 'Deploy to Vercel',     labelMy: 'Vercel တင်',         prompt: 'Generate Vercel deployment config with environment variables, edge functions, and CI/CD' },
  { icon: Bot,         labelEn: 'Multi-Agent Task',     labelMy: 'Multi-Agent',         prompt: 'Build a full autonomous AI agent system: plan, code, test, and deploy a Telegram AI bot' },
]

export default function ChatPanel() {
  const [input, setInput] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const store = useAgentStore()
  const { messages, sessionId, isStreaming, mode, locale, addMessage, setStreaming, appendChunk, updateMessage, setMode, addEvent } = store

  const { sendMessage } = useChatWebSocket(sessionId)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSubmit = useCallback(async (e?: React.FormEvent) => {
    e?.preventDefault()
    const text = input.trim()
    if (!text || isStreaming) return

    setInput('')
    inputRef.current?.focus()
    addMessage({ role: 'user', content: text })

    if (mode === 'agent') {
      const assistantId = addMessage({
        role: 'assistant', content: '', streaming: true, agent: 'planner',
        metadata: { mode: 'agent' },
      })
      setStreaming(true, assistantId)
      addEvent({ type: 'task_submitted', data: { goal: text, mode: 'agent' }, agent: 'planner' })

      try {
        const result = await createTask(text, sessionId)
        store.setActiveTaskId(result.task_id)
        updateMessage(assistantId, {
          content: (
            `🚀 **Task Created** \`${result.task_id}\`\n\n` +
            `**Goal:** ${text}\n\n` +
            `**Status:** Planning → Executing\n\n` +
            `> 🤖 God Agent v7 Orchestrator routing to specialized agents...\n\n` +
            `Watch the **Timeline** panel for real-time execution →`
          ),
          streaming: false, agent: 'planner',
          metadata: { task_id: result.task_id, mode: 'agent' },
        })
        setStreaming(false, null)
      } catch (err: any) {
        updateMessage(assistantId, {
          content: `❌ **Task failed**\n\n${err.message}\n\nMake sure the backend is running at \`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}\``,
          streaming: false, agent: 'debug', metadata: { error: true },
        })
        setStreaming(false, null)
      }
    } else {
      const assistantId = addMessage({
        role: 'assistant', content: '', streaming: true, agent: 'chat',
        metadata: { mode: 'chat' },
      })
      setStreaming(true, assistantId)

      const chatMessages = [
        ...messages.filter(m => !m.streaming).slice(-10).map(m => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
        })),
        { role: 'user' as const, content: text },
      ]

      await streamChatSSE(
        chatMessages, sessionId,
        (chunk) => appendChunk(assistantId, chunk),
        (full) => { updateMessage(assistantId, { content: full, streaming: false, agent: 'chat' }); setStreaming(false, null) },
        (err) => {
          updateMessage(assistantId, { content: `❌ Stream error: ${err}`, streaming: false, agent: 'debug', metadata: { error: true } })
          setStreaming(false, null)
        }
      )
    }
  }, [input, isStreaming, mode, messages, sessionId, addMessage, setStreaming, appendChunk, updateMessage, addEvent, store])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit() }
  }

  const stopStreaming = () => {
    if (store.streamingMessageId) updateMessage(store.streamingMessageId, { streaming: false })
    setStreaming(false, null)
  }

  const autoResize = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value)
    e.target.style.height = 'auto'
    e.target.style.height = Math.min(e.target.scrollHeight, 160) + 'px'
  }

  return (
    <div className="flex flex-col h-full" style={{ background: 'var(--bg-1)' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b shrink-0"
        style={{ borderColor: 'var(--border)', background: 'var(--bg-2)' }}>
        <div className="flex items-center gap-2.5">
          <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
            God Agent OS
          </span>
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded"
            style={{ background: 'rgba(99,102,241,0.12)', color: '#a5b4fc', border: '1px solid rgba(99,102,241,0.25)' }}>
            v7.0 · 16 agents
          </span>
        </div>

        {/* Mode switcher */}
        <div className="flex p-0.5 rounded-xl gap-0.5"
          style={{ background: 'var(--bg-3)', border: '1px solid var(--border)' }}>
          <button onClick={() => setMode('agent')}
            className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition-all"
            style={{ background: mode === 'agent' ? 'var(--brand)' : 'transparent', color: mode === 'agent' ? '#fff' : 'var(--text-muted)' }}>
            <Zap size={11} />
            {locale === 'my' ? 'Agent' : 'Agent'}
          </button>
          <button onClick={() => setMode('chat')}
            className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition-all"
            style={{ background: mode === 'chat' ? 'var(--bg-4)' : 'transparent', color: mode === 'chat' ? 'var(--text-primary)' : 'var(--text-muted)' }}>
            <MessageSquare size={11} />
            {locale === 'my' ? 'Chat' : 'Chat'}
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-6 py-8">
            <div className="text-center">
              <div className="w-20 h-20 rounded-3xl mx-auto mb-4 flex items-center justify-center relative"
                style={{ background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.25)' }}>
                <Zap size={32} className="text-indigo-400" />
                <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-bold text-white"
                  style={{ background: 'var(--brand)' }}>v7</div>
              </div>
              <h2 className="text-xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>
                {locale === 'my' ? 'GOD AGENT OS v7' : 'GOD AGENT OS v7'}
              </h2>
              <p className="text-xs mb-1 font-medium" style={{ color: '#a5b4fc' }}>
                Manus + Genspark + Devin (OneHand)
              </p>
              <p className="text-xs max-w-xs mx-auto mt-2" style={{ color: 'var(--text-secondary)' }}>
                {locale === 'my'
                  ? '16 AI Agent များဖြင့် plan, code, test, deploy အလိုအလျောက်ဆောင်ရွက်မည်'
                  : 'Give me any engineering goal — 16 agents will autonomously plan, code, test & deploy'}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2 w-full max-w-md">
              {QUICK_ACTIONS.map(({ icon: Icon, labelEn, labelMy, prompt }) => (
                <button key={labelEn}
                  onClick={() => { setInput(prompt); inputRef.current?.focus() }}
                  className="flex items-center gap-2 p-3 rounded-xl text-left transition-all hover:scale-[1.02] active:scale-95"
                  style={{ background: 'var(--bg-3)', border: '1px solid var(--border)' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(99,102,241,0.5)'; (e.currentTarget as HTMLElement).style.background = 'var(--bg-4)' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'; (e.currentTarget as HTMLElement).style.background = 'var(--bg-3)' }}>
                  <Icon size={13} className="text-indigo-400 flex-shrink-0" />
                  <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                    {locale === 'my' ? labelMy : labelEn}
                  </span>
                </button>
              ))}
            </div>

            <div className="flex items-center gap-4 text-[10px]" style={{ color: 'var(--text-muted)' }}>
              <div className="flex items-center gap-1">
                <Zap size={10} className="text-indigo-400" />
                {locale === 'my' ? 'Agent Mode — Autonomous Task' : 'Agent Mode — autonomous execution'}
              </div>
              <div className="flex items-center gap-1">
                <MessageSquare size={10} className="text-slate-400" />
                {locale === 'my' ? 'Chat Mode — တိုက်ရိုက်' : 'Chat Mode — direct conversation'}
              </div>
            </div>
          </div>
        ) : (
          <>
            {messages.map(msg => <MessageBubble key={msg.id} message={msg} />)}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Input */}
      <div className="px-4 pb-4 pt-2 border-t shrink-0" style={{ borderColor: 'var(--border)', background: 'var(--bg-2)' }}>
        <form onSubmit={handleSubmit}>
          <div className={`relative rounded-2xl transition-all ${isStreaming ? 'ring-2 ring-indigo-500/40' : 'focus-within:ring-2 focus-within:ring-indigo-500/50'}`}
            style={{ background: 'var(--bg-3)', border: '1px solid var(--border)' }}>
            <textarea
              ref={inputRef}
              value={input}
              onChange={autoResize}
              onKeyDown={handleKeyDown}
              placeholder={locale === 'my'
                ? (mode === 'agent' ? 'ရည်မှန်းချက်တစ်ခုပေးပါ... Agent 16 ကောင်ဆောင်ရွက်မည်' : 'မည်သည့်အရာမဆို မေးပါ...')
                : (mode === 'agent' ? "Describe any engineering goal... 16 agents will execute it" : 'Ask anything... (Shift+Enter for newline)')
              }
              disabled={isStreaming}
              rows={1}
              className="w-full bg-transparent text-sm px-4 py-3 pr-14 resize-none outline-none max-h-40 overflow-auto"
              style={{ color: 'var(--text-primary)', minHeight: '48px' }}
            />
            <div className="absolute right-2.5 bottom-2.5">
              {isStreaming ? (
                <button type="button" onClick={stopStreaming}
                  className="p-2 rounded-xl transition-all active:scale-90"
                  style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)' }}>
                  <Square size={14} className="text-red-400" />
                </button>
              ) : (
                <button type="submit" disabled={!input.trim()}
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
                ? '⚡ Agent Mode — 16 agents · Browser · File · Git · Test · Vision · Deploy'
                : '💬 Chat Mode — direct AI conversation'}
            </span>
            <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
              Enter ↵
            </span>
          </div>
        </form>
      </div>
    </div>
  )
}
