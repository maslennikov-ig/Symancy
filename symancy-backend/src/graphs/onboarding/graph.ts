/**
 * Onboarding StateGraph - T052
 * Connects all onboarding nodes with conditional routing
 */
import { StateGraph, START, END } from "@langchain/langgraph";
import type { PostgresSaver } from "@langchain/langgraph-checkpoint-postgres";
import { OnboardingStateAnnotation } from "./state.js";
import type { OnboardingStateAnnotationType } from "./state.js";
import { welcome } from "./nodes/welcome.js";
import { askName } from "./nodes/ask-name.js";
import { askGoals } from "./nodes/ask-goals.js";
import { askTimezone } from "./nodes/ask-timezone.js";
import { complete } from "./nodes/complete.js";
import { getLogger } from "../../core/logger.js";

const logger = getLogger().child({ module: "onboarding:graph" });

/**
 * Conditional routing function for ask_goals node
 * Routes to ask_timezone if goals include "spiritual", otherwise to complete
 */
function routeAfterGoals(
  state: OnboardingStateAnnotationType
): "ask_timezone" | "complete" {
  const { goals, telegramUserId } = state;

  // If goals include "spiritual", ask for timezone (for meditation reminders)
  const hasSpiritual = goals.includes("spiritual");
  const nextNode = hasSpiritual ? "ask_timezone" : "complete";

  logger.info(
    { telegramUserId, goals, hasSpiritual, nextNode },
    "Routing after goals collection"
  );

  return nextNode;
}

/**
 * Create the onboarding StateGraph
 * Flow: START → welcome → ask_name → ask_goals → [conditional] → complete → END
 *                                                      ↓
 *                                                 ask_timezone → complete → END
 */
function createGraphBuilder() {
  const builder = new StateGraph(OnboardingStateAnnotation)
    // Add all nodes
    .addNode("welcome", welcome)
    .addNode("ask_name", askName)
    .addNode("ask_goals", askGoals)
    .addNode("ask_timezone", askTimezone)
    .addNode("complete", complete)

    // Define edges
    .addEdge(START, "welcome")
    .addEdge("welcome", "ask_name")
    .addEdge("ask_name", "ask_goals")

    // Conditional routing from ask_goals
    .addConditionalEdges("ask_goals", routeAfterGoals, {
      ask_timezone: "ask_timezone",
      complete: "complete",
    })

    // ask_timezone always goes to complete
    .addEdge("ask_timezone", "complete")

    // complete is terminal
    .addEdge("complete", END);

  return builder;
}

/**
 * Compiled onboarding graph (without checkpointer)
 * Use for stateless execution or when checkpointer is not needed
 */
export const onboardingGraph = createGraphBuilder().compile();

/**
 * Create onboarding graph with optional PostgresSaver checkpointer
 * Use for stateful execution with thread_id persistence
 *
 * @param checkpointer - Optional PostgresSaver for state persistence
 * @returns Compiled graph with checkpointer support
 *
 * @example
 * ```typescript
 * import { PostgresSaver } from "@langchain/langgraph-checkpoint-postgres";
 *
 * const checkpointer = PostgresSaver.fromConnString(process.env.DATABASE_URL);
 * await checkpointer.setup();
 *
 * const graph = await createOnboardingGraph(checkpointer);
 *
 * // Invoke with thread_id for persistence
 * const result = await graph.invoke(
 *   { telegramUserId: 123, chatId: 123, step: "welcome", ... },
 *   { configurable: { thread_id: "user-123" } }
 * );
 *
 * // Resume from last state
 * const resumed = await graph.invoke(
 *   { ... },
 *   { configurable: { thread_id: "user-123" } }
 * );
 * ```
 */
export async function createOnboardingGraph(checkpointer?: PostgresSaver) {
  const builder = createGraphBuilder();

  if (checkpointer) {
    logger.info("Compiling onboarding graph with PostgresSaver checkpointer");
    return builder.compile({ checkpointer });
  }

  logger.info("Compiling onboarding graph without checkpointer");
  return builder.compile();
}

/**
 * Type for compiled graph
 */
export type OnboardingGraphType = Awaited<
  ReturnType<typeof createOnboardingGraph>
>;
