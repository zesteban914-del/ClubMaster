module.exports = {
  apps: [
    {
      name: 'clubmaster',
      script: './Backend/server.js',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      error_file: './logs/pm2-error.log',
      out_file: './logs/pm2-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      env_production: {
        NODE_ENV: 'production',
        PORT: 3000
      }
    }
  ]
};
