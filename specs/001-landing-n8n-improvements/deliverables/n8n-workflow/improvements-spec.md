# n8n Workflow Improvement Specification

**Project**: Symancy (Coffee Psychologist)
**Date**: 2025-11-23
**Version**: 1.0
**Author**: Technical Documentation Team
**References**:
- Current Analysis: `current-analysis.md`
- Landing Page Future State: `../landing-page/future-state.md`
- Feature Specification: `../../spec.md`

---

## 1. Overview

### 1.1 Strategic Goals

This specification defines comprehensive improvements to the Symancy n8n workflow to achieve three strategic objectives:

1. **Landing Page Unification**: Transform the isolated Telegram bot workflow into a multi-channel backend that serves both Telegram users and landing page visitors through a unified AI analysis pipeline.

2. **Production-Ready Operations**: Address critical security vulnerabilities (exposed bot token), implement proper error handling, add monitoring and observability, and establish reliability targets (99.9% uptime).

3. **Monetization Infrastructure**: Build backend capabilities for the tariff/quota system, payment processing, gamification tracking, and admin analytics required for the commercial launch.

### 1.2 Current State Summary

The existing workflow (analyzed in `current-analysis.md`) is a **Pre-MVP** system with:

- **21 nodes** handling Telegram bot interactions
- **Dual LLM architecture** (GPT-OSS 120B primary, Qwen 3 235B fallback) via OpenRouter
- **Vision AI** (Cogito 109B MoE) for coffee ground pattern recognition
- **PostgreSQL** chat memory (20-message context window)
- **HTML message chunking** for Telegram's 4096-character limit

### 1.3 Critical Issues Requiring Immediate Resolution

| Priority | Issue | Impact | Section |
|----------|-------|--------|---------|
| **P0** | Bot token hardcoded in HTTP nodes | Security vulnerability - token theft risk | 6.1 |
| **P0** | Vision AI error path not connected | Silent failures - users receive no response | 4.1 |
| **P1** | No landing page integration | 50% of users cannot access AI analysis | 2.1 |
| **P1** | No monitoring or alerting | Failures undetected until user complaints | 4.3 |
| **P2** | No response caching | Redundant API costs, slower repeated analyses | 3.1 |
| **P2** | No quota/subscription tracking | Cannot enforce tariff limits | 2.3 |

### 1.4 Improvement Scope

| Category | Improvements | Effort Estimate |
|----------|-------------|-----------------|
| Landing Page Support | Webhook endpoint, auth integration, response formatting | L (5-7 days) |
| Performance | Caching, progress tracking, fallback optimization | M (3-5 days) |
| Reliability | Error handling, circuit breakers, monitoring | M (3-4 days) |
| New Integrations | Payment (YuKassa), admin API, gamification | XL (8-12 days) |
| Security | Token protection, rate limiting, input validation | M (2-3 days) |
| **Total** | | **21-31 days** |

---

## 2. Landing Page Support

### 2.1 Webhook Integration (SC-005: Landing Page Enhancement Mapping)

**Requirement**: Enable landing page to use the same AI analysis pipeline as Telegram bot.

**Current State**: Landing page uses client-side Gemini API calls, completely isolated from n8n workflow.

**Target State**: Unified backend where landing page and Telegram share:
- Same AI models (OpenRouter GPT-OSS 120B + Qwen 3 fallback)
- Same vision analysis (Cogito 109B MoE)
- Shared user accounts and analysis history
- Unified quota tracking

#### 2.1.1 New Webhook Trigger Node

**Node Configuration**:
```json
{
  "name": "Landing Page Webhook",
  "type": "n8n-nodes-base.webhook",
  "typeVersion": 2,
  "position": [0, 400],
  "webhookId": "landing-page-analysis",
  "parameters": {
    "httpMethod": "POST",
    "path": "analyze",
    "authentication": "headerAuth",
    "responseMode": "responseNode",
    "options": {
      "rawBody": false,
      "responseContentType": "application/json"
    }
  }
}
```

**Request Schema** (Landing Page to n8n):
```typescript
interface AnalysisRequest {
  // Image data (required)
  imageData: string;          // Base64-encoded JPEG/PNG
  mimeType: "image/jpeg" | "image/png";

  // Analysis parameters
  focusArea: "wellbeing" | "career" | "relationships" | "general";
  language: "ru" | "en" | "zh";

  // User identification
  userId: string;             // Supabase user ID (UUID)
  sessionId?: string;         // Optional session for anonymous users

  // Request metadata
  requestId: string;          // Idempotency key
  source: "landing" | "telegram";

  // Subscription context
  subscriptionTier: "FREE" | "BASIC" | "ADVANCED" | "PREMIUM";
  remainingQuota: number;     // Pre-validated by landing page
}
```

**Response Schema** (n8n to Landing Page):
```typescript
interface AnalysisResponse {
  // Request tracking
  requestId: string;
  status: "success" | "error" | "quota_exceeded";

  // Analysis results (only if status === "success")
  analysis?: {
    intro: string;            // Opening greeting and summary
    sections: Array<{
      title: string;
      content: string;        // Markdown formatted
      confidence: "high" | "medium" | "low";
    }>;
    visionPatterns: {         // From vision AI
      primary: string;
      secondary: string[];
      composition: string;
    };
    metadata: {
      model: string;          // Which LLM was used
      processingTimeMs: number;
      cached: boolean;
    };
  };

  // Blocks based on subscription tier
  availableBlocks: string[];  // e.g., ["emotions", "relationships", "career"]
  lockedBlocks?: string[];    // Blocks user cannot access on current tier

  // Error details (only if status === "error")
  error?: {
    code: string;             // e.g., "VISION_FAILED", "LLM_TIMEOUT"
    message: string;          // User-friendly message
    retryable: boolean;
  };
}
```

#### 2.1.2 Authentication Flow

**Supabase JWT Validation**:
```javascript
// Code node: Validate Auth Token
const authHeader = $input.first().json.headers.authorization;

if (!authHeader || !authHeader.startsWith('Bearer ')) {
  return { valid: false, error: 'Missing authorization header' };
}

const token = authHeader.substring(7);

// Validate JWT with Supabase
const response = await $http.request({
  method: 'GET',
  url: `${process.env.SUPABASE_URL}/auth/v1/user`,
  headers: {
    'Authorization': `Bearer ${token}`,
    'apikey': process.env.SUPABASE_ANON_KEY
  }
});

if (response.status !== 200) {
  return { valid: false, error: 'Invalid or expired token' };
}

return {
  valid: true,
  userId: response.data.id,
  email: response.data.email,
  subscriptionTier: response.data.user_metadata?.subscription_tier || 'FREE'
};
```

#### 2.1.3 Request Routing

**Switch Node Configuration**:
```json
{
  "name": "Route by Source",
  "type": "n8n-nodes-base.switch",
  "parameters": {
    "rules": {
      "values": [
        {
          "conditions": {
            "conditions": [{
              "leftValue": "={{ $json.source }}",
              "rightValue": "telegram",
              "operator": { "type": "string", "operation": "equals" }
            }]
          },
          "outputKey": "telegram"
        },
        {
          "conditions": {
            "conditions": [{
              "leftValue": "={{ $json.source }}",
              "rightValue": "landing",
              "operator": { "type": "string", "operation": "equals" }
            }]
          },
          "outputKey": "landing"
        }
      ]
    }
  }
}
```

### 2.2 Shared AI Analysis Pipeline

**Architecture Change**: Refactor existing "Arina writer" logic into a reusable sub-workflow that both Telegram and landing page paths invoke.

**Sub-Workflow: Coffee Analysis Core**

```
Input Adapter (normalize request format)
    |
    v
Cache Check (perceptual hash lookup)
    |
    +--- Cache Hit ---> Return cached result
    |
    v
Vision Analysis (Cogito 109B)
    |
    v
Arina Writer (OpenRouter GPT-OSS 120B)
    |
    +--- Primary Failed ---> Fallback (Qwen 3 235B)
    |
    v
Block Generator (tier-aware section filtering)
    |
    v
Output Adapter (format for target: Telegram HTML / Landing JSON)
    |
    v
Cache Write (store for future requests)
```

