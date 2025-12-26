# Symancy Backend Deployment Guide

This document provides step-by-step instructions for deploying the Symancy backend to production.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Server Preparation](#server-preparation)
- [Manual Deployment](#manual-deployment)
- [Environment Variables](#environment-variables)
- [Nginx Configuration](#nginx-configuration)
- [Telegram Webhook Setup](#telegram-webhook-setup)
- [CI/CD Automation](#cicd-automation)
- [Troubleshooting](#troubleshooting)

---

## Prerequisites

### Server Requirements

- **OS**: Ubuntu 22.04+ or similar
- **Node.js**: v22.x (LTS)
- **pnpm**: v10.x
- **PM2**: Process manager for Node.js
- **Nginx**: Web server (already configured for frontend)

### Required Secrets

You'll need these values ready:

| Variable | Description | How to Get |
|----------|-------------|------------|
| `DATABASE_URL` | Supabase Postgres connection string | Supabase Dashboard -> Settings -> Database |
| `SUPABASE_URL` | Supabase project URL | Supabase Dashboard -> Settings -> API |
| `SUPABASE_SERVICE_KEY` | Supabase service role key | Supabase Dashboard -> Settings -> API |
| `TELEGRAM_BOT_TOKEN` | Bot token from BotFather | @BotFather on Telegram |
| `TELEGRAM_WEBHOOK_SECRET` | Random secret (32 hex chars) | Generate below |
| `OPENROUTER_API_KEY` | OpenRouter API key | https://openrouter.ai/keys |
| `ADMIN_CHAT_ID` | Your Telegram user ID | @userinfobot on Telegram |

### Generate Webhook Secret

Run this command to generate a secure 32-character hex secret:

```bash
openssl rand -hex 16
# Example output: a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6
```

---

## Server Preparation

### 1. Install Node.js 22.x

```bash
ssh root@91.132.59.194

# Install Node.js via NodeSource
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
apt-get install -y nodejs

# Verify
node --version  # Should show v22.x.x
```

### 2. Install pnpm

```bash
npm install -g pnpm@10
pnpm --version  # Should show 10.x.x
```

### 3. Install PM2

```bash
npm install -g pm2

# Enable PM2 startup on boot
pm2 startup systemd
# Run the command it outputs
```

### 4. Create Directory Structure

```bash
# Create backend directory (as root)
mkdir -p /var/www/symancy-backend/{releases,shared}
mkdir -p /var/log/symancy-backend

# Set ownership
chown -R deploy:deploy /var/www/symancy-backend
chown -R deploy:deploy /var/log/symancy-backend
```

---

## Manual Deployment

### Step 1: Build Locally

```bash
cd symancy-backend
pnpm install --frozen-lockfile
pnpm type-check
pnpm build
```

### Step 2: Upload to Server

```bash
RELEASE_DATE=$(date +%Y%m%d%H%M%S)
RELEASE_DIR="/var/www/symancy-backend/releases/${RELEASE_DATE}"

# Create release directory
ssh root@91.132.59.194 "mkdir -p ${RELEASE_DIR}"

# Upload files
scp -r dist package.json pnpm-lock.yaml ecosystem.config.cjs prompts root@91.132.59.194:${RELEASE_DIR}/
```

### Step 3: Install Dependencies on Server

```bash
ssh root@91.132.59.194

cd /var/www/symancy-backend/releases/${RELEASE_DATE}
pnpm install --frozen-lockfile --prod
```

### Step 4: Create Environment File

```bash
# On server
cat > /var/www/symancy-backend/shared/.env << 'EOF'
# =============================================================================
# Symancy Backend Production Environment
# =============================================================================

NODE_ENV=production
PORT=3000
MODE=BOTH
LOG_LEVEL=info

# Supabase
SUPABASE_URL=https://johspxgvkbrysxhilmbg.supabase.co
SUPABASE_SERVICE_KEY=eyJ...your-service-key...
DATABASE_URL=postgres://postgres.johspxgvkbrysxhilmbg:YOUR_PASSWORD@aws-0-eu-central-1.pooler.supabase.com:6543/postgres

# Telegram
TELEGRAM_BOT_TOKEN=YOUR_BOT_TOKEN
TELEGRAM_WEBHOOK_SECRET=YOUR_GENERATED_SECRET

# OpenRouter
OPENROUTER_API_KEY=sk-or-YOUR_KEY

# Admin
ADMIN_CHAT_ID=YOUR_TELEGRAM_ID

# Storage
PHOTO_STORAGE_PATH=/var/data/symancy/photos
EOF

# Secure permissions
chmod 600 /var/www/symancy-backend/shared/.env
chown deploy:deploy /var/www/symancy-backend/shared/.env

# Link to release
ln -sf /var/www/symancy-backend/shared/.env /var/www/symancy-backend/releases/${RELEASE_DATE}/.env
```

### Step 5: Create Photo Storage Directory

```bash
mkdir -p /var/data/symancy/photos
chown -R deploy:deploy /var/data/symancy
```

### Step 6: Switch to New Release

```bash
# Create/update symlink
ln -sfn /var/www/symancy-backend/releases/${RELEASE_DATE} /var/www/symancy-backend/current
```

### Step 7: Start with PM2

```bash
cd /var/www/symancy-backend/current

# First deployment
pm2 start ecosystem.config.cjs --env production

# Subsequent deployments
pm2 reload ecosystem.config.cjs --env production

# Save process list
pm2 save
```

### Step 8: Verify Deployment

```bash
# Check PM2 status
pm2 status

# Check logs
pm2 logs symancy-backend --lines 50

# Test health endpoint
curl http://localhost:3000/health | jq
```

---

## Nginx Configuration

### Add Backend Proxy

Edit `/etc/nginx/sites-enabled/symancy` and add these location blocks inside the server block:

```nginx
# API Endpoints
location /api {
    rewrite ^/api/(.*) /$1 break;
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_cache_bypass $http_upgrade;
}

# Telegram Webhook
location /webhook {
    rewrite ^/webhook$ /webhook/telegram break;
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header X-Telegram-Bot-Api-Secret-Token $http_x_telegram_bot_api_secret_token;
    client_max_body_size 20M;
}

# Health Check
location = /health {
    proxy_pass http://127.0.0.1:3000/health;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
}
```

### Test and Reload Nginx

```bash
nginx -t
systemctl reload nginx
```

### Verify External Access

```bash
curl https://symancy.ru/health | jq
```

---

## Telegram Webhook Setup

### Set the Webhook

Replace placeholders with your actual values:

```bash
# Your bot token
BOT_TOKEN="123456:ABC-DEF..."

# Your webhook secret (generated earlier)
WEBHOOK_SECRET="a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6"

# Set webhook
curl -X POST "https://api.telegram.org/bot${BOT_TOKEN}/setWebhook" \
  -H "Content-Type: application/json" \
  -d "{
    \"url\": \"https://symancy.ru/webhook\",
    \"secret_token\": \"${WEBHOOK_SECRET}\",
    \"allowed_updates\": [\"message\", \"callback_query\"],
    \"drop_pending_updates\": true
  }"
```

Expected response:
```json
{"ok":true,"result":true,"description":"Webhook was set"}
```

### Verify Webhook

```bash
curl "https://api.telegram.org/bot${BOT_TOKEN}/getWebhookInfo" | jq
```

Expected response:
```json
{
  "ok": true,
  "result": {
    "url": "https://symancy.ru/webhook",
    "has_custom_certificate": false,
    "pending_update_count": 0
  }
}
```

### Delete Webhook (if needed)

```bash
curl -X POST "https://api.telegram.org/bot${BOT_TOKEN}/deleteWebhook"
```

---

## CI/CD Automation

The GitHub Actions workflow (`.github/workflows/deploy-backend.yml`) automates deployment.

### Required GitHub Secrets

Add these secrets in GitHub repository settings:

| Secret | Value |
|--------|-------|
| `SSH_PRIVATE_KEY` | Private SSH key for server access |
| `SSH_KNOWN_HOSTS` | Server's SSH fingerprint |
| `SSH_USER` | `root` or `deploy` |
| `SSH_HOST` | `91.132.59.194` |
| `TELEGRAM_BOT_TOKEN` | Bot token for notifications |
| `TELEGRAM_CHAT_ID` | Chat ID for notifications |

### Trigger Deployment

1. **Automatic**: Push to `main` branch with changes in `symancy-backend/`
2. **Manual**: Go to Actions -> "Deploy Backend" -> Run workflow

---

## Troubleshooting

### Check PM2 Status

```bash
pm2 status
pm2 logs symancy-backend --lines 100
pm2 describe symancy-backend
```

### Restart Application

```bash
pm2 restart symancy-backend
# or
pm2 reload symancy-backend --env production
```

### Check Port Binding

```bash
ss -tlnp | grep 3000
# or
netstat -tlnp | grep 3000
```

### View Application Logs

```bash
# PM2 logs
pm2 logs symancy-backend

# Or direct file access
tail -f /var/log/symancy-backend/out.log
tail -f /var/log/symancy-backend/error.log
```

### Test Database Connection

```bash
# On server
curl http://localhost:3000/health | jq '.checks.database'
```

### Common Issues

**Issue**: `ECONNREFUSED` on port 3000
- Check if PM2 is running: `pm2 status`
- Check logs for startup errors: `pm2 logs symancy-backend`

**Issue**: Webhook not receiving updates
- Verify Nginx configuration: `nginx -t`
- Check webhook URL: `curl https://symancy.ru/webhook` (should return error, not 502)
- Verify secret token matches in `.env` and Telegram settings

**Issue**: Database connection failed
- Check `DATABASE_URL` in `.env`
- Verify Supabase pooler is accessible
- Check for IP restrictions in Supabase

---

## Directory Structure After Deployment

```
/var/www/symancy-backend/
├── current -> releases/20251226120000/  # Symlink to active release
├── releases/
│   ├── 20251226120000/
│   │   ├── dist/
│   │   ├── prompts/
│   │   ├── node_modules/
│   │   ├── package.json
│   │   ├── pnpm-lock.yaml
│   │   ├── ecosystem.config.cjs
│   │   └── .env -> /var/www/symancy-backend/shared/.env
│   └── ...
└── shared/
    └── .env                              # Shared environment file

/var/data/symancy/
└── photos/                               # Photo storage

/var/log/symancy-backend/
├── out.log                               # Application output
└── error.log                             # Application errors
```

---

## Quick Reference Commands

```bash
# SSH to server
ssh root@91.132.59.194

# Check status
pm2 status
curl http://localhost:3000/health | jq

# Restart
pm2 restart symancy-backend

# View logs
pm2 logs symancy-backend --lines 50

# Reload Nginx
nginx -t && systemctl reload nginx

# Check webhook
curl "https://api.telegram.org/bot${BOT_TOKEN}/getWebhookInfo" | jq
```
