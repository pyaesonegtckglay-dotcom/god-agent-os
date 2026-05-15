'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Send, Telescope, Code2, Zap, BarChart2, PenLine, MoreHorizontal, Loader2, Mic } from 'lucide-react'

const QUICK_ACTIONS = [
  { icon: Telescope, label: 'Research',   color: '#6366f1', prompt: 'Research the latest trends in ' },
  { icon: Code2,     label: 'Build',      color: '#34d399', prompt: 'Build and deploy a ' },
  { icon: Zap,       label: 'Automate',   color: '#f59e0b', prompt: 'Create an automation workflow for ' },
  { icon: BarChart2, label: 'Analyze',    color: '#22d3ee', prompt: 'Analyze data and generate insights for ' },
  { icon: PenLine,   label: 'Generate',   color: '#a78bfa', prompt: 'Generate high-quality content for ' },
]

const EXAMPLE_PROMPTS = [
  'Build a complete marketing analysis dashboard with AI insights',
  'Research competitors in the SaaS market and synthesize findings',
  'Automate my GitHub PR review workflow with AI agents',
  'Analyze Q4 performance data and generate executive summary',
]

export default function MissionInput() {
  const [prompt, setPrompt] = useState('')
  const [loading, setLoading] = useState(false)
  const [selectedAction, setSelectedAction] = useState<string | null>(null)

  const handleAction = (actionPrompt: string, label: string) => {
    setPrompt(actionPrompt)
    setSelectedAction(label)
  }

  const handleSubmit = async () => {
    if (!prompt.trim() || loading) return
    setLoading(true)
    await new Promise(r => setTimeout(r, 2000))
    setLoading(false)
    setPrompt('')
    setSelectedAction(null)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit() }
  }

  return (
    <div className="card p-5">
      {/* Header */}
      <div className="flex items-start gap-3 mb-4">
        <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: 'rgba(124,58,237,0.15)', border: '1px solid rgba(124,58,237,0.25)' }}>
          <Zap size={15} className="text-purple-400" />
        </div>
        <div>
          <h2 className="text-base font-semibold text-white">What shall we build today?</h2>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
            Describe your mission. God Agent OS will orchestrate the rest.
          </p>
        </div>
      </div>

      {/* Input */}
      <div className="relative mb-3">
        <textarea
          value={prompt}
          onChange={e => setPrompt(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="e.g., Build a complete marketing analysis dashboard with AI insights…"
          rows={3}
          className="cmd-input w-full px-4 py-3 pr-12 text-sm resize-none"
          style={{ minHeight: 88, lineHeight: 1.6 }}
        />
        <div className="absolute right-3 bottom-3 flex items-center gap-2">
          <button className="p-1.5 rounded-lg text-slate-600 hover:text-purple-400 transition-colors">
            <Mic size={15} />
          </button>
          <motion.button
            onClick={handleSubmit}
            disabled={!prompt.trim() || loading}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="w-8 h-8 rounded-lg flex items-center justify-center transition-all disabled:opacity-40"
            style={{ background: prompt.trim() && !loading ? 'linear-gradient(135deg, #7c3aed, #4f46e5)' : 'rgba(255,255,255,0.08)' }}
          >
            {loading ? <Loader2 size={14} className="text-white animate-spin" /> : <Send size={14} className="text-white" />}
          </motion.button>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="flex flex-wrap gap-2">
        {QUICK_ACTIONS.map(({ icon: Icon, label, color, prompt: p }) => (
          <button
            key={label}
            onClick={() => handleAction(p, label)}
            className={`chip transition-all ${selectedAction === label ? 'border-purple-500/40 bg-purple-500/10 text-purple-300' : ''}`}
          >
            <Icon size={12} style={{ color }} />
            {label}
          </button>
        ))}
        <button className="chip">
          <MoreHorizontal size={12} />
          More
        </button>
      </div>

      {/* Example prompts */}
      <AnimatePresence>
        {!prompt && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="mt-3 pt-3 border-t" style={{ borderColor: 'var(--border)' }}>
            <div className="text-xs mb-2 font-medium" style={{ color: 'var(--text-muted)' }}>Quick start:</div>
            <div className="space-y-1">
              {EXAMPLE_PROMPTS.slice(0, 2).map(ep => (
                <button key={ep} onClick={() => setPrompt(ep)}
                  className="w-full text-left text-xs px-3 py-1.5 rounded-lg hover:bg-white/[0.04] text-slate-500 hover:text-slate-300 transition-colors truncate">
                  → {ep}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
