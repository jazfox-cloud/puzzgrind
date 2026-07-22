import { describe, expect, it } from "vitest";

import {
  buildLexiShareText,
  EMPTY_LEXI_STATS,
  evaluateLexiGuess,
  recordLexiCompletion,
} from "@/lib/lexi";

describe("Lexi sharing and streaks", () => {
  it("shares only result squares and metrics, never answers or guesses", () => {
    const text = buildLexiShareText({
      durationSeconds: 137,
      guesses: [
        { evaluation: evaluateLexiGuess("level", "crane") },
        { evaluation: evaluateLexiGuess("level", "level") },
      ],
      hintsUsed: 1,
      puzzleDate: "2026-07-22",
      status: "won",
    });
    expect(text).toContain("Solved: 2 of 6 · Hint: 1 · Time: 02:17");
    expect(text).toContain("🟦");
    expect(text).not.toContain("level");
    expect(text).not.toContain("crane");
  });

  it("counts one completion per puzzle and resets or extends UTC streaks", () => {
    const dayOne = recordLexiCompletion(EMPTY_LEXI_STATS, { puzzleDate: "2026-07-22", puzzleId: "p1" });
    expect(dayOne.stats.currentStreak).toBe(1);
    expect(recordLexiCompletion(dayOne.stats, { puzzleDate: "2026-07-22", puzzleId: "p1" }).counted).toBe(false);
    const dayTwo = recordLexiCompletion(dayOne.stats, { puzzleDate: "2026-07-23", puzzleId: "p2" });
    expect(dayTwo.stats.currentStreak).toBe(2);
    const gap = recordLexiCompletion(dayTwo.stats, { puzzleDate: "2026-07-25", puzzleId: "p3" });
    expect(gap.stats.currentStreak).toBe(1);
    expect(gap.stats.bestStreak).toBe(2);
  });
});
