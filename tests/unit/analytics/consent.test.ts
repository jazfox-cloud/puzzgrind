import { describe, expect, it, vi } from "vitest";

import {
  ANALYTICS_CONSENT_STORAGE_KEY,
  clearAnalyticsCookies,
  parseAnalyticsConsent,
  readAnalyticsConsent,
  storeAnalyticsConsent,
} from "@/lib/analytics/consent";

describe("analytics consent storage", () => {
  it("uses a versioned first-party key and treats missing or invalid data as unknown", () => {
    expect(ANALYTICS_CONSENT_STORAGE_KEY).toBe("puzzgrind.analytics-consent.v1");
    expect(parseAnalyticsConsent(null)).toBe("unknown");
    expect(parseAnalyticsConsent("yes")).toBe("unknown");
    expect(parseAnalyticsConsent("granted")).toBe("granted");
    expect(parseAnalyticsConsent("denied")).toBe("denied");
  });

  it("reads and writes only the analytics consent value", () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      removeItem: (key: string) => values.delete(key),
      setItem: (key: string, value: string) => values.set(key, value),
    };

    expect(readAnalyticsConsent(storage)).toBe("unknown");
    expect(storeAnalyticsConsent("granted", storage)).toBe(true);
    expect(readAnalyticsConsent(storage)).toBe("granted");
    expect(storeAnalyticsConsent("denied", storage)).toBe(true);
    expect(readAnalyticsConsent(storage)).toBe("denied");
    expect(storeAnalyticsConsent("unknown", storage)).toBe(true);
    expect(readAnalyticsConsent(storage)).toBe("unknown");
  });

  it("fails safely when browser storage is unavailable", () => {
    const unavailable = {
      getItem: () => { throw new Error("blocked"); },
      removeItem: () => { throw new Error("blocked"); },
      setItem: () => { throw new Error("blocked"); },
    };
    expect(readAnalyticsConsent(unavailable)).toBe("unknown");
    expect(storeAnalyticsConsent("granted", unavailable)).toBe(false);
  });

  it("clears only accessible Google Analytics cookie names", () => {
    const writeCookie = vi.fn();
    expect(clearAnalyticsCookies("_ga=one; sudoku-progress=keep; _ga_TEST=two", "www.puzzgrind.com", writeCookie)).toBe(2);
    expect(writeCookie).toHaveBeenCalledTimes(6);
    expect(writeCookie.mock.calls.every(([value]) => value.startsWith("_ga"))).toBe(true);
    expect(writeCookie.mock.calls.some(([value]) => value.includes("Domain=.puzzgrind.com"))).toBe(true);
  });
});
