# Database Audit Report

**Generated**: 2026-01-19
**Project**: Symancy / MegaCampusAI
**Supabase Project**: johspxgvkbrysxhilmbg
**Audit Type**: Legacy Table Migration Analysis

---

## Executive Summary

This audit identifies legacy tables that may be candidates for deprecation or migration following the implementation of the omnichannel architecture (migration `20251228_*`). The project has successfully migrated to a unified user identity system, but several legacy tables remain with mixed migration status.

### Key Findings

- **Legacy Tables Identified**: 5 tables
- **Omnichannel Tables**: 7 tables (actively used)
- **Migration Status**: Partially complete
- **Critical Issues**:
  - `chat_messages` still actively receiving data (last message: 2026-01-18)
  - 39/50 analysis records lack `unified_user_id`
  - 17/17 purchases lack `unified_user_id`
  - 1/3 profiles not linked to `unified_users`

### Recommendations Priority

1. **IMMEDIATE (P0)**: Complete `analysis_history` and `purchases` migration to `unified_user_id`
2. **HIGH (P1)**: Deprecate `chat_messages` (replaced by `messages`)
3. **MEDIUM (P2)**: Mark `backend_user_credits` and `user_credits` as read-only
4. **LOW (P3)**: Clean up orphaned `user_states` after full migration

---

## Table Status Summary

| Table | Status | Records | Migration Status | Recommendation |
|-------|--------|---------|------------------|----------------|
| **Legacy Tables** |
| `profiles` | ACTIVE | 3 | 2/3 linked to unified_users | Keep (Telegram metadata) |
| `user_credits` | DEPRECATED | 2 | Replaced by unified_user_credits | Mark read-only |
| `backend_user_credits` | DEPRECATED | 2 | Replaced by unified_user_credits | Mark read-only |
| `chat_messages` | ACTIVE (!) | 67 | Should use `messages` | Migrate & deprecate |
| `user_states` | ACTIVE | 3 | Legacy onboarding state | Keep for now |
| **Omnichannel Tables** |
| `unified_users` | ACTIVE | 4 | Central identity hub | Core table |
| `unified_user_credits` | ACTIVE | 4 | Unified credit system | Core table |
| `conversations` | ACTIVE | 2 | Replaces chat_messages | Core table |
| `messages` | ACTIVE | 28 | Replaces chat_messages | Core table |
| `message_deliveries` | ACTIVE | 0 | Delivery tracking | Core table |
| `credit_transactions` | ACTIVE | 0 | Audit trail | Core table |
| **Partially Migrated** |
| `analysis_history` | MIGRATION_PENDING | 50 | 11/50 have unified_user_id | Complete migration |
| `purchases` | MIGRATION_PENDING | 17 | 0/17 have unified_user_id | Complete migration |

---

## Legacy Tables Analysis

### 1. profiles

**Table**: `public.profiles`
**Status**: ACTIVE
**Records**: 3
**Primary Key**: `telegram_user_id` (bigint)
**Purpose**: Telegram user metadata (username, first_name, language, goals, notifications)

#### Migration Analysis

```sql
-- Migration status
SELECT
  COUNT(*) FILTER (WHERE unified_user_id IS NOT NULL) as linked,
  COUNT(*) FILTER (WHERE unified_user_id IS NULL) as unlinked
FROM profiles;

-- Result: 2 linked, 1 unlinked
```

#### Foreign Key Dependencies

**Outgoing FKs**:
- `profiles.unified_user_id` → `unified_users.id` (2/3 linked)

**Incoming FKs** (7 tables depend on this):
- `backend_credit_transactions.telegram_user_id`
- `analysis_history.telegram_user_id`
- `user_memories.telegram_user_id`
- `backend_user_credits.telegram_user_id`
- `scheduled_messages.telegram_user_id`
- `user_states.telegram_user_id`
- `chat_messages.telegram_user_id`

#### RLS Policies

