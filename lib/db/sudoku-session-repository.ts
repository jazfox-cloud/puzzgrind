import type { D1DatabaseLike } from "./d1";
import { toDatabaseError } from "./errors";
import { mapSessionRow } from "./row-mappers";
import type { SessionRow } from "./row-mappers";
import type { SudokuSession } from "./sudoku-types";

const sessionColumns = `
  id, anonymous_id, puzzle_id, status, board_state_json, notes_json,
  mistakes, hint_count, max_hint_level, duration_seconds, challenge_nonce,
  started_at, completed_at, updated_at
`;

export class SudokuSessionRepository {
  constructor(private readonly db: D1DatabaseLike) {}

  async create(session: SudokuSession): Promise<void> {
    try {
      await this.db
        .prepare(`
          INSERT INTO sudoku_sessions (${sessionColumns})
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `)
        .bind(
          session.id,
          session.anonymousId,
          session.puzzleId,
          session.status,
          JSON.stringify(session.boardState),
          JSON.stringify(session.notes),
          session.mistakes,
          session.hintCount,
          session.maxHintLevel,
          session.durationSeconds,
          session.challengeNonce,
          session.startedAt,
          session.completedAt,
          session.updatedAt,
        )
        .run();
    } catch (error) {
      throw toDatabaseError(error, "Creating a Sudoku session");
    }
  }

  async findByAnonymousPuzzle(anonymousId: string, puzzleId: string): Promise<SudokuSession | null> {
    try {
      const row = await this.db
        .prepare(`
          SELECT ${sessionColumns}
          FROM sudoku_sessions
          WHERE anonymous_id = ? AND puzzle_id = ?
          LIMIT 1
        `)
        .bind(anonymousId, puzzleId)
        .first<SessionRow>();

      return row ? mapSessionRow(row) : null;
    } catch (error) {
      throw toDatabaseError(error, "Reading a Sudoku session");
    }
  }
}
