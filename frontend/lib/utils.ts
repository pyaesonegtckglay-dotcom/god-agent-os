import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return n.toString()
}

export function getStatusColor(status: string): string {
  switch (status) {
    case 'active': return '#22c55e'
    case 'processing': return '#f59e0b'
    case 'idle': return '#94a3b8'
    case 'error': return '#ef4444'
    case 'running': return '#6366f1'
    case 'completed': return '#22c55e'
    case 'pending': return '#94a3b8'
    case 'failed': return '#ef4444'
    default: return '#94a3b8'
  }
}

export function getStatusLabel(status: string): string {
  return status.charAt(0).toUpperCase() + status.slice(1)
}

export function randomBetween(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}
