# Deep Think Prompt: Architecture Design for Symancy AI Backend

**Purpose**: Design a production-ready architecture for a multi-mode conversational AI backend. Think through all edge cases, trade-offs, and implementation details.

---

## Project Context: Symancy

### Product Description

Symancy is an AI-powered coffee ground reading application. Users upload photos of their coffee cup, and an AI character analyzes the patterns to provide psychological insights and "fortune readings."

**Key Differentiators**:
- Two AI personas: "Arina" (psychologist) and "Cassandra" (mystical oracle)
- Conversational memory (follow-up questions about previous readings)
- Proactive engagement (bot reaches out to users)
- Monetization through credits (different tiers)

**Current State**:
- Web frontend: React 19 + Vite (symancy.ru) - DONE
- Database: Supabase PostgreSQL - DONE
- Payments: YooKassa integration - DONE
- AI Backend: n8n low-code workflow - NEEDS MIGRATION

**Goal**: Design and build a proper Node.js backend to replace n8n

---

## The 5 Interaction Modes to Support

### Mode 1: Photo Analysis (Arina Basic)

User sends photo → Vision AI analyzes → Interpretation AI generates reading → Response sent

**Characteristics**:
- Most common interaction (~80% of usage)
- Requires Vision model + LLM
- Consumes 1 "basic" credit
- Response can be long (1000-4000 characters)
- Must save to memory for follow-ups

### Mode 2: Chat / Follow-up

User asks question → Load memory → Generate contextual response

**Characteristics**:
- Needs access to previous readings
- No credit cost (or minimal)
- Shorter responses
- Must maintain persona consistency

### Mode 3: Cassandra Premium

User requests premium reading → Enhanced Vision + Premium LLM → Extended mystical analysis

**Characteristics**:
- Different persona (Cassandra vs Arina)
- More detailed analysis (3000-6000 characters)
- Premium models (higher cost)
- Consumes 1 "cassandra" credit
- Different prompt templates

### Mode 4: Onboarding

New user → Multi-step conversation → Collect profile data → Complete

**Characteristics**:
- State machine with 4-5 steps
- Uses Telegram inline keyboards
- Saves user preferences to database
- Can be interrupted and resumed
- Ends with first free reading offer

### Mode 5: Proactive Engagement

Scheduled trigger → Generate personalized message → Send to user

**Scenarios**:
- Inactive user reminder (7 days)
- Weekly check-in (how did advice work?)
- Daily fortune (optional subscription)
- Abandoned onboarding reminder

**Characteristics**:
- Runs as background jobs
- Respects user preferences
- References past interactions
- Needs scheduler + job queue

---

## Technical Constraints

### Must Use

| Technology | Reason |
|------------|--------|
| Node.js 20+ | Team expertise, ecosystem |
| TypeScript | Type safety |
| Supabase | Already used, has data |
| OpenRouter | Model flexibility, cost |
| Docker | Deployment consistency |

### Cannot Use

| Technology | Reason |
|------------|--------|
| Python | Different stack, harder to maintain |
| Serverless/Edge | Need persistent connections, schedulers |
| MongoDB | Already on PostgreSQL |

---

## Existing Database Schema (Supabase)

```sql
-- Already exists
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id),
  telegram_user_id BIGINT UNIQUE,
  display_name TEXT,
  created_at TIMESTAMPTZ
);

CREATE TABLE user_credits (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  credit_type TEXT, -- 'basic', 'pro', 'cassandra'
  balance INTEGER DEFAULT 0
);

CREATE TABLE purchases (
  id UUID PRIMARY KEY,
  user_id UUID,
  product_type TEXT,
  amount_rub INTEGER,
  status TEXT,
  created_at TIMESTAMPTZ
);

CREATE TABLE analysis_history (
  id UUID PRIMARY KEY,
  user_id UUID,
  analysis JSONB, -- Full analysis result
  focus_area TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ
);

-- Existing RPC functions
-- consume_credit(user_id, credit_type) → {success, remaining}
-- grant_credits(user_id, product_type, credits)
```

---

## Design Questions to Think Through

### 1. Overall Architecture Pattern

**Question**: What architectural pattern is best for this system?

**Consider**:
- Monolith vs Microservices
- Event-driven vs Request-response
- Hexagonal/Ports-and-Adapters
- Clean Architecture

**Think about**:
- Team size (1-2 developers)
- Future scaling needs
- Deployment simplicity
- Testing strategy

### 2. LLM Orchestration Layer

**Question**: How to structure the LLM calling logic?

**Requirements**:
- Switch between models dynamically
- Handle retries and fallbacks
- Track costs per request
- Integrate with chat memory

**Options**:
a) LangChain.js with Chains
b) Direct OpenAI SDK with wrappers
c) Custom abstraction layer

**Think about**:
- Complexity vs Flexibility trade-off
- Learning curve for team
- Debugging ease
- Future extensibility (new personas, new modes)

### 3. Message Router Design

**Question**: How to route incoming Telegram messages to correct handler?

**Input**: Raw Telegram update (photo, text, command, callback query)
**Output**: Correct handler invoked with parsed context

**Edge cases to handle**:
- User in onboarding sends photo (interrupt? queue?)
- User sends multiple photos quickly
- User sends text that looks like command but isn't
- Callback from old inline keyboard

**Think about**:
- Priority of modes
- State transitions
- Error handling

### 4. State Machine for Onboarding

