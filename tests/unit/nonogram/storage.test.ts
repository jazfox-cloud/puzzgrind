import { describe, expect, it } from "vitest";

import { puzzleForDate } from "@/lib/nonogram/calendar";
import { createState, paintCell, tick } from "@/lib/nonogram/game";
import { FIVE_BY_FIVE } from "@/lib/nonogram/puzzles";
import { NONOGRAM_SAVE_KEY, loadNonogram, loadPreferredSize, parsePuzzleSave, saveNonogram } from "@/lib/nonogram/storage";

function memory() {
  const values = new Map<string, string>();
  return { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => void values.set(key, value), values };
}

describe("Nonogram local progress", () => {
  it("saves and restores one puzzle without storing the solution", () => {
    const storage = memory();
    const puzzle = FIVE_BY_FIVE[0]!;
    const state = tick(paintCell(createState(puzzle.solution.length), 0, "fill", puzzle.solution));
    saveNonogram(storage, puzzle.id, state, 10);
    expect(storage.values.get(NONOGRAM_SAVE_KEY)).not.toContain("solution");
    expect(loadPreferredSize(storage)).toBe(10);
    expect(loadNonogram(storage, puzzle.id, puzzle.solution)).toEqual(state);
  });

  it("keeps another day's puzzle when today's progress is replaced", () => {
    const storage = memory();
    const today = puzzleForDate(5, "2026-07-14");
    const tomorrow = puzzleForDate(5, "2026-07-15");
    expect(today.id).not.toBe(tomorrow.id);
    const todayState = paintCell(createState(today.solution.length), 0, "cross", today.solution);
    saveNonogram(storage, today.id, todayState, 5);
    const tomorrowState = paintCell(createState(tomorrow.solution.length), 1, "fill", tomorrow.solution);
    saveNonogram(storage, tomorrow.id, tomorrowState, 5);
    expect(loadNonogram(storage, today.id, today.solution)?.cells[0]).toBe("cross");
    expect(loadNonogram(storage, tomorrow.id, tomorrow.solution)?.cells[1]).toBe("fill");
    expect(loadNonogram(storage, "missing", today.solution)).toBeNull();
  });

  it("rejects corrupt progress and recomputes completion from the cells", () => {
    const solution = [1, 0];
    expect(parsePuzzleSave(null, solution)).toBeNull();
    expect(parsePuzzleSave({ cells: ["fill"], history: [], future: [], tool: "fill", seconds: 1, completed: true }, solution)).toBeNull();
    expect(parsePuzzleSave({ cells: ["nope", "empty"], history: [], future: [], tool: "fill", seconds: 1, completed: false }, solution)).toBeNull();
    const completed = parsePuzzleSave({ cells: ["fill", "empty"], history: [], future: [], tool: "fill", seconds: 4, completed: false }, solution);
    expect(completed?.completed).toBe(true);
    const unfinished = parsePuzzleSave({ cells: ["empty", "empty"], history: [], future: [], tool: "cross", seconds: 4, completed: true }, solution);
    expect(unfinished?.completed).toBe(false);
    const storage = memory();
    storage.setItem(NONOGRAM_SAVE_KEY, "{");
    expect(loadNonogram(storage, "any", solution)).toBeNull();
    expect(loadPreferredSize(storage)).toBe(5);
  });
});
