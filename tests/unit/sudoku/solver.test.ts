import { describe, expect, it } from "vitest";

import { parseBoard, serializeBoard, solveBoard } from "@/lib/sudoku";

const puzzle = "530070000600195000098000060800060003400803001700020006060000280000419005000080079";
const solution = "534678912672195348198342567859761423426853791713924856961537284287419635345286179";

describe("Sudoku solver", () => {
  it("solves a representative unique puzzle without mutating it", () => {
    const board = parseBoard(puzzle);
    const result = solveBoard(board);
    expect(result.status).toBe("unique");
    expect(result.solution ? serializeBoard(result.solution) : null).toBe(solution);
    expect(serializeBoard(board)).toBe(puzzle);
  });

  it("rejects a conflicting board", () => {
    const result = solveBoard(parseBoard(`55${"0".repeat(79)}`));
    expect(result).toEqual({ status: "invalid", solution: null, solutionCount: 0 });
  });

  it("detects multiple solutions and stops after two", () => {
    const result = solveBoard(parseBoard("0".repeat(81)));
    expect(result.status).toBe("multiple");
    expect(result.solutionCount).toBe(2);
  });
});
