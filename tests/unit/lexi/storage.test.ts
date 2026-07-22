import { describe, expect, it } from "vitest";
import { LEXI_SAVE_KEY, loadSavedLexiGame, parseSavedLexiGame, saveLexiGame } from "@/lib/lexi/storage";
import type { SavedLexiGame } from "@/lib/lexi/storage";
import { EMPTY_LEXI_STATS } from "@/lib/lexi/streak";

const saved: SavedLexiGame = { version: 1, puzzleId: "today", puzzleDate: "2026-07-22", token: "opaque-token",
  revision: 1, guesses: [{ guess: "level", evaluation: ["correct", "absent", "present", "absent", "correct"] }],
  hintCount: 0 as const, hintLetter: null, status: "in_progress" as const, stats: EMPTY_LEXI_STATS, displayName: "Player" };

describe("Lexi local storage", () => {
  it("round trips the versioned UI state without an answer or word list", () => {
    const values = new Map<string, string>();
    const storage = { getItem: (key: string) => values.get(key) ?? null, removeItem: (key: string) => void values.delete(key), setItem: (key: string, value: string) => void values.set(key, value) };
    saveLexiGame(storage, saved);
    expect(loadSavedLexiGame(storage, "today")).toEqual(saved);
    expect(values.get(LEXI_SAVE_KEY)).not.toContain("answer");
  });

  it("rejects old, corrupt, and cross-puzzle state", () => {
    expect(parseSavedLexiGame("not-json", "today")).toBeNull();
    expect(parseSavedLexiGame(JSON.stringify({ ...saved, version: 0 }), "today")).toBeNull();
    expect(parseSavedLexiGame(JSON.stringify(saved), "tomorrow")).toBeNull();
    expect(parseSavedLexiGame(JSON.stringify({ ...saved, guesses: [{ guess: "LEVEL", evaluation: [] }] }), "today")).toBeNull();
  });
});
