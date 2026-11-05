import { describe, expect, it } from "vitest";
import { evaluateLexiGuess } from "@/lib/lexi/evaluation";
import { parseBoard } from "@/lib/sudoku/board";
import { candidatesFor } from "@/lib/sudoku/candidates";

describe("Sudoku and Lexi guide examples", () => {
  it("finds the stated 9×9 Sudoku candidate in the illustrative board", () => {
    const board = parseBoard("530678902672195348198342567859761423426853791713924856961537284287419635345286179");
    expect(candidatesFor(board, 2)).toEqual([4]);
    expect(candidatesFor(board, 7)).toEqual([1]);
  });
  it("matches the repeated-letter feedback shown in the Lexi guide", () => {
    expect(evaluateLexiGuess("level", "eerie")).toEqual(["present", "correct", "absent", "absent", "absent"]);
  });
});
