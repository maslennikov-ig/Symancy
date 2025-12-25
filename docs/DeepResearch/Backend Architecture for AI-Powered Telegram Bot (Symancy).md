# Backend Architecture for AI-Powered Telegram Bot (Symancy)

**Your n8n-to-Node.js migration has clear winners: LangChain.js for LLM orchestration, pg-boss for background jobs, and grammY for Telegram integration.** This stack leverages your existing Supabase PostgreSQL investment while providing production-grade tooling used by companies like Klarna and Supabase itself. The architecture supports all 5 interaction modes with proper state management, chat memory, and proactive engagement—all without adding Redis or MongoDB to your infrastructure.

---

## Executive summary: Top recommendations

| Question | Recommendation | Rationale |
|----------|---------------|-----------|
| **LLM Framework** | LangChain.js (simple flows) or + LangGraph (complex) | Native PostgreSQL memory, OpenRouter compatible, production-proven |
| **State Machine** | grammY Conversations Plugin + custom PostgreSQL | Purpose-built for Telegram, persistent, resumable |
| **Job Queue** | pg-boss | Uses Supabase PostgreSQL directly, timezone-aware cron, no new infrastructure |
| **Bot Framework** | grammY | Superior TypeScript, excellent docs, conversations plugin |
| **Chat Memory** | Three-table schema (users, sessions, messages) | Efficient retrieval, summarization support, RLS-ready |

---

## LLM framework: LangChain.js wins for your use case

The framework decision hinges on PostgreSQL memory support—and LangChain.js is the only framework with native PostgreSQL chat history built-in.

### OpenRouter compatibility across frameworks

All three major options work with OpenRouter, but with different levels of integration:

**Vercel AI SDK** has an official first-party provider maintained by OpenRouter (`@openrouter/ai-sdk-provider`), making it the cleanest API. **LangChain.js** requires configuration of `baseURL` on the ChatOpenAI class but is well-documented. The **direct OpenAI SDK** works seamlessly since OpenRouter is fully OpenAI-compatible.

```typescript
// LangChain.js + OpenRouter setup
import { ChatOpenAI } from "@langchain/openai";

const model = new ChatOpenAI({
  model: "anthropic/claude-3.5-sonnet",
  configuration: {
    baseURL: "https://openrouter.ai/api/v1",
  },
  apiKey: process.env.OPENROUTER_API_KEY,
});
```

### PostgreSQL memory support determines the winner

**LangChain.js provides PostgresChatMessageHistory** out of the box, eliminating the need to build message storage, session management, or context window handling yourself. Vercel AI SDK requires complete DIY implementation—you'd be writing the same code LangChain already provides.

```typescript
// LangChain.js native PostgreSQL memory
import { PostgresChatMessageHistory } from "@langchain/community/stores/message/postgres";

const chatHistory = new PostgresChatMessageHistory({
  sessionId: `telegram-${userId}`,
  pool: supabasePool,
});
```

### When to add LangGraph

For your 5 interaction modes with mode transitions and conditional logic, **LangGraph adds value**. It provides native state machine architecture with built-in PostgreSQL persistence via checkpointers. The overhead is justified for complex flows—but for simple chat responses, plain LangChain chains suffice.

**Use LangGraph for**: Photo Analysis flow, Cassandra Premium routing, complex multi-step interpretations
**Use plain LangChain for**: Simple chat/follow-up, basic message-response patterns

### Production validation

LangChain.js powers production systems at **Klarna** (AI assistant reducing query resolution by 80%), **Elastic** (security assistant for 20,000+ customers), **LinkedIn** (recruiting agents), and **Replit** (coding assistants for millions of users). The Vercel AI SDK is excellent but optimized for serverless—less documentation exists for self-hosted VPS deployments.

---

## State machine: grammY conversations plugin for onboarding

Your onboarding flow is linear (welcome → name → goals → notifications → complete), making heavy state machine libraries overkill. The grammY conversations plugin was built specifically for this use case.

### Why grammY conversations beats XState for Telegram

**XState** (17KB bundle, ~25K GitHub stars) provides enterprise-grade state machines with visual debugging via Stately Studio. However, it requires manual PostgreSQL persistence implementation and adds unnecessary complexity for linear flows.

**grammY conversations** provides:
- Automatic state persistence to PostgreSQL
- Native async/await syntax that matches Telegram bot patterns
- Built-in interruption handling (user closes app, returns days later)
- Zero state machine boilerplate

```typescript
// grammY conversations - natural async flow
async function onboarding(conversation, ctx) {
  await ctx.reply("Welcome! What's your name?");
  const nameCtx = await conversation.wait();
  const name = nameCtx.message?.text;
  
  await ctx.reply(`Hi ${name}! What are your goals?`);
  const goalsCtx = await conversation.wait();
  
  // Automatically persists between messages
  await saveUser(ctx.from.id, { name, goals: goalsCtx.message?.text });
  await ctx.reply("You're all set! 🎉");
}
```

