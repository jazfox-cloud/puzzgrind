import { describe, expect, it } from "vitest";

import { isValidSudokuNotes } from "@/lib/security/notes";

const validNotes = () => Array.from({ length: 81 }, () => [] as number[]);

describe("Sudoku notes validation", () => {
  it("accepts exactly 81 valid candidate arrays", () => {
    const notes = validNotes();
    notes[0] = [1, 4, 9];
    expect(isValidSudokuNotes(notes)).toBe(true);
  });

  it.each([
    ["too few cells", validNotes().slice(0, 80)],
    ["too many cells", [...validNotes(), []]],
    ["non-array cell", Object.assign(validNotes(), { 0: null })],
    ["candidate below range", Object.assign(validNotes(), { 0: [0] })],
    ["candidate above range", Object.assign(validNotes(), { 0: [10] })],
    ["string candidate", Object.assign(validNotes(), { 0: ["1"] })],
    ["duplicate candidate", Object.assign(validNotes(), { 0: [1, 1] })],
    ["too many candidates", Object.assign(validNotes(), { 0: [1, 2, 3, 4, 5, 6, 7, 8, 9, 1] })],
    ["nested candidate", Object.assign(validNotes(), { 0: [[1]] })],
  ])("rejects %s", (_label, notes) => {
    expect(isValidSudokuNotes(notes)).toBe(false);
  });
});
