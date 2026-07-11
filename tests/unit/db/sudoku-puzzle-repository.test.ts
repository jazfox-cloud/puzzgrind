import { describe, expect, it } from "vitest";

import { DatabaseError, SudokuPuzzleRepository } from "@/lib/db";
import type { NewSudokuPuzzle } from "@/lib/db";
import { FakeD1Database } from "./fake-d1";

const puzzle: NewSudokuPuzzle = {
  id: "puzzle-2026-07-12",
  puzzleDate: "2026-07-12",
  difficulty: "medium",
  givens: "0".repeat(81),
  solution: "123456789".repeat(9),
  techniqueProfile: { naked_single: 4 },
  sourceType: "licensed",
  sourceReference: "fixture-001",
  validationVersion: "solver-v1",
  status: "draft",
  publishedAt: null,
};

describe("SudokuPuzzleRepository", () => {
  it("creates a puzzle with parameterized values", async () => {
    const db = new FakeD1Database();
    db.queueRun();

    await new SudokuPuzzleRepository(db).create(puzzle, 1_720_742_400);

    expect(db.statements).toHaveLength(1);
    expect(db.statements[0].query).toContain("VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
    expect(db.statements[0].bindings).toEqual([
      puzzle.id,
      puzzle.puzzleDate,
      "medium",
      puzzle.givens,
      puzzle.solution,
      '{"naked_single":4}',
      "licensed",
      "fixture-001",
      "solver-v1",
      "draft",
      null,
      1_720_742_400,
      1_720_742_400,
    ]);
  });

  it("maps a stored puzzle row", async () => {
    const db = new FakeD1Database();
    db.queueFirst({
      id: puzzle.id,
      puzzle_date: puzzle.puzzleDate,
      difficulty: "medium",
      givens: puzzle.givens,
      solution: puzzle.solution,
      technique_profile_json: '{"hidden_single":2}',
      source_type: "licensed",
      source_reference: "fixture-001",
      validation_version: "solver-v1",
      status: "validated",
      published_at: null,
      created_at: 100,
      updated_at: 200,
    });

    const result = await new SudokuPuzzleRepository(db).findByDate("2026-07-12");

    expect(result?.techniqueProfile).toEqual({ hidden_single: 2 });
    expect(result?.status).toBe("validated");
    expect(db.statements[0].bindings).toEqual(["2026-07-12", "medium"]);
  });

  it("converts unique constraint failures into a stable error", async () => {
    const db = new FakeD1Database();
    db.queueError(new Error("UNIQUE constraint failed: sudoku_puzzles.puzzle_date"));

    await expect(new SudokuPuzzleRepository(db).create(puzzle, 100)).rejects.toMatchObject({
      code: "constraint",
      name: "DatabaseError",
    } satisfies Partial<DatabaseError>);
  });
});