- 3 policies (Telegram users read/update own, service_role full access)
- Performance: SECURE (indexed, properly scoped)

#### Indexes

- Primary key: `profiles_pkey` (telegram_user_id)
- `idx_profiles_unified_user` (unified_user_id WHERE NOT NULL) - **UNUSED**
- `idx_profiles_created_at` - Used
- `idx_profiles_username` - **UNUSED**
- `idx_profiles_notifications_enabled` - **UNUSED**
- `idx_profiles_goals` (GIN) - **UNUSED**
- `idx_profiles_last_interaction` - **UNUSED**

#### Recommendation

**STATUS**: KEEP (ACTIVE)

**Rationale**:
- Stores Telegram-specific metadata (username, language, goals, notifications_enabled)
- Acts as bridge between Telegram IDs and unified identity system
- Required for Telegram bot operations
- 7 dependent tables still use `telegram_user_id` as FK

**Action Items**:
1. Complete linking for 1 unlinked profile
2. Remove 5 unused indexes (save ~10 KB)
3. Keep as authoritative source for Telegram metadata

---

### 2. user_credits

**Table**: `public.user_credits`
**Status**: DEPRECATED
**Records**: 2
**Primary Key**: `user_id` (uuid, references `auth.users.id`)
**Purpose**: Credit balances for Supabase Auth web users (basic_credits, pro_credits, cassandra_credits)

#### Migration Analysis

```sql
-- All user_credits should be migrated to unified_user_credits
SELECT COUNT(*) FROM user_credits; -- 2 records
SELECT COUNT(*) FROM unified_user_credits; -- 4 records (includes Telegram users)
```

#### Foreign Key Dependencies

**Outgoing FKs**:
- `user_credits.user_id` → `auth.users.id`

**Incoming FKs**: None

#### RLS Policies

- 2 policies (Users view/update own credits, admins read all)
- **Performance Warning**: RLS has `auth_rls_initplan` issue (re-evaluates auth.uid() per row)

#### Recommendation

**STATUS**: DEPRECATED (Mark Read-Only)

**Rationale**:
- Replaced by `unified_user_credits` (migration `20251228163852`)
- No incoming FKs (safe to deprecate)
- Still has 2 records (likely web users before migration)

**Migration Roadmap**:

```sql
-- Step 1: Verify all user_credits migrated to unified_user_credits
SELECT
  uc.user_id,
  uc.basic_credits,
  uu.id as unified_user_id,
  uuc.credits_basic
FROM user_credits uc
LEFT JOIN unified_users uu ON uu.auth_id = uc.user_id
LEFT JOIN unified_user_credits uuc ON uuc.unified_user_id = uu.id;

-- Step 2: Add deprecation warning comment
COMMENT ON TABLE user_credits IS 'DEPRECATED: Use unified_user_credits instead. This table is read-only for legacy data.';

-- Step 3: Remove UPDATE/INSERT RLS policies (keep SELECT for audit)
DROP POLICY "Users can update own credits" ON user_credits;

-- Step 4: Schedule deletion after 90-day grace period (2026-04-19)
```

---

### 3. backend_user_credits

**Table**: `public.backend_user_credits`
**Status**: DEPRECATED
**Records**: 2
**Primary Key**: `telegram_user_id` (bigint, references `profiles.telegram_user_id`)
**Purpose**: Credit balances for Telegram bot users (single `credits` field)

#### Migration Analysis

```sql
-- Check migration status
SELECT
  COUNT(DISTINCT buc.telegram_user_id) as backend_users,
  COUNT(DISTINCT p.unified_user_id) as migrated_to_unified
FROM backend_user_credits buc
LEFT JOIN profiles p ON p.telegram_user_id = buc.telegram_user_id;

-- Result: 2 backend_users, 2 migrated_to_unified (100% migrated)
```

#### Foreign Key Dependencies

**Outgoing FKs**:
- `backend_user_credits.telegram_user_id` → `profiles.telegram_user_id`

