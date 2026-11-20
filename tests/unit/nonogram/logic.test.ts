import { describe, expect, it } from "vitest";

import { FIVE_BY_FIVE, TEN_BY_TEN, type NonogramPuzzle } from "@/lib/nonogram/puzzles";
import { cluesForLine, cluesFromSolution, countSolutions, deduceLine, linePatterns, solveByLineLogic, solutionMatchesLineSolve } from "@/lib/nonogram/logic";

describe("Nonogram line logic", () => {
  it("builds clues and forces the classic overlap", () => {
    expect(cluesForLine([1, 1, 1, 0, 0])).toEqual([3]);
    expect(cluesForLine([1, 0, 1, 0, 1])).toEqual([1, 1, 1]);
    expect(cluesForLine([0, 0, 0, 0, 0])).toEqual([0]);
    expect(linePatterns(5, [3])).toEqual([0b00111, 0b01110, 0b11100]);
    expect(deduceLine(5, [3], [0, 0, 0, 0, 0]).cells[2]).toBe(1);
    expect(deduceLine(5, [4], [0, 0, 0, 0, 0]).cells).toEqual([0, 1, 1, 1, 0]);
  });

  it("rejects a line that cannot contain its clue", () => {
    expect(linePatterns(5, [3, 3])).toEqual([]);
    expect(deduceLine(5, [1], [1, 1, 0, 0, 0]).contradiction).toBe(true);
  });

  it("solves a plus and reports many solutions for every-row-one permutation clues", () => {
    const plus = [0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 1, 1, 1, 1, 1, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0];
    expect(solutionMatchesLineSolve(plus, 5)).toBe(true);
    const ones = Array.from({ length: 5 }, () => [1]);
    expect(solveByLineLogic(ones, ones).status).toBe("incomplete");
    expect(countSolutions(ones, ones, 2)).toBe(2);
  });
});

function expectReliable(puzzle: NonogramPuzzle) {
  expect(puzzle.solution).toHaveLength(puzzle.size * puzzle.size);
  expect(puzzle.solution.every((cell) => cell === 0 || cell === 1)).toBe(true);
  const derived = cluesFromSolution(puzzle.solution, puzzle.size);
  expect(puzzle.rows).toEqual(derived.rows);
  expect(puzzle.columns).toEqual(derived.columns);
  expect(solutionMatchesLineSolve(puzzle.solution, puzzle.size)).toBe(true);
  expect(countSolutions(puzzle.rows, puzzle.columns, 2)).toBe(1);
}

describe("published Nonogram bank", () => {
  it("checks every 5×5 and 10×10 picture for clue agreement, line logic, and one solution", () => {
    expect(FIVE_BY_FIVE.length).toBeGreaterThanOrEqual(8);
    expect(TEN_BY_TEN.length).toBeGreaterThanOrEqual(8);
    for (const puzzle of [...FIVE_BY_FIVE, ...TEN_BY_TEN]) expectReliable(puzzle);
    expect(new Set(FIVE_BY_FIVE.map((puzzle) => puzzle.id)).size).toBe(FIVE_BY_FIVE.length);
    expect(new Set(TEN_BY_TEN.map((puzzle) => puzzle.id)).size).toBe(TEN_BY_TEN.length);
    expect(new Set(FIVE_BY_FIVE.map((puzzle) => puzzle.solution.join(""))).size).toBe(FIVE_BY_FIVE.length);
    expect(new Set(TEN_BY_TEN.map((puzzle) => puzzle.solution.join(""))).size).toBe(TEN_BY_TEN.length);
  });
});
