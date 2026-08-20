import { describe, expect, it } from "vitest";

import { SudokuSessionRepository } from "@/lib/db";
import type { SudokuSession } from "@/lib/db";
import { FakeD1Database } from "./fake-d1";

const session: SudokuSession = {
  id: "session-1",
  anonymousId: "anonymous-1",
  puzzleId: "puzzle-1",
  status: "started",
  boardState: { values: [0, 1] },
  notes: [[], [2, 3]],
  mistakes: 0,
  hintCount: 0,
  maxHintLevel: 0,
  durationSeconds: null,
  challengeNonce: "nonce-1",
  startedAt: 100,
  completedAt: null,
  updatedAt: 100,
};

describe("SudokuSessionRepository", () => {
  it("serializes session JSON at the database boundary", async () => {
    const db = new FakeD1Database();
    db.queueRun();

    await new SudokuSessionRepository(db).create(session, "production");

    expect(db.statements[0].bindings[4]).toBe('{"values":[0,1]}');
    expect(db.statements[0].bindings[5]).toBe('[[],[2,3]]');
    expect(db.statements[0].bindings.at(-1)).toBe("production");
  });

  it("refuses to create a session without an explicit source environment", async () => {
    const db = new FakeD1Database();
    db.queueRun();

    await expect(new SudokuSessionRepository(db).create(session, undefined)).rejects.toThrow("source environment");
    expect(db.statements).toHaveLength(0);
  });

  it("restores a session by anonymous id and puzzle id", async () => {
    const db = new FakeD1Database();
    db.queueFirst({
      id: session.id,
      anonymous_id: session.anonymousId,
      puzzle_id: session.puzzleId,
      status: "in_progress",
      board_state_json: '{"values":[4]}',
      notes_json: "[]",
      mistakes: 1,
      hint_count: 2,
      max_hint_level: 2,
      duration_seconds: 90,
      challenge_nonce: "nonce-1",
      started_at: 100,
      completed_at: null,
      updated_at: 190,
    });

    const result = await new SudokuSessionRepository(db).findByAnonymousPuzzle("anonymous-1", "puzzle-1");

    expect(result?.status).toBe("in_progress");
    expect(result?.boardState).toEqual({ values: [4] });
    expect(result?.maxHintLevel).toBe(2);
    expect(db.statements[0].bindings).toEqual(["anonymous-1", "puzzle-1"]);
  });
});
