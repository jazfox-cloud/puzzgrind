import { describe, expect, it } from "vitest";

import { SudokuLeaderboardRepository } from "@/lib/db";
import { FakeD1Database } from "./fake-d1";

describe("SudokuLeaderboardRepository", () => {
  it("stores only server-verified score fields and enforces the session association", async () => {
    const db = new FakeD1Database();
    db.queueRun();
    await new SudokuLeaderboardRepository(db).create({
      completedAt: 200,
      createdAt: 201,
      displayName: "Ada",
      id: "entry-1",
      playerKeyHash: "a".repeat(64),
      puzzleDate: "2026-07-15",
      puzzleId: "puzzle-1",
      sessionId: "session-1",
      verifiedCompletionSeconds: 100,
      verifiedHintsUsed: 1,
    });
    expect(db.statements[0].bindings).toEqual([
      "entry-1", "puzzle-1", "2026-07-15", "a".repeat(64), "Ada", 100, 1, 200, 201, "session-1",
    ]);
  });

  it("uses hints, verified time, completion order, and id as deterministic ranking keys", async () => {
    const db = new FakeD1Database();
    db.queueAll([{ display_name: "Ada", player_key_hash: "hash", rank: 1, total_count: 21, verified_completion_seconds: 120, verified_hints_used: 0 }]);
    const result = await new SudokuLeaderboardRepository(db).top("puzzle-1", 20);
    expect(result[0]).toMatchObject({ rank: 1, totalCount: 21, verifiedCompletionSeconds: 120, verifiedHintsUsed: 0 });
    expect(db.statements[0].query).toContain("verified_hints_used ASC, verified_completion_seconds ASC, completed_at ASC, id ASC");
    expect(db.statements[0].query).toContain("COUNT(*) OVER ()");
    expect(db.statements[0].bindings).toEqual(["puzzle-1", 20]);
  });

  it("looks up a player's rank without returning private fields to callers", async () => {
    const db = new FakeD1Database();
    db.queueFirst({ display_name: "Ada", player_key_hash: "hash", rank: 12, total_count: 30, verified_completion_seconds: 200, verified_hints_used: 1 });
    const result = await new SudokuLeaderboardRepository(db).rankForPlayer("puzzle-1", "hash");
    expect(result?.rank).toBe(12);
    expect(db.statements[0].bindings).toEqual(["puzzle-1", "hash"]);
  });
});
