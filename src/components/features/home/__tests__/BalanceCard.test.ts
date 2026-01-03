/**
 * Unit tests for BalanceCard formatting functions
 *
 * Tests the formatCredits and getCreditsFontSize utility functions
 * used in the BalanceCard component for displaying user credit balances.
 * Includes tests for localized thousand suffixes (K, тыс, 千).
 *
 * @module components/features/home/__tests__/BalanceCard.test
 */
import { describe, it, expect } from 'vitest';
import { formatCredits, getCreditsFontSize, THOUSAND_SUFFIX } from '../BalanceCard';

describe('THOUSAND_SUFFIX', () => {
  it('should have correct suffix for English', () => {
    expect(THOUSAND_SUFFIX.en).toBe('K');
  });

  it('should have correct suffix for Russian', () => {
    expect(THOUSAND_SUFFIX.ru).toBe('тыс');
  });

  it('should have correct suffix for Chinese', () => {
    expect(THOUSAND_SUFFIX.zh).toBe('千');
  });
});

describe('formatCredits', () => {
  describe('small numbers (< 10000) - same for all languages', () => {
    it('should return "0" for zero', () => {
      expect(formatCredits(0)).toBe('0');
      expect(formatCredits(0, 'en')).toBe('0');
      expect(formatCredits(0, 'ru')).toBe('0');
      expect(formatCredits(0, 'zh')).toBe('0');
    });

    it('should return "1" for one', () => {
      expect(formatCredits(1)).toBe('1');
    });

    it('should return full number for 999', () => {
      expect(formatCredits(999)).toBe('999');
    });

    it('should return full number for 1000', () => {
      expect(formatCredits(1000)).toBe('1000');
    });

    it('should return full number for 9999 (boundary)', () => {
      expect(formatCredits(9999)).toBe('9999');
    });
  });

  describe('medium numbers (10000-99999) - English', () => {
    it('should return "10K" for 10000 (boundary)', () => {
      expect(formatCredits(10000)).toBe('10K');
      expect(formatCredits(10000, 'en')).toBe('10K');
    });

    it('should return "15K" for 15000', () => {
      expect(formatCredits(15000, 'en')).toBe('15K');
    });

    it('should return "15K" for 15999 (floor division)', () => {
      expect(formatCredits(15999, 'en')).toBe('15K');
    });

    it('should return "50K" for 50000', () => {
      expect(formatCredits(50000, 'en')).toBe('50K');
    });

    it('should return "99K" for 99999 (boundary)', () => {
      expect(formatCredits(99999, 'en')).toBe('99K');
    });
  });

  describe('medium numbers (10000-99999) - Russian', () => {
    it('should return "10тыс" for 10000', () => {
      expect(formatCredits(10000, 'ru')).toBe('10тыс');
    });

    it('should return "15тыс" for 15000', () => {
      expect(formatCredits(15000, 'ru')).toBe('15тыс');
    });

    it('should return "50тыс" for 50000', () => {
      expect(formatCredits(50000, 'ru')).toBe('50тыс');
    });

    it('should return "99тыс" for 99999 (boundary)', () => {
      expect(formatCredits(99999, 'ru')).toBe('99тыс');
    });
  });

  describe('medium numbers (10000-99999) - Chinese', () => {
    it('should return "10千" for 10000', () => {
      expect(formatCredits(10000, 'zh')).toBe('10千');
    });

    it('should return "15千" for 15000', () => {
      expect(formatCredits(15000, 'zh')).toBe('15千');
    });

    it('should return "50千" for 50000', () => {
      expect(formatCredits(50000, 'zh')).toBe('50千');
    });

    it('should return "99千" for 99999 (boundary)', () => {
      expect(formatCredits(99999, 'zh')).toBe('99千');
    });
  });

  describe('large numbers (>= 100000) - English', () => {
    it('should return "100K+" for 100000 (boundary)', () => {
      expect(formatCredits(100000)).toBe('100K+');
      expect(formatCredits(100000, 'en')).toBe('100K+');
    });

    it('should return "150K+" for 150000', () => {
      expect(formatCredits(150000, 'en')).toBe('150K+');
    });

    it('should return "500K+" for 500000', () => {
      expect(formatCredits(500000, 'en')).toBe('500K+');
    });

    it('should return "999K+" for 999999', () => {
      expect(formatCredits(999999, 'en')).toBe('999K+');
    });

    it('should return "1000K+" for 1000000', () => {
      expect(formatCredits(1000000, 'en')).toBe('1000K+');
    });
  });

  describe('large numbers (>= 100000) - Russian', () => {
    it('should return "100тыс+" for 100000', () => {
      expect(formatCredits(100000, 'ru')).toBe('100тыс+');
    });

    it('should return "500тыс+" for 500000', () => {
      expect(formatCredits(500000, 'ru')).toBe('500тыс+');
    });

    it('should return "999тыс+" for 999999', () => {
      expect(formatCredits(999999, 'ru')).toBe('999тыс+');
    });
  });

  describe('large numbers (>= 100000) - Chinese', () => {
    it('should return "100千+" for 100000', () => {
      expect(formatCredits(100000, 'zh')).toBe('100千+');
    });

    it('should return "500千+" for 500000', () => {
      expect(formatCredits(500000, 'zh')).toBe('500千+');
    });

    it('should return "999千+" for 999999', () => {
      expect(formatCredits(999999, 'zh')).toBe('999千+');
    });
  });

  describe('edge cases', () => {
    it('should handle negative numbers (invalid but defensive)', () => {
      expect(formatCredits(-100)).toBe('-100');
    });

    it('should handle decimal numbers (floor division)', () => {
      expect(formatCredits(10500.75, 'en')).toBe('10K');
      expect(formatCredits(10500.75, 'ru')).toBe('10тыс');
      expect(formatCredits(10500.75, 'zh')).toBe('10千');
    });

    it('should handle very large numbers', () => {
      expect(formatCredits(9999999, 'en')).toBe('9999K+');
      expect(formatCredits(9999999, 'ru')).toBe('9999тыс+');
      expect(formatCredits(9999999, 'zh')).toBe('9999千+');
    });

    it('should default to English when no language specified', () => {
      expect(formatCredits(10000)).toBe('10K');
      expect(formatCredits(100000)).toBe('100K+');
    });
  });
});

