import type { D1DatabaseLike } from "./d1";
import { toDatabaseError } from "./errors";
import { mapStatsRow } from "./row-mappers";
import type { StatsRow } from "./row-mappers";
import type { SudokuPuzzleStats } from "./sudoku-types";

export class SudokuStatsRepository {
  constructor(private readonly db: D1DatabaseLike) {}

  async initialize(puzzleId: string, now: number): Promise<void> {
    try {
      await this.db
        .prepare(`
          INSERT INTO sudoku_puzzle_stats (puzzle_id, updated_at)
          VALUES (?, ?)
          ON CONFLICT(puzzle_id) DO NOTHING
        `)
        .bind(puzzleId, now)
        .run();
    } catch (error) {
      throw toDatabaseError(error, "Initializing Sudoku puzzle statistics");
    }
  }

  async recordStart(puzzleId: string, now: number): Promise<void> {
    try {
      await this.db.prepare(`
        INSERT INTO sudoku_puzzle_stats (puzzle_id, start_count, updated_at)
        VALUES (?, 1, ?)
        ON CONFLICT(puzzle_id) DO UPDATE SET
          start_count = start_count + 1,
          updated_at = excluded.updated_at
      `).bind(puzzleId, now).run();
    } catch (error) {
      throw toDatabaseError(error, "Recording a Sudoku start");
    }
  }

  async findByPuzzleId(puzzleId: string): Promise<SudokuPuzzleStats | null> {
    try {
      const row = await this.db
        .prepare(`
          SELECT
            puzzle_id, start_count, completion_count, total_completion_seconds,
            total_mistakes, total_hints, no_hint_completions, abandoned_count,
            updated_at
          FROM sudoku_puzzle_stats
          WHERE puzzle_id = ?
          LIMIT 1
        `)
        .bind(puzzleId)
        .first<StatsRow>();

      return row ? mapStatsRow(row) : null;
    } catch (error) {
      throw toDatabaseError(error, "Reading Sudoku puzzle statistics");
    }
  }
}
