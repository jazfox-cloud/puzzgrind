import { describe, expect, it } from "vitest";

import { NONOGRAM_EPOCH, puzzleForDate, utcDayNumber } from "@/lib/nonogram/calendar";
import { utcDate } from "@/lib/daily/utc";
import { bankFor } from "@/lib/nonogram/calendar";

describe("Daily Nonogram calendar", () => {
  it("uses the UTC date and rotates from the published epoch", () => {
    expect(NONOGRAM_EPOCH).toBe("2026-01-01");
    expect(utcDayNumber("2026-01-01")).toBe(0);
    expect(utcDayNumber("2026-01-02")).toBe(1);
    expect(utcDate(new Date("2026-07-14T23:59:59.000Z"))).toBe("2026-07-14");
    expect(utcDate(new Date("2026-07-15T00:00:00.000Z"))).toBe("2026-07-15");
    expect(utcDate(new Date("2026-07-15T00:30:00.000+09:00"))).toBe("2026-07-14");
    const length = bankFor(5).length;
    expect(puzzleForDate(5, "2026-01-01").id).toBe(bankFor(5)[0]?.id);
    expect(puzzleForDate(5, "2026-01-02").id).toBe(bankFor(5)[1]?.id);
    const repeat = new Date(Date.parse("2026-01-01T00:00:00.000Z") + length * 86_400_000).toISOString().slice(0, 10);
    expect(puzzleForDate(5, repeat).id).toBe(puzzleForDate(5, "2026-01-01").id);
    expect(puzzleForDate(10, "2026-01-01").size).toBe(10);
    expect(puzzleForDate(5, "2025-12-31").id).toBe(bankFor(5).at(-1)?.id);
  });
});
