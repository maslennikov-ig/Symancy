# Quickstart: Pre-MVP Payment Integration

**Feature**: 002-pre-mvp-payments
**Date**: 2025-11-23

## Prerequisites

1. **YooKassa Merchant Account** (get from client)
   - Shop ID
   - Secret Key
   - Webhook Secret

2. **Supabase CLI** installed and linked to project
   ```bash
   supabase link --project-ref johspxgvkbrysxhilmbg
   ```

3. **Local development environment**
   ```bash
   cd /home/me/code/coffee
   npm install
   ```

## Integration Scenarios

### Scenario 1: User Purchases Basic Analysis

**Actors**: User, Frontend, Edge Function, YooKassa, Database

**Flow**:
```
┌──────┐     ┌──────────┐     ┌────────────────┐     ┌──────────┐     ┌────────┐
│ User │     │ Frontend │     │ Edge Function  │     │ YooKassa │     │   DB   │
└──┬───┘     └────┬─────┘     └───────┬────────┘     └────┬─────┘     └───┬────┘
   │              │                    │                   │               │
   │ 1. Select    │                    │                   │               │
   │    "Новичок" │                    │                   │               │
   │─────────────>│                    │                   │               │
   │              │                    │                   │               │
   │              │ 2. POST            │                   │               │
   │              │    /create-payment │                   │               │
   │              │───────────────────>│                   │               │
   │              │                    │                   │               │
   │              │                    │ 3. Create payment │               │
   │              │                    │   (product_type,  │               │
   │              │                    │    user_id)       │               │
   │              │                    │──────────────────>│               │
   │              │                    │                   │               │
   │              │                    │ 4. confirmation_  │               │
   │              │                    │    token          │               │
   │              │                    │<──────────────────│               │
   │              │                    │                   │               │
   │              │                    │ 5. INSERT purchase│               │
   │              │                    │    (pending)      │               │
   │              │                    │───────────────────────────────────>│
   │              │                    │                   │               │
   │              │ 6. {confirmation_  │                   │               │
   │              │     token,         │                   │               │
   │              │     purchase_id}   │                   │               │
   │              │<───────────────────│                   │               │
   │              │                    │                   │               │
   │ 7. Render    │                    │                   │               │
   │    widget    │                    │                   │               │
   │<─────────────│                    │                   │               │
   │              │                    │                   │               │
   │ 8. Enter     │                    │                   │               │
   │    card,     │                    │                   │               │
   │    submit    │                    │                   │               │
   │─────────────────────────────────────────────────────>│               │
   │              │                    │                   │               │
   │              │                    │ 9. Webhook:       │               │
   │              │                    │    payment.       │               │
   │              │                    │    succeeded      │               │
   │              │                    │<──────────────────│               │
   │              │                    │                   │               │
   │              │                    │ 10. UPDATE        │               │
   │              │                    │     purchase      │               │
   │              │                    │     (succeeded)   │               │
   │              │                    │     + grant       │               │
   │              │                    │     credits       │               │
   │              │                    │───────────────────────────────────>│
   │              │                    │                   │               │
   │ 11. Redirect │                    │                   │               │
   │     to       │                    │                   │               │
   │     success  │                    │                   │               │
   │<─────────────────────────────────────────────────────│               │
   │              │                    │                   │               │
```

### Scenario 2: Webhook Signature Verification

**Purpose**: Ensure webhook is actually from YooKassa