**Incoming FKs**: None

#### RLS Policies

- 2 policies (Telegram users view own, service_role full access)
- Performance: SECURE

#### Recommendation

**STATUS**: DEPRECATED (Mark Read-Only)

**Rationale**:
- Replaced by `unified_user_credits` (migration `20251228163852`)
- All 2 users successfully migrated to unified system
- No incoming FKs (safe to deprecate)

**Migration Roadmap**:

```sql
-- Step 1: Verify migration completeness
SELECT
  buc.telegram_user_id,
  buc.credits,
  p.unified_user_id,
  uuc.credits_basic
FROM backend_user_credits buc
JOIN profiles p ON p.telegram_user_id = buc.telegram_user_id
LEFT JOIN unified_user_credits uuc ON uuc.unified_user_id = p.unified_user_id;

-- Step 2: Mark as deprecated
COMMENT ON TABLE backend_user_credits IS 'DEPRECATED: Migrated to unified_user_credits. Read-only for legacy data.';

-- Step 3: Remove write policies
DROP POLICY "Service role has full access to backend_user_credits" ON backend_user_credits;
-- Keep read policy for audit trail

-- Step 4: Schedule deletion after 90 days (2026-04-19)
```

---

### 4. chat_messages

**Table**: `public.chat_messages`
**Status**: ACTIVE (SHOULD BE DEPRECATED!)
**Records**: 67
**Primary Key**: `id` (uuid)
**Purpose**: Legacy chat message storage (user ↔ assistant conversations)

#### Critical Issue

```sql
-- Last message timestamp
SELECT MAX(created_at) as last_message FROM chat_messages;
-- Result: 2026-01-18 09:26:22 (YESTERDAY!)
```

**ALERT**: This table is still receiving writes despite being replaced by `messages` table in omnichannel migration.

#### Migration Analysis

```sql
-- Check if messages exist in both tables
SELECT
  (SELECT COUNT(*) FROM chat_messages) as legacy_count,
  (SELECT COUNT(*) FROM messages WHERE channel = 'telegram') as omnichannel_count;

-- Result: 67 legacy, 28 omnichannel
-- Indicates dual-write scenario or incomplete migration
```

#### Foreign Key Dependencies

**Outgoing FKs**:
- `chat_messages.telegram_user_id` → `profiles.telegram_user_id`

**Incoming FKs**: None

#### RLS Policies

- 2 policies (Users view/insert own messages, service_role full access)

#### Indexes

- Primary key: `chat_messages_pkey` (id)
- `idx_chat_messages_user_created` (telegram_user_id, created_at DESC) - Used

#### Recommendation

**STATUS**: MIGRATION_PENDING → DEPRECATED

**Rationale**:
- Replaced by `messages` table (omnichannel architecture)
- Still receiving writes (code needs update)
- 67 legacy messages need migration

**Migration Roadmap**:

**Step 1: Audit Code for Dual Writes**

```bash
# Find all references to chat_messages in codebase
grep -r "chat_messages" symancy-backend/
grep -r "chat_messages" src/
```

**Step 2: Migrate Historical Data**

```sql
-- Migrate chat_messages to messages table
INSERT INTO messages (
  conversation_id,
  channel,
  interface,
  role,
  content,
  content_type,
  created_at,
  metadata
)
SELECT
  -- Find or create conversation for this Telegram user
  (
    SELECT c.id
    FROM conversations c
    JOIN unified_users uu ON uu.id = c.unified_user_id
    JOIN profiles p ON p.unified_user_id = uu.id
    WHERE p.telegram_user_id = cm.telegram_user_id
    AND c.status = 'active'
    LIMIT 1
  ) as conversation_id,
  'telegram' as channel,
  'bot' as interface,
  cm.role,
  cm.content,
  'text' as content_type,
  cm.created_at,
  jsonb_build_object(
    'migrated_from', 'chat_messages',
    'original_id', cm.id::text
  ) as metadata
FROM chat_messages cm
WHERE NOT EXISTS (
  -- Avoid duplicates if already migrated
  SELECT 1 FROM messages m
  WHERE m.metadata->>'original_id' = cm.id::text
);
```

