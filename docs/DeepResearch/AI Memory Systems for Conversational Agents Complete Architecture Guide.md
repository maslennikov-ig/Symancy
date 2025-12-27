# AI Memory Systems for Conversational Agents: Complete Architecture Guide

Building long-term memory for AI assistants requires balancing extraction accuracy, retrieval speed, storage cost, and privacy compliance. **For a Telegram bot built with LangGraph.js + TypeScript + Supabase, Mem0's open-source framework combined with Supabase's pgvector offers the optimal path**—providing native TypeScript support, seamless Supabase integration, and production-ready memory extraction at roughly **$0.01-0.04 per user per month**.

This recommendation emerges from analyzing five major approaches, three storage architectures, and multiple production deployments serving 80,000+ users. The key insight: dedicated memory layers like Mem0 achieve **26% higher accuracy** and **90% token savings** compared to full-context approaches, while adding only 200-700ms latency.

---

## Architecture comparison reveals clear winner for TypeScript stacks

### Mem0: The recommended choice

Mem0 uses a **hybrid datastore architecture** combining vector databases (semantic search), graph stores (relationships via Neo4j), and key-value stores. Its two-phase pipeline extracts facts from conversations using LLMs, then consolidates, deduplicates, and updates memories intelligently.

**TypeScript integration** is first-class: `npm install mem0ai` provides an official SDK with native Supabase support as a history store. The Vercel AI SDK provider (`@mem0/vercel-ai-provider`) and MCP server are also available. Implementation requires just three lines:

```typescript
import { Memory } from "mem0ai/oss";

const memory = new Memory({
  historyStore: {
    provider: "supabase",
    config: {
      supabaseUrl: process.env.SUPABASE_URL,
      supabaseKey: process.env.SUPABASE_KEY,
      tableName: "memory_history"
    }
  }
});

// Retrieve relevant memories
const relevantMemories = await memory.search(userMessage, { userId });

// Store new memories after conversation
await memory.add(messages, { userId });
```

**Pricing** starts free (10,000 memories, 1,000 retrievals/month), with Starter at $19/month and Pro at $249/month for graph memory. The Apache 2.0 license enables full self-hosting. Y Combinator backing, **$24M Series A funding**, SOC 2/HIPAA compliance, and 41,000+ GitHub stars indicate production readiness.

### Other frameworks and why they fall short

**LangMem (LangChain)** offers elegant memory primitives for LangGraph—semantic, episodic, and procedural memory types with background extraction. However, it's **Python-only with no TypeScript SDK**, making it unsuitable for LangGraph.js projects. Forum threads confirm JavaScript support isn't currently available.

**Zep** provides a temporal knowledge graph with excellent TypeScript SDK and sub-200ms retrieval latency. The architecture (powered by open-source Graphiti) tracks when facts were stated versus ingested, enabling sophisticated temporal reasoning. However, the **Community Edition was deprecated**—it's now cloud-only with credit-based pricing that becomes unpredictable at scale. SOC 2 Type II certification and HIPAA BAA availability make it attractive for enterprise, but the external service dependency and pricing model ($25/month for 20,000 credits) may not suit cost-conscious projects.

**Letta (formerly MemGPT)** represents an "LLM Operating System" approach from UC Berkeley research. Agents use tools to edit their own memory blocks (persona, human info, custom blocks), creating sophisticated self-managing systems. The TypeScript SDK exists, but Letta is **a complete agent framework, not just a memory layer**—overkill if you're already using LangGraph. It's better suited as a standalone platform rather than an embedded component.

**Custom solutions** with Supabase pgvector offer maximum control and zero vendor lock-in. You pay only for what you use, and everything stays within your existing stack. The tradeoff: significant development time to implement extraction, deduplication, and consolidation logic that frameworks provide out-of-box.

### Framework comparison matrix