**Edge Function Logic**:
```typescript
// payment-webhook/index.ts

import { createClient } from 'npm:@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  const signature = req.headers.get('x-yookassa-signature')
  const body = await req.text()

  // Verify signature
  const secret = Deno.env.get('YUKASSA_WEBHOOK_SECRET')!
  const isValid = await verifySignature(body, signature, secret)

  if (!isValid) {
    return new Response('Invalid signature', { status: 400 })
  }

  const payload = JSON.parse(body)
  const { event, object } = payload

  if (event === 'payment.succeeded') {
    const { metadata, id: yukassa_payment_id } = object
    const { user_id, product_type, purchase_id } = metadata

    // Update purchase status
    await supabase
      .from('purchases')
      .update({
        status: 'succeeded',
        yukassa_payment_id,
        paid_at: new Date().toISOString(),
        credits_granted: getCreditsForProduct(product_type)
      })
      .eq('id', purchase_id)

    // Grant credits
    await supabase.rpc('grant_credits', {
      p_user_id: user_id,
      p_product_type: product_type,
      p_credits: getCreditsForProduct(product_type)
    })
  }

  return new Response(JSON.stringify({ ok: true }), { status: 200 })
})

function getCreditsForProduct(type: string): number {
  const map: Record<string, number> = {
    basic: 1,
    pack5: 5,
    pro: 1,
    cassandra: 1
  }
  return map[type] || 0
}

async function verifySignature(body: string, signature: string, secret: string): Promise<boolean> {
  // HMAC-SHA256 verification
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(body))
  const expected = btoa(String.fromCharCode(...new Uint8Array(sig)))
  return signature === expected
}
```

### Scenario 3: User Views Credit Balance

**Frontend Component**:
```typescript
// services/paymentService.ts

import { supabase } from '../lib/supabaseClient'
import type { UserCredits } from '../types/payment'

export async function getUserCredits(): Promise<UserCredits | null> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data, error } = await supabase
    .from('user_credits')
    .select('*')
    .eq('user_id', user.id)
    .single()

  if (error && error.code !== 'PGRST116') {
    console.error('Error fetching credits:', error)
    return null
  }

  // Return default if no row exists yet
  return data || {
    user_id: user.id,
    basic_credits: 0,
    pro_credits: 0,
    cassandra_credits: 0,
    updated_at: new Date().toISOString()
  }
}
```

## Setup Steps

### Step 1: Install Dependencies

```bash
# Frontend
npm install react-yoomoneycheckoutwidget

# Supabase CLI (if not installed)
npm install -g supabase
```

### Step 2: Create Edge Functions

```bash
# Create function directories
supabase functions new create-payment
supabase functions new payment-webhook
```

### Step 3: Set Secrets

```bash
# Production
supabase secrets set YUKASSA_SHOP_ID=your_shop_id
supabase secrets set YUKASSA_SECRET_KEY=your_secret_key
supabase secrets set YUKASSA_WEBHOOK_SECRET=your_webhook_secret

# List secrets (verify)
supabase secrets list
```

### Step 4: Run Migrations

```bash
# Apply migrations
supabase db push

# Or generate migration file
supabase db diff -f create_payment_tables
```

### Step 5: Deploy Edge Functions

```bash
# Deploy all functions
supabase functions deploy

# Or deploy specific function
supabase functions deploy create-payment
supabase functions deploy payment-webhook
```

### Step 6: Configure YooKassa Webhook

In YooKassa dashboard:
1. Go to Settings → HTTP notifications
2. Add URL: `https://johspxgvkbrysxhilmbg.supabase.co/functions/v1/payment-webhook`
3. Select events: `payment.succeeded`, `payment.canceled`
4. Copy webhook secret to Supabase secrets

### Scenario 4: Credit Consumption Before Analysis

**Purpose**: Check credits before AI analysis and consume one credit atomically

**Flow**:
```
┌──────┐     ┌──────────┐     ┌────────────────┐     ┌────────┐
│ User │     │ Frontend │     │    Supabase    │     │   AI   │
└──┬───┘     └────┬─────┘     └───────┬────────┘     └───┬────┘
   │              │                    │                  │
   │ 1. Upload    │                    │                  │
   │    coffee    │                    │                  │
   │    image     │                    │                  │
   │─────────────>│                    │                  │
   │              │                    │                  │
   │              │ 2. Check credits   │                  │
   │              │    (RPC call)      │                  │
   │              │───────────────────>│                  │
   │              │                    │                  │
   │              │ 3. {basic: 2,      │                  │
   │              │     pro: 0, ...}   │                  │
   │              │<───────────────────│                  │
   │              │                    │                  │
   │              │ 4. Has credits?    │                  │
   │              │    YES → continue  │                  │
   │              │                    │                  │
   │              │ 5. consume_credit  │                  │
   │              │    (atomic RPC)    │                  │
   │              │───────────────────>│                  │
   │              │                    │                  │
   │              │ 6. {success: true, │                  │
   │              │  type: 'basic',    │                  │
   │              │  remaining: 1}     │                  │
   │              │<───────────────────│                  │
   │              │                    │                  │
   │              │ 7. Run AI analysis │                  │
   │              │────────────────────────────────────>│
   │              │                    │                  │
   │ 8. Show      │                    │                  │
   │    result    │                    │                  │
   │<─────────────│                    │                  │
```

