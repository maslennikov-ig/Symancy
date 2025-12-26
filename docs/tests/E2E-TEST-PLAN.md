# E2E Test Plan: Symancy Backend

**Version**: 1.0
**Date**: 2024-12-26
**Scope**: Full backend functionality testing
**Environment**: Local development

---

## Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Local Setup](#local-setup)
4. [Test Data](#test-data)
5. [Test Scenarios](#test-scenarios)
   - [US1: Photo Analysis](#us1-photo-analysis)
   - [US2: Chat / Follow-up](#us2-chat--follow-up)
   - [US3: Onboarding](#us3-onboarding)
   - [US4: Cassandra Premium](#us4-cassandra-premium)
   - [US5: Proactive Engagement](#us5-proactive-engagement)
6. [Edge Cases](#edge-cases)
7. [Error Scenarios](#error-scenarios)
8. [Security Tests](#security-tests)
9. [Performance Tests](#performance-tests)
10. [Test Execution Checklist](#test-execution-checklist)

---

## Overview

This document describes manual E2E tests for the Symancy coffee fortune-telling Telegram bot backend. Tests are designed for local execution before production deployment.

### What We're Testing

| Component | Description |
|-----------|-------------|
| Photo Analysis | Vision AI analysis of coffee cup photos |
| Interpretation | Fortune-telling based on visual patterns |
| Chat | Follow-up questions with context |
| Onboarding | New user registration flow |
| Credits | Credit consumption and validation |
| Proactive | Scheduled engagement messages |

---

## Prerequisites

### Required Software

- Node.js 22+
- pnpm 9+
- PostgreSQL 15+ (or Supabase)
- ngrok (for webhook testing)
- Telegram account (for bot testing)

### Required Accounts

- Telegram Bot Token (from @BotFather)
- OpenRouter API Key (for LLM)
- Supabase project (for database)

### Test Photos

Place test photos in `/docs/tests/photos/`:

| File | Description | Expected Result |
|------|-------------|-----------------|
| `coffee-cup-1.jpg` | Clear coffee grounds pattern | Successful analysis |
| `coffee-cup-2.jpg` | Another coffee pattern | Successful analysis |
| `coffee-cup-tomatoes.jpg` | Cup with tomato decorations | Focus on grounds, ignore tomatoes |
| `coffee-cup-dark.jpg` | Dark/underexposed photo | Should still work |
| `coffee-cup-blurry.jpg` | Slightly blurry | May affect interpretation |
| `coffee-cup-minimal.jpg` | Very little coffee residue | Should find patterns anyway |
| `not-coffee.jpg` | Random image (cat, food) | Should detect "not coffee" |
| `large-photo.jpg` | >10MB file | Should reject with error |
| `small-photo.jpg` | Very small (<100x100) | Should work but quality warning |

---

## Local Setup

### Step 1: Environment Configuration

```bash
cd symancy-backend

# Copy environment template
cp .env.example .env

# Edit .env with your values:
```

**.env file:**
```env
# Server
NODE_ENV=development
PORT=3000
LOG_LEVEL=debug

# Database (Supabase)
DATABASE_URL=postgresql://postgres:[PASSWORD]@db.[PROJECT].supabase.co:5432/postgres
SUPABASE_URL=https://[PROJECT].supabase.co
SUPABASE_SERVICE_KEY=eyJ...

# Telegram
TELEGRAM_BOT_TOKEN=123456:ABC-DEF...
TELEGRAM_WEBHOOK_SECRET=test-secret-123

# OpenRouter (LLM)
OPENROUTER_API_KEY=sk-or-v1-...

# Admin
ADMIN_CHAT_ID=123456789

# Storage
PHOTO_STORAGE_PATH=./data/photos
```

### Step 2: Database Setup

```bash
# Run migrations
psql $DATABASE_URL -f migrations/003_backend_tables.sql
psql $DATABASE_URL -f migrations/004_add_daily_chat_limits.sql
psql $DATABASE_URL -f migrations/005_add_goals_column.sql
psql $DATABASE_URL -f migrations/006_add_onboarding_data.sql
psql $DATABASE_URL -f migrations/007_add_engagement_columns.sql
```

### Step 3: Build and Start

```bash
# Install dependencies
pnpm install

# Build
pnpm build

# Start in development mode
pnpm dev
```

### Step 4: Expose Webhook (ngrok)

```bash
# In separate terminal
ngrok http 3000

# Copy the HTTPS URL (e.g., https://abc123.ngrok.io)
```

### Step 5: Set Telegram Webhook

```bash
# Replace with your values
BOT_TOKEN="your-bot-token"
WEBHOOK_URL="https://abc123.ngrok.io/webhook/telegram"
SECRET="test-secret-123"

curl -X POST "https://api.telegram.org/bot${BOT_TOKEN}/setWebhook" \
  -H "Content-Type: application/json" \
  -d "{
    \"url\": \"${WEBHOOK_URL}\",
    \"secret_token\": \"${SECRET}\",
    \"allowed_updates\": [\"message\", \"callback_query\"]
  }"
```

### Step 6: Verify Setup

```bash
# Check health endpoint
curl http://localhost:3000/health | jq

# Expected:
# {
#   "status": "healthy",
#   "version": "0.3.16",
#   "uptime": 123.45
# }
```

---

## Test Data

### Test User Setup

Before testing, create a test user in the database:

```sql
-- Create test user profile
INSERT INTO profiles (telegram_user_id, name, onboarding_completed, credits)
VALUES (YOUR_TELEGRAM_ID, 'Test User', false, 10);

-- Or reset existing user for fresh testing:
UPDATE profiles
SET onboarding_completed = false,
    credits = 10,
    name = NULL
WHERE telegram_user_id = YOUR_TELEGRAM_ID;

-- Clear user state
DELETE FROM user_states WHERE telegram_user_id = YOUR_TELEGRAM_ID;

-- Clear chat history
DELETE FROM chat_messages WHERE telegram_user_id = YOUR_TELEGRAM_ID;

-- Clear analysis history
DELETE FROM analysis_history WHERE telegram_user_id = YOUR_TELEGRAM_ID;
```

### Get Your Telegram ID

Send `/start` to @userinfobot on Telegram to get your user ID.

---

## Test Scenarios

### US1: Photo Analysis

#### TC-US1-001: Basic Photo Analysis (Arina)

**Preconditions:**
- User has 1+ credits
- User has completed onboarding

**Steps:**
1. Send a coffee cup photo to the bot (no caption)
2. Wait for response

**Expected Results:**
- [ ] Immediate loading message: "☕ Смотрю в гущу..."
- [ ] Within 30 seconds: Full interpretation in Russian
- [ ] Interpretation is 200-500 words
- [ ] Warm, supportive tone (Arina persona)
- [ ] 1 credit consumed
- [ ] Analysis saved to `analysis_history` table

**Verification SQL:**
```sql
SELECT id, persona, vision_result, interpretation, created_at
FROM analysis_history
WHERE telegram_user_id = YOUR_ID
ORDER BY created_at DESC
LIMIT 1;
```

---

#### TC-US1-002: Photo Analysis with English User

**Preconditions:**
- User's Telegram language is English (`en`)
- User has 1+ credits

**Steps:**
1. Send coffee cup photo

**Expected Results:**
- [ ] Loading message in English: "☕ Looking into the grounds..."
- [ ] Interpretation in English
- [ ] Same quality as Russian

---

#### TC-US1-003: Photo Too Large

**Preconditions:**
- Prepare photo >10MB

**Steps:**
1. Send large photo to bot

**Expected Results:**
- [ ] Error message: "📸 Изображение слишком большое..."
- [ ] No credit consumed
- [ ] No job created in queue

---

#### TC-US1-004: Insufficient Credits

**Preconditions:**
- Set user credits to 0

```sql
UPDATE profiles SET credits = 0 WHERE telegram_user_id = YOUR_ID;
```

**Steps:**
1. Send coffee cup photo

**Expected Results:**
- [ ] Loading message appears
- [ ] Then replaced with: "💳 Недостаточно кредитов..."
- [ ] No analysis performed

---

#### TC-US1-005: Non-Coffee Image

**Preconditions:**
- Prepare image of cat, food, or random object

**Steps:**
1. Send non-coffee image

**Expected Results:**
- [ ] Analysis still runs (vision model describes what it sees)
- [ ] Interpretation handles gracefully (mentions this doesn't look like coffee grounds)
- [ ] Credit is still consumed (by design)

---

#### TC-US1-006: Multiple Photos in Sequence

**Preconditions:**
- User has 3+ credits

**Steps:**
1. Send photo 1
2. Wait 5 seconds
3. Send photo 2
4. Wait 5 seconds
5. Send photo 3

**Expected Results:**
- [ ] Each photo processed independently
- [ ] Each gets unique interpretation
- [ ] 3 credits consumed
- [ ] No race conditions

---

#### TC-US1-007: Decorated Cup (Ignore Cup Design)

**Preconditions:**
- User has 1+ credits
- Use photo: `docs/tests/photos/coffee-cup-tomatoes.jpg` (cup with tomato decorations)

**Steps:**
1. Send photo of coffee cup that has decorative prints (tomatoes, flowers, etc.) on the porcelain

**Expected Results:**
- [ ] Vision analysis focuses ONLY on coffee grounds (brown stains at bottom)
- [ ] Interpretation does NOT mention tomatoes, flowers, or cup decorations
- [ ] Interpretation describes patterns in the actual coffee residue
- [ ] No confusion between printed decorations and coffee patterns

**Why This Matters:**
- Many cups have decorative designs printed on them
- Model must distinguish between:
  - Cup decoration (printed, permanent, colorful)
  - Coffee grounds (organic, brown, irregular stains)

**Verification:**
Check the `vision_result` in database - it should NOT contain references to "tomatoes", "flowers", or other cup decorations:
```sql
SELECT vision_result FROM analysis_history
WHERE telegram_user_id = YOUR_ID
ORDER BY created_at DESC LIMIT 1;
```

---

#### TC-US1-008: Cup with Minimal Grounds

**Preconditions:**
- Photo with very little coffee residue (almost clean cup)

**Steps:**
1. Send photo of cup with minimal coffee grounds

**Expected Results:**
- [ ] Model still finds patterns (per prompt requirements)
- [ ] Interpretation is creative but based on actual residue
- [ ] No "I cannot see anything" responses

---

### US2: Chat / Follow-up

#### TC-US2-001: Follow-up Question After Analysis

**Preconditions:**
- User just received analysis
- User has not exceeded daily chat limit

**Steps:**
1. After analysis, send text: "Что означает символ сердца?"

**Expected Results:**
- [ ] Bot responds with context from last analysis
- [ ] Response references the specific interpretation
- [ ] Response is helpful and on-topic
- [ ] No credit consumed (chat is free)

---

#### TC-US2-002: Chat Without Prior Analysis

**Preconditions:**
- User has no analysis history (new user who completed onboarding)

**Steps:**
1. Send text message: "Привет, расскажи о себе"

**Expected Results:**
- [ ] Bot responds appropriately
- [ ] Introduces itself as fortune-teller
- [ ] Suggests sending a coffee cup photo

---

#### TC-US2-003: Chat History Context

**Preconditions:**
- User has multiple previous chat messages

**Steps:**
1. Ask: "Ты помнишь, о чем мы говорили?"
2. Ask follow-up questions referencing earlier conversation

**Expected Results:**
- [ ] Bot demonstrates awareness of chat history
- [ ] Maintains context across messages
- [ ] Last 20 messages are considered

---

#### TC-US2-004: Daily Chat Limit (50 messages)

**Preconditions:**
- Set user's daily chat count near limit:

```sql
UPDATE user_states
SET daily_chat_count = 49,
    daily_chat_reset_at = NOW() + INTERVAL '1 hour'
WHERE telegram_user_id = YOUR_ID;
```

**Steps:**
1. Send text message (should work - message 50)
2. Send another text message (should fail - message 51)

**Expected Results:**
- [ ] First message: Normal response
- [ ] Second message: "Вы достигли лимита сообщений на сегодня..."
- [ ] Limit resets after 24 hours

---

#### TC-US2-005: Empty or Very Short Message

**Steps:**
1. Send message: "."
2. Send message: "ok"

**Expected Results:**
- [ ] Bot handles gracefully
- [ ] Provides meaningful response or prompts for more detail

---

#### TC-US2-006: Very Long Message

**Steps:**
1. Send message with 2000+ characters

**Expected Results:**
- [ ] Message processed (within Telegram's 4096 char limit)
- [ ] Bot responds appropriately
- [ ] No truncation issues

---

### US3: Onboarding

#### TC-US3-001: New User Complete Flow

**Preconditions:**
- User not in database OR reset onboarding:

```sql
UPDATE profiles SET onboarding_completed = false, name = NULL WHERE telegram_user_id = YOUR_ID;
DELETE FROM user_states WHERE telegram_user_id = YOUR_ID;
```

**Steps:**
1. Send `/start`
2. Observe welcome message with name input request
3. Enter name: "Александр"
4. Select goals (click inline buttons): "карьера", "отношения"
5. If asked about timezone, select or skip
6. Complete onboarding

**Expected Results:**
- [ ] Step 1: Welcome message with greeting
- [ ] Step 2: Ask for name prompt
- [ ] Step 3: Confirm name, ask about goals
- [ ] Step 4: Goals saved, ask timezone (if "духовный рост" selected) or complete
- [ ] Step 5: Completion message with bonus credit notification
- [ ] Database: `onboarding_completed = true`, `name = 'Александр'`, `credits += 1`

**Verification SQL:**
```sql
SELECT name, onboarding_completed, credits, goals, timezone
FROM profiles
WHERE telegram_user_id = YOUR_ID;
```

---

#### TC-US3-002: Onboarding with Timezone Selection

**Preconditions:**
- Reset user for onboarding

**Steps:**
1. Send `/start`
2. Enter name
3. Select "духовный рост" (spiritual growth) as goal
4. Timezone selection should appear
5. Select "Москва" or skip

**Expected Results:**
- [ ] Timezone keyboard appears only if "духовный рост" selected
- [ ] Timezone saved to profile
- [ ] Default is Europe/Moscow if skipped

---

#### TC-US3-003: Onboarding Interruption

**Preconditions:**
- Start onboarding but don't complete

**Steps:**
1. Send `/start`
2. Enter name
3. Close Telegram app
4. Reopen and send `/start` again

**Expected Results:**
- [ ] Onboarding resumes from last step (LangGraph state persisted)
- [ ] User doesn't have to restart from beginning

---

#### TC-US3-004: Skip Onboarding Photo

**Preconditions:**
- User in onboarding flow

**Steps:**
1. During onboarding (after `/start`), send a photo instead of text

**Expected Results:**
- [ ] Bot reminds user to complete onboarding first
- [ ] Photo not processed until onboarding complete

---

#### TC-US3-005: Invalid Name Input

**Steps:**
1. During name input step, send very long name (>100 chars)
2. Send name with special characters: "<script>alert('xss')</script>"

**Expected Results:**
- [ ] Long name: Truncated or error message
- [ ] Special chars: Sanitized, no XSS vulnerability

---

### US4: Cassandra Premium

#### TC-US4-001: Cassandra via Caption Keyword

**Preconditions:**
- User has 3+ credits (Cassandra costs 3)
- User completed onboarding

**Steps:**
1. Send photo with caption: "cassandra"

**Expected Results:**
- [ ] Loading message: "🔮 Всматриваюсь в знаки судьбы..."
- [ ] Extended interpretation (mystical oracle style)
- [ ] Longer than Arina's interpretation
- [ ] 3 credits consumed

---

#### TC-US4-002: Cassandra via Russian Keyword

**Steps:**
1. Send photo with caption: "кассандра"

**Expected Results:**
- [ ] Same as TC-US4-001
- [ ] Cassandra persona activated

---

#### TC-US4-003: Cassandra via "Premium" Keyword

**Steps:**
1. Send photo with caption: "premium гадание"

**Expected Results:**
- [ ] Cassandra persona activated
- [ ] Premium interpretation style

---

#### TC-US4-004: Cassandra with Insufficient Credits

**Preconditions:**
- Set user credits to 2 (less than 3 required)

```sql
UPDATE profiles SET credits = 2 WHERE telegram_user_id = YOUR_ID;
```

**Steps:**
1. Send photo with caption: "cassandra"

**Expected Results:**
- [ ] Error: "💳 Недостаточно кредитов для премиум гадания. Необходимо: 3 кредита."
- [ ] No credits consumed

---

#### TC-US4-005: Case Insensitive Keywords

**Steps:**
1. Send photo with caption: "CASSANDRA"
2. Send photo with caption: "CasSanDrA"
3. Send photo with caption: "ПРЕМИУМ"

**Expected Results:**
- [ ] All trigger Cassandra persona (case insensitive matching)

---

### US5: Proactive Engagement

#### TC-US5-001: Inactive User Reminder

**Preconditions:**
- Set user's last interaction to 8 days ago:

```sql
UPDATE profiles
SET updated_at = NOW() - INTERVAL '8 days'
WHERE telegram_user_id = YOUR_ID;
```

**Steps:**
1. Manually trigger inactive reminder job:

```bash
# In separate terminal, call pg-boss directly or wait for cron (10:00 MSK)
```

**Expected Results:**
- [ ] User receives reminder message
- [ ] Message is warm and inviting
- [ ] User's `last_proactive_at` updated

---

#### TC-US5-002: Weekly Check-in (Monday)

**Preconditions:**
- User has `notifications_enabled = true`
- Current day is Monday (or simulate)

**Steps:**
1. Wait for 10:00 MSK Monday cron
2. Or manually trigger weekly check-in

**Expected Results:**
- [ ] User receives weekly check-in message
- [ ] Personalized based on user's goals

---

#### TC-US5-003: Daily Fortune (Subscribers)

**Preconditions:**
- User has `daily_fortune_enabled = true`

```sql
UPDATE profiles SET daily_fortune_enabled = true WHERE telegram_user_id = YOUR_ID;
```

**Steps:**
1. Wait for 08:00 MSK cron
2. Or manually trigger

**Expected Results:**
- [ ] User receives daily fortune message
- [ ] Short, inspiring content

---

#### TC-US5-004: Proactive Messages Disabled

**Preconditions:**
- User has `notifications_enabled = false`

```sql
UPDATE profiles SET notifications_enabled = false WHERE telegram_user_id = YOUR_ID;
```

**Steps:**
1. Set user as inactive (8+ days)
2. Trigger proactive job

**Expected Results:**
- [ ] No message sent
- [ ] User's preference respected

---

---

## Edge Cases

### EC-001: Concurrent Photo Requests

**Steps:**
1. Send 3 photos rapidly (within 1 second)

**Expected Results:**
- [ ] All 3 processed correctly
- [ ] No duplicate responses
- [ ] 3 credits consumed
- [ ] Rate limiting may delay responses (10 req/min)

---

### EC-002: Webhook Retry

**Steps:**
1. Simulate slow processing (>30 seconds)
2. Telegram may retry webhook

**Expected Results:**
- [ ] Duplicate detection prevents double processing
- [ ] User receives only one response

---

### EC-003: Bot Restart During Processing

**Steps:**
1. Send photo
2. Kill and restart the bot process before response

**Expected Results:**
- [ ] Job remains in pg-boss queue
- [ ] After restart, job is picked up and completed
- [ ] User receives response

---

### EC-004: Database Connection Loss

**Steps:**
1. Temporarily block database connection
2. Send message to bot
3. Restore connection

**Expected Results:**
- [ ] Error logged
- [ ] Admin alert sent
- [ ] Graceful error message to user
- [ ] Recovery after connection restored

---

### EC-005: OpenRouter API Failure

**Steps:**
1. Set invalid OPENROUTER_API_KEY temporarily
2. Send photo

**Expected Results:**
- [ ] Retry logic attempts 3 times
- [ ] After failure, fallback interpretation shown
- [ ] User receives graceful error message
- [ ] Credit NOT consumed (refunded)

---

### EC-006: Message Splitting (Long Interpretation)

**Steps:**
1. If interpretation exceeds 4096 chars (rare)

**Expected Results:**
- [ ] Message split into multiple parts
- [ ] All parts sent in order
- [ ] No truncation

---

### EC-007: Unicode and Emoji in Captions

**Steps:**
1. Send photo with caption: "🔮 cassandra ✨ премиум 💫"

**Expected Results:**
- [ ] Keywords detected despite emoji
- [ ] Cassandra persona activated

---

### EC-008: Empty Photo Array

**Steps:**
1. Send document instead of photo (e.g., PDF)

**Expected Results:**
- [ ] Not processed as photo
- [ ] Appropriate error or ignored

---

---

## Error Scenarios

### ERR-001: Invalid Webhook Secret

**Steps:**
1. Send POST to `/webhook/telegram` without `X-Telegram-Bot-Api-Secret-Token` header

**Expected Results:**
- [ ] HTTP 401 or 403
- [ ] Request rejected
- [ ] No processing

---

### ERR-002: Malformed JSON Payload

**Steps:**
1. Send invalid JSON to webhook

**Expected Results:**
- [ ] HTTP 400
- [ ] Error logged
- [ ] No crash

---

### ERR-003: Missing Required Fields

**Steps:**
1. Send webhook with missing `message.from.id`

**Expected Results:**
- [ ] Graceful handling
- [ ] Error logged
- [ ] No crash

---

### ERR-004: Queue Worker Crash Recovery

**Steps:**
1. Force crash in worker (throw unhandled error)
2. Check job retry

**Expected Results:**
- [ ] Job retried up to 3 times
- [ ] After 3 failures, marked as failed
- [ ] Admin alert sent

---

### ERR-005: File Download Failure

**Steps:**
1. Send photo, then delete it from Telegram before processing

**Expected Results:**
- [ ] File download fails
- [ ] Graceful error message
- [ ] Credit refunded

---

---

## Security Tests

### SEC-001: SQL Injection Attempt

**Steps:**
1. During onboarding, enter name: `'; DROP TABLE profiles; --`

**Expected Results:**
- [ ] Name saved as string (escaped)
- [ ] No SQL injection
- [ ] Database intact

---

### SEC-002: XSS in User Input

**Steps:**
1. Enter name: `<script>alert('xss')</script>`
2. Check if name displayed in any response

**Expected Results:**
- [ ] Script tags escaped or stripped
- [ ] No XSS vulnerability

---

### SEC-003: Caption Injection

**Steps:**
1. Send photo with caption: `cassandra\n\n[SYSTEM PROMPT OVERRIDE]`

**Expected Results:**
- [ ] Prompt injection attempt fails
- [ ] Normal Cassandra interpretation

---

### SEC-004: Rate Limiting

**Steps:**
1. Send 15 messages within 1 minute

**Expected Results:**
- [ ] First 10 processed normally
- [ ] Messages 11-15 rate limited
- [ ] User sees rate limit message

---

### SEC-005: Admin Alert Confidentiality

**Steps:**
1. Trigger an error
2. Check admin alert content

**Expected Results:**
- [ ] Error details sent to ADMIN_CHAT_ID
- [ ] No sensitive data (tokens, passwords) in alert
- [ ] User ID included for debugging

---

---

## Performance Tests

### PERF-001: Response Time (Photo Analysis)

**Acceptance Criteria:**
- [ ] Loading message: <500ms
- [ ] Full interpretation: <30 seconds
- [ ] P95: <45 seconds

**Measurement:**
```bash
# Time from photo send to final response
```

---

### PERF-002: Response Time (Chat)

**Acceptance Criteria:**
- [ ] Chat response: <5 seconds
- [ ] P95: <10 seconds

---

### PERF-003: Concurrent Users

**Steps:**
1. Simulate 10 concurrent photo requests

**Acceptance Criteria:**
- [ ] All processed within 60 seconds
- [ ] No errors
- [ ] No memory leaks

---

### PERF-004: Queue Backlog Handling

**Steps:**
1. Queue 50 jobs rapidly
2. Monitor processing

**Acceptance Criteria:**
- [ ] All jobs processed
- [ ] No crashes
- [ ] Memory stable

---

---

## Test Execution Checklist

Use this checklist during testing:

### Pre-Test Setup

- [ ] Environment configured (.env file)
- [ ] Database migrations applied
- [ ] Test user created with credits
- [ ] ngrok tunnel active
- [ ] Webhook set and verified
- [ ] Server running (`pnpm dev`)
- [ ] Test photos ready

### Core Functionality

- [ ] TC-US1-001: Basic Photo Analysis
- [ ] TC-US1-003: Photo Too Large
- [ ] TC-US1-004: Insufficient Credits
- [ ] TC-US2-001: Follow-up Question
- [ ] TC-US2-004: Daily Chat Limit
- [ ] TC-US3-001: Complete Onboarding
- [ ] TC-US4-001: Cassandra Premium
- [ ] TC-US5-001: Inactive Reminder

### Edge Cases

- [ ] EC-001: Concurrent Requests
- [ ] EC-003: Bot Restart Recovery
- [ ] EC-005: API Failure Handling

### Security

- [ ] SEC-001: SQL Injection
- [ ] SEC-002: XSS Prevention
- [ ] SEC-004: Rate Limiting

### Performance

- [ ] PERF-001: Photo <30s
- [ ] PERF-002: Chat <5s

---

## Test Results Template

Use this template to record results:

```markdown
## Test Session: YYYY-MM-DD

**Tester**: [Name]
**Environment**: Local / Staging
**Version**: 0.3.16

### Results Summary

| Category | Passed | Failed | Blocked |
|----------|--------|--------|---------|
| US1 Photo | X/6 | X | X |
| US2 Chat | X/6 | X | X |
| US3 Onboarding | X/5 | X | X |
| US4 Cassandra | X/5 | X | X |
| US5 Proactive | X/4 | X | X |
| Edge Cases | X/8 | X | X |
| Security | X/5 | X | X |
| Performance | X/4 | X | X |

### Failed Tests

| Test ID | Issue | Severity | Notes |
|---------|-------|----------|-------|
| TC-XXX | Description | High/Med/Low | ... |

### Bugs Found

1. **BUG-001**: [Title]
   - Steps to reproduce
   - Expected vs Actual
   - Severity

### Notes

[Any additional observations]
```

---

## Appendix: Useful Commands

### Database Queries

```sql
-- Check user credits
SELECT telegram_user_id, name, credits, onboarding_completed
FROM profiles WHERE telegram_user_id = YOUR_ID;

-- Check analysis history
SELECT id, persona, created_at,
       LENGTH(interpretation) as interp_length
FROM analysis_history
WHERE telegram_user_id = YOUR_ID
ORDER BY created_at DESC;

-- Check chat history
SELECT role, content, created_at
FROM chat_messages
WHERE telegram_user_id = YOUR_ID
ORDER BY created_at DESC
LIMIT 20;

-- Check job queue
SELECT id, name, state, createdon, startedon, completedon
FROM pgboss.job
ORDER BY createdon DESC
LIMIT 20;

-- Reset user for testing
UPDATE profiles SET credits = 10, onboarding_completed = false, name = NULL
WHERE telegram_user_id = YOUR_ID;
DELETE FROM user_states WHERE telegram_user_id = YOUR_ID;
DELETE FROM chat_messages WHERE telegram_user_id = YOUR_ID;
DELETE FROM analysis_history WHERE telegram_user_id = YOUR_ID;
```

### Telegram API

```bash
# Get webhook info
curl "https://api.telegram.org/bot${BOT_TOKEN}/getWebhookInfo" | jq

# Delete webhook
curl "https://api.telegram.org/bot${BOT_TOKEN}/deleteWebhook"

# Get updates (polling mode)
curl "https://api.telegram.org/bot${BOT_TOKEN}/getUpdates" | jq
```

### Log Monitoring

```bash
# Watch server logs
pnpm dev 2>&1 | pino-pretty

# Filter by module
pnpm dev 2>&1 | pino-pretty | grep "photo-analysis"
```

---

## Automated Tests (For Next Context)

This section describes how to implement automated tests based on this plan.

### Test Framework

```bash
# Testing stack
- Vitest (unit + integration tests)
- Supertest (HTTP endpoint testing)
- Test containers (PostgreSQL)
```

### Directory Structure

```
symancy-backend/tests/
├── unit/
│   ├── chains/
│   │   ├── vision.chain.test.ts
│   │   ├── interpretation.chain.test.ts
│   │   └── chat.chain.test.ts
│   ├── utils/
│   │   ├── retry.test.ts
│   │   ├── message-splitter.test.ts
│   │   └── image-processor.test.ts
│   └── services/
│       ├── credits.test.ts
│       └── config.test.ts
├── integration/
│   ├── handlers/
│   │   ├── photo.handler.test.ts
│   │   ├── chat.handler.test.ts
│   │   └── onboarding.handler.test.ts
│   ├── workers/
│   │   ├── photo.worker.test.ts
│   │   └── chat.worker.test.ts
│   └── graphs/
│       └── onboarding.graph.test.ts
├── e2e/
│   └── bot.e2e.test.ts
├── fixtures/
│   ├── photos/           # Test images
│   ├── mock-responses/   # LLM mock responses
│   └── db-seeds/         # Database fixtures
└── setup/
    ├── vitest.setup.ts
    ├── test-db.ts
    └── mocks/
        ├── openrouter.mock.ts
        └── telegram.mock.ts
```

### Mock Strategy

#### OpenRouter API Mock

```typescript
// tests/setup/mocks/openrouter.mock.ts
import { vi } from 'vitest';

export const mockVisionResponse = {
  content: `PRIMARY PATTERN: A bird shape in the center

SECONDARY PATTERNS:
1. Heart shape - lower left
2. Star formation - upper right
3. Wave pattern - along the edge

OVERALL COMPOSITION: Harmonious flow from center outward`,
};

export const mockInterpretationResponse = {
  content: `☕ В вашей чашке я вижу удивительные образы...

🕊️ **Птица в центре** символизирует...`,
};

vi.mock('@langchain/openai', () => ({
  ChatOpenAI: vi.fn().mockImplementation(() => ({
    invoke: vi.fn().mockResolvedValue(mockVisionResponse),
  })),
}));
```

#### Telegram API Mock

```typescript
// tests/setup/mocks/telegram.mock.ts
export const mockTelegramContext = {
  from: { id: 123456789, language_code: 'ru' },
  chat: { id: 123456789 },
  message: {
    photo: [{ file_id: 'test-file-id', file_size: 50000 }],
    caption: undefined,
  },
  reply: vi.fn(),
  api: {
    editMessageText: vi.fn(),
    getFile: vi.fn().mockResolvedValue({ file_path: 'photos/test.jpg' }),
  },
};
```

### Key Test Cases to Automate

| Priority | Test | Type | Mock Requirements |
|----------|------|------|-------------------|
| P1 | Photo analysis flow | Integration | OpenRouter, Telegram |
| P1 | Credit consumption | Unit | Database |
| P1 | Decorated cup detection | Integration | OpenRouter (verify prompt) |
| P1 | Rate limiting | Unit | None |
| P2 | Onboarding graph | Integration | LangGraph checkpointer |
| P2 | Chat with history | Integration | Database, OpenRouter |
| P2 | Error recovery | Integration | OpenRouter (mock failures) |
| P3 | Cassandra persona | Integration | OpenRouter |
| P3 | Message splitting | Unit | None |

### Sample Test: Decorated Cup

```typescript
// tests/integration/handlers/photo.handler.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handlePhotoMessage } from '../../../src/modules/photo-analysis/handler';
import { mockTelegramContext } from '../../setup/mocks/telegram.mock';

describe('Photo Handler - Decorated Cup', () => {
  it('should ignore cup decorations and focus on coffee grounds', async () => {
    // Arrange
    const ctx = {
      ...mockTelegramContext,
      message: {
        photo: [{ file_id: 'decorated-cup-id', file_size: 100000 }],
        caption: undefined,
      },
    };

    // Act
    await handlePhotoMessage(ctx);

    // Assert - verify the vision prompt was called
    // Check that interpretation doesn't mention "tomatoes"
    expect(ctx.reply).toHaveBeenCalled();

    // Get the final response text
    const responseText = ctx.api.editMessageText.mock.calls[0][2];
    expect(responseText.toLowerCase()).not.toContain('tomato');
    expect(responseText.toLowerCase()).not.toContain('помидор');
  });
});
```

### Running Automated Tests

```bash
# All tests
pnpm test

# Unit tests only
pnpm test:unit

# Integration tests (requires test DB)
pnpm test:integration

# With coverage
pnpm test:coverage

# Watch mode
pnpm test:watch
```

### Test Database Setup

```typescript
// tests/setup/test-db.ts
import { Pool } from 'pg';

const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL ||
  'postgresql://postgres:postgres@localhost:5433/symancy_test';

export async function setupTestDatabase() {
  const pool = new Pool({ connectionString: TEST_DATABASE_URL });

  // Run migrations
  await pool.query(fs.readFileSync('migrations/003_backend_tables.sql', 'utf8'));

  // Seed test data
  await pool.query(`
    INSERT INTO profiles (telegram_user_id, name, credits, onboarding_completed)
    VALUES (123456789, 'Test User', 10, true);
  `);

  return pool;
}

export async function cleanupTestDatabase(pool: Pool) {
  await pool.query('DELETE FROM analysis_history');
  await pool.query('DELETE FROM chat_messages');
  await pool.query('DELETE FROM profiles');
  await pool.end();
}
```

### CI Integration

```yaml
# .github/workflows/test.yml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest

    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: symancy_test
        ports:
          - 5433:5432

    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: 'pnpm'

      - run: pnpm install
      - run: pnpm test:unit
      - run: pnpm test:integration
        env:
          TEST_DATABASE_URL: postgresql://postgres:postgres@localhost:5433/symancy_test
```

---

## Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2024-12-26 | Claude | Initial version |
| 1.1 | 2024-12-26 | Claude | Added TC-US1-007 (decorated cup), TC-US1-008 (minimal grounds), automated tests section |