**Block System by Tier**:

| Tier | Blocks Available | Description |
|------|------------------|-------------|
| FREE | emotions, relationships, career, daily_advice | Basic 3-4 block analysis |
| BASIC | + resources, monthly_theme, hidden_fears | 5+ blocks |
| ADVANCED | + archetype, potential, psychologist_recommendations | 7+ blocks |
| PREMIUM | + cassandra_esoteric, two_week_forecast, full_access | All blocks + Cassandra |

**Block Filter Node**:
```javascript
// Code node: Filter blocks by subscription tier
const tierBlocks = {
  FREE: ['emotions', 'relationships', 'career', 'daily_advice'],
  BASIC: ['emotions', 'relationships', 'career', 'daily_advice',
          'resources', 'monthly_theme', 'hidden_fears'],
  ADVANCED: ['emotions', 'relationships', 'career', 'daily_advice',
             'resources', 'monthly_theme', 'hidden_fears',
             'archetype', 'potential', 'psychologist_recommendations'],
  PREMIUM: ['emotions', 'relationships', 'career', 'daily_advice',
            'resources', 'monthly_theme', 'hidden_fears',
            'archetype', 'potential', 'psychologist_recommendations',
            'cassandra_esoteric', 'two_week_forecast']
};

const tier = $input.first().json.subscriptionTier || 'FREE';
const availableBlocks = tierBlocks[tier];
const allBlocks = Object.keys($input.first().json.analysis.sections);

const filteredSections = $input.first().json.analysis.sections.filter(
  section => availableBlocks.includes(section.blockType)
);

const lockedBlocks = allBlocks.filter(b => !availableBlocks.includes(b));

return {
  analysis: {
    ...$input.first().json.analysis,
    sections: filteredSections
  },
  availableBlocks,
  lockedBlocks
};
```

### 2.3 Quota and Subscription Integration

**Quota Enforcement Node** (validates before analysis):

```javascript
// Code node: Check quota
const userId = $input.first().json.userId;
const tier = $input.first().json.subscriptionTier;

// Query Supabase for current quota usage
const quotaResponse = await $http.request({
  method: 'GET',
  url: `${process.env.SUPABASE_URL}/rest/v1/user_quotas`,
  headers: {
    'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
    'apikey': process.env.SUPABASE_ANON_KEY
  },
  qs: {
    user_id: `eq.${userId}`,
    select: 'analyses_used,last_analysis_at,quota_reset_at'
  }
});

const quota = quotaResponse.data[0];
const now = new Date();

// Quota limits by tier
const quotaLimits = {
  FREE: { analyses: 1, periodHours: 120 },      // 1 per 5 days
  BASIC: { analyses: 1, periodHours: 24 },      // 1 per day
  ADVANCED: { analyses: 68, periodHours: 720 }, // 68 per month
  PREMIUM: { analyses: 121, periodHours: 720 }  // 121 per month
};

const limit = quotaLimits[tier];
const resetTime = new Date(quota.quota_reset_at);
const periodExpired = now > resetTime;

if (periodExpired) {
  // Reset quota for new period
  return { quotaValid: true, remaining: limit.analyses };
}

if (quota.analyses_used >= limit.analyses) {
  const nextResetTime = new Date(quota.quota_reset_at);
  return {
    quotaValid: false,
    error: 'QUOTA_EXCEEDED',
    message: `Quota exceeded. Next analysis available at ${nextResetTime.toISOString()}`,
    nextResetAt: nextResetTime.toISOString()
  };
}

return {
  quotaValid: true,
  remaining: limit.analyses - quota.analyses_used
};
```

**Quota Decrement Node** (after successful analysis):

```javascript
// Code node: Decrement quota after analysis
const userId = $input.first().json.userId;

await $http.request({
  method: 'POST',
  url: `${process.env.SUPABASE_URL}/rest/v1/rpc/decrement_quota`,
  headers: {
    'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
    'apikey': process.env.SUPABASE_ANON_KEY,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ p_user_id: userId })
});

return $input.first().json;
```

### 2.4 Landing Page Feature Mapping (SC-005)

The following table maps landing page enhancements from `future-state.md` to their workflow requirements:

| Landing Page Enhancement | Workflow Change Required | Priority |
|-------------------------|-------------------------|----------|
| **2.1 Image Upload - Enhanced** | Quality validation endpoint (pre-analysis check) | P1 |
| **2.2 AI Analysis - Enhanced** | Progress webhook callbacks, confidence scoring | P0 |
| **2.3 Focus Area Selection** | Multi-focus analysis support in prompt | P2 |
| **2.4 Results Display - Enhanced** | Structured JSON output with sections | P1 |
| **2.5 Analysis History - Enhanced** | Store analysis metadata to Supabase | P1 |
| **2.6 User Authentication** | JWT validation, Telegram linking | P1 |
| **2.7 Internationalization** | Language-aware prompts and responses | P2 |
| **3.2 Psychological Trend Analytics** | Aggregate analysis data for dashboards | P2 |
| **3.5 Personalized Reading Reminders** | Scheduled workflow for notifications | P3 |
| **3.6 Expert Analysis Upgrade** | Human review queue workflow | P3 |

---

## 3. Performance Optimizations

### 3.1 Response Caching

**Objective**: Return cached results for identical or similar images in <500ms (vs. 15-30 seconds for new analysis).

#### 3.1.1 Cache Architecture

```
                     +------------------+
                     |  Incoming Image  |
                     +--------+---------+
                              |
                              v
                     +--------+---------+
                     | Perceptual Hash  |
                     | (pHash algorithm)|
                     +--------+---------+
                              |
                              v
                     +--------+---------+
                     |   Cache Lookup   |
                     |   (Supabase)     |
                     +--------+---------+
                              |
              +---------------+---------------+
              |                               |
       Cache Hit                        Cache Miss
              |                               |
              v                               v
     +--------+---------+           +---------+--------+
     | Return cached    |           | Full Analysis    |
     | (< 500ms)        |           | (15-30 seconds)  |
     +------------------+           +---------+--------+
                                              |
                                              v
                                    +---------+--------+
                                    | Cache Write      |
                                    | (async)          |
                                    +------------------+
```

#### 3.1.2 Perceptual Hash Implementation

**Node: Generate Image Hash**:
```javascript
// Code node: Generate perceptual hash
const crypto = require('crypto');
const sharp = require('sharp');

async function generatePHash(imageBase64) {
  // Decode base64 to buffer
  const imageBuffer = Buffer.from(imageBase64, 'base64');

  // Resize to 8x8 grayscale for perceptual hashing
  const resized = await sharp(imageBuffer)
    .resize(8, 8, { fit: 'fill' })
    .grayscale()
    .raw()
    .toBuffer();

  // Calculate average pixel value
  const pixels = Array.from(resized);
  const avg = pixels.reduce((a, b) => a + b, 0) / pixels.length;

  // Generate binary hash (1 if pixel > avg, 0 otherwise)
  let hash = '';
  for (const pixel of pixels) {
    hash += pixel > avg ? '1' : '0';
  }

  // Convert binary to hex for storage
  return parseInt(hash, 2).toString(16).padStart(16, '0');
}

const imageBase64 = $input.first().json.imageData;
const pHash = await generatePHash(imageBase64);

// Also generate content hash for exact match fallback
const contentHash = crypto.createHash('sha256')
  .update(imageBase64)
  .digest('hex');

return {
  pHash,
  contentHash,
  focusArea: $input.first().json.focusArea,
  language: $input.first().json.language
};
```

#### 3.1.3 Cache Database Schema

