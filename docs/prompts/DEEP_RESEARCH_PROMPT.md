# Deep Research Prompt: Backend Architecture for AI-Powered Telegram Bot

**Purpose**: Research best practices, frameworks, and real-world examples for building a multi-mode conversational AI backend.

---

## Project Context: Symancy

### What is Symancy?

Symancy is an AI-powered coffee ground reading application (similar to fortune telling / tasseography). Users upload photos of their coffee cup, and an AI "psychologist" named Arina analyzes the patterns and provides psychological insights.

**Current State**:
- Frontend: React 19 + Vite SPA (deployed at symancy.ru)
- Database: Supabase (PostgreSQL)
- Payments: YooKassa (Russian payment provider)
- Current AI Backend: n8n workflow (low-code, needs migration to proper backend)
- Channels: Web + Telegram Bot

**Target State**:
- Migrate from n8n to a proper Node.js backend
- Support multiple interaction modes (see below)
- Scalable architecture for future growth

---

## The 5 Interaction Modes

The bot must handle 5 distinct interaction modes, each with different requirements:

### Mode 1: Photo Analysis (Core Feature)

```
Trigger: User sends a photo of coffee grounds
Flow:
  1. Download & resize image (800x800, JPEG)
  2. Vision AI: Analyze patterns in the image (OpenRouter API)
  3. Interpretation AI: Generate psychological reading based on patterns
  4. Save to chat memory
  5. Send response (may need splitting for Telegram's 4096 char limit)

Requirements:
- Vision model: Configurable (default: google/gemini-1.5-flash)
- Interpretation model: Configurable (default: google/gemini-1.5-flash)
- Credits: Consumes 1 "basic" credit per analysis
- Memory: Save analysis to chat history for follow-up questions
- Persona: "Arina" - warm, professional psychologist
```

### Mode 2: Chat / Follow-up

```
Trigger: User sends text message (not a command, not a photo)
Flow:
  1. Load chat history (last 20 messages)
  2. Generate contextual response based on previous analyses
  3. Save to chat memory

Requirements:
- Model: Cheaper model sufficient (e.g., gpt-oss-20b)
- Credits: Free (within session) or limited free messages
- Memory: Must remember previous photo analyses
- Persona: Same "Arina" personality
```

### Mode 3: Cassandra Premium

```
Trigger: User has "cassandra" credits OR sends /cassandra command
Flow:
  1. Download & resize image
  2. Vision AI: More detailed pattern analysis
  3. Premium Interpretation: Extended mystical reading
  4. Save to chat memory
  5. Send response (longer, more detailed)

Requirements:
- Vision model: Best available
- Interpretation model: Premium (e.g., gpt-4o, claude-3.5-sonnet)
- Credits: Consumes 1 "cassandra" credit (expensive tier)
- Persona: "Cassandra" - mystical oracle, different style from Arina
- Output: More sections, deeper analysis, mystical language
```

### Mode 4: Onboarding

```
Trigger: /start command OR new user
Flow:
  1. Welcome message explaining the service
  2. Ask for user's name
  3. Ask about their goals (career, relationships, health, etc.)
  4. Ask notification preferences (daily, weekly, never)
  5. Complete onboarding, offer first free analysis

Requirements:
- State machine: Track onboarding progress
- Persistence: Save user profile to database
- Interactive: Use Telegram inline keyboards for choices
- Resumable: If user abandons, can resume later
```

### Mode 5: Proactive Engagement

```
Trigger: Scheduled jobs (cron) OR time-based events
Scenarios:
  - "Haven't seen you in a while" (7 days inactive)
  - "Weekly check-in" (how are Arina's recommendations working?)
  - "Daily fortune" (optional subscription)
  - "Complete your onboarding" (abandoned flow reminder)

Requirements:
- Scheduler: Background job processing
- User state: Track last interaction, preferences
- Personalization: Reference previous analyses
- Opt-out: Respect notification preferences
```

---

## Technical Requirements

### Must Have

1. **OpenRouter Integration**
   - All LLM calls go through OpenRouter API (not native OpenAI)
   - OpenRouter provides access to: OpenAI, Anthropic, Google, Meta models
   - Need: Model switching, fallback chains, retry logic

2. **Chat Memory**
   - Store conversation history per user
   - Telegram user ID as session key
   - Last 20 messages context window
   - PostgreSQL storage (Supabase)

3. **Model Configuration**
   - Admin panel to change models without code deploy
   - Per-mode model selection (Mode 1 uses X, Mode 3 uses Y)
   - Fallback chain (if model A fails, try model B)
   - Database-driven configuration

4. **Credit System**
   - Different credit types: "basic", "pro", "cassandra"
   - Check balance before analysis
   - Consume credit after successful analysis
   - Already implemented in Supabase (RPC functions exist)

5. **Telegram Integration**
   - Webhook handler for incoming messages
   - Photo download via Bot API
   - Message sending with HTML formatting
   - Long message splitting (>4096 chars)
   - Typing indicators
   - Inline keyboards for onboarding

