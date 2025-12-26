/**
 * Quality test script for AI pipeline
 * Tests vision analysis and interpretation chains on real coffee cup photos
 * Direct API calls to bypass module caching issues
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

// Create models directly with explicit API key in configuration
// Using same models as defined in constants.ts
const visionModel = new ChatOpenAI({
  model: "google/gemini-3-flash-preview", // MODEL_VISION
  temperature: 0.3,
  configuration: {
    apiKey: OPENROUTER_API_KEY,
    baseURL: OPENROUTER_BASE_URL,
  },
});

const interpretationModel = new ChatOpenAI({
  model: "xiaomi/mimo-v2-flash:free", // MODEL_ARINA
  temperature: 0.8,
  configuration: {
    apiKey: OPENROUTER_API_KEY,
    baseURL: OPENROUTER_BASE_URL,
  },
});

const PHOTOS_DIR = path.join(__dirname, "../../docs/tests/photos");

interface TestResult {
  photo: string;
  visionResult: {
    symbols: string[];
    colors: string[];
    patterns: string[];
    rawDescription: string;
  };
  arinaInterpretation: {
    text: string;
    tokensUsed: number;
    success: boolean;
  };
}

/**
 * Convert image to base64 WebP format
 */
async function imageToBase64(filePath: string): Promise<string> {
  const imageBuffer = await readFile(filePath);

  // Convert to WebP and resize for optimal processing
  const webpBuffer = await sharp(imageBuffer)
    .resize(800, 800, { fit: "inside", withoutEnlargement: true })
    .webp({ quality: 85 })
    .toBuffer();

  return webpBuffer.toString("base64");
}

/**
 * Parse vision model response into structured result
 */
function parseVisionResponse(rawText: string) {
  const symbols: string[] = [];
  const colors: string[] = [];
  const patterns: string[] = [];

  // Extract primary pattern
  const primaryMatch = rawText.match(/PRIMARY PATTERN:\s*(.+?)(?:\n|$)/i);
  if (primaryMatch && primaryMatch[1]) {
    patterns.push(primaryMatch[1].trim());
  }

  // Extract secondary patterns
  const secondarySection = rawText.match(
    /SECONDARY PATTERNS:\s*([\s\S]+?)(?=OVERALL COMPOSITION:|SYMBOLIC ELEMENTS:|$)/i
  );
  if (secondarySection && secondarySection[1]) {
    const secondaryPatterns = secondarySection[1].match(/^\d+\.\s*(.+?)$/gm);
    if (secondaryPatterns) {
      secondaryPatterns.forEach((pattern) => {
        const cleaned = pattern.replace(/^\d+\.\s*/, "").trim();
        if (cleaned) patterns.push(cleaned);
      });
    }
  }

  // Extract symbolic elements
  const symbolicMatch = rawText.match(/SYMBOLIC ELEMENTS:\s*(.+?)$/im);
  if (symbolicMatch && symbolicMatch[1]) {
    const extractedSymbols = symbolicMatch[1].split(/[,;]/).map(s => s.trim()).filter(s => s.length > 0);
    symbols.push(...extractedSymbols);
  }

  // Extract colors
  const colorKeywords = ["dark", "light", "black", "white", "brown", "gray", "grey", "golden", "silver", "beige", "tan"];
  const lowerText = rawText.toLowerCase();
  colorKeywords.forEach(color => {
    if (lowerText.includes(color) && !colors.includes(color)) colors.push(color);
  });

  // Extract additional symbols from keywords
  const symbolKeywords = ["bird", "fish", "dog", "cat", "horse", "dragon", "butterfly", "spider", "face", "hand", "eye", "heart", "ship", "key", "tree", "flower", "mountain", "cloud", "star", "sun", "moon", "circle", "triangle", "cross", "house", "tower", "bridge", "path", "road"];
  symbolKeywords.forEach(keyword => {
    if (lowerText.includes(keyword) && !symbols.includes(keyword)) symbols.push(keyword);
  });

  return {
    symbols: symbols.length > 0 ? symbols : ["abstract forms"],
    colors: colors.length > 0 ? colors : ["dark", "light"],
    patterns: patterns.length > 0 ? patterns : ["complex composition"],
    rawDescription: rawText.trim(),
  };
}

