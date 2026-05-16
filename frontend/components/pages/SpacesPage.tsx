'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Play, RefreshCw } from 'lucide-react'
import { useAppStore } from '@/store/useAppStore'
import { SPACE_CATALOG } from '@/lib/spaceCatalog'

export default function SpacesPage() {
  const { spaces, activeSpace } = useAppStore()
  const [selectedSpace, setSelectedSpace] = useState<string | null>(null)
  const [testTask, setTestTask] = useState('')
  const [testResult, setTestResult] = useState('')
  const [testing, setTesting] = useState(false)

  async function testSpace(spaceId: string) {
    if (!testTask.trim()) return
    setTesting(true)
    setTestResult('')
    try {
      const res = await fetch(`/api/v1/spaces/${spaceId}/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ task: testTask, role: 'cognition', session_id: 'spaces_test' }),
      })
      const data = await res.json()
      setTestResult(data.result || `Error: ${res.status} ${res.statusText}`)
    } catch (e: any) {
      setTestResult(`Connection error: ${e.message}`)
    }
    setTesting(false)
  }

  return (
    <div className="h-full overflow-y-auto p-6" style={{ background: '#05060d' }}>
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-white mb-1">Distributed Worker Spaces</h1>
          <p className="text-slate-500 text-sm">22 spaces across core cognition, execution, browser/UI, verification, deployment, memory, coordination, monitoring, session, and infrastructure layers.</p>
        </div>

        <div className="mb-6 p-4 rounded-xl border" style={{ background: '#07080f', borderColor: '#1e2035' }}>
          <div className="text-[10px] text-slate-600 font-bold uppercase tracking-widest mb-3">Architecture Overview</div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
            {Array.from(new Set(SPACE_CATALOG.map(space => space.layer))).map(layer => (
              <div key={layer} className="px-3 py-2 rounded-lg text-xs font-semibold text-slate-300" style={{ background: '#0b1020', border: '1px solid #1e2035' }}>
                <div className="text-[10px] text-violet-300 mb-1">{layer}</div>
                <div>{SPACE_CATALOG.filter(space => space.layer === layer).length} spaces</div>
              </div>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
          {SPACE_CATALOG.map((space, i) => {
            const spaceState = spaces[space.id]
            const isActive = spaceState?.active
            const isSelected = selectedSpace === space.id
            return (
              <motion.div key={space.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.02 }} onClick={() => setSelectedSpace(isSelected ? null : space.id)} className="p-4 rounded-xl border cursor-pointer transition-all hover:scale-[1.02]" style={{ background: isSelected ? `${space.color}10` : '#07080f', borderColor: isSelected ? `${space.color}50` : isActive ? `${space.color}30` : '#1e2035' }}>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-2xl">{space.icon}</span>
                  <div className="flex items-center gap-1">
                    <span className="text-[9px] px-1.5 py-0.5 rounded" style={{ background: `${space.color}20`, color: space.color }}>{space.layer}</span>
                    {isActive && <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: space.color }} />}
                  </div>
                </div>
                <h3 className="text-sm font-bold text-white mb-1">{space.name}</h3>
                <p className="text-[10px] text-slate-500 mb-3 leading-relaxed">{space.description}</p>
                <div className="space-y-2">
                  <div>
                    <div className="text-[9px] text-slate-700 mb-1">RESPONSIBILITIES</div>
                    <div className="flex flex-wrap gap-1">
                      {space.responsibilities.slice(0, 3).map(item => (
                        <span key={item} className="text-[8px] px-1.5 py-0.5 rounded" style={{ background: '#0d0e1a', color: '#94a3b8', border: '1px solid #1e2035' }}>{item}</span>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="text-[9px] text-slate-700">ROLES: <span style={{ color: space.color }}>{space.roles.join(', ')}</span></div>
                    {spaceState?.taskCount ? <span className="text-[9px]" style={{ color: space.color }}>{spaceState.taskCount} tasks</span> : null}
                  </div>
                </div>
              </motion.div>
            )
          })}
        </div>

        {selectedSpace && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="p-4 rounded-xl border" style={{ background: '#07080f', borderColor: `${SPACE_CATALOG.find(space => space.id === selectedSpace)?.color}40` }}>
            <div className="text-sm font-bold text-white mb-3">Test {SPACE_CATALOG.find(space => space.id === selectedSpace)?.icon} {selectedSpace}</div>
            <div className="flex gap-2 mb-3">
              <input value={testTask} onChange={e => setTestTask(e.target.value)} placeholder={`Enter a task for ${selectedSpace}...`} className="flex-1 px-3 py-2 rounded-lg text-sm text-slate-200 bg-black/20 outline-none" style={{ border: '1px solid #1e2035' }} onKeyDown={e => e.key === 'Enter' && testSpace(selectedSpace)} />
              <button onClick={() => testSpace(selectedSpace)} disabled={testing || !testTask.trim()} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50 transition-all" style={{ background: SPACE_CATALOG.find(space => space.id === selectedSpace)?.color }}>
                {testing ? <RefreshCw size={14} className="animate-spin" /> : <Play size={14} />}
                {testing ? 'Running...' : 'Execute'}
              </button>
            </div>
            {testResult && <div className="p-3 rounded-lg text-xs text-slate-300 whitespace-pre-wrap" style={{ background: '#0a0b14', border: '1px solid #1e2035' }}>{testResult}</div>}
          </motion.div>
        )}

        <div className="mt-6 p-4 rounded-xl border" style={{ background: '#07080f', borderColor: '#1e2035' }}>
          <div className="text-sm font-bold text-white mb-2">Currently active</div>
          <div className="flex flex-wrap gap-2">
            {SPACE_CATALOG.filter(space => spaces[space.id]?.active || activeSpace === space.id).map(space => (
              <span key={space.id} className="px-3 py-1 rounded-full text-xs font-medium" style={{ background: `${space.color}20`, color: space.color, border: `1px solid ${space.color}40` }}>{space.icon} {space.name}</span>
            ))}
            {!SPACE_CATALOG.some(space => spaces[space.id]?.active || activeSpace === space.id) && <span className="text-xs text-slate-500">No active worker spaces yet.</span>}
          </div>
        </div>
      </div>
    </div>
  )
}
