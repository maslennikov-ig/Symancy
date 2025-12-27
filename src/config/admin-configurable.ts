/**
 * Admin-Configurable Settings
 *
 * This file documents all settings that will be editable via Admin Panel.
 * Currently hardcoded values will be moved to `system_config` table.
 *
 * @see docs/ADMIN_PANEL_SPEC.md for full Admin Panel specification
 *
 * TODO: After Admin Panel implementation:
 * 1. Create Supabase table `system_config`
 * 2. Create React context for config values
 * 3. Replace hardcoded values with context values
 * 4. Add real-time updates via Supabase Realtime
 */

// ============================================================================
// LLM MODELS - Configurable via Admin Panel
// ============================================================================

/**
 * AI Model Configuration
 * @adminEditable true
 * @table system_config
 */
export const LLM_MODELS = {
  /** Vision model for photo analysis (OpenRouter format) */
  MODEL_VISION: 'google/gemini-1.5-flash',

  /** Arina interpretation model */
  MODEL_ARINA: 'google/gemini-1.5-flash',

  /** Cassandra premium model */
  MODEL_CASSANDRA: 'anthropic/claude-3.5-sonnet',

  /** Chat follow-up model */
  MODEL_CHAT: 'openai/gpt-4o-mini',
} as const;

/**
 * Model Parameters
 * @adminEditable true
 * @table system_config
 */
export const MODEL_PARAMS = {
  /** Maximum tokens for vision analysis */
  VISION_MAX_TOKENS: 4096,

  /** Temperature for creative responses (0.0-2.0) */
  ARINA_TEMPERATURE: 0.7,

  /** Temperature for Cassandra (more creative) */
  CASSANDRA_TEMPERATURE: 0.9,

  /** Chat response max tokens */
  CHAT_MAX_TOKENS: 1024,
} as const;

// ============================================================================
// CREDITS & PRICING - Configurable via Admin Panel
// ============================================================================

/**
 * Credit Costs
 * @adminEditable true
 * @table system_config
 */
export const CREDIT_COSTS = {
  /** Credits for basic analysis */
  COST_BASIC: 1,

  /** Credits for Cassandra esoteric reading */
  COST_CASSANDRA: 1,

  /** Free chat messages per day */
  CHAT_DAILY_LIMIT: 50,
} as const;

// ============================================================================
// ENGAGEMENT & NOTIFICATIONS - Configurable via Admin Panel
// ============================================================================

/**
 * Proactive Engagement Settings
 * @adminEditable true
 * @table system_config
 */
export const ENGAGEMENT_CONFIG = {
  /** Days before sending inactive reminder */
  INACTIVE_REMINDER_DAYS: 7,

  /** Maximum reminders before stopping */
  MAX_REMINDERS: 3,
} as const;

// ============================================================================
// PROMPTS - Configurable via Admin Panel
// ============================================================================

/**
 * System Prompts (to be stored in DB)
 * @adminEditable true
 * @table system_prompts (future)
 *
 * TODO: Create separate table for prompts:
 * - prompt_key (primary key)
 * - prompt_text (text)
 * - model_hint (which model uses this)
 * - version (for A/B testing)
 * - is_active (boolean)
 */
export const PROMPTS = {
  /** Vision analysis system prompt key */
  VISION_SYSTEM: 'vision_analysis_v1',

  /** Arina interpretation prompt key */
  ARINA_SYSTEM: 'arina_interpretation_v1',

  /** Cassandra esoteric prompt key */
  CASSANDRA_SYSTEM: 'cassandra_esoteric_v1',

  /** Chat follow-up prompt key */
  CHAT_SYSTEM: 'chat_followup_v1',
} as const;

// ============================================================================
// UI CONFIGURATION - Partially Admin Configurable
// ============================================================================

/**
 * Chat UI Configuration
 * @adminEditable partial (avatars, delays)
 * @see src/config/chat.ts
 */
export const CHAT_UI_CONFIG = {
  /** Arina avatar URL - editable via admin */
  ARINA_AVATAR: 'https://ui-avatars.com/api/?name=Arina&background=8B4513&color=fff',

  /** Typing simulation delay - editable via admin */
  TYPING_DELAY_MS: 1000,

  /** Greeting delay - editable via admin */
  GREETING_DELAY_MS: 500,
} as const;

// ============================================================================
// FEATURE FLAGS - Configurable via Admin Panel
// ============================================================================

/**
 * Feature Flags
 * @adminEditable true
 * @table system_config
 */
export const FEATURE_FLAGS = {
  /** Enable Cassandra (esoteric) mode */
  ENABLE_CASSANDRA: true,

  /** Enable chat follow-up feature */
  ENABLE_CHAT_FOLLOWUP: true,

  /** Enable proactive notifications */
  ENABLE_PROACTIVE_MESSAGES: true,

  /** Enable social sharing */
  ENABLE_SHARING: true,

  /** Maintenance mode (disables analysis) */
  MAINTENANCE_MODE: false,
} as const;

// ============================================================================
// ADMIN PANEL IMPLEMENTATION NOTES
// ============================================================================

/**
 * Implementation Checklist:
 *
 * Phase 1: Database
 * - [ ] Create `system_config` table with key/value structure
 * - [ ] Create RLS policies for admin-only access
 * - [ ] Seed with default values from this file
 *
 * Phase 2: Backend
 * - [ ] Create Edge Function to read config (cached)
 * - [ ] Create Edge Function to update config (admin only)
 * - [ ] Add Supabase Realtime subscription for live updates
 *
 * Phase 3: Frontend
 * - [ ] Create ConfigContext with React Context
 * - [ ] Replace hardcoded values with context
 * - [ ] Add loading states for config
 *
 * Phase 4: Admin UI
 * - [ ] Config editor with validation
 * - [ ] Prompt editor with preview
 * - [ ] Model selector with cost display
 * - [ ] Feature flag toggles
 */
