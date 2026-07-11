import { describe, expect, it } from "vitest";

import { findHiddenSingle, findLockedCandidates, findNakedSingle, findNextBasicStep, parseBoard } from "@/lib/sudoku";

const solved = "534678912672195348198342567859761423426853791713924856961537284287419635345286179";
const classic = "530070000600195000098000060800060003400803001700020006060000280000419005000080079";

describe("Sudoku technique recognition", () => {
  it("finds a deterministic naked single", () => {
    const step = findNakedSingle(parseBoard(`0${solved.slice(1)}`));
    expect(step).toEqual({ technique: "naked_single", targetCells: [0], relatedCells: [], candidate: 5 });
  });

  it("finds a structured hidden single", () => {
    const step = findHiddenSingle(parseBoard(classic));
    expect(step).toMatchObject({ technique: "hidden_single" });
    expect(step?.targetCells).toHaveLength(1);
    expect(step?.relatedCells).toHaveLength(8);
  });

  it("finds a locked candidate elimination", () => {
    const step = findLockedCandidates(parseBoard(classic));
    expect(step).toMatchObject({ technique: "locked_candidates" });
    expect(step?.targetCells.length).toBeGreaterThan(0);
    expect(step?.relatedCells.length).toBeGreaterThan(1);
  });

  it("returns a stable first step and null when no step is available", () => {
    const board = parseBoard(classic);
    expect(findNextBasicStep(board)).toEqual(findNextBasicStep(board));
    expect(findNextBasicStep(parseBoard(solved))).toBeNull();
  });
});
