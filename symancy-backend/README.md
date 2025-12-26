# Symancy Backend

Node.js/TypeScript backend for a coffee fortune-telling Telegram bot. The bot analyzes photos of coffee grounds and provides mystical interpretations through AI-powered vision analysis.

## Overview

Symancy Backend handles:

- **Photo Analysis**: AI vision (Claude via OpenRouter) analyzes coffee ground patterns
- **Two Personas**: Arina (warm counselor) and Cassandra (mystical oracle)
- **Chat Follow-ups**: Contextual conversations with memory (LangGraph checkpointing)
- **User Onboarding**: Guided welcome flow using LangGraph state machine
- **Proactive Engagement**: Scheduled messages (daily fortunes, weekly check-ins)
- **Credit System**: Per-reading credit costs with balance tracking

## Tech Stack

| Component | Technology |
|-----------|------------|
| Runtime | Node.js 22 |
| Language | TypeScript 5.8 |
| Framework | Fastify 5.x |
| Telegram | grammY 1.x |
| AI/LLM | LangChain.js + LangGraph |
| LLM Provider | OpenRouter (Claude models) |
| Job Queue | pg-boss (PostgreSQL-backed) |
| Database | Supabase (PostgreSQL) |
| Image Processing | Sharp |
| Containerization | Docker |

## Prerequisites

- **Node.js** >= 22.0.0
- **pnpm** >= 10.x (recommended) or npm
- **PostgreSQL** 15+ (via Supabase or local)
- **Docker** (optional, for containerized deployment)

## Quick Start

### 1. Clone and Install

```bash
cd symancy-backend
pnpm install
```

### 2. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` with your credentials (see [Environment Variables](#environment-variables) below).

### 3. Run Database Migrations

Apply migrations to your Supabase/PostgreSQL database:

```bash
# Via Supabase CLI
supabase db push

# Or manually apply each migration file in order
psql $DATABASE_URL -f migrations/003_backend_tables.sql
psql $DATABASE_URL -f migrations/004_add_daily_chat_limits.sql
psql $DATABASE_URL -f migrations/005_add_onboarding_columns.sql
psql $DATABASE_URL -f migrations/006_add_onboarding_data.sql
psql $DATABASE_URL -f migrations/007_add_engagement_columns.sql
```

### 4. Set Up Telegram Webhook

Configure your Telegram bot webhook to point to your server:

```bash
curl "https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/setWebhook" \
  -d "url=https://your-domain.com/webhook/telegram" \
  -d "secret_token=<TELEGRAM_WEBHOOK_SECRET>"
```

### 5. Run in Development

```bash
pnpm dev
```

You should see:

```
{"level":"info","msg":"Starting application...","mode":"BOTH"}
{"level":"info","msg":"Bot router initialized"}
{"level":"info","msg":"API server listening","port":3000}
{"level":"info","msg":"pg-boss started"}
{"level":"info","msg":"All workers started"}
{"level":"info","msg":"Application started successfully"}
```

## Environment Variables

### Required

| Variable | Description | Example |
|----------|-------------|---------|
| `SUPABASE_URL` | Supabase project URL | `https://xxx.supabase.co` |
| `SUPABASE_SERVICE_KEY` | Supabase service role key | `eyJ...` |
| `DATABASE_URL` | PostgreSQL connection string (use pooler URL) | `postgresql://postgres.[ref]:[pass]@aws-0-eu-central-1.pooler.supabase.com:6543/postgres` |
| `TELEGRAM_BOT_TOKEN` | Bot token from @BotFather | `123456:ABC-DEF...` |
| `TELEGRAM_WEBHOOK_SECRET` | Random secret for webhook verification (min 16 chars) | `your-secret-here` |
| `OPENROUTER_API_KEY` | OpenRouter API key | `sk-or-...` |

### Optional

