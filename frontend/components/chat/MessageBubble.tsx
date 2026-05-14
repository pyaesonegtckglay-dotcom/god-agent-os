'use client'

import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { Copy, Check, User, Bot, Code2, Bug, Zap, Brain, Plug, Rocket, Workflow, Terminal, Palette } from 'lucide-react'
import { useState } from 'react'
import type { Message, AgentName } from '@/hooks/useAgentStore'
import { formatDistanceToNow } from 'date-fns'

const AGENT_META: Record<string, { icon: React.ElementType; color: string; label: string }> = {
  chat:      { icon: Bot,           color: '#22d3ee', label: 'Chat' },
  planner:   { icon: Zap,           color: '#a78bfa', label: 'Planner' },
  coding:    { icon: Code2,         color: '#34d399', label: 'Coding' },
  debug:     { icon: Bug,           color: '#f87171', label: 'Debug' },
  memory:    { icon: Brain,         color: '#fbbf24', label: 'Memory' },
  connector: { icon: Plug,          color: '#60a5fa', label: 'Connector' },
  deploy:    { icon: Rocket,        color: '#f472b6', label: 'Deploy' },
  workflow:  { icon: Workflow,      color: '#fb923c', label: 'Workflow' },
  sandbox:   { icon: Terminal,      color: '#4ade80', label: 'Sandbox' },
  ui:        { icon: Palette,       color: '#e879f9', label: 'UI' },
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000) }}
      className="absolute top-2 right-2 p-1.5 rounded-md opacity-0 group-hover:opacity-100 transition-opacity"
      style={{ background: 'rgba(255,255,255,0.1)' }}
    >
      {copied ? <Check size={12} className="text-green-400" /> : <Copy size={12} style={{ color: 'var(--text-muted)' }} />}
    </button>
  )
}

export default function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === 'user'
  const agentMeta = message.agent ? AGENT_META[message.agent] : AGENT_META['chat']
  const AgentIcon = agentMeta?.icon || Bot

  return (
    <div className={`flex gap-3 mb-4 animate-fade-in ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
      {/* Avatar */}
      <div className="flex-shrink-0 mt-1">
        {isUser ? (
          <div className="w-7 h-7 rounded-full flex items-center justify-center"
            style={{ background: 'rgba(99,102,241,0.2)', border: '1px solid rgba(99,102,241,0.4)' }}>
            <User size={14} className="text-indigo-400" />
          </div>
        ) : (
          <div className="w-7 h-7 rounded-full flex items-center justify-center"
            style={{
              background: `${agentMeta?.color || '#6366f1'}15`,
              border: `1px solid ${agentMeta?.color || '#6366f1'}40`,
            }}>
            <AgentIcon size={13} style={{ color: agentMeta?.color || '#6366f1' }} />
          </div>
        )}
      </div>

      {/* Content */}
      <div className={`flex-1 min-w-0 ${isUser ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
        {/* Header */}
        {!isUser && (
          <div className="flex items-center gap-2 mb-1">
            {message.agent && (
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
                style={{
                  background: `${agentMeta.color}15`,
                  color: agentMeta.color,
                  border: `1px solid ${agentMeta.color}30`,
                }}>
                {agentMeta.label}Agent
              </span>
            )}
            <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
              {formatDistanceToNow(message.timestamp, { addSuffix: true })}
            </span>
          </div>
        )}

        {/* Bubble */}
        <div className={`rounded-2xl px-4 py-3 max-w-[85%] ${
          isUser
            ? 'rounded-tr-sm text-white'
            : 'rounded-tl-sm'
        }`}
          style={{
            background: isUser ? 'var(--brand)' : 'var(--bg-3)',
            border: isUser ? 'none' : '1px solid var(--border)',
          }}>
          {isUser ? (
            <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.content}</p>
          ) : (
            <div className="prose-god text-sm">
              {message.streaming && !message.content ? (
                <div className="flex items-center gap-1 py-1">
                  {[0, 1, 2].map(i => (
                    <div key={i} className="typing-dot" style={{ animationDelay: `${i * 0.16}s` }} />
                  ))}
                </div>
              ) : (
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    code({ node, inline, className, children, ...props }: any) {
                      const match = /language-(\w+)/.exec(className || '')
                      const code = String(children).replace(/\n$/, '')
                      if (!inline && match) {
                        return (
                          <div className="relative group my-2">
                            <div className="flex items-center justify-between px-3 py-1.5 rounded-t-lg"
                              style={{ background: '#1a1b26', borderBottom: '1px solid var(--border)' }}>
                              <span className="text-[10px] font-mono" style={{ color: 'var(--text-muted)' }}>
                                {match[1]}
                              </span>
                              <CopyButton text={code} />
                            </div>
                            <SyntaxHighlighter
                              style={oneDark as any}
                              language={match[1]}
                              PreTag="div"
                              customStyle={{
                                margin: 0,
                                borderRadius: '0 0 8px 8px',
                                fontSize: '0.75rem',
                                background: '#0f1017',
                                border: '1px solid var(--border)',
                                borderTop: 'none',
                              }}
                              {...props}
                            >
                              {code}
                            </SyntaxHighlighter>
                          </div>
                        )
                      }
                      return (
                        <code className={className} {...props}
                          style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.8em' }}>
                          {children}
                        </code>
                      )
                    },
                  }}
                >
                  {message.content}
                </ReactMarkdown>
              )}
              {message.streaming && message.content && (
                <span className="inline-block w-0.5 h-4 ml-0.5 animate-pulse rounded-full"
                  style={{ background: 'var(--brand)', verticalAlign: 'middle' }} />
              )}
            </div>
          )}
        </div>

        {/* Metadata badges */}
        {message.metadata?.task_id && (
          <div className="flex items-center gap-1 mt-0.5">
            <span className="text-[10px] px-1.5 py-0.5 rounded font-mono"
              style={{ background: 'var(--bg-3)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
              {message.metadata.task_id}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
