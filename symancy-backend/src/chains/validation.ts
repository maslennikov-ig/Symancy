/**
 * Prompt Validation Utility
 * Validates that all required prompt files exist and are not empty
 * Run at application startup to fail fast if prompts are missing
 */
import { readFile, access } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { getLogger } from "../core/logger.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const logger = getLogger().child({ module: "prompt-validation" });

/**
 * All required prompt files for the application
 * Paths are relative to project root (symancy-backend/)
 */
const REQUIRED_PROMPTS = [
  "prompts/vision/analyze.txt",
  "prompts/arina/system.txt",
  "prompts/arina/interpretation.txt",
  "prompts/arina/chat.txt",
  "prompts/cassandra/system.txt",
  "prompts/cassandra/interpretation.txt",
];

/**
 * Validate that all required prompt files exist and are not empty
 * Throws an error if any prompts are missing or empty
 * Should be called at application startup before accepting requests
 *
 * @throws {Error} If any prompt files are missing or empty
 *
 * @example
 * ```typescript
 * // In app.ts startup
 * await validatePromptsExist();
 * ```
 */
export async function validatePromptsExist(): Promise<void> {
  const errors: string[] = [];

  for (const promptPath of REQUIRED_PROMPTS) {
    // Resolve path relative to project root
    const fullPath = path.join(__dirname, "..", "..", promptPath);

    try {
      await access(fullPath);
      const content = await readFile(fullPath, "utf-8");

      if (content.trim().length === 0) {
        errors.push(`Prompt file is empty: ${promptPath}`);
      }
    } catch {
      errors.push(`Prompt file not found: ${promptPath}`);
    }
  }

  if (errors.length > 0) {
    const errorMessage = `Prompt validation failed:\n${errors.join("\n")}`;
    logger.error(errorMessage);
    throw new Error(errorMessage);
  }

  logger.info({ count: REQUIRED_PROMPTS.length }, "All prompt files validated");
}
