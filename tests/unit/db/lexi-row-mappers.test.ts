import { describe, expect, it } from "vitest";
import { DatabaseError } from "@/lib/db";
import { mapLexiSessionRow } from "@/lib/db/lexi-row-mappers";

const row = (guesses: unknown, attemptCount = 0) => ({ id: "s", anonymous_id: "a", puzzle_id: "p",
  status: "in_progress", guesses_json: JSON.stringify(guesses), attempt_count: attemptCount,
  hint_count: 0, hint_letter: null, revision: 0, challenge_nonce: "n", started_at: 1,
  completed_at: null, duration_seconds: null, updated_at: 1 });

describe("Lexi row mappers", () => {
  it("maps a schema-valid guess history", () => {
    const guesses = [{ guess: "level", evaluation: ["correct", "absent", "present", "absent", "correct"] }];
    expect(mapLexiSessionRow(row(guesses, 1))).toMatchObject({ guesses, attemptCount: 1 });
  });

  it.each([
    "not-json",
    JSON.stringify([{ guess: "LEVEL", evaluation: ["correct", "correct", "correct", "correct", "correct"] }]),
    JSON.stringify([{ guess: "level", evaluation: ["correct"] }]),
    JSON.stringify([{ guess: "level", evaluation: ["unknown", "absent", "absent", "absent", "absent"] }]),
  ])("fails closed for corrupt guesses_json", (guessesJson) => {
    const corrupt = { ...row([], 0), guesses_json: guessesJson };
    expect(() => mapLexiSessionRow(corrupt)).toThrow(DatabaseError);
  });

  it("fails closed when the stored attempt count disagrees with history", () => {
    expect(() => mapLexiSessionRow(row([], 1))).toThrow(DatabaseError);
  });
});
