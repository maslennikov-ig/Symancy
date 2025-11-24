# Research: Pre-MVP Payment Integration

**Feature**: 002-pre-mvp-payments
**Date**: 2025-11-23
**Status**: Complete

## Research Questions

### RQ-001: Which YooKassa integration method to use?

**Decision**: YooMoney Checkout Widget with `react-yoomoneycheckoutwidget` wrapper

**Rationale**:
1. **Official solution** - YooMoney Checkout Widget is the recommended approach from YooKassa
2. **PCI DSS compliance** - Widget handles card data, no sensitive data on our servers
3. **54-FZ compliance** - Built-in online cash register support
4. **All payment methods** - Cards, SBP, Apple Pay, Google Pay, Mir Pay, YooMoney wallet
5. **React wrapper exists** - `react-yoomoneycheckoutwidget` on npm (v1.1.30, updated 1 month ago)

**Alternatives Considered**:
| Option | Pros | Cons | Verdict |
|--------|------|------|---------|
| Checkout Widget | Official, all methods, 54-FZ | Requires backend for token | **Selected** |
| Checkout.js | More customization | Lower-level, more code | Rejected |
| Direct API | Full control | PCI DSS compliance required | Rejected |
| Telegram Stars | Native in Telegram | Not on web, 30% commission | Future phase |

**Implementation**:
```typescript
// Frontend: Load widget and render
import YooMoneyCheckoutWidget from 'react-yoomoneycheckoutwidget';

<YooMoneyCheckoutWidget
  confirmation_token={token}  // From backend
  return_url={window.location.origin + '/payment/success'}
  error_callback={(error) => console.error(error)}
/>
```

