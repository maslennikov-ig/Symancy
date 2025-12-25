# Quickstart: Symancy Backend

**Version**: 1.0.0
**Date**: 2025-12-25

---

## Prerequisites

- Node.js 22+ LTS
- pnpm 10+
- Docker & Docker Compose (for local development)
- Access to Supabase project (johspxgvkbrysxhilmbg)
- OpenRouter API key
- Telegram Bot token

---

## 1. Clone and Setup

```bash
# From repository root
cd symancy-backend

# Install dependencies
pnpm install

# Copy environment template
cp .env.example .env
```

---

## 2. Environment Variables

Edit `.env`:

```bash
# Server
NODE_ENV=development
PORT=3000
MODE=BOTH  # API | WORKER | BOTH

# Supabase
SUPABASE_URL=https://johspxgvkbrysxhilmbg.supabase.co
SUPABASE_SERVICE_KEY=eyJ...  # Get from Supabase Dashboard
DATABASE_URL=postgres://postgres.[ref]:[password]@aws-0-eu-central-1.pooler.supabase.com:6543/postgres

# Telegram
TELEGRAM_BOT_TOKEN=123456:ABC...  # Get from @BotFather
TELEGRAM_WEBHOOK_SECRET=your-random-secret-min-16-chars

# OpenRouter
OPENROUTER_API_KEY=sk-or-...

# Optional
LOG_LEVEL=debug
ADMIN_CHAT_ID=123456789  # Your Telegram user ID for alerts
```

### Getting Credentials

| Credential | Source |
|------------|--------|
| SUPABASE_URL | Supabase Dashboard → Settings → API |
| SUPABASE_SERVICE_KEY | Supabase Dashboard → Settings → API → service_role |
| DATABASE_URL | Supabase Dashboard → Settings → Database → Connection string (with password) |
| TELEGRAM_BOT_TOKEN | @BotFather → /newbot or existing bot |
| OPENROUTER_API_KEY | https://openrouter.ai/keys |

---

## 3. Database Setup

### Apply Migrations

```bash
# Using Supabase CLI
npx supabase db push --db-url "$DATABASE_URL"

# Or manually via Supabase Dashboard → SQL Editor
# Copy content from migrations/003_backend_tables.sql
```

### Verify Tables

```sql
-- Check new tables exist
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN ('chat_messages', 'user_states', 'scheduled_messages', 'system_config');
```

---

## 4. Development

### Start in Development Mode

```bash
# Start with hot reload
pnpm dev

# Or with specific mode
MODE=API pnpm dev      # Only HTTP server
MODE=WORKER pnpm dev   # Only job workers
MODE=BOTH pnpm dev     # Both (default)
```

### Local Webhook Testing

For local development, use ngrok or similar:

```bash
# Terminal 1: Start ngrok
ngrok http 3000

# Terminal 2: Set webhook
curl -X POST "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://YOUR-NGROK-URL/webhook/telegram",
    "secret_token": "your-random-secret-min-16-chars"
  }'
```

### Health Check

```bash
curl http://localhost:3000/health
# {"status":"ok","version":"1.0.0","uptime":123}
```

---

## 5. Testing

```bash
# Run all tests
pnpm test

# Run unit tests only
pnpm test:unit

# Run integration tests (requires database)
pnpm test:integration

# Watch mode
pnpm test:watch

# Coverage
pnpm test:coverage
```

---

## 6. Building

```bash
# Build TypeScript
pnpm build

# Output in dist/
```

---

## 7. Production Deployment

### Docker Build

```bash
# Build image
docker build -t symancy-backend:latest .

# Run container
docker run -d \
  --name symancy-backend \
  --env-file .env.production \
  -p 3000:3000 \
  symancy-backend:latest
```

### Docker Compose

```bash
# Start with compose
docker compose up -d

# View logs
docker compose logs -f symancy-backend

# Stop
docker compose down
```

### Set Production Webhook

```bash
curl -X POST "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://api.symancy.ru/webhook/telegram",
    "secret_token": "YOUR_PRODUCTION_SECRET"
  }'
```

---

## 8. Project Structure

```
symancy-backend/
├── src/
│   ├── app.ts                  # Entry point
│   ├── config/                 # Environment, constants
│   ├── core/                   # Infrastructure (db, queue, telegram, langchain)
│   ├── chains/                 # LangChain chains
│   ├── graphs/                 # LangGraph state machines
│   ├── modules/                # Business logic
│   ├── types/                  # TypeScript types
│   └── utils/                  # Utilities
├── migrations/                 # SQL migrations
├── prompts/                    # LLM prompts
├── tests/                      # Test files
├── Dockerfile
├── docker-compose.yml
└── package.json
```

---

## 9. Common Tasks

### Check pg-boss Queue Status

```bash
# Via psql or Supabase SQL Editor
SELECT name, state, COUNT(*)
FROM pgboss.job
GROUP BY name, state;
```

### Clear Stale Processing Locks

```sql
-- Auto-cleanup at startup, but manual if needed:
UPDATE user_states
SET current_mode = 'idle', updated_at = NOW()
WHERE current_mode = 'processing'
AND updated_at < NOW() - INTERVAL '5 minutes';
```

### Reload System Config

Config is cached for 60 seconds. To force reload:

```bash
# Restart the service
docker compose restart symancy-backend
```

---

## 10. Troubleshooting

### Bot Not Responding

1. Check webhook status:
   ```bash
   curl "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/getWebhookInfo"
   ```

2. Check logs:
   ```bash
   docker compose logs -f symancy-backend
   ```

3. Verify environment variables are set correctly

### Database Connection Issues

1. Check DATABASE_URL format (pooler URL for external connections)
2. Verify IP is whitelisted in Supabase Dashboard
3. Check SSL mode in connection string

### Job Queue Backlog

1. Check queue status (see above)
2. Increase workers if needed
3. Check for failed jobs and retry

---

## Next Steps

1. Read [spec.md](./spec.md) for full requirements
2. Read [research.md](./research.md) for technical decisions
3. Read [data-model.md](./data-model.md) for database schema
4. Run `/speckit.tasks` to generate implementation tasks
