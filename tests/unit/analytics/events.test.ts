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

  it("exposes the five typed Sudoku event helpers", () => {
    window.__puzzgrindAnalyticsEnabled = true;
    sudokuAnalytics.gameStarted();
    sudokuAnalytics.completed({ elapsed_seconds: 300 });
    sudokuAnalytics.hintUsed({ hint_level: 2 });
    sudokuAnalytics.resume();
    sudokuAnalytics.share();

    expect(sendGAEvent.mock.calls.map((call) => call[1])).toEqual([
      "sudoku_game_started",
      "sudoku_completed",
      "sudoku_hint_used",
      "sudoku_resume",
      "sudoku_share",
    ]);
  });
});