**Step 3: Update Application Code**

- Replace all `INSERT INTO chat_messages` with `INSERT INTO messages`
- Replace all `SELECT FROM chat_messages` with `SELECT FROM messages`
- Update Telegram bot message handlers

**Step 4: Verify Migration**

```sql
-- Verify all messages migrated
SELECT
  cm.id,
  cm.created_at,
  m.id as message_id
FROM chat_messages cm
LEFT JOIN messages m ON m.metadata->>'original_id' = cm.id::text
WHERE m.id IS NULL;
-- Should return 0 rows
```

**Step 5: Mark as Read-Only**

```sql
COMMENT ON TABLE chat_messages IS 'DEPRECATED: Migrated to messages table. Read-only archive.';
DROP POLICY "Users can insert own messages" ON chat_messages;
```

**Step 6: Schedule Deletion (90 days after migration completion)**

---

### 5. user_states

**Table**: `public.user_states`
**Status**: ACTIVE
**Records**: 3
**Primary Key**: `telegram_user_id` (bigint, references `profiles.telegram_user_id`)
**Purpose**: Telegram bot state management (onboarding flow, rate limiting, invalid image counters)

#### Analysis

**Columns**:
- `onboarding_step`, `onboarding_data` - Flow state
- `last_analysis_id` - FK to `analysis_history.id`
- `daily_messages_count`, `daily_messages_reset_at` - Rate limiting
- `daily_invalid_count`, `daily_invalid_reset_at` - Invalid image tracking

#### Foreign Key Dependencies

**Outgoing FKs**:
- `user_states.telegram_user_id` → `profiles.telegram_user_id`
- `user_states.last_analysis_id` → `analysis_history.id`

**Incoming FKs**: None

#### RLS Policies

- 4 policies (Telegram users CRUD own state, service_role full access)

#### Indexes

- Primary key: `user_states_pkey` (telegram_user_id)
- `idx_user_states_telegram_user` - **UNUSED**
- `idx_user_states_last_analysis_id` - **UNUSED**

#### Recommendation

**STATUS**: KEEP (ACTIVE)

**Rationale**:
- Telegram bot requires session state management
- No equivalent in omnichannel tables (conversations store different data)
- Could be refactored to use `unified_users` JSONB field, but current design works

**Future Optimization**:
- Consider migrating to `unified_users.metadata` JSONB field
- Remove 2 unused indexes

---

## Omnichannel Tables Analysis

### 1. unified_users

**Status**: ACTIVE (Core Identity Hub)
**Records**: 4
**Purpose**: Central identity across all channels (Telegram, Web, WhatsApp, WeChat)

**Columns**:
- `telegram_id`, `auth_id`, `whatsapp_phone`, `wechat_openid` - Channel identities
- `display_name`, `avatar_url`, `language_code`, `timezone` - Profile data
- `notification_settings` - JSONB preferences
- `daily_messages_count`, `daily_messages_reset_at` - Rate limiting

**Indexes**: 12 indexes (well-optimized)
- 6 unused indexes flagged by performance advisor

**RLS**: 7 policies (Telegram JWT, auth.uid(), service_role, admin)

**Recommendation**: Core table, keep as-is. Consider removing unused indexes.

---

### 2. unified_user_credits

**Status**: ACTIVE (Unified Credit System)
**Records**: 4
**Purpose**: Replace both `user_credits` and `backend_user_credits`

**Columns**:
- `credits_basic`, `credits_pro`, `credits_cassandra` - Credit balances
- `free_credit_granted` - Idempotency flag

**Indexes**: 2 indexes (efficient)

