'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useAgentStore } from '@/hooks/useAgentStore'
import { useChatWebSocket } from '@/hooks/useWebSocket'
import { createTask, streamChatSSE } from '@/lib/api'
import { t } from '@/lib/i18n'
import MessageBubble from './MessageBubble'
import { Send, Square, Zap, MessageSquare, Code2, GitBranch, Brain, Rocket, Workflow, Bot } from 'lucide-react'

const QUICK_ACTIONS = [
  { icon: Code2,     labelEn: 'Build REST API',     labelMy: 'REST API တည်ဆောက်ရန်', prompt: 'Build a production-ready REST API with FastAPI, SQLite, JWT auth, and CRUD endpoints' },
  { icon: GitBranch, labelEn: 'Create GitHub Repo', labelMy: 'GitHub Repo ဖန်တီးရန်', prompt: 'Create a new GitHub repository with README, .gitignore, and initial project structure' },
  { icon: Brain,     labelEn: 'Analyze Codebase',   labelMy: 'Code စစ်ဆေးရန်', prompt: 'Analyze this project structure and suggest improvements for code quality and architecture' },
  { icon: Rocket,    labelEn: 'Deploy to Vercel',   labelMy: 'Vercel တင်ရန်', prompt: 'Generate Vercel deployment config with environment variables and CI/CD setup' },
  { icon: Workflow,  labelEn: 'Build n8n Workflow',  labelMy: 'n8n Workflow ဆောက်ရန်', prompt: 'Create an n8n automation workflow for a Telegram AI support bot' },
  { icon: Bot,       labelEn: 'Multi-Agent Task',    labelMy: 'Multi-Agent လုပ်ငန်း', prompt: 'Build a full-stack app: React frontend + FastAPI backend + SQLite DB + Dockerized' },
]

