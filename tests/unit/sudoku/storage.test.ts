import { describe, expect, it } from "vitest";

import {
  ANONYMOUS_ID_KEY,
  GAME_SAVE_VERSION,
  ONBOARDING_STORAGE_KEY,
  gameSaveKey,
  getOrCreateAnonymousId,
  hasSeenOnboarding,
  loadSavedGame,
  markOnboardingSeen,
  saveGame,
  parseSavedGame,
} from "@/lib/sudoku/storage";
import type { SavedGame } from "@/lib/sudoku/storage";

const givens = `5${"0".repeat(80)}`;
const validSave: SavedGame = {
  version: GAME_SAVE_VERSION,
  puzzleId: "p1",
  values: [5, ...Array<number>(80).fill(0)],
  notes: Array.from({ length: 81 }, () => [] as number[]),
  selected: 1,
  seconds: 42,
  paused: false,
  noteMode: true,
  mistakes: 0,
  hintCount: 0,
  maxHintLevel: 0,
  history: [],
  future: [],
  savedAt: 100,
  completedResult: null,
};

describe("Sudoku local storage", () => {
  it("isolates saves by puzzle id and restores valid state", () => {
    expect(gameSaveKey("p1")).not.toBe(gameSaveKey("p2"));
    expect(parseSavedGame(JSON.stringify(validSave), "p1", givens)).toMatchObject({ seconds: 42, noteMode: true });
  });

  it("restores a locally verified completion result", () => {
    const completed = { ...validSave, completedResult: { durationSeconds: 522, hintCount: 1, maxHintLevel: 2, mistakes: 0 } };
    expect(parseSavedGame(JSON.stringify(completed), "p1", givens)?.completedResult).toEqual(completed.completedResult);
  });

  it("rejects malformed, stale, and given-altering saves", () => {
    expect(parseSavedGame("not json", "p1", givens)).toBeNull();
    expect(parseSavedGame(JSON.stringify(validSave), "p2", givens)).toBeNull();
    expect(parseSavedGame(JSON.stringify({ ...validSave, values: Array<number>(81).fill(0) }), "p1", givens)).toBeNull();
  });

  it("reuses a valid anonymous UUID and replaces invalid data", () => {
    const values = new Map<string, string>([[ANONYMOUS_ID_KEY, "bad-id"]]);
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      removeItem: (key: string) => values.delete(key),
    };
    const uuid = "123e4567-e89b-42d3-a456-426614174000";
    expect(getOrCreateAnonymousId(storage, () => uuid)).toBe(uuid);
    expect(getOrCreateAnonymousId(storage, () => "never-used")).toBe(uuid);
  });

  it("records the first-visit guide without coupling it to game progress", () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      removeItem: (key: string) => values.delete(key),
    };
    expect(hasSeenOnboarding(storage)).toBe(false);
    markOnboardingSeen(storage);
    expect(values.get(ONBOARDING_STORAGE_KEY)).toBe("true");
    expect(hasSeenOnboarding(storage)).toBe(true);
  });

  it("keeps the game usable when browser storage is blocked", () => {
    const blockedStorage = {
      getItem: () => { throw new Error("blocked"); },
      setItem: () => { throw new Error("blocked"); },
      removeItem: () => { throw new Error("blocked"); },
    };
    expect(loadSavedGame(blockedStorage, "p1", givens)).toBeNull();
    expect(() => saveGame(blockedStorage, validSave)).not.toThrow();
    expect(() => markOnboardingSeen(blockedStorage)).not.toThrow();
    expect(getOrCreateAnonymousId(blockedStorage, () => "123e4567-e89b-42d3-a456-426614174000"))
      .toBe("123e4567-e89b-42d3-a456-426614174000");
  });
});
