import type { D1DatabaseLike } from "./d1";
import { DatabaseError, toDatabaseError } from "./errors";

export type LexiHintEvent = { createdAt: number; id: string; puzzleId: string; revealedLetter: string; sessionId: string };

export class LexiHintRepository {
  constructor(private readonly db: D1DatabaseLike) {}

  async findBySession(sessionId: string): Promise<LexiHintEvent | null> {
    try {
      const row = await this.db.prepare(`SELECT id, session_id, puzzle_id, revealed_letter, created_at
        FROM lexi_hint_events WHERE session_id = ? LIMIT 1`).bind(sessionId).first<Record<string, unknown>>();
      if (!row) return null;
      if (typeof row.id !== "string" || typeof row.session_id !== "string" || typeof row.puzzle_id !== "string" ||
        typeof row.revealed_letter !== "string" || typeof row.created_at !== "number") throw new Error("Invalid Lexi hint row");
      return { id: row.id, sessionId: row.session_id, puzzleId: row.puzzle_id,
        revealedLetter: row.revealed_letter, createdAt: row.created_at };
    } catch (error) { throw toDatabaseError(error, "Reading a Lexi hint"); }
  }

  async createOrReturn(input: LexiHintEvent): Promise<{ created: boolean; event: LexiHintEvent | null }> {
    try {
      const result = await this.db.prepare(`INSERT INTO lexi_hint_events (
        id, session_id, puzzle_id, hint_type, revealed_letter, created_at
      ) VALUES (?, ?, ?, 'reveal_letter', ?, ?)`)
        .bind(input.id, input.sessionId, input.puzzleId, input.revealedLetter, input.createdAt).run();
      return { created: (result.meta.changes ?? 0) > 0, event: input };
    } catch (error) {
      const mapped = toDatabaseError(error, "Recording a Lexi hint");
      if (mapped instanceof DatabaseError && mapped.code === "constraint") {
        return { created: false, event: await this.findBySession(input.sessionId) };
      }
      throw mapped;
    }
  }
}
