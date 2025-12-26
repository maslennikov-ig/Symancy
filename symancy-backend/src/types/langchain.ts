/**
 * LangChain chain and graph types
 * Defines interfaces for LangChain workflows, state, and results
 */
import type { RunnableConfig } from "@langchain/core/runnables";
import type { BaseMessage } from "@langchain/core/messages";

/**
 * Vision analysis result
 * Output from vision model processing photo content
 */
export interface VisionAnalysisResult {
  symbols: string[];
  colors: string[];
  patterns: string[];
  rawDescription: string;
}

/**
 * Structured vision analysis result (new format)
 * Parsed from vision model's structured output
 */
export interface StructuredVisionResult {
  /** Image quality assessment */
  technicalQuality: "CLEAR" | "BLURRY" | "EMPTY" | "DARK";
  /** Complexity score 1-10 */
  complexityScore: number;
  /** Sediment physics description */
  sedimentPhysics: {
    density: string;
    flow: string;
    chaos: string;
  };
  /** Zone analysis (traditional tasseography) */
  zones: {
    rim: string;
    center: string;
    bottom: string;
  };
  /** Visual anchors (2-5 unique patterns) */
  visualAnchors: Array<{
    location: string;
    geometry: string;
    texture: string;
    uniqueFeature: string;
  }>;
  /** Atmosphere keywords (3) */
  atmosphere: string[];
  /** Raw description for fallback */
  rawDescription: string;
}

/**
 * Interpretation result from persona
 * Persona-specific analysis of vision results
 */
export interface InterpretationResult {
  text: string;
  persona: "arina" | "cassandra";
  tokensUsed: number;
  success?: boolean;
  error?: string;
}

/**
 * Chat response result
 * LLM-generated reply to user text messages
 */
export interface ChatResponseResult {
  text: string;
  tokensUsed: number;
}

/**
 * Onboarding state for LangGraph
 * State machine data for user onboarding flow
 */
export interface OnboardingState {
  step: string;
  name: string | null;
  goals: string[];
  notifications: boolean | null;
  messages: BaseMessage[];
}

/**
 * Thread config for LangGraph
 * Configuration for stateful conversation threads
 */
export interface ThreadConfig extends RunnableConfig {
  configurable: {
    thread_id: string;
  };
}

/**
 * Chain input/output types
 * Typed inputs for LangChain chain invocations
 */

/**
 * Vision chain input
 * Base64-encoded image for vision model analysis
 */
export interface VisionChainInput {
  imageBase64: string;
}

/**
 * Interpretation chain input
 * Vision result with selected persona for interpretation
 */
export interface InterpretationChainInput {
  visionResult: VisionAnalysisResult;
  persona: "arina" | "cassandra";
}

/**
 * Chat chain input
 * User message with conversation context
 */
export interface ChatChainInput {
  message: string;
  history: BaseMessage[];
  lastAnalysis?: InterpretationResult;
}
