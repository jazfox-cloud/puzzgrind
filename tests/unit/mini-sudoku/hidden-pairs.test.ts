import { expect, it } from "vitest";
import { candidates } from "@/lib/mini-sudoku/game";
import { puzzles } from "@/lib/mini-sudoku/puzzles";

it("verifies the hidden pair in the guide's second practice puzzle", () => {
  const row = [12, 13, 14, 15, 16, 17];
  expect([13, 14, 16, 17].map((index) => candidates(puzzles[1], index))).toEqual([[2, 4, 5], [2, 4, 5], [5], [5, 6]]);
  for (const number of [2, 4]) {
    expect(row.filter((index) => candidates(puzzles[1], index).includes(number))).toEqual([13, 14]);
  }
});