**Sources**:
- [YooKassa Widget Docs](https://yookassa.ru/developers/payment-acceptance/integration-scenarios/widget/quick-start)
- [react-yoomoneycheckoutwidget](https://github.com/pavelety/react-yoomoneycheckoutwidget)

---

### RQ-002: Backend architecture for payment processing?

**Decision**: Supabase Edge Functions (Deno)

**Rationale**:
1. **Direct Supabase integration** - Built-in access to database without external connections
2. **Already using Supabase** - Auth and database already on Supabase
3. **Secure secrets** - Environment variables managed via Supabase Vault
4. **TypeScript/Deno** - Modern runtime with built-in crypto for signature verification
5. **Global edge deployment** - Low latency for webhook processing

**Alternatives Considered**:
| Option | Pros | Cons | Verdict |
|--------|------|------|---------|
| Supabase Edge Functions | Direct DB access, same platform | Deno (not Node) | **Selected** |
| Netlify Functions | Node.js, familiar | Separate deployment, DB connection | Rejected |
| n8n workflow | Visual, flexible | Overkill, another system | Rejected |
| Vercel Edge | Fast | Not using Vercel | Rejected |

**Edge Functions Needed**:
1. `create-payment` - Creates YooKassa payment, returns confirmation_token
2. `payment-webhook` - Handles YooKassa webhook, updates database

**Sources**:
- [Supabase Edge Functions Docs](https://supabase.com/docs/guides/functions)
- [Stripe Webhook Example](https://supabase.com/docs/guides/functions/examples/stripe-webhooks)

---

### RQ-003: How to verify YooKassa webhook signatures?

**Decision**: HMAC-SHA256 signature verification using Deno crypto

**Implementation**:
```typescript
// Supabase Edge Function: payment-webhook/index.ts
import { createClient } from 'npm:@supabase/supabase-js@2'

const verifyYooKassaSignature = async (
  body: string,
  signature: string,
  secret: string
): Promise<boolean> => {
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const signatureBuffer = await crypto.subtle.sign(
    'HMAC',
    key,
    encoder.encode(body)
  )
  const expectedSignature = btoa(String.fromCharCode(...new Uint8Array(signatureBuffer)))
  return signature === expectedSignature
}
```

**Webhook Payload Structure** (from YooKassa):
```json
{
  "type": "notification",
  "event": "payment.succeeded",
  "object": {
    "id": "payment-id",
    "status": "succeeded",
    "amount": { "value": "100.00", "currency": "RUB" },
    "metadata": { "user_id": "uuid", "product_type": "basic" }
  }
}
```

---

### RQ-004: Database schema for purchases and credits?

**Decision**: Two tables with RLS policies

**Schema**:
```sql
-- purchases: Payment transaction records
CREATE TABLE purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  product_type TEXT NOT NULL CHECK (product_type IN ('basic', 'pack5', 'pro', 'cassandra')),
  amount_rub INTEGER NOT NULL CHECK (amount_rub IN (100, 300, 500, 1000)),
  yukassa_payment_id TEXT UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'succeeded', 'canceled')),
  credits_granted INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  paid_at TIMESTAMPTZ,
  metadata JSONB
);

-- user_credits: Current credit balance per user
CREATE TABLE user_credits (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id),
  basic_credits INTEGER NOT NULL DEFAULT 0 CHECK (basic_credits >= 0),
  pro_credits INTEGER NOT NULL DEFAULT 0 CHECK (pro_credits >= 0),
  cassandra_credits INTEGER NOT NULL DEFAULT 0 CHECK (cassandra_credits >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS Policies
ALTER TABLE purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_credits ENABLE ROW LEVEL SECURITY;

-- Users can read their own purchases
CREATE POLICY "Users can view own purchases"
  ON purchases FOR SELECT
  USING (auth.uid() = user_id);

-- Users can read their own credits
CREATE POLICY "Users can view own credits"
  ON user_credits FOR SELECT
  USING (auth.uid() = user_id);

-- Service role can insert/update (Edge Functions use service role)
CREATE POLICY "Service role full access purchases"
  ON purchases FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');

CREATE POLICY "Service role full access credits"
  ON user_credits FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');
```

**Credit Mapping**:
| Product Type | Amount | Credits Granted |
|-------------|--------|-----------------|
| basic | 100 RUB | 1 basic_credit |
| pack5 | 300 RUB | 5 basic_credits |
| pro | 500 RUB | 1 pro_credit |
| cassandra | 1000 RUB | 1 cassandra_credit |

---

### RQ-005: Frontend payment flow?

**Decision**: Modal-based tariff selection → Widget rendering → Success redirect

**User Flow**:
```
1. User clicks "Купить анализ" button
   ↓
2. TariffSelector modal opens with 4 options
   ↓
3. User selects tariff, clicks "Оплатить"
   ↓
4. Frontend calls Edge Function `create-payment`
   ↓
5. Backend creates YooKassa payment, returns confirmation_token
   ↓
6. Frontend renders YooMoneyCheckoutWidget with token
   ↓
7. User completes payment in widget
   ↓
8. YooKassa redirects to return_url (/payment/success)
   ↓
9. Success page shows confirmation
   ↓
10. YooKassa sends webhook → Edge Function updates DB
```

**Component Structure**:
```
components/payment/
├── TariffSelector.tsx    # Modal with 4 tariff cards
├── PaymentWidget.tsx     # YooMoney widget wrapper
├── PurchaseHistory.tsx   # User's purchase history
└── PaymentSuccess.tsx    # Success confirmation page
```

---

## Environment Variables

**Supabase Edge Functions Secrets**:
```bash
# Set via Supabase CLI or Dashboard
supabase secrets set YUKASSA_SHOP_ID=xxx
supabase secrets set YUKASSA_SECRET_KEY=xxx
supabase secrets set YUKASSA_WEBHOOK_SECRET=xxx
```

**YooKassa Test Mode**:
- Shop ID: Test shop ID from YooKassa dashboard
- Use test cards from YooKassa documentation
- Webhook URL must be publicly accessible (use ngrok for local dev)

---

## Dependencies to Install

**Frontend (npm)**:
```bash
npm install react-yoomoneycheckoutwidget
```

**Supabase CLI** (for Edge Functions):
```bash
# Already have Supabase CLI
supabase functions new create-payment
supabase functions new payment-webhook
```

---

---

### RQ-006: How to send email confirmation after payment?

**Decision**: Resend API via Supabase Edge Functions

**Rationale**:
1. **Free tier sufficient** - 100 emails/day (Pre-MVP: ~10-50 expected)
2. **Deno compatible** - Works in Supabase Edge Functions
3. **Simple API** - Single HTTP call to send email
4. **Deliverability** - Better than self-hosted SMTP

**Alternatives Considered**:
| Option | Pros | Cons | Verdict |
|--------|------|------|---------|
| Resend | Free tier, simple API, Deno support | New account needed | **Selected** |
| Supabase Email | Native integration | Limited customization | Rejected |
| SendGrid | Industry standard | Overkill for Pre-MVP | Rejected |
| YooKassa receipt only | No extra service | Not a "thank you" email | Insufficient |

**Implementation**:
```typescript
// In payment-webhook Edge Function
import { Resend } from 'npm:resend'

const resend = new Resend(Deno.env.get('RESEND_API_KEY'))

await resend.emails.send({
  from: 'Symancy <noreply@symancy.ru>',
  to: userEmail,
  subject: 'Спасибо за покупку! ☕',
  html: `
    <h1>Ваш баланс пополнен</h1>
    <p>Вы приобрели: ${productName}</p>
    <p>Начислено кредитов: ${credits}</p>
    <p>Теперь вы можете получить расшифровку кофейной гущи!</p>
  `
})
```

**Environment Variable**:
```
RESEND_API_KEY=re_xxx
```

---

### RQ-007: How to track conversion analytics?

**Decision**: Simple `payment_analytics` table in Supabase

**Rationale**:
1. **Minimal overhead** - Just INSERT on events
2. **No external service** - Uses existing Supabase
3. **Queryable** - SQL for metrics calculation
4. **Privacy compliant** - User IDs optional, can aggregate

**Events to Track**:
| Event | When | Data |
|-------|------|------|
| `tariff_view` | Modal opened | user_id (optional), timestamp |
| `payment_started` | "Оплатить" clicked | user_id, product_type |
| `payment_succeeded` | Webhook success | user_id, product_type, amount |
| `payment_canceled` | Webhook cancel | user_id, product_type |

**Metrics Query**:
```sql
-- Conversion rate (last 7 days)
SELECT
  COUNT(*) FILTER (WHERE event = 'payment_succeeded') * 100.0 /
  NULLIF(COUNT(*) FILTER (WHERE event = 'tariff_view'), 0) as conversion_rate
FROM payment_analytics
WHERE created_at > NOW() - INTERVAL '7 days';
```

---

## Open Items

| Item | Status | Owner |
|------|--------|-------|
| YooKassa merchant registration | Pending | Client |
| Test shop credentials | Pending | Client |
| Webhook URL configuration | During implementation | Developer |
| Resend account setup | Pending | Developer |
| Email domain verification (symancy.ru) | Pending | Client |