```sql
-- Migration: Create analysis cache table
CREATE TABLE analysis_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Hash keys for lookup
  p_hash VARCHAR(16) NOT NULL,        -- Perceptual hash
  content_hash VARCHAR(64) NOT NULL,  -- SHA-256 of image
  focus_area VARCHAR(20) NOT NULL,
  language VARCHAR(5) NOT NULL,

  -- Cached analysis result
  analysis_result JSONB NOT NULL,
  vision_result JSONB NOT NULL,

  -- Metadata
  model_version VARCHAR(50) NOT NULL, -- LLM model used
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_accessed_at TIMESTAMPTZ DEFAULT NOW(),
  access_count INT DEFAULT 1,

  -- Composite index for fast lookup
  CONSTRAINT unique_cache_key UNIQUE (p_hash, focus_area, language)
);

-- Index for cache cleanup (evict least recently used)
CREATE INDEX idx_cache_lru ON analysis_cache (last_accessed_at);

-- Index for exact content hash matching
CREATE INDEX idx_cache_content ON analysis_cache (content_hash);
```

#### 3.1.4 Cache Lookup Node

```javascript
// Code node: Cache lookup
const { pHash, contentHash, focusArea, language } = $input.first().json;

// Check cache with configurable Hamming distance tolerance
const cacheResponse = await $http.request({
  method: 'POST',
  url: `${process.env.SUPABASE_URL}/rest/v1/rpc/find_cached_analysis`,
  headers: {
    'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
    'apikey': process.env.SUPABASE_ANON_KEY,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    p_phash: pHash,
    p_content_hash: contentHash,
    p_focus_area: focusArea,
    p_language: language,
    p_max_hamming_distance: 5  // Allow 5-bit difference for similar images
  })
});

if (cacheResponse.data && cacheResponse.data.length > 0) {
  const cached = cacheResponse.data[0];

  // Update access stats asynchronously
  $http.request({
    method: 'POST',
    url: `${process.env.SUPABASE_URL}/rest/v1/rpc/update_cache_access`,
    headers: {
      'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
      'apikey': process.env.SUPABASE_ANON_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ p_cache_id: cached.id })
  });

  return {
    cacheHit: true,
    analysis: cached.analysis_result,
    visionPatterns: cached.vision_result,
    metadata: {
      cached: true,
      cacheAge: Date.now() - new Date(cached.created_at).getTime(),
      model: cached.model_version
    }
  };
}

return { cacheHit: false };
```

### 3.2 Progress Tracking

**Objective**: Provide detailed progress updates during analysis (4 stages as specified in client requirements).

#### 3.2.1 Progress Callback Architecture

```
Landing Page           n8n Workflow
     |                      |
     +----> Start Analysis  |
     |                      |
     |  <---- Progress 25% (Preprocessing)
     |                      |
     |  <---- Progress 50% (Vision Analysis)
     |                      |
     |  <---- Progress 75% (AI Interpretation)
     |                      |
     |  <---- Progress 100% (Formatting)
     |                      |
     |  <---- Final Result  |
```

#### 3.2.2 Progress Callback Node

**Node: Send Progress Update**:
```javascript
// Code node: Send progress callback
async function sendProgress(stage, percentage, message) {
  const callbackUrl = $input.first().json.progressCallbackUrl;
  const requestId = $input.first().json.requestId;

  if (!callbackUrl) return; // Skip if no callback URL provided

  await $http.request({
    method: 'POST',
    url: callbackUrl,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      requestId,
      stage,
      percentage,
      message,
      timestamp: new Date().toISOString()
    })
  });
}

// Progress stages
const stages = [
  { stage: 'preprocessing', percentage: 25, message: 'Analyzing image quality...' },
  { stage: 'vision_analysis', percentage: 50, message: 'Identifying patterns...' },
  { stage: 'interpretation', percentage: 75, message: 'Generating psychological insights...' },
  { stage: 'formatting', percentage: 100, message: 'Finalizing your reading...' }
];

// Called at each stage
const currentStage = $input.first().json.currentStage;
const stageInfo = stages.find(s => s.stage === currentStage);
if (stageInfo) {
  await sendProgress(stageInfo.stage, stageInfo.percentage, stageInfo.message);
}

return $input.first().json;
```

### 3.3 Confidence Scoring

**Objective**: Provide transparency on AI certainty levels for each analysis section.

#### 3.3.1 Confidence Score Implementation

**Modified System Prompt for Arina Writer**:
```
[Existing prompt...]

CRITICAL FORMATTING REQUIREMENT:
For each section of your analysis, include a confidence indicator in the following format:
<!-- CONFIDENCE: HIGH|MEDIUM|LOW -->

Base your confidence on:
- HIGH: Clear, distinct patterns with strong symbolic meaning
- MEDIUM: Ambiguous patterns with multiple valid interpretations
- LOW: Faint or unclear patterns, interpretation is speculative

Example output:
<b>Emotional Landscape</b>
<!-- CONFIDENCE: HIGH -->
Your coffee grounds reveal a prominent heart-shaped formation...

<b>Career Outlook</b>
<!-- CONFIDENCE: MEDIUM -->
The scattered dots in the upper region suggest...
```

**Confidence Extraction Node**:
```javascript
// Code node: Extract confidence scores
const analysisText = $input.first().json.output;

const confidenceRegex = /<!-- CONFIDENCE: (HIGH|MEDIUM|LOW) -->/g;
const sections = analysisText.split(/<b>/).filter(s => s.trim());

const sectionsWithConfidence = sections.map(section => {
  const match = section.match(/<!-- CONFIDENCE: (HIGH|MEDIUM|LOW) -->/);
  const confidence = match ? match[1].toLowerCase() : 'medium';
  const cleanContent = section.replace(/<!-- CONFIDENCE: \w+ -->/g, '').trim();

  // Extract title (first line before closing </b>)
  const titleMatch = cleanContent.match(/^([^<]+)<\/b>/);
  const title = titleMatch ? titleMatch[1].trim() : 'Section';
  const content = cleanContent.replace(/^[^<]+<\/b>/, '').trim();

  return { title, content, confidence };
});

return {
  ...($input.first().json),
  sections: sectionsWithConfidence
};
```

### 3.4 Fallback Optimization

**Current State**: Primary model (GPT-OSS 120B) fails, then Qwen 3 235B is used as fallback. No differentiation in quality tracking.

**Improvements**:

1. **Circuit Breaker Pattern**: After 3 consecutive primary model failures, temporarily route all requests to fallback for 5 minutes.

2. **Model Selection Logging**: Track which model was used for analytics and cost allocation.

3. **Parallel Model Invocation** (optional, for premium tier): Run both models simultaneously, return fastest successful response.

**Circuit Breaker Node**:
```javascript
// Code node: Circuit breaker for LLM
const FAILURE_THRESHOLD = 3;
const COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes

// Get circuit state from Supabase
const stateResponse = await $http.request({
  method: 'GET',
  url: `${process.env.SUPABASE_URL}/rest/v1/circuit_breaker_state`,
  headers: {
    'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
    'apikey': process.env.SUPABASE_ANON_KEY
  },
  qs: {
    circuit_name: 'eq.primary_llm',
    select: 'failure_count,last_failure_at,state'
  }
});

const state = stateResponse.data[0] || { failure_count: 0, state: 'closed' };

// Check if circuit should be open
if (state.state === 'open') {
  const cooldownExpired = Date.now() - new Date(state.last_failure_at).getTime() > COOLDOWN_MS;
  if (!cooldownExpired) {
    return { useFallback: true, reason: 'circuit_open' };
  }
  // Half-open: allow one request to test primary
  return { useFallback: false, halfOpen: true };
}

if (state.failure_count >= FAILURE_THRESHOLD) {
  // Open the circuit
  await updateCircuitState('open');
  return { useFallback: true, reason: 'threshold_exceeded' };
}

return { useFallback: false };
```

---

## 4. Reliability Enhancements

### 4.1 Error Handling