### Handling the 4 key scenarios

**Scenario 1: User returns 2 days later** — grammY automatically restores conversation state from PostgreSQL. User continues exactly where they left off.

**Scenario 2: Unexpected message during onboarding** — The `conversation.wait()` pattern lets you validate input and loop until valid:

```typescript
let name = '';
while (!name) {
  await ctx.reply("What's your name?");
  const response = await conversation.wait();
  name = response.message?.text?.trim();
  if (!name) await ctx.reply("Please enter a valid name.");
}
```

**Scenario 3: User wants to restart** — Clear conversation state and re-enter:
```typescript
bot.command('restart', async (ctx) => {
  await ctx.conversation.exit();
  await ctx.conversation.enter('onboarding');
});
```

**Scenario 4: Analytics tracking** — Store step transitions in your database:
```typescript
await conversation.external(() => 
  trackOnboardingStep(userId, 'name_completed')
);
```

### When XState makes sense

If you anticipate complex branching logic (multiple paths based on user type), concurrent flows (onboarding + parallel engagement), or need visual debugging for team collaboration, XState's overhead becomes justified. For now, start with grammY conversations and migrate only if complexity demands it.

---

## Background jobs: pg-boss eliminates infrastructure overhead

Your proactive engagement requirements (inactive reminders, weekly check-ins, daily fortunes) need a persistent job queue. **pg-boss** uses your existing Supabase PostgreSQL—no Redis or MongoDB required.

### Why pg-boss over BullMQ

**BullMQ** is the industry standard with ~2M weekly npm downloads and excellent documentation. However, it requires Redis infrastructure, which adds:
- Additional hosting costs ($15-50/month for managed Redis)
- Operational complexity (Redis persistence configuration, memory management)
- Network latency between your app and Redis

**pg-boss** achieves production-grade job processing using PostgreSQL's `SKIP LOCKED` for efficient job claiming. Supabase itself uses pg-boss internally—it handles their scale.

| Feature | pg-boss | BullMQ |
|---------|---------|--------|
| Infrastructure | Uses existing Supabase | Requires Redis |
| Timezone-aware cron | ✅ Native support | ❌ Manual handling |
| Throughput | ~10K-50K jobs/sec | Higher (Redis is faster) |
| Setup complexity | `npm install pg-boss` | Redis server + npm install |

### Implementation for your 5 use cases

```typescript
const { PgBoss } = require('pg-boss');
const boss = new PgBoss(process.env.SUPABASE_DB_URL);
await boss.start();

// Use Case 1: Inactive user reminder (7 days)
await boss.send('inactive-reminder', 
  { userId: user.id }, 
  { startAfter: '7 days', singletonKey: `inactive-${user.id}` }
);

// Use Case 2: Weekly check-in in user's timezone
await boss.schedule(`checkin-${userId}`, '0 9 * * 1', // Monday 9am
  { userId }, 
  { tz: user.timezone }
);

// Use Case 3: Daily fortune at 8am local time
await boss.schedule(`fortune-${userId}`, '0 8 * * *',
  { userId },
  { tz: user.timezone }
);

// Use Case 4: Retry failed Telegram messages
await boss.createQueue('telegram-send', {
  retryLimit: 5,
  retryBackoff: true, // exponential backoff
  deadLetter: 'telegram-failed'
});

// Use Case 5: Automatic cleanup
const boss = new PgBoss({
  connectionString: process.env.SUPABASE_DB_URL,
  archiveCompletedAfterSeconds: 86400,    // 24h
  deleteArchivedAfterSeconds: 604800,     // 7 days
});
```

### Alternative: Graphile Worker

If you need to trigger jobs from PostgreSQL triggers (e.g., automatically schedule fortune when user completes onboarding), **Graphile Worker** excels. It uses `LISTEN/NOTIFY` for ~3ms latency from schedule to execution. pg-boss is more versatile for general job scheduling.

---

## Chat memory: Three-table architecture with summarization

The most effective pattern for conversational AI memory combines recent messages (for context) with summarized history (for token efficiency) and extracted user facts (for personalization).

### Recommended PostgreSQL schema

