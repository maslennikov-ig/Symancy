This architecture design prioritizes **operational simplicity** and **robustness**. It leverages your existing Supabase PostgreSQL infrastructure to handle state and background job queues, eliminating the need for a separate Redis instance. This reduces costs and complexity for a small team.

---

# Architecture Design Document: Symancy AI Backend

## 1. Architecture Overview

**Pattern: Modular Monolith with Asynchronous Job Queue**

We will build a single Node.js application that can run in two logical roles (configurable via environment variables):

1. **Web Server (HTTP)**: Handles fast, synchronous requests (Telegram Webhooks, Payment callbacks).
2. **Worker (Background)**: Handles slow, asynchronous tasks (Image processing, LLM generation, Scheduled messages).

### High-Level System Diagram

```mermaid
graph TD
    User((User)) <-->|HTTPS| Telegram[Telegram API]
    Telegram -- Webhook --> API[Node.js API Server]
    
    subgraph "Symancy Backend Container"
        API -->|1. Route & Validate| Router[Bot Router]
        Router -->|2. Enqueue| Queue[pg-boss (Postgres Queue)]
        
        Scheduler[Internal Scheduler] -->|Trigger| Queue
        
        Queue -->|3. Consume| Worker[Job Worker]
        
        Worker -->|Read/Write| DB[(Supabase PostgreSQL)]
        Worker -->|Generate| AI[OpenRouter API]
        Worker -->|Reply| Telegram
    end

```

### Data Flow by Mode

| Mode | Flow Description |
| --- | --- |
| **1. Photo Analysis** | **Async**. Webhook receives photo → Checks DB for concurrency/credits → Pushes `analyze_photo` job → Returns `200 OK`. Worker picks up job → Downloads Image → Calls Vision AI → Deducts Credit → Saves Result → Sends Reply. |
| **2. Chat** | **Async (Recommended)**. Webhook receives text → Pushes `chat_reply` job. Worker loads memory + last analysis → Calls Chat LLM → Sends Reply. |
| **3. Cassandra (Pro)** | **Async**. Same as Mode 1, but Worker selects "Cassandra" Strategy (Premium Model + Mystical Prompt) and deducts "cassandra" credit. |
| **4. Onboarding** | **Sync**. Webhook receives update → Router detects `onboarding` state → Executes State Machine transition → Updates DB → Sends next question immediately. |
| **5. Proactive** | **Scheduled**. `pg-boss` Scheduler runs cron → Queries inactive users → Pushes `engage_user` jobs → Worker generates personalized message → Sends. |

---

## 2. Technology Decisions

| Decision Point | Chosen Solution | Reasoning |
| --- | --- | --- |
| **Server Framework** | **Fastify** | 2x faster than Express, lower overhead, and native TypeScript support. Essential for handling webhook spikes. |
| **Bot Framework** | **grammY** | The modern standard for Node.js Telegram bots. Superior type inference and middleware architecture compared to Telegraf. |
| **Job Queue** | **pg-boss** | **Critical Decision**. A job queue built *on top of PostgreSQL*. Uses `SKIP LOCKED` for concurrency. Allows us to use Supabase for the queue, **avoiding Redis** completely. |
| **LLM Interface** | **OpenAI SDK** | The standard SDK is fully compatible with OpenRouter (via `baseURL`). Avoids the unnecessary abstraction and debugging complexity of LangChain. |
| **Validation** | **Zod** | Used to strictly validate Environment variables, Webhook payloads, and **LLM JSON outputs** (preventing broken JSON errors). |
| **Database Client** | **Supabase JS** | Your team already knows it. We will use it for standard CRUD. For complex transactions (credits), we will use RPC calls. |

---

## 3. Database Schema Extensions

We extend the Supabase schema to support conversational memory, state management, and dynamic configuration.

