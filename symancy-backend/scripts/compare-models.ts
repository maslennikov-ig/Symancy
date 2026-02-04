/**
 * A/B Model Comparison Test
 * Compares xiaomi/mimo-v2-flash vs stepfun/step-3.5-flash
 * Using real prompts and vision results
 */
import { config } from "dotenv";
import { readFile } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { ChatOpenAI } from "@langchain/openai";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env
const envPath = path.join(__dirname, "../.env");
config({ path: envPath });

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY!;
const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";

if (!OPENROUTER_API_KEY) {
  console.error("OPENROUTER_API_KEY is not set!");
  process.exit(1);
}

// Load prompts
const arinaSystemPrompt = await readFile(path.join(__dirname, "../prompts/arina/system.txt"), "utf-8");
const arinaInterpretationPrompt = await readFile(path.join(__dirname, "../prompts/arina/interpretation.txt"), "utf-8");

// Real vision result from production (simulated based on typical coffee cup analysis)
const REAL_VISION_RESULT = `
TECHNICAL: CLEAR, Complexity 7/10

PHYSICS:
Density: high
Flow: organic
Chaos: medium

ZONES:
[RIM] Тонкий ободок с мелкими точками, равномерное распределение
[CENTER] Плотный концентрированный осадок, тёмное ядро с чёткими краями, окружённое светлой пеной
[BOTTOM] Толстый слой осадка, основа чашки покрыта плотным слоем гущи

ANCHORS:
1. [CENTER] Плотный тёмный комок - концентрация энергии, точка фокуса
2. [10 O'CLOCK] Тонкий след, уходящий в светлое пространство - направление движения
3. [RIM] Мелкая рябь по краю - лёгкая активность на периферии

ATMOSPHERE: сосредоточенность, внутренняя глубина, потенциал для раскрытия
`.trim();

// Models to compare
const MODELS = [
  { id: "xiaomi/mimo-v2-flash", name: "Xiaomi MiMo v2 Flash" },
  { id: "stepfun/step-3.5-flash:free", name: "StepFun Step 3.5 Flash (Free)" },
];

// Lens for testing
const TEST_LENS = {
  name: "The Companion on Connection & Emotion",
  instruction: "Focus on themes of connection & emotion.\nVoice: Be warm and present. Walk beside, not above.\nMetaphor style: Use metaphors of water: rivers, flow, tides, depths, currents.",
};

interface ModelResult {
  modelId: string;
  modelName: string;
  text: string;
  tokensUsed: number;
  timeMs: number;
  charCount: number;
}

/**
 * Generate interpretation with a specific model
 */
async function generateWithModel(modelId: string, modelName: string): Promise<ModelResult> {
  const model = new ChatOpenAI({
    model: modelId,
    temperature: 0.9,
    maxTokens: 1500,
    modelKwargs: {
      frequency_penalty: 0.6,
      presence_penalty: 0.5,
    },
    configuration: {
      apiKey: OPENROUTER_API_KEY,
      baseURL: OPENROUTER_BASE_URL,
    },
  });

  const interpretationPrompt = arinaInterpretationPrompt
    .replace("{{VISION_RESULT}}", REAL_VISION_RESULT)
    .replace("{{USER_NAME}}", "Игорь")
    .replace(/\{\{LANGUAGE\}\}/g, "ru")
    .replace("{{USER_CONTEXT}}", "Интересует тема любви и отношений")
    .replace("{{LENS_NAME}}", TEST_LENS.name)
    .replace("{{LENS_INSTRUCTION}}", TEST_LENS.instruction)
    .replace("{{TOPIC_FOCUS}}", "Фокус на теме ЛЮБОВЬ: анализируй паттерны через призму романтических отношений, эмоциональных связей, партнёрства. Что говорят узоры о сердечных делах?");

  const messages = [
    new SystemMessage(arinaSystemPrompt),
    new HumanMessage(interpretationPrompt),
  ];

  const startTime = Date.now();
  const response = await model.invoke(messages);
  const timeMs = Date.now() - startTime;

  const text = typeof response.content === "string"
    ? response.content
    : response.content.filter(b => b.type === "text").map(b => "text" in b ? b.text : "").join("\n");

  return {
    modelId,
    modelName,
    text,
    tokensUsed: response.usage_metadata?.total_tokens ?? 0,
    timeMs,
    charCount: text.length,
  };
}

/**
 * Quality analysis
 */
function analyzeQuality(result: ModelResult): {
  hasPersonalization: boolean;
  hasStructure: boolean;
  hasEmojis: boolean;
  hasConcreteAdvice: boolean;
  hasPsychologicalDepth: boolean;
  issues: string[];
} {
  const text = result.text;
  const issues: string[] = [];

  // Check personalization (uses name)
  const hasPersonalization = /Игорь/i.test(text);
  if (!hasPersonalization) issues.push("Не использует имя пользователя");

  // Check structure (has bold sections)
  const hasStructure = /<b>.*<\/b>/i.test(text);
  if (!hasStructure) issues.push("Нет структурированных секций (<b>)");

  // Check emojis
  const hasEmojis = /[☕✨⚡🎯💡❤️💼💰🏥👨‍👩‍👧🌟]/u.test(text);
  if (!hasEmojis) issues.push("Нет эмодзи");

  // Check concrete advice (recommendations)
  const hasConcreteAdvice = /попробуй|предлагаю|совет|рекомендую|задай себе вопрос|на этой неделе/i.test(text);
  if (!hasConcreteAdvice) issues.push("Нет конкретных рекомендаций");

  // Check psychological depth
  const hasPsychologicalDepth = /внутренн|эмоци|чувств|состояни|психолог|энерги|ресурс|фокус|напряжени/i.test(text);
  if (!hasPsychologicalDepth) issues.push("Мало психологической глубины");

  // Check for forbidden patterns
  if (/гуща шепчет|вселенная|карма|космическ/i.test(text)) {
    issues.push("Использует запрещённую мистику");
  }
  if (/будет хорошо|верь в себя(?! )/i.test(text) && !/конкретно|попробуй/i.test(text)) {
    issues.push("Пустые обещания без конкретики");
  }

  return {
    hasPersonalization,
    hasStructure,
    hasEmojis,
    hasConcreteAdvice,
    hasPsychologicalDepth,
    issues,
  };
}