describe('getCreditsFontSize', () => {
  describe('large font size (text-2xl)', () => {
    it('should return "text-2xl" for 0', () => {
      expect(getCreditsFontSize(0)).toBe('text-2xl');
    });

    it('should return "text-2xl" for 1', () => {
      expect(getCreditsFontSize(1)).toBe('text-2xl');
    });

    it('should return "text-2xl" for 100', () => {
      expect(getCreditsFontSize(100)).toBe('text-2xl');
    });

    it('should return "text-2xl" for 999 (boundary)', () => {
      expect(getCreditsFontSize(999)).toBe('text-2xl');
    });
  });

  describe('medium font size (text-xl)', () => {
    it('should return "text-xl" for 1000 (boundary)', () => {
      expect(getCreditsFontSize(1000)).toBe('text-xl');
    });

    it('should return "text-xl" for 5000', () => {
      expect(getCreditsFontSize(5000)).toBe('text-xl');
    });

    it('should return "text-xl" for 9999 (boundary)', () => {
      expect(getCreditsFontSize(9999)).toBe('text-xl');
    });
  });

  describe('small font size (text-lg)', () => {
    it('should return "text-lg" for 10000 (boundary)', () => {
      expect(getCreditsFontSize(10000)).toBe('text-lg');
    });

    it('should return "text-lg" for 50000', () => {
      expect(getCreditsFontSize(50000)).toBe('text-lg');
    });

    it('should return "text-lg" for 99999', () => {
      expect(getCreditsFontSize(99999)).toBe('text-lg');
    });

    it('should return "text-lg" for 100000', () => {
      expect(getCreditsFontSize(100000)).toBe('text-lg');
    });

    it('should return "text-lg" for 999999', () => {
      expect(getCreditsFontSize(999999)).toBe('text-lg');
    });
  });

  describe('edge cases', () => {
    it('should handle negative numbers (invalid but defensive)', () => {
      expect(getCreditsFontSize(-100)).toBe('text-2xl');
    });

    it('should handle decimal numbers', () => {
      expect(getCreditsFontSize(1000.5)).toBe('text-xl');
      expect(getCreditsFontSize(10000.5)).toBe('text-lg');
    });
  });
});

describe('formatCredits and getCreditsFontSize integration', () => {
  it('should use larger font for numbers displayed in full (all languages)', () => {
    const testCases = [0, 1, 999, 5000, 9999];
    const languages = ['en', 'ru', 'zh'] as const;

    languages.forEach((lang) => {
      testCases.forEach((num) => {
        const formatted = formatCredits(num, lang);
        const fontSize = getCreditsFontSize(num);

        // Numbers < 10000 should be full numbers with larger font
        expect(formatted).toBe(num.toString());
        expect(['text-2xl', 'text-xl'].includes(fontSize)).toBe(true);
      });
    });
  });

  it('should use text-lg for numbers displayed with localized suffix', () => {
    const testCases = [10000, 50000, 99999];

    // English
    testCases.forEach((num) => {
      const formatted = formatCredits(num, 'en');
      const fontSize = getCreditsFontSize(num);
      expect(formatted).toContain('K');
      expect(fontSize).toBe('text-lg');
    });

    // Russian
    testCases.forEach((num) => {
      const formatted = formatCredits(num, 'ru');
      const fontSize = getCreditsFontSize(num);
      expect(formatted).toContain('тыс');
      expect(fontSize).toBe('text-lg');
    });

    // Chinese
    testCases.forEach((num) => {
      const formatted = formatCredits(num, 'zh');
      const fontSize = getCreditsFontSize(num);
      expect(formatted).toContain('千');
      expect(fontSize).toBe('text-lg');
    });
  });

  it('should use text-lg for large numbers with "+" suffix (all languages)', () => {
    const testCases = [100000, 500000, 999999];

    // English
    testCases.forEach((num) => {
      const formatted = formatCredits(num, 'en');
      const fontSize = getCreditsFontSize(num);
      expect(formatted).toContain('K+');
      expect(fontSize).toBe('text-lg');
    });

    // Russian
    testCases.forEach((num) => {
      const formatted = formatCredits(num, 'ru');
      const fontSize = getCreditsFontSize(num);
      expect(formatted).toContain('тыс+');
      expect(fontSize).toBe('text-lg');
    });

    // Chinese
    testCases.forEach((num) => {
      const formatted = formatCredits(num, 'zh');
      const fontSize = getCreditsFontSize(num);
      expect(formatted).toContain('千+');
      expect(fontSize).toBe('text-lg');
    });
  });
});