```sql
-- 1. Conversation Memory (Linear Chat History)
CREATE TABLE chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  -- Metadata links messages to specific analyses or token counts
  metadata JSONB DEFAULT '{}', -- e.g. { "related_analysis_id": "...", "model": "gpt-4o" }
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_chat_messages_user_recent ON chat_messages(user_id, created_at DESC);

-- 2. User State Machine (For Onboarding)
CREATE TABLE user_states (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id),
  current_mode TEXT DEFAULT 'chat', -- 'onboarding', 'chat', 'processing_photo'
  flow_step TEXT, -- 'ask_name', 'ask_goals', 'completed'
  buffer_data JSONB DEFAULT '{}', -- Temporary storage for multi-step data
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. System Configuration (Dynamic tweaking)
CREATE TABLE system_config (
  key TEXT PRIMARY KEY, -- e.g. 'prompt_arina_system', 'model_vision_id'
  value TEXT NOT NULL,
  description TEXT
);
-- pg-boss will automatically create a 'pgboss' schema for its internal tables.

```

---

## 4. API & Interface Design

### Internal Job Payloads (pg-boss)

Defining strictly typed payloads is crucial for the Worker to process jobs correctly.

```typescript
// Queue: 'analyze_photo'
interface AnalyzePhotoJob {
  userId: string;
  chatId: number;
  fileId: string;
  persona: 'arina' | 'cassandra'; // Determines prompt & cost
  messageIdToReply: number;
}

// Queue: 'chat_reply'
interface ChatReplyJob {
  userId: string;
  chatId: number;
  text: string; // The user's input
  messageId: number;
}

```

### Persona Strategy Interface

To handle Multi-Persona Management (Question #7) cleanly without `if/else` chains.

```typescript
interface IPersonaStrategy {
  id: 'arina' | 'cassandra';
  // Returns the system prompt, injecting user name/context
  getSystemPrompt(profile: UserProfile, history: AnalysisHistory[]): string;
  // Returns model config
  getModelConfig(): { model: string; temperature: number };
  // Formats the raw LLM output into a Telegram message
  formatResponse(analysis: AnalysisResult): string;
}

```

---

## 5. Folder Structure

We will use a **Domain-Driven (Feature Slices)** structure. This keeps related logic (DB, Service, Types) together.

```text
src/
├── app.ts                  # Application Entrypoint
├── config/                 # Env Vars & Zod Schemas
├── core/                   # Shared Infrastructure
│   ├── database.ts         # Supabase Client
│   ├── queue.ts            # pg-boss Wrapper
│   ├── llm.ts              # OpenRouter/OpenAI Wrapper
│   └── telegram.ts         # grammY Bot Instance
├── modules/
│   ├── router/             # Main Webhook Dispatcher
│   │   ├── middleware.ts   # Auth & State Loading
│   │   └── routes.ts       # Route Definitions
│   ├── onboarding/         # Mode 4
│   │   ├── flow.ts         # State Machine Logic
│   │   └── service.ts      # Profile DB Updates
│   ├── analysis/           # Mode 1 & 3
│   │   ├── analysis.worker.ts
│   │   ├── vision.service.ts
│   │   └── strategies/     # Arina vs Cassandra Logic
│   ├── chat/               # Mode 2
│   │   ├── chat.worker.ts
│   │   └── memory.repo.ts  # History retrieval
│   └── engagement/         # Mode 5
│       ├── scheduler.ts    # Cron Setup
│       └── proactive.worker.ts
└── utils/
    ├── html-splitter.ts    # Algorithm for long messages
    └── error-handler.ts

```

---

## 6. Key Algorithms

### A. Message Router (Dispatcher)

Runs in the **Web Server**. Must be fast.

```typescript
// Pseudocode for modules/router/routes.ts
bot.on("message", async (ctx) => {
  const userId = ctx.from.id;
  const state = await db.getUserState(userId);

  // 1. Priority: Onboarding
  if (state.current_mode === 'onboarding') {
    return OnboardingFlow.handle(ctx, state);
  }

  // 2. Priority: Photos (Mode 1 & 3)
  if (ctx.message.photo) {
    // Concurrency Check: Is a job already running?
    const pending = await queue.getPendingJob(userId);
    if (pending) return ctx.reply("I am still reading your last cup! ☕");

    // Determine Persona & Cost
    const isPremium = ctx.message.caption?.includes("/premium");
    const persona = isPremium ? 'cassandra' : 'arina';

    // Enqueue
    await queue.publish('analyze_photo', { 
      userId, 
      fileId: ctx.message.photo[0].file_id, 
      persona 
    });
    return ctx.reply("Let me look into the grounds...");
  }

  // 3. Default: Chat (Mode 2)
  await queue.publish('chat_reply', { userId, text: ctx.message.text });
});

```

### B. Chat Memory Retrieval (Context Window)

1. **Fetch History**: `SELECT * FROM chat_messages WHERE user_id = ? ORDER BY created_at DESC LIMIT 20`.
2. **Fetch Context**: Get the **most recent** `analysis_history` entry.
3. **Construct Prompt**:
> "System: You are Arina...
> Context: The user previously showed a cup with [Patterns]. You predicted [Fortune].
> History: [Last 20 messages]"



### C. Smart Message Splitter (HTML Aware)

Telegram limits messages to 4096 chars. Simple slicing breaks HTML tags (e.g., `<b`).

**Algorithm**:

1. **Check Length**: If `<= 4000`, send as is.
2. **Split**: Find the last paragraph break `\n\n` before index 4000.
3. **Balance Tags**:
* Maintain a stack of open tags found in Part 1.
* If stack is not empty at split point, append closing tags to Part 1 (`</b>`).
* Prepend the same opening tags to Part 2 (`<b>`).


4. **Send**: Send Part 1 → Sleep 500ms → Send Part 2.

---

## 7. Error Handling Matrix

| Error Scenario | User Message | System Action |
| --- | --- | --- |
| **Vision Model Timeout** | "The spirits are silent (Network error). Let me try again." | Retry Job (3x with exponential backoff). |
| **Vision: No patterns found** | "I cannot see the grounds clearly. Please take a closer photo." | Mark Job Failed. **Refund Credit**. |
| **Insufficient Credits** | "You need more energy (credits) for this reading." | Send Upsell Invoice Button. Abort Job. |
| **LLM Invalid JSON** | (None) | Retry internally with "Fix JSON" prompt. |
| **Telegram Rate Limit** | (None) | `pg-boss` automatically throttles based on error. |

---

## 8. Configuration Schema

We use **Database-First Config** with In-Memory Caching (1 min TTL).

**`system_config` table:**

* `model_arina`: `google/gemini-2.0-flash` (Fast, cheap, capable)
* `model_cassandra`: `anthropic/claude-3.5-sonnet` (Premium, creative)
* `cost_basic`: `1`
* `onboarding_questions`: JSON Array of steps.

*Benefit*: You can switch models or adjust Arina's "tone" instantly via the Supabase Dashboard without redeploying.

---

## 9. Deployment Architecture

**Docker** ensures consistency. We use a single image entrypoint that can run as API or Worker.

**`Dockerfile`**:

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build
# Tini handles PID 1 signals correctly
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "dist/app.js"]

