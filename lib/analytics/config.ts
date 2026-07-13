import type { AppEnvironment } from "@/lib/seo";
import type { AnalyticsConsent } from "@/lib/analytics/consent";

const MEASUREMENT_ID_PATTERN = /^G-[A-Z0-9]+$/;

export function getAnalyticsMeasurementId() {
  const value = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID?.trim();
  return value && MEASUREMENT_ID_PATTERN.test(value) ? value : undefined;
}

export function isAnalyticsConfigured(environment: AppEnvironment, measurementId?: string) {
  return environment === "production" && Boolean(measurementId && MEASUREMENT_ID_PATTERN.test(measurementId));
}

export function isAnalyticsEnabled(
  environment: AppEnvironment,
  measurementId: string | undefined,
  consent: AnalyticsConsent,
) {
  return isAnalyticsConfigured(environment, measurementId) && consent === "granted";
}

export function analyticsDebugMessage(
  environment: AppEnvironment,
  enabled: boolean,
  consent: AnalyticsConsent,
) {
  if (enabled) return "Analytics Enabled";
  if (environment === "production") return `Analytics Disabled (consent ${consent})`;
  return `Analytics Disabled (${environment})`;
}
