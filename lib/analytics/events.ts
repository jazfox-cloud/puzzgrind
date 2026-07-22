"use client";

import { sendGAEvent } from "@next/third-parties/google";

export type AnalyticsEventName =
  | "completion_feedback"
  | "hint_applied"
  | "hint_level_viewed"
  | "hint_opened"
  | "leaderboard_join_started"
  | "leaderboard_submit_failed"
  | "leaderboard_submitted"
  | "leaderboard_viewed"
  | "puzzle_completed"
  | "result_copied"
  | "result_shared"
  | "sudoku_game_started"
  | "sudoku_completed"
  | "sudoku_hint_used"
  | "sudoku_resume"
  | "sudoku_share"
  | "home_game_select"
  | "lexi_game_start"
  | "lexi_guess_submit"
  | "lexi_hint_use"
  | "lexi_game_complete"
  | "lexi_game_fail"
  | "lexi_share"
  | "lexi_leaderboard_view";

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
  leaderboardJoinStarted: (params?: AnalyticsEventParams) => trackEvent("leaderboard_join_started", params),
  leaderboardSubmitFailed: (params?: AnalyticsEventParams) => trackEvent("leaderboard_submit_failed", params),
  leaderboardSubmitted: (params?: AnalyticsEventParams) => trackEvent("leaderboard_submitted", params),
  leaderboardViewed: (params?: AnalyticsEventParams) => trackEvent("leaderboard_viewed", params),
  completed: (params?: AnalyticsEventParams) => trackEvent("sudoku_completed", params),
  hintUsed: (params?: AnalyticsEventParams) => trackEvent("sudoku_hint_used", params),
  puzzleCompleted: (params?: AnalyticsEventParams) => trackEvent("puzzle_completed", params),
  resume: (params?: AnalyticsEventParams) => trackEvent("sudoku_resume", params),
  resultCopied: (params?: AnalyticsEventParams) => trackEvent("result_copied", params),
  resultShared: (params?: AnalyticsEventParams) => trackEvent("result_shared", params),
  share: (params?: AnalyticsEventParams) => trackEvent("sudoku_share", params),
} as const;

// The Lexi helpers intentionally expose only aggregate, non-content fields.
export const lexiAnalytics = {
  gameStart: () => trackEvent("lexi_game_start"),
  guessSubmit: (attempt: number) => trackEvent("lexi_guess_submit", { attempt }),
  hintUse: (attempt: number) => trackEvent("lexi_hint_use", { attempt }),
  gameComplete: (attempts: number, hints: number, durationSeconds: number) =>
    trackEvent("lexi_game_complete", { attempts, hints, duration_seconds: durationSeconds }),
  gameFail: (hints: number) => trackEvent("lexi_game_fail", { hints }),
  share: (method: "clipboard" | "web_share") => trackEvent("lexi_share", { method }),
  leaderboardView: (limit: 10 | 20) => trackEvent("lexi_leaderboard_view", { limit }),
} as const;

export function trackHomeGameSelect(gameId: "lexi_daily" | "sudoku") {
  return trackEvent("home_game_select", { game_id: gameId });
}
