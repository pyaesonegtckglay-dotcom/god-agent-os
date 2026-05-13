import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: '🤖 Devin Agent — Autonomous AI Engineering Platform',
  description: 'Production-grade autonomous AI coding agent with real-time streaming, WebSocket execution, GitHub automation, and persistent memory.',
  keywords: ['AI agent', 'autonomous coding', 'Devin', 'Manus', 'streaming AI'],
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
      </head>
      <body className="antialiased overflow-hidden h-screen">{children}</body>
    </html>
  )
}