```sql
-- Users table
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  telegram_id BIGINT UNIQUE NOT NULL,
  username TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  preferences JSONB DEFAULT '{}'::jsonb
);

-- Sessions (conversations)
CREATE TABLE sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  last_active_at TIMESTAMPTZ DEFAULT NOW(),
  summary TEXT,  -- Progressive summary of older messages
  persona TEXT DEFAULT 'arina', -- 'arina' or 'cassandra'
  is_active BOOLEAN DEFAULT true
);

-- Messages
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  token_count INTEGER,
  metadata JSONB DEFAULT '{}'::jsonb
);

-- User facts (cross-session memory)
CREATE TABLE user_facts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  fact_type TEXT NOT NULL, -- 'preference', 'personality', 'reading_history'
  fact_key TEXT NOT NULL,
  fact_value TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, fact_type, fact_key)
);

-- Indexes for efficient retrieval
CREATE INDEX idx_messages_session ON messages(session_id, created_at DESC);
CREATE INDEX idx_sessions_user ON sessions(user_id, last_active_at DESC);
CREATE INDEX idx_user_facts ON user_facts(user_id, fact_type);
```

### Context window management strategy

For Mode 2 (Chat/Follow-up) requiring "last 20 messages," implement a sliding window with automatic summarization:

```typescript
async function getContextForChat(sessionId: string, userId: string) {
  // Get session summary (older context)
  const { data: session } = await supabase
    .from('sessions')
    .select('summary, persona')
    .eq('id', sessionId)
    .single();

  // Get recent messages (last 20)
  const { data: messages } = await supabase
    .from('messages')
    .select('role, content')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: false })
    .limit(20);

  // Get user facts for personalization
  const { data: facts } = await supabase
    .from('user_facts')
    .select('fact_key, fact_value')
    .eq('user_id', userId);

  return {
    systemPrompt: buildPersonaPrompt(session.persona, session.summary, facts),
    messages: messages.reverse()
  };
}
```

### Automatic summarization every N messages

```typescript
async function summarizeIfNeeded(sessionId: string) {
  const { count } = await supabase
    .from('messages')
    .select('*', { count: 'exact', head: true })
    .eq('session_id', sessionId);

  if (count % 25 === 0) { // Every 25 messages
    const summary = await generateSummary(sessionId);
    await supabase
      .from('sessions')
      .update({ summary })
      .eq('id', sessionId);
  }
}
```

---

## OpenRouter best practices for production

### Model routing by interaction mode

```typescript
const MODEL_CONFIG = {
  // Mode 1: Photo Analysis (needs vision)
  photo_analysis: 'anthropic/claude-3.5-sonnet', // Vision + quality
  
  // Mode 2: Chat/Follow-up (cost-conscious)
  chat: 'openai/gpt-4o-mini', // Fast, cheap
  
  // Mode 3: Cassandra Premium
  cassandra: 'anthropic/claude-3.5-sonnet:thinking', // Best reasoning
  
  // Mode 4: Onboarding (simple)
  onboarding: 'google/gemma-2-9b-it:free', // Free for dev
  
  // Mode 5: Proactive (templated)
  proactive: 'meta-llama/llama-3.2-3b-instruct:free'
};
```

### Automatic fallbacks

```typescript
const completion = await openRouter.chat.send({
  models: [
    'anthropic/claude-3.5-sonnet',  // Primary
    'openai/gpt-4o',                 // Fallback 1
    'google/gemini-pro'              // Fallback 2
  ],
  messages: [...]
});
```

### Error handling with retries

```typescript
async function callWithRetry(request, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await openRouter.chat.send(request);
    } catch (error) {
      if (error.code === 429) { // Rate limit
        await sleep(Math.min(2 ** i * 1000, 30000));
      } else if (error.code >= 500) { // Server error
        await sleep(2 ** i * 1000);
      } else {
        throw error;
      }
    }
  }
  throw new Error('Max retries exceeded');
}
```

---

## Telegram bot patterns: grammY with HTML formatting

### Why grammY over Telegraf

Both are excellent, but **grammY** offers superior TypeScript support with full type inference, better documentation with interactive examples, and a purpose-built conversations plugin. Telegraf has a larger ecosystem but grammY is more actively maintained.

### Message splitting for long AI responses

Telegram limits messages to **4096 characters**. AI responses often exceed this:

```typescript
function splitMessage(text: string, maxLength = 4096): string[] {
  const parts: string[] = [];
  let remaining = text;

  while (remaining.length > 0) {
    if (remaining.length <= maxLength) {
      parts.push(remaining);
      break;
    }

    let part = remaining.slice(0, maxLength);
    // Find natural break point
    const splitIndex = Math.max(
      part.lastIndexOf('\n\n'),
      part.lastIndexOf('\n'),
      part.lastIndexOf('. '),
      part.lastIndexOf(' ')
    );

    parts.push(remaining.slice(0, splitIndex).trim());
    remaining = remaining.slice(splitIndex).trim();
  }

  return parts;
}
```

### Continuous typing indicator

`sendChatAction('typing')` only lasts 5 seconds. For AI responses taking 10-60 seconds:

