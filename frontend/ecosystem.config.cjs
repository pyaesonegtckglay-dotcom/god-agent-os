module.exports = {
  apps: [
    {
      name: 'devin-frontend',
      script: 'npm',
      args: 'start',
      cwd: '/home/user/devin-agent/frontend',
      watch: false,
      instances: 1,
      exec_mode: 'fork',
      env: {
        PORT: 3000,
        NODE_ENV: 'production',
        NEXT_PUBLIC_API_URL: 'http://localhost:7860',
        NEXT_PUBLIC_WS_URL: 'ws://localhost:7860',
      },
    },
  ],
}
