# Data Model: Pre-MVP Payment Integration

**Feature**: 002-pre-mvp-payments
**Date**: 2025-11-23
**Database**: Supabase PostgreSQL

## Entity Relationship Diagram

```
┌─────────────────────┐         ┌─────────────────────┐
│    auth.users       │         │  analysis_history   │
│  (existing table)   │         │  (existing table)   │
├─────────────────────┤         ├─────────────────────┤
│ id: UUID (PK)       │←───────→│ user_id: UUID (FK)  │
│ email: TEXT         │         │ analysis: JSONB     │
│ ...                 │         │ focus_area: TEXT    │
└─────────────────────┘         └─────────────────────┘
          │
          │ 1:N
          ▼
┌─────────────────────┐         ┌─────────────────────┐
│     purchases       │         │    user_credits     │
│   (new table)       │         │    (new table)      │
├─────────────────────┤         ├─────────────────────┤
│ id: UUID (PK)       │         │ user_id: UUID (PK)  │
│ user_id: UUID (FK)  │←───────→│ basic_credits: INT  │
│ product_type: TEXT  │         │ pro_credits: INT    │
│ amount_rub: INT     │         │ cassandra_credits:  │
│ yukassa_payment_id  │         │   INT               │
│ status: TEXT        │         │ updated_at: TSTZ    │
│ credits_granted:INT │         └─────────────────────┘
│ created_at: TSTZ    │
│ paid_at: TSTZ       │
│ metadata: JSONB     │
└─────────────────────┘
```

## Entities

### 1. purchases

**Purpose**: Records all payment transactions from YooKassa.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PK, DEFAULT gen_random_uuid() | Unique purchase ID |
| `user_id` | UUID | FK → auth.users(id), NOT NULL | User who made purchase |
| `product_type` | TEXT | NOT NULL, CHECK IN ('basic', 'pack5', 'pro', 'cassandra') | Type of product purchased |
| `amount_rub` | INTEGER | NOT NULL, CHECK IN (100, 300, 500, 1000) | Price in rubles |
| `yukassa_payment_id` | TEXT | UNIQUE | YooKassa payment identifier |
| `status` | TEXT | NOT NULL, DEFAULT 'pending', CHECK IN ('pending', 'succeeded', 'canceled') | Payment status |
| `credits_granted` | INTEGER | NOT NULL, DEFAULT 0 | Number of credits added |
| `created_at` | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | When purchase was initiated |
| `paid_at` | TIMESTAMPTZ | NULL | When payment was confirmed |
| `metadata` | JSONB | NULL | Additional payment metadata |

**Indexes**:
- Primary key on `id`
- Unique index on `yukassa_payment_id`
- Index on `user_id` for user history queries
- Index on `status` for pending payment queries

**RLS Policies**:
- SELECT: Users can view their own purchases (`auth.uid() = user_id`)
- INSERT/UPDATE/DELETE: Service role only (Edge Functions)

### 2. user_credits

**Purpose**: Tracks current credit balance for each user.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `user_id` | UUID | PK, FK → auth.users(id) | User identifier |
| `basic_credits` | INTEGER | NOT NULL, DEFAULT 0, CHECK >= 0 | Basic analysis credits |
| `pro_credits` | INTEGER | NOT NULL, DEFAULT 0, CHECK >= 0 | PRO analysis credits |
| `cassandra_credits` | INTEGER | NOT NULL, DEFAULT 0, CHECK >= 0 | Cassandra prediction credits |
| `updated_at` | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Last update timestamp |

**Indexes**:
- Primary key on `user_id`

**RLS Policies**:
- SELECT: Users can view their own credits (`auth.uid() = user_id`)
- INSERT/UPDATE: Service role only (Edge Functions)

## Product Types & Credit Mapping

| product_type | amount_rub | Credits Granted | Description |
|-------------|------------|-----------------|-------------|
| `basic` | 100 | +1 basic_credits | 1 basic analysis (3-4 blocks) |
| `pack5` | 300 | +5 basic_credits | 5 basic analyses (40% discount) |
| `pro` | 500 | +1 pro_credits | 1 PRO analysis (6+ blocks) |
| `cassandra` | 1000 | +1 cassandra_credits | 1 esoteric prediction |

## State Transitions

### Purchase Status Flow

```
┌──────────┐     payment.succeeded     ┌───────────┐
│ pending  │ ─────────────────────────→│ succeeded │
└──────────┘                           └───────────┘
     │
     │ payment.canceled
     ▼
┌──────────┐
│ canceled │
└──────────┘
```

**Transition Rules**:
1. `pending` → `succeeded`: YooKassa webhook with `payment.succeeded` event
2. `pending` → `canceled`: YooKassa webhook with `payment.canceled` event or timeout
3. `succeeded` and `canceled` are terminal states

## Validation Rules

### purchases