```

**`docker-compose.yml` (Production)**:

```yaml
services:
  symancy:
    build: .
    restart: always
    environment:
      # Use Transaction Pooler (Port 6543) for stability
      DATABASE_URL: "postgres://postgres:[PWD]@db.supabase.co:6543/postgres"
      OPENROUTER_KEY: "sk-..."
      TELEGRAM_TOKEN: "..."
      # Run both in one container for MVP, or split into two services later
      MODE: "BOTH" 

```

---

## 10. Implementation Phases

**Phase 1: Foundation (Days 1-3)**

* Setup Fastify, grammY, and Supabase connection.
* Initialize `pg-boss`.
* Build the "Echo" bot: Webhook → Queue → Worker → Reply.

**Phase 2: The Vision (Days 4-7)**

* Implement **Mode 1**.
* Connect OpenRouter Vision API.
* Implement `consume_credit` RPC in Supabase.
* *Result*: User sends photo -> Credit deducted -> Analysis received.

**Phase 3: The Brain (Days 8-10)**

* Implement `chat_messages` table and **Mode 2**.
* Build the Memory Retrieval logic.
* Implement **Mode 4 (Onboarding)** state machine.

**Phase 4: Polish & Proactive (Days 11-14)**

* Implement **Mode 5** (Scheduler).
* Add Message Splitter for long readings.
* Add "Cassandra" Persona.
* Finalize Error Handling.