| Framework | TypeScript SDK | Supabase Integration | Self-Hostable | Free Tier | Best For |
|-----------|----------------|---------------------|---------------|-----------|----------|
| **Mem0** | ✅ Official | ✅ Native | ✅ Full | 10K memories | General recommendation |
| **LangMem** | ❌ Python only | N/A | ✅ | N/A | Python projects only |
| **Zep** | ✅ Official | ❌ External | ⚠️ Limited | 1K credits | Enterprise with graph needs |
| **Letta** | ✅ Official | ❌ Postgres | ✅ Full | 5K credits | Full agent platform needs |
| **Custom** | ✅ Your own | ✅ Native | ✅ Full | N/A | Maximum control |

---

## Extraction strategy determines memory quality

### When to extract: async hybrid beats alternatives

**Background/asynchronous extraction** prevents memory operations from blocking user responses. Process extraction *after* generating the response, allowing deeper pattern analysis without latency impact. AWS AgentCore Memory completes async extraction in 20-40 seconds post-ingestion, while LangMem calls this "subconscious formation."

**Triggered extraction** offers a middle ground: use lightweight classifiers or rule-based triggers to detect important patterns (names, dates, explicit preferences) before invoking expensive LLM extraction. This reduces unnecessary API calls significantly.

**The recommended hybrid approach**: lightweight rule-based triggers for immediate extraction of high-priority information combined with background LLM extraction for deeper analysis:

```typescript
// Immediate rule-based extraction
const immediatePatterns = {
  names: /(?:I'm|I am|my name is|call me)\s+([A-Z][a-z]+)/gi,
  dates: /(?:on|at|by)\s+(\d{1,2}[\/\-]\d{1,2}[\/\-]?\d{0,4})/gi,
  preferences: /(?:I prefer|I like|I don't like|I hate)\s+(.+)/gi
};

// Background LLM extraction for complex patterns
async function asyncExtraction(messages: Message[], userId: string) {
  await new Promise(resolve => setTimeout(resolve, 60000)); // Debounce 60s
  await memory.add(messages, { userId });
}
```

### Detecting important information through salience scoring

Not everything deserves memory storage. "I'm vegetarian" should be remembered; "hmm, let me think" should not. **Salience detection** combines content analysis, importance scoring, and category-based filtering.

Mem0's two-phase pipeline achieves **26% higher accuracy** than OpenAI's memory by using LLMs to extract only "salient conversational facts." The system ingests the latest exchange, rolling summary, and recent messages, then scores for salience.

**Practical salience signals for your use cases:**
- **Names**: Explicit mentions ("I'm Sarah", "My doctor is Dr. Smith")
- **Dates**: Temporal markers ("My appointment is March 15th")
- **Health symptoms**: Medical terminology, pain/discomfort descriptions
- **Preferences**: Explicit statements ("I prefer", "I don't want")
- **Events**: Future tense activities, calendar-like information
- **Concerns**: Worry language, questions about problems

### Structured schemas outperform freeform storage

Schema-based extraction with defined categories enables precise retrieval and easier updates:

```typescript
interface UserMemory {
  // Identity
  name: string;
  preferredName: string;
  
  // Health tracking
  currentSymptoms: HealthSymptom[];
  medications: Medication[];
  
  // Events and scheduling
  upcomingEvents: Event[];
  recurringPatterns: Pattern[];
  
  // Preferences and concerns
  communicationStyle: string;
  activeConcerns: Concern[];
}

interface HealthSymptom {
  description: string;
  severity: 'mild' | 'moderate' | 'severe';
  firstMentioned: Date;
  lastMentioned: Date;
  status: 'active' | 'resolved' | 'recurring';
}
```

### Handling contradictions and deletions

When users change jobs or move cities, **version memories with timestamps** rather than overwriting. Mark outdated memories as INVALID, maintaining an audit trail:

```typescript
// AWS AgentCore pattern: ADD/UPDATE/NOOP operations
const conflictResolution = {
  existing: "Customer budget is $500",
  new: "Customer mentioned budget increased to $750",
  result: {
    active: { content: "Budget is $750", timestamp: new Date() },
    archived: { content: "Budget was $500", status: "INVALID" }
  }
};
```

