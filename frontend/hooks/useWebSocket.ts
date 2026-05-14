/**
 * God Mode+ WebSocket Hook
 * Real-time event streaming from all agents
 */

'use client'

import { useEffect, useRef, useCallback } from 'react'
import { useAgentStore } from './useAgentStore'
import type { AgentName } from './useAgentStore'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
const WS_URL = API_URL.replace(/^http/, 'ws')

const AGENT_EVENT_MAP: Record<string, AgentName> = {
  agent_chat: 'chat', agent_planner: 'planner', agent_coding: 'coding',
  agent_debug: 'debug', agent_memory: 'memory', agent_connector: 'connector',
  agent_deploy: 'deploy', agent_workflow: 'workflow', agent_sandbox: 'sandbox',
  agent_ui: 'ui',
}

export function useAgentWebSocket(taskId?: string) {
  const socketRef = useRef<WebSocket | null>(null)
  const reconnectRef = useRef<NodeJS.Timeout>()
  const { addEvent, updateAgentStatus, updateMessage, setStreaming, streamingMessageId } = useAgentStore()

  const connect = useCallback(() => {
    const url = taskId
      ? `${WS_URL}/ws/tasks/${taskId}`
      : `${WS_URL}/ws/logs`

    try {
      const ws = new WebSocket(url)
      socketRef.current = ws

      ws.onopen = () => {
        // Start heartbeat
        const hb = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'ping' }))
          } else {
            clearInterval(hb)
          }
        }, 25000)
      }

      ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(ev.data)
          handleEvent(msg)
        } catch {}
      }

      ws.onclose = () => {
        reconnectRef.current = setTimeout(connect, 3000)
      }

      ws.onerror = () => {
        ws.close()
      }
    } catch {}
  }, [taskId])

  const handleEvent = useCallback((msg: any) => {
    const { type, data = {}, event } = msg
    const eventType = type || event

    // Add to timeline
    addEvent({ type: eventType, data: data || msg, agent: detectAgent(eventType, data) })

    // Handle streaming chunks
    if (eventType === 'llm_chunk') {
      const chunk = data.chunk || ''
      if (streamingMessageId) {
        useAgentStore.getState().appendChunk(streamingMessageId, chunk)
      }
      return
    }

    // Update agent statuses
    switch (eventType) {
      case 'agent_start':
      case 'agent_called': {
        const agentName = (data.agent || '').toLowerCase().replace('agent', '') as AgentName
        if (agentName) {
          updateAgentStatus(agentName, {
            status: 'executing',
            currentTask: data.task || data.intent || data.goal || '',
            lastActive: Date.now(),
          })
        }
        break
      }
      case 'task_completed':
      case 'orchestrator_complete':
      case 'stream_end':
        setStreaming(false, null)
        break

      case 'task_failed':
        setStreaming(false, null)
        break

      case 'self_heal_attempt':
        updateAgentStatus('debug', { status: 'executing', currentTask: `Self-healing attempt ${data.attempt}/${data.max}` })
        break

      case 'self_heal_success':
        updateAgentStatus('debug', { status: 'complete', lastActive: Date.now() })
        break

      case 'workflow_generated':
        updateAgentStatus('workflow', { status: 'complete', lastActive: Date.now() })
        break

      case 'plan_ready':
        updateAgentStatus('planner', { status: 'complete', lastActive: Date.now() })
        break

      case 'code_generated':
        updateAgentStatus('coding', { status: 'complete', lastActive: Date.now() })
        break
    }
  }, [addEvent, updateAgentStatus, setStreaming, streamingMessageId])

  useEffect(() => {
    connect()
    return () => {
      clearTimeout(reconnectRef.current)
      socketRef.current?.close()
    }
  }, [connect])

  return socketRef
}

export function useChatWebSocket(sessionId: string) {
  const socketRef = useRef<WebSocket | null>(null)
  const reconnectRef = useRef<NodeJS.Timeout>()
  const store = useAgentStore()

  const connect = useCallback(() => {
    const url = `${WS_URL}/ws/chat/${sessionId}`
    try {
      const ws = new WebSocket(url)
      socketRef.current = ws

      ws.onopen = () => {
        const hb = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'ping' }))
          else clearInterval(hb)
        }, 25000)
      }

      ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(ev.data)
          handleChatEvent(msg)
        } catch {}
      }

      ws.onclose = () => {
        reconnectRef.current = setTimeout(connect, 3000)
      }

      ws.onerror = () => ws.close()
    } catch {}
  }, [sessionId])

  const handleChatEvent = useCallback((msg: any) => {
    const { type, data = {} } = msg

    store.addEvent({ type, data, agent: detectAgent(type, data) })

    switch (type) {
      case 'stream_start':
        break
      case 'llm_chunk':
        if (store.streamingMessageId) {
          store.appendChunk(store.streamingMessageId, data.chunk || '')
        }
        break
      case 'stream_end':
        if (store.streamingMessageId) {
          store.updateMessage(store.streamingMessageId, {
            content: data.full_response || store.messages.find(m => m.id === store.streamingMessageId)?.content || '',
            streaming: false,
          })
        }
        store.setStreaming(false, null)
        break
      case 'orchestrator_complete':
        store.setStreaming(false, null)
        break
    }
  }, [store])

  const sendMessage = useCallback((content: string, context?: Record<string, any>) => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({
        type: 'chat_message',
        content,
        context: context || {},
        timestamp: Date.now(),
      }))
    }
  }, [])

  const sendTask = useCallback((content: string) => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({
        type: 'task_message',
        content,
        timestamp: Date.now(),
      }))
    }
  }, [])

  useEffect(() => {
    connect()
    return () => {
      clearTimeout(reconnectRef.current)
      socketRef.current?.close()
    }
  }, [connect])

  return { socketRef, sendMessage, sendTask }
}

function detectAgent(eventType: string, data: any): AgentName | undefined {
  const agentStr = (data?.agent || '').toLowerCase()
  if (agentStr.includes('chat')) return 'chat'
  if (agentStr.includes('planner') || agentStr.includes('plan')) return 'planner'
  if (agentStr.includes('coding') || agentStr.includes('code')) return 'coding'
  if (agentStr.includes('debug')) return 'debug'
  if (agentStr.includes('memory')) return 'memory'
  if (agentStr.includes('connector')) return 'connector'
  if (agentStr.includes('deploy')) return 'deploy'
  if (agentStr.includes('workflow')) return 'workflow'
  if (agentStr.includes('sandbox')) return 'sandbox'
  if (agentStr.includes('ui')) return 'ui'
  if (eventType.includes('code')) return 'coding'
  if (eventType.includes('plan')) return 'planner'
  if (eventType.includes('debug') || eventType.includes('heal')) return 'debug'
  if (eventType.includes('workflow')) return 'workflow'
  if (eventType.includes('sandbox') || eventType.includes('exec')) return 'sandbox'
  if (eventType.includes('connector')) return 'connector'
  if (eventType.includes('deploy')) return 'deploy'
  return undefined
}