export default function ChatPanel() {
  const [input, setInput] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const store = useAgentStore()
  const { messages, sessionId, isStreaming, mode, locale, addMessage, setStreaming, appendChunk, updateMessage, setMode, addEvent } = store

  const { sendMessage, sendTask } = useChatWebSocket(sessionId)

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
        role: 'assistant',
        content: '',
        streaming: true,
        agent: 'planner',
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
            `Watch the **Timeline** panel for real-time execution events →\n\n` +
            `> 🤖 God Agent Orchestrator is routing to specialized agents...`
          ),
          streaming: false,
          agent: 'planner',
          metadata: { task_id: result.task_id, mode: 'agent' },
        })
        setStreaming(false, null)
      } catch (err: any) {
        updateMessage(assistantId, {
          content: `❌ **Task creation failed**\n\n${err.message}\n\nMake sure the backend is running at \`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}\``,
          streaming: false,
          agent: 'debug',
          metadata: { error: true },
        })
        setStreaming(false, null)
      }
    } else {
      // Streaming chat mode — via SSE
      const assistantId = addMessage({
        role: 'assistant',
        content: '',
        streaming: true,
        agent: 'chat',
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
        chatMessages,
        sessionId,
        (chunk) => appendChunk(assistantId, chunk),
        (full) => {
          updateMessage(assistantId, { content: full, streaming: false, agent: 'chat' })
          setStreaming(false, null)
        },
        (err) => {
          updateMessage(assistantId, {
            content: `❌ Stream error: ${err}`,
            streaming: false,
            agent: 'debug',
            metadata: { error: true },
          })
          setStreaming(false, null)
        }
      )
    }
  }, [input, isStreaming, mode, messages, sessionId, addMessage, setStreaming, appendChunk, updateMessage, addEvent, store, sendMessage])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  const stopStreaming = () => {
    if (store.streamingMessageId) {
      updateMessage(store.streamingMessageId, { streaming: false })
    }
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
            {locale === 'my' ? 'Agent Chat' : 'Agent Chat'}
          </span>
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded"
            style={{ background: 'var(--bg-3)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
            {sessionId.slice(0, 14)}...
          </span>
        </div>

        {/* Mode switcher */}
        <div className="flex p-0.5 rounded-xl gap-0.5"
          style={{ background: 'var(--bg-3)', border: '1px solid var(--border)' }}>
          <button onClick={() => setMode('agent')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
              mode === 'agent' ? 'text-white shadow-lg' : 'hover:opacity-80'
            }`}
            style={{
              background: mode === 'agent' ? 'var(--brand)' : 'transparent',
              color: mode === 'agent' ? '#fff' : 'var(--text-muted)',
            }}>
            <Zap size={11} />
            {locale === 'my' ? 'Agent' : 'Agent'}
          </button>
          <button onClick={() => setMode('chat')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition-all`}
            style={{
              background: mode === 'chat' ? 'var(--bg-4)' : 'transparent',
              color: mode === 'chat' ? 'var(--text-primary)' : 'var(--text-muted)',
            }}>
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
              <div className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center"
                style={{ background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.25)' }}>
                <Zap size={28} className="text-indigo-400" />
              </div>
              <h2 className="text-xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>
                {locale === 'my' ? 'God Mode+ AI OS' : 'God Mode+ AI OS'}
              </h2>
              <p className="text-sm max-w-xs mx-auto" style={{ color: 'var(--text-secondary)' }}>
                {locale === 'my'
                  ? 'ရည်မှန်းချက်တစ်ခုပေးပါ — ကျွန်ုပ် multi-agent system ဖြင့် အလိုအလျောက်ပြင်ဆင်၊ code ရေး၍ deploy လုပ်မည်'
                  : 'Give me a goal — I\'ll autonomously plan, code, debug & deploy using 10 specialized agents'}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2 w-full max-w-md">
              {QUICK_ACTIONS.map(({ icon: Icon, labelEn, labelMy, prompt }) => (
                <button key={labelEn}
                  onClick={() => { setInput(prompt); inputRef.current?.focus() }}
                  className="flex items-center gap-2 p-3 rounded-xl text-left transition-all group hover:scale-[1.02] active:scale-95"
                  style={{
                    background: 'var(--bg-3)',
                    border: '1px solid var(--border)',
                  }}
                  onMouseEnter={e => {
                    (e.currentTarget as HTMLElement).style.borderColor = 'var(--brand)'
                    ;(e.currentTarget as HTMLElement).style.background = 'var(--bg-4)'
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'
                    ;(e.currentTarget as HTMLElement).style.background = 'var(--bg-3)'
                  }}
                >
                  <Icon size={14} className="text-indigo-400 flex-shrink-0" />
                  <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                    {locale === 'my' ? labelMy : labelEn}
                  </span>
                </button>
              ))}
            </div>

            {/* Mode hint */}
            <div className="flex items-center gap-4 text-[11px]" style={{ color: 'var(--text-muted)' }}>
              <div className="flex items-center gap-1">
                <Zap size={10} className="text-indigo-400" />
                {locale === 'my' ? 'Agent Mode — Task တစ်ခုဖန်တီးမည်' : 'Agent Mode — creates autonomous task'}
              </div>
              <div className="flex items-center gap-1">
                <MessageSquare size={10} className="text-slate-400" />
                {locale === 'my' ? 'Chat Mode — တိုက်ရိုက်စကားပြောမည်' : 'Chat Mode — direct conversation'}
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

      {/* Input Area */}
      <div className="px-4 pb-4 pt-2 border-t shrink-0" style={{ borderColor: 'var(--border)', background: 'var(--bg-2)' }}>
        <form onSubmit={handleSubmit}>
          <div className={`relative rounded-2xl transition-all ${
            isStreaming ? 'ring-2 ring-indigo-500/40' : 'hover:ring-1 hover:ring-white/10 focus-within:ring-2 focus-within:ring-indigo-500/50'
          }`}
            style={{ background: 'var(--bg-3)', border: '1px solid var(--border)' }}>
            <textarea
              ref={inputRef}
              value={input}
              onChange={autoResize}
              onKeyDown={handleKeyDown}
              placeholder={locale === 'my'
                ? (mode === 'agent' ? 'ရည်မှန်းချက်တစ်ခုပေးပါ...' : 'မည်သည့်အရာမဆို မေးပါ...')
                : (mode === 'agent' ? "Give me a goal... I'll plan, code & execute it" : 'Ask anything... (Shift+Enter for newline)')
              }
              disabled={isStreaming}
              rows={1}
              className="w-full bg-transparent text-sm px-4 py-3 pr-14 resize-none outline-none max-h-40 overflow-auto"
              style={{
                color: 'var(--text-primary)',
                minHeight: '48px',
              }}
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
                  className="p-2 rounded-xl transition-all disabled:opacity-30 disabled:cursor-not-allowed active:scale-90"
                  style={{ background: input.trim() ? 'var(--brand)' : 'var(--bg-4)' }}>
                  <Send size={14} className="text-white" />
                </button>
              )}
            </div>
          </div>
          <div className="flex items-center justify-between mt-1.5 px-1">
            <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
              {mode === 'agent'
                ? (locale === 'my' ? '⚡ Agent Mode — 10 Agent များ ပူးပေါင်းဆောင်ရွက်မည်' : '⚡ Agent Mode — 10 agents collaborate autonomously')
                : (locale === 'my' ? '💬 Chat Mode — God Agent ဖြင့် တိုက်ရိုက်စကားပြောမည်' : '💬 Chat Mode — direct conversation with God Agent')}
            </span>
            <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
              {locale === 'my' ? 'Enter ↵ ပို့ရန်' : 'Enter ↵ to send'}
            </span>
          </div>
        </form>
      </div>
    </div>
  )
}