**RLS**: 4 policies (Telegram JWT, auth.uid(), service_role, admin)
- **Performance Warning**: `auth_rls_initplan` issue (re-evaluates auth function per row)

**Recommendation**: Fix RLS performance issue by wrapping auth calls in SELECT:

```sql
-- Before (slow)
USING (auth.uid() = (SELECT auth_id FROM unified_users WHERE id = unified_user_id))

-- After (fast)
USING ((SELECT auth.uid()) = (SELECT auth_id FROM unified_users WHERE id = unified_user_id))
```

---

### 3. conversations

**Status**: ACTIVE (Chat Container)
**Records**: 2
**Purpose**: Group messages by user-AI conversation

**Recommendation**: Core table, working as designed.

---

### 4. messages

**Status**: ACTIVE (Unified Message Store)
**Records**: 28
**Purpose**: Replace `chat_messages` with multi-channel support

**Recommendation**: Core table. Ensure all code writes to this table instead of `chat_messages`.

---

### 5. message_deliveries

**Status**: ACTIVE (Delivery Tracking)
**Records**: 0
**Purpose**: Track message delivery status across channels

**Recommendation**: Core table. Currently unused (no deliveries tracked yet).

---

### 6. credit_transactions

**Status**: ACTIVE (Audit Trail)
**Records**: 0
**Purpose**: Replace `backend_credit_transactions` with unified audit log

**Recommendation**: Core table. Should be populated when credits are consumed/granted.

---

## Partially Migrated Tables

### analysis_history

**Status**: MIGRATION_PENDING
**Records**: 50 total (11 with `unified_user_id`, 39 without)
**Issue**: Migration incomplete

#### Analysis

```sql
SELECT
  COUNT(*) FILTER (WHERE unified_user_id IS NOT NULL) as migrated,
  COUNT(*) FILTER (WHERE unified_user_id IS NULL) as not_migrated
FROM analysis_history;

-- Result: 11 migrated, 39 not migrated
```

#### Recommendation

**Complete Migration (P0 - IMMEDIATE)**

```sql
-- Backfill unified_user_id for existing analyses
UPDATE analysis_history ah
SET unified_user_id = p.unified_user_id
FROM profiles p
WHERE ah.telegram_user_id = p.telegram_user_id
  AND ah.unified_user_id IS NULL
  AND p.unified_user_id IS NOT NULL;

-- Verify
SELECT
  COUNT(*) FILTER (WHERE unified_user_id IS NOT NULL) as migrated,
  COUNT(*) FILTER (WHERE unified_user_id IS NULL) as orphaned
FROM analysis_history;
-- Expect: ~48 migrated, ~2 orphaned (if 1 profile still unlinked)
```

---

### purchases

**Status**: MIGRATION_PENDING
**Records**: 17 total (0 with `unified_user_id`, 17 without)
**Issue**: Column added but never populated

#### Analysis

```sql
SELECT
  COUNT(*) FILTER (WHERE unified_user_id IS NOT NULL) as migrated,
  COUNT(*) FILTER (WHERE unified_user_id IS NULL) as not_migrated
FROM purchases;

-- Result: 0 migrated, 17 not migrated
```

#### Recommendation

**Complete Migration (P0 - IMMEDIATE)**

```sql
-- Backfill unified_user_id from auth.users → unified_users
UPDATE purchases p
SET unified_user_id = uu.id
FROM unified_users uu
WHERE p.user_id = uu.auth_id
  AND p.unified_user_id IS NULL;

-- Verify
SELECT
  p.id,
  p.user_id,
  p.unified_user_id,
  uu.display_name
FROM purchases p
LEFT JOIN unified_users uu ON uu.id = p.unified_user_id;
-- All rows should have unified_user_id populated
```

---

## Security & Performance Issues (From Advisors)

### Security Issues