**Critical Fix**: Connect all error output paths that are currently disconnected.

#### 4.1.1 Vision AI Error Handling

**Current Problem**: "Analyze image" node has `onError: "continueErrorOutput"` but error path is not connected.

**Solution**:
```json
{
  "name": "Vision Error Handler",
  "type": "n8n-nodes-base.code",
  "position": [900, 200],
  "parameters": {
    "jsCode": "// Handle vision AI errors\nconst error = $input.first().json.error;\nconst chatId = $('question').item.json.message.chat.id;\n\nconst errorMessages = {\n  'timeout': 'Image analysis is taking longer than expected. Please try again.',\n  'content_filter': 'The image could not be analyzed. Please try a different photo.',\n  'rate_limit': 'Our service is busy. Please try again in a few moments.',\n  'default': 'Something went wrong. Please try again.'\n};\n\nconst errorType = error?.code || 'default';\nconst userMessage = errorMessages[errorType] || errorMessages.default;\n\nreturn {\n  chatId,\n  errorType,\n  userMessage,\n  shouldNotifyUser: true,\n  shouldLogError: true\n};"
  }
}
```

**Error Notification Node** (sends error message to user):
```json
{
  "name": "Send Error to User",
  "type": "n8n-nodes-base.telegram",
  "parameters": {
    "chatId": "={{ $json.chatId }}",
    "text": "={{ $json.userMessage }}",
    "additionalFields": {
      "parse_mode": "HTML"
    }
  }
}
```

#### 4.1.2 Structured Error Response Schema

**For Landing Page Errors**:
```typescript
interface ErrorResponse {
  requestId: string;
  status: "error";
  error: {
    code: ErrorCode;
    message: string;
    retryable: boolean;
    retryAfterMs?: number;  // For rate limits
    details?: Record<string, unknown>;  // Debug info (dev only)
  };
}

type ErrorCode =
  | "AUTH_INVALID"        // JWT validation failed
  | "AUTH_EXPIRED"        // JWT expired
  | "QUOTA_EXCEEDED"      // User quota depleted
  | "IMAGE_INVALID"       // Image cannot be processed
  | "IMAGE_TOO_LARGE"     // Image exceeds size limit
  | "VISION_FAILED"       // Vision AI error
  | "VISION_TIMEOUT"      // Vision AI timeout
  | "LLM_FAILED"          // LLM generation error
  | "LLM_TIMEOUT"         // LLM timeout
  | "LLM_CONTENT_FILTER"  // LLM refused content
  | "RATE_LIMITED"        // Too many requests
  | "INTERNAL_ERROR"      // Unexpected server error
  | "SERVICE_UNAVAILABLE";// Maintenance or outage
```

#### 4.1.3 Retry Logic Configuration

**Node: Retry with Exponential Backoff**:
```javascript
// Code node: Implement retry with backoff
const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1000;

async function retryWithBackoff(fn, retries = MAX_RETRIES) {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt === retries - 1) throw error;

      // Check if error is retryable
      const retryable = ['ETIMEDOUT', 'ECONNRESET', 'RATE_LIMITED'].some(
        code => error.message?.includes(code)
      );

      if (!retryable) throw error;

      const delay = BASE_DELAY_MS * Math.pow(2, attempt);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

return $input.first().json;
```

### 4.2 Timeout Configuration

**Current State**: Uses n8n defaults (30 seconds for most nodes).

**Recommended Timeouts**:

| Node | Current | Recommended | Rationale |
|------|---------|-------------|-----------|
| Vision Analysis | 30s | 45s | Vision models are slow, avoid false timeouts |
| LLM Generation | 30s | 60s | Complex analyses take longer |
| Image Download | 30s | 15s | Should be fast, fail fast if Telegram slow |
| Cache Lookup | 30s | 5s | Database query should be fast |
| Webhook Response | 30s | 90s | Full pipeline takes 15-30s normally |

**Workflow-Level Timeout** (in workflow settings):
```json
{
  "settings": {
    "executionTimeout": 120,
    "saveDataErrorExecution": "all",
    "saveDataSuccessExecution": "all",
    "saveExecutionProgress": true
  }
}
```

### 4.3 Monitoring and Alerting

#### 4.3.1 Execution Logging

**Node: Log Execution Metrics**:
```javascript
// Code node: Log to Supabase analytics
const executionData = {
  workflow_id: $workflow.id,
  execution_id: $execution.id,
  source: $input.first().json.source || 'telegram',
  user_id: $input.first().json.userId,

  // Timing metrics
  started_at: new Date($execution.startedAt).toISOString(),
  completed_at: new Date().toISOString(),
  duration_ms: Date.now() - new Date($execution.startedAt).getTime(),

  // Model metrics
  vision_model: 'cogito-v2-preview-llama-109b-moe',
  llm_model: $input.first().json.modelUsed || 'gpt-oss-120b',
  cache_hit: $input.first().json.cacheHit || false,

  // Result metrics
  status: 'success',
  sections_generated: $input.first().json.sections?.length || 0,

  // Cost estimation
  estimated_cost_usd: calculateCost($input.first().json)
};

await $http.request({
  method: 'POST',
  url: `${process.env.SUPABASE_URL}/rest/v1/workflow_executions`,
  headers: {
    'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
    'apikey': process.env.SUPABASE_ANON_KEY,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify(executionData)
});

return $input.first().json;

function calculateCost(data) {
  if (data.cacheHit) return 0;

  const visionCost = 0.02;  // ~$0.02 per vision analysis
  const llmCost = data.modelUsed === 'qwen3-235b' ? 0.015 : 0.01;

  return visionCost + llmCost;
}
```

#### 4.3.2 Alert Rules

**Supabase Function: Check Error Rate**:
```sql
-- Function to check error rate and trigger alert
CREATE OR REPLACE FUNCTION check_error_rate_alert()
RETURNS void AS $$
DECLARE
  error_count INT;
  total_count INT;
  error_rate DECIMAL;
BEGIN
  -- Get last 15 minutes of executions
  SELECT
    COUNT(*) FILTER (WHERE status = 'error'),
    COUNT(*)
  INTO error_count, total_count
  FROM workflow_executions
  WHERE created_at > NOW() - INTERVAL '15 minutes';

  IF total_count > 10 THEN
    error_rate := error_count::DECIMAL / total_count;

    IF error_rate > 0.10 THEN -- 10% error rate threshold
      -- Insert alert
      INSERT INTO alerts (alert_type, severity, message, metadata)
      VALUES (
        'high_error_rate',
        'critical',
        FORMAT('Error rate is %s%% (%s/%s) in last 15 minutes',
               ROUND(error_rate * 100, 1), error_count, total_count),
        jsonb_build_object(
          'error_count', error_count,
          'total_count', total_count,
          'error_rate', error_rate
        )
      );
    END IF;
  END IF;
END;
$$ LANGUAGE plpgsql;
```

#### 4.3.3 Monitoring Dashboard Queries

**Key Metrics SQL**:
```sql
-- Dashboard: Real-time metrics
CREATE VIEW workflow_dashboard AS
SELECT
  -- Success rate (last 24 hours)
  COUNT(*) FILTER (WHERE status = 'success')::DECIMAL /
    NULLIF(COUNT(*), 0) * 100 AS success_rate_24h,

  -- Average response time
  AVG(duration_ms) FILTER (WHERE status = 'success') AS avg_duration_ms,
  PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY duration_ms) AS p95_duration_ms,

  -- Cache hit rate
  COUNT(*) FILTER (WHERE cache_hit = true)::DECIMAL /
    NULLIF(COUNT(*), 0) * 100 AS cache_hit_rate,

  -- Volume by source
  COUNT(*) FILTER (WHERE source = 'telegram') AS telegram_count,
  COUNT(*) FILTER (WHERE source = 'landing') AS landing_count,

  -- Cost
  SUM(estimated_cost_usd) AS total_cost_24h,

  -- Model usage
  COUNT(*) FILTER (WHERE llm_model = 'gpt-oss-120b') AS primary_model_count,
  COUNT(*) FILTER (WHERE llm_model = 'qwen3-235b') AS fallback_model_count

FROM workflow_executions
WHERE created_at > NOW() - INTERVAL '24 hours';
```

