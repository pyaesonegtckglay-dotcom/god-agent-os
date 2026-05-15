'use client'

import { useState, useRef, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Terminal, Mic, Send } from 'lucide-react'

const COMMANDS = ['/new-project', '/analyze-competitors', '/generate-report', '/deploy-app', '/automate-workflow', '/research']
const LINES = [
  { text: '> God Agent OS is listening...', color: '#6366f1' },
  { text: '> Multi-agent system ready. Gemini · Sambanova · GitHub Models active.', color: '#22d3ee' },
  { text: '> How may I assist in your divine mission?', color: 'var(--text-secondary)' },
]

export default function CommandCenter() {
  const [input, setInput] = useState('')
  const [history, setHistory] = useState<string[]>([])
  const inputRef = useRef<HTMLInputElement>(null)

  const handleSubmit = (cmd?: string) => {
    const command = cmd || input.trim()
    if (!command) return
    setHistory(prev => [...prev, `> ${command}`, '  Executing…'])
    setInput('')
    setTimeout(() => {
      setHistory(prev => [...prev, '  ✓ Task dispatched to agent fleet.'])
    }, 800)
  }

  return (
    <div className="card overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: 'var(--border)' }}>
        <div className="flex items-center gap-2">
          <Terminal size={14} className="text-purple-400" />
          <span className="text-xs font-bold text-white">Command Center</span>
          <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse-glow" />
        </div>
        <button className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-medium transition-all hover:bg-purple-500/10"
          style={{ background: 'rgba(124,58,237,0.08)', border: '1px solid rgba(124,58,237,0.2)', color: '#a78bfa' }}>
          <Mic size={11} />
          Voice Command
        </button>
      </div>

      {/* Terminal */}
      <div className="terminal mx-3 mt-3 mb-2 p-3 min-h-[80px]">
        {LINES.map((line, i) => (
          <div key={i} className="text-xs leading-relaxed" style={{ color: line.color }}>{line.text}</div>
        ))}
        {history.map((line, i) => (
          <div key={`h${i}`} className="text-xs leading-relaxed text-slate-400">{line}</div>
        ))}
      </div>

      {/* Command Chips */}
      <div className="flex flex-wrap gap-2 px-3 pb-3">
        {COMMANDS.map(cmd => (
          <button key={cmd} onClick={() => handleSubmit(cmd)}
            className="chip text-xs">
            {cmd}
          </button>
        ))}
        <div className="flex gap-2 ml-auto">
          <input
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSubmit()}
            placeholder="Custom command…"
            className="cmd-input px-3 py-1.5 text-xs w-36"
          />
          <button onClick={() => handleSubmit()}
            className="p-1.5 rounded-lg transition-colors hover:bg-purple-500/20"
            style={{ background: 'rgba(124,58,237,0.1)', border: '1px solid rgba(124,58,237,0.2)' }}>
            <Send size={12} className="text-purple-400" />
          </button>
        </div>
      </div>
    </div>
  )
}
