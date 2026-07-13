"use client";

import { GoogleAnalytics } from "@next/third-parties/google";
import { useEffect } from "react";

import { analyticsDebugMessage, isAnalyticsEnabled } from "@/lib/analytics/config";
import type { AppEnvironment } from "@/lib/seo";

declare global {
  interface Window {
    __puzzgrindAnalyticsEnabled?: boolean;
  }
}

type AnalyticsProps = {
  environment: AppEnvironment;
  measurementId?: string;
};

export function Analytics({ environment, measurementId }: AnalyticsProps) {
  const enabled = isAnalyticsEnabled(environment, measurementId);

  useEffect(() => {
    window.__puzzgrindAnalyticsEnabled = enabled;
    console.info(analyticsDebugMessage(environment, enabled));

    return () => {
      window.__puzzgrindAnalyticsEnabled = false;
    };
  }, [enabled, environment]);

  return enabled && measurementId ? <GoogleAnalytics gaId={measurementId} /> : null;
}
