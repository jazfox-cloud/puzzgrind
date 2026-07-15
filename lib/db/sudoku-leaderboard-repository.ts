import type { D1DatabaseLike } from "./d1";
import { toDatabaseError } from "./errors";
import { mapRankedLeaderboardRow } from "./row-mappers";
import type { RankedLeaderboardRow } from "./row-mappers";
import type { LeaderboardRejectionReason, RankedSudokuLeaderboardEntry, SudokuLeaderboardEntry } from "./sudoku-types";

const rankedQuery = `
  WITH ranked AS (
    SELECT display_name, player_key_hash, verified_completion_seconds, verified_hints_used,
           ROW_NUMBER() OVER (
             ORDER BY verified_hints_used ASC, verified_completion_seconds ASC, completed_at ASC, id ASC
           ) AS rank,
           COUNT(*) OVER () AS total_count
    FROM sudoku_daily_leaderboard
    WHERE puzzle_id = ?
  )
`;

export class SudokuLeaderboardRepository {
  constructor(private readonly db: D1DatabaseLike) {}

  async create(entry: SudokuLeaderboardEntry): Promise<void> {
    try {
      await this.db.prepare(`
        INSERT INTO sudoku_daily_leaderboard (
          id, puzzle_id, puzzle_date, player_key_hash, display_name,
          verified_completion_seconds, verified_hints_used, completed_at, created_at, session_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        entry.id,
        entry.puzzleId,
        entry.puzzleDate,
        entry.playerKeyHash,
        entry.displayName,
        entry.verifiedCompletionSeconds,
        entry.verifiedHintsUsed,
        entry.completedAt,
        entry.createdAt,
        entry.sessionId,
      ).run();
    } catch (error) {
      throw toDatabaseError(error, "Creating a leaderboard entry");
    }
  }

  async recordRejection(input: {
    completedAt: number;
    id: string;
    now: number;
    puzzleId: string;
    reason: LeaderboardRejectionReason;
    sessionId: string;
  }): Promise<void> {
    try {
      await this.db.prepare(`
        INSERT OR IGNORE INTO sudoku_leaderboard_rejections (
          id, puzzle_id, session_id, reason, completed_at, created_at
        ) VALUES (?, ?, ?, ?, ?, ?)
      `).bind(input.id, input.puzzleId, input.sessionId, input.reason, input.completedAt, input.now).run();
    } catch (error) {
      throw toDatabaseError(error, "Recording a leaderboard rejection");
    }
  }

  async top(puzzleId: string, limit: 10 | 20): Promise<RankedSudokuLeaderboardEntry[]> {
    try {
      const result = await this.db.prepare(`
        ${rankedQuery}
        SELECT display_name, player_key_hash, verified_completion_seconds, verified_hints_used, rank, total_count
        FROM ranked
        ORDER BY rank ASC
        LIMIT ?
      `).bind(puzzleId, limit).all<RankedLeaderboardRow>();
      return result.results.map(mapRankedLeaderboardRow);
    } catch (error) {
      throw toDatabaseError(error, "Reading the daily leaderboard");
    }
  }

  async rankForPlayer(puzzleId: string, playerKeyHash: string): Promise<RankedSudokuLeaderboardEntry | null> {
    try {
      const row = await this.db.prepare(`
        ${rankedQuery}
        SELECT display_name, player_key_hash, verified_completion_seconds, verified_hints_used, rank, total_count
        FROM ranked
        WHERE player_key_hash = ?
        LIMIT 1
      `).bind(puzzleId, playerKeyHash).first<RankedLeaderboardRow>();
      return row ? mapRankedLeaderboardRow(row) : null;
    } catch (error) {
      throw toDatabaseError(error, "Reading a player's leaderboard rank");
    }
  }
}
