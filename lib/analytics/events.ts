"use client";

import { sendGAEvent } from "@next/third-parties/google";

export type AnalyticsEventName =
  | "completion_feedback"
  | "hint_applied"
  | "hint_level_viewed"
  | "hint_opened"
  | "puzzle_completed"
  | "result_copied"
  | "result_shared"
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
  try {
    sendGAEvent("event", name, params);
    return true;
  } catch {
    return false;
  }
}

export function trackPageView(pageLocation?: string) {
  if (!canSendAnalytics()) return false;
  try {
    const location = pageLocation ?? window.location.href;
    sendGAEvent("event", "page_view", { page_location: location });
    return true;
  } catch {
    return false;
  }
}

export const sudokuAnalytics = {
  completionFeedback: (params?: AnalyticsEventParams) => trackEvent("completion_feedback", params),
  gameStarted: (params?: AnalyticsEventParams) => trackEvent("sudoku_game_started", params),
  hintApplied: (params?: AnalyticsEventParams) => trackEvent("hint_applied", params),
  hintLevelViewed: (params?: AnalyticsEventParams) => trackEvent("hint_level_viewed", params),
  hintOpened: (params?: AnalyticsEventParams) => trackEvent("hint_opened", params),
  completed: (params?: AnalyticsEventParams) => trackEvent("sudoku_completed", params),
  hintUsed: (params?: AnalyticsEventParams) => trackEvent("sudoku_hint_used", params),
  puzzleCompleted: (params?: AnalyticsEventParams) => trackEvent("puzzle_completed", params),
  resume: (params?: AnalyticsEventParams) => trackEvent("sudoku_resume", params),
  resultCopied: (params?: AnalyticsEventParams) => trackEvent("result_copied", params),
  resultShared: (params?: AnalyticsEventParams) => trackEvent("result_shared", params),
  share: (params?: AnalyticsEventParams) => trackEvent("sudoku_share", params),
} as const;
