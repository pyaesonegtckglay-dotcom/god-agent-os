'use client'

import { motion } from 'framer-motion'
import { Brain, Database, Clock, Search, Tag } from 'lucide-react'

const MEMORIES = [
  { id: 1, title: 'Market Research — SaaS Competitors Q4', tags: ['research', 'market'], date: '2h ago', size: '48 KB', type: 'document', color: '#6366f1' },
  { id: 2, title: 'API Authentication Module Design', tags: ['code', 'architecture'], date: '5h ago', size: '12 KB', type: 'code', color: '#34d399' },
  { id: 3, title: 'Product Positioning Statement v3', tags: ['content', 'strategy'], date: '1d ago', size: '8 KB', type: 'text', color: '#a78bfa' },
  { id: 4, title: 'Database Schema — Users & Sessions', tags: ['code', 'database'], date: '2d ago', size: '22 KB', type: 'code', color: '#22d3ee' },
  { id: 5, title: 'Brand Voice Guidelines 2025', tags: ['content', 'brand'], date: '3d ago', size: '35 KB', type: 'document', color: '#f472b6' },
  { id: 6, title: 'Competitor Analysis Matrix', tags: ['research', 'strategy'], date: '4d ago', size: '61 KB', type: 'document', color: '#f59e0b' },
]

export default function MemoryPage() {
  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <Brain size={22} className="text-purple-400" /> Memory
          </h1>
          <p className="text-sm mt-1 text-slate-500">Persistent knowledge storage · 4,200 indexed documents</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input placeholder="Search memories…" className="cmd-input pl-9 pr-4 py-2.5 text-sm w-56" />
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: 'Total Memories', value: '4,200', icon: Database, color: '#6366f1' },
          { label: 'Storage Used', value: '2.4 GB', icon: Database, color: '#22d3ee' },
          { label: 'Last Indexed', value: '3m ago', icon: Clock, color: '#a78bfa' },
        ].map(stat => (
          <div key={stat.label} className="card p-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: `${stat.color}15` }}>
              <stat.icon size={16} style={{ color: stat.color }} />
            </div>
            <div>
              <div className="text-lg font-bold text-white">{stat.value}</div>
              <div className="text-xs text-slate-500">{stat.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Memory Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3">
        {MEMORIES.map((m, i) => (
          <motion.div key={m.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06 }} className="card p-4 cursor-pointer group">
            <div className="flex items-start gap-3 mb-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: `${m.color}15`, border: `1px solid ${m.color}20` }}>
                <Database size={14} style={{ color: m.color }} />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-semibold text-white leading-snug line-clamp-2 group-hover:text-purple-300 transition-colors">
                  {m.title}
                </h3>
                <div className="flex items-center gap-2 mt-1 text-xs text-slate-600">
                  <Clock size={10} /> {m.date} · {m.size}
                </div>
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {m.tags.map(tag => (
                <span key={tag} className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full"
                  style={{ background: `${m.color}10`, color: m.color, border: `1px solid ${m.color}20` }}>
                  <Tag size={9} /> {tag}
                </span>
              ))}
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  )
}
