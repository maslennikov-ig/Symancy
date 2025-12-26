# Onboarding StateGraph

LangGraph StateGraph for user onboarding flow in Symancy coffee fortune-telling bot.

## Flow

```
START → welcome → ask_name → ask_goals → [conditional] → complete → END
                                   ↓
                              ask_timezone → complete → END
```

### Conditional Routing

After `ask_goals` node:
- If user selected "spiritual" goal → route to `ask_timezone` (for meditation reminders)
- Otherwise → route directly to `complete`

## Usage

### Basic Usage (without checkpointer)

```typescript
import { onboardingGraph } from "./graphs/onboarding/index.js";

// Execute onboarding
const result = await onboardingGraph.invoke({
  telegramUserId: 123456,
  chatId: 123456,
  step: "welcome",
});

console.log(result);
// {
//   telegramUserId: 123456,
//   chatId: 123456,
//   step: "complete",
//   name: "John",
//   goals: ["career", "spiritual"],
//   timezone: "Europe/Moscow",
//   completed: true,
//   bonusCreditGranted: true,
//   ...
// }
```

### With PostgresSaver Checkpointer (stateful)

```typescript
import { PostgresSaver } from "@langchain/langgraph-checkpoint-postgres";
import { createOnboardingGraph } from "./graphs/onboarding/index.js";

// Setup checkpointer
const checkpointer = PostgresSaver.fromConnString(process.env.DATABASE_URL);
await checkpointer.setup();

// Create graph with checkpointer
const graph = await createOnboardingGraph(checkpointer);

// Invoke with thread_id for persistence
const result = await graph.invoke(
  {
    telegramUserId: 123456,
    chatId: 123456,
    step: "welcome",
  },
  {
    configurable: { thread_id: "user-123456" },
  }
);

// Resume from last state (after user provides name)
const resumed = await graph.invoke(
  {
    telegramUserId: 123456,
    chatId: 123456,
    name: "John", // User's input
  },
  {
    configurable: { thread_id: "user-123456" }, // Same thread_id
  }
);
```

### Streaming Execution

```typescript
import { onboardingGraph } from "./graphs/onboarding/index.js";

// Stream events during execution
const stream = await onboardingGraph.stream({
  telegramUserId: 123456,
  chatId: 123456,
  step: "welcome",
});

for await (const event of stream) {
  console.log("Node executed:", event);
}
```

## State Schema

See [state.ts](./state.ts) for full state schema.

**Key Fields:**
- `step`: Current onboarding step (`welcome` | `ask_name` | `ask_goals` | `ask_timezone` | `complete`)
- `telegramUserId`: User's Telegram ID (required)
- `chatId`: Chat ID for sending messages (required)
- `name`: User's name (collected in `ask_name`)
- `goals`: Selected goals array (collected in `ask_goals`)
- `timezone`: User's timezone (collected in `ask_timezone` or defaults to "Europe/Moscow")
- `completed`: Onboarding completion status
- `bonusCreditGranted`: Whether bonus credit was granted

## Nodes

All nodes are in `nodes/` directory:

1. **welcome** - Send welcome message, transition to `ask_name`
2. **askName** - Save user's name to database, send goals selection keyboard, transition to `ask_goals`
3. **askGoals** - Save goals to database, conditionally route to `ask_timezone` or `complete`
4. **askTimezone** - Save timezone to database, transition to `complete`
5. **complete** - Grant bonus credit, mark onboarding complete, send completion message

## Integration with Telegram Bot

```typescript
import { onboardingGraph } from "./graphs/onboarding/index.js";

// On /start command
bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  const telegramUserId = msg.from.id;

  // Check if already onboarded
  const { data: profile } = await supabase
    .from("profiles")
    .select("onboarding_completed")
    .eq("telegram_user_id", telegramUserId)
    .single();

  if (profile?.onboarding_completed) {
    await bot.sendMessage(chatId, "You are already onboarded!");
    return;
  }

  // Start onboarding
  await onboardingGraph.invoke({
    telegramUserId,
    chatId,
    step: "welcome",
  });
});

// On user message (name input)
bot.on("message", async (msg) => {
  const chatId = msg.chat.id;
  const telegramUserId = msg.from.id;

  // Get current step from database or state
  const currentStep = await getCurrentOnboardingStep(telegramUserId);

  if (currentStep === "ask_name") {
    // User provided name
    await onboardingGraph.invoke({
      telegramUserId,
      chatId,
      name: msg.text,
      step: "ask_name",
    });
  }
});

// On callback query (goals selection)
bot.on("callback_query", async (query) => {
  const chatId = query.message.chat.id;
  const telegramUserId = query.from.id;
  const data = query.data;

  if (data.startsWith("goal:")) {
    const goal = data.replace("goal:", "");
    // Add goal to state (accumulated via reducer)
    // ...
  } else if (data === "goals:confirm") {
    // User confirmed goals selection
    await onboardingGraph.invoke({
      telegramUserId,
      chatId,
      goals: selectedGoals, // from accumulated state
      step: "ask_goals",
    });
  }
});
```

## Testing

```typescript
import { onboardingGraph } from "./graphs/onboarding/index.js";

// Mock Telegram bot and database
jest.mock("../../core/telegram.js");
jest.mock("../../core/database.js");

describe("Onboarding Graph", () => {
  it("should complete onboarding without timezone step", async () => {
    const result = await onboardingGraph.invoke({
      telegramUserId: 123,
      chatId: 123,
      step: "welcome",
      name: "Test User",
      goals: ["career", "health"], // No "spiritual"
    });

    expect(result.completed).toBe(true);
    expect(result.step).toBe("complete");
  });

  it("should ask for timezone when spiritual goal selected", async () => {
    const result = await onboardingGraph.invoke({
      telegramUserId: 123,
      chatId: 123,
      step: "welcome",
      name: "Test User",
      goals: ["career", "spiritual"], // Has "spiritual"
    });

    // Should route through ask_timezone
    expect(result.step).toBe("complete");
    expect(result.timezone).toBeDefined();
  });
});
```

## Architecture

This StateGraph uses:
- **LangGraph** 1.0.7 for graph orchestration
- **StateAnnotation** for type-safe state management
- **Conditional edges** for dynamic routing based on user goals
- **PostgresSaver** (optional) for state persistence across sessions
- **Logger** for observability

## Related Files

- [state.ts](./state.ts) - State schema and types
- [nodes/welcome.ts](./nodes/welcome.ts) - Welcome node
- [nodes/ask-name.ts](./nodes/ask-name.ts) - Name collection node
- [nodes/ask-goals.ts](./nodes/ask-goals.ts) - Goals collection node
- [nodes/ask-timezone.ts](./nodes/ask-timezone.ts) - Timezone collection node
- [nodes/complete.ts](./nodes/complete.ts) - Completion node
