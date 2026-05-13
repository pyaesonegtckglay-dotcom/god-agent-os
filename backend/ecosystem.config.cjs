module.exports = {
  apps: [
    {
      name: 'devin-backend',
      script: 'uvicorn',
      args: 'main:app --host 0.0.0.0 --port 7860 --loop asyncio --log-level info',
      interpreter: 'python3',
      cwd: '/home/user/devin-agent/backend',
      watch: false,
      instances: 1,
      exec_mode: 'fork',
      env: {
        PORT: 7860,
        HOST: '0.0.0.0',
        DB_PATH: '/tmp/devin_agent.db',
        PYTHONUNBUFFERED: '1',
      },
    },
  ],
}
