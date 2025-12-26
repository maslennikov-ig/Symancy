/**
 * Unit tests for interpretation chain
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { generateInterpretation } from "../../../src/chains/interpretation.chain.js";
import type { VisionAnalysisResult } from "../../../src/types/langchain.js";

// Mock the models module
vi.mock("../../../src/core/langchain/models.js", () => ({
  createArinaModel: vi.fn(() => ({
    invoke: vi.fn().mockResolvedValue({
      content: "<b>Test interpretation</b> in HTML format",
      usage_metadata: {
        total_tokens: 150,
      },
    }),
  })),
}));

describe("interpretation.chain", () => {
  const mockVisionResult: VisionAnalysisResult = {
    symbols: ["tree", "bird"],
    colors: ["brown", "white"],
    patterns: ["spiral", "wave"],
    rawDescription: "A coffee cup with interesting patterns",
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should generate interpretation with default language and userName", async () => {
    const result = await generateInterpretation({
      visionResult: mockVisionResult,
      persona: "arina",
    });

    expect(result).toBeDefined();
    expect(result.text).toBe("<b>Test interpretation</b> in HTML format");
    expect(result.persona).toBe("arina");
    expect(result.tokensUsed).toBe(150);
  });

  it("should generate interpretation with custom language and userName", async () => {
    const result = await generateInterpretation({
      visionResult: mockVisionResult,
      persona: "arina",
      language: "en",
      userName: "John",
    });

    expect(result).toBeDefined();
    expect(result.text).toBe("<b>Test interpretation</b> in HTML format");
    expect(result.persona).toBe("arina");
  });

  it("should throw error for unsupported persona", async () => {
    await expect(
      generateInterpretation({
        visionResult: mockVisionResult,
        // @ts-expect-error - Testing invalid persona
        persona: "cassandra",
      })
    ).rejects.toThrow('Persona "cassandra" is not yet supported');
  });

  it("should handle token usage fallback", async () => {
    const { createArinaModel } = await import(
      "../../../src/core/langchain/models.js"
    );

    vi.mocked(createArinaModel).mockReturnValue({
      invoke: vi.fn().mockResolvedValue({
        content: "Test without tokens",
        usage_metadata: undefined,
      }),
    } as any);

    const result = await generateInterpretation({
      visionResult: mockVisionResult,
      persona: "arina",
    });

    expect(result.tokensUsed).toBe(0);
  });
});
