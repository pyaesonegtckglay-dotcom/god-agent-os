'use client'

import { useEffect } from 'react'
import { useAppStore } from '@/store/useAppStore'

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { theme } = useAppStore()

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])

  return <>{children}</>
}
