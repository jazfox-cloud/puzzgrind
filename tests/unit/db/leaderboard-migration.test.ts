// @vitest-environment node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "vitest";

const migration = readFileSync(resolve(process.cwd(), "migrations/0002_daily_leaderboard.sql"), "utf8");
const coreMigration = readFileSync(resolve(process.cwd(), "migrations/0001_sudoku_core.sql"), "utf8");

describe("daily leaderboard D1 migration", () => {
  it("is additive and repeat-safe", () => {
    expect(migration).toMatch(/CREATE TABLE IF NOT EXISTS sudoku_daily_leaderboard/u);
    expect(migration).toMatch(/CREATE TABLE IF NOT EXISTS sudoku_leaderboard_rejections/u);
    expect(migration).toMatch(/CREATE INDEX IF NOT EXISTS idx_sudoku_daily_leaderboard_rank/u);
    expect(migration).not.toMatch(/^\s*(?:DROP|DELETE|ALTER)\b/imu);
  });

  it("enforces one score per puzzle/player and one use per completion session", () => {
    expect(migration).toContain("UNIQUE (puzzle_id, player_key_hash)");
    expect(migration).toContain("UNIQUE (session_id)");
    expect(migration).toContain("verified_completion_seconds INTEGER NOT NULL");
    expect(migration).toContain("verified_hints_used INTEGER NOT NULL");
  });

  it("runs twice safely and ranks by hints, time, then completion order", () => {
    const db = new DatabaseSync(":memory:");
    try {
      db.exec(coreMigration);
      db.exec(migration);
      db.exec(migration);
      db.exec(`
        INSERT INTO sudoku_puzzles (
          id, puzzle_date, difficulty, givens, solution, validation_version, status, published_at
        ) VALUES ('puzzle-1', '2026-07-15', 'medium', '${"0".repeat(81)}', '${"1".repeat(81)}', 'test', 'published', 1);
        INSERT INTO sudoku_sessions (
          id, anonymous_id, puzzle_id, status, board_state_json, notes_json,
          hint_count, max_hint_level, challenge_nonce, started_at, completed_at, updated_at
        ) VALUES
          ('session-a', 'player-a', 'puzzle-1', 'won', '{}', '[]', 1, 1, 'a', 900, 1000, 1000),
          ('session-b', 'player-b', 'puzzle-1', 'won', '{}', '[]', 0, 0, 'b', 801, 1001, 1001),
          ('session-c', 'player-c', 'puzzle-1', 'won', '{}', '[]', 1, 1, 'c', 912, 1002, 1002),
          ('session-d', 'player-d', 'puzzle-1', 'won', '{}', '[]', 1, 1, 'd', 899, 999, 999),
          ('session-e', 'player-e', 'puzzle-1', 'won', '{}', '[]', 1, 1, 'e', 900, 1005, 1005);
      `);
      const insert = db.prepare(`
        INSERT INTO sudoku_daily_leaderboard (
          id, puzzle_id, puzzle_date, player_key_hash, display_name,
          verified_completion_seconds, verified_hints_used, completed_at, created_at, session_id
        ) VALUES (?, 'puzzle-1', '2026-07-15', ?, ?, ?, ?, ?, 1100, ?)
      `);
      insert.run("entry-a", "a".repeat(64), "Ada", 100, 1, 1000, "session-a");
      insert.run("entry-b", "b".repeat(64), "Ben", 200, 0, 1001, "session-b");
      insert.run("entry-c", "c".repeat(64), "Cid", 90, 1, 1002, "session-c");
      insert.run("entry-d", "d".repeat(64), "Dee", 100, 1, 999, "session-d");

      const names = db.prepare(`
        SELECT display_name FROM sudoku_daily_leaderboard
        WHERE puzzle_id = 'puzzle-1'
        ORDER BY verified_hints_used ASC, verified_completion_seconds ASC, completed_at ASC, id ASC
      `).all().map((row) => row.display_name);
      expect(names).toEqual(["Ben", "Cid", "Dee", "Ada"]);
      expect(db.prepare("PRAGMA index_list('sudoku_daily_leaderboard')").all().map((row) => row.name)).toContain("idx_sudoku_daily_leaderboard_rank");
      expect(() => insert.run("entry-duplicate-player", "a".repeat(64), "Again", 300, 2, 1100, "session-e")).toThrow(/puzzle_id, sudoku_daily_leaderboard.player_key_hash/u);
      expect(() => insert.run("entry-duplicate-session", "e".repeat(64), "Again", 300, 2, 1100, "session-b")).toThrow(/sudoku_daily_leaderboard.session_id/u);
    } finally {
      db.close();
    }
  });
});
