import type { D1DatabaseLike } from "./d1";
import { toDatabaseError } from "./errors";
import { mapLexiLeaderboardRow } from "./lexi-row-mappers";
import type { LexiLeaderboardEntry, RankedLexiLeaderboardEntry } from "./lexi-types";

const rankOrder = `verified_hints_used ASC, verified_attempts ASC,
  verified_completion_seconds ASC, completed_at ASC, id ASC`;
const ranked = `WITH ranked AS (
  SELECT *, ROW_NUMBER() OVER (ORDER BY ${rankOrder}) AS rank, COUNT(*) OVER () AS total_count
  FROM lexi_daily_leaderboard WHERE puzzle_id = ?
)`;

function mapRanked(row: Record<string, unknown>): RankedLexiLeaderboardEntry {
  const entry = mapLexiLeaderboardRow(row);
  if (typeof row.rank !== "number" || typeof row.total_count !== "number") throw new Error("Invalid Lexi rank row");
  return { displayName: entry.displayName, playerKeyHash: entry.playerKeyHash,
    verifiedAttempts: entry.verifiedAttempts, verifiedCompletionSeconds: entry.verifiedCompletionSeconds,
    verifiedHintsUsed: entry.verifiedHintsUsed, rank: row.rank, totalCount: row.total_count };
}

export class LexiLeaderboardRepository {
  constructor(private readonly db: D1DatabaseLike) {}

  async findBySession(sessionId: string): Promise<LexiLeaderboardEntry | null> {
    try {
      const row = await this.db.prepare(`SELECT * FROM lexi_daily_leaderboard WHERE session_id = ? LIMIT 1`)
        .bind(sessionId).first<Record<string, unknown>>();
      return row ? mapLexiLeaderboardRow(row) : null;
    } catch (error) { throw toDatabaseError(error, "Reading a Lexi leaderboard entry"); }
  }

  async createOrReturn(entry: LexiLeaderboardEntry): Promise<{ created: boolean; entry: LexiLeaderboardEntry }> {
    try {
      const result = await this.db.prepare(`INSERT OR IGNORE INTO lexi_daily_leaderboard (
        id, puzzle_id, puzzle_date, player_key_hash, display_name, verified_hints_used,
        verified_attempts, verified_completion_seconds, completed_at, created_at, session_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .bind(entry.id, entry.puzzleId, entry.puzzleDate, entry.playerKeyHash, entry.displayName,
          entry.verifiedHintsUsed, entry.verifiedAttempts, entry.verifiedCompletionSeconds,
          entry.completedAt, entry.createdAt, entry.sessionId).run();
      if ((result.meta.changes ?? 0) > 0) return { created: true, entry };
      const existing = await this.findBySession(entry.sessionId);
      if (!existing) {
        const byPlayer = await this.db.prepare(`SELECT * FROM lexi_daily_leaderboard
          WHERE puzzle_id = ? AND player_key_hash = ? LIMIT 1`).bind(entry.puzzleId, entry.playerKeyHash)
          .first<Record<string, unknown>>();
        if (!byPlayer) throw new Error("Lexi leaderboard conflict could not be read");
        return { created: false, entry: mapLexiLeaderboardRow(byPlayer) };
      }
      return { created: false, entry: existing };
    } catch (error) { throw toDatabaseError(error, "Creating a Lexi leaderboard entry"); }
  }

  async top(puzzleId: string, limit: 10 | 20): Promise<RankedLexiLeaderboardEntry[]> {
    try {
      const rows = await this.db.prepare(`${ranked} SELECT * FROM ranked ORDER BY rank ASC LIMIT ?`)
        .bind(puzzleId, limit).all<Record<string, unknown>>();
      return rows.results.map(mapRanked);
    } catch (error) { throw toDatabaseError(error, "Reading the Lexi leaderboard"); }
  }

  async rankForPlayer(puzzleId: string, playerKeyHash: string): Promise<RankedLexiLeaderboardEntry | null> {
    try {
      const row = await this.db.prepare(`${ranked} SELECT * FROM ranked WHERE player_key_hash = ? LIMIT 1`)
        .bind(puzzleId, playerKeyHash).first<Record<string, unknown>>();
      return row ? mapRanked(row) : null;
    } catch (error) { throw toDatabaseError(error, "Reading a Lexi leaderboard rank"); }
  }
}