1. **Security Definer Views** (ERROR)
   - `public.payment_conversion` - Uses SECURITY DEFINER
   - `public.admin_llm_costs` - Uses SECURITY DEFINER
   - **Risk**: Bypasses RLS, grants creator's permissions
   - **Remediation**: Review if SECURITY DEFINER is necessary

2. **Overly Permissive RLS Policies** (WARN)
   - `admin_audit_log.admin_audit_log_write` - `WITH CHECK (true)` for INSERT
   - `payment_analytics.Authenticated users can insert analytics` - `WITH CHECK (true)`
   - **Risk**: Allows unrestricted writes
   - **Remediation**: Add proper access control checks

3. **Function Search Path Mutable** (WARN - 24 functions)
   - Functions like `consume_unified_credit`, `is_admin`, `link_accounts` lack explicit `search_path`
   - **Risk**: Search path hijacking attacks
   - **Remediation**: Add `SET search_path = public, pg_temp` to function definitions

### Performance Issues

1. **Auth RLS InitPlan** (WARN - 11 policies)
   - Policies re-evaluate `auth.uid()` per row instead of once per query
   - Affected tables: `purchases`, `user_credits`, `unified_user_credits`, `conversations`, `analysis_history`, `credit_transactions`
   - **Impact**: Slow queries on large result sets
   - **Fix**: Wrap auth calls in SELECT: `(SELECT auth.uid())` instead of `auth.uid()`

2. **Multiple Permissive Policies** (WARN - 12 tables)
   - Tables with 2-4 permissive policies for same role/action
   - Affected: `analysis_history`, `conversations`, `credit_transactions`, `daily_insights`, `messages`, `purchases`, `unified_user_credits`, `unified_users`
   - **Impact**: All policies executed per query (performance overhead)
   - **Fix**: Consolidate into single policy with OR conditions

3. **Unused Indexes** (INFO - 54 indexes)
   - Notable unused indexes:
     - `idx_profiles_unified_user`, `idx_profiles_notifications_enabled`, `idx_profiles_goals`
     - `idx_backend_user_credits_updated_at`
     - `idx_user_states_telegram_user`, `idx_user_states_last_analysis_id`
     - 6 indexes on `messages` table
     - 5 indexes on `unified_users` table
   - **Impact**: Wasted storage (~50-100 KB), slower writes
   - **Fix**: Drop unused indexes after verifying with production query logs

4. **Unindexed Foreign Keys** (INFO - 2 FKs)
   - `credit_transactions.unified_user_id` (FK without index)
   - `payment_analytics.user_id` (FK without index)
   - **Impact**: Slow JOINs on these FK columns
   - **Fix**: Add indexes

---

## Migration Roadmap

### Phase 1: Immediate Actions (P0) - Week 1

**Goal**: Complete partial migrations, fix critical data integrity issues

1. **Backfill `analysis_history.unified_user_id`**
   - Estimated time: 5 minutes
   - Risk: Low (read-only backfill)
   - Validation: Query after update to verify 48/50 migrated

2. **Backfill `purchases.unified_user_id`**
   - Estimated time: 5 minutes
   - Risk: Low (read-only backfill)
   - Validation: Query to verify 17/17 migrated

3. **Link final unlinked profile to unified_users**
   - Estimated time: 10 minutes
   - Risk: Low (single record update)
   - Validation: `SELECT COUNT(*) FROM profiles WHERE unified_user_id IS NULL` should return 0

4. **Fix RLS Performance (auth_rls_initplan)**
   - Estimated time: 30 minutes
   - Risk: Medium (test thoroughly before deploy)
   - Affected tables: `purchases`, `user_credits`, `unified_user_credits`, `conversations`, `credit_transactions`

### Phase 2: High Priority (P1) - Week 2-3

**Goal**: Deprecate `chat_messages`, improve performance

