'use client'

import { Message } from '@/types'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { Copy, Check, Bot, User } from 'lucide-react'
import { useState, memo } from 'react'
import { formatDistanceToNow } from 'date-fns'

interface Props { message: Message }

const CopyButton = ({ text }: { text: string }) => {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <button onClick={copy} className="absolute top-2 right-2 p-1.5 rounded-md bg-[#2a2b3d] hover:bg-[#3a3b5a] opacity-0 group-hover:opacity-100 transition-all">
      {copied ? <Check size={12} className="text-terminal-green" /> : <Copy size={12} className="text-slate-400" />}
    </button>
  )
}

const TypingIndicator = () => (
  <div className="flex gap-1 items-center h-5 px-1">
    {[0,1,2].map(i => (
      <div key={i} className="typing-dot" style={{ animationDelay: `${i * 0.2}s` }} />
    ))}
  </div>
)

const MessageBubble = memo(({ message }: Props) => {
  const isUser = message.role === 'user'
  const isSystem = message.role === 'system'
  const isStreaming = message.streaming
  const isEmpty = !message.content && isStreaming

  const time = formatDistanceToNow(new Date(message.timestamp * 1000), { addSuffix: true })

  if (isSystem) {
    return (
      <div className="flex justify-center my-2">
        <div className="px-3 py-1 rounded-full bg-[#1a1b26] border border-[#2a2b3d] text-xs text-slate-500">
          {message.content}
        </div>
      </div>
    )
  }

  return (
    <div className={`flex gap-3 py-2 px-1 message-enter ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
      {/* Avatar */}
      <div className={`flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center ${
        isUser ? 'bg-brand-500/20 border border-brand-500/30' : 'bg-[#1a1b26] border border-[#2a2b3d]'
      }`}>
        {isUser
          ? <User size={14} className="text-brand-400" />
          : <Bot size={14} className="text-terminal-green" />
        }
      </div>

      {/* Bubble */}
      <div className={`flex-1 max-w-[85%] ${isUser ? 'items-end flex flex-col' : ''}`}>
        <div className={`rounded-xl px-4 py-3 relative ${
          isUser
            ? 'bg-brand-500/15 border border-brand-500/25 text-slate-200'
            : 'bg-[#1a1b26] border border-[#2a2b3d] text-slate-200'
        } ${isStreaming ? 'glow-border' : ''}`}>
          {isEmpty ? (
            <TypingIndicator />
          ) : (
            <div className={`prose-dark text-sm leading-relaxed ${isStreaming ? 'cursor-blink' : ''}`}>
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  code({ node, inline, className, children, ...props }: any) {
                    const match = /language-(\w+)/.exec(className || '')
                    const code = String(children).replace(/\n$/, '')
                    return !inline && match ? (
                      <div className="relative group my-2">
                        <div className="flex items-center justify-between px-3 py-1.5 bg-[#0a0b10] border border-[#2a2b3d] rounded-t-lg border-b-0">
                          <span className="text-[10px] text-slate-500 font-mono uppercase">{match[1]}</span>
                          <CopyButton text={code} />
                        </div>
                        <SyntaxHighlighter
                          style={oneDark}
                          language={match[1]}
                          PreTag="div"
                          customStyle={{
                            margin: 0,
                            borderRadius: '0 0 8px 8px',
                            fontSize: '12px',
                            background: '#0a0b10',
                            border: '1px solid #2a2b3d',
                            borderTop: 'none',
                          }}
                          {...props}
                        >
                          {code}
                        </SyntaxHighlighter>
                      </div>
                    ) : (
                      <code className="bg-[#1a1b26] text-purple-300 px-1.5 py-0.5 rounded text-xs font-mono border border-[#2a2b3d]" {...props}>
                        {children}
                      </code>
                    )
                  },
                  p: ({ children }) => <p className="mb-2 last:mb-0 text-slate-200">{children}</p>,
                  ul: ({ children }) => <ul className="list-disc list-inside mb-2 space-y-1 text-slate-300">{children}</ul>,
                  ol: ({ children }) => <ol className="list-decimal list-inside mb-2 space-y-1 text-slate-300">{children}</ol>,
                  li: ({ children }) => <li className="text-slate-300 text-sm">{children}</li>,
                  h1: ({ children }) => <h1 className="text-lg font-bold text-slate-100 mb-2">{children}</h1>,
                  h2: ({ children }) => <h2 className="text-base font-semibold text-slate-100 mb-2">{children}</h2>,
                  h3: ({ children }) => <h3 className="text-sm font-semibold text-slate-200 mb-1">{children}</h3>,
                  blockquote: ({ children }) => (
                    <blockquote className="border-l-2 border-brand-500 pl-3 text-slate-400 italic my-2">{children}</blockquote>
                  ),
                  strong: ({ children }) => <strong className="font-semibold text-slate-100">{children}</strong>,
                  a: ({ href, children }) => (
                    <a href={href} target="_blank" rel="noopener noreferrer" className="text-brand-400 hover:underline">{children}</a>
                  ),
                  table: ({ children }) => (
                    <div className="overflow-x-auto my-2">
                      <table className="text-xs border-collapse w-full">{children}</table>
                    </div>
                  ),
                  th: ({ children }) => <th className="bg-[#1a1b26] px-3 py-1.5 text-left text-slate-300 border border-[#2a2b3d]">{children}</th>,
                  td: ({ children }) => <td className="px-3 py-1.5 text-slate-400 border border-[#2a2b3d]">{children}</td>,
                  hr: () => <hr className="border-[#2a2b3d] my-3" />,
                }}
              >
                {message.content}
              </ReactMarkdown>
            </div>
          )}
        </div>

        {/* Metadata row */}
        <div className={`flex items-center gap-2 mt-1 px-1 ${isUser ? 'flex-row-reverse' : ''}`}>
          <span className="text-[10px] text-slate-600">{time}</span>
          {message.metadata?.task_id && (
            <span className="text-[10px] font-mono text-brand-400/70">
              {message.metadata.task_id}
            </span>
          )}
          {isStreaming && (
            <span className="text-[10px] text-brand-400 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-brand-400 animate-pulse" />
              streaming
            </span>
          )}
        </div>
      </div>
    </div>
  )
})
MessageBubble.displayName = 'MessageBubble'
export default MessageBubble