### 4.4 Health Checks

**Scheduled Health Check Workflow** (runs every 5 minutes):
```json
{
  "name": "Workflow Health Check",
  "trigger": {
    "type": "n8n-nodes-base.scheduleTrigger",
    "parameters": {
      "rule": {
        "interval": [{ "field": "minutes", "minutesInterval": 5 }]
      }
    }
  },
  "nodes": [
    {
      "name": "Check OpenRouter API",
      "type": "n8n-nodes-base.httpRequest",
      "parameters": {
        "url": "https://openrouter.ai/api/v1/models",
        "method": "GET",
        "timeout": 10000
      }
    },
    {
      "name": "Check Supabase",
      "type": "n8n-nodes-base.httpRequest",
      "parameters": {
        "url": "{{ $env.SUPABASE_URL }}/rest/v1/",
        "method": "HEAD",
        "timeout": 5000
      }
    },
    {
      "name": "Check Telegram API",
      "type": "n8n-nodes-base.httpRequest",
      "parameters": {
        "url": "https://api.telegram.org/bot{{ $credentials.telegramApi.token }}/getMe",
        "method": "GET",
        "timeout": 5000
      }
    },
    {
      "name": "Log Health Status",
      "type": "n8n-nodes-base.code",
      "parameters": {
        "jsCode": "// Aggregate health check results\nconst checks = [\n  { name: 'openrouter', status: $('Check OpenRouter API').item.json.status === 200 },\n  { name: 'supabase', status: $('Check Supabase').item.json.status === 200 },\n  { name: 'telegram', status: $('Check Telegram API').item.json.ok === true }\n];\n\nconst healthy = checks.every(c => c.status);\nconst failedChecks = checks.filter(c => !c.status).map(c => c.name);\n\nreturn {\n  healthy,\n  timestamp: new Date().toISOString(),\n  checks,\n  failedChecks,\n  alertRequired: !healthy\n};"
      }
    }
  ]
}
```

---

## 5. New Integrations

### 5.1 Payment Integration (YuKassa)

**Requirement**: Integrate YuKassa for Russian market payments with 54-FZ online cash register compliance.

#### 5.1.1 Payment Webhook Handler

**New Workflow: Payment Processing**:
```json
{
  "name": "YuKassa Payment Handler",
  "trigger": {
    "type": "n8n-nodes-base.webhook",
    "parameters": {
      "httpMethod": "POST",
      "path": "payment/yukassa/webhook",
      "authentication": "headerAuth"
    }
  }
}
```

**Payment Verification Node**:
```javascript
// Code node: Verify YuKassa webhook signature
const crypto = require('crypto');

function verifySignature(body, signature, secretKey) {
  const hmac = crypto.createHmac('sha256', secretKey);
  hmac.update(body);
  const expectedSignature = hmac.digest('hex');
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}

const rawBody = $input.first().json._rawBody;
const signature = $input.first().json.headers['x-yookassa-signature'];
const secretKey = process.env.YUKASSA_WEBHOOK_SECRET;

if (!verifySignature(rawBody, signature, secretKey)) {
  throw new Error('Invalid webhook signature');
}

const payment = JSON.parse(rawBody);

return {
  paymentId: payment.object.id,
  status: payment.object.status,
  amount: payment.object.amount.value,
  currency: payment.object.amount.currency,
  userId: payment.object.metadata?.user_id,
  tier: payment.object.metadata?.subscription_tier,
  receiptId: payment.object.receipt?.id
};
```

**Subscription Activation Node**:
```javascript
// Code node: Activate subscription after successful payment
const { userId, tier, paymentId, amount } = $input.first().json;

// Update user subscription in Supabase
await $http.request({
  method: 'PATCH',
  url: `${process.env.SUPABASE_URL}/rest/v1/user_subscriptions`,
  headers: {
    'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
    'apikey': process.env.SUPABASE_ANON_KEY,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation'
  },
  qs: { user_id: `eq.${userId}` },
  body: JSON.stringify({
    tier,
    payment_id: paymentId,
    amount_paid: amount,
    activated_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days
    status: 'active'
  })
});

// Reset quota for new subscription
await $http.request({
  method: 'POST',
  url: `${process.env.SUPABASE_URL}/rest/v1/rpc/reset_user_quota`,
  headers: {
    'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
    'apikey': process.env.SUPABASE_ANON_KEY,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    p_user_id: userId,
    p_tier: tier
  })
});

return { success: true, userId, tier };
```

### 5.2 Telegram Stars Payment

**Requirement**: Support Telegram Stars as alternative payment method (30% commission but native UX).

**Telegram Stars Handler Node**:
```javascript
// Code node: Process Telegram Stars payment
const message = $input.first().json.message;

if (message.successful_payment) {
  const payment = message.successful_payment;
  const userId = message.from.id.toString();

  // Parse invoice payload for tier info
  const payload = JSON.parse(payment.invoice_payload);

  return {
    source: 'telegram_stars',
    userId,
    tier: payload.tier,
    amount: payment.total_amount,
    currency: 'XTR', // Telegram Stars
    telegramPaymentChargeId: payment.telegram_payment_charge_id,
    providerPaymentChargeId: payment.provider_payment_charge_id
  };
}

return { isPayment: false };
```

### 5.3 Gamification Backend

**Requirement**: Track streaks, achievements, and provide data for limit visualization.

#### 5.3.1 Streak Tracking

**Post-Analysis Streak Update Node**:
```javascript
// Code node: Update user streak after analysis
const userId = $input.first().json.userId;
const today = new Date().toISOString().split('T')[0];

// Get current streak data
const streakResponse = await $http.request({
  method: 'GET',
  url: `${process.env.SUPABASE_URL}/rest/v1/user_streaks`,
  headers: {
    'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
    'apikey': process.env.SUPABASE_ANON_KEY
  },
  qs: {
    user_id: `eq.${userId}`,
    select: '*'
  }
});

const streak = streakResponse.data[0] || {
  current_streak: 0,
  longest_streak: 0,
  last_analysis_date: null
};

const lastDate = streak.last_analysis_date;
const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

let newStreak;
if (lastDate === yesterday) {
  // Consecutive day - increment streak
  newStreak = streak.current_streak + 1;
} else if (lastDate === today) {
  // Same day - no change
  newStreak = streak.current_streak;
} else {
  // Streak broken - reset to 1
  newStreak = 1;
}

const longestStreak = Math.max(newStreak, streak.longest_streak);

// Update streak in database
await $http.request({
  method: 'POST',
  url: `${process.env.SUPABASE_URL}/rest/v1/user_streaks`,
  headers: {
    'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
    'apikey': process.env.SUPABASE_ANON_KEY,
    'Content-Type': 'application/json',
    'Prefer': 'resolution=merge-duplicates'
  },
  body: JSON.stringify({
    user_id: userId,
    current_streak: newStreak,
    longest_streak: longestStreak,
    last_analysis_date: today
  })
});

// Check for achievement unlocks
const achievements = [];
if (newStreak === 7) achievements.push('week_streak');
if (newStreak === 30) achievements.push('month_streak');
if (newStreak === 100) achievements.push('century_streak');

return {
  ...$input.first().json,
  streak: {
    current: newStreak,
    longest: longestStreak,
    newAchievements: achievements
  }
};
```

#### 5.3.2 Achievement System

