'use client'

import { useState, useEffect } from 'react'
import { Folder, File, FolderOpen, RefreshCw, Code2, FileText, Image, Package } from 'lucide-react'

interface FileItem {
  path: string
  size: number
}

interface WorkspaceData {
  workspace: string
  files: FileItem[]
  total: number
}

const getFileIcon = (filename: string) => {
  const ext = filename.split('.').pop()?.toLowerCase()
  if (['ts', 'tsx', 'js', 'jsx', 'py', 'go', 'rs'].includes(ext || '')) return Code2
  if (['json', 'yaml', 'yml', 'toml'].includes(ext || '')) return Package
  if (['md', 'txt', 'rst'].includes(ext || '')) return FileText
  if (['png', 'jpg', 'svg', 'webp'].includes(ext || '')) return Image
  return File
}

const getFileColor = (filename: string) => {
  const ext = filename.split('.').pop()?.toLowerCase()
  if (['ts', 'tsx'].includes(ext || '')) return '#3b82f6'
  if (['py'].includes(ext || '')) return '#f59e0b'
  if (['js', 'jsx'].includes(ext || '')) return '#eab308'
  if (['go'].includes(ext || '')) return '#06b6d4'
  if (['rs'].includes(ext || '')) return '#f97316'
  if (['json', 'yaml', 'yml'].includes(ext || '')) return '#a78bfa'
  if (['md'].includes(ext || '')) return '#6b7280'
  return '#9ca3af'
}

export default function FileExplorer() {
  const [workspace, setWorkspace] = useState<WorkspaceData | null>(null)
  const [loading, setLoading] = useState(false)
  const [selectedFile, setSelectedFile] = useState<string | null>(null)
  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(new Set())

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

  const fetchWorkspace = async () => {
    setLoading(true)
    try {
      const resp = await fetch(`${apiUrl}/api/v1/files/workspace`)
      if (resp.ok) {
        const data = await resp.json()
        setWorkspace(data)
      }
    } catch (e) {
      console.error('Failed to fetch workspace', e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchWorkspace()
  }, [])

  // Build tree structure from flat file list
  const buildTree = (files: FileItem[]) => {
    const tree: Record<string, any> = {}
    files.forEach(({ path, size }) => {
      const parts = path.split('/')
      let current = tree
      parts.forEach((part, i) => {
        if (i === parts.length - 1) {
          current[part] = { _file: true, path, size }
        } else {
          if (!current[part]) current[part] = {}
          current = current[part]
        }
      })
    })
    return tree
  }

  const toggleDir = (path: string) => {
    setExpandedDirs(prev => {
      const next = new Set(prev)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })
  }

  const renderTree = (node: Record<string, any>, prefix: string = '', depth: number = 0) => {
    return Object.entries(node).map(([name, value]) => {
      const fullPath = prefix ? `${prefix}/${name}` : name
      const isFile = value?._file === true
      const Icon = isFile ? getFileIcon(name) : (expandedDirs.has(fullPath) ? FolderOpen : Folder)
      const color = isFile ? getFileColor(name) : '#f59e0b'

      return (
        <div key={fullPath}>
          <div
            className={`flex items-center gap-1.5 py-0.5 px-2 rounded cursor-pointer transition-all text-xs group`}
            style={{
              paddingLeft: `${8 + depth * 12}px`,
              background: selectedFile === fullPath ? 'rgba(99,102,241,0.15)' : 'transparent',
              color: selectedFile === fullPath ? 'var(--text-primary)' : 'var(--text-secondary)',
            }}
            onClick={() => {
              if (isFile) setSelectedFile(fullPath)
              else toggleDir(fullPath)
            }}
            onMouseEnter={e => { if (selectedFile !== fullPath) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)' }}
            onMouseLeave={e => { if (selectedFile !== fullPath) (e.currentTarget as HTMLElement).style.background = 'transparent' }}
          >
            <Icon size={11} style={{ color, flexShrink: 0 }} />
            <span className="truncate flex-1">{name}</span>
            {isFile && value.size && (
              <span className="text-[9px] opacity-40 flex-shrink-0">
                {value.size > 1024 ? `${(value.size / 1024).toFixed(1)}k` : `${value.size}b`}
              </span>
            )}
          </div>
          {!isFile && expandedDirs.has(fullPath) && renderTree(value, fullPath, depth + 1)}
        </div>
      )
    })
  }

  const tree = workspace ? buildTree(workspace.files) : {}

  return (
    <div className="flex flex-col h-full" style={{ background: 'var(--bg-1)' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b shrink-0"
        style={{ borderColor: 'var(--border)', background: 'var(--bg-2)' }}>
        <div className="flex items-center gap-2">
          <Folder size={13} className="text-yellow-400" />
          <span className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>
            File Explorer
          </span>
          {workspace && (
            <span className="text-[10px] px-1.5 py-0.5 rounded font-mono"
              style={{ background: 'var(--bg-3)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
              {workspace.total} files
            </span>
          )}
        </div>
        <button
          onClick={fetchWorkspace}
          disabled={loading}
          className="p-1.5 rounded-lg transition-all hover:opacity-80"
          style={{ background: 'var(--bg-3)', border: '1px solid var(--border)' }}>
          <RefreshCw size={11} className={`${loading ? 'animate-spin' : ''}`} style={{ color: 'var(--text-muted)' }} />
        </button>
      </div>

      {/* File Tree */}
      <div className="flex-1 overflow-y-auto py-2">
        {loading ? (
          <div className="flex items-center justify-center h-20">
            <RefreshCw size={14} className="animate-spin text-indigo-400" />
          </div>
        ) : workspace && workspace.files.length > 0 ? (
          <div>{renderTree(tree)}</div>
        ) : (
          <div className="flex flex-col items-center justify-center h-20 gap-2">
            <Folder size={20} className="opacity-30" style={{ color: 'var(--text-muted)' }} />
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Workspace empty</p>
            <p className="text-[10px] text-center px-4" style={{ color: 'var(--text-muted)' }}>
              Ask God Agent to create a project
            </p>
          </div>
        )}
      </div>

      {/* Selected file info */}
      {selectedFile && (
        <div className="px-3 py-2 border-t shrink-0" style={{ borderColor: 'var(--border)', background: 'var(--bg-2)' }}>
          <p className="text-[10px] truncate font-mono" style={{ color: 'var(--text-muted)' }}>
            📄 {selectedFile}
          </p>
        </div>
      )}
    </div>
  )
}
