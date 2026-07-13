import { afterEach, describe, expect, it } from "vitest";

import {
  analyticsDebugMessage,
  getAnalyticsMeasurementId,
  isAnalyticsConfigured,
  isAnalyticsEnabled,
} from "@/lib/analytics/config";

const originalMeasurementId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;

afterEach(() => {
  if (originalMeasurementId === undefined) delete process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
  else process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID = originalMeasurementId;
});

describe("analytics environment configuration", () => {
  it("reads and validates the Measurement ID only from the environment", () => {
    process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID = " G-N1NLGSYBKD ";
    expect(getAnalyticsMeasurementId()).toBe("G-N1NLGSYBKD");

    process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID = "not-a-measurement-id";
    expect(getAnalyticsMeasurementId()).toBeUndefined();
  });

  it("enables GA only for configured Production with granted consent", () => {
    expect(isAnalyticsConfigured("production", "G-N1NLGSYBKD")).toBe(true);
    expect(isAnalyticsEnabled("production", "G-N1NLGSYBKD", "granted")).toBe(true);
    expect(isAnalyticsEnabled("production", "G-N1NLGSYBKD", "unknown")).toBe(false);
    expect(isAnalyticsEnabled("production", "G-N1NLGSYBKD", "denied")).toBe(false);
    expect(isAnalyticsEnabled("production", undefined, "granted")).toBe(false);

    for (const environment of ["local", "test", "preview", "staging"] as const) {
      expect(isAnalyticsEnabled(environment, "G-N1NLGSYBKD", "granted")).toBe(false);
    }
  });

  it("provides the required environment debug messages", () => {
    expect(analyticsDebugMessage("production", true, "granted")).toBe("Analytics Enabled");
    expect(analyticsDebugMessage("production", false, "unknown")).toBe("Analytics Disabled (consent unknown)");
    expect(analyticsDebugMessage("local", false, "unknown")).toBe("Analytics Disabled (local)");
    expect(analyticsDebugMessage("preview", false, "granted")).toBe("Analytics Disabled (preview)");
    expect(analyticsDebugMessage("staging", false, "granted")).toBe("Analytics Disabled (staging)");
  });
});