**Question**: How to implement multi-step conversational flow?

**Steps**:
1. Welcome → Ask name
2. Receive name → Ask goals (multiple choice)
3. Receive goals → Ask notification preference
4. Receive preference → Complete + offer free reading

**Edge cases**:
- User abandons mid-flow
- User sends photo during onboarding
- User sends /start again during onboarding
- User types instead of clicking button

**Think about**:
- State persistence (database)
- State transitions
- Timeout handling
- Integration with other modes

### 5. Chat Memory Architecture

**Question**: How to structure conversational memory?

**Requirements**:
- Store last 20 messages per user
- Include photo analysis results in memory
- Enable contextual follow-up questions
- Support memory across sessions (days, weeks)

**Think about**:
- Table schema design
- What metadata to store
- How to summarize old messages
- Privacy/GDPR considerations
- Memory retrieval strategy (RAG vs sequential)

### 6. Proactive Engagement System

**Question**: How to implement scheduled outreach?

**Scenarios**:
- Check for inactive users daily at 10:00
- Send weekly digest on Mondays
- Send daily fortune at user's preferred time

**Think about**:
- Job queue selection
- Failure handling
- Timezone management
- Opt-out mechanism
- Rate limiting (don't spam)

### 7. Multi-Persona Management

**Question**: How to handle different AI personas (Arina vs Cassandra)?

**Differences**:
- System prompts (completely different tone)
- Model selection (Cassandra uses premium)
- Response format (Cassandra more detailed)
- Credit cost (different tiers)

**Think about**:
- Prompt template organization
- Persona-specific configurations
- Switching personas mid-conversation
- Future: Adding new personas

### 8. Error Handling Strategy

**Question**: What happens when things go wrong?

**Error scenarios**:
- OpenRouter API down
- Model timeout (30+ seconds)
- Invalid response from LLM
- Credit insufficient
- Image processing fails
- Telegram API fails

**Think about**:
- User-facing error messages
- Retry strategies
- Graceful degradation
- Error logging and alerting

### 9. Message Formatting and Splitting

**Question**: How to handle long AI responses for Telegram?

**Constraints**:
- Telegram limit: 4096 characters
- HTML formatting must be balanced
- Can't cut mid-word or mid-tag

**Think about**:
- Splitting algorithm
- Tag balancing
- Typing indicator during split sending
- Delay between messages

### 10. Configuration Management

**Question**: How to make the system configurable without code changes?

**Configurable items**:
- LLM model per mode
- Temperature settings
- Prompt templates
- Credit costs
- Notification schedules

**Think about**:
- Database-driven config vs file-based
- Admin panel requirements
- Config caching
- Config hot-reload

---

## Edge Cases to Consider

### User Behavior Edge Cases

1. User sends 5 photos in 2 seconds - process all? queue? ignore extras?
2. User sends photo with caption - use caption as context?
3. User replies to old bot message - what context to use?
4. User forwards photo from another chat - analyze?
5. User in group chat mentions bot - respond?

### System Edge Cases

1. LLM returns empty response - retry? fail gracefully?
2. LLM returns response in wrong language - retry with stricter prompt?
3. Vision model can't detect any patterns - what to say?
4. User has 0 credits but sends photo - upsell or reject?
5. Scheduled job fails - retry immediately or delay?

### Concurrency Edge Cases

1. Two messages arrive simultaneously - order matters?
2. Long-running analysis (30s) + user sends another message - queue?
3. Proactive message sending while user is typing - conflict?

---

## Output Requirements

Please provide a comprehensive architecture design document:

### 1. Architecture Overview
- High-level system diagram
- Component breakdown
- Data flow diagrams for each mode

### 2. Technology Decisions
- For each decision point, provide:
  - Chosen solution
  - Reasoning (pros/cons considered)
  - Alternative that was rejected and why

### 3. Database Schema Extensions
- New tables needed
- Indexes required
- RLS policies

### 4. API/Interface Design
- Internal service interfaces
- Message types and payloads
- Event definitions (if event-driven)

### 5. Folder Structure
- Detailed project structure
- File naming conventions
- Module organization

### 6. Key Algorithms
- Message routing logic (pseudocode)
- State machine transitions (diagram)
- Message splitting algorithm
- Memory retrieval strategy

### 7. Error Handling Matrix
- Error type → User message → System action → Logging

### 8. Configuration Schema
- What's configurable
- Default values
- Validation rules

### 9. Deployment Architecture
- Docker setup
- Environment variables
- Health checks
- Scaling considerations

### 10. Implementation Phases
- What to build first
- Dependencies between components
- MVP vs Full implementation

---

## Thinking Framework

For each design decision, please:

1. **State the problem clearly**
2. **List 2-3 options** with pros/cons
3. **Make a recommendation** with reasoning
4. **Identify risks** and mitigation strategies
5. **Provide implementation hints** (pseudocode, patterns)

---

## Success Criteria

The design is successful if:

1. All 5 interaction modes are clearly architectured
2. Edge cases are addressed
3. Implementation can start immediately from this design
4. A junior developer can understand the system
5. The system can scale to 10,000 users without major refactoring

---

## Final Note

Think deeply about this. Don't just provide surface-level answers. Consider:
- What could go wrong?
- What will be painful to change later?
- What's the simplest solution that works?
- What decisions can be deferred?

The goal is a PRACTICAL, IMPLEMENTABLE design - not a theoretical perfect architecture.
