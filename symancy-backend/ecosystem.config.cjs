/**
 * PM2 Ecosystem Configuration for Symancy Backend
 *
 * Usage:
 *   pm2 start ecosystem.config.cjs
 *   pm2 restart symancy-backend
 *   pm2 logs symancy-backend
 *   pm2 monit
 *
 * Production:
 *   pm2 start ecosystem.config.cjs --env production
 */
module.exports = {
  apps: [
    {
      name: 'symancy-backend',
      script: './dist/app.js',
      cwd: '/var/www/symancy-backend/current',
      node_args: '--env-file=.env',

      // Process settings
      instances: 1,                    // Single instance (bot requires single process)
      exec_mode: 'fork',              // Fork mode (not cluster - webhook needs single process)

      // Auto-restart settings
      autorestart: true,
      watch: false,                    // Don't watch in production
      max_memory_restart: '512M',      // Restart if memory exceeds 512MB

      // Logs
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      error_file: '/var/log/symancy-backend/error.log',
      out_file: '/var/log/symancy-backend/out.log',
      merge_logs: true,

      // Graceful shutdown
      kill_timeout: 10000,             // 10s to complete shutdown
      wait_ready: true,                // Wait for process.send('ready')
      listen_timeout: 30000,           // 30s max startup time

      // Environment variables
      env: {
        NODE_ENV: 'development',
        PORT: 3000,
        MODE: 'BOTH',
        LOG_LEVEL: 'debug',
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 3000,
        MODE: 'BOTH',
        LOG_LEVEL: 'info',
      },

      // Note: Sensitive env vars should be loaded from .env file
      // The app reads from process.env which includes .env via dotenv or external source
    },
  ],
};
