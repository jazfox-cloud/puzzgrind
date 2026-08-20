// @vitest-environment node

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "vitest";

const migrationPath = resolve(process.cwd(), "migrations/0004_session_provenance.sql");

describe("session provenance D1 migration", () => {
  it("preserves legacy rows as unknown and requires an allowed source environment for new truth", () => {
    expect(existsSync(migrationPath)).toBe(true);
    const db = new DatabaseSync(":memory:");
    try {
      db.exec(readFileSync(resolve(process.cwd(), "migrations/0001_sudoku_core.sql"), "utf8"));
      db.exec(readFileSync(resolve(process.cwd(), "migrations/0003_lexi_daily.sql"), "utf8"));
      db.exec(`
        INSERT INTO sudoku_puzzles (id,puzzle_date,givens,solution,validation_version)
        VALUES ('sudoku-puzzle','2026-08-19','${"0".repeat(81)}','${"1".repeat(81)}','test');
        INSERT INTO sudoku_sessions (id,anonymous_id,puzzle_id,board_state_json,started_at,updated_at)
        VALUES ('legacy-sudoku','legacy','sudoku-puzzle','{}',1,1);
        INSERT INTO lexi_puzzles (id,puzzle_date,answer,validation_version)
        VALUES ('lexi-puzzle','2026-08-19','jazzy','test');
        INSERT INTO lexi_sessions (id,anonymous_id,puzzle_id,challenge_nonce,started_at,updated_at)
        VALUES ('legacy-lexi','legacy','lexi-puzzle','nonce',1,1);
      `);
      db.exec(readFileSync(migrationPath, "utf8"));

      expect(db.prepare("SELECT source_environment FROM sudoku_sessions WHERE id='legacy-sudoku'").get())
        .toEqual({ source_environment: "unknown" });
      expect(db.prepare("SELECT source_environment FROM lexi_sessions WHERE id='legacy-lexi'").get())
        .toEqual({ source_environment: "unknown" });
      expect(() => db.exec("UPDATE sudoku_sessions SET source_environment='invented' WHERE id='legacy-sudoku'"))
        .toThrow();
      expect(() => db.exec("UPDATE lexi_sessions SET source_environment='invented' WHERE id='legacy-lexi'"))
        .toThrow();
    } finally {
      db.close();
    }
  });
});