5. **Migrate `chat_messages` to `messages`**
   - Audit code for `chat_messages` references (1 hour)
   - Update application code to use `messages` (2-4 hours)
   - Migrate 67 historical messages (SQL script: 15 minutes)
   - Deploy code changes (30 minutes)
   - Verify no new writes to `chat_messages` (monitor 1 week)
   - Mark table as read-only (5 minutes)

6. **Drop Unused Indexes**
   - Generate DROP INDEX statements for 54 unused indexes
   - Review with production query logs (1 hour)
   - Execute drops (10 minutes)
   - Estimated savings: ~50-100 KB storage, faster writes

7. **Add Missing FK Indexes**
   ```sql
   CREATE INDEX idx_credit_transactions_unified_user ON credit_transactions(unified_user_id);
   CREATE INDEX idx_payment_analytics_user ON payment_analytics(user_id);
   ```

### Phase 3: Medium Priority (P2) - Week 4-5

**Goal**: Mark legacy credit tables as read-only

8. **Deprecate `user_credits`**
   - Verify migration completeness (15 minutes)
   - Add deprecation comment (5 minutes)
   - Drop write policies (5 minutes)
   - Update documentation (15 minutes)

9. **Deprecate `backend_user_credits`**
   - Same steps as `user_credits`

10. **Consolidate RLS Policies (Fix Multiple Permissive Policies)**
    - Merge 2-4 policies per table into single policy with OR
    - Affected: 12 tables
    - Time: 2-3 hours
    - Test thoroughly with all user roles

### Phase 4: Low Priority (P3) - Month 2

**Goal**: Security hardening, final cleanup

11. **Fix Function Search Paths**
    - Add `SET search_path = public, pg_temp` to 24 functions
    - Time: 1 hour
    - Test all functions after change

12. **Review SECURITY DEFINER Views**
    - Audit `payment_conversion` and `admin_llm_costs` views
    - Determine if SECURITY DEFINER is necessary
    - Refactor if possible

13. **Fix Overly Permissive RLS Policies**
    - `admin_audit_log.admin_audit_log_write` - Add proper admin check
    - `payment_analytics` - Add user/admin validation

14. **Schedule Deletion of Deprecated Tables**
    - After 90-day grace period (2026-04-19):
      - Drop `user_credits`
      - Drop `backend_user_credits`
      - Drop `chat_messages` (if verified fully migrated)

---

## Validation Queries

### Check Migration Completeness

```sql
-- 1. Verify all profiles linked to unified_users
SELECT COUNT(*) as unlinked_profiles
FROM profiles
WHERE unified_user_id IS NULL;
-- Expected: 0

-- 2. Verify analysis_history migration
SELECT
  COUNT(*) as total,
  COUNT(*) FILTER (WHERE unified_user_id IS NOT NULL) as migrated
FROM analysis_history;
-- Expected: 50 total, 50 migrated

-- 3. Verify purchases migration
SELECT
  COUNT(*) as total,
  COUNT(*) FILTER (WHERE unified_user_id IS NOT NULL) as migrated
FROM purchases;
-- Expected: 17 total, 17 migrated

-- 4. Verify no new writes to chat_messages (run after code deployment)
SELECT MAX(created_at) as last_message
FROM chat_messages;
-- Expected: Should not increase after migration

-- 5. Verify messages table is being used
SELECT
  COUNT(*) as message_count,
  MAX(created_at) as last_message
FROM messages;
-- Expected: Should increase daily
```

### Performance Validation

```sql
-- Check for slow RLS policies (after fix)
EXPLAIN ANALYZE
SELECT * FROM unified_user_credits
WHERE unified_user_id = (SELECT id FROM unified_users WHERE auth_id = auth.uid());
-- Should show InitPlan evaluated once, not per row

-- Verify indexes are used
SELECT
  schemaname,
  tablename,
  indexname,
  idx_scan,
  idx_tup_read
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
  AND idx_scan = 0
ORDER BY pg_relation_size(indexrelid) DESC;
-- Should show fewer unused indexes after cleanup
```

---

## Appendix A: Table Dependencies Graph