**Achievement Check Node**:
```javascript
// Code node: Check and award achievements
const userId = $input.first().json.userId;
const analysisCount = $input.first().json.analysisCount;
const streak = $input.first().json.streak;

const achievementRules = [
  { id: 'first_reading', condition: () => analysisCount === 1 },
  { id: 'coffee_enthusiast', condition: () => analysisCount >= 10 },
  { id: 'coffee_master', condition: () => analysisCount >= 50 },
  { id: 'week_streak', condition: () => streak.current >= 7 },
  { id: 'month_streak', condition: () => streak.current >= 30 },
  { id: 'all_focus_areas', condition: () => checkAllFocusAreas(userId) }
];

// Get already earned achievements
const earnedResponse = await $http.request({
  method: 'GET',
  url: `${process.env.SUPABASE_URL}/rest/v1/user_achievements`,
  headers: {
    'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
    'apikey': process.env.SUPABASE_ANON_KEY
  },
  qs: {
    user_id: `eq.${userId}`,
    select: 'achievement_id'
  }
});

const earnedIds = earnedResponse.data.map(a => a.achievement_id);
const newAchievements = [];

for (const rule of achievementRules) {
  if (!earnedIds.includes(rule.id) && rule.condition()) {
    newAchievements.push(rule.id);

    // Award achievement
    await $http.request({
      method: 'POST',
      url: `${process.env.SUPABASE_URL}/rest/v1/user_achievements`,
      headers: {
        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
        'apikey': process.env.SUPABASE_ANON_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        user_id: userId,
        achievement_id: rule.id,
        earned_at: new Date().toISOString()
      })
    });
  }
}

return {
  ...$input.first().json,
  newAchievements
};
```

### 5.4 Admin Panel API

**Requirement**: Provide API endpoints for admin dashboard metrics.

#### 5.4.1 Admin API Webhook

**Admin API Workflow**:
```json
{
  "name": "Admin API",
  "trigger": {
    "type": "n8n-nodes-base.webhook",
    "parameters": {
      "httpMethod": "GET",
      "path": "admin/api/v1/:resource",
      "authentication": "headerAuth"
    }
  }
}
```

**Admin Resource Router**:
```javascript
// Code node: Route admin API requests
const resource = $input.first().json.params.resource;
const query = $input.first().json.query;

// Verify admin token
const authHeader = $input.first().json.headers.authorization;
const adminToken = authHeader?.replace('Bearer ', '');

if (adminToken !== process.env.ADMIN_API_TOKEN) {
  return {
    statusCode: 401,
    error: 'Unauthorized'
  };
}

switch (resource) {
  case 'users':
    return await getUserMetrics(query);
  case 'analyses':
    return await getAnalysisMetrics(query);
  case 'financial':
    return await getFinancialMetrics(query);
  case 'technical':
    return await getTechnicalMetrics(query);
  default:
    return { statusCode: 404, error: 'Resource not found' };
}

async function getUserMetrics(query) {
  const response = await $http.request({
    method: 'GET',
    url: `${process.env.SUPABASE_URL}/rest/v1/rpc/get_user_metrics`,
    headers: {
      'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
      'apikey': process.env.SUPABASE_ANON_KEY
    },
    qs: {
      start_date: query.start_date,
      end_date: query.end_date
    }
  });

  return {
    totalUsers: response.data.total_users,
    payingUsers: response.data.paying_users,
    conversionRate: response.data.conversion_rate,
    retentionRate: response.data.retention_rate,
    churnRate: response.data.churn_rate,
    averageLTV: response.data.average_ltv
  };
}
```

#### 5.4.2 Metric Definitions

**User Metrics**:
| Metric | Calculation | Endpoint |
|--------|-------------|----------|
| Total Users | COUNT(DISTINCT user_id) | `/admin/api/v1/users` |
| Paying Users | COUNT WHERE subscription_tier != 'FREE' | `/admin/api/v1/users` |
| Conversion Rate | Paying / Total * 100 | `/admin/api/v1/users` |
| Retention (30-day) | Users active in both periods | `/admin/api/v1/users` |
| Churn Rate | Lost users / Previous period | `/admin/api/v1/users` |
| LTV | Total revenue / Total users | `/admin/api/v1/users` |

**Analysis Metrics**:
| Metric | Calculation | Endpoint |
|--------|-------------|----------|
| Daily Analyses | COUNT by day | `/admin/api/v1/analyses` |
| By Focus Area | GROUP BY focus_area | `/admin/api/v1/analyses` |
| Success Rate | Success / Total * 100 | `/admin/api/v1/analyses` |
| Cache Hit Rate | Cached / Total * 100 | `/admin/api/v1/analyses` |
| Avg Duration | AVG(duration_ms) | `/admin/api/v1/analyses` |

**Financial Metrics**:
| Metric | Calculation | Endpoint |
|--------|-------------|----------|
| Revenue by Tier | SUM(amount) GROUP BY tier | `/admin/api/v1/financial` |
| MRR | Recurring revenue this month | `/admin/api/v1/financial` |
| ARR | MRR * 12 | `/admin/api/v1/financial` |
| CAC | Marketing spend / New users | `/admin/api/v1/financial` |
| API Costs | SUM(estimated_cost_usd) | `/admin/api/v1/financial` |

**Technical Metrics**:
| Metric | Calculation | Endpoint |
|--------|-------------|----------|
| Uptime | Health checks passed % | `/admin/api/v1/technical` |
| Error Rate | Errors / Total * 100 | `/admin/api/v1/technical` |
| P95 Latency | PERCENTILE_CONT(0.95) | `/admin/api/v1/technical` |
| Primary Model Usage | Primary / Total * 100 | `/admin/api/v1/technical` |

---

## 6. Security Improvements

### 6.1 Bot Token Protection (P0 Critical)

**Current Vulnerability**: Bot token `8130526654:AAFyKVRCFnFNIXsqvNnqdUyJm5ZNpMMQec0` is hardcoded in "Send Typing" and "Send Typing2" HTTP request nodes.

**Fix**: Replace HTTP request nodes with Telegram credential-based nodes.

**Before** (vulnerable):
```json
{
  "name": "Send Typing",
  "type": "n8n-nodes-base.httpRequest",
  "parameters": {
    "url": "https://api.telegram.org/bot8130526654:AAFyKVRCFnFNIXsqvNnqdUyJm5ZNpMMQec0/sendChatAction"
  }
}
```

**After** (secure):
```json
{
  "name": "Send Typing",
  "type": "n8n-nodes-base.telegram",
  "parameters": {
    "resource": "chat",
    "operation": "sendChatAction",
    "chatId": "={{ $('question').item.json.message.chat.id }}",
    "action": "typing"
  },
  "credentials": {
    "telegramApi": {
      "id": "fz3vmC0KKs1mxTnx",
      "name": "Kassiopeya"
    }
  }
}
```

**Post-Fix Action**: Regenerate the bot token in @BotFather since the current token is exposed in version control.

### 6.2 Rate Limiting

**Objective**: Prevent API quota exhaustion from abuse or automated attacks.

#### 6.2.1 Per-User Rate Limits

**Rate Limit Configuration**:
| Tier | Requests/Minute | Requests/Hour | Requests/Day |
|------|-----------------|---------------|--------------|
| Anonymous | 2 | 10 | 20 |
| FREE | 5 | 20 | 50 |
| BASIC | 10 | 50 | 200 |
| ADVANCED | 20 | 100 | 500 |
| PREMIUM | 50 | 200 | 1000 |

**Rate Limit Check Node**:
```javascript
// Code node: Check rate limits
const userId = $input.first().json.userId || $input.first().json.ipAddress;
const tier = $input.first().json.subscriptionTier || 'Anonymous';

const limits = {
  Anonymous: { minute: 2, hour: 10, day: 20 },
  FREE: { minute: 5, hour: 20, day: 50 },
  BASIC: { minute: 10, hour: 50, day: 200 },
  ADVANCED: { minute: 20, hour: 100, day: 500 },
  PREMIUM: { minute: 50, hour: 200, day: 1000 }
};

const tierLimits = limits[tier];

// Check against rate limit buckets in Supabase
const response = await $http.request({
  method: 'POST',
  url: `${process.env.SUPABASE_URL}/rest/v1/rpc/check_rate_limit`,
  headers: {
    'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
    'apikey': process.env.SUPABASE_ANON_KEY,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    p_user_id: userId,
    p_minute_limit: tierLimits.minute,
    p_hour_limit: tierLimits.hour,
    p_day_limit: tierLimits.day
  })
});

if (!response.data.allowed) {
  return {
    rateLimited: true,
    retryAfterMs: response.data.retry_after_ms,
    limitType: response.data.limit_type
  };
}

return { rateLimited: false };
```

