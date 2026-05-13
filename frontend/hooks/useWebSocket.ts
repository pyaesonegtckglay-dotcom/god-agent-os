// ─── WebSocket Hook — handles agent events, updates store ─────────────────────

'use client'

import { useEffect, useRef, useCallback } from 'react'
import { AgentWebSocket } from '@/lib/websocket'
import { useAgentStore } from './useAgentStore'
import { StreamEvent } from '@/types'

export function useAgentWebSocket(taskId?: string) {
  const wsRef = useRef<AgentWebSocket | null>(null)
  const store = useAgentStore()

  const handleEvent = useCallback((event: StreamEvent) => {
    const { type, data, task_id } = event

    switch (type) {
      case 'connected':
        break

      case 'heartbeat':
        break

      case 'task_created':
      case 'task_queued':
        if (task_id) {
          store.addTask({
            id: task_id,
            goal: data.goal || '',
            status: type === 'task_created' ? 'queued' : 'queued',
            session_id: event.session_id || store.sessionId,
            project_id: store.projectId,
            created_at: event.timestamp,
            retry_count: 0,
            ws_url: data.ws_url,
            stream_url: data.stream_url,
          })
          store.setActiveTask(task_id)
          store.addTimelineEvent({
            type,
            label: type === 'task_created' ? '📋 Task Created' : '🔄 Task Queued',
            description: data.goal ? `Goal: ${data.goal.slice(0, 80)}` : undefined,
            timestamp: event.timestamp,
            status: 'completed',
            data,
          })
        }
        break

      case 'task_started':
        if (task_id) {
          store.updateTask(task_id, { status: 'initializing', started_at: event.timestamp })
          store.addTimelineEvent({
            type,
            label: '🚀 Task Started',
            description: 'Initializing agent...',
            timestamp: event.timestamp,
            status: 'running',
            data,
          })
        }
        break

      case 'plan_generated':
        if (task_id) {
          store.updateTask(task_id, { status: 'executing', plan: data as any })
          if (data.steps) {
            store.setActiveSteps(data.steps.map((s: any) => ({
              id: s.id || Math.random().toString(36).slice(2),
              name: s.name,
              description: s.description || '',
              tool: s.tool,
              status: 'pending' as const,
            })))
          }
          store.addTimelineEvent({
            type,
            label: '🗺️ Plan Generated',
            description: `${data.steps?.length || 0} steps planned`,
            timestamp: event.timestamp,
            status: 'completed',
            data,
          })
        }
        break

      case 'step_started': {
        if (task_id) {
          store.updateTask(task_id, { status: data.status === 'planning' ? 'planning' : 'executing' })
          store.updateActiveStep(data.step, { status: 'running', started_at: event.timestamp })
          store.addTimelineEvent({
            type,
            label: `▶ ${data.step || 'Step'}`,
            description: data.description || data.tool ? `Tool: ${data.tool}` : undefined,
            timestamp: event.timestamp,
            status: 'running',
            tool: data.tool,
            data,
          })
        }
        break
      }

      case 'step_progress':
        store.addTimelineEvent({
          type,
          label: `⚡ ${data.action || 'Progress'}`,
          description: data.command?.slice(0, 100) || data.description || '',
          timestamp: event.timestamp,
          status: 'running',
          data,
        })
        break

      case 'tool_called':
        store.addTimelineEvent({
          type,
          label: `🔧 Tool: ${data.tool || 'unknown'}`,
          description: data.description?.slice(0, 120) || data.step || '',
          timestamp: event.timestamp,
          status: 'running',
          tool: data.tool,
          data,
        })
        break

      case 'tool_result':
        store.addTimelineEvent({
          type,
          label: `✅ Tool Result: ${data.tool || 'unknown'}`,
          description: data.success === false
            ? `Error: ${data.error?.slice(0, 100)}`
            : data.result?.slice(0, 120) || 'Success',
          timestamp: event.timestamp,
          status: data.success === false ? 'failed' : 'completed',
          tool: data.tool,
          data,
        })
        break

      case 'llm_chunk':
        // Handled directly by chat panel streaming message
        if (store.streamingMessageId) {
          store.appendChunk(store.streamingMessageId, data.chunk || '')
        }
        break

      case 'memory_updated':
        store.addTimelineEvent({
          type,
          label: `🧠 Memory Updated`,
          description: `Type: ${data.type || 'unknown'}`,
          timestamp: event.timestamp,
          status: 'completed',
          data,
        })
        break

      case 'retry_attempt':
        if (task_id) {
          store.updateTask(task_id, { status: 'retrying', retry_count: data.count || 1 })
          store.addTimelineEvent({
            type,
            label: `🔁 Retry #${data.count || 1}`,
            timestamp: event.timestamp,
            status: 'warning',
            data,
          })
        }
        break

      case 'step_completed':
        if (task_id) {
          store.updateActiveStep(data.step, { status: 'completed', completed_at: event.timestamp })
          store.addTimelineEvent({
            type,
            label: `✓ ${data.step || 'Step'} Done`,
            description: data.output?.slice(0, 100),
            timestamp: event.timestamp,
            status: 'completed',
            data,
          })
        }
        break

      case 'warning':
        store.addTimelineEvent({
          type,
          label: `⚠️ Warning`,
          description: data.message || data.warning || '',
          timestamp: event.timestamp,
          status: 'warning',
          data,
        })
        break

      case 'error':
        store.addTimelineEvent({
          type,
          label: `❌ Error`,
          description: data.error?.slice(0, 120) || 'Unknown error',
          timestamp: event.timestamp,
          status: 'failed',
          data,
        })
        break

      case 'task_completed':
        if (task_id) {
          store.updateTask(task_id, { status: 'completed', result: data.result, completed_at: event.timestamp })
          store.addTimelineEvent({
            type,
            label: '🎉 Task Completed',
            description: `${data.steps_completed || 0} steps finished`,
            timestamp: event.timestamp,
            status: 'completed',
            data,
          })
          store.setStreaming(false, null)
          // Add result to chat
          if (data.result) {
            store.updateMessage(store.streamingMessageId || '', {
              content: data.result,
              streaming: false,
              metadata: { task_id, completed: true },
            })
          }
        }
        break

      case 'task_failed':
        if (task_id) {
          store.updateTask(task_id, { status: 'failed', error: data.error, completed_at: event.timestamp })
          store.addTimelineEvent({
            type,
            label: '❌ Task Failed',
            description: data.error?.slice(0, 100) || data.reason || 'Failed',
            timestamp: event.timestamp,
            status: 'failed',
            data,
          })
          store.setStreaming(false, null)
        }
        break
    }
  }, [store])

  useEffect(() => {
    const path = taskId ? `/ws/tasks/${taskId}` : `/ws/logs`

    wsRef.current = new AgentWebSocket(path, {
      onEvent: handleEvent,
      onConnect: () => store.setWsConnected(true, 0),
      onDisconnect: () => store.setWsConnected(false),
      onError: () => store.setWsConnected(false, wsRef.current?.getRetryCount() || 0),
    })
    wsRef.current.connect()

    return () => {
      wsRef.current?.disconnect()
    }
  }, [taskId])

  return {
    send: (data: object) => wsRef.current?.send(data),
    isConnected: store.wsConnected,
    retries: store.wsRetries,
  }
}
