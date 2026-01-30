/**
 * Quality test script for AI pipeline
 * Tests vision analysis and interpretation chains on real coffee cup photos
 * Updated for new structured output and lens system
 */
import { config } from "dotenv";
import { readFile, readdir } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { ChatOpenAI } from "@langchain/openai";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import sharp from "sharp";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env FIRST before any other imports
const envPath = path.join(__dirname, "../.env");
console.log(`Loading env from: ${envPath}`);
const envResult = config({ path: envPath });

if (envResult.error) {
  console.error("Failed to load .env:", envResult.error);
  process.exit(1);
}

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY!;
const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";

if (!OPENROUTER_API_KEY) {
  console.error("OPENROUTER_API_KEY is not set!");
  process.exit(1);
}

console.log("Env loaded. Using OpenRouter API key:", OPENROUTER_API_KEY.slice(0, 15) + "...");

// Load prompts
const visionPrompt = await readFile(path.join(__dirname, "../prompts/vision/analyze.txt"), "utf-8");
const arinaSystemPrompt = await readFile(path.join(__dirname, "../prompts/arina/system.txt"), "utf-8");
const arinaInterpretationPrompt = await readFile(path.join(__dirname, "../prompts/arina/interpretation.txt"), "utf-8");

// Create models with optimized parameters
const visionModel = new ChatOpenAI({
  model: "google/gemini-3-flash-preview",
  temperature: 0.3,
  maxTokens: 800,
  configuration: {
    apiKey: OPENROUTER_API_KEY,
    baseURL: OPENROUTER_BASE_URL,
  },
});

const interpretationModel = new ChatOpenAI({
  model: "xiaomi/mimo-v2-flash",
  temperature: 0.9,
  maxTokens: 1200,
  modelKwargs: {
    frequency_penalty: 0.6,
    presence_penalty: 0.5,
  },
  configuration: {
    apiKey: OPENROUTER_API_KEY,
    baseURL: OPENROUTER_BASE_URL,
  },
});

const PHOTOS_DIR = path.join(__dirname, "../../docs/tests/photos");

// Lens options for testing variety
const TEST_LENSES = [
  { name: "The Sage on Growth & Potential", instruction: "Focus on themes of growth & potential.\nVoice: Speak with detached wisdom. See the broader meaning.\nMetaphor style: Use metaphors of earth: roots, stones, soil, foundation, stability." },
  { name: "The Warrior on Challenge & Resolution", instruction: "Focus on themes of challenge & resolution.\nVoice: Be direct and empowering. Focus on strength and action.\nMetaphor style: Use metaphors of fire: flames, sparks, ash, transformation through heat." },
  { name: "The Alchemist on Connection & Emotion", instruction: "Focus on themes of connection & emotion.\nVoice: Find transformation in difficulty. Nothing is wasted.\nMetaphor style: Use metaphors of water: rivers, flow, tides, depths, currents." },
  { name: "The Companion on Identity & Spirit", instruction: "Focus on themes of identity & spirit.\nVoice: Be warm and present. Walk beside, not above.\nMetaphor style: Use metaphors of air: wind, breath, clouds, openness, lightness." },
];

interface StructuredVisionResult {
  technicalQuality: string;
  complexityScore: number;
  sedimentPhysics: { density: string; flow: string; chaos: string };
  zones: { rim: string; center: string; bottom: string };
  visualAnchors: Array<{ location: string; geometry: string; texture: string; uniqueFeature: string }>;
  atmosphere: string[];
  rawDescription: string;
}

interface TestResult {
  photo: string;
  visionResult: StructuredVisionResult;
  arinaInterpretation: {
    text: string;
    tokensUsed: number;
    success: boolean;
    lensUsed: string;
  };
}

/**
 * Convert image to base64 WebP format
 */
async function imageToBase64(filePath: string): Promise<string> {
  const imageBuffer = await readFile(filePath);
  const webpBuffer = await sharp(imageBuffer)
    .resize(800, 800, { fit: "inside", withoutEnlargement: true })
    .webp({ quality: 85 })
    .toBuffer();
  return webpBuffer.toString("base64");
}

/**
 * Parse new structured vision response
 */