/**
 * Test single photo through the pipeline
 */
async function testPhoto(photoPath: string): Promise<TestResult> {
  const photoName = path.basename(photoPath);
  console.log(`\n${"=".repeat(60)}`);
  console.log(`Testing: ${photoName}`);
  console.log("=".repeat(60));

  // Step 1: Convert to base64
  console.log("\n[1/3] Converting image to base64...");
  const imageBase64 = await imageToBase64(photoPath);
  console.log(`    Image size: ${(imageBase64.length / 1024).toFixed(1)} KB`);

  // Step 2: Vision analysis with direct model call
  console.log("\n[2/3] Running vision analysis...");
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

  const visionResult = parseVisionResponse(rawVisionText);
  const visionTime = Date.now() - startVision;

  console.log(`    Time: ${visionTime}ms`);
  console.log(`    Symbols found: ${visionResult.symbols.join(", ")}`);
  console.log(`    Colors: ${visionResult.colors.join(", ")}`);
  console.log(`    Patterns: ${visionResult.patterns.length}`);
  console.log("\n--- Raw Vision Output ---");
  console.log(visionResult.rawDescription);
  console.log("--- End Vision Output ---\n");

  // Step 3: Arina interpretation with direct model call
  console.log("[3/3] Running Arina interpretation...");
  const startArina = Date.now();

  // Build VISION_RESULT as structured text
  const visionResultText = `
SYMBOLS FOUND: ${visionResult.symbols.join(", ")}
COLORS: ${visionResult.colors.join(", ")}
PATTERNS:
${visionResult.patterns.map((p, i) => `${i + 1}. ${p}`).join("\n")}

RAW DESCRIPTION:
${visionResult.rawDescription}
`.trim();

  // Use correct variable names from the prompt template
  const interpretationPrompt = arinaInterpretationPrompt
    .replace("{{VISION_RESULT}}", visionResultText)
    .replace("{{USER_NAME}}", "дорогой друг")
    .replace("{{LANGUAGE}}", "ru");

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
  console.log("\n--- Arina Interpretation ---");
  console.log(arinaText);
  console.log("--- End Arina ---\n");

  return {
    photo: photoName,
    visionResult,
    arinaInterpretation: {
      text: arinaText,
      tokensUsed: tokensUsed,
      success: true,
    },
  };
}

/**
 * Main test runner
 */
async function main() {
  console.log("\n" + "=".repeat(60));
  console.log("  COFFEE FORTUNE AI QUALITY TEST");
  console.log("=".repeat(60));
  console.log(`\nPhotos directory: ${PHOTOS_DIR}`);

  // Get all jpg files
  const files = await readdir(PHOTOS_DIR);
  const photos = files.filter(f => f.endsWith(".jpg") || f.endsWith(".png"));

  console.log(`Found ${photos.length} test photos\n`);

  if (photos.length === 0) {
    console.error("No test photos found!");
    process.exit(1);
  }

  // Test first 2 photos for quick check
  const testPhotos = photos.slice(0, 2);
  console.log(`Testing ${testPhotos.length} photos: ${testPhotos.join(", ")}`);

  const results: TestResult[] = [];

  for (const photo of testPhotos) {
    try {
      const result = await testPhoto(path.join(PHOTOS_DIR, photo));
      results.push(result);
    } catch (error) {
      console.error(`\nERROR testing ${photo}:`, error);
    }
  }

  // Summary
  console.log("\n" + "=".repeat(60));
  console.log("  SUMMARY");
  console.log("=".repeat(60));

  for (const result of results) {
    console.log(`\n${result.photo}:`);
    console.log(`  Symbols: ${result.visionResult.symbols.length}`);
    console.log(`  Patterns: ${result.visionResult.patterns.length}`);
    console.log(`  Arina tokens: ${result.arinaInterpretation.tokensUsed}`);
    console.log(`  Arina success: ${result.arinaInterpretation.success}`);
    console.log(`  Interpretation length: ${result.arinaInterpretation.text.length} chars`);
  }

  console.log("\n" + "=".repeat(60));
  console.log("  TEST COMPLETE");
  console.log("=".repeat(60) + "\n");
}

main().catch(console.error);
