'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Play, RefreshCw } from 'lucide-react'
import { useAppStore } from '@/store/useAppStore'

const SPACES_DETAIL = [
  {
    id: 'core',
    name: 'Core Space',
    icon: '🧠',
    color: '#7c3aed',
    description: 'The central nervous system. Manages memory, planning, and overall orchestration.',
    tools: ['Goal decomposition', 'Long-term memory access', 'Task delegation', 'Context management'],
    roles: ['Cognition', 'Automation'],
    phase: 'Phase 1',
  },
  {
    id: 'browser',
    name: 'Browser Space',
    icon: '🌐',
    color: '#2563eb',
    description: 'The interface to the web. Handles all internet-based research and interaction.',
    tools: ['Web navigation', 'DOM parsing', 'Data extraction', 'Form filling'],
    roles: ['Automation', 'Cognition'],
    phase: 'Phase 3',
  },
  {
    id: 'sandbox',
    name: 'Sandbox Space',
    icon: '💻',
    color: '#059669',
    description: 'Secure execution environment. Where code is run and tested safely.',
    tools: ['Python interpreter', 'Node.js runtime', 'Shell access', 'Isolated filesystem'],
    roles: ['Execution', 'Cognition'],
    phase: 'Phase 3',
  },
  {
    id: 'coding',
    name: 'Coding Space',
    icon: '🔧',
    color: '#d97706',
    description: 'The development environment. Focused on code generation and manipulation.',
    tools: ['Multi-language codegen', 'Code review', 'Refactoring', 'Test generation'],
    roles: ['Execution', 'Cognition', 'Automation'],
    phase: 'Phase 3',
  },
  {
    id: 'vision',
    name: 'Vision Space',
    icon: '👁️',
    color: '#db2777',
    description: 'Visual processing domain. Handles image understanding and UI generation.',
    tools: ['UI generation', 'Image analysis', 'Design-to-code', 'OCR'],
    roles: ['Visual Intelligence', 'Execution'],
    phase: 'Phase 3',
  },
  {
    id: 'debug',
    name: 'Debug Space',
    icon: '🐛',
    color: '#dc2626',
    description: 'Diagnostic environment. Analyzes errors and proposes self-healing solutions.',
    tools: ['Stack trace analysis', 'Log parsing', 'Error classification', 'Self-healing'],
    roles: ['Repair', 'Cognition'],
    phase: 'Phase 3',
  },
  {
    id: 'deploy',
    name: 'Deploy Space',
    icon: '🚀',
    color: '#0891b2',
    description: 'Infrastructure domain. Manages cloud deployments and CI/CD pipelines.',
    tools: ['Vercel deploy', 'Docker config', 'GitHub Actions', 'HuggingFace Spaces'],
    roles: ['Automation', 'Execution'],
    phase: 'Phase 3',
  },
  {
    id: 'communication',
    name: 'Communication Space',
    icon: '💬',
    color: '#8b5cf6',
    description: 'Interaction domain. Manages documentation, email, and multi-channel messaging.',
    tools: ['Email drafting', 'Documentation', 'Report creation', 'Translation'],
    roles: ['Automation', 'Cognition'],
    phase: 'Phase 2',
  },
]

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
      if (res.ok) {
        const data = await res.json()
        setTestResult(data.result || 'No result')
      } else {
        setTestResult(`Error: ${res.status} ${res.statusText}`)
      }
    } catch (e: any) {
      setTestResult(`Connection error: ${e.message}`)
    }
    setTesting(false)
  }

  return (
    <div className="h-full overflow-y-auto p-6" style={{ background: '#05060d' }}>
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-white mb-1">Space-Role Architecture</h1>
          <p className="text-slate-500 text-sm">8 Spaces × 5 Roles = Infinite capability combinations</p>
        </div>

        {/* Architecture Diagram */}
        <div className="mb-6 p-4 rounded-xl border" style={{ background: '#07080f', borderColor: '#1e2035' }}>
          <div className="text-[10px] text-slate-600 font-bold uppercase tracking-widest mb-3">Architecture Overview</div>
          <div className="flex items-center justify-center gap-3 flex-wrap">
            <div className="px-3 py-2 rounded-lg text-xs font-semibold text-violet-300"
              style={{ background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.3)' }}>
              🧠 Agent Kernel
            </div>
            <div className="text-slate-600">→</div>
            <div className="px-3 py-2 rounded-lg text-xs font-semibold text-blue-300"
              style={{ background: 'rgba(37,99,235,0.15)', border: '1px solid rgba(37,99,235,0.3)' }}>
              🎯 Intent Classifier
            </div>
            <div className="text-slate-600">→</div>
            <div className="px-3 py-2 rounded-lg text-xs font-semibold text-green-300"
              style={{ background: 'rgba(5,150,105,0.15)', border: '1px solid rgba(5,150,105,0.3)' }}>
              📦 Space Router
            </div>
            <div className="text-slate-600">→</div>
            <div className="px-3 py-2 rounded-lg text-xs font-semibold text-orange-300"
              style={{ background: 'rgba(217,119,6,0.15)', border: '1px solid rgba(217,119,6,0.3)' }}>
              🎭 Role Assignment
            </div>
            <div className="text-slate-600">→</div>
            <div className="px-3 py-2 rounded-lg text-xs font-semibold text-pink-300"
              style={{ background: 'rgba(219,39,119,0.15)', border: '1px solid rgba(219,39,119,0.3)' }}>
              🛠️ Tool Execution
            </div>
          </div>
        </div>

        {/* Spaces Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
          {SPACES_DETAIL.map((space, i) => {
            const spaceState = spaces[space.id as keyof typeof spaces]
            const isActive = spaceState?.active
            const isSelected = selectedSpace === space.id
            
            return (
              <motion.div
                key={space.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                onClick={() => setSelectedSpace(isSelected ? null : space.id)}
                className="p-4 rounded-xl border cursor-pointer transition-all hover:scale-[1.02]"
                style={{
                  background: isSelected ? `${space.color}10` : '#07080f',
                  borderColor: isSelected ? `${space.color}50` : isActive ? `${space.color}30` : '#1e2035',
                }}>
                
                <div className="flex items-center justify-between mb-3">
                  <span className="text-2xl">{space.icon}</span>
                  <div className="flex items-center gap-1">
                    <span className="text-[9px] px-1.5 py-0.5 rounded"
                      style={{ background: `${space.color}20`, color: space.color }}>
                      {space.phase}
                    </span>
                    {isActive && (
                      <div className="w-1.5 h-1.5 rounded-full animate-pulse"
                        style={{ background: space.color }} />
                    )}
                  </div>
                </div>
                
                <h3 className="text-sm font-bold text-white mb-1">{space.name}</h3>
                <p className="text-[10px] text-slate-500 mb-3 leading-relaxed">{space.description}</p>
                
                <div className="space-y-2">
                  <div>
                    <div className="text-[9px] text-slate-700 mb-1">TOOLS</div>
                    <div className="flex flex-wrap gap-1">
                      {space.tools.slice(0, 2).map(tool => (
                        <span key={tool} className="text-[8px] px-1.5 py-0.5 rounded"
                          style={{ background: '#0d0e1a', color: '#475569', border: '1px solid #1e2035' }}>
                          {tool}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="text-[9px] text-slate-700">
                      ROLES: <span style={{ color: space.color }}>{space.roles.join(', ')}</span>
                    </div>
                    {spaceState?.taskCount > 0 && (
                      <span className="text-[9px]" style={{ color: space.color }}>
                        {spaceState.taskCount} tasks
                      </span>
                    )}
                  </div>
                </div>
              </motion.div>
            )
          })}
        </div>

        {/* Space Tester */}
        {selectedSpace && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="p-4 rounded-xl border"
            style={{ 
              background: '#07080f', 
              borderColor: `${SPACES_DETAIL.find(s => s.id === selectedSpace)?.color}40` 
            }}>
            <div className="text-sm font-bold text-white mb-3">
              Test {SPACES_DETAIL.find(s => s.id === selectedSpace)?.icon} {selectedSpace} Space
            </div>
            <div className="flex gap-2 mb-3">
              <input
                value={testTask}
                onChange={e => setTestTask(e.target.value)}
                placeholder={`Enter a task for ${selectedSpace} space...`}
                className="flex-1 px-3 py-2 rounded-lg text-sm text-slate-200 bg-black/20 outline-none"
                style={{ border: '1px solid #1e2035' }}
                onKeyDown={e => e.key === 'Enter' && testSpace(selectedSpace)}
              />
              <button
                onClick={() => testSpace(selectedSpace)}
                disabled={testing || !testTask.trim()}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50 transition-all"
                style={{ background: SPACES_DETAIL.find(s => s.id === selectedSpace)?.color }}>
                {testing ? <RefreshCw size={14} className="animate-spin" /> : <Play size={14} />}
                {testing ? 'Running...' : 'Execute'}
              </button>
            </div>
            {testResult && (
              <div className="p-3 rounded-lg text-xs text-slate-300 whitespace-pre-wrap"
                style={{ background: '#0a0b14', border: '1px solid #1e2035' }}>
                {testResult}
              </div>
            )}
          </motion.div>
        )}
      </div>
    </div>
  )
}
