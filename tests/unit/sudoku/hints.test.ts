import { describe, expect, it } from "vitest";

import { explainStep } from "@/lib/sudoku/hints";

const step = { technique: "hidden_single", candidate: 7, targetCells: [48], relatedCells: [45, 46, 47] } as const;

describe("explainable hints", () => {
  it("reveals progressively more information without a full solution", () => {
    const level1 = explainStep(step, 1);
    const level2 = explainStep(step, 2);
    const level3 = explainStep(step, 3);
    expect(level1.explanation).toContain("row 6, column 4");
    expect(level2.explanation).toContain("only one possible position");
    expect(level3.explanation).toContain("Enter 7");
    expect(JSON.stringify([level1, level2, level3])).not.toContain("solution");
  });
});
