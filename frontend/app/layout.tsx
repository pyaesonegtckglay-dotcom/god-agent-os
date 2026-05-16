import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'GOD AGENT OS v9 — General Autonomous Agent OS | Powered by Pyae Sone',
  description: 'Space-Role Architecture — General Autonomous Agent OS. 8 Spaces × 5 Roles. Powered by Pyae Sone.',
  icons: { icon: '/favicon.ico' },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark" data-theme="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="bg-void text-slate-100 antialiased overflow-hidden h-screen font-sans">
        {children}
      </body>
    </html>
  )
}
