import { describe, expect, it } from "vitest";
import { candidates, conflicts, countSolutions, hint, isSolved } from "@/lib/mini-sudoku/game";
import { puzzles } from "@/lib/mini-sudoku/puzzles";

describe("6×6 Sudoku", () => {
  it("validates every distinct practice puzzle as uniquely solvable", () => {
    expect(puzzles).toHaveLength(30);
    expect(new Set(puzzles.map((puzzle) => puzzle.join(","))).size).toBe(30);
    for (const puzzle of puzzles) expect(countSolutions(puzzle)).toBe(1);
  });
  it("detects duplicates in a 2×3 box and refuses inconsistent hints", () => {
    const board = [1,0,0,0,0,0,0,1,...Array(28).fill(0)];
    expect(conflicts(board)).toEqual(expect.arrayContaining([0,7]));
    expect(hint(board)).toBeNull();
  });
  it("identifies a provable single and recognizes a complete valid board", () => {
    const solution = [1,2,3,4,5,6,4,5,6,1,2,3,2,3,4,5,6,1,5,6,1,2,3,4,3,4,5,6,1,2,6,1,2,3,4,5];
    const board = [...solution]; board[0] = 0;
    expect(candidates(board, 0)).toEqual([1]);
    expect(hint(board)).toEqual({ index: 0, value: 1 });
    expect(isSolved(solution, board)).toBe(true);
    const altered = [...solution]; altered[1] = 1;
    expect(isSolved(altered, board)).toBe(false);
  });
  it("rejects impossible boards and ignores malformed values", () => {
    expect(countSolutions(Array(36).fill(1))).toBe(0);
    expect(countSolutions(Array(36).fill(0))).toBe(2);
    expect(hint([9,...Array(35).fill(0)])).toBeNull();
  });
});
