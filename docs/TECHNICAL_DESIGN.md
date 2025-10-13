# Technical Design Document: Symancy MVP

**Version:** 1.0
**Date:** 2025-10-13
**Status:** Draft for Review
**Authors:** CTO, Tech Lead, Senior Engineers

**Related Documents:**
- Business Requirements: `TZ_EXTENDED_MVP.md`
- Product Requirements: `coffee-reader-dev-spec.md`
- Current Implementation: `coffee-reader-pre-mvp.md`

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [System Architecture](#2-system-architecture)
3. [Database Design](#3-database-design)
4. [API Specification](#4-api-specification)
5. [Integration Patterns](#5-integration-patterns)
6. [Security Implementation](#6-security-implementation)
7. [Deployment Architecture](#7-deployment-architecture)
8. [Monitoring & Observability](#8-monitoring--observability)
9. [Error Handling Strategy](#9-error-handling-strategy)
10. [Data Flow Scenarios](#10-data-flow-scenarios)
11. [Architecture Decision Records](#11-architecture-decision-records)
12. [Load Testing Strategy](#12-load-testing-strategy)
13. [Disaster Recovery Plan](#13-disaster-recovery-plan)
14. [Migration Strategy (Pre-MVP to MVP)](#14-migration-strategy-pre-mvp-to-mvp)

---

## 1. Architecture Overview

### 1.1. Architecture Principles

```
✅ Service-Oriented: Separation of concerns (Bot, API, Workers, Storage)
✅ Event-Driven: Async processing via message queues
✅ Stateless Services: Scale horizontally without coordination
✅ Idempotent Operations: Safe retries for failures
✅ Fail-Fast: Quick validation, graceful degradation
✅ Observable: Logging, metrics, tracing everywhere
```

### 1.2. High-Level Components

```
┌─────────────────────────────────────────────────────────────────┐
│                         TELEGRAM                                 │
│                    (Bot API + Mini App)                          │
└───────────────────┬─────────────────────┬───────────────────────┘
                    │                     │
                    │ webhooks            │ WebApp requests
                    ▼                     ▼
        ┌───────────────────┐  ┌──────────────────────┐
        │   Telegram Bot    │  │   API Gateway        │
        │   Handler         │  │   (REST API)         │
        │   (Node.js)       │  │   (Node.js/Fastify)  │
        └─────────┬─────────┘  └──────────┬───────────┘
                  │                       │
                  │ enqueue               │ direct calls
                  ▼                       ▼
        ┌──────────────────────────────────────────────┐
        │          Message Queue (BullMQ/Redis)        │
        └──────────────────────┬───────────────────────┘
                               │
                               │ workers consume
                               ▼
        ┌────────────────────────────────────────────────┐
        │            Worker Pool (Node.js)               │
        │  - Image Processing Worker                     │
        │  - AI Analysis Worker                          │
        │  - Notification Worker                         │
        │  - Payment Processing Worker                   │
        └────────┬──────────────────┬────────────────────┘
                 │                  │
                 │                  │ store/retrieve
                 ▼                  ▼
    ┌─────────────────────┐  ┌──────────────────────┐
    │   PostgreSQL 15     │  │   Redis Cluster      │
    │   (Supabase)        │  │   (Upstash)          │
    │   - Users           │  │   - Rate Limits      │
    │   - Sessions        │  │   - Cache            │
    │   - Analysis        │  │   - Counters         │
    │   - Subscriptions   │  │   - Queue            │
    │   - Payments        │  │                      │
    └─────────────────────┘  └──────────────────────┘
                 │
                 │ store images
                 ▼
    ┌──────────────────────────────────────┐
    │     Object Storage (S3 compatible)    │
    │     Supabase Storage / Cloudflare R2  │
    └──────────────────────────────────────┘

    External Services:
    ┌────────────────┐  ┌──────────────┐  ┌────────────────┐
    │  OpenRouter    │  │  Tinkoff API │  │  Sentry        │
    │  (AI Models)   │  │  (Payments)  │  │  (Errors)      │
    └────────────────┘  └──────────────┘  └────────────────┘
```

### 1.3. n8n Integration Strategy

**Decision:** n8n used for **workflow orchestration**, NOT as primary backend.

```
┌──────────────────────────────────────────────────────┐
│                      n8n Workflow                     │
│                                                       │
│  ┌────────────────────────────────────────────────┐  │
│  │  Webhook Trigger                               │  │
│  │  (Telegram incoming messages)                  │  │
│  └─────────────────┬──────────────────────────────┘  │
│                    ▼                                  │
│  ┌─────────────────────────────────────────────────┐ │
│  │  Route Message Type                             │ │
│  │  (image vs text)                                │ │
│  └────────┬──────────────────────┬─────────────────┘ │
│           │                      │                    │
│    image  │                      │  text              │
│           ▼                      ▼                    │
│  ┌─────────────────┐   ┌────────────────────┐        │
│  │ Image Processing│   │ Text Processing    │        │
│  │ (call API)      │   │ (call API)         │        │
│  └────────┬────────┘   └───────┬────────────┘        │
│           │                    │                      │
│           └────────┬───────────┘                      │
│                    ▼                                  │
│  ┌──────────────────────────────────────────────────┐ │
│  │  Format Response & Send to Telegram              │ │
│  └──────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────┘
         │
         │ HTTP calls to
         ▼
┌─────────────────────────────────┐
│      Node.js Backend API         │
│  (Business Logic, DB, Queue)     │
└─────────────────────────────────┘
```

**Rationale:**
- n8n provides visual workflow editing for non-developers
- Keeps AI prompts and message formatting configurable
- Backend API handles all business logic, data persistence
- Clear separation: n8n = orchestration, API = logic

---

## 2. System Architecture

### 2.1. C4 Model - Context Diagram

```
                    ┌──────────────┐
                    │              │
                    │  Telegram    │
                    │  Platform    │
                    │              │
                    └───────┬──────┘
                            │
                            │ Bot API / WebApp
                            │
        ┌───────────────────▼──────────────────────┐
        │                                          │
        │         Symancy System              │
        │                                          │
        │  - AI Coffee Cup Reading                 │
        │  - Subscription Management               │
        │  - Payment Processing                    │
        │                                          │
        └───┬──────┬──────┬──────┬──────┬─────────┘
            │      │      │      │      │
            │      │      │      │      │
     ┌──────▼──┐ ┌▼─────┐ ┌▼────┐ ┌▼───┐ ┌▼──────┐
     │OpenRouter│ │Tinkoff│ │Sentry│ │Supabase│ │Posthog│
     │(AI API) │ │(Pay)  │ │(Log) │ │(DB)   │ │(Analytics)│
     └─────────┘ └───────┘ └──────┘ └───────┘ └───────┘

External Systems: [User], [Telegram], [AI Provider], [Payment Gateway],
                  [Monitoring], [Database], [Analytics]
```

### 2.2. C4 Model - Container Diagram

```
┌───────────────────────────────────────────────────────────────────┐
│                         Symancy System                        │
│                                                                    │
│  ┌──────────────────┐        ┌─────────────────────┐             │
│  │  Telegram Bot    │◄──────►│   Mini App (SPA)    │             │
│  │  Handler         │ calls  │   React + TS        │             │
│  │  (Node.js)       │        │   Hosted: Vercel    │             │
│  └────────┬─────────┘        └──────────┬──────────┘             │
│           │                             │                         │
│           │ HTTP                        │ HTTPS                   │
│           │                             │                         │
│  ┌────────▼─────────────────────────────▼──────────────────────┐ │
│  │                  API Gateway (Fastify)                       │ │
│  │                  - REST endpoints                            │ │
│  │                  - Auth middleware                           │ │
│  │                  - Rate limiting                             │ │
│  │                  Hosted: Railway                             │ │
│  └────────┬─────────────────────────────────────────────────────┘ │
│           │                                                        │
│           │ enqueue jobs                                           │
│           ▼                                                        │
│  ┌──────────────────────────────────────────────────────────────┐ │
│  │              Message Queue (BullMQ + Redis)                  │ │
│  └────────┬─────────────────────────────────────────────────────┘ │
│           │                                                        │
│           │ consume                                                │
│           ▼                                                        │
│  ┌──────────────────────────────────────────────────────────────┐ │
│  │                    Worker Services (Node.js)                 │ │
│  │                    - AI Analysis Worker                      │ │
│  │                    - Image Processing Worker                 │ │
│  │                    - Payment Webhook Worker                  │ │
│  │                    - Notification Worker                     │ │
│  │                    Hosted: Railway (auto-scale)              │ │
│  └────────┬───────────────────────┬─────────────────────────────┘ │
│           │                       │                                │
│           ▼                       ▼                                │
│  ┌────────────────┐       ┌──────────────────┐                    │
│  │  PostgreSQL 15 │       │  Redis Cluster   │                    │
│  │  (Supabase)    │       │  (Upstash)       │                    │
│  └────────────────┘       └──────────────────┘                    │
│                                                                    │
└───────────────────────────────────────────────────────────────────┘
```

### 2.3. Component Diagram - Backend API

```
┌───────────────────────────────────────────────────────────────┐
│                      API Gateway (Fastify)                     │
│                                                                │
│  ┌────────────────────────────────────────────────────────┐   │
│  │  HTTP Layer                                            │   │
│  │  - Routes                                              │   │
│  │  - Middleware (auth, rate-limit, cors, validation)    │   │
│  └────────────────┬───────────────────────────────────────┘   │
│                   ▼                                            │
│  ┌────────────────────────────────────────────────────────┐   │
│  │  Controllers                                           │   │
│  │  - UserController                                      │   │
│  │  - AnalysisController                                  │   │
│  │  - SubscriptionController                              │   │
│  │  - PaymentController                                   │   │
│  │  - WebhookController                                   │   │
│  └────────────────┬───────────────────────────────────────┘   │
│                   ▼                                            │
│  ┌────────────────────────────────────────────────────────┐   │
│  │  Services (Business Logic)                             │   │
│  │  - UserService                                         │   │
│  │  - AnalysisService                                     │   │
│  │  - SubscriptionService                                 │   │
│  │  - PaymentService                                      │   │
│  │  - LimitService                                        │   │
│  │  - NotificationService                                 │   │
│  │  - QueueService                                        │   │
│  └────────────────┬───────────────────────────────────────┘   │
│                   ▼                                            │
│  ┌────────────────────────────────────────────────────────┐   │
│  │  Repositories (Data Access)                            │   │
│  │  - UserRepository                                      │   │
│  │  - AnalysisRepository                                  │   │
│  │  - SubscriptionRepository                              │   │
│  │  - PaymentRepository                                   │   │
│  └────────────────┬───────────────────────────────────────┘   │
│                   ▼                                            │
│  ┌────────────────────────────────────────────────────────┐   │
│  │  Infrastructure                                        │   │
│  │  - Database Client (Prisma/Knex)                       │   │
│  │  - Cache Client (ioredis)                              │   │
│  │  - Queue Client (BullMQ)                               │   │
│  │  - Storage Client (S3)                                 │   │
│  │  - External API Clients (OpenRouter, Tinkoff)          │   │
│  └────────────────────────────────────────────────────────┘   │
│                                                                │
└───────────────────────────────────────────────────────────────┘
```

---

## 3. Database Design

### 3.1. Entity Relationship Diagram

```sql
┌────────────────────────────────────────────────────────────────┐
│                         users                                   │
├────────────────────────────────────────────────────────────────┤
│ id                UUID PRIMARY KEY                              │
│ telegram_id       BIGINT UNIQUE NOT NULL                        │
│ username          VARCHAR(255)                                  │
│ first_name        VARCHAR(255)                                  │
│ language_code     VARCHAR(10) DEFAULT 'ru'                      │
│ timezone          VARCHAR(50)                                   │
│ consent_terms     BOOLEAN DEFAULT FALSE                         │
│ consent_privacy   BOOLEAN DEFAULT FALSE                         │
│ consent_date      TIMESTAMPTZ                                   │
│ created_at        TIMESTAMPTZ DEFAULT NOW()                     │
│ updated_at        TIMESTAMPTZ DEFAULT NOW()                     │
└────────────────────────────────────────────────────────────────┘
                           │
                           │ 1:1
                           ▼
┌────────────────────────────────────────────────────────────────┐
│                     subscriptions                               │
├────────────────────────────────────────────────────────────────┤
│ id                UUID PRIMARY KEY                              │
│ user_id           UUID REFERENCES users(id) UNIQUE              │
│ tier              VARCHAR(20) CHECK (tier IN (...))             │
│ status            VARCHAR(20) CHECK (status IN (...))           │
│ trial_used        BOOLEAN DEFAULT FALSE                         │
│ trial_ends_at     TIMESTAMPTZ                                   │
│ current_period_start  TIMESTAMPTZ                               │
│ current_period_end    TIMESTAMPTZ                               │
│ cancel_at_period_end  BOOLEAN DEFAULT FALSE                     │
│ created_at        TIMESTAMPTZ DEFAULT NOW()                     │
│ updated_at        TIMESTAMPTZ DEFAULT NOW()                     │
└────────────────────────────────────────────────────────────────┘
        │
        │ 1:N
        ▼
┌────────────────────────────────────────────────────────────────┐
│                       payments                                  │
├────────────────────────────────────────────────────────────────┤
│ id                UUID PRIMARY KEY                              │
│ subscription_id   UUID REFERENCES subscriptions(id)             │
│ external_id       VARCHAR(255) UNIQUE NOT NULL                  │
│ provider          VARCHAR(50) CHECK (provider IN (...))         │
│ amount            DECIMAL(10,2) NOT NULL                        │
│ currency          VARCHAR(3) DEFAULT 'RUB'                      │
│ status            VARCHAR(20) CHECK (status IN (...))           │
│ metadata          JSONB                                         │
│ error_code        VARCHAR(50)                                   │
│ error_message     TEXT                                          │
│ processed_at      TIMESTAMPTZ                                   │
│ created_at        TIMESTAMPTZ DEFAULT NOW()                     │
└────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────┐
│                    analysis_history                             │
├────────────────────────────────────────────────────────────────┤
│ id                UUID PRIMARY KEY                              │
│ user_id           UUID REFERENCES users(id)                     │
│ message_id        BIGINT                                        │
│ input_type        VARCHAR(20) CHECK (input_type IN (...))      │
│ image_url         TEXT                                          │
│ image_size_bytes  INTEGER                                       │
│ user_text         TEXT                                          │
│ focus_area        VARCHAR(20) CHECK (focus_area IN (...))      │
│ analysis          JSONB NOT NULL                                │
│ model_used        VARCHAR(100)                                  │
│ processing_time_ms INTEGER                                      │
│ tokens_used       INTEGER                                       │
│ user_rating       SMALLINT CHECK (rating BETWEEN 1 AND 5)      │
│ feedback_text     TEXT                                          │
│ created_at        TIMESTAMPTZ DEFAULT NOW()                     │
└────────────────────────────────────────────────────────────────┘
                │
                │ N:1
                ▼
         (users table)

┌────────────────────────────────────────────────────────────────┐
│                      usage_limits                               │
├────────────────────────────────────────────────────────────────┤
│ id                UUID PRIMARY KEY                              │
│ user_id           UUID REFERENCES users(id) UNIQUE              │
│ tier              VARCHAR(20)                                   │
│ daily_analyses_used     INTEGER DEFAULT 0                       │
│ monthly_analyses_used   INTEGER DEFAULT 0                       │
│ daily_limit_reset_at    TIMESTAMPTZ                             │
│ monthly_limit_reset_at  TIMESTAMPTZ                             │
│ updated_at        TIMESTAMPTZ DEFAULT NOW()                     │
└────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────┐
│                    message_context                              │
├────────────────────────────────────────────────────────────────┤
│ id                UUID PRIMARY KEY                              │
│ user_id           UUID REFERENCES users(id)                     │
│ message_id        BIGINT NOT NULL                               │
│ role              VARCHAR(20) CHECK (role IN (...))             │
│ content           TEXT NOT NULL                                 │
│ metadata          JSONB                                         │
│ created_at        TIMESTAMPTZ DEFAULT NOW()                     │
└────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────┐
│                      audit_logs                                 │
├────────────────────────────────────────────────────────────────┤
│ id                UUID PRIMARY KEY                              │
│ user_id           UUID REFERENCES users(id)                     │
│ action            VARCHAR(100) NOT NULL                         │
│ entity_type       VARCHAR(50)                                   │
│ entity_id         UUID                                          │
│ old_value         JSONB                                         │
│ new_value         JSONB                                         │
│ ip_address        INET                                          │
│ user_agent        TEXT                                          │
│ created_at        TIMESTAMPTZ DEFAULT NOW()                     │
└────────────────────────────────────────────────────────────────┘
```

### 3.2. Complete Schema SQL

```sql
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgvector"; -- for future RAG

-- ENUMS
CREATE TYPE subscription_tier AS ENUM ('FREE', 'TRIAL', 'BASIC', 'ADVANCED', 'PREMIUM');
CREATE TYPE subscription_status AS ENUM ('active', 'canceled', 'past_due', 'expired');
CREATE TYPE payment_provider AS ENUM ('telegram_stars', 'sbp_tinkoff', 'cloudpayments');
CREATE TYPE payment_status AS ENUM ('pending', 'succeeded', 'failed', 'refunded', 'canceled');
CREATE TYPE input_type AS ENUM ('image', 'text');
CREATE TYPE focus_area AS ENUM ('wellbeing', 'career', 'relationships', 'general');
CREATE TYPE message_role AS ENUM ('user', 'assistant', 'system');

-- USERS TABLE
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    telegram_id BIGINT UNIQUE NOT NULL,
    username VARCHAR(255),
    first_name VARCHAR(255),
    last_name VARCHAR(255),
    language_code VARCHAR(10) DEFAULT 'ru',
    timezone VARCHAR(50) DEFAULT 'Europe/Moscow',
    consent_terms BOOLEAN DEFAULT FALSE,
    consent_privacy BOOLEAN DEFAULT FALSE,
    consent_date TIMESTAMPTZ,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_users_telegram_id ON users(telegram_id);
CREATE INDEX idx_users_created_at ON users(created_at DESC);

-- SUBSCRIPTIONS TABLE
CREATE TABLE subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE UNIQUE,
    tier subscription_tier NOT NULL DEFAULT 'FREE',
    status subscription_status NOT NULL DEFAULT 'active',
    trial_used BOOLEAN DEFAULT FALSE,
    trial_ends_at TIMESTAMPTZ,
    current_period_start TIMESTAMPTZ,
    current_period_end TIMESTAMPTZ,
    cancel_at_period_end BOOLEAN DEFAULT FALSE,
    canceled_at TIMESTAMPTZ,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX idx_subscriptions_status ON subscriptions(status);
CREATE INDEX idx_subscriptions_tier ON subscriptions(tier);

-- PAYMENTS TABLE
CREATE TABLE payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    subscription_id UUID REFERENCES subscriptions(id) ON DELETE SET NULL,
    external_id VARCHAR(255) UNIQUE NOT NULL,
    provider payment_provider NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'RUB',
    status payment_status NOT NULL DEFAULT 'pending',
    metadata JSONB DEFAULT '{}',
    error_code VARCHAR(50),
    error_message TEXT,
    processed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_payments_subscription_id ON payments(subscription_id);
CREATE INDEX idx_payments_external_id ON payments(external_id);
CREATE INDEX idx_payments_status ON payments(status);
CREATE INDEX idx_payments_created_at ON payments(created_at DESC);

-- ANALYSIS HISTORY TABLE
CREATE TABLE analysis_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    message_id BIGINT,
    input_type input_type NOT NULL,
    image_url TEXT,
    image_size_bytes INTEGER,
    user_text TEXT,
    focus_area focus_area DEFAULT 'general',
    analysis JSONB NOT NULL,
    model_used VARCHAR(100),
    processing_time_ms INTEGER,
    tokens_used INTEGER,
    cost_usd DECIMAL(10,6),
    user_rating SMALLINT CHECK (user_rating BETWEEN 1 AND 5),
    feedback_text TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_analysis_user_id ON analysis_history(user_id);
CREATE INDEX idx_analysis_created_at ON analysis_history(created_at DESC);
CREATE INDEX idx_analysis_user_created ON analysis_history(user_id, created_at DESC);
CREATE INDEX idx_analysis_focus_area ON analysis_history(focus_area);
CREATE INDEX idx_analysis_rating ON analysis_history(user_rating) WHERE user_rating IS NOT NULL;

-- USAGE LIMITS TABLE
CREATE TABLE usage_limits (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE UNIQUE,
    tier subscription_tier NOT NULL,
    daily_analyses_used INTEGER DEFAULT 0,
    monthly_analyses_used INTEGER DEFAULT 0,
    daily_limit_reset_at TIMESTAMPTZ NOT NULL,
    monthly_limit_reset_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_usage_limits_user_id ON usage_limits(user_id);

-- MESSAGE CONTEXT TABLE (for AI conversation history)
CREATE TABLE message_context (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    message_id BIGINT NOT NULL,
    role message_role NOT NULL,
    content TEXT NOT NULL,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_message_context_user_id ON message_context(user_id);
CREATE INDEX idx_message_context_user_created ON message_context(user_id, created_at DESC);

-- AUDIT LOGS TABLE
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50),
    entity_id UUID,
    old_value JSONB,
    new_value JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at DESC);

-- TRIGGERS for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_subscriptions_updated_at BEFORE UPDATE ON subscriptions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_payments_updated_at BEFORE UPDATE ON payments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_usage_limits_updated_at BEFORE UPDATE ON usage_limits
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ROW LEVEL SECURITY (RLS) for Supabase
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE analysis_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_context ENABLE ROW LEVEL SECURITY;

-- RLS Policies (users can only see their own data)
CREATE POLICY "Users can view own profile" ON users
    FOR SELECT USING (auth.uid() = id::TEXT);

CREATE POLICY "Users can view own analysis" ON analysis_history
    FOR SELECT USING (auth.uid() = user_id::TEXT);

CREATE POLICY "Users can view own subscription" ON subscriptions
    FOR SELECT USING (auth.uid() = user_id::TEXT);

-- Service role bypasses RLS for backend operations
```

### 3.3. Data Retention & Cleanup

```sql
-- Scheduled job to clean old data (run daily via cron or pg_cron)

-- Delete old message context (keep only last 20 messages per user)
WITH ranked_messages AS (
    SELECT id,
           ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY created_at DESC) as rn
    FROM message_context
)
DELETE FROM message_context
WHERE id IN (
    SELECT id FROM ranked_messages WHERE rn > 20
);

-- Delete old audit logs (keep 90 days)
DELETE FROM audit_logs WHERE created_at < NOW() - INTERVAL '90 days';

-- Archive old analysis (move to cold storage after 12 months)
-- Implementation depends on archival strategy
```

---

## 4. API Specification

### 4.1. OpenAPI 3.0 Schema

```yaml
openapi: 3.0.3
info:
  title: Symancy API
  version: 1.0.0
  description: AI-powered coffee cup reading platform API
  contact:
    email: api@coffeereader.com

servers:
  - url: https://api.coffeereader.com/v1
    description: Production
  - url: https://staging-api.coffeereader.com/v1
    description: Staging

security:
  - TelegramAuth: []

paths:
  # USER ENDPOINTS
  /users/me:
    get:
      summary: Get current user profile
      tags: [Users]
      responses:
        '200':
          description: User profile
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/User'

    patch:
      summary: Update user profile
      tags: [Users]
      requestBody:
        content:
          application/json:
            schema:
              type: object
              properties:
                first_name:
                  type: string
                  maxLength: 255
                language_code:
                  type: string
                  enum: [ru, en, zh]
                timezone:
                  type: string
      responses:
        '200':
          description: Updated user
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/User'

  # ANALYSIS ENDPOINTS
  /analyses:
    post:
      summary: Create new coffee reading analysis
      tags: [Analysis]
      requestBody:
        content:
          multipart/form-data:
            schema:
              type: object
              properties:
                image:
                  type: string
                  format: binary
                  description: Image file (JPEG/PNG, max 15MB)
                text:
                  type: string
                  description: Alternative text input
                focus_area:
                  type: string
                  enum: [wellbeing, career, relationships, general]
                  default: general
              oneOf:
                - required: [image]
                - required: [text]
      responses:
        '202':
          description: Analysis accepted for processing
          content:
            application/json:
              schema:
                type: object
                properties:
                  id:
                    type: string
                    format: uuid
                  status:
                    type: string
                    enum: [pending, processing]
                  estimated_time_seconds:
                    type: integer
                    example: 30
        '400':
          $ref: '#/components/responses/BadRequest'
        '402':
          $ref: '#/components/responses/LimitExceeded'
        '429':
          $ref: '#/components/responses/RateLimited'

    get:
      summary: Get analysis history
      tags: [Analysis]
      parameters:
        - name: limit
          in: query
          schema:
            type: integer
            minimum: 1
            maximum: 100
            default: 20
        - name: offset
          in: query
          schema:
            type: integer
            minimum: 0
            default: 0
        - name: focus_area
          in: query
          schema:
            type: string
            enum: [wellbeing, career, relationships, general]
      responses:
        '200':
          description: List of analyses
          content:
            application/json:
              schema:
                type: object
                properties:
                  data:
                    type: array
                    items:
                      $ref: '#/components/schemas/Analysis'
                  pagination:
                    $ref: '#/components/schemas/Pagination'

  /analyses/{id}:
    get:
      summary: Get specific analysis
      tags: [Analysis]
      parameters:
        - name: id
          in: path
          required: true
          schema:
            type: string
            format: uuid
      responses:
        '200':
          description: Analysis details
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Analysis'
        '404':
          $ref: '#/components/responses/NotFound'

  /analyses/{id}/feedback:
    post:
      summary: Submit feedback for analysis
      tags: [Analysis]
      parameters:
        - name: id
          in: path
          required: true
          schema:
            type: string
            format: uuid
      requestBody:
        content:
          application/json:
            schema:
              type: object
              properties:
                rating:
                  type: integer
                  minimum: 1
                  maximum: 5
                feedback_text:
                  type: string
                  maxLength: 1000
              required: [rating]
      responses:
        '200':
          description: Feedback recorded

  # SUBSCRIPTION ENDPOINTS
  /subscriptions/me:
    get:
      summary: Get current subscription
      tags: [Subscriptions]
      responses:
        '200':
          description: Subscription details
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Subscription'

  /subscriptions/purchase:
    post:
      summary: Purchase or upgrade subscription
      tags: [Subscriptions]
      requestBody:
        content:
          application/json:
            schema:
              type: object
              properties:
                tier:
                  type: string
                  enum: [BASIC, ADVANCED, PREMIUM]
                provider:
                  type: string
                  enum: [telegram_stars, sbp_tinkoff, cloudpayments]
                return_url:
                  type: string
                  format: uri
              required: [tier, provider]
      responses:
        '200':
          description: Payment initiated
          content:
            application/json:
              schema:
                type: object
                properties:
                  payment_url:
                    type: string
                    format: uri
                  payment_id:
                    type: string
                    format: uuid

  /subscriptions/cancel:
    post:
      summary: Cancel subscription (at period end)
      tags: [Subscriptions]
      responses:
        '200':
          description: Subscription will cancel at period end
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Subscription'

  # PAYMENT WEBHOOKS
  /webhooks/payments/telegram:
    post:
      summary: Telegram Stars payment webhook
      tags: [Webhooks]
      security: []
      requestBody:
        content:
          application/json:
            schema:
              type: object
      responses:
        '200':
          description: Webhook processed

  /webhooks/payments/tinkoff:
    post:
      summary: Tinkoff payment webhook
      tags: [Webhooks]
      security: []
      requestBody:
        content:
          application/json:
            schema:
              type: object
      responses:
        '200':
          description: Webhook processed

  # LIMITS
  /limits/me:
    get:
      summary: Get current usage limits
      tags: [Limits]
      responses:
        '200':
          description: Usage limits
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/UsageLimits'

components:
  securitySchemes:
    TelegramAuth:
      type: apiKey
      in: header
      name: X-Telegram-Init-Data
      description: Telegram WebApp initData for authentication

  schemas:
    User:
      type: object
      properties:
        id:
          type: string
          format: uuid
        telegram_id:
          type: integer
          format: int64
        username:
          type: string
        first_name:
          type: string
        language_code:
          type: string
        timezone:
          type: string
        created_at:
          type: string
          format: date-time

    Subscription:
      type: object
      properties:
        id:
          type: string
          format: uuid
        tier:
          type: string
          enum: [FREE, TRIAL, BASIC, ADVANCED, PREMIUM]
        status:
          type: string
          enum: [active, canceled, past_due, expired]
        trial_used:
          type: boolean
        current_period_end:
          type: string
          format: date-time
        cancel_at_period_end:
          type: boolean

    Analysis:
      type: object
      properties:
        id:
          type: string
          format: uuid
        user_id:
          type: string
          format: uuid
        input_type:
          type: string
          enum: [image, text]
        focus_area:
          type: string
          enum: [wellbeing, career, relationships, general]
        analysis:
          type: object
          properties:
            intro:
              type: string
              description: Main insight (markdown)
            sections:
              type: array
              items:
                type: object
                properties:
                  title:
                    type: string
                  content:
                    type: string
        model_used:
          type: string
        processing_time_ms:
          type: integer
        user_rating:
          type: integer
          nullable: true
        created_at:
          type: string
          format: date-time

    UsageLimits:
      type: object
      properties:
        tier:
          type: string
          enum: [FREE, TRIAL, BASIC, ADVANCED, PREMIUM]
        daily_analyses_used:
          type: integer
        daily_analyses_limit:
          type: integer
        monthly_analyses_used:
          type: integer
        monthly_analyses_limit:
          type: integer
        daily_reset_at:
          type: string
          format: date-time
        monthly_reset_at:
          type: string
          format: date-time

    Pagination:
      type: object
      properties:
        total:
          type: integer
        limit:
          type: integer
        offset:
          type: integer
        has_more:
          type: boolean

    Error:
      type: object
      properties:
        code:
          type: string
          example: E001
        message:
          type: string
        details:
          type: object

  responses:
    BadRequest:
      description: Invalid request
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/Error'
          example:
            code: E001
            message: Invalid image format

    NotFound:
      description: Resource not found
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/Error'
          example:
            code: E404
            message: Analysis not found

    LimitExceeded:
      description: Usage limit exceeded
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/Error'
          example:
            code: E002
            message: Daily limit exceeded. Upgrade to continue.
            details:
              daily_limit: 3
              used: 3
              reset_at: "2025-10-14T00:00:00Z"

    RateLimited:
      description: Too many requests
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/Error'
          example:
            code: E429
            message: Rate limit exceeded
            details:
              retry_after_seconds: 60
```

### 4.2. Authentication Flow

```typescript
// Telegram WebApp authentication validation
// Based on: https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app

import crypto from 'crypto';

interface TelegramInitData {
  auth_date: number;
  hash: string;
  user: {
    id: number;
    first_name: string;
    username?: string;
    language_code?: string;
  };
}

export function validateTelegramWebAppData(
  initData: string,
  botToken: string
): TelegramInitData {
  const urlParams = new URLSearchParams(initData);
  const hash = urlParams.get('hash');

  if (!hash) {
    throw new Error('Missing hash parameter');
  }

  urlParams.delete('hash');

  // Sort parameters alphabetically
  const dataCheckString = Array.from(urlParams.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');

  // Create secret key: HMAC_SHA256(bot_token, "WebAppData")
  const secretKey = crypto
    .createHmac('sha256', 'WebAppData')
    .update(botToken)
    .digest();

  // Calculate hash
  const calculatedHash = crypto
    .createHmac('sha256', secretKey)
    .update(dataCheckString)
    .digest('hex');

  if (calculatedHash !== hash) {
    throw new Error('Invalid hash');
  }

  // Check auth_date is recent (within 1 hour)
  const authDate = parseInt(urlParams.get('auth_date') || '0');
  const currentTime = Math.floor(Date.now() / 1000);

  if (currentTime - authDate > 3600) {
    throw new Error('Authentication data is too old');
  }

  return {
    auth_date: authDate,
    hash,
    user: JSON.parse(urlParams.get('user') || '{}'),
  };
}

// Middleware for Fastify
export async function authenticateUser(request, reply) {
  const initData = request.headers['x-telegram-init-data'];

  if (!initData) {
    return reply.code(401).send({ error: 'Unauthorized' });
  }

  try {
    const validatedData = validateTelegramWebAppData(
      initData,
      process.env.TELEGRAM_BOT_TOKEN!
    );

    // Attach user to request
    request.user = validatedData.user;
  } catch (error) {
    return reply.code(401).send({ error: 'Invalid authentication' });
  }
}
```

---

## 5. Integration Patterns

### 5.1. Telegram Bot → Backend Flow

```typescript
// Sequence diagram in code form

/**
 * FLOW: User sends image to Telegram Bot
 *
 * 1. Telegram → Webhook → n8n
 * 2. n8n → POST /api/v1/analyses (image + metadata)
 * 3. API → Validate user & limits
 * 4. API → Upload image to S3
 * 5. API → Enqueue job to BullMQ
 * 6. API → Return 202 Accepted
 * 7. n8n → Send "Analysis started" message
 * 8. Worker → Process job (AI analysis)
 * 9. Worker → Save result to DB
 * 10. Worker → Enqueue notification job
 * 11. Notification Worker → Call n8n webhook with result
 * 12. n8n → Format & send final message to user
 */

// Step 2: n8n calls API
const createAnalysis = async (imageBuffer: Buffer, telegramData: any) => {
  const formData = new FormData();
  formData.append('image', imageBuffer, 'coffee_cup.jpg');
  formData.append('telegram_user_id', telegramData.from.id);
  formData.append('message_id', telegramData.message_id);
  formData.append('focus_area', 'general');

  const response = await fetch('https://api.coffeereader.com/v1/analyses', {
    method: 'POST',
    headers: {
      'X-API-Key': process.env.N8N_API_KEY,
    },
    body: formData,
  });

  return response.json(); // { id, status, estimated_time_seconds }
};

// Step 3-6: API handler
export async function handleAnalysisCreate(request, reply) {
  const { image, telegram_user_id, message_id, focus_area } = request.body;

  // 1. Get or create user
  const user = await userService.findOrCreateByTelegramId(telegram_user_id);

  // 2. Check limits
  const canAnalyze = await limitService.checkAndIncrementLimit(user.id);
  if (!canAnalyze) {
    return reply.code(402).send({
      code: 'E002',
      message: 'Daily limit exceeded',
    });
  }

  // 3. Validate image
  if (image.size > 15 * 1024 * 1024) {
    return reply.code(400).send({
      code: 'E001',
      message: 'Image too large (max 15MB)',
    });
  }

  // 4. Upload to S3
  const imageUrl = await storageService.uploadImage(image, user.id);

  // 5. Create analysis record
  const analysis = await analysisRepository.create({
    user_id: user.id,
    message_id,
    input_type: 'image',
    image_url: imageUrl,
    focus_area,
    analysis: {}, // Will be filled by worker
  });

  // 6. Enqueue job
  await queueService.addAnalysisJob({
    analysis_id: analysis.id,
    user_id: user.id,
    image_url: imageUrl,
    focus_area,
  });

  // 7. Return immediately
  return reply.code(202).send({
    id: analysis.id,
    status: 'pending',
    estimated_time_seconds: 30,
  });
}

// Step 8-9: Worker processes job
export async function processAnalysisJob(job: Job) {
  const { analysis_id, user_id, image_url, focus_area } = job.data;

  const startTime = Date.now();

  try {
    // 1. Get user context (last 3 analyses)
    const context = await analysisRepository.getRecentAnalyses(user_id, 3);

    // 2. Call AI API
    const aiResult = await aiService.analyzeImage({
      image_url,
      focus_area,
      context,
    });

    // 3. Save result
    await analysisRepository.update(analysis_id, {
      analysis: aiResult,
      model_used: aiResult.model,
      processing_time_ms: Date.now() - startTime,
      tokens_used: aiResult.tokens,
    });

    // 4. Enqueue notification
    await queueService.addNotificationJob({
      type: 'analysis_complete',
      analysis_id,
      user_id,
    });

  } catch (error) {
    // Handle error, retry logic
    await analysisRepository.update(analysis_id, {
      analysis: { error: error.message },
    });

    // Notify about failure
    await queueService.addNotificationJob({
      type: 'analysis_failed',
      analysis_id,
      user_id,
      error: error.message,
    });

    throw error; // BullMQ will retry
  }
}

// Step 11: Notification worker calls n8n
export async function processNotificationJob(job: Job) {
  const { type, analysis_id, user_id } = job.data;

  if (type === 'analysis_complete') {
    const analysis = await analysisRepository.findById(analysis_id);
    const user = await userRepository.findById(user_id);

    // Call n8n webhook to send result to Telegram
    await fetch(process.env.N8N_WEBHOOK_RESULT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        telegram_id: user.telegram_id,
        message_id: analysis.message_id,
        analysis: analysis.analysis,
      }),
    });
  }
}
```

### 5.2. Payment Webhook Flow

```typescript
/**
 * FLOW: Payment webhook processing
 *
 * 1. Payment provider → Webhook endpoint
 * 2. Validate signature
 * 3. Check idempotency (already processed?)
 * 4. Update payment status
 * 5. Update subscription status
 * 6. Notify user
 */

export async function handleTinkoffWebhook(request, reply) {
  const payload = request.body;

  // 1. Verify signature
  const isValid = verifyTinkoffSignature(
    payload,
    process.env.TINKOFF_SECRET_KEY!
  );

  if (!isValid) {
    return reply.code(400).send({ error: 'Invalid signature' });
  }

  // 2. Idempotency check
  const existingPayment = await paymentRepository.findByExternalId(
    payload.PaymentId
  );

  if (existingPayment && existingPayment.status !== 'pending') {
    // Already processed
    return reply.code(200).send({ success: true });
  }

  // 3. Process in transaction
  await db.transaction(async (trx) => {
    // Update payment
    await paymentRepository.update(
      existingPayment.id,
      {
        status: mapTinkoffStatus(payload.Status),
        processed_at: new Date(),
        metadata: payload,
      },
      trx
    );

    // If payment succeeded, activate subscription
    if (payload.Status === 'CONFIRMED') {
      const subscription = await subscriptionRepository.findById(
        existingPayment.subscription_id,
        trx
      );

      await subscriptionRepository.update(
        subscription.id,
        {
          status: 'active',
          current_period_start: new Date(),
          current_period_end: addMonths(new Date(), 1),
        },
        trx
      );

      // Enqueue notification
      await queueService.addNotificationJob({
        type: 'payment_success',
        user_id: subscription.user_id,
        tier: subscription.tier,
      });
    }
  });

  return reply.code(200).send({ success: true });
}

function verifyTinkoffSignature(payload: any, secret: string): boolean {
  const { Token, ...dataToSign } = payload;

  // Sort keys alphabetically
  const sortedKeys = Object.keys(dataToSign).sort();
  const dataString = sortedKeys
    .map((key) => dataToSign[key])
    .join('');

  const stringToHash = secret + dataString + secret;
  const calculatedToken = crypto
    .createHash('sha256')
    .update(stringToHash)
    .digest('hex');

  return calculatedToken === Token;
}
```

### 5.3. Rate Limiting Implementation

```typescript
import { RateLimiterRedis } from 'rate-limiter-flexible';
import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL);

// Per-IP rate limiter
const rateLimiterPerIP = new RateLimiterRedis({
  storeClient: redis,
  keyPrefix: 'rl:ip',
  points: 100, // Number of requests
  duration: 60, // Per 60 seconds
  blockDuration: 60, // Block for 60 seconds if exceeded
});

// Per-user rate limiter (authenticated requests)
const rateLimiterPerUser = new RateLimiterRedis({
  storeClient: redis,
  keyPrefix: 'rl:user',
  points: 30, // More generous for authenticated users
  duration: 60,
  blockDuration: 300, // Block for 5 minutes
});

export async function rateLimitMiddleware(request, reply) {
  const key = request.user?.id || request.ip;
  const limiter = request.user ? rateLimiterPerUser : rateLimiterPerIP;

  try {
    const rateLimitRes = await limiter.consume(key);

    // Add headers
    reply.header('X-RateLimit-Limit', limiter.points);
    reply.header('X-RateLimit-Remaining', rateLimitRes.remainingPoints);
    reply.header('X-RateLimit-Reset', new Date(Date.now() + rateLimitRes.msBeforeNext).toISOString());

  } catch (rateLimitRes) {
    // Rate limit exceeded
    reply.header('Retry-After', Math.ceil(rateLimitRes.msBeforeNext / 1000));
    return reply.code(429).send({
      code: 'E429',
      message: 'Too many requests',
      details: {
        retry_after_seconds: Math.ceil(rateLimitRes.msBeforeNext / 1000),
      },
    });
  }
}
```

---

## 6. Security Implementation

### 6.1. Security Checklist

```typescript
// security-config.ts

export const securityConfig = {
  // 1. TLS Configuration
  tls: {
    minVersion: 'TLSv1.3',
    ciphers: [
      'TLS_AES_128_GCM_SHA256',
      'TLS_AES_256_GCM_SHA384',
      'TLS_CHACHA20_POLY1305_SHA256',
    ].join(':'),
  },

  // 2. CORS Configuration
  cors: {
    origin: [
      'https://coffeereader.com',
      'https://*.coffeereader.com',
      'https://t.me',
    ],
    credentials: true,
    maxAge: 86400,
  },

  // 3. CSP Headers
  csp: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", 'https://telegram.org'],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'https://*.supabase.co'],
      connectSrc: ["'self'", 'https://api.coffeereader.com'],
      frameSrc: ['https://t.me'],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: [],
    },
  },

  // 4. Security Headers
  headers: {
    'Strict-Transport-Security': 'max-age=63072000; includeSubDomains; preload',
    'X-Frame-Options': 'DENY',
    'X-Content-Type-Options': 'nosniff',
    'X-XSS-Protection': '1; mode=block',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'geolocation=(), microphone=(), camera=()',
  },

  // 5. SQL Injection Protection
  database: {
    // Use parameterized queries ALWAYS
    useParameterizedQueries: true,
    // Validate all inputs
    validateInputs: true,
  },

  // 6. Secrets Management
  secrets: {
    // Use environment variables
    source: 'env',
    // Rotate keys every 90 days
    rotationPeriod: 90,
  },
};

// Apply security middleware
export function applySecurityMiddleware(app: FastifyInstance) {
  // Helmet for security headers
  app.register(helmet, {
    contentSecurityPolicy: securityConfig.csp,
    hsts: {
      maxAge: 63072000,
      includeSubDomains: true,
      preload: true,
    },
  });

  // CORS
  app.register(cors, securityConfig.cors);

  // Rate limiting
  app.register(rateLimitMiddleware);

  // Request validation
  app.addHook('preValidation', validateRequestSchema);

  // Audit logging
  app.addHook('onResponse', logAuditTrail);
}
```

### 6.2. GDPR Compliance Implementation

```typescript
// gdpr-service.ts

export class GDPRService {
  /**
   * Export all user data (GDPR Article 20 - Right to data portability)
   */
  async exportUserData(userId: string): Promise<UserDataExport> {
    const [user, subscription, analyses, payments] = await Promise.all([
      userRepository.findById(userId),
      subscriptionRepository.findByUserId(userId),
      analysisRepository.findAllByUserId(userId),
      paymentRepository.findAllByUserId(userId),
    ]);

    return {
      personal_data: {
        id: user.id,
        telegram_id: user.telegram_id,
        username: user.username,
        first_name: user.first_name,
        language_code: user.language_code,
        created_at: user.created_at,
      },
      subscription_data: subscription,
      analysis_history: analyses.map((a) => ({
        id: a.id,
        created_at: a.created_at,
        focus_area: a.focus_area,
        analysis: a.analysis,
        // Exclude internal metadata
      })),
      payment_history: payments.map((p) => ({
        id: p.id,
        amount: p.amount,
        currency: p.currency,
        status: p.status,
        created_at: p.created_at,
      })),
      exported_at: new Date().toISOString(),
    };
  }

  /**
   * Delete all user data (GDPR Article 17 - Right to erasure)
   */
  async deleteUserData(userId: string): Promise<void> {
    await db.transaction(async (trx) => {
      // 1. Anonymize audit logs (keep for legal)
      await auditLogRepository.anonymizeForUser(userId, trx);

      // 2. Delete images from S3
      const analyses = await analysisRepository.findAllByUserId(userId, trx);
      for (const analysis of analyses) {
        if (analysis.image_url) {
          await storageService.deleteImage(analysis.image_url);
        }
      }

      // 3. Delete all user data (cascade deletes subscriptions, analyses, etc.)
      await userRepository.delete(userId, trx);

      // 4. Remove from cache
      await redis.del(`user:${userId}`);

      // 5. Log deletion
      await auditLogRepository.create(
        {
          action: 'user_data_deleted',
          entity_type: 'user',
          entity_id: userId,
          metadata: { reason: 'GDPR_right_to_erasure' },
        },
        trx
      );
    });
  }

  /**
   * Get consent status
   */
  async getConsentStatus(userId: string): Promise<ConsentStatus> {
    const user = await userRepository.findById(userId);

    return {
      terms_of_use: {
        accepted: user.consent_terms,
        accepted_at: user.consent_date,
      },
      privacy_policy: {
        accepted: user.consent_privacy,
        accepted_at: user.consent_date,
      },
    };
  }

  /**
   * Update consent
   */
  async updateConsent(userId: string, consents: ConsentUpdate): Promise<void> {
    await userRepository.update(userId, {
      consent_terms: consents.terms_of_use,
      consent_privacy: consents.privacy_policy,
      consent_date: new Date(),
    });
  }
}

// API Endpoints for GDPR
export async function handleDataExportRequest(request, reply) {
  const userId = request.user.id;

  // Enqueue job (this can take time)
  await queueService.addDataExportJob({ user_id: userId });

  return reply.code(202).send({
    message: 'Data export request accepted. You will receive a download link via email.',
  });
}

export async function handleDataDeletionRequest(request, reply) {
  const userId = request.user.id;

  // Verify user wants to delete (require password/confirmation)
  const { confirmation_code } = request.body;

  if (confirmation_code !== 'DELETE_MY_DATA') {
    return reply.code(400).send({
      error: 'Invalid confirmation code',
    });
  }

  // Enqueue deletion job
  await queueService.addDataDeletionJob({ user_id: userId });

  return reply.code(202).send({
    message: 'Data deletion request accepted. Your data will be permanently deleted within 72 hours.',
  });
}
```

---

## 7. Deployment Architecture

### 7.1. Infrastructure Diagram

```
┌──────────────────────────────────────────────────────────────┐
│                         CLOUDFLARE                            │
│                      (CDN + DDoS Protection)                  │
└────────────────────────┬─────────────────────────────────────┘
                         │
                         │ HTTPS
                         ▼
┌──────────────────────────────────────────────────────────────┐
│                    VERCEL (Frontend)                          │
│                 - Mini App (React SPA)                        │
│                 - Static Assets                               │
│                 - Edge Functions (optional)                   │
└──────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│                    RAILWAY (Backend)                          │
│                                                               │
│  ┌──────────────────┐  ┌──────────────────┐                  │
│  │  API Service     │  │  Worker Service  │                  │
│  │  (2 instances)   │  │  (3 instances)   │                  │
│  │  - Fastify       │  │  - BullMQ        │                  │
│  │  - Auto-scale    │  │  - Auto-scale    │                  │
│  └──────────────────┘  └──────────────────┘                  │
│                                                               │
│  ┌──────────────────┐                                        │
│  │  n8n Service     │                                        │
│  │  (1 instance)    │                                        │
│  │  - Workflows     │                                        │
│  └──────────────────┘                                        │
└──────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│                  SUPABASE (Database)                          │
│  - PostgreSQL 15                                             │
│  - Row Level Security (RLS)                                  │
│  - Realtime (optional for future)                            │
│  - Storage (images)                                          │
└──────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│                  UPSTASH (Redis)                              │
│  - Rate limiting                                             │
│  - Caching                                                   │
│  - Queue (BullMQ)                                            │
│  - Session storage                                           │
└──────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│               MONITORING & LOGGING                            │
│                                                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │   Sentry     │  │  Posthog     │  │ Uptime Robot │       │
│  │  (Errors)    │  │ (Analytics)  │  │ (Uptime)     │       │
│  └──────────────┘  └──────────────┘  └──────────────┘       │
└──────────────────────────────────────────────────────────────┘
```

### 7.2. Docker Compose (Development)

```yaml
# docker-compose.yml

version: '3.8'

services:
  # PostgreSQL Database
  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: coffeereader
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./scripts/init-db.sql:/docker-entrypoint-initdb.d/init.sql
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 10s
      timeout: 5s
      retries: 5

  # Redis
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    command: redis-server --appendonly yes
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

  # API Service
  api:
    build:
      context: ./services/api
      dockerfile: Dockerfile
    ports:
      - "3000:3000"
    environment:
      NODE_ENV: development
      DATABASE_URL: postgresql://postgres:postgres@postgres:5432/coffeereader
      REDIS_URL: redis://redis:6379
      TELEGRAM_BOT_TOKEN: ${TELEGRAM_BOT_TOKEN}
      OPENROUTER_API_KEY: ${OPENROUTER_API_KEY}
      TINKOFF_TERMINAL_KEY: ${TINKOFF_TERMINAL_KEY}
      TINKOFF_SECRET_KEY: ${TINKOFF_SECRET_KEY}
      SUPABASE_URL: ${SUPABASE_URL}
      SUPABASE_SERVICE_KEY: ${SUPABASE_SERVICE_KEY}
      SENTRY_DSN: ${SENTRY_DSN}
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    volumes:
      - ./services/api:/app
      - /app/node_modules
    command: npm run dev

  # Worker Service
  worker:
    build:
      context: ./services/worker
      dockerfile: Dockerfile
    environment:
      NODE_ENV: development
      DATABASE_URL: postgresql://postgres:postgres@postgres:5432/coffeereader
      REDIS_URL: redis://redis:6379
      OPENROUTER_API_KEY: ${OPENROUTER_API_KEY}
      SUPABASE_URL: ${SUPABASE_URL}
      SUPABASE_SERVICE_KEY: ${SUPABASE_SERVICE_KEY}
      N8N_WEBHOOK_URL: ${N8N_WEBHOOK_URL}
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    volumes:
      - ./services/worker:/app
      - /app/node_modules
    command: npm run dev
    deploy:
      replicas: 2

  # n8n Workflow Automation
  n8n:
    image: n8nio/n8n:latest
    ports:
      - "5678:5678"
    environment:
      N8N_BASIC_AUTH_ACTIVE: "true"
      N8N_BASIC_AUTH_USER: admin
      N8N_BASIC_AUTH_PASSWORD: ${N8N_PASSWORD}
      N8N_HOST: localhost
      N8N_PORT: 5678
      N8N_PROTOCOL: http
      WEBHOOK_URL: http://n8n:5678/
      GENERIC_TIMEZONE: Europe/Moscow
      DB_TYPE: postgresdb
      DB_POSTGRESDB_HOST: postgres
      DB_POSTGRESDB_PORT: 5432
      DB_POSTGRESDB_DATABASE: n8n
      DB_POSTGRESDB_USER: postgres
      DB_POSTGRESDB_PASSWORD: postgres
    volumes:
      - n8n_data:/home/node/.n8n
      - ./n8n/workflows:/home/node/.n8n/workflows
    depends_on:
      postgres:
        condition: service_healthy

  # Mini App (Frontend)
  mini-app:
    build:
      context: ./services/mini-app
      dockerfile: Dockerfile
    ports:
      - "3001:3000"
    environment:
      VITE_API_URL: http://localhost:3000/v1
      VITE_TELEGRAM_BOT_USERNAME: ${TELEGRAM_BOT_USERNAME}
    volumes:
      - ./services/mini-app:/app
      - /app/node_modules
    command: npm run dev

volumes:
  postgres_data:
  redis_data:
  n8n_data:
```

### 7.3. GitHub Actions CI/CD

```yaml
# .github/workflows/deploy.yml

name: Deploy to Production

on:
  push:
    branches:
      - main
  pull_request:
    branches:
      - main

env:
  REGISTRY: ghcr.io
  IMAGE_NAME: coffeereader

jobs:
  test:
    runs-on: ubuntu-latest

    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_DB: test
          POSTGRES_USER: postgres
          POSTGRES_PASSWORD: postgres
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

      redis:
        image: redis:7
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run linter
        run: npm run lint

      - name: Run type check
        run: npm run type-check

      - name: Run unit tests
        run: npm run test:unit
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/test
          REDIS_URL: redis://localhost:6379

      - name: Run integration tests
        run: npm run test:integration
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/test
          REDIS_URL: redis://localhost:6379

  build:
    needs: test
    runs-on: ubuntu-latest
    if: github.event_name == 'push' && github.ref == 'refs/heads/main'

    permissions:
      contents: read
      packages: write

    strategy:
      matrix:
        service: [api, worker]

    steps:
      - uses: actions/checkout@v4

      - name: Log in to Container Registry
        uses: docker/login-action@v3
        with:
          registry: ${{ env.REGISTRY }}
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Extract metadata
        id: meta
        uses: docker/metadata-action@v5
        with:
          images: ${{ env.REGISTRY }}/${{ github.repository }}/${{ matrix.service }}
          tags: |
            type=ref,event=branch
            type=sha,prefix={{branch}}-
            type=raw,value=latest,enable={{is_default_branch}}

      - name: Build and push Docker image
        uses: docker/build-push-action@v5
        with:
          context: ./services/${{ matrix.service }}
          push: true
          tags: ${{ steps.meta.outputs.tags }}
          labels: ${{ steps.meta.outputs.labels }}
          cache-from: type=gha
          cache-to: type=gha,mode=max

  deploy:
    needs: build
    runs-on: ubuntu-latest
    if: github.event_name == 'push' && github.ref == 'refs/heads/main'

    steps:
      - name: Deploy to Railway
        uses: bervProject/railway-deploy@v1.0.5
        with:
          railway_token: ${{ secrets.RAILWAY_TOKEN }}
          service: api

      - name: Deploy Workers to Railway
        uses: bervProject/railway-deploy@v1.0.5
        with:
          railway_token: ${{ secrets.RAILWAY_TOKEN }}
          service: worker

      - name: Run database migrations
        run: |
          npm run migrate:prod
        env:
          DATABASE_URL: ${{ secrets.DATABASE_URL }}

      - name: Notify Sentry of deployment
        uses: getsentry/action-release@v1
        env:
          SENTRY_AUTH_TOKEN: ${{ secrets.SENTRY_AUTH_TOKEN }}
          SENTRY_ORG: coffeereader
          SENTRY_PROJECT: api
        with:
          environment: production
          version: ${{ github.sha }}
```

---

## 8. Monitoring & Observability

### 8.1. Metrics to Track

```typescript
// metrics.ts - Prometheus metrics

import { Counter, Histogram, Gauge } from 'prom-client';

// Business Metrics
export const analysisCreated = new Counter({
  name: 'analysis_created_total',
  help: 'Total number of analyses created',
  labelNames: ['focus_area', 'tier'],
});

export const analysisCompleted = new Counter({
  name: 'analysis_completed_total',
  help: 'Total number of analyses completed',
  labelNames: ['focus_area', 'tier', 'status'], // status: success, failed
});

export const subscriptionUpgraded = new Counter({
  name: 'subscription_upgraded_total',
  help: 'Total number of subscription upgrades',
  labelNames: ['from_tier', 'to_tier'],
});

export const paymentProcessed = new Counter({
  name: 'payment_processed_total',
  help: 'Total number of payments processed',
  labelNames: ['provider', 'status'], // status: succeeded, failed
});

export const paymentAmount = new Histogram({
  name: 'payment_amount_rub',
  help: 'Payment amounts in RUB',
  labelNames: ['provider', 'tier'],
  buckets: [100, 299, 599, 1000, 1499, 5000],
});

// Technical Metrics
export const aiRequestDuration = new Histogram({
  name: 'ai_request_duration_seconds',
  help: 'AI API request duration',
  labelNames: ['model', 'status'],
  buckets: [1, 5, 10, 20, 30, 60],
});

export const aiTokensUsed = new Histogram({
  name: 'ai_tokens_used_total',
  help: 'Total tokens used per request',
  labelNames: ['model', 'type'], // type: vision, text
  buckets: [100, 500, 1000, 2000, 5000, 10000],
});

export const queueJobsWaiting = new Gauge({
  name: 'queue_jobs_waiting',
  help: 'Number of jobs waiting in queue',
  labelNames: ['queue_name'],
});

export const queueJobProcessingTime = new Histogram({
  name: 'queue_job_processing_seconds',
  help: 'Time to process a job from queue',
  labelNames: ['queue_name', 'status'],
  buckets: [1, 5, 10, 30, 60, 300],
});

export const dbQueryDuration = new Histogram({
  name: 'db_query_duration_seconds',
  help: 'Database query duration',
  labelNames: ['operation', 'table'],
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 5],
});

export const httpRequestDuration = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'HTTP request duration',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.1, 0.3, 0.5, 1, 3, 5, 10],
});

export const activeUsers = new Gauge({
  name: 'active_users',
  help: 'Number of active users',
  labelNames: ['period'], // period: daily, weekly, monthly
});

// Usage example
export function trackAnalysisCreation(focusArea: string, tier: string) {
  analysisCreated.inc({ focus_area: focusArea, tier });
}

export function trackAIRequest(model: string, durationMs: number, success: boolean) {
  aiRequestDuration.observe(
    { model, status: success ? 'success' : 'failed' },
    durationMs / 1000
  );
}
```

### 8.2. Logging Strategy

```typescript
// logger.ts - Structured logging with Pino

import pino from 'pino';

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport:
    process.env.NODE_ENV === 'development'
      ? {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'SYS:standard',
            ignore: 'pid,hostname',
          },
        }
      : undefined,
  formatters: {
    level: (label) => ({ level: label }),
  },
  serializers: {
    req: pino.stdSerializers.req,
    res: pino.stdSerializers.res,
    err: pino.stdSerializers.err,
  },
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers["x-telegram-init-data"]',
      '*.password',
      '*.token',
      '*.api_key',
    ],
    censor: '[REDACTED]',
  },
});

// Usage examples
logger.info({ userId: '123', action: 'analysis_created' }, 'Analysis created');

logger.error(
  { err: error, userId: '123', analysisId: 'abc' },
  'AI analysis failed'
);

logger.warn(
  { userId: '123', limit: 3, used: 3 },
  'User reached daily limit'
);

// Child logger with context
const requestLogger = logger.child({
  requestId: 'req-123',
  userId: '456',
});

requestLogger.info('Processing request');
```

### 8.3. Alerting Rules

```yaml
# alertmanager-config.yml

groups:
  - name: coffeereader_alerts
    interval: 30s
    rules:
      # API Availability
      - alert: APIDown
        expr: up{job="api"} == 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "API service is down"
          description: "API has been down for more than 1 minute"

      # High Error Rate
      - alert: HighErrorRate
        expr: |
          rate(http_request_duration_seconds_count{status_code=~"5.."}[5m])
          / rate(http_request_duration_seconds_count[5m]) > 0.05
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High error rate detected"
          description: "Error rate is above 5% for 5 minutes"

      # AI Request Failures
      - alert: AIRequestFailures
        expr: |
          rate(ai_request_duration_seconds_count{status="failed"}[5m]) > 0.1
        for: 3m
        labels:
          severity: warning
        annotations:
          summary: "High AI request failure rate"
          description: "AI requests failing at {{ $value }} per second"

      # Queue Backlog
      - alert: QueueBacklog
        expr: queue_jobs_waiting > 100
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Queue backlog detected"
          description: "{{ $labels.queue_name }} has {{ $value }} jobs waiting"

      # Database Connection Pool
      - alert: DatabasePoolExhausted
        expr: db_connection_pool_used / db_connection_pool_max > 0.9
        for: 2m
        labels:
          severity: critical
        annotations:
          summary: "Database connection pool nearly exhausted"
          description: "{{ $value | humanizePercentage }} of pool used"

      # Payment Processing Issues
      - alert: PaymentProcessingFailures
        expr: |
          rate(payment_processed_total{status="failed"}[10m]) > 0.05
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "High payment failure rate"
          description: "Payment failures at {{ $value }} per second"
```

### 8.4. Sentry Integration

```typescript
// sentry-config.ts

import * as Sentry from '@sentry/node';
import { ProfilingIntegration } from '@sentry/profiling-node';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  release: process.env.GIT_SHA,

  // Performance Monitoring
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

  // Profiling
  profilesSampleRate: 0.1,
  integrations: [
    new ProfilingIntegration(),
    new Sentry.Integrations.Http({ tracing: true }),
    new Sentry.Integrations.Postgres(),
  ],

  // Error filtering
  beforeSend(event, hint) {
    // Don't send errors from bots/scrapers
    const userAgent = event.request?.headers?.['user-agent'];
    if (userAgent && /bot|crawler|spider/i.test(userAgent)) {
      return null;
    }

    // Enrich with user context
    if (event.user) {
      event.user.telegram_id = event.user.id;
    }

    return event;
  },

  // Breadcrumbs
  breadcrumbs: {
    console: true,
    http: true,
  },
});

// Custom error tracking
export function captureAnalysisError(error: Error, context: {
  userId: string;
  analysisId: string;
  focusArea: string;
}) {
  Sentry.captureException(error, {
    tags: {
      error_type: 'analysis_failed',
      focus_area: context.focusArea,
    },
    user: {
      id: context.userId,
    },
    contexts: {
      analysis: {
        id: context.analysisId,
        focus_area: context.focusArea,
      },
    },
  });
}

export function capturePaymentError(error: Error, context: {
  userId: string;
  provider: string;
  amount: number;
}) {
  Sentry.captureException(error, {
    tags: {
      error_type: 'payment_failed',
      provider: context.provider,
    },
    user: {
      id: context.userId,
    },
    contexts: {
      payment: {
        provider: context.provider,
        amount: context.amount,
      },
    },
    level: 'error',
  });
}
```

---

## 9. Error Handling Strategy

### 9.1. Error Codes Catalog

```typescript
// error-codes.ts

export enum ErrorCode {
  // Validation Errors (1xx)
  INVALID_IMAGE_FORMAT = 'E101',
  IMAGE_TOO_LARGE = 'E102',
  INVALID_FOCUS_AREA = 'E103',
  MISSING_REQUIRED_FIELD = 'E104',

  // Authorization Errors (2xx)
  UNAUTHORIZED = 'E201',
  INVALID_TOKEN = 'E202',
  TOKEN_EXPIRED = 'E203',

  // Limit Errors (3xx)
  DAILY_LIMIT_EXCEEDED = 'E301',
  MONTHLY_LIMIT_EXCEEDED = 'E302',
  TRIAL_EXPIRED = 'E303',

  // Payment Errors (4xx)
  PAYMENT_FAILED = 'E401',
  PAYMENT_CANCELED = 'E402',
  INSUFFICIENT_FUNDS = 'E403',
  PAYMENT_PROVIDER_ERROR = 'E404',

  // AI Processing Errors (5xx)
  AI_TIMEOUT = 'E501',
  AI_RATE_LIMIT = 'E502',
  AI_INVALID_RESPONSE = 'E503',
  NSFW_CONTENT_DETECTED = 'E504',

  // System Errors (9xx)
  INTERNAL_SERVER_ERROR = 'E900',
  DATABASE_ERROR = 'E901',
  QUEUE_ERROR = 'E902',
  STORAGE_ERROR = 'E903',
}

export const errorMessages: Record<ErrorCode, string> = {
  [ErrorCode.INVALID_IMAGE_FORMAT]: 'Invalid image format. Please upload JPEG or PNG.',
  [ErrorCode.IMAGE_TOO_LARGE]: 'Image is too large. Maximum size is 15MB.',
  [ErrorCode.INVALID_FOCUS_AREA]: 'Invalid focus area. Choose: wellbeing, career, or relationships.',
  [ErrorCode.MISSING_REQUIRED_FIELD]: 'Required field is missing.',

  [ErrorCode.UNAUTHORIZED]: 'Authentication required.',
  [ErrorCode.INVALID_TOKEN]: 'Invalid authentication token.',
  [ErrorCode.TOKEN_EXPIRED]: 'Authentication token has expired.',

  [ErrorCode.DAILY_LIMIT_EXCEEDED]: 'Daily limit exceeded. Upgrade to continue.',
  [ErrorCode.MONTHLY_LIMIT_EXCEEDED]: 'Monthly limit exceeded. Upgrade your plan.',
  [ErrorCode.TRIAL_EXPIRED]: 'Trial period has ended. Subscribe to continue.',

  [ErrorCode.PAYMENT_FAILED]: 'Payment failed. Please try again.',
  [ErrorCode.PAYMENT_CANCELED]: 'Payment was canceled.',
  [ErrorCode.INSUFFICIENT_FUNDS]: 'Insufficient funds.',
  [ErrorCode.PAYMENT_PROVIDER_ERROR]: 'Payment provider error. Please try again later.',

  [ErrorCode.AI_TIMEOUT]: 'AI analysis timed out. Please try again.',
  [ErrorCode.AI_RATE_LIMIT]: 'AI service rate limit reached. Please try again in a moment.',
  [ErrorCode.AI_INVALID_RESPONSE]: 'AI service returned invalid response.',
  [ErrorCode.NSFW_CONTENT_DETECTED]: 'Image contains inappropriate content.',

  [ErrorCode.INTERNAL_SERVER_ERROR]: 'Internal server error. Please try again later.',
  [ErrorCode.DATABASE_ERROR]: 'Database error. Please try again.',
  [ErrorCode.QUEUE_ERROR]: 'Queue processing error.',
  [ErrorCode.STORAGE_ERROR]: 'Storage error. Please try again.',
};

// Custom error class
export class AppError extends Error {
  constructor(
    public code: ErrorCode,
    public statusCode: number = 500,
    public details?: any
  ) {
    super(errorMessages[code]);
    this.name = 'AppError';
  }

  toJSON() {
    return {
      code: this.code,
      message: this.message,
      ...(this.details && { details: this.details }),
    };
  }
}

// Usage
throw new AppError(ErrorCode.DAILY_LIMIT_EXCEEDED, 402, {
  daily_limit: 3,
  used: 3,
  reset_at: '2025-10-14T00:00:00Z',
});
```

### 9.2. Retry Logic

```typescript
// retry.ts

import pRetry, { AbortError } from 'p-retry';

export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: {
    retries?: number;
    minTimeout?: number;
    maxTimeout?: number;
    onFailedAttempt?: (error: any) => void;
  } = {}
): Promise<T> {
  return pRetry(fn, {
    retries: options.retries || 3,
    minTimeout: options.minTimeout || 1000,
    maxTimeout: options.maxTimeout || 30000,
    factor: 2,
    randomize: true,
    onFailedAttempt: (error) => {
      logger.warn({
        attempt: error.attemptNumber,
        retriesLeft: error.retriesLeft,
        error: error.message,
      }, 'Retry attempt failed');

      options.onFailedAttempt?.(error);

      // Don't retry certain errors
      if (error.message.includes('not found') ||
          error.message.includes('unauthorized')) {
        throw new AbortError(error);
      }
    },
  });
}

// Usage for AI requests
export async function callAIWithRetry(imageUrl: string, context: any) {
  return retryWithBackoff(
    async () => {
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'deepcogito/cogito-v2',
          messages: [{
            role: 'user',
            content: [
              { type: 'image_url', image_url: { url: imageUrl } },
              { type: 'text', text: context },
            ],
          }],
        }),
      });

      if (!response.ok) {
        if (response.status === 429) {
          // Rate limited - will retry
          throw new Error('Rate limited');
        }
        if (response.status >= 500) {
          // Server error - will retry
          throw new Error('Server error');
        }
        // Client error - don't retry
        throw new AbortError(new Error('Client error'));
      }

      return response.json();
    },
    {
      retries: 3,
      minTimeout: 2000,
      onFailedAttempt: (error) => {
        Sentry.captureMessage('AI request retry', {
          level: 'warning',
          extra: {
            attempt: error.attemptNumber,
            error: error.message,
          },
        });
      },
    }
  );
}
```

---

## 10. Data Flow Scenarios

### 10.1. Complete Analysis Flow (Sequence Diagram)

```
User      Telegram    n8n       API       Queue     Worker    OpenRouter    DB
│           │          │         │         │         │         │            │
│ Send photo│          │         │         │         │         │            │
├──────────>│          │         │         │         │         │            │
│           │ Webhook  │         │         │         │         │            │
│           ├─────────>│         │         │         │         │            │
│           │          │ POST    │         │         │         │            │
│           │          │ /analyses│        │         │         │            │
│           │          ├────────>│         │         │         │            │
│           │          │         │ Check   │         │         │            │
│           │          │         │ limits  │         │         │            │
│           │          │         ├─────────────────────────────────────────>│
│           │          │         │<────────────────────────────────────────┤│
│           │          │         │ limits OK│        │         │            │
│           │          │         │         │         │         │            │
│           │          │         │ Upload  │         │         │            │
│           │          │         │ to S3   │         │         │            │
│           │          │         ├──────────┐        │         │            │
│           │          │         │<─────────┘        │         │            │
│           │          │         │         │         │         │            │
│           │          │         │ Create  │         │         │            │
│           │          │         │ analysis│         │         │            │
│           │          │         ├─────────────────────────────────────────>│
│           │          │         │<────────────────────────────────────────┤│
│           │          │         │         │         │         │            │
│           │          │         │ Enqueue │         │         │            │
│           │          │         │ job     │         │         │            │
│           │          │         ├────────>│         │         │            │
│           │          │         │         │         │         │            │
│           │          │ 202     │         │         │         │            │
│           │          │ Accepted│         │         │         │            │
│           │          │<────────┤         │         │         │            │
│           │          │         │         │         │         │            │
│           │ "Analysis│         │         │         │         │            │
│           │ started" │         │         │         │         │            │
│           │<─────────┤         │         │         │         │            │
│<──────────┤          │         │         │         │         │            │
│  ✅       │          │         │         │         │         │            │
│           │          │         │         │ Consume │         │            │
│           │          │         │         │ job     │         │            │
│           │          │         │         ├────────>│         │            │
│           │          │         │         │         │         │            │
│           │          │         │         │         │ Get     │            │
│           │          │         │         │         │ context │            │
│           │          │         │         │         ├─────────────────────>│
│           │          │         │         │         │<────────────────────┤│
│           │          │         │         │         │         │            │
│           │          │         │         │         │ Call AI │            │
│           │          │         │         │         │ API     │            │
│           │          │         │         │         ├────────>│            │
│           │          │         │         │         │ (vision)│            │
│           │          │         │         │         │<────────┤            │
│           │          │         │         │         │ patterns│            │
│           │          │         │         │         │         │            │
│           │          │         │         │         │ Call AI │            │
│           │          │         │         │         │ API     │            │
│           │          │         │         │         ├────────>│            │
│           │          │         │         │         │ (text)  │            │
│           │          │         │         │         │<────────┤            │
│           │          │         │         │         │interpret│            │
│           │          │         │         │         │         │            │
│           │          │         │         │         │ Update  │            │
│           │          │         │         │         │ analysis│            │
│           │          │         │         │         ├─────────────────────>│
│           │          │         │         │         │<────────────────────┤│
│           │          │         │         │         │         │            │
│           │          │         │         │         │ Enqueue │            │
│           │          │         │         │         │ notif   │            │
│           │          │         │         │<────────┤         │            │
│           │          │         │         │         │         │            │
│           │          │         │         │ Consume │         │            │
│           │          │         │         ├────────>│         │            │
│           │          │         │         │  notify │         │            │
│           │          │         │         │         │         │            │
│           │          │         │         │         │ Webhook │            │
│           │          │         │         │         │ to n8n  │            │
│           │          │<────────────────────────────┤         │            │
│           │          │         │         │         │         │            │
│           │ Format & │         │         │         │         │            │
│           │ send     │         │         │         │         │            │
│           │<─────────┤         │         │         │         │            │
│<──────────┤          │         │         │         │         │            │
│  Result   │          │         │         │         │         │            │
```

### 10.2. Payment Flow (Sequence Diagram)

```
User    Mini App    API       Tinkoff    Queue    Worker     DB
│         │         │         │          │        │          │
│ Click   │         │         │          │        │          │
│"Upgrade"│         │         │          │        │          │
├────────>│         │         │          │        │          │
│         │ POST    │         │          │        │          │
│         │ /subs/  │         │          │        │          │
│         │ purchase│         │          │        │          │
│         ├────────>│         │          │        │          │
│         │         │ Create  │          │        │          │
│         │         │ payment │          │        │          │
│         │         ├─────────────────────────────────────────>│
│         │         │<────────────────────────────────────────┤│
│         │         │         │          │        │          │
│         │         │ Init    │          │        │          │
│         │         │ payment │          │        │          │
│         │         ├────────>│          │        │          │
│         │         │<────────┤          │        │          │
│         │         │ payment │          │        │          │
│         │         │ URL     │          │        │          │
│         │         │         │          │        │          │
│         │ 200     │         │          │        │          │
│         │ payment │         │          │        │          │
│         │ URL     │         │          │        │          │
│         │<────────┤         │          │        │          │
│         │         │         │          │        │          │
│ Redirect│         │         │          │        │          │
│ to      │         │         │          │        │          │
│ Tinkoff │         │         │          │        │          │
├─────────────────────────────>│          │        │          │
│         │         │         │          │        │          │
│ Enter   │         │         │          │        │          │
│ card    │         │         │          │        │          │
├─────────────────────────────>│          │        │          │
│         │         │         │          │        │          │
│ Payment │         │         │          │        │          │
│confirmed│         │         │          │        │          │
│<────────────────────────────┤│          │        │          │
│         │         │         │          │        │          │
│         │         │         │ Webhook  │        │          │
│         │         │         │ POST     │        │          │
│         │         │<────────┤          │        │          │
│         │         │         │          │        │          │
│         │         │ Verify  │          │        │          │
│         │         │signature│          │        │          │
│         │         ├──────────┐         │        │          │
│         │         │<─────────┘         │        │          │
│         │         │         │          │        │          │
│         │         │ Check   │          │        │          │
│         │         │idempotent│         │        │          │
│         │         ├─────────────────────────────────────────>│
│         │         │<────────────────────────────────────────┤│
│         │         │         │          │        │          │
│         │         │ Update  │          │        │          │
│         │         │ payment │          │        │          │
│         │         ├─────────────────────────────────────────>│
│         │         │         │          │        │          │
│         │         │ Activate│          │        │          │
│         │         │ sub     │          │        │          │
│         │         ├─────────────────────────────────────────>│
│         │         │<────────────────────────────────────────┤│
│         │         │         │          │        │          │
│         │         │ Enqueue │          │        │          │
│         │         │ notif   │          │        │          │
│         │         ├─────────────────────>│       │          │
│         │         │         │          │        │          │
│         │         │ 200 OK  │          │        │          │
│         │         ├────────>│          │        │          │
│         │         │         │          │        │          │
│         │         │         │          │ Consume│          │
│         │         │         │          ├───────>│          │
│         │         │         │          │        │          │
│         │         │         │          │        │ Send     │
│         │         │         │          │        │ Telegram │
│         │         │         │          │        │ message  │
│<────────────────────────────────────────────────┤          │
│ "Subscription activated!" │          │        │          │
```

---

## 11. Architecture Decision Records

### ADR-001: Use n8n for Workflow Orchestration

**Status:** Accepted
**Date:** 2025-10-13
**Context:**

We need to orchestrate Telegram bot interactions with our backend services. The workflow includes receiving messages, calling AI APIs, formatting responses, and sending results back to users.

**Decision:**

Use n8n as the workflow orchestration layer between Telegram and our backend API.

**Rationale:**

**Pros:**
- Visual workflow editor - non-developers can modify prompts and logic
- Built-in Telegram nodes
- Easy to prototype and iterate
- Handles webhook management
- Keeps AI prompts and message formatting configurable
- Pre-MVP already built on n8n

**Cons:**
- Additional infrastructure component
- Learning curve for team
- Not as flexible as code for complex logic
- Potential performance bottleneck

**Alternatives Considered:**
1. **Direct Telegram Bot SDK in Node.js**
   - More control, better performance
   - But harder to modify prompts/workflows without code changes

2. **AWS Step Functions**
   - More robust, better for scale
   - But more expensive, steeper learning curve

**Consequences:**
- Need to maintain n8n instance
- Backend API must expose endpoints for n8n to call
- AI prompts stored in n8n workflows
- Need versioning strategy for workflows (export to Git)

**Mitigation:**
- Export n8n workflows to Git for version control
- Document all workflows with README
- Backend API should be n8n-agnostic (REST endpoints)
- Keep complex business logic in backend, not n8n

---

### ADR-002: Use Railway for Hosting Instead of AWS

**Status:** Accepted
**Date:** 2025-10-13
**Context:**

Need to choose hosting platform for backend services (API, Workers, n8n).

**Decision:**

Use Railway for hosting all backend services.

**Rationale:**

**Pros:**
- Extremely fast to deploy (minutes vs. days)
- Built-in CI/CD from GitHub
- Auto-scaling included
- Affordable for MVP ($20-50/month vs. $200+ on AWS)
- PostgreSQL and Redis included
- No DevOps overhead

**Cons:**
- Less control than AWS
- Potential vendor lock-in
- Limited regions (US/EU)
- Not enterprise-grade (yet)

**Alternatives Considered:**
1. **AWS (ECS + RDS + ElastiCache)**
   - Pros: Enterprise-grade, unlimited scale, full control
   - Cons: $500+/month, complex setup, requires DevOps

2. **DigitalOcean App Platform**
   - Pros: Similar to Railway, affordable
   - Cons: Less polished, fewer integrations

3. **Vercel + Serverless Functions**
   - Pros: Excellent for frontend, serverless auto-scale
   - Cons: Cold starts, stateful workers problematic

**Consequences:**
- Easy to migrate to AWS later if needed (Docker containers)
- Must monitor Railway limits and pricing
- Single region deployment (can add more later)

**Migration Path:**
If Railway becomes insufficient:
1. Export Docker images
2. Deploy to AWS ECS/Fargate
3. Point Cloudflare DNS to new endpoints
4. Estimated migration time: 2-3 days

---

### ADR-003: Use Supabase Instead of Self-Hosted PostgreSQL

**Status:** Accepted
**Date:** 2025-10-13
**Context:**

Need PostgreSQL database with backups, monitoring, and RLS (Row Level Security) for Mini App direct access.

**Decision:**

Use Supabase (managed PostgreSQL + Auth + Storage).

**Rationale:**

**Pros:**
- PostgreSQL 15 with all extensions (pgvector, etc.)
- Built-in authentication (though we use Telegram)
- Row Level Security (RLS) for secure Mini App access
- Built-in storage (S3-compatible)
- Automatic backups
- Realtime subscriptions (for future features)
- Free tier: 500MB DB + 1GB storage
- $25/month Pro tier includes:
  - 8GB DB
  - 100GB storage
  - Daily backups
  - 99.9% SLA

**Cons:**
- Vendor lock-in (but PostgreSQL is standard)
- Limited control over Postgres config
- Extra hop for backend (hosted elsewhere)

**Alternatives Considered:**
1. **Self-hosted PostgreSQL on Railway**
   - Pros: Full control, cheaper at scale
   - Cons: No RLS admin panel, manage backups, more work

2. **AWS RDS**
   - Pros: Enterprise-grade, full control
   - Cons: $50+/month minimum, complex setup

3. **PlanetScale**
   - Pros: Great branching, auto-scaling
   - Cons: MySQL (not Postgres), different paradigm

**Consequences:**
- Mini App can query DB directly (via Supabase JS SDK)
- RLS policies protect user data
- Need to manage Supabase service role key securely
- Easy to add Realtime features later

---

### ADR-004: BullMQ for Job Queue Instead of Kafka

**Status:** Accepted
**Date:** 2025-10-13
**Context:**

Need reliable job queue for async processing (AI analysis, notifications, payments).

**Decision:**

Use BullMQ (Redis-based job queue) instead of Kafka or RabbitMQ.

**Rationale:**

**Pros:**
- Simple to set up (just Redis)
- Excellent Node.js support
- Built-in features:
  - Job retries with exponential backoff
  - Job prioritization
  - Delayed jobs
  - Cron jobs
  - Rate limiting
  - Job progress tracking
- Lightweight (no JVM)
- Perfect for <1M jobs/day

**Cons:**
- Single point of failure (Redis)
- Not as robust as Kafka for high-throughput
- Limited to Redis memory

**Alternatives Considered:**
1. **Kafka**
   - Pros: Battle-tested, unlimited scale, multi-consumer
   - Cons: Overkill for MVP, complex, expensive

2. **RabbitMQ**
   - Pros: Mature, many features
   - Cons: Requires separate service, Erlang ecosystem

3. **AWS SQS**
   - Pros: Managed, reliable, cheap
   - Cons: Vendor lock-in, slower (polling), no Redis-based features

**Consequences:**
- Redis becomes critical infrastructure (needs monitoring)
- Use Upstash Redis for managed solution
- Easy to migrate to Kafka later if needed (queue interface is abstracted)

---

### ADR-005: Fastify Instead of Express

**Status:** Accepted
**Date:** 2025-10-13
**Context:**

Need Node.js web framework for REST API.

**Decision:**

Use Fastify instead of Express.

**Rationale:**

**Pros:**
- 2-3x faster than Express
- Built-in schema validation (JSON Schema)
- TypeScript-first (excellent types)
- Plugin ecosystem
- Async/await native
- Built-in logging (Pino)
- Lower latency (important for real-time analysis)

**Cons:**
- Smaller ecosystem than Express
- Steeper learning curve
- Fewer StackOverflow answers

**Alternatives Considered:**
1. **Express**
   - Pros: Most popular, huge ecosystem, familiar
   - Cons: Slower, no built-in validation, aging codebase

2. **NestJS**
   - Pros: Full framework, TypeScript, dependency injection
   - Cons: Heavyweight, opinionated, slower than Fastify

3. **Hono**
   - Pros: Ultra-fast, edge-ready, modern
   - Cons: Very new, small ecosystem

**Consequences:**
- Team needs to learn Fastify patterns
- Better performance out of the box
- Schema validation prevents runtime errors

---

## 12. Load Testing Strategy

### 12.1. Performance Requirements (from TZ)

Based on `TZ_EXTENDED_MVP.md` and `coffee-reader-dev-spec.md`:

```
Target Metrics:
- Response Time (API): ≤3 sec (p95) for standard requests
- AI Analysis Time: ≤30 sec for full cycle
- Notification Time: ≤10 sec for "analysis started" message
- Throughput: 500 analyses/hour
- Concurrent Users: 1000+ without degradation
- Database Queries: <200ms (p95)
- Uptime: ≥99% (target 99.5%)
- Error Rate: <1% of all requests
```

### 12.2. Load Testing Tools

**Primary Tool: k6**

Why k6:
- JavaScript/TypeScript based (team familiarity)
- Excellent reporting (HTML, JSON, InfluxDB)
- CI/CD integration (GitHub Actions)
- Cloud execution option (k6 Cloud)
- Realistic virtual users (not just RPS)

**Installation:**

```bash
# macOS
brew install k6

# Linux
sudo apt-key adv --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update
sudo apt-get install k6

# Docker
docker pull grafana/k6
```

### 12.3. Test Scenarios

#### Scenario 1: Smoke Test (Sanity Check)

**Purpose:** Verify system works with minimal load
**When:** After every deployment, before other tests

```javascript
// tests/smoke.js

import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  vus: 1, // 1 virtual user
  duration: '1m',
  thresholds: {
    http_req_duration: ['p(95)<3000'], // 95% of requests < 3s
    http_req_failed: ['rate<0.01'],    // <1% errors
  },
};

const BASE_URL = __ENV.API_URL || 'https://api.coffeereader.com/v1';

export default function () {
  // Health check
  let res = http.get(`${BASE_URL}/health`);
  check(res, {
    'health check status is 200': (r) => r.status === 200,
    'health check response time < 500ms': (r) => r.timings.duration < 500,
  });

  sleep(1);

  // Get user profile (mock auth)
  res = http.get(`${BASE_URL}/users/me`, {
    headers: {
      'X-Telegram-Init-Data': __ENV.TEST_INIT_DATA,
    },
  });

  check(res, {
    'user profile status is 200': (r) => r.status === 200,
  });

  sleep(1);
}
```

**Run:**
```bash
k6 run tests/smoke.js
```

**Success Criteria:**
- ✅ All checks pass
- ✅ 0 errors
- ✅ p95 response time < 3s

---

#### Scenario 2: Load Test (Normal Traffic)

**Purpose:** Verify system handles expected load
**When:** Before major releases, weekly

```javascript
// tests/load.js

import http from 'k6/http';
import { check, sleep } from 'k6';
import { FormData } from 'https://jslib.k6.io/formdata/0.0.2/index.js';

export const options = {
  stages: [
    { duration: '2m', target: 50 },   // Ramp up to 50 users
    { duration: '5m', target: 50 },   // Stay at 50 users
    { duration: '2m', target: 100 },  // Ramp to 100 users
    { duration: '5m', target: 100 },  // Stay at 100 users
    { duration: '2m', target: 0 },    // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<3000'],
    'http_req_duration{name:create_analysis}': ['p(95)<1000'], // API accept < 1s
    'http_req_duration{name:get_history}': ['p(95)<500'],
    http_req_failed: ['rate<0.01'],
    checks: ['rate>0.95'], // 95%+ checks pass
  },
};

const BASE_URL = __ENV.API_URL || 'https://api.coffeereader.com/v1';
const TEST_IMAGE = open('../fixtures/test-coffee-cup.jpg', 'b');

export default function () {
  const authHeader = {
    'X-Telegram-Init-Data': generateMockInitData(),
  };

  // 1. Create analysis (main flow)
  const fd = new FormData();
  fd.append('image', http.file(TEST_IMAGE, 'coffee-cup.jpg', 'image/jpeg'));
  fd.append('focus_area', 'wellbeing');

  let res = http.post(`${BASE_URL}/analyses`, fd.body(), {
    headers: {
      ...authHeader,
      'Content-Type': 'multipart/form-data; boundary=' + fd.boundary,
    },
    tags: { name: 'create_analysis' },
  });

  check(res, {
    'analysis created (202)': (r) => r.status === 202,
    'analysis has id': (r) => r.json('id') !== undefined,
  });

  sleep(2);

  // 2. Get history
  res = http.get(`${BASE_URL}/analyses?limit=20`, {
    headers: authHeader,
    tags: { name: 'get_history' },
  });

  check(res, {
    'history retrieved (200)': (r) => r.status === 200,
    'history has data': (r) => r.json('data').length > 0,
  });

  sleep(1);

  // 3. Get usage limits
  res = http.get(`${BASE_URL}/limits/me`, {
    headers: authHeader,
    tags: { name: 'get_limits' },
  });

  check(res, {
    'limits retrieved (200)': (r) => r.status === 200,
  });

  sleep(3); // Simulate user think time
}

function generateMockInitData() {
  const userId = Math.floor(Math.random() * 1000000);
  return `user_id=${userId}&auth_date=${Math.floor(Date.now() / 1000)}&hash=mock`;
}
```

**Run:**
```bash
k6 run tests/load.js \
  --env API_URL=https://staging-api.coffeereader.com/v1 \
  --out json=load-test-results.json \
  --out influxdb=http://localhost:8086/k6
```

**Success Criteria:**
- ✅ p95 response time < 3s
- ✅ Error rate < 1%
- ✅ 95%+ checks pass
- ✅ No database connection pool exhaustion
- ✅ Queue backlog < 50 jobs

---

#### Scenario 3: Stress Test (Find Breaking Point)

**Purpose:** Find system limits, identify bottlenecks
**When:** After infrastructure changes, monthly

```javascript
// tests/stress.js

export const options = {
  stages: [
    { duration: '2m', target: 100 },   // Ramp to normal
    { duration: '5m', target: 100 },   // Stay at normal
    { duration: '2m', target: 200 },   // Ramp to 2x
    { duration: '5m', target: 200 },   // Stay at 2x
    { duration: '2m', target: 300 },   // Ramp to 3x
    { duration: '5m', target: 300 },   // Stay at 3x
    { duration: '2m', target: 400 },   // Ramp to 4x
    { duration: '5m', target: 400 },   // Push to breaking
    { duration: '10m', target: 0 },    // Recovery
  ],
  thresholds: {
    // Relaxed thresholds - we expect failures
    http_req_duration: ['p(95)<10000'], // 10s
    http_req_failed: ['rate<0.1'],      // <10% errors
  },
};

// ... same test logic as load.js
```

**Success Criteria:**
- ✅ Identify breaking point (e.g., 350 concurrent users)
- ✅ System degrades gracefully (no cascading failures)
- ✅ Recovery is automatic (no manual intervention)
- ✅ Errors are proper HTTP codes (429, 503) not 500

---

#### Scenario 4: Spike Test (Sudden Traffic)

**Purpose:** Handle viral traffic spikes
**When:** Before marketing campaigns, monthly

```javascript
// tests/spike.js

export const options = {
  stages: [
    { duration: '1m', target: 50 },     // Normal traffic
    { duration: '30s', target: 500 },   // SPIKE! 10x traffic
    { duration: '3m', target: 500 },    // Hold spike
    { duration: '1m', target: 50 },     // Back to normal
    { duration: '2m', target: 50 },     // Recovery
  ],
  thresholds: {
    http_req_duration: ['p(95)<5000'], // Relaxed during spike
    http_req_failed: ['rate<0.05'],    // 5% errors OK
  },
};

// ... same test logic
```

**Success Criteria:**
- ✅ System survives spike without crash
- ✅ Auto-scaling triggers (if configured)
- ✅ Queue absorbs burst (no lost jobs)
- ✅ Rate limiting protects backend

---

#### Scenario 5: Soak Test (Endurance)

**Purpose:** Find memory leaks, resource exhaustion
**When:** Before production, after major changes

```javascript
// tests/soak.js

export const options = {
  stages: [
    { duration: '5m', target: 100 },   // Ramp up
    { duration: '4h', target: 100 },   // Run for 4 hours
    { duration: '5m', target: 0 },     // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<3000'],
    http_req_failed: ['rate<0.01'],
  },
};

// ... same test logic
```

**Success Criteria:**
- ✅ Memory usage stays stable (no leaks)
- ✅ CPU usage stays stable
- ✅ Database connections don't leak
- ✅ Response times don't degrade over time

---

### 12.4. AI Worker Load Testing

**Special consideration:** AI analysis is the most expensive operation.

```javascript
// tests/ai-worker-load.js

import { check } from 'k6';
import http from 'k6/http';

export const options = {
  scenarios: {
    // Simulate queue consumption rate
    ai_analysis_flow: {
      executor: 'constant-arrival-rate',
      rate: 10, // 10 analyses per second = 600/min = 36,000/hour
      timeUnit: '1s',
      duration: '5m',
      preAllocatedVUs: 50,
      maxVUs: 100,
    },
  },
  thresholds: {
    'http_req_duration{scenario:ai_analysis_flow}': ['p(95)<30000'], // 30s
    'http_req_failed{scenario:ai_analysis_flow}': ['rate<0.05'],
  },
};

export default function () {
  // Create analysis (enqueues to BullMQ)
  const fd = new FormData();
  fd.append('image', http.file(TEST_IMAGE, 'coffee.jpg', 'image/jpeg'));

  const res = http.post(`${BASE_URL}/analyses`, fd.body(), {
    headers: {
      'X-Telegram-Init-Data': generateMockInitData(),
      'Content-Type': 'multipart/form-data; boundary=' + fd.boundary,
    },
  });

  check(res, {
    'analysis accepted': (r) => r.status === 202,
  });

  // Don't wait for completion (workers handle async)
}
```

**Monitor during test:**
```bash
# Watch queue metrics
redis-cli LLEN bull:analysis:wait
redis-cli LLEN bull:analysis:active
redis-cli LLEN bull:analysis:failed

# Watch worker logs
kubectl logs -f deployment/worker --tail=100
```

**Success Criteria:**
- ✅ Queue doesn't grow unbounded (consumption rate >= production rate)
- ✅ Workers auto-scale (if configured)
- ✅ 95%+ analyses complete within 30s
- ✅ AI API rate limits respected (retries work)

---

### 12.5. Database Load Testing

```sql
-- Load test queries (run with pgbench or custom script)

-- 1. Frequent: Get user + subscription
SELECT u.*, s.*
FROM users u
LEFT JOIN subscriptions s ON s.user_id = u.id
WHERE u.telegram_id = $1;

-- 2. Frequent: Check limits
SELECT * FROM usage_limits
WHERE user_id = $1;

-- 3. Heavy: Get analysis history with pagination
SELECT * FROM analysis_history
WHERE user_id = $1
ORDER BY created_at DESC
LIMIT 20 OFFSET $2;

-- 4. Heavy: Get message context (last 20)
SELECT * FROM message_context
WHERE user_id = $1
ORDER BY created_at DESC
LIMIT 20;
```

**pgbench test:**
```bash
# Initialize test database
pgbench -i -s 50 coffeereader_test

# Run benchmark (simulate 100 concurrent connections)
pgbench -c 100 -j 10 -T 300 -f load-test.sql coffeereader_test
```

**Success Criteria:**
- ✅ p95 query time < 200ms
- ✅ Connection pool doesn't exhaust (monitor pg_stat_activity)
- ✅ No lock contention (pg_locks)
- ✅ Replication lag < 1s (if using Supabase read replicas)

---

### 12.6. CI/CD Integration

```yaml
# .github/workflows/load-test.yml

name: Load Tests

on:
  schedule:
    - cron: '0 2 * * 1' # Every Monday at 2am
  workflow_dispatch:

jobs:
  load-test:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - name: Install k6
        run: |
          sudo apt-key adv --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
          echo "deb https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
          sudo apt-get update
          sudo apt-get install k6

      - name: Run smoke test (sanity)
        run: |
          k6 run tests/smoke.js \
            --env API_URL=${{ secrets.STAGING_API_URL }} \
            --out json=smoke-results.json

      - name: Run load test
        if: success()
        run: |
          k6 run tests/load.js \
            --env API_URL=${{ secrets.STAGING_API_URL }} \
            --out json=load-results.json

      - name: Analyze results
        run: |
          # Parse JSON and check thresholds
          node scripts/analyze-k6-results.js load-results.json

      - name: Upload results
        uses: actions/upload-artifact@v3
        with:
          name: load-test-results
          path: |
            smoke-results.json
            load-results.json

      - name: Notify on failure
        if: failure()
        uses: slackapi/slack-github-action@v1
        with:
          payload: |
            {
              "text": "⚠️ Load tests failed on staging!",
              "blocks": [
                {
                  "type": "section",
                  "text": {
                    "type": "mrkdwn",
                    "text": "Load tests failed. Check GitHub Actions for details."
                  }
                }
              ]
            }
        env:
          SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK }}
```

---

### 12.7. Load Test Schedule

| Test Type | Frequency | Duration | Target | Trigger |
|-----------|-----------|----------|--------|---------|
| Smoke | Every deploy | 1 min | 1 VU | CI/CD automatic |
| Load | Weekly | 16 min | 50-100 VU | Scheduled (Mon 2am) |
| Stress | Monthly | 30 min | 100-400 VU | Manual |
| Spike | Before campaigns | 8 min | 50-500 VU | Manual |
| Soak | Before releases | 4 hours | 100 VU | Manual |
| AI Workers | Weekly | 5 min | 10/s rate | Scheduled |

---

### 12.8. Bottleneck Identification

**Common bottlenecks and solutions:**

| Bottleneck | Symptom | Solution |
|------------|---------|----------|
| Database connections | p95 > 500ms, pool exhausted | Increase pool size, add read replicas |
| Redis memory | Queue jobs accumulating | Scale Redis, add more workers |
| AI API rate limits | 429 errors from OpenRouter | Implement backoff, multiple API keys |
| Worker throughput | Queue backlog growing | Scale worker pods, optimize AI calls |
| Network I/O | High latency to external APIs | Add CDN, optimize payload sizes |
| CPU | High CPU usage on API pods | Scale horizontally, optimize hot paths |
| Memory leaks | Memory growing over time | Fix leaks (soak test), restart pods |

**Monitoring during load tests:**

```bash
# API metrics
curl https://api.coffeereader.com/metrics | grep http_request_duration

# Database
psql -c "SELECT * FROM pg_stat_activity WHERE state = 'active';"

# Redis
redis-cli INFO stats
redis-cli INFO memory

# Railway (if deployed there)
railway logs --service api --tail 100

# k6 real-time monitoring
k6 run tests/load.js --out influxdb=http://localhost:8086/k6
# Open Grafana dashboard
```

---

### 12.9. Load Test Acceptance Criteria

**Before production launch:**

- ✅ Smoke test: 100% pass rate
- ✅ Load test (100 VU): p95 < 3s, errors < 1%
- ✅ Stress test: Breaking point > 300 VU
- ✅ Spike test: Survives 10x spike
- ✅ Soak test (4h): No memory leaks, stable performance
- ✅ AI worker test: Handles 500 analyses/hour
- ✅ Database: p95 < 200ms under load
- ✅ All thresholds documented and enforced

**Post-launch monitoring:**

- Weekly load tests on staging
- Monthly stress tests
- Quarterly capacity planning review
- Real-time alerting on SLO breaches

---

## 13. Disaster Recovery Plan

### 13.1. RTO and RPO Targets

**Definitions:**
- **RTO (Recovery Time Objective):** Maximum acceptable downtime
- **RPO (Recovery Point Objective):** Maximum acceptable data loss

**Targets:**

| Service | RTO | RPO | Priority |
|---------|-----|-----|----------|
| API (user-facing) | 1 hour | 15 minutes | Critical |
| Database (PostgreSQL) | 30 minutes | 5 minutes | Critical |
| Queue (Redis) | 15 minutes | 0 (in-memory OK to lose) | High |
| Workers (AI analysis) | 15 minutes | 0 (requeue) | High |
| n8n (workflows) | 2 hours | 1 hour | Medium |
| Object Storage (images) | 4 hours | 1 hour | Medium |
| Mini App (frontend) | 30 minutes | 0 (static) | High |

---

### 13.2. Backup Strategy

#### 13.2.1. Database Backups (Supabase)

**Automatic Backups:**
```
Supabase Pro Plan includes:
- Daily automated backups (retained 7 days)
- Point-in-time recovery (PITR) to any second in last 7 days
- Stored in S3 (multi-region)
```

**Manual Backup Script:**
```bash
#!/bin/bash
# scripts/backup-database.sh

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="coffeereader_backup_${TIMESTAMP}.sql"

# Backup database
pg_dump $DATABASE_URL \
  --clean \
  --if-exists \
  --no-owner \
  --no-privileges \
  --file=$BACKUP_FILE

# Compress
gzip $BACKUP_FILE

# Upload to S3 (offsite backup)
aws s3 cp ${BACKUP_FILE}.gz s3://coffeereader-backups/db/

# Upload to Cloudflare R2 (geo-redundant)
aws s3 cp ${BACKUP_FILE}.gz \
  s3://coffeereader-backups-r2/db/ \
  --endpoint-url=https://[account-id].r2.cloudflarestorage.com

# Encrypt and store locally (for fastest restore)
gpg --encrypt --recipient backup@coffeereader.com ${BACKUP_FILE}.gz
mv ${BACKUP_FILE}.gz.gpg /mnt/backup/

# Cleanup old backups (keep 30 days)
find /mnt/backup/ -name "*.gz.gpg" -mtime +30 -delete

echo "Backup completed: ${BACKUP_FILE}.gz"
```

**Cron schedule:**
```bash
# /etc/cron.d/coffeereader-backup

# Full backup daily at 3am UTC
0 3 * * * /opt/coffeereader/scripts/backup-database.sh >> /var/log/backup.log 2>&1

# Incremental backup every 6 hours (using WAL archiving)
0 */6 * * * /opt/coffeereader/scripts/backup-wal.sh
```

**Verify backups:**
```bash
#!/bin/bash
# scripts/verify-backup.sh

# Restore to test database
createdb coffeereader_test_restore
gunzip -c latest_backup.sql.gz | psql coffeereader_test_restore

# Run validation queries
psql coffeereader_test_restore -c "SELECT COUNT(*) FROM users;"
psql coffeereader_test_restore -c "SELECT COUNT(*) FROM analysis_history;"

# Cleanup
dropdb coffeereader_test_restore

echo "Backup verification: PASSED"
```

#### 13.2.2. Redis Backups

**Redis persistence (Upstash handles this):**
```
- AOF (Append-Only File) enabled
- RDB snapshots every hour
- Automatic failover to replica
```

**For self-hosted Redis:**
```bash
# Enable AOF in redis.conf
appendonly yes
appendfilename "appendonly.aof"
appendfsync everysec

# Enable RDB snapshots
save 900 1      # After 900 sec if at least 1 key changed
save 300 10     # After 300 sec if at least 10 keys changed
save 60 10000   # After 60 sec if at least 10000 keys changed

# Backup script
redis-cli --rdb /backup/redis/dump_$(date +%Y%m%d).rdb
```

#### 13.2.3. Object Storage Backups

**Versioning enabled:**
```bash
# Enable versioning on Supabase Storage bucket
supabase storage buckets update coffee-images \
  --versioning enabled

# Cloudflare R2 lifecycle rules
{
  "Rules": [
    {
      "ID": "ArchiveOldVersions",
      "Status": "Enabled",
      "NoncurrentVersionTransitions": [
        {
          "NoncurrentDays": 30,
          "StorageClass": "GLACIER"
        }
      ],
      "NoncurrentVersionExpiration": {
        "NoncurrentDays": 90
      }
    }
  ]
}
```

#### 13.2.4. Configuration Backups

**Git as source of truth:**
```bash
# All infrastructure config in Git
/infrastructure/
  /terraform/          # Infrastructure as Code
  /k8s/               # Kubernetes manifests
  /docker/            # Dockerfiles
  /scripts/           # Automation scripts

# Secrets in encrypted vault
/secrets/
  .env.production.encrypted  # Encrypted with GPG
  vault-keys.txt.encrypted
```

**Backup workflow configs:**
```bash
# Export n8n workflows weekly
n8n export:workflow --all --output=./n8n/backups/workflows_$(date +%Y%m%d).json
git add n8n/backups/
git commit -m "backup: n8n workflows $(date +%Y%m%d)"
git push
```

---

### 13.3. Disaster Scenarios & Recovery Procedures

#### Scenario 1: Complete Database Loss

**Probability:** Very Low (Supabase has multi-region backups)
**Impact:** Critical (data loss)

**Recovery Steps:**

```bash
# Step 1: Create new Supabase project (or use failover)
# Time: 5 minutes

# Step 2: Restore latest backup
LATEST_BACKUP=$(aws s3 ls s3://coffeereader-backups/db/ | sort | tail -n1 | awk '{print $4}')
aws s3 cp s3://coffeereader-backups/db/$LATEST_BACKUP ./
gunzip $LATEST_BACKUP

# Step 3: Import to new database
psql $NEW_DATABASE_URL < ${LATEST_BACKUP%.gz}
# Time: 10-20 minutes depending on size

# Step 4: Verify data integrity
psql $NEW_DATABASE_URL -c "SELECT COUNT(*) FROM users;"
psql $NEW_DATABASE_URL -c "SELECT MAX(created_at) FROM analysis_history;"
# Time: 2 minutes

# Step 5: Update environment variables
railway variables set DATABASE_URL=$NEW_DATABASE_URL
vercel env add DATABASE_URL $NEW_DATABASE_URL production
# Time: 2 minutes

# Step 6: Restart all services
railway service restart api
railway service restart worker
# Time: 5 minutes

# Step 7: Verify system health
curl https://api.coffeereader.com/health
# Time: 1 minute

# Total RTO: ~30 minutes
# Data loss: Last 5 minutes (RPO)
```

**Data Loss Assessment:**
```bash
# Compare last backup timestamp with current time
BACKUP_TIMESTAMP=$(psql -t -c "SELECT MAX(created_at) FROM analysis_history;")
CURRENT_TIME=$(date -u +%s)
BACKUP_TIME=$(date -d "$BACKUP_TIMESTAMP" +%s)
DATA_LOSS_MINUTES=$(( ($CURRENT_TIME - $BACKUP_TIME) / 60 ))

echo "Potential data loss: $DATA_LOSS_MINUTES minutes"
# Expected: 5-15 minutes
```

---

#### Scenario 2: API Service Outage

**Probability:** Medium (hosting provider issues)
**Impact:** High (user-facing downtime)

**Detection:**
```yaml
# Uptime Robot alert triggers immediately
# Sentry error rate spike alert
# Prometheus alert: up{job="api"} == 0
```

**Recovery Steps:**

```bash
# Step 1: Check service status
railway status --service api
# Time: 30 seconds

# Step 2: Check logs for errors
railway logs --service api --tail 100
# Time: 1 minute

# Step 3: Rollback if bad deployment
railway rollback --service api
# Time: 2 minutes

# Step 4: If hosting issue, failover to backup region
# (Requires pre-configured secondary Railway project)
cloudflare dns update api.coffeereader.com \
  --type CNAME \
  --content backup-api.coffeereader.com
# Time: 2 minutes (DNS propagation)

# Step 5: Scale up if needed
railway service scale api --replicas 4
# Time: 3 minutes

# Total RTO: ~10 minutes
```

**Automated Failover (Future Enhancement):**
```javascript
// Cloudflare Worker for automatic failover
addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request))
})

async function handleRequest(request) {
  const primaryAPI = 'https://primary-api.railway.app'
  const secondaryAPI = 'https://secondary-api.railway.app'

  try {
    const response = await fetch(primaryAPI + new URL(request.url).pathname, {
      timeout: 5000,
    })

    if (response.ok) return response
    throw new Error('Primary API unhealthy')

  } catch (error) {
    // Automatic failover to secondary
    return await fetch(secondaryAPI + new URL(request.url).pathname)
  }
}
```

---

#### Scenario 3: Redis (Queue) Failure

**Probability:** Low (Upstash has high availability)
**Impact:** Medium (jobs lost, but can requeue)

**Recovery Steps:**

```bash
# Step 1: Provision new Redis instance
# Upstash dashboard or Terraform:
terraform apply -target=upstash_redis_database.main
# Time: 3 minutes

# Step 2: Update Redis URL in all services
railway variables set REDIS_URL=$NEW_REDIS_URL
# Time: 2 minutes

# Step 3: Restart services
railway service restart api
railway service restart worker
# Time: 5 minutes

# Step 4: Requeue pending analyses
# (Users whose analyses were in-flight need to retry)
node scripts/requeue-failed-analyses.js
# Time: 5 minutes

# Total RTO: ~15 minutes
# Data loss: In-flight jobs (users can retry)
```

**Mitigation:**
```javascript
// Persistent queue backup (future)
// Periodically save queue state to PostgreSQL

async function backupQueueState() {
  const waitingJobs = await queue.getWaiting();
  const activeJobs = await queue.getActive();

  await db.query(
    'INSERT INTO queue_backup (job_data, created_at) VALUES ($1, NOW())',
    [JSON.stringify([...waitingJobs, ...activeJobs])]
  );
}

// Run every 5 minutes
setInterval(backupQueueState, 5 * 60 * 1000);
```

---

#### Scenario 4: n8n Workflow Failure

**Probability:** Medium (manual changes can break workflows)
**Impact:** Low-Medium (bot stops responding)

**Recovery Steps:**

```bash
# Step 1: Restore last working workflow from Git
cd n8n/workflows
git log --oneline workflows.json
git checkout HEAD~1 workflows.json
# Time: 1 minute

# Step 2: Import to n8n
n8n import:workflow --input=workflows.json
# Time: 2 minutes

# Step 3: Activate workflow
curl -X POST https://n8n.coffeereader.com/api/v1/workflows/1/activate \
  -H "Authorization: Bearer $N8N_API_KEY"
# Time: 30 seconds

# Step 4: Test with sample message
# Send test message to Telegram bot
# Time: 1 minute

# Total RTO: ~5 minutes
```

**Prevention:**
```bash
# Git pre-commit hook for n8n workflows
#!/bin/bash
# .git/hooks/pre-commit

# Validate workflow JSON
node scripts/validate-n8n-workflow.js n8n/workflows/main.json

if [ $? -ne 0 ]; then
  echo "ERROR: n8n workflow validation failed"
  exit 1
fi
```

---

#### Scenario 5: Complete Infrastructure Loss (Catastrophic)

**Probability:** Very Low (multiple providers would need to fail)
**Impact:** Critical (complete service outage)

**Recovery Steps (Cold Start):**

```bash
# Estimated Total Time: 2-4 hours

# Step 1: Provision new infrastructure
cd infrastructure/terraform
terraform init
terraform plan
terraform apply
# Time: 30 minutes

# Step 2: Restore database from offsite backup
aws s3 cp s3://coffeereader-backups-r2/db/latest.sql.gz ./
gunzip latest.sql.gz
psql $NEW_DATABASE_URL < latest.sql
# Time: 30 minutes

# Step 3: Deploy applications
git clone https://github.com/coffeereader/backend
cd backend

# Deploy API
railway up --service api
# Time: 10 minutes

# Deploy Workers
railway up --service worker
# Time: 10 minutes

# Deploy n8n
railway up --service n8n
# Import workflows from Git
# Time: 15 minutes

# Deploy Mini App
cd ../mini-app
vercel --prod
# Time: 5 minutes

# Step 4: Configure DNS
cloudflare dns create api.coffeereader.com \
  --type CNAME \
  --content [railway-url]
cloudflare dns create app.coffeereader.com \
  --type CNAME \
  --content [vercel-url]
# Time: 5 minutes (+ DNS propagation 5-60 min)

# Step 5: Restore Redis data (if needed)
# Usually not needed - queue can start fresh
# Time: 5 minutes

# Step 6: Smoke tests
k6 run tests/smoke.js
# Time: 2 minutes

# Step 7: Notify users
# Send Telegram broadcast: "Service restored"
# Time: 5 minutes

# Total RTO: 2-4 hours (including DNS propagation)
# RPO: 15 minutes (last backup)
```

---

### 13.4. Incident Response Runbook

#### On-Call Rotation

```
Primary: CTO / Tech Lead
Secondary: Senior Backend Engineer
Tertiary: DevOps Engineer

Schedule: Weekly rotation
Tool: PagerDuty / OpsGenie
```

#### Alert Levels

| Level | Response Time | Examples |
|-------|---------------|----------|
| P0 (Critical) | 15 minutes | API down, database corruption |
| P1 (High) | 1 hour | High error rate, payment failures |
| P2 (Medium) | 4 hours | Queue backlog, slow queries |
| P3 (Low) | Next business day | Minor bugs, optimization |

#### Incident Response Process

```
1. ACKNOWLEDGE (within 15 min for P0)
   - Acknowledge alert in PagerDuty
   - Post in #incidents Slack channel
   - Start incident timer

2. ASSESS (within 15 min)
   - Check monitoring dashboards
   - Review error logs (Sentry, CloudWatch)
   - Identify affected services
   - Estimate impact (% users affected)

3. COMMUNICATE (within 30 min)
   - Update status page (status.coffeereader.com)
   - Post in #incidents with initial findings
   - Notify stakeholders if major incident

4. MITIGATE (within 1 hour for P0)
   - Execute relevant recovery procedure (see above)
   - Document all actions taken
   - Get service to partial or full availability

5. RESOLVE
   - Verify all systems healthy
   - Run smoke tests
   - Monitor for 30 minutes

6. POST-MORTEM (within 48 hours)
   - Write incident report
   - Identify root cause
   - Action items to prevent recurrence
   - Update runbook if needed
```

#### Communication Templates

**Status Page Update:**
```
🔴 [Investigating] We're currently investigating issues with coffee analysis.
   Users may experience delays. We'll update as soon as we know more.

   Started: 2025-10-13 14:32 UTC
   Affected: Analysis API
```

**Slack Incident Alert:**
```
🚨 INCIDENT: API Down (P0)

Status: Investigating
Started: 14:32 UTC
Affected: api.coffeereader.com
Impact: 100% of users cannot analyze photos
On-call: @john (primary), @sarah (secondary)

Dashboard: https://grafana.coffeereader.com/incident-123
Sentry: https://sentry.io/coffeereader/errors
```

**Resolution Message:**
```
✅ [Resolved] The issue with coffee analysis has been resolved.
   All systems are operating normally.

   Duration: 23 minutes
   Root cause: Database connection pool exhaustion
   Fix: Increased pool size from 20 to 50

   Resolved: 2025-10-13 14:55 UTC
```

---

### 13.5. Disaster Recovery Testing

**Schedule:**

| Test Type | Frequency | Scope |
|-----------|-----------|-------|
| Database restore | Monthly | Restore from backup to staging |
| Failover drill | Quarterly | Switch to backup infrastructure |
| Full DR test | Annually | Complete infrastructure rebuild |
| Runbook review | Quarterly | Walk through procedures |

**DR Test Checklist:**

```markdown
## Monthly Database Restore Test

- [ ] Download latest backup from S3
- [ ] Restore to test database
- [ ] Verify record counts match production
- [ ] Run data integrity checks
- [ ] Test application against restored DB
- [ ] Document restore time (should be < 30 min)
- [ ] Update runbook if issues found

## Quarterly Failover Drill

- [ ] Announce planned test to team
- [ ] Trigger manual failover to secondary region
- [ ] Verify DNS switches correctly
- [ ] Run smoke tests against failover
- [ ] Measure RTO (should be < 1 hour)
- [ ] Switch back to primary
- [ ] Document lessons learned

## Annual Full DR Test

- [ ] Schedule maintenance window (e.g., Sunday 3am)
- [ ] Simulate complete infrastructure loss
- [ ] Execute cold start procedure
- [ ] Measure total RTO
- [ ] Verify all services healthy
- [ ] Test with real users (alpha testers)
- [ ] Document gaps in runbook
- [ ] Update DR plan
```

---

### 13.6. Data Retention Policy

| Data Type | Retention Period | Backup Frequency | Deletion Method |
|-----------|------------------|------------------|-----------------|
| User profiles | Active + 12 months after deletion | Daily | Soft delete, then hard delete |
| Analysis history | Active + 12 months | Daily | Archive to cold storage, then delete |
| Payment records | 7 years (legal requirement) | Daily | Never delete (anonymize after user deletion) |
| Audit logs | 90 days | Daily | Rolling deletion |
| Images (S3) | Analysis + 30 days | Versioned | Lifecycle policy |
| Message context | Last 20 messages | Daily | Auto-pruned by trigger |
| Error logs | 30 days | Continuous | Log rotation |
| Metrics | 90 days (detailed), 2 years (aggregated) | Continuous | Prometheus retention |

---

### 13.7. Contact Information (Emergency)

```
PRIMARY ON-CALL:
  Name: [CTO Name]
  Phone: +7-XXX-XXX-XXXX
  Telegram: @cto_username
  Email: cto@coffeereader.com

SECONDARY ON-CALL:
  Name: [Tech Lead Name]
  Phone: +7-XXX-XXX-XXXX
  Telegram: @techlead_username
  Email: tech@coffeereader.com

VENDORS:
  Supabase Support: support@supabase.com (Pro plan includes priority)
  Railway Support: help@railway.app
  Upstash Support: support@upstash.com
  OpenRouter: support@openrouter.ai

ESCALATION:
  CEO: ceo@coffeereader.com
  Legal: legal@coffeereader.com
  PR/Communications: pr@coffeereader.com
```

---

## 14. Migration Strategy (Pre-MVP to MVP)

### 14.1. Current State Analysis (Pre-MVP)

Based on `coffee-reader-pre-mvp.md`:

**What exists:**
```
✅ n8n workflow handling Telegram messages
✅ OpenRouter integration (vision + text models)
✅ Image processing (download, resize to 800x800)
✅ AI prompts (vision analysis + "Arina" agents)
✅ HTML formatting and chunking
✅ Typing indicators and delays
✅ PostgreSQL memory (20 message window)
✅ Basic flow: photo → AI analysis → formatted response
```

**What's missing:**
```
❌ User management (no persistent users table)
❌ Subscription/billing logic
❌ Limit enforcement
❌ Payment integrations
❌ Analysis history storage
❌ Mini App
❌ API for external access
❌ Monitoring and alerting
❌ Proper error handling
❌ Security (secrets in workflow, no encryption)
❌ Scalability (single n8n instance)
```

---

### 14.2. Migration Strategy Overview

**Approach: Parallel Run + Gradual Cutover**

```
Phase 1: Build MVP alongside Pre-MVP (Weeks 1-4)
Phase 2: Internal testing (Week 5)
Phase 3: Beta migration (selected users) (Week 6)
Phase 4: Full migration (all users) (Week 7)
Phase 5: Deprecate Pre-MVP (Week 8)
```

**Why parallel run?**
- ✅ Zero downtime migration
- ✅ A/B testing possible
- ✅ Easy rollback if issues
- ✅ Gradual user migration reduces risk

---

### 14.3. Phase 1: Build MVP (Weeks 1-4)

**Goal:** Build production-ready MVP without disrupting Pre-MVP users.

**Architecture Changes:**

```
Before (Pre-MVP):
Telegram → n8n → OpenRouter → n8n → Telegram
               ↓
         PostgreSQL (memory only)

After (MVP):
Telegram → n8n → Backend API → Queue → Workers → OpenRouter
               ↘             ↓                  ↗
                  PostgreSQL (full schema)
                       ↓
                  Supabase Storage
```

**Step-by-step:**

#### Week 1: Infrastructure Setup

```bash
# 1. Create new Supabase project (don't touch Pre-MVP DB)
supabase projects create coffeereader-mvp --region us-east-1

# 2. Deploy database schema
psql $NEW_SUPABASE_URL < docs/schema.sql

# 3. Set up Railway projects
railway init --name coffeereader-api
railway init --name coffeereader-worker

# 4. Deploy Redis (Upstash)
upstash-cli create coffeereader-redis --region us-east-1

# 5. Set up S3 bucket for images
supabase storage buckets create coffee-images --public false
```

#### Week 2: Backend API Development

```bash
# Clone repo and create MVP branch
git checkout -b mvp-migration

# Develop core API
src/
  api/
    controllers/
      analysis.controller.ts    # POST /analyses
      user.controller.ts         # GET /users/me
    services/
      analysis.service.ts
      ai.service.ts             # Wrap OpenRouter
    repositories/
      user.repo.ts
      analysis.repo.ts

# Key: Re-use existing AI prompts from Pre-MVP
# Copy prompts from n8n workflow to config files
cp n8n/workflows/main.json config/ai-prompts.json
node scripts/extract-prompts.js
```

**Prompt Migration Script:**

```javascript
// scripts/extract-prompts.js
// Extract AI prompts from Pre-MVP n8n workflow

const fs = require('fs');

const n8nWorkflow = JSON.parse(fs.readFileSync('n8n/workflows/main.json'));

// Find vision analysis prompt
const visionNode = n8nWorkflow.nodes.find(n => n.name === 'Vision Analysis');
const visionPrompt = visionNode.parameters.prompt;

// Find "Arina writer" prompt
const arinaWriterNode = n8nWorkflow.nodes.find(n => n.name === 'Arina Writer');
const arinaPrompt = arinaWriterNode.parameters.systemMessage;

// Save to config
const config = {
  vision: {
    model: 'deepcogito/cogito-v2-preview-llama-109b-moe',
    prompt: visionPrompt,
  },
  text: {
    writer: {
      model: 'qwen/qwen-2.5-72b-instruct',
      systemMessage: arinaPrompt,
    },
    answerer: {
      model: 'qwen/qwen-2.5-72b-instruct',
      systemMessage: arinaAnswererNode.parameters.systemMessage,
    },
  },
};

fs.writeFileSync('config/ai-prompts.json', JSON.stringify(config, null, 2));
console.log('✅ Prompts extracted to config/ai-prompts.json');
```

#### Week 3: Worker Development + Queue

```typescript
// services/worker/src/jobs/analysis.job.ts

import { Job } from 'bullmq';
import { analyzeImage } from '../ai/analyzer';

export async function processAnalysisJob(job: Job) {
  const { user_id, image_url, focus_area } = job.data;

  // Re-use exact same logic as Pre-MVP
  // 1. Download image (already resized and stored)
  // 2. Call vision API (same prompt)
  const visionResult = await analyzeImage(image_url);

  // 3. Call text generation (Arina)
  const interpretation = await generateInterpretation(visionResult, focus_area);

  // 4. Format HTML (same chunking logic)
  const formattedResponse = formatResponse(interpretation);

  // 5. Save to database
  await db.analysis_history.create({
    user_id,
    image_url,
    focus_area,
    analysis: formattedResponse,
  });

  // 6. Notify n8n to send result
  await notifyN8n({
    user_id,
    analysis: formattedResponse,
  });
}
```

**Key: Re-use Pre-MVP code as much as possible**

#### Week 4: n8n Integration Layer

```
Goal: Make n8n call new API instead of doing everything itself

New n8n workflow:
1. Receive Telegram message
2. Call API: POST /api/v1/analyses (with image)
3. API returns 202 Accepted
4. Send "Analysis started" to user
5. Wait for webhook callback from Worker
6. Format and send final result to Telegram

Old n8n workflow (keep running):
1. Receive Telegram message
2. Download image
3. Resize image
4. Call vision API
5. Call text API
6. Format HTML
7. Send to Telegram
```

**Dual n8n workflows:**

```javascript
// n8n/workflows/mvp-telegram-bot.json

{
  "nodes": [
    {
      "name": "Telegram Webhook",
      "type": "n8n-nodes-base.telegramTrigger",
      "parameters": {
        "updates": ["message"]
      }
    },
    {
      "name": "Route: Image or Text",
      "type": "n8n-nodes-base.switch",
      "parameters": {
        "rules": [
          { "condition": "photo", "output": 1 },
          { "condition": "text", "output": 2 }
        ]
      }
    },
    {
      "name": "Call API - Create Analysis",
      "type": "n8n-nodes-base.httpRequest",
      "parameters": {
        "url": "https://api.coffeereader.com/v1/analyses",
        "method": "POST",
        "bodyParameters": {
          "telegram_user_id": "={{ $json.from.id }}",
          "message_id": "={{ $json.message_id }}",
          "image_url": "={{ $json.photo[0].file_id }}",
          "focus_area": "general"
        }
      }
    },
    {
      "name": "Send 'Analysis Started'",
      "type": "n8n-nodes-base.telegram",
      "parameters": {
        "chatId": "={{ $json.chat.id }}",
        "text": "🔮 Analyzing your coffee cup... This will take ~30 seconds."
      }
    },
    {
      "name": "Webhook - Analysis Complete",
      "type": "n8n-nodes-base.webhook",
      "parameters": {
        "path": "analysis-complete",
        "httpMethod": "POST"
      }
    },
    {
      "name": "Format Result",
      "type": "n8n-nodes-base.code",
      "parameters": {
        "jsCode": "// Re-use existing HTML formatting code\nreturn formatAnalysisResponse($input.all());"
      }
    },
    {
      "name": "Send Result to Telegram",
      "type": "n8n-nodes-base.telegram",
      "parameters": {
        "chatId": "={{ $json.chat_id }}",
        "text": "={{ $json.formatted_analysis }}",
        "parseMode": "HTML"
      }
    }
  ]
}
```

---

### 14.4. Phase 2: Internal Testing (Week 5)

**Goal:** Test MVP with internal team before exposing to users.

**Test Accounts:**

```sql
-- Create test users in MVP database
INSERT INTO users (telegram_id, username, first_name)
VALUES
  (123456, 'test_cto', 'CTO Test'),
  (234567, 'test_dev', 'Dev Test'),
  (345678, 'test_qa', 'QA Test');

-- Give them Trial subscriptions
INSERT INTO subscriptions (user_id, tier, status, trial_ends_at)
SELECT id, 'TRIAL', 'active', NOW() + INTERVAL '7 days'
FROM users WHERE username LIKE 'test_%';
```

**Testing Checklist:**

```markdown
## MVP Testing (Internal)

### Bot Functionality
- [ ] Send photo → Receive analysis (compare with Pre-MVP quality)
- [ ] Send text → Receive response
- [ ] Check typing indicators work
- [ ] Verify HTML formatting is correct
- [ ] Test chunking for long responses
- [ ] Test error cases (bad image, API timeout)

### API Testing
- [ ] GET /users/me returns correct data
- [ ] POST /analyses accepts image and returns 202
- [ ] GET /analyses returns history
- [ ] POST /subscriptions/purchase works
- [ ] Webhooks process correctly (Telegram Stars test payment)

### Database
- [ ] Users are created automatically
- [ ] Analysis history saves correctly
- [ ] Message context stores last 20 messages
- [ ] Usage limits increment
- [ ] Subscriptions activate after payment

### Performance
- [ ] Analysis completes in <30 seconds
- [ ] Queue doesn't back up (test 10 concurrent analyses)
- [ ] API responds in <3 seconds

### AI Quality
- [ ] Compare 20 analyses side-by-side (Pre-MVP vs MVP)
- [ ] Ensure prompts produce same quality results
- [ ] Check for any regressions

### Edge Cases
- [ ] What if OpenRouter is down? (fallback works)
- [ ] What if database is slow? (timeouts handled)
- [ ] What if Redis crashes? (queue recovers)
- [ ] What if user spams requests? (rate limiting)
```

**Comparison Testing:**

```bash
# Test same image in both systems
curl -X POST https://pre-mvp-n8n.com/webhook \
  -F "image=@test-coffee-cup.jpg" \
  > pre-mvp-result.json

curl -X POST https://api.coffeereader.com/v1/analyses \
  -H "X-Telegram-Init-Data: $TEST_TOKEN" \
  -F "image=@test-coffee-cup.jpg" \
  > mvp-result.json

# Compare results
diff <(jq -S . pre-mvp-result.json) <(jq -S . mvp-result.json)
```

---

### 14.5. Phase 3: Beta Migration (Week 6)

**Goal:** Migrate 10% of users to MVP, monitor for issues.

**Selection Criteria for Beta Users:**

```sql
-- Select beta users (active, low-risk)
SELECT * FROM pre_mvp_users
WHERE
  last_active > NOW() - INTERVAL '7 days'  -- Active users
  AND analysis_count BETWEEN 5 AND 50      -- Not too new, not power users
ORDER BY RANDOM()
LIMIT 100;
```

**Migration Process:**

```typescript
// scripts/migrate-beta-users.ts

async function migrateBetaUsers() {
  const betaUsers = await getSelectedBetaUsers();

  for (const user of betaUsers) {
    // 1. Create user in MVP database
    const mvpUser = await db.users.create({
      telegram_id: user.telegram_id,
      username: user.username,
      first_name: user.first_name,
      created_at: user.created_at, // Preserve original date
    });

    // 2. Migrate analysis history (last 30 days only for beta)
    const recentAnalyses = await getRecentAnalyses(user.id, 30);
    for (const analysis of recentAnalyses) {
      await db.analysis_history.create({
        user_id: mvpUser.id,
        created_at: analysis.created_at,
        analysis: analysis.result,
        focus_area: 'general',
        // Note: Pre-MVP didn't store images, so image_url will be null
      });
    }

    // 3. Create subscription (match their current status)
    await db.subscriptions.create({
      user_id: mvpUser.id,
      tier: user.subscription_tier || 'FREE',
      status: 'active',
    });

    // 4. Add to beta flag (for routing)
    await redis.set(`beta_user:${user.telegram_id}`, '1', 'EX', 30 * 24 * 3600);

    console.log(`✅ Migrated user ${user.telegram_id}`);
  }

  console.log(`🎉 Migrated ${betaUsers.length} beta users`);
}
```

**Traffic Routing (n8n):**

```javascript
// n8n workflow: Route to MVP or Pre-MVP based on beta flag

{
  "name": "Check Beta Flag",
  "type": "n8n-nodes-base.redis",
  "parameters": {
    "operation": "get",
    "key": "=beta_user:{{ $json.from.id }}"
  }
},
{
  "name": "Route",
  "type": "n8n-nodes-base.if",
  "parameters": {
    "conditions": {
      "string": [
        {
          "value1": "={{ $json }}",
          "operation": "equals",
          "value2": "1"
        }
      ]
    }
  },
  "routing": {
    "true": "Call MVP API",
    "false": "Continue with Pre-MVP workflow"
  }
}
```

**Monitoring During Beta:**

```bash
# Real-time monitoring
watch -n 5 'redis-cli GET beta_user_analysis_count'

# Compare error rates
echo "Pre-MVP errors (last hour):"
psql -c "SELECT COUNT(*) FROM pre_mvp_logs WHERE level='error' AND created_at > NOW() - INTERVAL '1 hour';"

echo "MVP errors (last hour):"
curl https://api.coffeereader.com/metrics | grep 'error_total'

# User feedback
echo "Beta user feedback:"
psql -c "SELECT AVG(user_rating), COUNT(*) FROM analysis_history WHERE user_id IN (SELECT id FROM beta_users);"
```

---

### 14.6. Phase 4: Full Migration (Week 7)

**Goal:** Migrate all remaining users to MVP.

**Go/No-Go Decision Criteria:**

```markdown
✅ Beta phase success metrics:
- [ ] <1% increase in error rate vs Pre-MVP
- [ ] Analysis quality maintained (avg rating ≥ same as Pre-MVP)
- [ ] Performance within SLA (p95 < 30s)
- [ ] No critical bugs reported
- [ ] Positive feedback from beta users

❌ Abort criteria (roll back to Pre-MVP):
- [ ] >5% error rate increase
- [ ] Critical bug affecting >10% of users
- [ ] Significant quality regression
- [ ] Performance degradation >50%
```

**Full Migration Script:**

```typescript
// scripts/migrate-all-users.ts

async function migrateAllUsers() {
  console.log('🚀 Starting full migration...');

  // Get all users from Pre-MVP
  const allUsers = await fetchAllPreMVPUsers();
  console.log(`Found ${allUsers.length} users to migrate`);

  // Migrate in batches (1000 at a time)
  const BATCH_SIZE = 1000;
  for (let i = 0; i < allUsers.length; i += BATCH_SIZE) {
    const batch = allUsers.slice(i, i + BATCH_SIZE);

    await Promise.all(batch.map(async (user) => {
      try {
        await migrateUser(user);
      } catch (error) {
        console.error(`Failed to migrate user ${user.telegram_id}:`, error);
        // Log to separate error table for retry
        await logMigrationError(user.id, error);
      }
    }));

    console.log(`✅ Migrated batch ${i / BATCH_SIZE + 1} (${Math.min(i + BATCH_SIZE, allUsers.length)}/${allUsers.length})`);

    // Sleep between batches to avoid overwhelming DB
    await sleep(5000);
  }

  console.log('🎉 Migration complete!');

  // Verify
  const mvpUserCount = await db.users.count();
  const preMVPUserCount = await fetchPreMVPUserCount();

  if (mvpUserCount >= preMVPUserCount * 0.95) {
    console.log(`✅ Migration verified: ${mvpUserCount} / ${preMVPUserCount} users`);
  } else {
    console.warn(`⚠️ User count mismatch! MVP: ${mvpUserCount}, Pre-MVP: ${preMVPUserCount}`);
  }
}

async function migrateUser(preMVPUser: any) {
  // 1. Create in MVP DB
  const mvpUser = await db.users.upsert({
    telegram_id: preMVPUser.telegram_id,
    username: preMVPUser.username,
    first_name: preMVPUser.first_name,
    created_at: preMVPUser.created_at,
  });

  // 2. Migrate FULL analysis history (for paying users)
  if (preMVPUser.subscription_tier !== 'FREE') {
    await migrateAnalysisHistory(preMVPUser.id, mvpUser.id);
  }

  // 3. Migrate subscription
  await migrateSubscription(preMVPUser.id, mvpUser.id);

  // 4. Mark as migrated in Pre-MVP DB
  await markAsMigrated(preMVPUser.id);
}
```

**Gradual Traffic Shift:**

```javascript
// n8n: Gradually shift traffic from Pre-MVP to MVP

// Week 7, Day 1: 10% to MVP (beta users)
// Week 7, Day 2: 25% to MVP
// Week 7, Day 3: 50% to MVP
// Week 7, Day 4: 75% to MVP
// Week 7, Day 5: 90% to MVP
// Week 7, Day 6: 100% to MVP

const MIGRATION_PERCENTAGE = process.env.MVP_TRAFFIC_PERCENTAGE || 100;

function shouldUseMVP(userId: number): boolean {
  // Check if beta user
  if (await redis.exists(`beta_user:${userId}`)) {
    return true;
  }

  // Gradually roll out to everyone
  const hash = hashCode(userId.toString());
  return (hash % 100) < MIGRATION_PERCENTAGE;
}

function hashCode(str: string): number {
  return str.split('').reduce((acc, char) => {
    return ((acc << 5) - acc) + char.charCodeAt(0);
  }, 0);
}
```

**Monitor Dashboard:**

```
Real-time Migration Dashboard:
┌──────────────────────────────────────────────────────────┐
│ Symancy Migration Status                            │
├──────────────────────────────────────────────────────────┤
│ Total Users:              10,542                         │
│ Migrated to MVP:          10,215  (96.9%)                │
│ Still on Pre-MVP:            327  (3.1%)                 │
│ Failed Migrations:            42  (0.4%)                 │
│                                                           │
│ Traffic Split:                                           │
│ MVP:    ████████████████████████░░░░  90%                │
│ Pre-MVP: ██░░░░░░░░░░░░░░░░░░░░░░░░  10%                │
│                                                           │
│ MVP Performance (last 1h):                               │
│ - Analyses: 1,234                                        │
│ - Avg Time: 24.3s (✅ target: <30s)                     │
│ - Error Rate: 0.4% (✅ target: <1%)                     │
│ - P95 Latency: 28.1s                                     │
│                                                           │
│ Pre-MVP Performance (last 1h):                           │
│ - Analyses: 123                                          │
│ - Avg Time: 26.7s                                        │
│ - Error Rate: 0.6%                                       │
└──────────────────────────────────────────────────────────┘
```

---

### 14.7. Phase 5: Deprecate Pre-MVP (Week 8)

**Goal:** Safely shut down Pre-MVP infrastructure.

**Pre-Shutdown Checklist:**

```markdown
- [ ] 100% of users migrated to MVP
- [ ] Zero failed migrations
- [ ] MVP running stable for 7 days (99.5% uptime)
- [ ] All critical metrics within SLA
- [ ] No open P0/P1 incidents
- [ ] Final backup of Pre-MVP data
- [ ] Archive Pre-MVP workflows to Git
```

**Shutdown Procedure:**

```bash
# Day 1: Read-only mode
# Update Pre-MVP n8n to reject new analyses
# "⚠️ System is in maintenance mode. Please try again in 1 hour."

# Day 2: Final data export
node scripts/export-pre-mvp-data.js > pre-mvp-final-export.json

# Verify export
echo "Total users in export:"
jq '.users | length' pre-mvp-final-export.json

echo "Total analyses in export:"
jq '.analyses | length' pre-mvp-final-export.json

# Upload to archive
aws s3 cp pre-mvp-final-export.json s3://coffeereader-archives/pre-mvp/

# Day 3: Stop Pre-MVP services
n8n stop
docker-compose down

# Day 4: Archive infrastructure
# Keep for 30 days in case rollback needed
# Then delete

# Day 5: DNS cleanup
# Remove any Pre-MVP endpoints
cloudflare dns delete pre-mvp.coffeereader.com

# Day 6: Celebrate! 🎉
echo "🎉 Migration complete! MVP is now 100% of traffic."
```

---

### 14.8. Rollback Plan (If Things Go Wrong)

**Triggers for rollback:**

```
- Critical bug affecting >10% of users
- Data corruption or loss detected
- Performance degradation >50%
- Error rate >5%
- Payment system failures
```

**Rollback Procedure (Emergency):**

```bash
# Step 1: Immediate traffic switch (< 5 minutes)
# Update n8n to route 100% to Pre-MVP
railway env set MVP_TRAFFIC_PERCENTAGE=0

# Step 2: Investigate issue
# - Check Sentry errors
# - Review logs
# - Database integrity check

# Step 3: Fix or rollback code
git revert HEAD
railway rollback --service api

# Step 4: Communicate
# - Update status page
# - Notify users if needed
# - Post-mortem after resolved

# Step 5: When ready to retry
# - Fix root cause
# - Test thoroughly in staging
# - Gradual rollout again (10% → 25% → 50% → 100%)
```

---

### 14.9. Data Consistency Verification

**Post-Migration Audit:**

```sql
-- Verify user counts match
SELECT
  (SELECT COUNT(*) FROM pre_mvp.users) AS pre_mvp_count,
  (SELECT COUNT(*) FROM mvp.users) AS mvp_count,
  (SELECT COUNT(*) FROM mvp.users) - (SELECT COUNT(*) FROM pre_mvp.users) AS difference;

-- Verify paying users migrated
SELECT
  u.telegram_id,
  u.username,
  pre.subscription_tier AS pre_mvp_tier,
  s.tier AS mvp_tier
FROM pre_mvp.users pre
LEFT JOIN mvp.users u ON u.telegram_id = pre.telegram_id
LEFT JOIN mvp.subscriptions s ON s.user_id = u.id
WHERE pre.subscription_tier != 'FREE'
  AND (s.tier IS NULL OR s.tier != pre.subscription_tier);

-- Find users who were active in Pre-MVP but not migrated
SELECT *
FROM pre_mvp.users pre
WHERE pre.last_active > NOW() - INTERVAL '30 days'
  AND NOT EXISTS (
    SELECT 1 FROM mvp.users mvp
    WHERE mvp.telegram_id = pre.telegram_id
  );
```

---

### 14.10. Migration Timeline Summary

```
WEEK 1-4: Build MVP (parallel to Pre-MVP)
├─ Week 1: Infrastructure (Supabase, Railway, Redis)
├─ Week 2: Backend API (re-use Pre-MVP prompts)
├─ Week 3: Workers + Queue
└─ Week 4: n8n integration layer

WEEK 5: Internal Testing
└─ 20+ test scenarios, compare with Pre-MVP

WEEK 6: Beta Migration (10% of users)
└─ Monitor metrics, collect feedback

WEEK 7: Full Migration (90% → 100%)
├─ Day 1: 10% → 25%
├─ Day 2: 25% → 50%
├─ Day 3: 50% → 75%
├─ Day 4: 75% → 90%
└─ Day 5-7: 90% → 100%

WEEK 8: Deprecate Pre-MVP
└─ Archive data, shut down services

TOTAL DURATION: 8 weeks (2 months)
RISK: Low (parallel run + gradual rollout)
DOWNTIME: Zero (seamless migration)
```

---

## Appendix: Development Checklist

### Pre-Development Setup

```markdown
- [ ] PostgreSQL schema deployed to Supabase
- [ ] Redis instance provisioned (Upstash)
- [ ] GitHub repo created with branch protection
- [ ] CI/CD pipeline configured (GitHub Actions)
- [ ] Sentry project created
- [ ] Posthog account set up
- [ ] Railway projects created (api, worker, n8n)
- [ ] Vercel project created (mini-app)
- [ ] Environment variables configured
- [ ] Docker Compose working locally
- [ ] OpenAPI spec reviewed and approved
- [ ] n8n workflows exported to Git
```

### Code Quality Checklist

```markdown
- [ ] ESLint configured
- [ ] Prettier configured
- [ ] Husky pre-commit hooks
- [ ] TypeScript strict mode enabled
- [ ] All functions have JSDoc comments
- [ ] All API endpoints have OpenAPI documentation
- [ ] Error codes documented
- [ ] Logging implemented (Pino)
- [ ] Metrics instrumented (Prometheus)
- [ ] Sentry integrated
```

### Testing Checklist

```markdown
- [ ] Unit tests for business logic (>70% coverage)
- [ ] Integration tests for API endpoints
- [ ] Integration tests for payment webhooks
- [ ] E2E tests for critical flows
- [ ] Load tests (k6) - 200 concurrent users
- [ ] AI prompt testing (20 sample images)
- [ ] Telegram bot manual testing
- [ ] Mini App cross-browser testing
```

### Security Checklist

```markdown
- [ ] All secrets in environment variables
- [ ] TLS 1.3 enforced
- [ ] CORS configured correctly
- [ ] CSP headers set
- [ ] Rate limiting tested
- [ ] SQL injection prevention verified
- [ ] XSS protection tested
- [ ] CSRF tokens for forms
- [ ] Telegram WebApp data validation
- [ ] Payment webhook signature verification
- [ ] Row Level Security (RLS) policies tested
- [ ] GDPR data export implemented
- [ ] GDPR data deletion implemented
```

### Deployment Checklist

```markdown
- [ ] Staging environment deployed
- [ ] Production environment deployed
- [ ] Database migrations run
- [ ] Monitoring alerts configured
- [ ] Backup strategy tested
- [ ] Rollback procedure documented
- [ ] Incident response plan created
- [ ] Load balancer health checks verified
- [ ] DNS configured (Cloudflare)
- [ ] SSL certificates valid
```

---

**Document Status:** Draft for Review
**Next Review:** 2025-10-20
**Approvers:** CTO, Tech Lead, Senior Engineers

---

**END OF TECHNICAL DESIGN DOCUMENT**