For deletion requests ("forget my name"), implement explicit commands with scoped deletion:

```typescript
// GDPR-compliant deletion
async function forgetMemory(userId: string, memoryType: string) {
  await supabase
    .from('memories')
    .delete()
    .eq('user_id', userId)
    .eq('type', memoryType);
  
  // Log for compliance
  await auditLog.record({ userId, action: 'memory_deletion', type: memoryType });
}
```

---

## Storage architecture favors Supabase-native approach

### Why dedicated graph databases add unnecessary complexity

**Neo4j AuraDB** offers powerful graph queries via Cypher, excellent TypeScript support, and managed hosting starting at $65/month. However, it requires separate infrastructure, data synchronization with Supabase, and learning a new query language—overkill for user memory patterns that rarely need deep traversals.

**Memgraph** claims 8x faster queries than Neo4j (in-memory C++ vs. Neo4j's JVM), but Enterprise pricing starts at **$25,000/year**. The Community Edition requires self-hosting expertise.

**Amazon Neptune** provides fully managed graph capabilities with auto-scaling, but AWS vendor lock-in, VPC configuration complexity, and $80-500/month costs for moderate traffic make it unsuitable for your constraints.

### Supabase pgvector delivers the best balance

Supabase already in your stack makes pgvector the natural choice. One database handles user data, semantic search, and simple relationship patterns:

```sql
-- Enable vector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Memories table with embeddings
CREATE TABLE memories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  content TEXT NOT NULL,
  memory_type TEXT, -- 'name', 'health', 'preference', 'event', 'concern'
  embedding VECTOR(1536),
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ
);

-- Fast similarity search
CREATE INDEX ON memories USING hnsw (embedding vector_cosine_ops);

-- Semantic search function
CREATE FUNCTION match_memories(
  query_embedding VECTOR(1536),
  match_count INT,
  filter_user UUID
) RETURNS TABLE (id UUID, content TEXT, similarity FLOAT)
LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  SELECT m.id, m.content, 1 - (m.embedding <=> query_embedding) AS similarity
  FROM memories m
  WHERE m.user_id = filter_user
  ORDER BY m.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
```

**Cost estimate**: Supabase Pro at $25/month handles 8GB database—sufficient for 10,000+ users with 100 memories each (roughly 250MB total including embeddings).

### Simple graph patterns without graph databases

For relationship tracking, PostgreSQL with JSONB handles straightforward patterns:

```sql
-- Entity-relationship tables for simple graphs
CREATE TABLE entities (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  type TEXT NOT NULL, -- 'person', 'event', 'symptom', 'medication'
  name TEXT,
  properties JSONB,
  embedding VECTOR(1536)
);

CREATE TABLE relations (
  id UUID PRIMARY KEY,
  from_entity UUID REFERENCES entities(id),
  to_entity UUID REFERENCES entities(id),
  relation_type TEXT -- 'knows', 'has_symptom', 'takes_medication'
);
```

**When to add Neo4j**: Only if you need 4+ hop relationship queries, graph algorithms (PageRank, community detection), or GraphRAG with complex traversals. Most user memory systems never reach this threshold.

---

## Retrieval and context injection patterns

### Hybrid retrieval outperforms single methods

Combining vector similarity, keyword search, and recency weighting delivers **10-20% better retrieval accuracy** than pure vector search. Microsoft/Elastic research shows hybrid GraphRAG yields up to **70% accuracy gains** on multi-hop queries.

```typescript
async function hybridRetrieve(
  query: string, 
  userId: string, 
  topK: number = 5
): Promise<Memory[]> {
  // 1. Semantic search via embeddings
  const embedding = await embed(query);
  const semanticResults = await supabase.rpc('match_memories', {
    query_embedding: embedding,
    match_count: topK * 2,
    filter_user: userId
  });

  // 2. Keyword search for precision
  const keywordResults = await supabase
    .from('memories')
    .select('*')
    .eq('user_id', userId)
    .textSearch('content', query)
    .limit(topK);

  // 3. Reciprocal Rank Fusion
  return fuseResults(semanticResults, keywordResults, topK);
}

function fuseResults(semantic: Memory[], keyword: Memory[], k: number): Memory[] {
  const scores = new Map<string, number>();
  const RRF_K = 60; // Standard RRF constant
  
  semantic.forEach((m, rank) => {
    scores.set(m.id, (scores.get(m.id) || 0) + 1 / (RRF_K + rank));
  });
  keyword.forEach((m, rank) => {
    scores.set(m.id, (scores.get(m.id) || 0) + 1 / (RRF_K + rank));
  });
  
  return [...scores.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, k)
    .map(([id]) => semantic.concat(keyword).find(m => m.id === id)!);
}
```

### Optimal context injection: 3-5 memories per message

Too little context misses relevant facts; too much overflows context windows and increases costs. Research shows LLMs exhibit a "lost in the middle" effect—attention drops for mid-context content.

**Priority hierarchy for context allocation:**
1. **User identity** (name, key preferences): Always include, ~100 tokens
2. **Active concerns** (current symptoms, urgent events): High priority, ~300 tokens
3. **Recent relevant memories** (last 24-48 hours): Medium priority, ~400 tokens
4. **Historical context** (past patterns): Summarize if needed, ~200 tokens

**Format memories for LLM consumption:**
```xml
<user_context>
  <identity>Sarah (prefers "Dr. Johnson" professionally)</identity>
  <health status="current">
    Recurring headaches for 2 weeks, moderate severity
    Currently taking ibuprofen as needed
  </health>
  <upcoming>Doctor appointment scheduled March 15th, 2pm</upcoming>
  <preferences>Prefers detailed explanations, appreciates proactive check-ins</preferences>
</user_context>
```

### Dynamic context selection based on intent

Different conversation topics require different memory subsets:

```typescript
async function selectContext(
  userMessage: string,
  conversationHistory: Message[]
): Promise<string> {
  const intent = await classifyIntent(userMessage); // health, scheduling, general
  const entities = await extractEntities(userMessage);
  
  let memories: Memory[];
  
  switch(intent) {
    case 'health':
      memories = await retrieve({
        namespace: 'health',
        entities,
        recencyWeight: 0.7 // Recent symptoms matter most
      });
      break;
    case 'scheduling':
      memories = await retrieve({
        namespace: 'events',
        timeFilter: 'upcoming',
        recencyWeight: 0.3
      });
      break;
    default:
      memories = await retrieve({
        namespace: 'all',
        similarityThreshold: 0.8
      });
  }
  
  return formatMemoriesForContext(memories, maxTokens: 500);
}
```

---

## Production considerations and cost model

### Latency benchmarks from production systems

| System | Search p50 | Search p95 | Total Response p50 | Total Response p95 |
|--------|-----------|-----------|-------------------|-------------------|
| **Mem0** | 0.20s | 0.15s | 0.71s | 1.44s |
| **Mem0 + Graph** | 0.66s | 0.48s | 1.09s | 2.59s |
| **Zep** | ~0.5s | ~1s | 1.29s | ~2.5s |
| **Full-Context** | N/A | N/A | 9.87s | 17.12s |

Mem0 achieves **91% lower p95 latency** versus full-context approaches through selective retrieval and compression.

**Latency optimization strategies:**
- **Async memory processing**: Extract after response generation
- **Memory debouncing**: Batch updates after 60s conversation inactivity
- **KV caching**: Cache computed key-value pairs for repeated tokens
- **Selective retrieval**: Top 3-5 memories typically sufficient

### Cost estimation for 1,000-10,000 users

**LLM API costs (GPT-4o-mini at $0.15/$0.60 per 1M tokens):**
- Per extraction: ~500 input + 200 output tokens ≈ $0.0002
- 10 conversations/user/month × 5 extractions each
- 1,000 users: ~$10/month | 10,000 users: ~$100/month

**Embedding generation (text-embedding-3-small at $0.02/1M tokens):**
- ~100 embeddings/user/month @ 500 tokens
- 1,000 users: ~$1/month | 10,000 users: ~$10/month

**Storage (Supabase Pro at $25/month):**
- Vector storage: ~2.5KB per 1536-dim embedding
- 10,000 users × 100 memories = ~250MB

| Users | LLM Extraction | Embeddings | Storage | **Total Monthly** |
|-------|----------------|------------|---------|-------------------|
| 1,000 | $10-30 | $1-5 | $0 (free) | **$11-35** |
| 5,000 | $50-150 | $5-25 | $25 | **$80-200** |
| 10,000 | $100-300 | $10-50 | $25-60 | **$135-410** |

**Per-user cost: $0.01-0.04/month** depending on activity level.

### GDPR compliance requirements

**Article 17 (Right to Erasure)** requires implementing complete memory deletion:

```typescript
// GDPR-compliant memory export
async function exportUserMemories(userId: string): Promise<MemoryExport> {
  const memories = await supabase
    .from('memories')
    .select('*')
    .eq('user_id', userId);
  
  return {
    exportedAt: new Date(),
    userId,
    memories: memories.data,
    format: 'JSON'
  };
}

// Complete erasure endpoint
async function eraseAllUserData(userId: string): Promise<void> {
  await supabase.from('memories').delete().eq('user_id', userId);
  await supabase.from('entities').delete().eq('user_id', userId);
  await supabase.from('relations').delete().eq('user_id', userId);
  
  await auditLog.record({
    action: 'gdpr_erasure',
    userId,
    timestamp: new Date()
  });
}
```

**Additional requirements:**
- Data minimization: Store only essential facts, not raw conversations
- Pseudonymization: Use user IDs, not identifiable information as keys
- TTL policies: Set default expiration (6-12 months) on memories
- For health data (HIPAA): Consider air-gapped/self-hosted deployment

### Failure modes and graceful degradation

```typescript
async function getMemoriesWithFallback(
  userId: string, 
  query: string
): Promise<Memory[]> {
  try {
    // Primary: Memory service
    return await memoryService.search(query, userId, { 
      limit: 5, 
      timeout: 2000 
    });
  } catch (error) {
    // Fallback 1: Local cache
    const cached = await localCache.get(`memories:${userId}`);
    if (cached) {
      logger.warn('Using cached memories', { userId, reason: error.message });
      return cached;
    }
    
    // Fallback 2: Continue without personalization
    logger.error('Memory retrieval failed', { userId, error });
    return [];
  }
}

// Circuit breaker for repeated failures
const memoryCircuitBreaker = new CircuitBreaker({
  failureThreshold: 5,
  resetTimeout: 60000,
  fallback: () => []
});
```

---

## Real-world implementations and open-source resources

### Production deployments at scale

**Sunflower Sober** (addiction recovery) uses Mem0 to provide personalized support to **80,000+ users**, tracking recovery progress and user state over time.

**Nature Mental Health Research (2024)** found users of AI chatbots for mental health emphasized the need for "human-like memory, including the ability to build up a rich and complex model of the user over time" as a prerequisite for therapeutic effectiveness.

### Open-source repositories

**LangGraph Memory Templates:**
- `langchain-ai/langgraph-memory`: MemGPT-inspired extraction with Pinecone + nomic embeddings, includes evaluation suite
- `langchain-ai/memory-template`: Debouncing pattern (updates after inactivity), patch and insert modes
- `langchain-ai/lang-memgpt`: Deployable bot with Slack/Discord connectors

**OpenMemory (CaviraOSS)**: Local SQLite storage, zero vendor lock-in, MCP server support, import from Mem0/Zep

**Telegram bot templates (n8n):**
- Supabase + OpenAI + Telegram workflow: Stores telegram_id and openai_thread_id for cross-session memory
- Baserow AI Assistant: Voice, photo, text handling with long-term memory in Baserow

---

## Implementation checklist

### Phase 1: Foundation (Week 1)
- [ ] Set up Supabase Pro with pgvector extension enabled
- [ ] Create memories table with embedding column and HNSW index
- [ ] Implement basic CRUD operations for memory storage
- [ ] Add user_id scoping and Row Level Security

### Phase 2: Extraction (Week 2)
- [ ] Implement rule-based extraction for names, dates, preferences
- [ ] Add async LLM extraction with 60s debouncing
- [ ] Create salience scoring for memory importance
- [ ] Build contradiction detection and versioning

### Phase 3: Retrieval (Week 3)
- [ ] Implement hybrid retrieval (vector + keyword)
- [ ] Add recency and importance weighting
- [ ] Build context formatter with token budgeting
- [ ] Create intent-based retrieval routing

### Phase 4: Production (Week 4)
- [ ] Add circuit breaker and fallback patterns
- [ ] Implement GDPR export and deletion endpoints
- [ ] Set up monitoring and alerting
- [ ] Load test with expected user volumes

### Phase 5: Optimization (Ongoing)
- [ ] Evaluate retrieval accuracy with test cases
- [ ] Tune embedding model and retrieval parameters
- [ ] Analyze cost per user and optimize extraction frequency
- [ ] Consider Mem0 integration if custom solution proves complex

---

## Recommended architecture diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                        TELEGRAM BOT                                  │
│                     (LangGraph.js + TypeScript)                     │
└────────────────────────────┬────────────────────────────────────────┘
                             │
        ┌────────────────────┼────────────────────┐
        ▼                    ▼                    ▼
┌───────────────┐  ┌─────────────────┐  ┌─────────────────┐
│ Rule-Based    │  │ Intent          │  │ Async Memory    │
│ Extraction    │  │ Classification  │  │ Processing      │
│ (names/dates) │  │ (health/events) │  │ (debounced)     │
└───────┬───────┘  └────────┬────────┘  └────────┬────────┘
        │                   │                    │
        └───────────────────┼────────────────────┘
                            ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      HYBRID RETRIEVAL                                │
│              Vector Search + Keyword + Recency Weighting             │
└────────────────────────────┬────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         SUPABASE                                     │
├─────────────────┬─────────────────┬─────────────────────────────────┤
│    memories     │    entities     │         relations               │
│   (pgvector)    │    (JSONB)      │        (simple graph)           │
│                 │                 │                                  │
│ - content       │ - type          │ - from_entity                   │
│ - embedding     │ - properties    │ - to_entity                     │
│ - memory_type   │ - embedding     │ - relation_type                 │
│ - metadata      │                 │                                  │
└─────────────────┴─────────────────┴─────────────────────────────────┘
```

---

## Conclusion

The optimal architecture for your Telegram bot combines **Mem0's proven extraction patterns** with **Supabase's native pgvector storage**—minimizing new infrastructure while achieving production-grade memory capabilities. Start with the Mem0 open-source SDK for rapid prototyping; its TypeScript support and Supabase integration align perfectly with your stack.

Key technical insights from this research:
- **Async extraction with debouncing** prevents latency impact while enabling deep analysis
- **Hybrid retrieval** (vector + keyword + recency) outperforms single-method approaches by 10-20%
- **3-5 memories per message** balances context richness against token costs
- **Cost scales linearly** at roughly $0.01-0.04/user/month for typical usage patterns

The memory systems space is evolving rapidly—Mem0's graph memory, Zep's temporal knowledge graphs, and LangMem's procedural memory all represent active research frontiers. Starting with a solid foundation allows incremental adoption of these capabilities as your user base and requirements grow.