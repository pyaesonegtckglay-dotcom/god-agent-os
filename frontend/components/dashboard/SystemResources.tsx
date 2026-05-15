'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Cpu, MemoryStick, HardDrive, Wifi } from 'lucide-react'
import { useAppStore } from '@/store/useAppStore'

const RESOURCE_CONFIGS = [
  { key: 'cpu',     label: 'CPU',     icon: Cpu,          color: '#6366f1' },
  { key: 'memory',  label: 'Memory',  icon: MemoryStick,  color: '#22d3ee' },
  { key: 'storage', label: 'Storage', icon: HardDrive,    color: '#a78bfa' },
  { key: 'network', label: 'Network', icon: Wifi,         color: '#34d399' },
] as const

export default function SystemResources() {
  const { systemResources, updateSystemResources } = useAppStore()

  // Simulate live fluctuation
  useEffect(() => {
    const interval = setInterval(() => {
      updateSystemResources({
        cpu: Math.min(95, Math.max(15, systemResources.cpu + (Math.random() - 0.5) * 6)),
        memory: Math.min(90, Math.max(40, systemResources.memory + (Math.random() - 0.5) * 3)),
        network: Math.min(80, Math.max(10, systemResources.network + (Math.random() - 0.5) * 8)),
      })
    }, 3000)
    return () => clearInterval(interval)
  }, [systemResources, updateSystemResources])

  return (
    <div className="space-y-3">
      {RESOURCE_CONFIGS.map(({ key, label, icon: Icon, color }) => {
        const value = Math.round(systemResources[key])
        return (
          <div key={key} className="flex items-center gap-3">
            <div className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ background: `${color}15` }}>
              <Icon size={12} style={{ color }} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>{label}</span>
                <span className="text-xs font-bold" style={{ color }}>{value}%</span>
              </div>
              <div className="progress-bar h-1.5">
                <motion.div
                  className="progress-fill h-full rounded-full"
                  animate={{ width: `${value}%` }}
                  transition={{ duration: 0.8, ease: 'easeOut' }}
                  style={{ background: `linear-gradient(90deg, ${color}60, ${color})` }}
                />
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
