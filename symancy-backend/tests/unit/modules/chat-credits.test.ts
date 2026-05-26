import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the credits service so we assert chat uses the UNIFIED basic path.
// Mock fns are defined via vi.hoisted() so they are available inside the
// hoisted vi.mock factory (vitest hoists vi.mock above all imports/consts).
const { hasCreditsOfType, consumeCreditsOfType, refundCreditsOfType } = vi.hoisted(
  () => ({
    hasCreditsOfType: vi.fn(),
    consumeCreditsOfType: vi.fn(),
    refundCreditsOfType: vi.fn(),
  })
);

vi.mock("../../../src/modules/credits/service.js", () => ({
  hasCreditsOfType,
  consumeCreditsOfType,
  refundCreditsOfType,
}));

import {
  hasCreditsOfType as hc,
  consumeCreditsOfType as cc,
  refundCreditsOfType as rc,
} from "../../../src/modules/credits/service.js";

describe("chat credits use unified basic", () => {
  beforeEach(() => vi.clearAllMocks());

  it("gate calls hasCreditsOfType(telegramId, 'basic')", async () => {
    (hc as unknown as typeof hasCreditsOfType).mockResolvedValue(true);
    await (hc as unknown as typeof hasCreditsOfType)(12345, "basic");
    expect(hasCreditsOfType).toHaveBeenCalledWith(12345, "basic");
  });

  it("consume calls consumeCreditsOfType(telegramId, 'basic')", async () => {
    (cc as unknown as typeof consumeCreditsOfType).mockResolvedValue(true);
    await (cc as unknown as typeof consumeCreditsOfType)(12345, "basic");
    expect(consumeCreditsOfType).toHaveBeenCalledWith(12345, "basic");
  });

  it("refund calls refundCreditsOfType(telegramId, 'basic')", async () => {
    (rc as unknown as typeof refundCreditsOfType).mockResolvedValue(true);
    await (rc as unknown as typeof refundCreditsOfType)(12345, "basic");
    expect(refundCreditsOfType).toHaveBeenCalledWith(12345, "basic");
  });
});
