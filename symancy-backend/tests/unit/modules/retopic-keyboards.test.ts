/**
 * Unit tests for retopic keyboards module
 * Tests parseRetopicCallback, createRetopicKeyboard, and RetopicJobSchema
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// =============================================================================
// Mock grammy InlineKeyboard (must be before imports)
// =============================================================================

// Mock tracking variables
const mockTextCalls: Array<[string, string]> = [];
const mockRowCalls: number[] = [];

// Mock grammy with factory function
vi.mock('grammy', () => {
  // Create mock class inside factory to avoid hoisting issues
  return {
    InlineKeyboard: class MockInlineKeyboard {
      text(label: string, callbackData: string) {
        mockTextCalls.push([label, callbackData]);
        return this;
      }
      row() {
        mockRowCalls.push(1);
        return this;
      }
    },
  };
});

// Import after mock
import { parseRetopicCallback, createRetopicKeyboard } from '../../../src/modules/photo-analysis/keyboards.js';
import { RetopicJobSchema } from '../../../src/types/job-schemas.js';
import { READING_TOPICS } from '../../../src/config/constants.js';

// =============================================================================
// Test Suite: parseRetopicCallback
// =============================================================================

describe('parseRetopicCallback', () => {
  const validUuid = '550e8400-e29b-41d4-a716-446655440000';

  describe('valid inputs', () => {
    it('should parse valid retopic callback with love topic', () => {
      const result = parseRetopicCallback(`rt:love:${validUuid}`);

      expect(result).toEqual({
        topicKey: 'love',
        analysisId: validUuid,
      });
    });

    it('should parse valid retopic callback with career topic', () => {
      const result = parseRetopicCallback(`rt:career:${validUuid}`);

      expect(result).toEqual({
        topicKey: 'career',
        analysisId: validUuid,
      });
    });

    it('should parse valid retopic callback with money topic', () => {
      const result = parseRetopicCallback(`rt:money:${validUuid}`);

      expect(result).toEqual({
        topicKey: 'money',
        analysisId: validUuid,
      });
    });

    it('should parse valid retopic callback with health topic', () => {
      const result = parseRetopicCallback(`rt:health:${validUuid}`);

      expect(result).toEqual({
        topicKey: 'health',
        analysisId: validUuid,
      });
    });

    it('should parse valid retopic callback with family topic', () => {
      const result = parseRetopicCallback(`rt:family:${validUuid}`);

      expect(result).toEqual({
        topicKey: 'family',
        analysisId: validUuid,
      });
    });

    it('should parse valid retopic callback with spiritual topic', () => {
      const result = parseRetopicCallback(`rt:spiritual:${validUuid}`);

      expect(result).toEqual({
        topicKey: 'spiritual',
        analysisId: validUuid,
      });
    });
  });

  describe('invalid inputs', () => {
    it('should return null for empty string', () => {
      const result = parseRetopicCallback('');
      expect(result).toBeNull();
    });

    it('should return null for wrong prefix', () => {
      const result = parseRetopicCallback(`topic:love:${validUuid}`);
      expect(result).toBeNull();
    });

    it('should return null for missing parts (only rt:)', () => {
      const result = parseRetopicCallback('rt:');
      expect(result).toBeNull();
    });

    it('should return null for missing UUID (rt:love:)', () => {
      const result = parseRetopicCallback('rt:love:');
      expect(result).toBeNull();
    });

    it('should return null for "all" topic (not valid for retopic)', () => {
      const result = parseRetopicCallback(`rt:all:${validUuid}`);
      expect(result).toBeNull();
    });

    it('should return null for invalid topic', () => {
      const result = parseRetopicCallback(`rt:invalid_topic:${validUuid}`);
      expect(result).toBeNull();
    });

    it('should return null for non-UUID analysisId', () => {
      const result = parseRetopicCallback('rt:love:not-a-uuid');
      expect(result).toBeNull();
    });

    it('should return null for 4 parts (extra data)', () => {
      const result = parseRetopicCallback(`rt:love:${validUuid}:extra`);
      expect(result).toBeNull();
    });

    it('should return null for only 2 parts (rt:love)', () => {
      const result = parseRetopicCallback('rt:love');
      expect(result).toBeNull();
    });

    it('should return null for malformed UUID', () => {
      const result = parseRetopicCallback('rt:love:550e8400-invalid-uuid');
      expect(result).toBeNull();
    });

    it('should return null for UUID with invalid characters', () => {
      const result = parseRetopicCallback('rt:love:gggggggg-gggg-gggg-gggg-gggggggggggg');
      expect(result).toBeNull();
    });
  });
});

// =============================================================================
// Test Suite: createRetopicKeyboard
// =============================================================================

describe('createRetopicKeyboard', () => {
  const validUuid = '550e8400-e29b-41d4-a716-446655440000';

  beforeEach(() => {
    // Clear tracking arrays before each test
    mockTextCalls.length = 0;
    mockRowCalls.length = 0;
  });

  describe('keyboard generation', () => {
    it('should create keyboard with 6 buttons when no topics covered', () => {
      const result = createRetopicKeyboard(validUuid, [], 'ru');

      expect(result).not.toBeNull();
      // 6 topics = 3 rows (2 buttons per row)
      expect(mockRowCalls.length).toBe(3);
      // 6 text buttons
      expect(mockTextCalls.length).toBe(6);
    });

    it('should create keyboard with 4 buttons when 2 topics covered', () => {
      const result = createRetopicKeyboard(validUuid, ['love', 'career'], 'ru');

      expect(result).not.toBeNull();
      // 4 remaining topics = 2 rows
      expect(mockRowCalls.length).toBe(2);
      // 4 text buttons
      expect(mockTextCalls.length).toBe(4);
    });

    it('should create keyboard with 1 button when 5 topics covered', () => {
      const result = createRetopicKeyboard(
        validUuid,
        ['love', 'career', 'money', 'health', 'family'],
        'ru'
      );

      expect(result).not.toBeNull();
      // 1 remaining topic = 1 row (single button still creates a row)
      expect(mockRowCalls.length).toBe(1);
      // 1 text button
      expect(mockTextCalls.length).toBe(1);
    });

    it('should return null when all 6 topics covered', () => {
      const result = createRetopicKeyboard(
        validUuid,
        ['love', 'career', 'money', 'health', 'family', 'spiritual'],
        'en'
      );

      expect(result).toBeNull();
      // No buttons should be created
      expect(mockTextCalls.length).toBe(0);
      expect(mockRowCalls.length).toBe(0);
    });
  });

  describe('button labels by language', () => {
    it('should use Russian labels by default', () => {
      createRetopicKeyboard(validUuid, [], 'ru');

      // Check that Russian labels are used (emoji + label_ru)
      const labels = mockTextCalls.map(([label]) => label);
      expect(labels.some(label => label.includes('Любовь'))).toBe(true);
      expect(labels.some(label => label.includes('❤️'))).toBe(true);
    });

    it('should use English labels for "en" language', () => {
      createRetopicKeyboard(validUuid, [], 'en');

      // Check that English labels are used
      const labels = mockTextCalls.map(([label]) => label);
      expect(labels.some(label => label.includes('Love'))).toBe(true);
      expect(labels.some(label => label.includes('Career'))).toBe(true);
    });

    it('should use Chinese labels for "zh" language', () => {
      createRetopicKeyboard(validUuid, [], 'zh');

      // Check that Chinese labels are used
      const labels = mockTextCalls.map(([label]) => label);
      expect(labels.some(label => label.includes('爱情'))).toBe(true);
      expect(labels.some(label => label.includes('事业'))).toBe(true);
    });

    it('should default to Russian when no language arg provided', () => {
      createRetopicKeyboard(validUuid, []);

      // Check that Russian labels are used
      const labels = mockTextCalls.map(([label]) => label);
      expect(labels.some(label => label.includes('Любовь'))).toBe(true);
    });
  });

  describe('callback data format', () => {
    it('should use rt:{key}:{analysisId} format for callback data', () => {
      createRetopicKeyboard(validUuid, [], 'ru');

      // Each button should have callback data in format: rt:{key}:{uuid}
      const callbackData = mockTextCalls.map(([, data]) => data);

      READING_TOPICS.forEach((topic) => {
        expect(callbackData).toContain(`rt:${topic.key}:${validUuid}`);
      });
    });

    it('should include analysisId in all callback data', () => {
      const customUuid = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
      createRetopicKeyboard(customUuid, ['love'], 'en');

      // All remaining topics should have the custom UUID
      const callbackData = mockTextCalls.map(([, data]) => data);
      callbackData.forEach((data) => {
        expect(data).toContain(customUuid);
        expect(data).toMatch(/^rt:[a-z]+:[a-f0-9-]+$/);
      });
    });
  });

  describe('covered topics filtering', () => {
    it('should exclude covered topics from keyboard', () => {
      createRetopicKeyboard(validUuid, ['love', 'money'], 'ru');

      // Should NOT have buttons for love and money
      const callbackData = mockTextCalls.map(([, data]) => data);

      expect(callbackData).not.toContain(`rt:love:${validUuid}`);
      expect(callbackData).not.toContain(`rt:money:${validUuid}`);

      // Should HAVE buttons for remaining topics
      expect(callbackData).toContain(`rt:career:${validUuid}`);
      expect(callbackData).toContain(`rt:health:${validUuid}`);
      expect(callbackData).toContain(`rt:family:${validUuid}`);
      expect(callbackData).toContain(`rt:spiritual:${validUuid}`);
    });
  });
});

// =============================================================================
// Test Suite: RetopicJobSchema (Zod validation)
// =============================================================================

describe('RetopicJobSchema', () => {
  const validUuid = '550e8400-e29b-41d4-a716-446655440000';

  const validJobData = {
    telegramUserId: 123456,
    chatId: -789012,
    messageId: 42,
    analysisId: validUuid,
    persona: 'arina' as const,
    topic: 'love' as const,
    language: 'ru',
    userName: 'TestUser',
  };

  describe('valid data', () => {
    it('should validate complete valid job data', () => {
      const result = RetopicJobSchema.safeParse(validJobData);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(validJobData);
      }
    });

    it('should validate without optional userName', () => {
      const { userName, ...dataWithoutUserName } = validJobData;
      const result = RetopicJobSchema.safeParse(dataWithoutUserName);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.userName).toBeUndefined();
      }
    });

    it('should validate with optional userName', () => {
      const result = RetopicJobSchema.safeParse(validJobData);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.userName).toBe('TestUser');
      }
    });

    it('should validate persona "cassandra"', () => {
      const data = { ...validJobData, persona: 'cassandra' as const };
      const result = RetopicJobSchema.safeParse(data);

      expect(result.success).toBe(true);
    });
  });

  describe('valid topics', () => {
    it('should validate topic "love"', () => {
      const data = { ...validJobData, topic: 'love' as const };
      const result = RetopicJobSchema.safeParse(data);

      expect(result.success).toBe(true);
    });

    it('should validate topic "career"', () => {
      const data = { ...validJobData, topic: 'career' as const };
      const result = RetopicJobSchema.safeParse(data);

      expect(result.success).toBe(true);
    });

    it('should validate topic "money"', () => {
      const data = { ...validJobData, topic: 'money' as const };
      const result = RetopicJobSchema.safeParse(data);

      expect(result.success).toBe(true);
    });

    it('should validate topic "health"', () => {
      const data = { ...validJobData, topic: 'health' as const };
      const result = RetopicJobSchema.safeParse(data);

      expect(result.success).toBe(true);
    });

    it('should validate topic "family"', () => {
      const data = { ...validJobData, topic: 'family' as const };
      const result = RetopicJobSchema.safeParse(data);

      expect(result.success).toBe(true);
    });

    it('should validate topic "spiritual"', () => {
      const data = { ...validJobData, topic: 'spiritual' as const };
      const result = RetopicJobSchema.safeParse(data);

      expect(result.success).toBe(true);
    });
  });

  describe('invalid data', () => {
    it('should reject topic "all" (excluded from SingleTopicEnum)', () => {
      const data = { ...validJobData, topic: 'all' };
      const result = RetopicJobSchema.safeParse(data);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].path).toContain('topic');
      }
    });

    it('should reject invalid topic', () => {
      const data = { ...validJobData, topic: 'invalid_topic' };
      const result = RetopicJobSchema.safeParse(data);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].path).toContain('topic');
      }
    });

    it('should reject missing required field: telegramUserId', () => {
      const { telegramUserId, ...dataWithoutUserId } = validJobData;
      const result = RetopicJobSchema.safeParse(dataWithoutUserId);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].path).toContain('telegramUserId');
      }
    });

    it('should reject missing required field: analysisId', () => {
      const { analysisId, ...dataWithoutAnalysisId } = validJobData;
      const result = RetopicJobSchema.safeParse(dataWithoutAnalysisId);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].path).toContain('analysisId');
      }
    });

    it('should reject invalid UUID for analysisId', () => {
      const data = { ...validJobData, analysisId: 'not-a-valid-uuid' };
      const result = RetopicJobSchema.safeParse(data);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].path).toContain('analysisId');
      }
    });

    it('should reject non-positive telegramUserId', () => {
      const data = { ...validJobData, telegramUserId: 0 };
      const result = RetopicJobSchema.safeParse(data);

      expect(result.success).toBe(false);
    });

    it('should reject negative telegramUserId', () => {
      const data = { ...validJobData, telegramUserId: -123 };
      const result = RetopicJobSchema.safeParse(data);

      expect(result.success).toBe(false);
    });

    it('should reject non-integer telegramUserId', () => {
      const data = { ...validJobData, telegramUserId: 123.45 };
      const result = RetopicJobSchema.safeParse(data);

      expect(result.success).toBe(false);
    });

    it('should reject non-positive messageId', () => {
      const data = { ...validJobData, messageId: 0 };
      const result = RetopicJobSchema.safeParse(data);

      expect(result.success).toBe(false);
    });

    it('should reject invalid persona', () => {
      const data = { ...validJobData, persona: 'unknown' };
      const result = RetopicJobSchema.safeParse(data);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].path).toContain('persona');
      }
    });

    it('should reject language shorter than 2 characters', () => {
      const data = { ...validJobData, language: 'r' };
      const result = RetopicJobSchema.safeParse(data);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].path).toContain('language');
      }
    });

    it('should reject language longer than 10 characters', () => {
      const data = { ...validJobData, language: 'this-is-too-long' };
      const result = RetopicJobSchema.safeParse(data);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].path).toContain('language');
      }
    });
  });
});
