module.exports = {
  apps: [
    {
      name: 'lexiflow-api',
      cwd: '/var/www/lexiflow/server',
      script: 'src/index.js',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '300M',
      env_production: {
        NODE_ENV: 'production',
        PORT: 4000,
      },
      out_file: '/var/log/pm2/lexiflow-out.log',
      error_file: '/var/log/pm2/lexiflow-error.log',
      merge_logs: true,
      time: true,
    },
  ],
};
