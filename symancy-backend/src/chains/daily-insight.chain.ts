/**
 * Daily Insight Chain
 * Generates personalized daily insights (morning advice & evening reflection)
 * using user context, chat history, memories, and last analysis
 */
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { createArinaModel } from "../core/langchain/models.js";
import { getSupabase } from "../core/database.js";
import { searchMemories } from "../services/memory.service.js";
import { readFile } from "fs/promises";
import path from "path";

/**
 * Context for generating personalized insights
 */
export interface InsightContext {
  /** Unified user ID (UUID) */
  userId: string;
  /** Telegram user ID for querying legacy tables */
  telegramId: number;
  /** User's display name (can be null) */
  displayName: string | null;
  /** User's language code (ru, en, zh) */
  languageCode: string;
}

/**
 * Result of insight generation
 */
export interface GeneratedInsight {
  /** Full insight text */
  text: string;
  /** Short preview (first 100 chars) */
  shortText: string;
  /** Tokens used for generation */
  tokensUsed: number;
  /** Context data for tracking */
  contextData: {
    message_ids: string[];
    memory_ids: string[];
    last_analysis_id: string | null;
  };
}

/**
 * Message from database
 */
interface DbMessage {
  id: string;
  content: string | null;
  role: string;
  created_at: string;
}

/**
 * Analysis from database
 */
interface DbAnalysis {
  id: string;
  interpretation: string | null;
}

/**
 * Truncate text nicely without breaking words
 * @param text - Text to truncate
 * @param maxLen - Maximum length
 * @returns Truncated text with ellipsis if needed
 */
function truncateNicely(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;

  // Try to find last space before maxLen
  const truncated = text.slice(0, maxLen);
  const lastSpace = truncated.lastIndexOf(' ');

  // Don't cut too short (at least 70% of maxLen)
  if (lastSpace > maxLen * 0.7) {
    return truncated.slice(0, lastSpace) + '...';
  }

  return truncated + '...';
}

// Cached prompts (loaded once)
let systemPrompt: string | null = null;
let morningAdvicePrompt: string | null = null;
let eveningInsightPrompt: string | null = null;

/**
 * Load and cache prompts from disk
 */
async function loadPrompts(): Promise<void> {
  if (systemPrompt && morningAdvicePrompt && eveningInsightPrompt) {
    return; // Already loaded
  }

  const promptsDir = path.join(process.cwd(), "prompts/arina");

  [systemPrompt, morningAdvicePrompt, eveningInsightPrompt] = await Promise.all([
    readFile(path.join(promptsDir, "system.txt"), "utf-8"),
    readFile(path.join(promptsDir, "morning-advice.txt"), "utf-8"),
    readFile(path.join(promptsDir, "evening-insight.txt"), "utf-8"),
  ]);
}

/**
 * Replace placeholders in prompt template
 */
function replacePlaceholders(
  template: string,
  replacements: Record<string, string>
): string {
  let result = template;
  for (const [key, value] of Object.entries(replacements)) {
    result = result.replaceAll(`{{${key}}}`, value);
  }
  return result;
}

/**
 * Load recent messages for user from messages table via conversations
 *
 * @param userId - Unified user ID
 * @param limit - Maximum number of messages to load (default: 10)
 * @returns Array of messages with IDs
 */
async function loadRecentMessages(
  userId: string,
  limit: number = 10
): Promise<{ messages: DbMessage[]; ids: string[] }> {
  const supabase = getSupabase();

  // First get the user's conversation
  const { data: conversation, error: convError } = await supabase
    .from("conversations")
    .select("id")
    .eq("unified_user_id", userId)
    .order("last_message_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (convError || !conversation) {
    return { messages: [], ids: [] };
  }

  // Then get messages from that conversation
  const { data: messages, error: msgError } = await supabase
    .from("messages")
    .select("id, content, role, created_at")
    .eq("conversation_id", conversation.id)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (msgError || !messages || messages.length === 0) {
    return { messages: [], ids: [] };
  }

  // Reverse to get chronological order
  const chronological = messages.reverse() as DbMessage[];
  const ids = chronological.map((m) => m.id);

  return { messages: chronological, ids };
}

/**
 * Load last completed analysis for user
 *
 * @param telegramId - Telegram user ID
 * @returns Analysis data or null
 */
async function loadLastAnalysis(
  telegramId: number
): Promise<{ analysis: DbAnalysis | null; id: string | null }> {
  const supabase = getSupabase();

  const { data: analysis, error } = await supabase
    .from("analysis_history")
    .select("id, interpretation")
    .eq("telegram_user_id", telegramId)
    .eq("status", "completed")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !analysis) {
    return { analysis: null, id: null };
  }

  return { analysis: analysis as DbAnalysis, id: analysis.id };
}

