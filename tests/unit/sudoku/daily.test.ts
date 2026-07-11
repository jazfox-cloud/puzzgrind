import { describe, expect, it } from "vitest";

import { readDailyPuzzle, utcDate } from "@/lib/sudoku/daily";
import { FakeD1Database } from "../db/fake-d1";

describe("Daily Sudoku", () => {
  it("uses UTC and returns only public puzzle fields", async () => {
    expect(utcDate(new Date("2026-07-11T23:30:00-07:00"))).toBe("2026-07-12");
    const db = new FakeD1Database();
    db.queueFirst({ id: "p1", puzzle_date: "2026-07-12", difficulty: "medium", givens: "0".repeat(81) });
    const result = await readDailyPuzzle(db, "2026-07-12");
    expect(result).toEqual({
      puzzleId: "p1",
      puzzleDate: "2026-07-12",
      difficulty: "medium",
      givens: "0".repeat(81),
      expiresAt: "2026-07-13T00:00:00.000Z",
      boardSize: 9,
    });
    expect(result).not.toHaveProperty("solution");
    expect(db.statements[0].bindings).toEqual(["2026-07-12"]);
  });
});
