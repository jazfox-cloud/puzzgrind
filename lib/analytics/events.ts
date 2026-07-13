"use client";

import { sendGAEvent } from "@next/third-parties/google";

export type AnalyticsEventName =
  | "sudoku_game_started"
  | "sudoku_completed"
  | "sudoku_hint_used"
  | "sudoku_resume"
  | "sudoku_share";

export type AnalyticsEventParams = Record<string, boolean | number | string | undefined>;

function canSendAnalytics() {
  return typeof window !== "undefined" && window.__puzzgrindAnalyticsEnabled === true;
}

export function trackEvent(name: AnalyticsEventName, params: AnalyticsEventParams = {}) {
  if (!canSendAnalytics()) return false;
  sendGAEvent("event", name, params);
  return true;
}

export function trackPageView(pageLocation?: string) {
  if (!canSendAnalytics()) return false;
  const location = pageLocation ?? window.location.href;
  sendGAEvent("event", "page_view", { page_location: location });
  return true;
}

export const sudokuAnalytics = {
  gameStarted: (params?: AnalyticsEventParams) => trackEvent("sudoku_game_started", params),
  completed: (params?: AnalyticsEventParams) => trackEvent("sudoku_completed", params),
  hintUsed: (params?: AnalyticsEventParams) => trackEvent("sudoku_hint_used", params),
  resume: (params?: AnalyticsEventParams) => trackEvent("sudoku_resume", params),
  share: (params?: AnalyticsEventParams) => trackEvent("sudoku_share", params),
} as const;