/**
 * Format messages for prompt context
 */
function formatMessagesForPrompt(messages: DbMessage[]): string {
  if (messages.length === 0) {
    return "No recent messages.";
  }

  return messages
    .filter((m) => m.content)
    .map((m) => {
      const role = m.role === "user" ? "User" : "Arina";
      return `${role}: ${m.content}`;
    })
    .join("\n");
}

/**
 * Format memories for prompt context
 */
function formatMemoriesForPrompt(
  memories: Array<{ id: string; content: string; category: string }>
): string {
  if (memories.length === 0) {
    return "No saved memories.";
  }

  return memories.map((m) => `- ${m.content}`).join("\n");
}

/**
 * Format user context for prompt
 */
function formatUserContext(context: InsightContext): string {
  const name = context.displayName || "User";
  const lang = context.languageCode || "ru";
  return `Name: ${name}\nLanguage: ${lang}`;
}

/**
 * Generate morning advice for user
 *
 * @param context - User context with IDs and preferences
 * @returns Generated insight with metadata
 */
export async function generateMorningAdvice(
  context: InsightContext
): Promise<GeneratedInsight> {
  // Load prompts
  await loadPrompts();

  if (!systemPrompt || !morningAdvicePrompt) {
    throw new Error("Failed to load prompts");
  }

  // Load context data in parallel
  const [messagesData, analysisData, memories] = await Promise.all([
    loadRecentMessages(context.userId, 10),
    loadLastAnalysis(context.telegramId),
    searchMemories(context.telegramId, "personal preferences interests", 5).catch(() => []),
  ]);

  // Format context for prompt
  const userContextText = formatUserContext(context);
  const chatHistoryText = formatMessagesForPrompt(messagesData.messages);
  const memoriesText = formatMemoriesForPrompt(
    memories.map((m) => ({ id: m.id, content: m.content, category: m.category }))
  );
  const lastAnalysisText = analysisData.analysis?.interpretation || "No recent analyses.";

  // Replace placeholders
  const filledPrompt = replacePlaceholders(morningAdvicePrompt, {
    USER_CONTEXT: userContextText,
    CHAT_HISTORY: chatHistoryText,
    USER_MEMORIES: memoriesText,
    LAST_ANALYSIS: lastAnalysisText,
  });

  // Create model and invoke
  const model = await createArinaModel({ maxTokens: 500 });
  const response = await model.invoke([
    new SystemMessage(systemPrompt),
    new HumanMessage(filledPrompt),
  ]);

  const text = response.content as string;
  const tokensUsed = response.usage_metadata?.total_tokens ?? 0;

  return {
    text,
    shortText: truncateNicely(text, 100),
    tokensUsed,
    contextData: {
      message_ids: messagesData.ids,
      memory_ids: memories.map((m) => m.id),
      last_analysis_id: analysisData.id,
    },
  };
}

/**
 * Generate evening insight for user
 *
 * @param context - User context with IDs and preferences
 * @param morningAdvice - Today's morning advice text
 * @returns Generated insight with metadata
 */
export async function generateEveningInsight(
  context: InsightContext,
  morningAdvice: string
): Promise<GeneratedInsight> {
  // Load prompts
  await loadPrompts();

  if (!systemPrompt || !eveningInsightPrompt) {
    throw new Error("Failed to load prompts");
  }

  // Load today's messages
  const messagesData = await loadRecentMessages(context.userId, 10);

  // Format context for prompt
  const userContextText = formatUserContext(context);
  const todaysMessagesText = formatMessagesForPrompt(messagesData.messages);

  // Replace placeholders
  const filledPrompt = replacePlaceholders(eveningInsightPrompt, {
    MORNING_ADVICE: morningAdvice,
    TODAYS_MESSAGES: todaysMessagesText,
    USER_CONTEXT: userContextText,
  });

  // Create model and invoke
  const model = await createArinaModel({ maxTokens: 500 });
  const response = await model.invoke([
    new SystemMessage(systemPrompt),
    new HumanMessage(filledPrompt),
  ]);

  const text = response.content as string;
  const tokensUsed = response.usage_metadata?.total_tokens ?? 0;

  return {
    text,
    shortText: truncateNicely(text, 100),
    tokensUsed,
    contextData: {
      message_ids: messagesData.ids,
      memory_ids: [],
      last_analysis_id: null,
    },
  };
}
