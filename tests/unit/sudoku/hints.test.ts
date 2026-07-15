import { describe, expect, it } from "vitest";

import { explainStep, hintHighlightCells } from "@/lib/sudoku/hints";

const step = { technique: "hidden_single", candidate: 7, targetCells: [32], relatedCells: [27, 28, 29, 30, 31, 33, 34, 35] } as const;

describe("explainable hints", () => {
  it("reveals progressively more information without a full solution", () => {
    const level1 = explainStep(step, 1);
    const level2 = explainStep(step, 2);
    const level3 = explainStep(step, 3);
    expect(level1.explanation).toBe("Look at Row 4. One number has only one possible position.");
    expect(level2.explanation).toBe("7 is a Hidden Single in Row 4. The other possible cells are blocked.");
    expect(level3.explanation).toBe("Place 7 in R4C6.");
    expect(hintHighlightCells(step, 1)).toHaveLength(9);
    expect(hintHighlightCells(step, 3)).toEqual([32]);
    expect(JSON.stringify([level1, level2, level3])).not.toContain("solution");
  });
});
