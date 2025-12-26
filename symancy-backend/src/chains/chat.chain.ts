/**
 * Chat Chain
 * Handles follow-up text messages after photo analysis
 * Loads conversation history and last analysis for context
 */
import { HumanMessage, SystemMessage, AIMessage } from "@langchain/core/messages";
import type { BaseMessage } from "@langchain/core/messages";
import { createArinaModel } from "../core/langchain/models.js";
import type {
  ChatChainInput,
  ChatResponseResult,
} from "../types/langchain.js";
import { getSupabase } from "../core/database.js";
import { readFile } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { CHAT_HISTORY_LIMIT } from "../config/constants.js";

/**
 * Get project root directory
 */
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "../..");

/**
 * Cached prompts (loaded once at module init)
 */
let arinaSystemPrompt: string | null = null;
let arinaChatPrompt: string | null = null;

/**
 * Load and cache Arina prompts from disk
 * Called once at module initialization or on first use
 */
async function loadArinaPrompts(): Promise<void> {
  if (arinaSystemPrompt && arinaChatPrompt) {
    return; // Already loaded
  }

  const systemPromptPath = path.join(
    projectRoot,
    "prompts/arina/system.txt"
  );
  const chatPromptPath = path.join(
    projectRoot,
    "prompts/arina/chat.txt"
  );

  [arinaSystemPrompt, arinaChatPrompt] = await Promise.all([
    readFile(systemPromptPath, "utf-8"),
    readFile(chatPromptPath, "utf-8"),
  ]);
}

/**
 * Replace placeholders in chat prompt template
 */
function replacePlaceholders(
  template: string,
  replacements: Record<string, string>
): string {
  let result = template;

  for (const [key, value] of Object.entries(replacements)) {
    const placeholder = `{{${key}}}`;
    result = result.replaceAll(placeholder, value);
  }

  return result;
}

/**
 * Load chat history from database
 * Returns last N messages formatted as LangChain BaseMessage objects
 *
 * @param telegramUserId - Telegram user ID
 * @param limit - Maximum number of messages to load (default: 20)
 * @returns Array of BaseMessage objects (HumanMessage, AIMessage)
 */
async function loadChatHistory(
  telegramUserId: number,
  limit: number = CHAT_HISTORY_LIMIT
): Promise<BaseMessage[]> {
  const supabase = getSupabase();

  // Load last N messages ordered by created_at DESC
  const { data: messages, error } = await supabase
    .from("chat_messages")
    .select("role, content, created_at")
    .eq("telegram_user_id", telegramUserId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`Failed to load chat history: ${error.message}`);
  }

  if (!messages || messages.length === 0) {
    return [];
  }

  // Reverse to get chronological order (oldest first)
  const chronologicalMessages = messages.reverse();

  // Convert to LangChain message objects
  return chronologicalMessages.map((msg) => {
    if (msg.role === "user") {
      return new HumanMessage(msg.content);
    } else {
      return new AIMessage(msg.content);
    }
  });
}

/**
 * Load last completed analysis for user
 * Provides context for follow-up questions about symbols, patterns, etc.
 *
 * @param telegramUserId - Telegram user ID
 * @returns Last interpretation text or null if none found
 */
async function loadLastAnalysis(
  telegramUserId: number
): Promise<string | null> {
  const supabase = getSupabase();

  const { data: analysis, error } = await supabase
    .from("analysis_history")
    .select("interpretation")
    .eq("telegram_user_id", telegramUserId)
    .eq("status", "completed")
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (error || !analysis) {
    return null;
  }

  return analysis.interpretation;
}

/**
 * Generate chat response with conversation history and analysis context
 *
 * @param input - User message, conversation history, and optional last analysis
 * @returns ChatResponseResult with text and token usage
 */
export async function generateChatResponse(
  input: ChatChainInput
): Promise<ChatResponseResult> {
  const { message, history, lastAnalysis } = input;

  // Load prompts (cached after first call)
  await loadArinaPrompts();

  if (!arinaSystemPrompt || !arinaChatPrompt) {
    throw new Error("Failed to load Arina prompts");
  }

  // Format last analysis for prompt context
  const lastAnalysisText = lastAnalysis
    ? lastAnalysis.text
    : "No previous analysis available. This is a new conversation.";

  // Replace placeholders in chat prompt
  const chatPromptText = replacePlaceholders(arinaChatPrompt, {
    LAST_ANALYSIS: lastAnalysisText,
    USER_NAME: "дорогой друг",
    LANGUAGE: "ru",
  });

  // Create messages for LangChain
  const messages: BaseMessage[] = [
    new SystemMessage(arinaSystemPrompt),
    new SystemMessage(chatPromptText),
    ...history,
    new HumanMessage(message),
  ];

  // Create Arina model and invoke
  const model = createArinaModel();
  const response = await model.invoke(messages);

  // Extract token usage from response metadata
  const tokensUsed = response.usage_metadata?.total_tokens ?? 0;

  return {
    text: response.content as string,
    tokensUsed,
  };
}

/**
 * Direct chat response generation (convenience wrapper)
 * Loads chat history and last analysis from database automatically
 *
 * @param message - User message text
 * @param telegramUserId - Telegram user ID for loading history
 * @param options - Optional language and userName overrides
 * @returns ChatResponseResult with text and token usage
 */
export async function generateChatResponseDirect(
  message: string,
  telegramUserId: number,
  options: { language?: string; userName?: string } = {}
): Promise<ChatResponseResult> {
  const { language = "ru", userName = "дорогой друг" } = options;

  // Load prompts (cached after first call)
  await loadArinaPrompts();

  if (!arinaSystemPrompt || !arinaChatPrompt) {
    throw new Error("Failed to load Arina prompts");
  }

  // Load chat history from database
  const history = await loadChatHistory(telegramUserId);

  // Load last analysis
  const lastAnalysisText = await loadLastAnalysis(telegramUserId);

  // Format last analysis for prompt
  const lastAnalysisContext = lastAnalysisText
    ? lastAnalysisText
    : "No previous analysis available. This is a new conversation.";

  // Replace placeholders in chat prompt
  const chatPromptText = replacePlaceholders(arinaChatPrompt, {
    LAST_ANALYSIS: lastAnalysisContext,
    USER_NAME: userName,
    LANGUAGE: language,
  });

  // Create messages for LangChain
  const messages: BaseMessage[] = [
    new SystemMessage(arinaSystemPrompt),
    new SystemMessage(chatPromptText),
    ...history,
    new HumanMessage(message),
  ];

  // Create Arina model and invoke
  const model = createArinaModel();
  const response = await model.invoke(messages);

  // Extract token usage from response metadata
  const tokensUsed = response.usage_metadata?.total_tokens ?? 0;

  return {
    text: response.content as string,
    tokensUsed,
  };
}
