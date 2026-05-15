'use client'

import { useState, useRef, useEffect } from 'react'
import { useAgentStore } from '@/hooks/useAgentStore'
import { fetchAPI } from '@/lib/api'
const sandboxExecute = (cmd: string, sid: string) => fetchAPI('/api/v1/spaces/sandbox/execute', { method: 'POST', body: JSON.stringify({ task: cmd, role: 'execution', session_id: sid }) })
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

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [lines])

  const loadWorkspace = async () => {
    try {
      const data = await getWorkspaceInfo()
      setWorkspace(data)
    } catch {}
  }

  useEffect(() => { loadWorkspace() }, [])

  const run = async () => {
    const c = cmd.trim()
    if (!c || loading) return
    const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    setLines(l => [...l, { type: 'input', text: `$ ${c}`, time: now }])
    setHistory(h => [c, ...h.slice(0, 49)])
    setHistIdx(-1)
    setCmd('')
    setLoading(true)
    try {
      const res = await sandboxExecute(c, 'sandbox_panel')
      const output = res.result || ''
      output.split('\n').forEach((line: string) => {
        setLines(l => [...l, { type: 'output', text: line, time: '' }])
      })
    } catch (e: any) {
      setLines(l => [...l, { type: 'error', text: `❌ ${e.message}`, time: '' }])
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
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b shrink-0"
        style={{ borderColor: 'var(--border)', background: 'var(--bg-3)' }}>
        <div className="flex items-center gap-2">
          <Terminal size={14} className="text-green-400" />
          <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
            {locale === 'my' ? 'Sandbox' : 'Sandbox'}
          </span>
          <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
        </div>
        <div className="flex gap-0.5 p-0.5 rounded-lg" style={{ background: 'var(--bg-0)', border: '1px solid var(--border)' }}>
          {(['terminal', 'files', 'vscode'] as const).map(t => (
            <button key={t} onClick={() => { setTab(t); if (t === 'files') loadWorkspace() }}
              className="px-2.5 py-0.5 rounded-md text-[10px] font-medium transition-all capitalize"
              style={{
                background: tab === t ? 'var(--brand)' : 'transparent',
                color: tab === t ? '#fff' : 'var(--text-muted)',
              }}>
              {t === 'vscode' ? '⚡ VS Code' : t}
            </button>
          ))}
        </div>
      </div>

      {tab === 'terminal' ? (
        <>
          {/* Quick commands */}
          <div className="px-3 py-1.5 border-b flex gap-1 overflow-x-auto" style={{ borderColor: 'var(--border)' }}>
            {QUICK_CMDS.map(q => (
              <button key={q} onClick={() => { setCmd(q); inputRef.current?.focus() }}
                className="flex-shrink-0 px-2 py-0.5 rounded-full text-[9px] font-mono transition-all hover:opacity-80"
                style={{ background: 'var(--bg-3)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
                {q}
              </button>
            ))}
          </div>

          {/* Terminal output */}
          <div className="flex-1 overflow-y-auto p-3 font-mono text-[11px] leading-relaxed"
            style={{ background: 'var(--bg-0)' }}
            onClick={() => inputRef.current?.focus()}>
            {lines.map((line, i) => (
              <div key={i} className={`flex gap-2 ${line.type === 'input' ? 'mt-1' : ''}`}>
                {line.time && <span style={{ color: 'var(--text-muted)', flexShrink: 0 }}>{line.time}</span>}
                <span style={{
                  color: line.type === 'input' ? '#22d3ee'
                       : line.type === 'error' ? '#f87171'
                       : 'var(--text-secondary)',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-all',
                }}>
                  {line.text}
                </span>
              </div>
            ))}
            {loading && (
              <div className="flex items-center gap-2 mt-1">
                <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                <span style={{ color: 'var(--text-muted)' }}>Executing...</span>
              </div>
            )}
            <div ref={endRef} />
          </div>

          {/* Input */}
          <div className="px-3 py-2 border-t flex items-center gap-2" style={{ borderColor: 'var(--border)', background: 'var(--bg-0)' }}>
            <ChevronRight size={12} className="text-green-400 flex-shrink-0" />
            <input ref={inputRef} type="text" value={cmd} onChange={e => setCmd(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={locale === 'my' ? 'Command ထည့်ပါ...' : 'Enter command...'}
              disabled={loading}
              className="flex-1 bg-transparent outline-none text-[11px] font-mono"
              style={{ color: 'var(--text-primary)' }}
              autoFocus
            />
            <button onClick={run} disabled={!cmd.trim() || loading}
              className="p-1.5 rounded-lg disabled:opacity-30 transition-all"
              style={{ background: 'var(--brand)' }}>
              <Play size={10} className="text-white" />
            </button>
          </div>
        </>
      ) : tab === 'files' ? (
        /* Files tab */
        <div className="flex-1 overflow-y-auto p-3">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] font-mono" style={{ color: 'var(--text-muted)' }}>
              {workspace?.path || '/tmp/god_workspace'}
            </p>
            <button onClick={loadWorkspace} className="p-1 rounded hover:bg-white/5">
              <RefreshCw size={10} style={{ color: 'var(--text-muted)' }} />
            </button>
          </div>
          {workspace?.files?.length ? (
            <div className="space-y-0.5">
              {workspace.files.map((f: string) => (
                <div key={f} className="flex items-center gap-2 px-2 py-1 rounded-lg hover:bg-white/5 transition-colors">
                  <File size={10} style={{ color: 'var(--text-muted)' }} />
                  <span className="text-[10px] font-mono" style={{ color: 'var(--text-secondary)' }}>{f}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-32 gap-2">
              <FolderOpen size={24} style={{ color: 'var(--text-muted)' }} />
              <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                {locale === 'my' ? 'ဖိုင်မရှိသေးပါ' : 'Workspace is empty'}
              </p>
            </div>
          )}
        </div>
      ) : (
        /* VS Code tab */
        <div className="flex flex-col h-full">
          {/* VS Code info bar */}
          <div className="px-3 py-2 border-b flex items-center justify-between"
            style={{ borderColor: 'var(--border)', background: 'var(--bg-3)' }}>
            <div className="flex items-center gap-2">
              <Code2 size={12} style={{ color: 'var(--brand)' }} />
              <span className="text-[11px] font-semibold" style={{ color: 'var(--text-primary)' }}>
                VS Code — God Agent Sandbox
              </span>
              <span className="text-[9px] px-1.5 py-0.5 rounded font-mono"
                style={{ background: 'rgba(34,197,94,0.1)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.2)' }}>
                LIVE
              </span>
            </div>
            <a href={VSCODE_HF_URL} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] transition-all hover:opacity-80"
              style={{ background: 'var(--brand)', color: '#fff' }}>
              <ExternalLink size={10} />
              Open Full
            </a>
          </div>

          {/* Password hint */}
          <div className="px-3 py-1.5 border-b flex items-center gap-2"
            style={{ borderColor: 'var(--border)', background: 'rgba(99,102,241,0.05)' }}>
            <Zap size={10} style={{ color: 'var(--brand)' }} />
            <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
              Password: <code className="px-1 rounded font-mono" style={{ background: 'var(--bg-0)', color: 'var(--text-secondary)' }}>godagent2024</code>
            </span>
          </div>

          {/* VS Code iframe */}
          <div className="flex-1 relative">
            <iframe
              src={VSCODE_HF_URL}
              className="w-full h-full border-0"
              title="God Agent VS Code Sandbox"
              allow="clipboard-read; clipboard-write"
              sandbox="allow-forms allow-modals allow-pointer-lock allow-popups allow-same-origin allow-scripts allow-top-navigation"
            />
          </div>
        </div>
      )}
    </div>
  )
}