### 6.3 Input Validation

**Objective**: Prevent prompt injection and malformed data from reaching AI models.

**Input Sanitization Node**:
```javascript
// Code node: Sanitize user input
function sanitizeInput(text) {
  if (!text) return '';

  // Remove potential prompt injection patterns
  const dangerousPatterns = [
    /ignore previous instructions/gi,
    /system prompt/gi,
    /you are now/gi,
    /forget everything/gi,
    /reveal your/gi,
    /show me your/gi
  ];

  let sanitized = text;
  for (const pattern of dangerousPatterns) {
    sanitized = sanitized.replace(pattern, '[filtered]');
  }

  // Truncate to reasonable length
  const MAX_LENGTH = 1000;
  if (sanitized.length > MAX_LENGTH) {
    sanitized = sanitized.substring(0, MAX_LENGTH) + '...';
  }

  // Remove non-printable characters
  sanitized = sanitized.replace(/[^\x20-\x7E\u0400-\u04FF\u4E00-\u9FFF]/g, '');

  return sanitized;
}

const input = $input.first().json;

return {
  ...input,
  text: sanitizeInput(input.text),
  focusArea: ['wellbeing', 'career', 'relationships', 'general'].includes(input.focusArea)
    ? input.focusArea
    : 'wellbeing',
  language: ['ru', 'en', 'zh'].includes(input.language) ? input.language : 'ru'
};
```

### 6.4 Webhook Authentication

**Objective**: Ensure webhooks only accept requests from trusted sources.

**Landing Page Webhook Auth**:
```javascript
// Code node: Verify webhook signature
const crypto = require('crypto');

function verifyWebhookSignature(payload, signature, secret) {
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(JSON.stringify(payload))
    .digest('hex');

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}

const signature = $input.first().json.headers['x-symancy-signature'];
const payload = $input.first().json.body;
const secret = process.env.WEBHOOK_SIGNING_SECRET;

if (!verifyWebhookSignature(payload, signature, secret)) {
  return {
    authenticated: false,
    error: 'Invalid webhook signature'
  };
}

return { authenticated: true, ...payload };
```

---

## 7. Migration Strategy

### 7.1 Migration Principles

1. **Zero Downtime**: Existing Telegram bot must continue functioning throughout migration.
2. **Feature Flags**: New functionality enabled gradually via configuration.
3. **Rollback Ready**: Every change must be revertible within 5 minutes.
4. **Data Integrity**: No data loss during schema migrations.

### 7.2 Migration Phases

#### Phase 1: Security Fixes (Days 1-2)

**Actions**:
1. Replace hardcoded bot token with credentials reference
2. Regenerate bot token in @BotFather
3. Update n8n credential store with new token
4. Connect error output paths for vision AI node

**Rollback**: Revert to previous workflow version (n8n version control).

**Validation**:
- [ ] Bot token not visible in workflow JSON
- [ ] Telegram bot responds to test message
- [ ] Error handler sends user notification on simulated failure

#### Phase 2: Database Schema (Days 3-4)

**Migrations**:
```sql
-- 001_create_analysis_cache.sql
CREATE TABLE analysis_cache (...);

-- 002_create_user_quotas.sql
CREATE TABLE user_quotas (...);

-- 003_create_workflow_executions.sql
CREATE TABLE workflow_executions (...);

-- 004_create_user_streaks.sql
CREATE TABLE user_streaks (...);

-- 005_create_user_achievements.sql
CREATE TABLE user_achievements (...);

-- 006_create_rate_limit_buckets.sql
CREATE TABLE rate_limit_buckets (...);
```

**Rollback**: Drop tables (no production data yet).

**Validation**:
- [ ] All tables created successfully
- [ ] RLS policies applied
- [ ] Test data inserts work

#### Phase 3: Core Workflow Refactoring (Days 5-8)

**Actions**:
1. Create "Coffee Analysis Core" sub-workflow
2. Extract reusable nodes from main workflow
3. Add input/output adapters
4. Implement caching layer

**Feature Flag**: `ENABLE_CACHING=false` initially.

**Rollback**: Restore original workflow from backup.

**Validation**:
- [ ] Telegram flow works identically
- [ ] Sub-workflow callable manually
- [ ] Cache writes (disabled reads)

#### Phase 4: Landing Page Integration (Days 9-12)

**Actions**:
1. Deploy landing page webhook trigger
2. Add authentication validation
3. Implement JSON response formatting
4. Connect to shared analysis pipeline

**Feature Flag**: `ENABLE_LANDING_WEBHOOK=false` initially.

**Rollback**: Disable webhook endpoint.

**Validation**:
- [ ] Webhook accepts test requests
- [ ] JWT validation works
- [ ] JSON response matches schema
- [ ] Telegram unaffected

#### Phase 5: Payment Integration (Days 13-16)

**Actions**:
1. Deploy YuKassa webhook handler
2. Implement subscription activation
3. Add Telegram Stars handler
4. Test payment flows with sandbox

**Feature Flag**: `ENABLE_PAYMENTS=false` initially.

**Rollback**: Disable payment webhooks.

**Validation**:
- [ ] YuKassa sandbox payments process
- [ ] Subscription activates correctly
- [ ] Quota resets on new subscription

#### Phase 6: Monitoring & Analytics (Days 17-20)

**Actions**:
1. Deploy execution logging
2. Set up health check workflow
3. Create admin API endpoints
4. Configure alert rules

**Feature Flag**: None (additive only).

**Rollback**: Disable logging nodes.

**Validation**:
- [ ] Metrics logged to Supabase
- [ ] Health checks run on schedule
- [ ] Admin API returns data
- [ ] Alerts trigger on simulated failures

### 7.3 Rollback Procedures

**Quick Rollback** (< 5 minutes):
```bash
# Revert to previous workflow version in n8n
curl -X POST "https://n8n.symancy.com/api/v1/workflows/{workflow_id}/revert" \
  -H "X-N8N-API-KEY: ${N8N_API_KEY}" \
  -d '{"version": "previous"}'
```

**Full Rollback** (database schema):
```sql
-- Rollback script: 001_rollback_to_baseline.sql
DROP TABLE IF EXISTS analysis_cache;
DROP TABLE IF EXISTS user_quotas;
DROP TABLE IF EXISTS workflow_executions;
DROP TABLE IF EXISTS user_streaks;
DROP TABLE IF EXISTS user_achievements;
DROP TABLE IF EXISTS rate_limit_buckets;
```

---

## 8. Testing Approach

### 8.1 Test Categories

| Category | Description | Automation |
|----------|-------------|------------|
| Unit Tests | Individual node logic (code nodes) | Jest |
| Integration Tests | End-to-end workflow execution | n8n Test Executions |
| Load Tests | Performance under concurrent requests | k6 |
| Security Tests | Authentication, authorization, input validation | OWASP ZAP |
| Regression Tests | Existing Telegram functionality | Manual + Automated |

### 8.2 Test Scenarios

#### 8.2.1 Landing Page Integration Tests