1. `product_type` must be one of: 'basic', 'pack5', 'pro', 'cassandra'
2. `amount_rub` must match `product_type`:
   - basic → 100
   - pack5 → 300
   - pro → 500
   - cassandra → 1000
3. `yukassa_payment_id` must be unique (idempotency)
4. `credits_granted` calculated based on `product_type`

### user_credits

1. All credit values must be >= 0
2. Credits decremented only when analysis is consumed (future feature)
3. `user_id` must exist in `auth.users`

### 3. payment_analytics

**Purpose**: Tracks conversion funnel events for SM-002 metric.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PK, DEFAULT gen_random_uuid() | Event ID |
| `event` | TEXT | NOT NULL, CHECK IN ('tariff_view', 'payment_started', 'payment_succeeded', 'payment_canceled') | Event type |
| `user_id` | UUID | NULL, FK → auth.users(id) | User (optional for anonymous) |
| `product_type` | TEXT | NULL | Product type if applicable |
| `amount_rub` | INTEGER | NULL | Amount if applicable |
| `metadata` | JSONB | NULL | Additional event data |
| `created_at` | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Event timestamp |

**Indexes**:
- Primary key on `id`
- Index on `event` for filtering
- Index on `created_at` for time-based queries

**RLS Policies**:
- INSERT: Authenticated users can insert events
- SELECT: Service role only (for admin analytics)

## SQL Migrations

### Migration 1: Create purchases table

```sql
-- 20251123000001_create_purchases_table.sql

CREATE TABLE purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_type TEXT NOT NULL CHECK (product_type IN ('basic', 'pack5', 'pro', 'cassandra')),
  amount_rub INTEGER NOT NULL CHECK (amount_rub IN (100, 300, 500, 1000)),
  yukassa_payment_id TEXT UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'succeeded', 'canceled')),
  credits_granted INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  paid_at TIMESTAMPTZ,
  metadata JSONB
);

-- Indexes
CREATE INDEX idx_purchases_user_id ON purchases(user_id);
CREATE INDEX idx_purchases_status ON purchases(status);

-- Enable RLS
ALTER TABLE purchases ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view own purchases"
  ON purchases FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage purchases"
  ON purchases FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
```

### Migration 2: Create user_credits table

```sql
-- 20251123000002_create_user_credits_table.sql

CREATE TABLE user_credits (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  basic_credits INTEGER NOT NULL DEFAULT 0 CHECK (basic_credits >= 0),
  pro_credits INTEGER NOT NULL DEFAULT 0 CHECK (pro_credits >= 0),
  cassandra_credits INTEGER NOT NULL DEFAULT 0 CHECK (cassandra_credits >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE user_credits ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view own credits"
  ON user_credits FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage credits"
  ON user_credits FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Function to update updated_at on changes
CREATE OR REPLACE FUNCTION update_user_credits_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_user_credits_updated_at
  BEFORE UPDATE ON user_credits
  FOR EACH ROW
  EXECUTE FUNCTION update_user_credits_updated_at();
```

### Migration 3: Credit grant function

```sql
-- 20251123000003_create_grant_credits_function.sql

CREATE OR REPLACE FUNCTION grant_credits(
  p_user_id UUID,
  p_product_type TEXT,
  p_credits INTEGER
)
RETURNS void AS $$
BEGIN
  -- Upsert user_credits row
  INSERT INTO user_credits (user_id, basic_credits, pro_credits, cassandra_credits)
  VALUES (
    p_user_id,
    CASE WHEN p_product_type IN ('basic', 'pack5') THEN p_credits ELSE 0 END,
    CASE WHEN p_product_type = 'pro' THEN p_credits ELSE 0 END,
    CASE WHEN p_product_type = 'cassandra' THEN p_credits ELSE 0 END
  )
  ON CONFLICT (user_id) DO UPDATE SET
    basic_credits = user_credits.basic_credits +
      CASE WHEN p_product_type IN ('basic', 'pack5') THEN p_credits ELSE 0 END,
    pro_credits = user_credits.pro_credits +
      CASE WHEN p_product_type = 'pro' THEN p_credits ELSE 0 END,
    cassandra_credits = user_credits.cassandra_credits +
      CASE WHEN p_product_type = 'cassandra' THEN p_credits ELSE 0 END,
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### Migration 4: Payment analytics table

```sql
-- 20251123000004_create_payment_analytics_table.sql

CREATE TABLE payment_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event TEXT NOT NULL CHECK (event IN ('tariff_view', 'payment_started', 'payment_succeeded', 'payment_canceled')),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  product_type TEXT,
  amount_rub INTEGER,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_payment_analytics_event ON payment_analytics(event);
CREATE INDEX idx_payment_analytics_created_at ON payment_analytics(created_at);

-- Enable RLS
ALTER TABLE payment_analytics ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Authenticated users can insert analytics"
  ON payment_analytics FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Service role can read analytics"
  ON payment_analytics FOR SELECT
  TO service_role
  USING (true);

