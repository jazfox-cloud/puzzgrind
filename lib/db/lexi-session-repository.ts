import type { LexiGuessResult } from "@/lib/lexi";
import type { AppEnvironment } from "@/lib/build-environment";
import type { D1DatabaseLike } from "./d1";
import { toDatabaseError } from "./errors";
import { mapLexiSessionRow } from "./lexi-row-mappers";
import type { LexiSessionRow } from "./lexi-row-mappers";
import type { LexiSession, LexiSessionStatus } from "./lexi-types";

const columns = `id, anonymous_id, puzzle_id, status, guesses_json, attempt_count,
  hint_count, hint_letter, revision, challenge_nonce, started_at, completed_at,
  duration_seconds, updated_at`;

export type LexiGuessCommitResult =
  | { ok: true; session: LexiSession }
  | { ok: false; reason: "already_completed" | "duplicate_guess" | "revision_conflict" | "session_expired" };

export class LexiSessionRepository {
  constructor(private readonly db: D1DatabaseLike) {}

  async findById(id: string): Promise<LexiSession | null> {
    try {
      const row = await this.db.prepare(`SELECT ${columns} FROM lexi_sessions WHERE id = ? LIMIT 1`)
        .bind(id).first<LexiSessionRow>();
      return row ? mapLexiSessionRow(row) : null;
    } catch (error) { throw toDatabaseError(error, "Reading a Lexi session"); }
  }

  async findByAnonymousPuzzle(anonymousId: string, puzzleId: string): Promise<LexiSession | null> {
    try {
      const row = await this.db.prepare(`SELECT ${columns} FROM lexi_sessions
        WHERE anonymous_id = ? AND puzzle_id = ? LIMIT 1`).bind(anonymousId, puzzleId).first<LexiSessionRow>();
      return row ? mapLexiSessionRow(row) : null;
    } catch (error) { throw toDatabaseError(error, "Restoring a Lexi session"); }
  }

  async createOrRestore(input: {
    anonymousId: string; challengeNonce: string; id: string; now: number; puzzleId: string;
    sourceEnvironment?: AppEnvironment;
  }): Promise<{ created: boolean; session: LexiSession }> {
    if (!input.sourceEnvironment) throw new Error("Session source environment is required");
    try {
      const result = await this.db.prepare(`INSERT OR IGNORE INTO lexi_sessions (
        id, anonymous_id, puzzle_id, status, guesses_json, attempt_count, hint_count,
        revision, challenge_nonce, started_at, updated_at, source_environment
      ) VALUES (?, ?, ?, 'started', '[]', 0, 0, 0, ?, ?, ?, ?)`)
        .bind(input.id, input.anonymousId, input.puzzleId, input.challengeNonce, input.now, input.now,
          input.sourceEnvironment).run();
      const session = await this.findByAnonymousPuzzle(input.anonymousId, input.puzzleId);
      if (!session) throw new Error("Lexi session insert could not be read");
      return { created: (result.meta.changes ?? 0) > 0, session };
    } catch (error) { throw toDatabaseError(error, "Creating a Lexi session"); }
  }

  async refreshNonce(id: string, nonce: string, now: number): Promise<LexiSession | null> {
    try {
      await this.db.prepare(`UPDATE lexi_sessions SET challenge_nonce = ?, updated_at = ? WHERE id = ?`)
        .bind(nonce, now, id).run();
      return this.findById(id);
    } catch (error) { throw toDatabaseError(error, "Refreshing a Lexi session token"); }
  }

  async commitGuess(input: {
    expectedRevision: number; guess: string; guesses: LexiGuessResult[]; id: string; now: number;
    status: Extract<LexiSessionStatus, "in_progress" | "lost" | "won">;
  }): Promise<LexiGuessCommitResult> {
    const completed = input.status === "won" || input.status === "lost";
    try {
      const result = await this.db.prepare(`UPDATE lexi_sessions SET
        guesses_json = ?, attempt_count = attempt_count + 1, revision = revision + 1,
        status = ?, completed_at = ?, duration_seconds = CASE WHEN ? THEN max(0, ? - started_at) ELSE NULL END,
        updated_at = ?
        WHERE id = ? AND revision = ? AND status IN ('started', 'in_progress') AND attempt_count < 6`)
        .bind(JSON.stringify(input.guesses), input.status, completed ? input.now : null,
          completed, input.now, input.now, input.id, input.expectedRevision).run();
      if ((result.meta.changes ?? 0) > 0) {
        const session = await this.findById(input.id);
        if (!session) throw new Error("Updated Lexi session disappeared");
        return { ok: true, session };
      }
      const current = await this.findById(input.id);
      if (!current) return { ok: false, reason: "revision_conflict" };
      if (current.guesses.some((row) => row.guess === input.guess)) return { ok: false, reason: "duplicate_guess" };
      if (current.status === "expired") return { ok: false, reason: "session_expired" };
      if (current.status === "won" || current.status === "lost") return { ok: false, reason: "already_completed" };
      return { ok: false, reason: "revision_conflict" };
    } catch (error) { throw toDatabaseError(error, "Committing a Lexi guess"); }
  }

  async expire(id: string, expectedRevision: number, now: number): Promise<boolean> {
    try {
      const result = await this.db.prepare(`UPDATE lexi_sessions SET status = 'expired', revision = revision + 1, updated_at = ?
        WHERE id = ? AND revision = ? AND status IN ('started', 'in_progress')`)
        .bind(now, id, expectedRevision).run();
      return (result.meta.changes ?? 0) > 0;
    } catch (error) { throw toDatabaseError(error, "Expiring a Lexi session"); }
  }
}
