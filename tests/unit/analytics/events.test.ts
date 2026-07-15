import { beforeEach, describe, expect, it, vi } from "vitest";

const { sendGAEvent } = vi.hoisted(() => ({ sendGAEvent: vi.fn() }));

vi.mock("@next/third-parties/google", () => ({ sendGAEvent }));

import { sudokuAnalytics, trackEvent, trackPageView } from "@/lib/analytics/events";

describe("analytics event API", () => {
  beforeEach(() => {
    sendGAEvent.mockReset();
    window.__puzzgrindAnalyticsEnabled = false;
  });

  it("does not send page views or events while Analytics is disabled", () => {
    expect(trackPageView("https://puzzgrind.com/sudoku")).toBe(false);
    expect(trackEvent("sudoku_game_started")).toBe(false);
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

    expect(sendGAEvent.mock.calls.map((call) => call[1])).toEqual([
      "hint_opened",
      "hint_level_viewed",
      "hint_applied",
      "puzzle_completed",
      "result_shared",
      "result_copied",
      "completion_feedback",
    ]);
  });

  it("contains analytics failures", () => {
    window.__puzzgrindAnalyticsEnabled = true;
    sendGAEvent.mockImplementation(() => { throw new Error("GA unavailable"); });
    expect(sudokuAnalytics.hintOpened()).toBe(false);
  });
});
