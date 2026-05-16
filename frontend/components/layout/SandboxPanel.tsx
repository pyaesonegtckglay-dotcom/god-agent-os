'use client'

import { useState, useRef, useEffect } from 'react'
import { useAgentStore } from '@/hooks/useAgentStore'
import { fetchAPI } from '@/lib/api'
const sandboxExecute = (cmd: string, sid: string) => fetchAPI('/api/v1/spaces/sandbox-worker-space/execute', { method: 'POST', body: JSON.stringify({ task: cmd, role: 'execution', session_id: sid }) })
const sandboxWriteFile = (path: string, content: string) => fetchAPI('/api/v1/files/write', { method: 'POST', body: JSON.stringify({ path, content }) })
const getWorkspaceInfo = () => fetchAPI('/api/v1/files/workspace')
import { Terminal, Play, FolderOpen, File, RefreshCw, ChevronRight, Zap, ExternalLink, Code2 } from 'lucide-react'

const VSCODE_HF_URL = 'https://pyae1994-god-agent-vscode.hf.space'

interface TerminalLine {
  type: 'input' | 'output' | 'error'
  text: string
  time: string
}

export default function SandboxPanel() {
  const { locale } = useAgentStore()
  const [cmd, setCmd] = useState('')
  const [lines, setLines] = useState<TerminalLine[]>([
    { type: 'output', text: '🚀 God Mode+ Sandbox — Persistent VS Code Workspace', time: '' },
    { type: 'output', text: 'Type commands to execute in the sandbox...', time: '' },
  ])
  const [loading, setLoading] = useState(false)
  const [workspace, setWorkspace] = useState<any>(null)
  const [tab, setTab] = useState<'terminal' | 'files' | 'vscode'>('terminal')
  const endRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const [history, setHistory] = useState<string[]>([])
  const [histIdx, setHistIdx] = useState(-1)

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [lines])
  const loadWorkspace = async () => { try { const data = await getWorkspaceInfo(); setWorkspace(data) } catch {} }
  useEffect(() => { loadWorkspace() }, [])

  const run = async () => {
    const c = cmd.trim()
    if (!c || loading) return
    const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    setLines(lines => [...lines, { type: 'input', text: `$ ${c}`, time: now }])
    setHistory(history => [c, ...history.slice(0, 49)])
    setHistIdx(-1)
    setCmd('')
    setLoading(true)
    try {
      const res = await sandboxExecute(c, 'sandbox_panel')
      const output = res.result || ''
      output.split('\n').forEach((line: string) => setLines(lines => [...lines, { type: 'output', text: line, time: '' }]))
    } catch (e: any) {
      setLines(lines => [...lines, { type: 'error', text: `❌ ${e.message}`, time: '' }])
    }
    setLoading(false)
    if (tab === 'files') loadWorkspace()
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') { run(); return }
    if (e.key === 'ArrowUp') {
      const idx = Math.min(histIdx + 1, history.length - 1)
      setHistIdx(idx)
      setCmd(history[idx] || '')
    }
    if (e.key === 'ArrowDown') {
      const idx = Math.max(histIdx - 1, -1)
      setHistIdx(idx)
      setCmd(idx === -1 ? '' : history[idx])
    }
  }

  const QUICK_CMDS = ['ls -la', 'pwd', 'python3 --version', 'node --version', 'git status', 'pip list | head -10']

  return (
    <div className="flex flex-col h-full" style={{ background: 'var(--bg-2)' }}>
      <div className="flex items-center justify-between px-4 py-2.5 border-b shrink-0" style={{ borderColor: 'var(--border)', background: 'var(--bg-3)' }}>
        <div className="flex items-center gap-2"><Terminal size={14} className="text-green-400" /><span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{locale === 'my' ? 'Sandbox' : 'Sandbox'}</span><div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" /></div>
        <div className="flex gap-0.5 p-0.5 rounded-lg" style={{ background: 'var(--bg-0)', border: '1px solid var(--border)' }}>
          {(['terminal', 'files', 'vscode'] as const).map(t => (
            <button key={t} onClick={() => { setTab(t); if (t === 'files') loadWorkspace() }} className="px-2.5 py-0.5 rounded-md text-[10px] font-medium transition-all capitalize" style={{ background: tab === t ? 'var(--brand)' : 'transparent', color: tab === t ? '#fff' : 'var(--text-muted)' }}>{t === 'vscode' ? '⚡ VS Code' : t}</button>
          ))}
        </div>
      </div>
      {tab === 'terminal' ? (
        <>
          <div className="px-3 py-1.5 border-b flex gap-1 overflow-x-auto" style={{ borderColor: 'var(--border)' }}>
            {QUICK_CMDS.map(q => <button key={q} onClick={() => { setCmd(q); inputRef.current?.focus() }} className="flex-shrink-0 px-2 py-0.5 rounded-full text-[9px] font-mono transition-all hover:opacity-80" style={{ background: 'var(--bg-3)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>{q}</button>)}
          </div>
          <div className="flex-1 overflow-y-auto p-3 font-mono text-xs space-y-1.5">
            {lines.map((line, i) => <div key={i} className={line.type === 'error' ? 'text-red-400' : line.type === 'input' ? 'text-cyan-300' : 'text-slate-300'}>{line.text}</div>)}
            {loading && <div className="text-slate-500 animate-pulse">Running...</div>}
            <div ref={endRef} />
          </div>
          <div className="p-3 border-t" style={{ borderColor: 'var(--border)' }}>
            <div className="flex items-center gap-2">
              <ChevronRight size={14} className="text-green-400" />
              <input ref={inputRef} value={cmd} onChange={e => setCmd(e.target.value)} onKeyDown={handleKeyDown} placeholder="Enter command..." className="flex-1 bg-transparent outline-none text-sm text-slate-100" />
              <button onClick={run} className="p-2 rounded-lg bg-violet-600 text-white disabled:opacity-50" disabled={loading || !cmd.trim()}><Play size={14} /></button>
            </div>
          </div>
        </>
      ) : tab === 'files' ? (
        <div className="p-4 text-sm text-slate-300">Workspace: {workspace?.workspace || '/tmp/god_workspace'}</div>
      ) : (
        <div className="p-4 text-sm text-slate-300">VS Code Space: <a className="text-cyan-400 underline" href={VSCODE_HF_URL} target="_blank">Open</a></div>
      )}
    </div>
  )
}
