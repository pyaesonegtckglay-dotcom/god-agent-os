'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useAgentStore } from '@/hooks/useAgentStore'
import { streamChatSSE } from '@/lib/websocket'
import { createTask } from '@/lib/api'
import MessageBubble from './MessageBubble'
import { Send, Loader2, Zap, Code2, GitBranch, Brain, Square } from 'lucide-react'

const QUICK_ACTIONS = [
  { icon: Code2, label: 'Build a REST API', prompt: 'Build a production-ready REST API with FastAPI, SQLite, authentication, and CRUD endpoints for a todo app' },
  { icon: GitBranch, label: 'Create GitHub repo', prompt: 'Create a new GitHub repository, initialize it with a README, add a .gitignore for Python, and push initial code' },
  { icon: Brain, label: 'Analyze codebase', prompt: 'Analyze the current project structure and suggest improvements for code quality, performance, and maintainability' },
  { icon: Zap, label: 'Deploy to Vercel', prompt: 'Deploy this application to Vercel with proper environment variables and generate a production URL' },
]

export default function ChatPanel() {
  const [input, setInput] = useState('')
  const [mode, setMode] = useState<'chat' | 'agent'>('agent')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  const store = useAgentStore()
  const { messages, sessionId, isStreaming, addMessage, setStreaming, appendChunk, updateMessage } = store

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSubmit = useCallback(async (e?: React.FormEvent) => {
    e?.preventDefault()
    const text = input.trim()
    if (!text || isStreaming) return

    setInput('')
    inputRef.current?.focus()

    // Add user message
    addMessage({ role: 'user', content: text })

    if (mode === 'agent') {
      // Create autonomous task
      try {
        const assistantId = addMessage({
          role: 'assistant',
          content: '',
          streaming: true,
          metadata: { mode: 'agent' },
        })
        setStreaming(true, assistantId)

        const result = await createTask(text, sessionId)

        updateMessage(assistantId, {
          content: `🚀 **Task Created** \`${result.task_id}\`\n\nConnecting to execution stream... Watch the timeline →\n\n**Goal:** ${text}`,
          streaming: false,
          metadata: { task_id: result.task_id, mode: 'agent' },
        })
        setStreaming(false, null)
      } catch (err: any) {
        const id = addMessage({
          role: 'assistant',
          content: `❌ Failed to create task: ${err.message}\n\nMake sure the backend is running at \`${process.env.NEXT_PUBLIC_API_URL}\``,
          metadata: { error: true },
        })
        setStreaming(false, null)
      }
    } else {
      // Streaming chat mode
      const assistantId = addMessage({
        role: 'assistant',
        content: '',
        streaming: true,
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
          updateMessage(assistantId, { content: full, streaming: false })
          setStreaming(false, null)
        },
        (err) => {
          updateMessage(assistantId, {
            content: `❌ Stream error: ${err}`,
            streaming: false,
            metadata: { error: true },
          })
          setStreaming(false, null)
        }
      )
    }
  }, [input, isStreaming, mode, messages, sessionId, addMessage, setStreaming, appendChunk, updateMessage])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  const stopStreaming = () => {
    abortRef.current?.abort()
    setStreaming(false, null)
    if (store.streamingMessageId) {
      updateMessage(store.streamingMessageId, { streaming: false, content: store.messages.find(m => m.id === store.streamingMessageId)?.content + ' [stopped]' })
    }
  }

  return (
    <div className="flex flex-col h-full bg-[#0f1017]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#2a2b3d]">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-terminal-green animate-pulse" />
          <span className="text-sm font-semibold text-slate-200">Agent Chat</span>
          <span className="text-xs text-slate-500 font-mono">{sessionId.slice(0, 12)}...</span>
        </div>
        {/* Mode switcher */}
        <div className="flex bg-[#1a1b26] rounded-lg p-0.5 border border-[#2a2b3d]">
          {(['agent', 'chat'] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                mode === m
                  ? 'bg-brand-500 text-white shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {m === 'agent' ? '⚡ Agent' : '💬 Chat'}
            </button>
          ))}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-1">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-6 py-8">
            <div className="text-center">
              <div className="text-5xl mb-4">🤖</div>
              <h2 className="text-xl font-bold text-slate-200 mb-2">Devin Agent</h2>
              <p className="text-sm text-slate-400 max-w-xs">
                Autonomous AI engineering platform. Give me a goal and I'll plan, code, and execute it.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2 w-full max-w-sm">
              {QUICK_ACTIONS.map(({ icon: Icon, label, prompt }) => (
                <button
                  key={label}
                  onClick={() => { setInput(prompt); inputRef.current?.focus() }}
                  className="flex items-center gap-2 p-3 rounded-xl bg-[#1a1b26] border border-[#2a2b3d] hover:border-brand-500 hover:bg-[#1e2035] transition-all text-left group"
                >
                  <Icon size={14} className="text-brand-400 flex-shrink-0" />
                  <span className="text-xs text-slate-300 group-hover:text-slate-100">{label}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} />
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="px-4 pb-4 pt-2 border-t border-[#2a2b3d]">
        <form onSubmit={handleSubmit} className="relative">
          <div className={`relative rounded-xl border transition-all ${
            isStreaming ? 'border-brand-500/50 bg-[#1a1b26]' : 'border-[#2a2b3d] bg-[#1a1b26] hover:border-[#3a3b5a] focus-within:border-brand-500'
          }`}>
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                mode === 'agent'
                  ? "Give me a goal... (e.g. 'Build a REST API with auth')"
                  : "Ask anything... (Shift+Enter for newline)"
              }
              disabled={isStreaming}
              rows={1}
              className="w-full bg-transparent text-slate-200 placeholder-slate-500 text-sm px-4 py-3 pr-12 resize-none outline-none max-h-32 overflow-auto"
              style={{ minHeight: '44px' }}
            />
            <div className="absolute right-2 bottom-2">
              {isStreaming ? (
                <button
                  type="button"
                  onClick={stopStreaming}
                  className="p-2 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-400 transition-all"
                  title="Stop"
                >
                  <Square size={14} />
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={!input.trim()}
                  className="p-2 rounded-lg bg-brand-500 hover:bg-brand-600 disabled:opacity-30 disabled:cursor-not-allowed text-white transition-all"
                >
                  <Send size={14} />
                </button>
              )}
            </div>
          </div>
          <div className="flex items-center justify-between mt-1.5 px-1">
            <span className="text-[10px] text-slate-600">
              {mode === 'agent' ? '⚡ Agent mode — creates autonomous tasks' : '💬 Chat mode — direct conversation'}
            </span>
            <span className="text-[10px] text-slate-600">Enter to send</span>
          </div>
        </form>
      </div>
    </div>
  )
}
