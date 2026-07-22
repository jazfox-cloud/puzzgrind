import type { D1DatabaseLike } from "./d1";
import { toDatabaseError } from "./errors";
import { mapLexiStatsRow } from "./lexi-row-mappers";
import type { LexiPuzzleStats } from "./lexi-types";

export class LexiStatsRepository {
  constructor(private readonly db: D1DatabaseLike) {}
  async findByPuzzleId(puzzleId: string): Promise<LexiPuzzleStats | null> {
    try {
      const row = await this.db.prepare(`SELECT puzzle_id, start_count, win_count, fail_count,
        total_attempts, total_completion_seconds, total_hints, updated_at
        FROM lexi_puzzle_stats WHERE puzzle_id = ? LIMIT 1`).bind(puzzleId).first<Record<string, unknown>>();
      return row ? mapLexiStatsRow(row) : null;
    } catch (error) { throw toDatabaseError(error, "Reading Lexi puzzle statistics"); }
  }
}