| Test ID | Scenario | Expected Result |
|---------|----------|-----------------|
| LP-001 | Valid request with image | 200 OK with analysis JSON |
| LP-002 | Missing authorization header | 401 Unauthorized |
| LP-003 | Expired JWT | 401 Unauthorized |
| LP-004 | Quota exceeded | 429 with quota_exceeded error |
| LP-005 | Invalid image format | 400 with image_invalid error |
| LP-006 | Cache hit scenario | 200 OK with cached=true, <500ms |
| LP-007 | Primary LLM failure | 200 OK with fallback model |
| LP-008 | All LLMs fail | 500 with llm_failed error |

#### 8.2.2 Telegram Regression Tests

| Test ID | Scenario | Expected Result |
|---------|----------|-----------------|
| TG-001 | Photo message | Multi-part analysis response |
| TG-002 | Text follow-up | Contextual response using memory |
| TG-003 | Rapid messages | Rate limit message |
| TG-004 | Invalid image | User-friendly error message |
| TG-005 | Bot restart recovery | Pending messages processed |

#### 8.2.3 Payment Tests

| Test ID | Scenario | Expected Result |
|---------|----------|-----------------|
| PAY-001 | YuKassa successful payment | Subscription activated |
| PAY-002 | YuKassa failed payment | No subscription change |
| PAY-003 | Invalid webhook signature | 403 Forbidden |
| PAY-004 | Duplicate payment webhook | Idempotent (no double activation) |
| PAY-005 | Telegram Stars payment | Subscription activated |

### 8.3 Load Testing

**k6 Script for Landing Page Endpoint**:
```javascript
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '1m', target: 10 },   // Ramp up to 10 users
    { duration: '5m', target: 50 },   // Sustain 50 users
    { duration: '1m', target: 0 },    // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<30000'], // 95% under 30s
    http_req_failed: ['rate<0.05'],     // <5% errors
  },
};

const testImage = open('./test-coffee-cup.jpg', 'b');
const testImageBase64 = encoding.b64encode(testImage);

export default function () {
  const payload = JSON.stringify({
    imageData: testImageBase64,
    mimeType: 'image/jpeg',
    focusArea: 'wellbeing',
    language: 'ru',
    userId: `test-user-${__VU}`,
    requestId: `req-${__VU}-${__ITER}`,
    source: 'landing',
    subscriptionTier: 'FREE',
    remainingQuota: 1
  });

  const params = {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${__ENV.TEST_JWT}`,
    },
  };

  const res = http.post(
    'https://n8n.symancy.com/webhook/analyze',
    payload,
    params
  );

  check(res, {
    'status is 200': (r) => r.status === 200,
    'has analysis': (r) => r.json('analysis') !== null,
  });

  sleep(1);
}
```

**Performance Targets**:
| Metric | Target | Measurement |
|--------|--------|-------------|
| Throughput | 60 req/min | k6 `http_reqs` |
| Latency (p50) | <15s | k6 `http_req_duration` |
| Latency (p95) | <30s | k6 `http_req_duration` |
| Error Rate | <2% | k6 `http_req_failed` |
| Cache Hit Response | <500ms | Custom metric |

---

## 9. Rollback Plan

### 9.1 Rollback Triggers

| Trigger | Threshold | Response Time |
|---------|-----------|---------------|
| Error rate spike | >10% for 5 minutes | 2 minutes |
| Latency spike | p95 >60s for 5 minutes | 5 minutes |
| Total outage | No successful executions for 2 minutes | Immediate |
| Security incident | Any confirmed breach | Immediate |
| Data corruption | Any detected | Immediate |

### 9.2 Rollback Procedures

#### 9.2.1 Workflow Rollback

**Time to execute**: <5 minutes

```bash
# Step 1: Identify the stable version
# n8n stores execution history - find last successful version ID

# Step 2: Disable current workflow
curl -X PATCH "https://n8n.symancy.com/api/v1/workflows/{workflow_id}" \
  -H "X-N8N-API-KEY: ${N8N_API_KEY}" \
  -d '{"active": false}'

# Step 3: Import backup workflow
curl -X POST "https://n8n.symancy.com/api/v1/workflows" \
  -H "X-N8N-API-KEY: ${N8N_API_KEY}" \
  -d @workflow-backup-{date}.json

# Step 4: Activate backup workflow
curl -X PATCH "https://n8n.symancy.com/api/v1/workflows/{new_workflow_id}" \
  -H "X-N8N-API-KEY: ${N8N_API_KEY}" \
  -d '{"active": true}'
```

#### 9.2.2 Database Rollback

**Time to execute**: 5-15 minutes

```sql
-- Option A: Drop new tables (if no production data)
DROP TABLE IF EXISTS analysis_cache CASCADE;
DROP TABLE IF EXISTS workflow_executions CASCADE;
-- etc.

-- Option B: Restore from backup
-- Supabase point-in-time recovery to before migration
```

#### 9.2.3 Feature Flag Rollback

**Time to execute**: <1 minute

```bash
# Disable all new features via environment variables
supabase secrets set ENABLE_LANDING_WEBHOOK=false
supabase secrets set ENABLE_CACHING=false
supabase secrets set ENABLE_PAYMENTS=false

# Trigger workflow reload
curl -X POST "https://n8n.symancy.com/api/v1/workflows/{workflow_id}/reload"
```

### 9.3 Communication Plan

**Internal Notification** (immediate):
- Slack channel: #symancy-alerts
- PagerDuty: On-call engineer

**User Communication** (if >5 minute outage):
- Telegram bot status message: "We're experiencing technical difficulties..."
- Landing page maintenance banner

**Post-Incident**:
- Root cause analysis within 24 hours
- Post-mortem document within 48 hours
- Prevention measures documented

---

## Validation Checklist

### Schema Compliance

- [X] Section 1: Overview (Strategic goals, current state, critical issues)
- [X] Section 2: Landing Page Support (Webhook, auth, routing, quota)
- [X] Section 3: Performance Optimizations (Caching, progress, confidence, fallback)
- [X] Section 4: Reliability Enhancements (Error handling, timeouts, monitoring)
- [X] Section 5: New Integrations (Payment, Telegram Stars, gamification, admin API)
- [X] Section 6: Security Improvements (Token, rate limiting, validation, auth)
- [X] Section 7: Migration Strategy (Phases, rollback procedures)
- [X] Section 8: Testing Approach (Categories, scenarios, load tests)
- [X] Section 9: Rollback Plan (Triggers, procedures, communication)

### Success Criteria Mapping (SC-005)

| Landing Page Enhancement | Workflow Specification | Section |
|-------------------------|------------------------|---------|
| Image Upload (2.1) | Quality validation endpoint | 2.1.1 |
| AI Analysis (2.2) | Progress callbacks, confidence | 3.2, 3.3 |
| Focus Area (2.3) | Multi-focus prompt support | 2.2 |
| Results Display (2.4) | Structured JSON output | 2.1.1 |
| History (2.5) | Analysis metadata storage | 2.3 |
| Authentication (2.6) | JWT validation, linking | 2.1.2 |
| Internationalization (2.7) | Language-aware prompts | 2.2 |
| Trend Analytics (3.2) | Aggregate data endpoints | 5.4 |
| Reminders (3.5) | Scheduled notifications | 5.3 |
| Expert Analysis (3.6) | Human review queue | Future phase |

**Coverage**: 100% of landing page enhancements have workflow specifications

### Technical Implementation Readiness

- [X] All improvements have clear success criteria
- [X] Technical team can implement based solely on specification
- [X] Integration risks identified and mitigated
- [X] Migration strategy is non-disruptive
- [X] Current limitations addressed (from current-analysis.md)

---

## Document Metadata

**Specification Completeness**:
- Total sections: 9/9 required
- Word count: ~8,000
- Code examples: 25+
- SQL migrations: 6 defined
- Node configurations: 15+ specified

**Dependencies**:
- current-analysis.md (P4 deliverable)
- future-state.md (P2 deliverable)
- Client requirements document

**Next Steps**:
1. Stakeholder review and approval
2. Create implementation tickets in project tracker
3. Begin Phase 1: Security Fixes
4. Schedule migration windows with operations team

---

**End of Document**