/**
 * Main comparison
 */
async function main() {
  console.log("\n" + "=".repeat(70));
  console.log("  A/B MODEL COMPARISON TEST");
  console.log("  Xiaomi MiMo v2 Flash vs StepFun Step 3.5 Flash");
  console.log("=".repeat(70));

  console.log("\n📋 Test Setup:");
  console.log("  - Topic: Love (любовь)");
  console.log("  - User: Игорь");
  console.log("  - Lens: The Companion on Connection & Emotion");
  console.log("  - Vision: Real production-like input");

  const results: ModelResult[] = [];

  for (const model of MODELS) {
    console.log(`\n${"─".repeat(70)}`);
    console.log(`🔄 Testing: ${model.name} (${model.id})`);
    console.log("─".repeat(70));

    try {
      const result = await generateWithModel(model.id, model.name);
      results.push(result);

      console.log(`\n⏱️  Time: ${result.timeMs}ms`);
      console.log(`📊 Tokens: ${result.tokensUsed}`);
      console.log(`📝 Length: ${result.charCount} chars`);
      console.log("\n" + "─".repeat(40));
      console.log("OUTPUT:");
      console.log("─".repeat(40));
      console.log(result.text);
      console.log("─".repeat(40));
    } catch (error) {
      console.error(`❌ Error with ${model.name}:`, error);
    }
  }

  // Quality Analysis
  console.log("\n" + "=".repeat(70));
  console.log("  QUALITY ANALYSIS");
  console.log("=".repeat(70));

  for (const result of results) {
    const analysis = analyzeQuality(result);
    console.log(`\n📊 ${result.modelName}:`);
    console.log(`  ✓ Персонализация (имя): ${analysis.hasPersonalization ? "✅" : "❌"}`);
    console.log(`  ✓ Структура (<b>): ${analysis.hasStructure ? "✅" : "❌"}`);
    console.log(`  ✓ Эмодзи: ${analysis.hasEmojis ? "✅" : "❌"}`);
    console.log(`  ✓ Конкретные советы: ${analysis.hasConcreteAdvice ? "✅" : "❌"}`);
    console.log(`  ✓ Психологическая глубина: ${analysis.hasPsychologicalDepth ? "✅" : "❌"}`);
    if (analysis.issues.length > 0) {
      console.log(`  ⚠️  Проблемы: ${analysis.issues.join(", ")}`);
    }
  }

  // Comparison Summary
  console.log("\n" + "=".repeat(70));
  console.log("  COMPARISON SUMMARY");
  console.log("=".repeat(70));

  if (results.length === 2) {
    const [xiaomi, stepfun] = results;

    console.log("\n┌────────────────────────┬──────────────────┬──────────────────┐");
    console.log("│ Metric                 │ Xiaomi MiMo      │ StepFun 3.5      │");
    console.log("├────────────────────────┼──────────────────┼──────────────────┤");
    console.log(`│ Response Time (ms)     │ ${String(xiaomi!.timeMs).padStart(16)} │ ${String(stepfun!.timeMs).padStart(16)} │`);
    console.log(`│ Tokens Used            │ ${String(xiaomi!.tokensUsed).padStart(16)} │ ${String(stepfun!.tokensUsed).padStart(16)} │`);
    console.log(`│ Char Count             │ ${String(xiaomi!.charCount).padStart(16)} │ ${String(stepfun!.charCount).padStart(16)} │`);
    console.log("└────────────────────────┴──────────────────┴──────────────────┘");

    const xiaomiAnalysis = analyzeQuality(xiaomi!);
    const stepfunAnalysis = analyzeQuality(stepfun!);

    const xiaomiScore = [
      xiaomiAnalysis.hasPersonalization,
      xiaomiAnalysis.hasStructure,
      xiaomiAnalysis.hasEmojis,
      xiaomiAnalysis.hasConcreteAdvice,
      xiaomiAnalysis.hasPsychologicalDepth,
    ].filter(Boolean).length;

    const stepfunScore = [
      stepfunAnalysis.hasPersonalization,
      stepfunAnalysis.hasStructure,
      stepfunAnalysis.hasEmojis,
      stepfunAnalysis.hasConcreteAdvice,
      stepfunAnalysis.hasPsychologicalDepth,
    ].filter(Boolean).length;

    console.log(`\n📈 Quality Score (из 5):`);
    console.log(`  - Xiaomi MiMo v2 Flash:   ${xiaomiScore}/5`);
    console.log(`  - StepFun Step 3.5 Flash: ${stepfunScore}/5`);

    if (xiaomiScore > stepfunScore) {
      console.log("\n🏆 WINNER: Xiaomi MiMo v2 Flash");
    } else if (stepfunScore > xiaomiScore) {
      console.log("\n🏆 WINNER: StepFun Step 3.5 Flash");
    } else {
      console.log("\n🤝 TIE: Both models scored equally");
    }
  }

  console.log("\n" + "=".repeat(70));
  console.log("  TEST COMPLETE");
  console.log("=".repeat(70) + "\n");
}

main().catch(console.error);
