import type { AppEnvironment } from "@/lib/seo";

const MEASUREMENT_ID_PATTERN = /^G-[A-Z0-9]+$/;

export function getAnalyticsMeasurementId() {
  const value = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID?.trim();
  return value && MEASUREMENT_ID_PATTERN.test(value) ? value : undefined;
}

export function isAnalyticsEnabled(environment: AppEnvironment, measurementId?: string) {
  return environment === "production" && Boolean(measurementId && MEASUREMENT_ID_PATTERN.test(measurementId));
}

export function analyticsDebugMessage(environment: AppEnvironment, enabled: boolean) {
  return enabled ? "Analytics Enabled" : `Analytics Disabled (${environment})`;
}
