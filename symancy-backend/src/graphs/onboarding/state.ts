/**
 * Onboarding Graph State Schema
 * Defines the LangGraph state for user onboarding flow using Zod validation
 */
import { z } from "zod";
import { Annotation } from "@langchain/langgraph";
import { registry } from "@langchain/langgraph/zod";

/**
 * Onboarding flow steps
 */
export const OnboardingStep = z.enum([
  "welcome",
  "ask_name",
  "ask_goals",
  "ask_timezone",
  "complete",
]);

export type OnboardingStepType = z.infer<typeof OnboardingStep>;

/**
 * User goals (multi-select)
 */
export const UserGoal = z.enum([
  "career", // карьера
  "relationships", // отношения
  "health", // здоровье
  "finances", // финансы
  "spiritual", // духовный рост
]);

export type UserGoalType = z.infer<typeof UserGoal>;

/**
 * Onboarding State Zod Schema
 * Used for runtime validation and type inference
 */
export const OnboardingStateSchema = z.object({
  // Current step in the onboarding flow
  step: OnboardingStep.default("welcome").register(registry, {
    reducer: {
      fn: (prev, next) => {
        // Guard against undefined/null
        if (next === undefined || next === null) {
          return prev;
        }
        return next;
      },
      schema: OnboardingStep,
    },
  }),

  // User's Telegram ID
  telegramUserId: z.number().positive().register(registry, {
    reducer: {
      fn: (prev, next) => {
        // Guard against undefined/null
        if (next === undefined || next === null) {
          return prev;
        }
        return next;
      },
      schema: z.number().positive(),
    },
  }),

  // Chat ID for sending messages
  chatId: z.number().register(registry, {
    reducer: {
      fn: (prev, next) => {
        // Guard against undefined/null
        if (next === undefined || next === null) {
          return prev;
        }
        return next;
      },
      schema: z.number(),
    },
  }),

  // User's name (collected in ask_name step)
  name: z
    .string()
    .nullable()
    .default(null)
    .register(registry, {
      reducer: {
        fn: (prev, next) => {
          // Guard against undefined (null is valid for nullable field)
          if (next === undefined) {
            return prev;
          }
          return next;
        },
        schema: z.string().nullable(),
      },
    }),

  // Selected goals (collected in ask_goals step)
  goals: z
    .array(UserGoal)
    .default(() => [])
    .register(registry, {
      reducer: {
        fn: (prev, next) =>
          Array.isArray(next) ? next : prev.concat(next),
        schema: z.union([UserGoal, z.array(UserGoal)]),
      },
    }),

  // User's timezone (default: Europe/Moscow)
  timezone: z
    .string()
    .default("Europe/Moscow")
    .register(registry, {
      reducer: {
        fn: (prev, next) => {
          // Guard against undefined/null
          if (next === undefined || next === null) {
            return prev;
          }
          return next;
        },
        schema: z.string(),
      },
    }),

  // Whether to send proactive messages
  notificationsEnabled: z.boolean().default(true).register(registry, {
    reducer: {
      fn: (prev, next) => {
        // Guard against undefined/null
        if (next === undefined || next === null) {
          return prev;
        }
        return next;
      },
      schema: z.boolean(),
    },
  }),

  // Whether onboarding is finished
  completed: z.boolean().default(false).register(registry, {
    reducer: {
      fn: (prev, next) => {
        // Guard against undefined/null
        if (next === undefined || next === null) {
          return prev;
        }
        return next;
      },
      schema: z.boolean(),
    },
  }),

  // Whether bonus credit was granted
  bonusCreditGranted: z.boolean().default(false).register(registry, {
    reducer: {
      fn: (prev, next) => {
        // Guard against undefined/null
        if (next === undefined || next === null) {
          return prev;
        }
        return next;
      },
      schema: z.boolean(),
    },
  }),
});

/**
 * TypeScript type inferred from Zod schema
 */
export type OnboardingState = z.infer<typeof OnboardingStateSchema>;

/**
 * LangGraph Annotation for StateGraph
 * Alternative to Zod schema for graph definition
 */
export const OnboardingStateAnnotation = Annotation.Root({
  step: Annotation<OnboardingStepType>({
    reducer: (prev, next) => {
      // Guard against undefined/null
      if (next === undefined || next === null) {
        return prev;
      }
      return next;
    },
    default: () => "welcome",
  }),
  telegramUserId: Annotation<number>({
    reducer: (prev, next) => {
      // Guard against undefined/null
      if (next === undefined || next === null) {
        return prev;
      }
      return next;
    },
  }),
  chatId: Annotation<number>({
    reducer: (prev, next) => {
      // Guard against undefined/null
      if (next === undefined || next === null) {
        return prev;
      }
      return next;
    },
  }),
  name: Annotation<string | null>({
    reducer: (prev, next) => {
      // Guard against undefined (null is valid for nullable field)
      if (next === undefined) {
        return prev;
      }
      return next;
    },
    default: () => null,
  }),
  goals: Annotation<UserGoalType[]>({
    reducer: (prev, next) => {
      // Guard against undefined/null
      if (next === undefined || next === null) {
        return prev;
      }
      return Array.isArray(next) ? next : prev.concat(next);
    },
    default: () => [],
  }),
  timezone: Annotation<string>({
    reducer: (prev, next) => {
      // Guard against undefined/null
      if (next === undefined || next === null) {
        return prev;
      }
      return next;
    },
    default: () => "Europe/Moscow",
  }),
  notificationsEnabled: Annotation<boolean>({
    reducer: (prev, next) => {
      // Guard against undefined/null
      if (next === undefined || next === null) {
        return prev;
      }
      return next;
    },
    default: () => true,
  }),
  completed: Annotation<boolean>({
    reducer: (prev, next) => {
      // Guard against undefined/null
      if (next === undefined || next === null) {
        return prev;
      }
      return next;
    },
    default: () => false,
  }),
  bonusCreditGranted: Annotation<boolean>({
    reducer: (prev, next) => {
      // Guard against undefined/null
      if (next === undefined || next === null) {
        return prev;
      }
      return next;
    },
    default: () => false,
  }),
});

/**
 * Type for StateGraph using Annotation
 */
export type OnboardingStateAnnotationType = typeof OnboardingStateAnnotation.State;
