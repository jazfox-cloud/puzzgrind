import type { LexiGuessResult, LexiLetterStatus } from "@/lib/lexi";
import { DatabaseError } from "./errors";
import { lexiPuzzleStatuses, lexiSessionStatuses } from "./lexi-types";
import type { LexiLeaderboardEntry, LexiPuzzle, LexiPuzzleStats, LexiSession } from "./lexi-types";

const statuses = new Set<LexiLetterStatus>(["correct", "present", "absent"]);

export type LexiPuzzleRow = Record<"id" | "puzzle_date" | "answer" | "status" | "validation_version", unknown> & Record<string, unknown>;
export type LexiSessionRow = Record<"id" | "anonymous_id" | "puzzle_id" | "status" | "guesses_json", unknown> & Record<string, unknown>;

function stringValue(row: Record<string, unknown>, key: string): string {
  if (typeof row[key] !== "string") throw new DatabaseError("invalid_data", `Invalid Lexi database row: ${key}`);
  return row[key];
}

function numberValue(row: Record<string, unknown>, key: string): number {
  if (typeof row[key] !== "number" || !Number.isInteger(row[key])) throw new DatabaseError("invalid_data", `Invalid Lexi database row: ${key}`);
  return row[key];
}

function nullableNumber(row: Record<string, unknown>, key: string): number | null {
  return row[key] === null ? null : numberValue(row, key);
}

function parseGuesses(value: unknown): LexiGuessResult[] {
  if (typeof value !== "string") throw new DatabaseError("invalid_data", "Invalid Lexi database row: guesses_json");
  let parsed: unknown;
  try { parsed = JSON.parse(value); } catch { throw new DatabaseError("invalid_data", "Invalid Lexi database row: guesses_json"); }
  if (!Array.isArray(parsed) || parsed.length > 6) throw new DatabaseError("invalid_data", "Invalid Lexi database row: guesses_json");
  return parsed.map((item) => {
    if (!item || typeof item !== "object") throw new DatabaseError("invalid_data", "Invalid Lexi database row: guesses_json");
    const guess = "guess" in item ? item.guess : null;
    const evaluation = "evaluation" in item ? item.evaluation : null;
    if (typeof guess !== "string" || !/^[a-z]{5}$/u.test(guess) || !Array.isArray(evaluation) ||
      evaluation.length !== 5 || !evaluation.every((entry) => statuses.has(entry as LexiLetterStatus))) {
      throw new DatabaseError("invalid_data", "Invalid Lexi database row: guesses_json");
    }
    return { guess, evaluation: evaluation as LexiLetterStatus[] };
  });
}

export function mapLexiPuzzleRow(row: LexiPuzzleRow): LexiPuzzle {
  const wordLength = numberValue(row, "word_length");
  const maxAttempts = numberValue(row, "max_attempts");
  const status = stringValue(row, "status");
  if (wordLength !== 5 || maxAttempts !== 6 || !lexiPuzzleStatuses.includes(status as never)) {
    throw new DatabaseError("invalid_data", "Invalid Lexi puzzle configuration");
  }
  return {
    id: stringValue(row, "id"), puzzleDate: stringValue(row, "puzzle_date"), answer: stringValue(row, "answer"),
    wordLength, maxAttempts, status: status as LexiPuzzle["status"],
    sourceReference: row.source_reference === null ? null : stringValue(row, "source_reference"),
    validationVersion: stringValue(row, "validation_version"), publishedAt: nullableNumber(row, "published_at"),
    createdAt: numberValue(row, "created_at"), updatedAt: numberValue(row, "updated_at"),
  };
}

export function mapLexiSessionRow(row: LexiSessionRow): LexiSession {
  const guesses = parseGuesses(row.guesses_json);
  const attemptCount = numberValue(row, "attempt_count");
  const hintCount = numberValue(row, "hint_count");
  const status = stringValue(row, "status");
  if (attemptCount !== guesses.length || (hintCount !== 0 && hintCount !== 1) ||
    !lexiSessionStatuses.includes(status as never)) throw new DatabaseError("invalid_data", "Invalid Lexi session counters");
  return {
    id: stringValue(row, "id"), anonymousId: stringValue(row, "anonymous_id"), puzzleId: stringValue(row, "puzzle_id"),
    status: status as LexiSession["status"], guesses, attemptCount, hintCount,
    hintLetter: row.hint_letter === null ? null : stringValue(row, "hint_letter"), revision: numberValue(row, "revision"),
    challengeNonce: stringValue(row, "challenge_nonce"), startedAt: numberValue(row, "started_at"),
    completedAt: nullableNumber(row, "completed_at"), durationSeconds: nullableNumber(row, "duration_seconds"),
    updatedAt: numberValue(row, "updated_at"),
  };
}

export function mapLexiStatsRow(row: Record<string, unknown>): LexiPuzzleStats {
  return { puzzleId: stringValue(row, "puzzle_id"), startCount: numberValue(row, "start_count"),
    winCount: numberValue(row, "win_count"), failCount: numberValue(row, "fail_count"),
    totalAttempts: numberValue(row, "total_attempts"), totalCompletionSeconds: numberValue(row, "total_completion_seconds"),
    totalHints: numberValue(row, "total_hints"), updatedAt: numberValue(row, "updated_at") };
}

export function mapLexiLeaderboardRow(row: Record<string, unknown>): LexiLeaderboardEntry {
  return { id: stringValue(row, "id"), puzzleId: stringValue(row, "puzzle_id"), puzzleDate: stringValue(row, "puzzle_date"),
    playerKeyHash: stringValue(row, "player_key_hash"), displayName: stringValue(row, "display_name"),
    verifiedHintsUsed: numberValue(row, "verified_hints_used"), verifiedAttempts: numberValue(row, "verified_attempts"),
    verifiedCompletionSeconds: numberValue(row, "verified_completion_seconds"), completedAt: numberValue(row, "completed_at"),
    createdAt: numberValue(row, "created_at"), sessionId: stringValue(row, "session_id") };
}
