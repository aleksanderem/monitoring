import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  formatDate,
  formatNumber,
  formatCurrency,
  formatPercent,
  formatRelativeTime,
  formatCompactNumber,
} from "@/lib/locale-formatting";

describe("locale-formatting", () => {
  describe("formatDate", () => {
    const testDate = new Date(2025, 0, 15); // Jan 15, 2025

    it("formats date with 'pl' locale in medium style using Polish month name", () => {
      const result = formatDate(testDate, "pl", "medium");
      expect(result).toContain("stycznia");
      expect(result).toContain("2025");
    });

    it("formats date with 'en' locale in medium style using English month name", () => {
      const result = formatDate(testDate, "en", "medium");
      expect(result).toContain("January");
      expect(result).toContain("2025");
    });

    it("formats date in short style with numeric month", () => {
      const result = formatDate(testDate, "en", "short");
      expect(result).toMatch(/1.*15.*2025/);
    });

    it("formats date in long style with weekday", () => {
      const result = formatDate(testDate, "en", "long");
      expect(result).toContain("Wednesday");
    });

    it("formats date in long style with Polish weekday", () => {
      const result = formatDate(testDate, "pl", "long");
      expect(result).toContain("środa");
    });

    it("accepts a timestamp number", () => {
      const result = formatDate(testDate.getTime(), "en", "medium");
      expect(result).toContain("January");
    });

    it("defaults to medium style", () => {
      const result = formatDate(testDate, "en");
      expect(result).toContain("January");
    });
  });

  describe("formatNumber", () => {
    it("formats number with 'pl' locale using space as thousands separator", () => {
      const result = formatNumber(1234567, "pl");
      // Polish uses non-breaking space (U+00A0) as thousands separator
      expect(result.replace(/\s/g, " ")).toBe("1 234 567");
    });

    it("formats number with 'en' locale using comma as thousands separator", () => {
      const result = formatNumber(1234567, "en");
      expect(result).toBe("1,234,567");
    });

    it("passes through Intl options", () => {
      const result = formatNumber(1234.5678, "en", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
      expect(result).toBe("1,234.57");
    });

    it("handles zero", () => {
      expect(formatNumber(0, "en")).toBe("0");
    });

    it("handles negative numbers", () => {
      const result = formatNumber(-1234, "en");
      expect(result).toContain("1,234");
    });
  });

  describe("formatCurrency", () => {
    it("formats PLN with 'pl' locale showing zł", () => {
      const result = formatCurrency(1234.5, "PLN", "pl");
      expect(result).toMatch(/1[\s\u00a0]?234,50/);
      expect(result).toContain("zł");
    });

    it("formats USD with 'en' locale showing $", () => {
      const result = formatCurrency(1234.5, "USD", "en");
      expect(result).toContain("$");
      expect(result).toContain("1,234.50");
    });

    it("formats EUR with 'en' locale", () => {
      const result = formatCurrency(99.99, "EUR", "en");
      expect(result).toMatch(/€/);
    });

    it("formats zero amount", () => {
      const result = formatCurrency(0, "USD", "en");
      expect(result).toContain("$");
      expect(result).toContain("0.00");
    });
  });

  describe("formatPercent", () => {
    it("formats percent with 'en' locale", () => {
      const result = formatPercent(45.6, "en", 1);
      expect(result).toBe("45.6%");
    });

    it("formats percent with 'pl' locale using comma as decimal", () => {
      const result = formatPercent(45.6, "pl", 1);
      expect(result).toContain("45,6");
      expect(result).toContain("%");
    });

    it("respects decimals parameter", () => {
      const result = formatPercent(33.333, "en", 2);
      expect(result).toBe("33.33%");
    });

    it("defaults to 1 decimal", () => {
      const result = formatPercent(50, "en");
      expect(result).toBe("50.0%");
    });

    it("handles 0%", () => {
      const result = formatPercent(0, "en", 1);
      expect(result).toBe("0.0%");
    });

    it("handles 100%", () => {
      const result = formatPercent(100, "en", 0);
      expect(result).toBe("100%");
    });
  });

  describe("formatRelativeTime", () => {
    let now: Date;

    beforeEach(() => {
      now = new Date("2025-06-15T12:00:00Z");
      vi.useFakeTimers();
      vi.setSystemTime(now);
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("returns relative minutes for 'en' locale", () => {
      const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);
      const result = formatRelativeTime(fiveMinutesAgo, "en");
      expect(result).toContain("5");
      expect(result).toMatch(/minute/i);
    });

    it("returns relative hours for 'en' locale", () => {
      const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);
      const result = formatRelativeTime(twoHoursAgo, "en");
      expect(result).toContain("2");
      expect(result).toMatch(/hour/i);
    });

    it("returns relative days for 'en' locale", () => {
      const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
      const result = formatRelativeTime(threeDaysAgo, "en");
      expect(result).toContain("3");
      expect(result).toMatch(/day/i);
    });

    it("returns relative months for dates >30 days ago", () => {
      const twoMonthsAgo = new Date(now.getTime() - 65 * 24 * 60 * 60 * 1000);
      const result = formatRelativeTime(twoMonthsAgo, "en");
      expect(result).toContain("2");
      expect(result).toMatch(/month/i);
    });

    it("returns Polish relative time for 'pl' locale", () => {
      const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);
      const result = formatRelativeTime(fiveMinutesAgo, "pl");
      expect(result).toContain("5");
      expect(result).toMatch(/minut/i);
    });

    it("returns Polish days for 'pl' locale", () => {
      const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
      const result = formatRelativeTime(threeDaysAgo, "pl");
      expect(result).toContain("3");
      expect(result).toMatch(/dn/i);
    });

    it("accepts a timestamp number", () => {
      const fiveMinutesAgo = now.getTime() - 5 * 60 * 1000;
      const result = formatRelativeTime(fiveMinutesAgo, "en");
      expect(result).toContain("5");
    });
  });

  describe("formatCompactNumber", () => {
    it("formats large numbers compactly in 'en' locale", () => {
      expect(formatCompactNumber(1500, "en")).toMatch(/1\.5K/i);
      expect(formatCompactNumber(1200000, "en")).toMatch(/1\.2M/i);
    });

    it("formats large numbers compactly in 'pl' locale", () => {
      const result = formatCompactNumber(1500, "pl");
      expect(result).toMatch(/1,5|1\.5/i);
    });

    it("formats small numbers without notation", () => {
      expect(formatCompactNumber(42, "en")).toBe("42");
    });
  });
});