```
auth.users (3)
    ↓
user_credits (2) [DEPRECATED]
    ↓
unified_users (4) [CORE]
    ↓
    ├── unified_user_credits (4) [CORE]
    ├── conversations (2) [CORE]
    │       ↓
    │   messages (28) [CORE]
    │       ↓
    │   message_deliveries (0) [CORE]
    ├── credit_transactions (0) [CORE]
    ├── purchases (17) [PARTIAL - needs unified_user_id backfill]
    ├── analysis_history (50) [PARTIAL - needs unified_user_id backfill]
    └── daily_insights (26) [CORE]

profiles (3) [ACTIVE - Telegram metadata]
    ↓
    ├── backend_user_credits (2) [DEPRECATED]
    ├── backend_credit_transactions (2) [LEGACY]
    ├── chat_messages (67) [ACTIVE - SHOULD BE DEPRECATED!]
    ├── user_states (3) [ACTIVE]
    ├── scheduled_messages (0) [ACTIVE]
    ├── user_memories (0) [ACTIVE]
    └── analysis_history (50) [links to both telegram_user_id and unified_user_id]
```

---

## Appendix B: Database Health Metrics

### Table Sizes

```sql
SELECT
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
LIMIT 20;
```

### Record Counts

| Table | Records |
|-------|---------|
| system_metrics | 100 |
| payment_analytics | 68 |
| chat_messages | 67 |
| engagement_log | 58 |
| analysis_history | 50 |
| messages | 28 |
| daily_insights | 26 |
| system_config | 24 |
| refresh_tokens (auth) | 18 |
| purchases | 17 |
| identities (auth) | 4 |
| sessions (auth) | 4 |
| unified_users | 4 |
| unified_user_credits | 4 |
| auth.users | 3 |
| profiles | 3 |
| prompts | 3 |
| user_states | 3 |
| backend_credit_transactions | 2 |
| backend_user_credits | 2 |
| conversations | 2 |
| user_credits | 2 |

### Installed Extensions

**Active**:
- `pgcrypto` (1.3) - Cryptographic functions
- `pg_stat_statements` (1.11) - SQL statistics
- `supabase_vault` (0.3.1) - Secrets management
- `pg_graphql` (1.5.11) - GraphQL support
- `vector` (0.8.0) - Vector embeddings (for user_memories)
- `uuid-ossp` (1.1) - UUID generation

**Available but not installed**: 76 extensions

---

## Summary & Next Steps

### Critical Findings

1. `chat_messages` is **still receiving writes** despite being replaced by `messages` (last write: 2026-01-18)
2. 39/50 `analysis_history` records missing `unified_user_id`
3. 17/17 `purchases` records missing `unified_user_id`
4. 11 RLS policies have performance issues (auth_rls_initplan)
5. 54 unused indexes consuming storage

### Immediate Actions Required

1. **Backfill `unified_user_id` in `analysis_history` and `purchases`** (P0)
2. **Migrate `chat_messages` to `messages`** (P1)
3. **Fix RLS performance issues** (P1)
4. **Mark `user_credits` and `backend_user_credits` as read-only** (P2)

### Long-Term Recommendations

1. Schedule deletion of deprecated tables after 90-day grace period
2. Monitor `credit_transactions` and `message_deliveries` usage (currently 0 records)
3. Consider migrating `user_states` to `unified_users.metadata` JSONB field
4. Regular performance audits using Supabase Advisors

### Migration Timeline

- **Week 1**: Complete partial migrations (P0)
- **Week 2-3**: Deprecate `chat_messages`, optimize indexes (P1)
- **Week 4-5**: Mark legacy credit tables read-only (P2)
- **Month 2**: Security hardening, policy consolidation (P3)
- **2026-04-19**: Delete deprecated tables after 90-day grace period

---

**Audit Completed**: 2026-01-19
**Next Audit**: 2026-04-19 (After migration completion)
