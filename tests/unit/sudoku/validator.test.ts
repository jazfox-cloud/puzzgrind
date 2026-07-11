import { describe, expect, it } from "vitest";

import {
  InvalidBoardError,
  findConflicts,
  findGivenViolations,
  isCompleteValidBoard,
  parseBoard,
  serializeBoard,
  withCell,
} from "@/lib/sudoku";

const solved = "534678912672195348198342567859761423426853791713924856961537284287419635345286179";

describe("Sudoku board and validator", () => {
  it("round-trips a valid 81-cell board", () => {
    expect(serializeBoard(parseBoard(solved))).toBe(solved);
  });

  it("rejects invalid board strings", () => {
    expect(() => parseBoard("0".repeat(80))).toThrow(InvalidBoardError);
    expect(() => parseBoard(`${"0".repeat(80)}x`)).toThrow("digits from 0 to 9");
  });

  it.each([
    ["row", 1],
    ["column", 9],
    ["box", 10],
  ] as const)("detects a %s conflict", (kind, target) => {
    const board = withCell(withCell(parseBoard("0".repeat(81)), 0, 5), target, 5);
    expect(findConflicts(board)).toEqual(expect.arrayContaining([expect.objectContaining({ kind, value: 5 })]));
  });

  it("protects givens without mutating the board", () => {
    const givens = parseBoard(`5${"0".repeat(80)}`);
    const board = withCell(givens, 0, 4);
    expect(findGivenViolations(givens, board)).toEqual([{ actual: 4, expected: 5, index: 0 }]);
    expect(givens[0]).toBe(5);
  });

  it("accepts only complete conflict-free boards", () => {
    expect(isCompleteValidBoard(parseBoard(solved))).toBe(true);
    expect(isCompleteValidBoard(parseBoard(`0${solved.slice(1)}`))).toBe(false);
  });
});
