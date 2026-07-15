import { describe, expect, it, vi } from "vitest";

import {
  ENGAGEMENT_STORAGE_KEY,
  buildResultShareText,
  copyResultText,
  loadLocalSudokuStats,
  recordCompletionFeedback,
  recordLocalCompletion,
  secondsUntilNextUtcMidnight,
  shareResultText,
} from "@/lib/sudoku/engagement";

function memoryStorage(initial?: string) {
  const values = new Map<string, string>();
  if (initial) values.set(ENGAGEMENT_STORAGE_KEY, initial);
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    values,
  };
}

describe("Sudoku engagement loop", () => {
  it("continues, deduplicates, and resets UTC-date streaks", () => {
    const storage = memoryStorage();
    const first = recordLocalCompletion(storage, { puzzleId: "p1", puzzleDate: "2026-07-14", completionTime: 522, hintsUsed: 1 });
    expect(first.stats).toMatchObject({ puzzlesCompleted: 1, currentStreak: 1, bestStreak: 1 });
    const duplicate = recordLocalCompletion(storage, { puzzleId: "p1", puzzleDate: "2026-07-14", completionTime: 600, hintsUsed: 2 });
    expect(duplicate.counted).toBe(false);
    expect(duplicate.stats).toMatchObject({ puzzlesCompleted: 1, completionTime: 522, hintsUsed: 1 });
    const next = recordLocalCompletion(storage, { puzzleId: "p2", puzzleDate: "2026-07-15", completionTime: 400, hintsUsed: 0 });
    expect(next.stats).toMatchObject({ puzzlesCompleted: 2, currentStreak: 2, bestStreak: 2 });
    const reset = recordLocalCompletion(storage, { puzzleId: "p4", puzzleDate: "2026-07-17", completionTime: 300, hintsUsed: 3 });
    expect(reset.stats).toMatchObject({ puzzlesCompleted: 3, currentStreak: 1, bestStreak: 2 });
  });

  it("uses the UTC midnight boundary", () => {
    expect(secondsUntilNextUtcMidnight(new Date("2026-07-14T23:59:58.900Z"))).toBe(1);
    expect(secondsUntilNextUtcMidnight(new Date("2026-07-14T00:00:00.000Z"))).toBe(86_400);
  });

  it("survives unavailable local storage", () => {
    const storage = {
      getItem: () => { throw new Error("blocked"); },
      setItem: () => { throw new Error("blocked"); },
    };
    expect(loadLocalSudokuStats(storage)).toMatchObject({ puzzlesCompleted: 0, currentStreak: 0 });
    const result = recordLocalCompletion(storage, { puzzleId: "p1", puzzleDate: "2026-07-14", completionTime: 1, hintsUsed: 0 });
    expect(result.persisted).toBe(false);
    expect(result.stats.currentStreak).toBe(1);
  });

  it("stores one feedback value per puzzle and allows changing it", () => {
    const storage = memoryStorage();
    expect(recordCompletionFeedback(storage, "p1", "too_easy").firstSelection).toBe(true);
    const changed = recordCompletionFeedback(storage, "p1", "just_right");
    expect(changed.firstSelection).toBe(false);
    expect(changed.stats.feedbackByPuzzleId.p1).toBe("just_right");
  });

  it("builds an answer-free result message", () => {
    const text = buildResultShareText({ durationSeconds: 522, hintsUsed: 1, currentStreak: 3 });
    expect(text).toBe("PuzzGrind Daily Sudoku\nSolved in 08:42\nHints used: 1\n🔥 3 day streak\n\nCan you solve today’s puzzle?\nhttps://puzzgrind.com/sudoku");
    expect(text).not.toMatch(/R\dC\d|solution|board/iu);
  });

  it("handles Web Share success, cancellation, failure fallback, and direct copy", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    expect(await shareResultText({ share: vi.fn().mockResolvedValue(undefined), clipboard: { writeText } }, "result")).toBe("shared");
    expect(writeText).not.toHaveBeenCalled();
    expect(await shareResultText({ share: vi.fn().mockRejectedValue(new DOMException("canceled", "AbortError")), clipboard: { writeText } }, "result")).toBe("canceled");
    expect(await shareResultText({ share: vi.fn().mockRejectedValue(new Error("failed")), clipboard: { writeText } }, "result")).toBe("copied");
    expect(await shareResultText({ clipboard: { writeText } }, "result")).toBe("copied");
    expect(await copyResultText({ clipboard: { writeText } }, "result")).toBe("copied");
    expect(await copyResultText({}, "result")).toBe("failed");
  });
});
