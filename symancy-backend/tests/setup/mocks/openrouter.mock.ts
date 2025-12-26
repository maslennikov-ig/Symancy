import { vi } from 'vitest'

export const mockVisionResponse = {
  content: `PRIMARY PATTERN: A bird shape in the center

SECONDARY PATTERNS:
1. Heart shape - lower left
2. Star formation - upper right
3. Wave pattern - along the edge

OVERALL COMPOSITION: Harmonious flow from center outward`,
}

export const mockInterpretationResponse = {
  content: `☕ В вашей чашке я вижу удивительные образы...

🕊️ **Птица в центре** символизирует свободу и новые возможности.`,
  usage_metadata: { total_tokens: 150 },
}

export const mockChatResponse = {
  content: 'Это очень интересный вопрос! Птица в вашей чашке действительно особенная...',
  usage_metadata: { total_tokens: 80 },
}

export function mockLangChainModels() {
  vi.mock('@/core/langchain/models.js', () => ({
    createArinaModel: vi.fn(() => ({
      invoke: vi.fn(() => Promise.resolve(mockInterpretationResponse)),
    })),
    createCassandraModel: vi.fn(() => ({
      invoke: vi.fn(() => Promise.resolve(mockInterpretationResponse)),
    })),
    createVisionModel: vi.fn(() => ({
      invoke: vi.fn(() => Promise.resolve(mockVisionResponse)),
    })),
  }))
}
