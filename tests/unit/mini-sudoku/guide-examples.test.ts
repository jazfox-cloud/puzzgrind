import { describe, expect, it } from "vitest";
import { candidates, conflicts } from "@/lib/mini-sudoku/game";
import { puzzles } from "@/lib/mini-sudoku/puzzles";

describe("Mini Sudoku guide examples", () => {
  it("matches the printed first puzzle and proves its single candidate", () => {
    expect(puzzles[0]).toEqual([5,0,3,0,0,0,4,0,2,3,1,0,1,2,0,5,3,0,6,0,0,4,0,1,0,0,0,0,4,3,0,4,1,6,5,0]);
    expect(candidates(puzzles[0], 3)).toEqual([2]);
  });
  it("detects the row and box-only conflicts used by the guide", () => {
    const row = [...puzzles[0]]; row[1] = 5;
    expect(conflicts(row)).toContain(1); expect(conflicts(row)).toContain(0);
    const box = [...puzzles[0]]; box[3] = 1;
    expect(box.slice(0, 6).filter((n) => n === 1)).toHaveLength(1);
    expect(Array.from({ length: 6 }, (_, r) => box[r * 6 + 3]).filter((n) => n === 1)).toHaveLength(1);
    expect(conflicts(box)).toContain(3); expect(conflicts(box)).toContain(10);
  });
});
