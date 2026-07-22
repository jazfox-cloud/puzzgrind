import { beforeEach, describe, expect, it, vi } from "vitest";

const { sendGAEvent } = vi.hoisted(() => ({ sendGAEvent: vi.fn() }));

vi.mock("@next/third-parties/google", () => ({ sendGAEvent }));

import { lexiAnalytics, sudokuAnalytics, trackEvent, trackHomeGameSelect, trackPageView } from "@/lib/analytics/events";

describe("analytics event API", () => {
  beforeEach(() => {
    sendGAEvent.mockReset();
    window.__puzzgrindAnalyticsEnabled = false;
  });

  it("does not send page views or events while Analytics is disabled", () => {
    expect(trackPageView("https://puzzgrind.com/sudoku")).toBe(false);
    expect(trackEvent("sudoku_game_started")).toBe(false);
    expect(sudokuAnalytics.leaderboardViewed()).toBe(false);
    expect(sudokuAnalytics.leaderboardSubmitted({ rank: 1 })).toBe(false);
    expect(sendGAEvent).not.toHaveBeenCalled();
  });

  it("sends an explicit page_view through the centralized API when enabled", () => {
    window.__puzzgrindAnalyticsEnabled = true;
    expect(trackPageView("https://puzzgrind.com/sudoku")).toBe(true);
    expect(sendGAEvent).toHaveBeenCalledWith("event", "page_view", {
      page_location: "https://puzzgrind.com/sudoku",
    });
  });

  it("exposes the engagement-loop event helpers", () => {
    window.__puzzgrindAnalyticsEnabled = true;
    sudokuAnalytics.hintOpened({ technique: "hidden_single" });
    sudokuAnalytics.hintLevelViewed({ hint_level: 2 });
    sudokuAnalytics.hintApplied({ technique: "hidden_single" });
    sudokuAnalytics.puzzleCompleted({ elapsed_seconds: 300 });
    sudokuAnalytics.resultShared();
    sudokuAnalytics.resultCopied();
    sudokuAnalytics.completionFeedback({ rating: "just_right" });
    sudokuAnalytics.leaderboardViewed();
    sudokuAnalytics.leaderboardJoinStarted();
    sudokuAnalytics.leaderboardSubmitted({ rank: 3 });
    sudokuAnalytics.leaderboardSubmitFailed({ reason: "request_failed" });

    expect(sendGAEvent.mock.calls.map((call) => call[1])).toEqual([
      "hint_opened",
      "hint_level_viewed",
      "hint_applied",
      "puzzle_completed",
      "result_shared",
      "result_copied",
      "completion_feedback",
      "leaderboard_viewed",
      "leaderboard_join_started",
      "leaderboard_submitted",
      "leaderboard_submit_failed",
    ]);
  });

  it("contains analytics failures", () => {
    window.__puzzgrindAnalyticsEnabled = true;
    sendGAEvent.mockImplementation(() => { throw new Error("GA unavailable"); });
    expect(sudokuAnalytics.hintOpened()).toBe(false);
  });

  it("sends only aggregate Lexi fields", () => {
    window.__puzzgrindAnalyticsEnabled = true;
    lexiAnalytics.guessSubmit(2);
    lexiAnalytics.hintUse(2);
    lexiAnalytics.gameComplete(3, 1, 42);
    lexiAnalytics.share("clipboard");
    trackHomeGameSelect("lexi_daily");
    expect(sendGAEvent.mock.calls).toEqual([
      ["event", "lexi_guess_submit", { attempt: 2 }],
      ["event", "lexi_hint_use", { attempt: 2 }],
      ["event", "lexi_game_complete", { attempts: 3, hints: 1, duration_seconds: 42 }],
      ["event", "lexi_share", { method: "clipboard" }],
      ["event", "home_game_select", { game_id: "lexi_daily" }],
    ]);
    expect(JSON.stringify(sendGAEvent.mock.calls.map((call) => call[2]))).not.toMatch(/token|answer|guess|nickname|session_id|anonymous/i);
  });
});