```typescript
async function withTypingIndicator(ctx, asyncOperation) {
  let active = true;
  
  const typingLoop = async () => {
    while (active) {
      await ctx.sendChatAction('typing');
      await new Promise(r => setTimeout(r, 4000));
    }
  };
  typingLoop(); // Non-blocking
  
  try {
    return await asyncOperation();
  } finally {
    active = false;
  }
}
```

### Use HTML over Markdown

**HTML is easier to escape** for AI output. Markdown requires escaping many characters (`_*[]()~>#+-=|{}.!`), while HTML only needs `<`, `>`, `&`:

```typescript
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

await ctx.reply(formatResponse(aiOutput), { parse_mode: 'HTML' });
```

---

## Recommended folder structure

```
symancy-backend/
├── src/
│   ├── bot/
│   │   ├── index.ts              # Bot initialization
│   │   ├── middleware/           # Auth, logging, error handling
│   │   ├── handlers/
│   │   │   ├── photo.ts          # Mode 1: Photo Analysis
│   │   │   ├── chat.ts           # Mode 2: Chat/Follow-up
│   │   │   ├── cassandra.ts      # Mode 3: Premium
│   │   │   └── onboarding.ts     # Mode 4: Onboarding
│   │   └── keyboards/            # Inline keyboard definitions
│   │
│   ├── llm/
│   │   ├── openrouter.ts         # OpenRouter client setup
│   │   ├── models.ts             # Model routing configuration
│   │   ├── prompts/
│   │   │   ├── arina.ts          # Arina persona system prompt
│   │   │   └── cassandra.ts      # Cassandra persona system prompt
│   │   └── chains/
│   │       ├── analysis.ts       # Photo analysis chain
│   │       └── interpretation.ts # Reading interpretation chain
│   │
│   ├── memory/
│   │   ├── chat-history.ts       # PostgreSQL message storage
│   │   ├── user-facts.ts         # Long-term memory extraction
│   │   └── summarization.ts      # Context summarization
│   │
│   ├── jobs/
│   │   ├── index.ts              # pg-boss setup
│   │   ├── queues.ts             # Queue definitions
│   │   └── handlers/
│   │       ├── reminders.ts      # Inactive user reminders
│   │       ├── daily-fortune.ts  # Mode 5: Daily engagement
│   │       └── weekly-checkin.ts # Weekly check-ins
│   │
│   ├── db/
│   │   ├── supabase.ts           # Supabase client
│   │   ├── migrations/           # SQL migrations
│   │   └── queries/              # Type-safe query functions
│   │
│   └── utils/
│       ├── message-formatter.ts  # HTML formatting, splitting
│       ├── image-processor.ts    # Image download, resize
│       └── telegram-helpers.ts   # Typing indicator, etc.
│
├── package.json
├── tsconfig.json
└── .env
```

---

## Risk assessment and mitigation

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| **LangChain API changes** | Medium | High | Pin versions, follow changelog, have abstraction layer |
| **OpenRouter rate limits** | Medium | Medium | Implement fallback models, request queuing, caching |
| **pg-boss PostgreSQL load** | Low | Medium | Archive completed jobs aggressively, separate connection pool |
| **Long AI responses timeout** | Medium | Low | 60s timeout, graceful degradation, progress indicators |
| **Telegram API rate limits** | Low | Medium | Queue outbound messages, respect 30 msg/sec limit |

---

## Implementation roadmap

### Phase 1: Foundation (Week 1-2)
- Set up grammY bot with TypeScript
- Configure OpenRouter with LangChain.js
- Implement basic chat memory (sessions + messages tables)
- Deploy basic photo analysis flow (Mode 1)

### Phase 2: Core features (Week 3-4)
- Implement onboarding with grammY conversations (Mode 4)
- Add Arina persona system prompt
- Implement Mode 2 (Chat/Follow-up) with context
- Set up pg-boss for background jobs

### Phase 3: Premium & engagement (Week 5-6)
- Implement Cassandra Premium (Mode 3)
- Build proactive engagement jobs (Mode 5)
- Add user facts extraction for personalization
- Implement message summarization

### Phase 4: Production hardening (Week 7-8)
- Add comprehensive error handling
- Implement rate limiting and fallbacks
- Set up monitoring and logging
- Load testing and optimization

---

## Conclusion

The recommended stack—**LangChain.js + grammY + pg-boss + Supabase**—maximizes your existing PostgreSQL investment while providing production-grade tooling. This architecture handles all 5 interaction modes without introducing Redis or MongoDB complexity. 

The key architectural decisions are: use LangChain.js for its native PostgreSQL memory (saving weeks of implementation), grammY's conversations plugin for naturally persistent onboarding flows, and pg-boss for timezone-aware job scheduling using your existing database. Start with the simpler patterns (plain LangChain chains, grammY conversations) and add complexity (LangGraph, XState) only when specific features demand it.