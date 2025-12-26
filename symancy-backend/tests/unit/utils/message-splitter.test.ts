/**
 * Unit tests for message splitter utility
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { splitMessage } from "../../../src/utils/message-splitter.js";
import { TELEGRAM_SAFE_LIMIT } from "../../../src/config/constants.js";

// Mock the logger module
vi.mock("../../../src/core/logger.js", () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  },
}));

describe("splitMessage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Short messages (no split needed)", () => {
    it("should return single chunk for short messages", () => {
      const text = "This is a short message";

      const result = splitMessage(text);

      expect(result).toEqual([text]);
      expect(result).toHaveLength(1);
    });

    it("should return single chunk for empty string", () => {
      const text = "";

      const result = splitMessage(text);

      expect(result).toEqual([""]);
      expect(result).toHaveLength(1);
    });

    it("should return single chunk for string exactly at limit", () => {
      const text = "x".repeat(TELEGRAM_SAFE_LIMIT);

      const result = splitMessage(text);

      expect(result).toEqual([text]);
      expect(result).toHaveLength(1);
      expect(result[0]!.length).toBe(TELEGRAM_SAFE_LIMIT);
    });

    it("should handle custom maxLength parameter", () => {
      const text = "x".repeat(100);

      const result = splitMessage(text, 100);

      expect(result).toEqual([text]);
      expect(result).toHaveLength(1);
    });
  });

  describe("Split at paragraph boundaries (\\n\\n)", () => {
    it("should split at paragraph boundaries", () => {
      const paragraph1 = "x".repeat(2500);
      const paragraph2 = "y".repeat(2500);
      const text = `${paragraph1}\n\n${paragraph2}`;

      const result = splitMessage(text);

      expect(result).toHaveLength(2);
      expect(result[0]).toBe(paragraph1);
      expect(result[1]).toBe(paragraph2);
    });

    it("should preserve multiple paragraphs in single chunk when possible", () => {
      const paragraph1 = "Short paragraph 1";
      const paragraph2 = "Short paragraph 2";
      const paragraph3 = "Short paragraph 3";
      const text = `${paragraph1}\n\n${paragraph2}\n\n${paragraph3}`;

      const result = splitMessage(text);

      expect(result).toHaveLength(1);
      expect(result[0]).toBe(text);
    });

    it("should split multiple long paragraphs into multiple chunks", () => {
      const paragraph1 = "a".repeat(3000);
      const paragraph2 = "b".repeat(3000);
      const paragraph3 = "c".repeat(3000);
      const text = `${paragraph1}\n\n${paragraph2}\n\n${paragraph3}`;

      const result = splitMessage(text);

      expect(result.length).toBeGreaterThan(1);
      expect(result.join("")).toContain("a".repeat(100)); // Contains paragraph1
      expect(result.join("")).toContain("b".repeat(100)); // Contains paragraph2
      expect(result.join("")).toContain("c".repeat(100)); // Contains paragraph3
    });

    it("should not split at paragraph if split point is too early (<50% of max)", () => {
      // Create text where paragraph boundary is at position 500 (12.5% of 4000)
      const paragraph1 = "x".repeat(500);
      const longText = "y".repeat(4500);
      const text = `${paragraph1}\n\n${longText}`;

      const result = splitMessage(text);

      // Should fall back to other split strategies since paragraph is <50%
      expect(result).toHaveLength(2);
    });
  });

  describe("Split at line breaks (\\n)", () => {
    it("should split at line breaks when no paragraph boundary", () => {
      const line1 = "x".repeat(2500);
      const line2 = "y".repeat(2500);
      const text = `${line1}\n${line2}`;

      const result = splitMessage(text);

      expect(result).toHaveLength(2);
      expect(result[0]).toBe(line1);
      expect(result[1]).toBe(line2);
    });

    it("should split at line break over sentence boundary", () => {
      const line1 = "x".repeat(2500);
      const line2 = "y".repeat(2500) + ". Some more text";
      const text = `${line1}\n${line2}`;

      const result = splitMessage(text);

      expect(result).toHaveLength(2);
      expect(result[0]).toBe(line1);
      expect(result[1]).toBe(line2);
    });

    it("should not split at line break if too early (<50% of max)", () => {
      const line1 = "x".repeat(500);
      const longLine = "y".repeat(4500);
      const text = `${line1}\n${longLine}`;

      const result = splitMessage(text);

      // Should fall back to other strategies
      expect(result).toHaveLength(2);
    });
  });

  describe("Split at sentence end (. ! ?)", () => {
    it("should split at sentence end (period)", () => {
      const sentence1 = "x".repeat(2500);
      const sentence2 = "y".repeat(2500);
      const text = `${sentence1}. ${sentence2}`;

      const result = splitMessage(text);

      expect(result).toHaveLength(2);
      expect(result[0]).toBe(sentence1 + ".");
      expect(result[1]).toBe(sentence2);
    });

    it("should split at sentence end (exclamation mark)", () => {
      const sentence1 = "x".repeat(2500);
      const sentence2 = "y".repeat(2500);
      const text = `${sentence1}! ${sentence2}`;

      const result = splitMessage(text);

      expect(result).toHaveLength(2);
      expect(result[0]).toBe(sentence1 + "!");
      expect(result[1]).toBe(sentence2);
    });

    it("should split at sentence end (question mark)", () => {
      const sentence1 = "x".repeat(2500);
      const sentence2 = "y".repeat(2500);
      const text = `${sentence1}? ${sentence2}`;

      const result = splitMessage(text);

      expect(result).toHaveLength(2);
      expect(result[0]).toBe(sentence1 + "?");
      expect(result[1]).toBe(sentence2);
    });

    it("should not split at sentence if too early (<30% of max)", () => {
      const sentence1 = "x".repeat(500);
      const longSentence = "y".repeat(4500);
      const text = `${sentence1}. ${longSentence}`;

      const result = splitMessage(text);

      // Should fall back to word boundary or hard split
      expect(result).toHaveLength(2);
    });

    it("should find the last sentence boundary within limit", () => {
      const text = "First sentence. ".repeat(300) + "x".repeat(1000);

      const result = splitMessage(text);

      expect(result.length).toBeGreaterThan(1);
      result.forEach((chunk, i) => {
        if (i < result.length - 1) {
          // All but last chunk should be within limit
          expect(chunk.length).toBeLessThanOrEqual(TELEGRAM_SAFE_LIMIT);
        }
      });
    });
  });

  describe("Split at word boundary (space)", () => {
    it("should split at word boundary as fallback", () => {
      // Create text without sentence/line/paragraph breaks, only spaces
      const words = "word ".repeat(1000);
      const text = words + "x".repeat(3000);

      const result = splitMessage(text);

      expect(result).toHaveLength(2);
      result.forEach((chunk) => {
        expect(chunk.length).toBeLessThanOrEqual(TELEGRAM_SAFE_LIMIT);
      });
    });

    it("should not split at word if too early (<30% of max)", () => {
      const shortWord = "x".repeat(500);
      const longNoSpaces = "y".repeat(4500);
      const text = `${shortWord} ${longNoSpaces}`;

      const result = splitMessage(text);

      // Should fall back to hard split
      expect(result).toHaveLength(2);
    });

    it("should handle text with many small words", () => {
      const text = "ab ".repeat(2000); // Many small words

      const result = splitMessage(text);

      result.forEach((chunk) => {
        expect(chunk.length).toBeLessThanOrEqual(TELEGRAM_SAFE_LIMIT);
      });
    });
  });

  describe("Hard split (last resort)", () => {
    it("should perform hard split as last resort", () => {
      // Text with no natural boundaries
      const text = "x".repeat(8000);

      const result = splitMessage(text);

      expect(result).toHaveLength(2);
      expect(result[0]!.length).toBe(TELEGRAM_SAFE_LIMIT);
      expect(result[1]!.length).toBe(8000 - TELEGRAM_SAFE_LIMIT);
    });

    it("should log warning when using hard split", async () => {
      const { logger } = await import("../../../src/core/logger.js");

      const text = "x".repeat(8000);

      splitMessage(text);

      expect(logger.warn).toHaveBeenCalledWith(
        "Using hard split (no good boundary found)",
        expect.objectContaining({
          maxLength: TELEGRAM_SAFE_LIMIT,
        })
      );
    });

    it("should handle very long text with no boundaries", () => {
      const text = "x".repeat(15000);

      const result = splitMessage(text);

      expect(result.length).toBeGreaterThan(1);
      result.forEach((chunk, i) => {
        if (i < result.length - 1) {
          expect(chunk.length).toBe(TELEGRAM_SAFE_LIMIT);
        }
      });
    });
  });

  describe("Russian text and Cyrillic characters", () => {
    it("should handle Russian text with Cyrillic characters", () => {
      const russianText =
        "Привет! Это тестовое сообщение на русском языке. ".repeat(100);

      const result = splitMessage(russianText);

      result.forEach((chunk) => {
        expect(chunk.length).toBeLessThanOrEqual(TELEGRAM_SAFE_LIMIT);
      });
    });

    it("should split Russian text at sentence boundaries", () => {
      const sentence1 = "Первое предложение. ".repeat(200);
      const sentence2 = "Второе предложение! ".repeat(200);
      const text = sentence1 + sentence2;

      const result = splitMessage(text);

      expect(result.length).toBeGreaterThan(1);
      result.forEach((chunk) => {
        expect(chunk.length).toBeLessThanOrEqual(TELEGRAM_SAFE_LIMIT);
      });
    });

    it("should handle mixed Russian and English text", () => {
      const mixedText =
        "Hello мир! This is тестовое сообщение with смешанным текстом. ".repeat(100);

      const result = splitMessage(mixedText);

      result.forEach((chunk) => {
        expect(chunk.length).toBeLessThanOrEqual(TELEGRAM_SAFE_LIMIT);
      });
    });

    it("should handle Russian text with paragraph breaks", () => {
      const paragraph1 = "Первый абзац. ".repeat(150);
      const paragraph2 = "Второй абзац. ".repeat(150);
      const text = `${paragraph1}\n\n${paragraph2}`;

      const result = splitMessage(text);

      result.forEach((chunk) => {
        expect(chunk.length).toBeLessThanOrEqual(TELEGRAM_SAFE_LIMIT);
      });
    });
  });

  describe("Emoji handling", () => {
    it("should preserve emoji in chunks", () => {
      const text = "Message with emoji 😊🎉🔥 and more text".repeat(200);

      const result = splitMessage(text);

      const joinedResult = result.join("");
      expect(joinedResult).toContain("😊");
      expect(joinedResult).toContain("🎉");
      expect(joinedResult).toContain("🔥");
    });

    it("should handle emoji at chunk boundaries", () => {
      const beforeEmoji = "x".repeat(3998);
      const text = `${beforeEmoji} 😊 more text`;

      const result = splitMessage(text);

      const joinedResult = result.join("");
      expect(joinedResult).toContain("😊");
    });

    it("should handle multiple emoji in succession", () => {
      const text = "Text 😊😊😊😊😊 more text".repeat(200);

      const result = splitMessage(text);

      const joinedResult = result.join("");
      // Count emojis in original vs result
      const originalEmojiCount = (text.match(/😊/g) || []).length;
      const resultEmojiCount = (joinedResult.match(/😊/g) || []).length;
      expect(resultEmojiCount).toBe(originalEmojiCount);
    });

    it("should handle emoji with modifiers (skin tone)", () => {
      const text = "Message 👋🏻👋🏼👋🏽👋🏾👋🏿 with skin tones".repeat(200);

      const result = splitMessage(text);

      const joinedResult = result.join("");
      expect(joinedResult).toContain("👋🏻");
      expect(joinedResult).toContain("👋🏿");
    });
  });

  describe("Edge cases", () => {
    it("should trim whitespace from chunks", () => {
      const text = "x".repeat(2500) + "    \n\n    " + "y".repeat(2500);

      const result = splitMessage(text);

      result.forEach((chunk) => {
        expect(chunk).toBe(chunk.trim());
      });
    });

    it("should handle text with only whitespace", () => {
      const text = "   \n\n   \n   ";

      const result = splitMessage(text);

      expect(result.length).toBeGreaterThan(0);
    });

    it("should handle text with consecutive delimiters", () => {
      const text = "Text\n\n\n\n\nMore text".repeat(200);

      const result = splitMessage(text);

      const joinedResult = result.join("");
      expect(joinedResult).toContain("Text");
      expect(joinedResult).toContain("More text");
    });

    it("should handle single very long word (no spaces)", () => {
      const text = "x".repeat(10000);

      const result = splitMessage(text);

      expect(result.length).toBeGreaterThan(1);
      result.forEach((chunk) => {
        expect(chunk.length).toBeLessThanOrEqual(TELEGRAM_SAFE_LIMIT);
      });
    });

    it("should handle custom maxLength smaller than default", () => {
      const text = "x".repeat(500);

      const result = splitMessage(text, 100);

      expect(result.length).toBeGreaterThan(1);
      result.forEach((chunk) => {
        expect(chunk.length).toBeLessThanOrEqual(100);
      });
    });

    it("should handle custom maxLength larger than default", () => {
      const text = "x".repeat(5000);

      const result = splitMessage(text, 8000);

      expect(result).toHaveLength(1);
      expect(result[0]).toBe(text);
    });
  });

  describe("Logger integration", () => {
    it("should log debug message when splitting starts", async () => {
      const { logger } = await import("../../../src/core/logger.js");

      const text = "x".repeat(8000);

      splitMessage(text);

      expect(logger.debug).toHaveBeenCalledWith(
        "Splitting long message",
        expect.objectContaining({
          length: 8000,
          maxLength: TELEGRAM_SAFE_LIMIT,
        })
      );
    });

    it("should log info message with total chunks", async () => {
      const { logger } = await import("../../../src/core/logger.js");

      const text = "x".repeat(8000);

      const result = splitMessage(text);

      expect(logger.info).toHaveBeenCalledWith(
        "Message split into chunks",
        expect.objectContaining({
          totalChunks: result.length,
        })
      );
    });

    it("should not log debug for short messages", async () => {
      const { logger } = await import("../../../src/core/logger.js");

      const text = "Short message";

      splitMessage(text);

      expect(logger.debug).not.toHaveBeenCalled();
    });
  });

  describe("Real-world scenarios", () => {
    it("should handle typical coffee cup interpretation message", () => {
      const interpretation = `
<b>Толкование кофейной гущи</b>

Дорогая, вижу в твоей чашке интересные символы! ☕

<b>Символы:</b>
- Дерево: символизирует рост и развитие
- Птица: свобода и новые возможности
- Спираль: жизненный путь и трансформация

<b>Цвета:</b>
- Коричневый: стабильность
- Белый: чистота намерений

<b>Общее толкование:</b>
Тебя ждут позитивные перемены в ближайшем будущем. Не бойся новых начинаний!
      `.repeat(20); // Make it long enough to split

      const result = splitMessage(interpretation);

      result.forEach((chunk) => {
        expect(chunk.length).toBeLessThanOrEqual(TELEGRAM_SAFE_LIMIT);
      });

      // Verify content is preserved
      const joinedResult = result.join("");
      expect(joinedResult).toContain("Толкование кофейной гущи");
      expect(joinedResult).toContain("символы");
    });

    it("should handle multi-paragraph chat response", () => {
      const chatResponse = `
Привет! Рада тебя видеть.

По поводу твоего вопроса о жизни и судьбе - это глубокая тема. Давай разберем по порядку.

Во-первых, важно понимать, что каждый человек уникален. Твой путь - это твой выбор.

Во-вторых, символы, которые мы видим в гадании, - это лишь подсказки. Они помогают нам лучше понять себя.

В-третьих, не забывай о важности интуиции. Слушай свое сердце.

Надеюсь, это помогло! Если есть еще вопросы - спрашивай.
      `.repeat(50);

      const result = splitMessage(chatResponse);

      result.forEach((chunk) => {
        expect(chunk.length).toBeLessThanOrEqual(TELEGRAM_SAFE_LIMIT);
      });
    });

    it("should handle long list of interpretations", () => {
      const symbols = Array.from({ length: 100 }, (_, i) =>
        `${i + 1}. Символ "${String.fromCharCode(65 + (i % 26))}": Это означает ${
          "что-то важное ".repeat(10)
        }`
      ).join("\n");

      const result = splitMessage(symbols);

      result.forEach((chunk) => {
        expect(chunk.length).toBeLessThanOrEqual(TELEGRAM_SAFE_LIMIT);
      });

      const joinedResult = result.join("");
      expect(joinedResult).toContain("1. Символ");
      expect(joinedResult).toContain("100. Символ");
    });
  });

  describe("Chunk reassembly", () => {
    it("should allow perfect reassembly of original text", () => {
      const originalText = `
First paragraph with some text.

Second paragraph with more content.

Third paragraph with even more text! And questions? Yes.

Final paragraph.
      `.repeat(20);

      const result = splitMessage(originalText);

      const reassembled = result.join("");

      // After trimming each chunk, some whitespace may be lost, but content should match
      expect(reassembled.replace(/\s+/g, " ")).toBe(
        originalText.replace(/\s+/g, " ")
      );
    });

    it("should preserve word count across chunks", () => {
      const originalText = "word ".repeat(5000);

      const result = splitMessage(originalText);

      const originalWords = originalText.trim().split(/\s+/).filter(w => w.length > 0);
      const reassembledWords = result.join(" ").trim().split(/\s+/).filter(w => w.length > 0);

      // Allow for slight difference due to trimming at chunk boundaries
      expect(Math.abs(reassembledWords.length - originalWords.length)).toBeLessThan(5);
    });
  });
});