-- Conversion rate view
CREATE VIEW payment_conversion AS
SELECT
  DATE_TRUNC('day', created_at) as day,
  COUNT(*) FILTER (WHERE event = 'tariff_view') as views,
  COUNT(*) FILTER (WHERE event = 'payment_started') as started,
  COUNT(*) FILTER (WHERE event = 'payment_succeeded') as succeeded,
  COUNT(*) FILTER (WHERE event = 'payment_canceled') as canceled,
  ROUND(
    COUNT(*) FILTER (WHERE event = 'payment_succeeded') * 100.0 /
    NULLIF(COUNT(*) FILTER (WHERE event = 'tariff_view'), 0), 2
  ) as conversion_rate
FROM payment_analytics
GROUP BY DATE_TRUNC('day', created_at)
ORDER BY day DESC;
```

### Migration 5: Credit consumption function

```sql
-- 20251123000005_create_consume_credit_function.sql

CREATE OR REPLACE FUNCTION consume_credit(
  p_user_id UUID,
  p_credit_type TEXT DEFAULT 'basic'
)
RETURNS TABLE (
  success BOOLEAN,
  credit_type TEXT,
  remaining INTEGER
) AS $$
DECLARE
  v_basic INTEGER;
  v_pro INTEGER;
  v_cassandra INTEGER;
  v_consumed_type TEXT;
  v_remaining INTEGER;
BEGIN
  -- Get current credits with row lock
  SELECT basic_credits, pro_credits, cassandra_credits
  INTO v_basic, v_pro, v_cassandra
  FROM user_credits
  WHERE user_id = p_user_id
  FOR UPDATE;

  -- If no record exists, return failure
  IF NOT FOUND THEN
    RETURN QUERY SELECT FALSE, NULL::TEXT, 0;
    RETURN;
  END IF;

  -- Determine which credit to consume (priority: basic → pro)
  IF p_credit_type = 'cassandra' THEN
    -- Cassandra credits only for cassandra readings
    IF v_cassandra > 0 THEN
      UPDATE user_credits
      SET cassandra_credits = cassandra_credits - 1, updated_at = NOW()
      WHERE user_id = p_user_id;
      v_consumed_type := 'cassandra';
      v_remaining := v_cassandra - 1;
    ELSE
      RETURN QUERY SELECT FALSE, NULL::TEXT, 0;
      RETURN;
    END IF;
  ELSE
    -- Regular credits: try basic first, then pro
    IF v_basic > 0 THEN
      UPDATE user_credits
      SET basic_credits = basic_credits - 1, updated_at = NOW()
      WHERE user_id = p_user_id;
      v_consumed_type := 'basic';
      v_remaining := v_basic - 1;
    ELSIF v_pro > 0 THEN
      UPDATE user_credits
      SET pro_credits = pro_credits - 1, updated_at = NOW()
      WHERE user_id = p_user_id;
      v_consumed_type := 'pro';
      v_remaining := v_pro - 1;
    ELSE
      RETURN QUERY SELECT FALSE, NULL::TEXT, 0;
      RETURN;
    END IF;
  END IF;

  RETURN QUERY SELECT TRUE, v_consumed_type, v_remaining;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

## TypeScript Types

```typescript
// types/payment.ts

export type ProductType = 'basic' | 'pack5' | 'pro' | 'cassandra';
export type PaymentStatus = 'pending' | 'succeeded' | 'canceled';

export interface Purchase {
  id: string;
  user_id: string;
  product_type: ProductType;
  amount_rub: number;
  yukassa_payment_id: string | null;
  status: PaymentStatus;
  credits_granted: number;
  created_at: string;
  paid_at: string | null;
  metadata: Record<string, unknown> | null;
}

export interface UserCredits {
  user_id: string;
  basic_credits: number;
  pro_credits: number;
  cassandra_credits: number;
  updated_at: string;
}

export interface Tariff {
  type: ProductType;
  name: string;
  price: number;
  credits: number;
  creditType: 'basic' | 'pro' | 'cassandra';
  description: string;
}

export const TARIFFS: Tariff[] = [
  {
    type: 'basic',
    name: 'Новичок',
    price: 100,
    credits: 1,
    creditType: 'basic',
    description: '1 базовая расшифровка (3-4 блока)',
  },
  {
    type: 'pack5',
    name: 'Любитель',
    price: 300,
    credits: 5,
    creditType: 'basic',
    description: '5 расшифровок (скидка 40%)',
  },
  {
    type: 'pro',
    name: 'Внутренний мудрец',
    price: 500,
    credits: 1,
    creditType: 'pro',
    description: '1 PRO расшифровка (6+ блоков)',
  },
  {
    type: 'cassandra',
    name: 'Кассандра',
    price: 1000,
    credits: 1,
    creditType: 'cassandra',
    description: 'Эзотерическое предсказание',
  },
];
```