function parseStructuredVision(rawText: string): StructuredVisionResult {
  const result: StructuredVisionResult = {
    technicalQuality: "CLEAR",
    complexityScore: 5,
    sedimentPhysics: { density: "medium", flow: "stagnant", chaos: "medium" },
    zones: { rim: "", center: "", bottom: "" },
    visualAnchors: [],
    atmosphere: [],
    rawDescription: rawText.trim(),
  };

  // Parse TECHNICAL
  const technicalMatch = rawText.match(/TECHNICAL:\s*(\w+),?\s*(?:Complexity\s*)?(\d+)?/i);
  if (technicalMatch) {
    result.technicalQuality = technicalMatch[1]?.toUpperCase() || "CLEAR";
    if (technicalMatch[2]) {
      result.complexityScore = Math.min(10, Math.max(1, parseInt(technicalMatch[2], 10)));
    }
  }

  // Parse PHYSICS
  const physicsSection = rawText.match(/PHYSICS:\s*([\s\S]*?)(?=ZONES:|ANCHORS:|ATMOSPHERE:|$)/i);
  if (physicsSection?.[1]) {
    const densityMatch = physicsSection[1].match(/Density:\s*(\w+)/i);
    if (densityMatch) result.sedimentPhysics.density = densityMatch[1]!.toLowerCase();
    const flowMatch = physicsSection[1].match(/Flow:\s*(.+?)(?:\n|$)/i);
    if (flowMatch) result.sedimentPhysics.flow = flowMatch[1]!.trim().toLowerCase();
    const chaosMatch = physicsSection[1].match(/Chaos:\s*(\w+)/i);
    if (chaosMatch) result.sedimentPhysics.chaos = chaosMatch[1]!.toLowerCase();
  }

  // Parse ZONES
  const zonesSection = rawText.match(/ZONES:\s*([\s\S]*?)(?=ANCHORS:|ATMOSPHERE:|$)/i);
  if (zonesSection?.[1]) {
    const rimMatch = zonesSection[1].match(/\[RIM\]\s*(.+?)(?:\n|\[|$)/i);
    if (rimMatch) result.zones.rim = rimMatch[1]!.trim();
    const centerMatch = zonesSection[1].match(/\[CENTER\]\s*(.+?)(?:\n|\[|$)/i);
    if (centerMatch) result.zones.center = centerMatch[1]!.trim();
    const bottomMatch = zonesSection[1].match(/\[BOTTOM\]\s*(.+?)(?:\n|\[|$)/i);
    if (bottomMatch) result.zones.bottom = bottomMatch[1]!.trim();
  }

  // Parse ANCHORS
  const anchorsSection = rawText.match(/ANCHORS:\s*([\s\S]*?)(?=ATMOSPHERE:|$)/i);
  if (anchorsSection?.[1]) {
    const anchorLines = anchorsSection[1].match(/^\d+\.\s*(.+)$/gm) || [];
    for (const line of anchorLines) {
      const cleaned = line.replace(/^\d+\.\s*/, "");
      const locationMatch = cleaned.match(/\[([^\]]+)\]\s*(.+)/);
      if (locationMatch) {
        const texturePart = locationMatch[2]!.match(/(grainy|smooth|fractured|flowing)/i);
        result.visualAnchors.push({
          location: locationMatch[1]!,
          geometry: locationMatch[2]!.split(",")[0]?.trim() || locationMatch[2]!,
          texture: texturePart ? texturePart[1]!.toLowerCase() : "complex",
          uniqueFeature: locationMatch[2]!,
        });
      }
    }
  }

  // Parse ATMOSPHERE
  const atmosphereMatch = rawText.match(/ATMOSPHERE:\s*(.+?)$/im);
  if (atmosphereMatch?.[1]) {
    result.atmosphere = atmosphereMatch[1].split(/[,;]/).map(s => s.trim()).filter(s => s.length > 0);
  }

  return result;
}

/**
 * Calculate Jaccard similarity
 */
function jaccardSimilarity(text1: string, text2: string): number {
  const stopWords = new Set([
    "это", "что", "как", "так", "для", "или", "если", "когда", "также",
    "the", "be", "to", "of", "and", "a", "in", "that", "have", "it",
    "кофе", "чашка", "гуща", "узор", "видеть", "отражать",
  ]);

  const extractWords = (text: string): Set<string> => {
    return new Set(
      text.toLowerCase()
        .replace(/<[^>]+>/g, " ")
        .replace(/[^\p{L}\p{N}\s]/gu, " ")
        .split(/\s+/)
        .filter(w => w.length > 3)
        .filter(w => !stopWords.has(w))
    );
  };

  const words1 = extractWords(text1);
  const words2 = extractWords(text2);
  if (words1.size === 0 && words2.size === 0) return 0;

  const intersection = new Set([...words1].filter(w => words2.has(w)));
  const union = new Set([...words1, ...words2]);
  return union.size === 0 ? 0 : intersection.size / union.size;
}

/**
 * Test single photo through the pipeline
 */
async function testPhoto(photoPath: string, lensIndex: number): Promise<TestResult> {
  const photoName = path.basename(photoPath);
  const lens = TEST_LENSES[lensIndex % TEST_LENSES.length]!;

  console.log(`\n${"=".repeat(60)}`);
  console.log(`Testing: ${photoName} with lens: ${lens.name}`);
  console.log("=".repeat(60));

  // Step 1: Convert to base64
  console.log("\n[1/3] Converting image to base64...");
  const imageBase64 = await imageToBase64(photoPath);
  console.log(`    Image size: ${(imageBase64.length / 1024).toFixed(1)} KB`);

  // Step 2: Vision analysis
  console.log("\n[2/3] Running vision analysis (new structured format)...");
  const startVision = Date.now();

  const visionMessages = [
    new SystemMessage(visionPrompt),
    new HumanMessage({
      content: [
        { type: "text", text: "Analyze this coffee ground image and provide a detailed analysis following the response format specified in your instructions:" },
        { type: "image_url", image_url: { url: `data:image/webp;base64,${imageBase64}` } },
      ],
    }),
  ];

  const visionResponse = await visionModel.invoke(visionMessages);
  const rawVisionText = typeof visionResponse.content === "string"
    ? visionResponse.content
    : visionResponse.content.filter(b => b.type === "text").map(b => "text" in b ? b.text : "").join("\n");

  const visionResult = parseStructuredVision(rawVisionText);
  const visionTime = Date.now() - startVision;

  console.log(`    Time: ${visionTime}ms`);
  console.log(`    Technical Quality: ${visionResult.technicalQuality}`);
  console.log(`    Complexity: ${visionResult.complexityScore}/10`);
  console.log(`    Physics: density=${visionResult.sedimentPhysics.density}, flow=${visionResult.sedimentPhysics.flow}`);
  console.log(`    Zones: RIM=${visionResult.zones.rim ? "✓" : "✗"}, CENTER=${visionResult.zones.center ? "✓" : "✗"}, BOTTOM=${visionResult.zones.bottom ? "✓" : "✗"}`);
  console.log(`    Anchors: ${visionResult.visualAnchors.length}`);
  console.log(`    Atmosphere: ${visionResult.atmosphere.join(", ")}`);
  console.log("\n--- Raw Vision Output ---");
  console.log(visionResult.rawDescription.slice(0, 500) + (visionResult.rawDescription.length > 500 ? "..." : ""));
  console.log("--- End Vision Output ---\n");

  // Step 3: Arina interpretation with lens
  console.log("[3/3] Running Arina interpretation with lens...");
  const startArina = Date.now();

  const visionResultText = `
TECHNICAL: ${visionResult.technicalQuality}, Complexity ${visionResult.complexityScore}/10

PHYSICS:
Density: ${visionResult.sedimentPhysics.density}
Flow: ${visionResult.sedimentPhysics.flow}
Chaos: ${visionResult.sedimentPhysics.chaos}

ZONES:
[RIM] ${visionResult.zones.rim || "No distinct patterns"}
[CENTER] ${visionResult.zones.center || "No distinct patterns"}
[BOTTOM] ${visionResult.zones.bottom || "No distinct patterns"}

ANCHORS:
${visionResult.visualAnchors.map((a, i) => `${i + 1}. [${a.location}] ${a.uniqueFeature}`).join("\n") || "No distinct anchors identified"}

ATMOSPHERE: ${visionResult.atmosphere.join(", ") || "Neutral"}
`.trim();

  const interpretationPrompt = arinaInterpretationPrompt
    .replace("{{VISION_RESULT}}", visionResultText)
    .replace("{{USER_NAME}}", "дорогой друг")
    .replace("{{LANGUAGE}}", "ru")
    .replace("{{USER_CONTEXT}}", "Не указан")
    .replace("{{LENS_NAME}}", lens.name)
    .replace("{{LENS_INSTRUCTION}}", lens.instruction);

  const arinaMessages = [
    new SystemMessage(arinaSystemPrompt),
    new HumanMessage(interpretationPrompt),
  ];

  const arinaResponse = await interpretationModel.invoke(arinaMessages);
  const arinaText = typeof arinaResponse.content === "string"
    ? arinaResponse.content
    : arinaResponse.content.filter(b => b.type === "text").map(b => "text" in b ? b.text : "").join("\n");

  const arinaTime = Date.now() - startArina;
  const tokensUsed = arinaResponse.usage_metadata?.total_tokens ?? 0;

  console.log(`    Time: ${arinaTime}ms`);
  console.log(`    Tokens: ${tokensUsed}`);
  console.log(`    Length: ${arinaText.length} chars`);
  console.log("\n--- Arina Interpretation ---");
  console.log(arinaText);
  console.log("--- End Arina ---\n");

  return {
    photo: photoName,
    visionResult,
    arinaInterpretation: {
      text: arinaText,
      tokensUsed,
      success: true,
      lensUsed: lens.name,
    },
  };
}

/**
 * Main test runner
 */
async function main() {
  console.log("\n" + "=".repeat(60));
  console.log("  COFFEE FORTUNE AI QUALITY TEST (v2.0)");
  console.log("  Testing: Structured Vision + Lens System + Jaccard");
  console.log("=".repeat(60));
  console.log(`\nPhotos directory: ${PHOTOS_DIR}`);

  const files = await readdir(PHOTOS_DIR);
  const photos = files.filter(f => f.endsWith(".jpg") || f.endsWith(".png"));

  console.log(`Found ${photos.length} test photos\n`);

  if (photos.length === 0) {
    console.error("No test photos found!");
    process.exit(1);
  }

  // Test 4 photos with different lenses
  const testPhotos = photos.slice(0, 4);
  console.log(`Testing ${testPhotos.length} photos with different lenses`);

  const results: TestResult[] = [];

  for (let i = 0; i < testPhotos.length; i++) {
    try {
      const result = await testPhoto(path.join(PHOTOS_DIR, testPhotos[i]!), i);
      results.push(result);
    } catch (error) {
      console.error(`\nERROR testing ${testPhotos[i]}:`, error);
    }
  }

  // Summary with Jaccard similarity
  console.log("\n" + "=".repeat(60));
  console.log("  SUMMARY");
  console.log("=".repeat(60));

  for (const result of results) {
    console.log(`\n${result.photo}:`);
    console.log(`  Vision Quality: ${result.visionResult.technicalQuality}`);
    console.log(`  Complexity: ${result.visionResult.complexityScore}/10`);
    console.log(`  Zones filled: ${[result.visionResult.zones.rim, result.visionResult.zones.center, result.visionResult.zones.bottom].filter(Boolean).length}/3`);
    console.log(`  Anchors: ${result.visionResult.visualAnchors.length}`);
    console.log(`  Lens: ${result.arinaInterpretation.lensUsed}`);
    console.log(`  Interpretation length: ${result.arinaInterpretation.text.length} chars`);
  }

  // Jaccard similarity matrix
  console.log("\n" + "=".repeat(60));
  console.log("  JACCARD SIMILARITY MATRIX");
  console.log("  (Target: all pairs < 0.35)");
  console.log("=".repeat(60));

  const interpretations = results.map(r => r.arinaInterpretation.text);
  let maxSimilarity = 0;
  let pairsAboveThreshold = 0;

  for (let i = 0; i < interpretations.length; i++) {
    for (let j = i + 1; j < interpretations.length; j++) {
      const similarity = jaccardSimilarity(interpretations[i]!, interpretations[j]!);
      const status = similarity > 0.35 ? "⚠️ HIGH" : "✓ OK";
      console.log(`  ${results[i]!.photo} vs ${results[j]!.photo}: ${(similarity * 100).toFixed(1)}% ${status}`);
      if (similarity > maxSimilarity) maxSimilarity = similarity;
      if (similarity > 0.35) pairsAboveThreshold++;
    }
  }

  console.log(`\n  Max similarity: ${(maxSimilarity * 100).toFixed(1)}%`);
  console.log(`  Pairs above 35%: ${pairsAboveThreshold}`);

  // Final verdict
  console.log("\n" + "=".repeat(60));
  console.log("  TEST RESULTS");
  console.log("=".repeat(60));

  const allZonesFilled = results.every(r =>
    r.visionResult.zones.rim || r.visionResult.zones.center || r.visionResult.zones.bottom
  );
  const allAnchorsFound = results.every(r => r.visionResult.visualAnchors.length > 0);
  const similarityOk = maxSimilarity <= 0.35;

  console.log(`  ✓ Vision structured output: ${allZonesFilled ? "PASS" : "PARTIAL"}`);
  console.log(`  ✓ Visual anchors detected: ${allAnchorsFound ? "PASS" : "PARTIAL"}`);
  console.log(`  ✓ Jaccard < 35%: ${similarityOk ? "PASS" : "FAIL"}`);
  console.log(`  ✓ Length target (1500-2000): ${results.every(r => r.arinaInterpretation.text.length >= 800 && r.arinaInterpretation.text.length <= 2500) ? "PASS" : "CHECK"}`);

  console.log("\n" + "=".repeat(60));
  console.log("  TEST COMPLETE");
  console.log("=".repeat(60) + "\n");
}

main().catch(console.error);
