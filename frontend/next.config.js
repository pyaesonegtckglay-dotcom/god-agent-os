/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'https://pyae1994-autonomous-coding-system.hf.space',
    NEXT_PUBLIC_WS_URL: process.env.NEXT_PUBLIC_WS_URL || 'wss://pyae1994-autonomous-coding-system.hf.space',
    NEXT_PUBLIC_VSCODE_URL: 'https://pyae1994-god-agent-vscode.hf.space',
  },
  async rewrites() {
    return [
      {
        source: '/api/backend/:path*',
        destination: `${process.env.NEXT_PUBLIC_API_URL || 'https://pyae1994-autonomous-coding-system.hf.space'}/api/:path*`,
      },
    ]
  },
}

module.exports = nextConfig
