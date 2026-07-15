import { describe, expect, it } from "vitest";

import {
  DEFAULT_LEADERBOARD_NAME,
  LEADERBOARD_DISPLAY_NAME_KEY,
  loadLeaderboardDisplayName,
  normalizeDisplayName,
  saveLeaderboardDisplayName,
} from "@/lib/sudoku/leaderboard";

describe("leaderboard display names", () => {
  it("normalizes safe names and supports international letters", () => {
    expect(normalizeDisplayName("  Ada   42  ")).toEqual({ ok: true, value: "Ada 42" });
    expect(normalizeDisplayName("数独-玩家")).toEqual({ ok: true, value: "数独-玩家" });
  });

  it("rejects blank, markup, control characters, invalid length, and reserved names", () => {
    for (const value of [" ", "A", "a".repeat(17), "<b>Ada</b>", "Ada\nRoot", "PuzzGrind Support", "admin"]) {
      expect(normalizeDisplayName(value).ok).toBe(false);
    }
  });

  it("falls back when local storage is unavailable and never blocks play", () => {
    const unavailable = {
      getItem: () => { throw new Error("blocked"); },
      setItem: () => { throw new Error("blocked"); },
    };
    expect(loadLeaderboardDisplayName(unavailable)).toBe(DEFAULT_LEADERBOARD_NAME);
    expect(saveLeaderboardDisplayName(unavailable, "Ada 42")).toBe(false);
  });

  it("persists a normalized nickname locally", () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => { values.set(key, value); },
    };
    expect(saveLeaderboardDisplayName(storage, "  Ada   42 ")).toBe(true);
    expect(values.get(LEADERBOARD_DISPLAY_NAME_KEY)).toBe("Ada 42");
    expect(loadLeaderboardDisplayName(storage)).toBe("Ada 42");
  });
});