| Variable | Description | Default |
|----------|-------------|---------|
| `NODE_ENV` | Environment mode | `development` |
| `PORT` | HTTP server port | `3000` |
| `MODE` | Running mode (`API`, `WORKER`, `BOTH`) | `BOTH` |
| `LOG_LEVEL` | Logging level (`trace`, `debug`, `info`, `warn`, `error`, `fatal`) | `info` |
| `ADMIN_CHAT_ID` | Telegram user ID for admin alerts | - |
| `PHOTO_STORAGE_PATH` | Path for storing photos | `./data/photos` |
| `DB_POOL_MAX` | Maximum database connections | `20` |
| `DB_POOL_IDLE_TIMEOUT_MS` | Idle connection timeout | `30000` |
| `DB_POOL_CONNECTION_TIMEOUT_MS` | Connection timeout | `2000` |

## Running Modes

The application supports three running modes controlled by the `MODE` environment variable:

| Mode | Description | Use Case |
|------|-------------|----------|
| `API` | Webhook server only | Handles incoming Telegram updates |
| `WORKER` | Background job processors only | Processes photo analysis, chat replies, engagement tasks |
| `BOTH` | API + Worker combined | Default for development and single-instance deployments |

**Production Scaling Pattern:**

```
API instances (scaled for webhook traffic)
    |
    v
PostgreSQL (pg-boss queue)
    ^
    |
WORKER instances (scaled for processing)
```

## Development

### Available Scripts

```bash
# Development with hot reload
pnpm dev

# Build TypeScript
pnpm build

# Run production build
pnpm start

# Type checking
pnpm type-check

# Run all tests
pnpm test

# Run unit tests only
pnpm test:unit

# Run integration tests only
pnpm test:integration

# Run tests in watch mode
pnpm test:watch

# Run tests with coverage
pnpm test:coverage
```

### Local Development with Docker

Start PostgreSQL locally for development:

```bash
docker-compose --profile local-dev up -d postgres
```

This starts PostgreSQL on `localhost:5432` with default credentials:

- User: `postgres`
- Password: `postgres`
- Database: `symancy`

Update your `.env`:

```bash
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/symancy
```

## Docker

### Building the Image

```bash
docker build -t symancy-backend .
```

### Running with Docker Compose

```bash
# Production (connects to external Supabase)
docker-compose up -d

# Development with local PostgreSQL
docker-compose --profile local-dev up -d
```

### Environment Variables in Docker

Create `.env` file in the project root. Docker Compose will automatically load it via `env_file: .env`.

### Docker Compose Services

| Service | Description | Profile |
|---------|-------------|---------|
| `bot` | Main application container | default |
| `postgres` | Local PostgreSQL (optional) | `local-dev` |

### Volumes

| Volume | Purpose |
|--------|---------|
| `photo_data` | Persistent photo storage (`/var/data/symancy/photos`) |
| `postgres_data` | PostgreSQL data (when using local-dev profile) |

## Project Structure

```
symancy-backend/
├── src/
│   ├── app.ts                    # Application entry point
│   ├── config/
│   │   ├── env.ts               # Environment validation (Zod)
│   │   └── constants.ts         # Application constants
│   ├── core/
│   │   ├── database.ts          # PostgreSQL connection pool
│   │   ├── queue.ts             # pg-boss queue wrapper
│   │   ├── telegram.ts          # grammY bot and webhook
│   │   ├── logger.ts            # Pino logger
│   │   └── langchain/           # LangChain/LangGraph setup
│   │       ├── models.ts        # LLM model configuration
│   │       ├── checkpointer.ts  # PostgreSQL state persistence
│   │       └── index.ts
│   ├── chains/
│   │   ├── vision.chain.ts      # Photo analysis chain
│   │   ├── interpretation.chain.ts  # Fortune interpretation
│   │   └── chat.chain.ts        # Follow-up conversation
│   ├── graphs/
│   │   └── onboarding/          # LangGraph onboarding flow
│   │       ├── graph.ts
│   │       ├── state.ts
│   │       └── nodes/
│   ├── modules/
│   │   ├── router/              # Telegram message routing
│   │   ├── photo-analysis/      # Photo handling and workers
│   │   │   ├── handler.ts
│   │   │   ├── worker.ts
│   │   │   ├── storage.service.ts
│   │   │   └── personas/        # Arina & Cassandra strategies
│   │   ├── chat/                # Chat handling and workers
│   │   ├── credits/             # Credit system
│   │   ├── onboarding/          # User onboarding UI
│   │   ├── engagement/          # Proactive messaging
│   │   │   ├── scheduler.ts     # pg-boss cron jobs
│   │   │   ├── worker.ts
│   │   │   └── triggers/        # Daily fortune, weekly check-in, etc.
│   │   └── config/              # Feature flags and config service
│   ├── types/                   # TypeScript type definitions
│   └── utils/                   # Utilities (image, retry, formatting)
├── prompts/                     # LLM prompt templates
│   ├── vision/
│   ├── arina/
│   └── cassandra/
├── migrations/                  # Database migrations
├── tests/                       # Vitest test suites
├── docker-compose.yml
├── Dockerfile
└── package.json
```