6. **State Machine**
   - Track user's current state (idle, onboarding step X, etc.)
   - Persist state across sessions
   - Handle interruptions gracefully

7. **Background Jobs**
   - Scheduled tasks for proactive messages
   - Job queue for async processing
   - Retry failed jobs

### Nice to Have

1. **Observability**
   - Cost tracking per user, per mode
   - Token usage analytics
   - Response time monitoring

2. **Quality Validation**
   - Validate LLM outputs before sending
   - Detect off-topic or low-quality responses
   - Retry with better model if quality fails

3. **Rate Limiting**
   - Prevent abuse
   - Per-user limits

---

## Current Tech Stack

| Layer | Technology | Notes |
|-------|------------|-------|
| Frontend | React 19 + Vite | Deployed, not changing |
| Database | Supabase (PostgreSQL) | Already has tables for users, credits, purchases |
| Auth | Supabase Auth | JWT tokens |
| Payments | YooKassa | Web + Telegram payments implemented |
| Current AI | n8n workflow | Being replaced |
| Hosting | VPS (91.132.59.194) | Docker-ready |

---

## Research Questions

Please research and provide detailed answers for each:

### 1. Framework Selection for LLM Orchestration

**Question**: What is the best approach for Node.js backend with these requirements?

**Options to evaluate**:
- LangChain.js (with or without LangGraph)
- Vercel AI SDK
- Direct OpenAI SDK with custom orchestration
- Other frameworks (Semantic Kernel, Haystack, etc.)

**For each option, provide**:
- Pros and cons for THIS specific use case
- OpenRouter compatibility
- Chat memory support (PostgreSQL)
- Multi-model routing capability
- State machine integration
- Production examples (real companies using it)
- Code example (simple chain with memory)

### 2. State Machine Implementation

**Question**: Best way to implement multi-step flows (onboarding, etc.) in Node.js?

**Options to evaluate**:
- XState
- Robot3
- Custom implementation
- LangGraph (if using LangChain)

**For each, provide**:
- How to persist state to PostgreSQL
- How to handle interruptions
- How to integrate with Telegram bot
- Real-world examples

### 3. Background Job Processing

**Question**: Best scheduler/queue for proactive messages?

**Options to evaluate**:
- BullMQ (Redis-based)
- Agenda (MongoDB-based)
- node-cron (simple cron)
- pg-boss (PostgreSQL-based)

**For each, provide**:
- Pros/cons
- Scalability
- Failure handling
- Integration with Supabase

### 4. Real-World Examples

**Question**: Find production examples of similar architectures:

**Looking for**:
- Telegram bots with LLM integration
- Multi-persona AI assistants
- Conversational AI with memory
- Onboarding flows in chat bots
- Proactive engagement in messaging apps

**For each example, provide**:
- Architecture overview
- Tech stack used
- What we can learn from it

### 5. OpenRouter Best Practices

**Question**: How to properly integrate OpenRouter in production?

**Looking for**:
- Model routing patterns
- Fallback strategies
- Cost optimization
- Error handling
- Rate limit handling
- Caching strategies

### 6. Chat Memory Patterns

**Question**: Best practices for conversational memory in production?

**Looking for**:
- How to structure memory tables
- Context window management
- Memory summarization (for long conversations)
- Memory across sessions
- Privacy considerations

### 7. Message Formatting for Telegram

**Question**: How to handle long AI responses in Telegram?

**Looking for**:
- Message splitting strategies
- HTML tag balancing
- Typing indicators during long operations
- Error message formatting

---

## Expected Output Format

Please provide a comprehensive research report with:

1. **Executive Summary** (1 paragraph)
   - Top recommendation for each question

2. **Detailed Findings** (per question)
   - Comparison tables
   - Pros/cons analysis
   - Code examples where applicable
   - Links to documentation/examples

3. **Recommended Architecture**
   - High-level diagram
   - Technology stack recommendation
   - Folder structure suggestion

4. **Risk Assessment**
   - Potential issues
   - Mitigation strategies

5. **Implementation Roadmap**
   - Suggested phases
   - Dependencies between components

---

## Constraints

- **Language**: Node.js / TypeScript (not Python)
- **Database**: Must use Supabase (PostgreSQL)
- **LLM Provider**: OpenRouter (not direct OpenAI/Anthropic)
- **Hosting**: Self-hosted VPS (not serverless)
- **Budget**: Cost-conscious (prefer cheaper models when possible)

---

## Success Criteria

The research is successful if it answers:

1. Should we use LangChain.js or Direct SDK for this project?
2. What's the best state machine library for onboarding flows?
3. What's the best job queue for proactive messages?
4. How should we structure the chat memory tables?
5. What's the recommended folder structure for this backend?

---

**Note**: This is a RESEARCH task. Please find real examples, documentation, and best practices. Do not just provide opinions - back everything with sources and evidence.