**Frontend Service**:
```typescript
// services/creditService.ts

import { supabase } from '../lib/supabaseClient'

export interface ConsumeResult {
  success: boolean
  credit_type: string | null
  remaining: number
}

export async function consumeCredit(
  creditType: 'basic' | 'cassandra' = 'basic'
): Promise<ConsumeResult> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { success: false, credit_type: null, remaining: 0 }
  }

  const { data, error } = await supabase.rpc('consume_credit', {
    p_user_id: user.id,
    p_credit_type: creditType
  })

  if (error) {
    console.error('Error consuming credit:', error)
    return { success: false, credit_type: null, remaining: 0 }
  }

  // RPC returns array with single row
  const result = data?.[0]
  return {
    success: result?.success ?? false,
    credit_type: result?.credit_type ?? null,
    remaining: result?.remaining ?? 0
  }
}

export async function hasAvailableCredits(): Promise<boolean> {
  const credits = await getUserCredits()
  if (!credits) return false
  return credits.basic_credits > 0 || credits.pro_credits > 0
}
```

**Integration in App.tsx**:
```typescript
// Before running AI analysis
const handleAnalyze = async (image: File) => {
  // 1. Check if user has credits
  const hasCredits = await hasAvailableCredits()

  if (!hasCredits) {
    // Show tariff selector modal
    setShowTariffModal(true)
    return
  }

  // 2. Consume credit atomically
  const result = await consumeCredit('basic')

  if (!result.success) {
    toast.error('Не удалось списать кредит. Попробуйте снова.')
    return
  }

  // 3. Run AI analysis
  const analysis = await geminiService.analyzeImage(image)

  // 4. Show result with credit info
  toast.success(`Анализ готов! Осталось кредитов: ${result.remaining}`)
}
```

## Testing

### Test Card Numbers (YooKassa Sandbox)

| Scenario | Card Number | Result |
|----------|-------------|--------|
| Success | 4111 1111 1111 1111 | Payment succeeds |
| Decline | 4000 0000 0000 0002 | Payment declined |
| 3DS | 4000 0000 0000 3063 | 3D Secure required |

### Local Development

```bash
# Start Supabase locally
supabase start

# Serve Edge Functions locally
supabase functions serve --env-file .env.local

# Test webhook (use ngrok for external access)
ngrok http 54321
```

### Manual API Test

```bash
# Get JWT token from browser localStorage (supabase.auth.token)

# Create payment
curl -X POST 'http://localhost:54321/functions/v1/create-payment' \
  -H 'Authorization: Bearer YOUR_JWT_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{"product_type": "basic"}'

# Check credits (via Supabase client in app)
```

## Environment Files

### .env.local (for local development)

```env
YUKASSA_SHOP_ID=test_shop_id
YUKASSA_SECRET_KEY=test_secret_key
YUKASSA_WEBHOOK_SECRET=test_webhook_secret
```

### Production (Supabase Secrets)

Set via `supabase secrets set` command (see Step 3).

## Rollback Plan

If issues occur after deployment:

1. **Disable Edge Functions**:
   ```bash
   supabase functions delete create-payment
   supabase functions delete payment-webhook
   ```

2. **Rollback Migrations**:
   ```sql
   DROP TABLE IF EXISTS user_credits;
   DROP TABLE IF EXISTS purchases;
   DROP FUNCTION IF EXISTS grant_credits;
   ```

3. **Remove Frontend Changes**:
   ```bash
   git revert HEAD~N  # Revert N commits
   ```