## API Endpoints

### Health Check

```
GET /health
```

Response:

```json
{
  "status": "ok",
  "version": "0.3.16",
  "uptime": 1234.56,
  "timestamp": "2024-12-26T10:00:00.000Z",
  "checks": {
    "database": "ok",
    "queue": "ok"
  }
}
```

Status codes:
- `200 OK` - All systems operational
- `503 Service Unavailable` - One or more checks failed (status: "degraded")

### Telegram Webhook

```
POST /webhook/telegram
```

Receives Telegram updates. Protected by `X-Telegram-Bot-Api-Secret-Token` header validation.

## Database Migrations

Migrations are in the `migrations/` directory and should be applied in order:

| Migration | Description |
|-----------|-------------|
| `003_backend_tables.sql` | Core tables for profiles, credits, analysis history |
| `004_add_daily_chat_limits.sql` | Daily chat limit tracking |
| `005_add_onboarding_columns.sql` | Onboarding state columns |
| `006_add_onboarding_data.sql` | Onboarding data column (JSONB) |
| `007_add_engagement_columns.sql` | Engagement tracking columns |

pg-boss automatically creates its schema (`pgboss.*`) on first start.

## Architecture

### Message Flow

```
Telegram -> Webhook -> grammY Router -> Handler
                                           |
                                           v
                                      pg-boss Queue
                                           |
                                           v
                                   Worker (LangChain)
                                           |
                                           v
                                   OpenRouter (Claude)
                                           |
                                           v
                                   Telegram (Reply)
```

### Components

1. **grammY Router**: Routes incoming messages to appropriate handlers based on message type and user state
2. **pg-boss Queue**: PostgreSQL-backed job queue for reliable async processing
3. **LangChain Chains**: Composable AI pipelines for vision analysis and conversation
4. **LangGraph**: State machine for complex flows (onboarding, multi-turn conversations)
5. **Persona Strategies**: Pluggable personality implementations (Arina, Cassandra)

### Background Jobs

| Queue | Purpose |
|-------|---------|
| `analyze-photo` | Photo vision analysis and interpretation |
| `chat-reply` | Follow-up conversation responses |
| `send-message` | Generic message sending (rate-limited) |
| `engagement-*` | Scheduled engagement tasks |

## Troubleshooting

### Common Issues

**Bot not responding to messages:**
- Verify webhook is set correctly: `curl https://api.telegram.org/bot<TOKEN>/getWebhookInfo`
- Check logs for webhook validation errors
- Ensure `TELEGRAM_WEBHOOK_SECRET` matches webhook configuration

**Database connection errors:**
- Use pooler URL (port 6543) for external connections to Supabase
- Check `DATABASE_URL` format includes all credentials
- Verify IP is not blocked by database firewall

**Jobs stuck in processing:**
- The application automatically cleans stale jobs on startup
- Check worker logs for errors
- Verify OpenRouter API key is valid and has credits

**Photo analysis timeout:**
- Large images may take longer to process
- Check OpenRouter rate limits
- Verify photo storage path is writable

### Logging

Logs are JSON-formatted (Pino). Use `pino-pretty` for human-readable output in development:

```bash
pnpm dev | pnpm pino-pretty
```

Log levels: `trace` < `debug` < `info` < `warn` < `error` < `fatal`

Set `LOG_LEVEL=debug` for detailed debugging information.

## License

UNLICENSED - Private project
