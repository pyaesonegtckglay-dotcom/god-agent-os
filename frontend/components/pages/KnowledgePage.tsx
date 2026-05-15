'use client'

import { motion } from 'framer-motion'
import { BookOpen, FileText, Globe, Code2, BarChart3, Search, Plus } from 'lucide-react'

const KNOWLEDGE_BASES = [
  { id: 1, name: 'Product Documentation', desc: 'Internal product specs and API docs', docs: 342, icon: FileText, color: '#6366f1', updated: '1h ago' },
  { id: 2, name: 'Market Intelligence', desc: 'Industry reports and competitor analysis', docs: 87, icon: Globe, color: '#22d3ee', updated: '2h ago' },
  { id: 3, name: 'Codebase Knowledge', desc: 'Source code patterns and architecture', docs: 1240, icon: Code2, color: '#34d399', updated: '30m ago' },
  { id: 4, name: 'Analytics Data', desc: 'Historical metrics and performance data', docs: 512, icon: BarChart3, color: '#a78bfa', updated: '15m ago' },
  { id: 5, name: 'Research Library', desc: 'Academic papers and research synthesis', docs: 234, icon: BookOpen, color: '#f59e0b', updated: '3h ago' },
]

export default function KnowledgePage() {
  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <BookOpen size={22} className="text-purple-400" /> Knowledge Base
          </h1>
          <p className="text-sm mt-1 text-slate-500">2,415 documents indexed across 5 knowledge bases</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input placeholder="Search knowledge…" className="cmd-input pl-9 pr-4 py-2.5 text-sm w-56" />
          </div>
          <button className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white hover:opacity-90 transition-all"
            style={{ background: 'linear-gradient(135deg, #7c3aed, #4f46e5)', boxShadow: '0 0 20px rgba(124,58,237,0.3)' }}>
            <Plus size={15} /> Add Source
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
        {KNOWLEDGE_BASES.map((kb, i) => (
          <motion.div key={kb.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.07 }} className="card p-5 cursor-pointer group relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-[2px]"
              style={{ background: `linear-gradient(90deg, ${kb.color}, transparent)` }} />

            <div className="flex items-start gap-4 mb-4">
              <div className="w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0"
                style={{ background: `${kb.color}15`, border: `1px solid ${kb.color}25` }}>
                <kb.icon size={18} style={{ color: kb.color }} />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-white group-hover:text-purple-300 transition-colors">{kb.name}</h3>
                <p className="text-xs mt-1 text-slate-500">{kb.desc}</p>
              </div>
            </div>

            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-slate-500">Documents</span>
              <span className="text-xs font-bold text-white">{kb.docs.toLocaleString()}</span>
            </div>
            <div className="progress-bar mb-3">
              <div className="progress-fill" style={{ width: `${Math.min(100, kb.docs / 15)}%`, background: `linear-gradient(90deg, ${kb.color}50, ${kb.color})` }} />
            </div>
            <div className="text-xs text-slate-600">Updated {kb.updated}</div>
          </motion.div>
        ))}

        {/* Add Knowledge Base Card */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: KNOWLEDGE_BASES.length * 0.07 }}
          className="card p-5 cursor-pointer group flex flex-col items-center justify-center min-h-[160px] border-dashed"
          style={{ borderStyle: 'dashed', borderColor: 'rgba(124,58,237,0.2)', background: 'rgba(124,58,237,0.03)' }}>
          <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3 group-hover:scale-110 transition-transform"
            style={{ background: 'rgba(124,58,237,0.1)', border: '1px solid rgba(124,58,237,0.2)' }}>
            <Plus size={18} className="text-purple-400" />
          </div>
          <span className="text-sm font-medium text-purple-400 group-hover:text-purple-300">Add Knowledge Base</span>
          <span className="text-xs text-slate-600 mt-1">Connect a new data source</span>
        </motion.div>
      </div>
    </div>
  )
}
