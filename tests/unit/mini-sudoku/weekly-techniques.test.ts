import { describe, expect, it } from "vitest";
import { candidates } from "@/lib/mini-sudoku/game";
import { puzzles } from "@/lib/mini-sudoku/puzzles";

describe("weekly Mini Sudoku guide examples", () => {
  it("verifies the column pair and the elimination in puzzle 2", () => {
    expect(candidates(puzzles[1], 1)).toEqual([1, 2]);
    expect(candidates(puzzles[1], 25)).toEqual([1, 2]);
    expect(candidates(puzzles[1], 31)).toEqual([1, 2, 5]);
    expect(candidates(puzzles[1], 31).filter((n) => !candidates(puzzles[1], 1).includes(n))).toEqual([5]);
  });

  it("verifies box-line elimination in puzzle 1", () => {
    const box = [0, 1, 2, 6, 7, 8];
    expect(box.filter((index) => candidates(puzzles[0], index).includes(6))).toEqual([1, 7]);
    expect(candidates(puzzles[0], 25)).toEqual([5, 6]);
    expect(candidates(puzzles[0], 25).filter((n) => n !== 6)).toEqual([5]);
  });
});
