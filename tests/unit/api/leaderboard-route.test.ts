import { beforeEach, describe, expect, it, vi } from "vitest";

import { FakeD1Database } from "@/tests/unit/db/fake-d1";

const context = vi.hoisted(() => ({ env: undefined as unknown as CloudflareEnv }));

vi.mock("@opennextjs/cloudflare", () => ({
  getCloudflareContext: () => ({ env: context.env }),
}));

import { GET, POST } from "@/app/api/sudoku/leaderboard/route";
import { createSessionToken } from "@/lib/security/session-token";
import { utcDate } from "@/lib/sudoku/daily";

const secret = "leaderboard-test-secret-with-enough-entropy";

function puzzleRow(now: number, puzzleDate = utcDate(new Date(now * 1000))) {
  return {
    id: "puzzle-1", puzzle_date: puzzleDate, difficulty: "medium", givens: "0".repeat(81), solution: "1".repeat(81),
    technique_profile_json: null, source_type: "test", source_reference: "test", validation_version: "test",
    status: "published", published_at: now, created_at: now, updated_at: now,
  };
}

function sessionRow(now: number, status = "won", duration = 120) {
  return {
    id: "session-1", anonymous_id: "anonymous-1", puzzle_id: "puzzle-1", status,
    board_state_json: JSON.stringify({ values: [] }), notes_json: "[]", mistakes: 0, hint_count: 2, max_hint_level: 3,
    duration_seconds: 8, challenge_nonce: "nonce-1", started_at: now - duration,
    completed_at: status === "won" ? now : null, updated_at: now,
  };
}

function statsRow(now: number) {
  return {
    puzzle_id: "puzzle-1", start_count: 15, completion_count: 8, total_completion_seconds: 1000,
    total_mistakes: 2, total_hints: 4, no_hint_completions: 5, abandoned_count: 0, updated_at: now,
  };
}

function rankedRow(rank = 1) {
  return {
    display_name: "Ada", player_key_hash: "a".repeat(64), rank, total_count: 4,
    verified_completion_seconds: 120, verified_hints_used: 2,
  };
}

async function token(now: number) {
  return createSessionToken({
    anonymousId: "anonymous-1", issuedAt: now, nonce: "nonce-1", puzzleId: "puzzle-1", sessionId: "session-1",
  }, secret);
}

function env(db: FakeD1Database, limiter: { limit(input: { key: string }): Promise<{ success: boolean }> } = { limit: async () => ({ success: true }) }) {
  context.env = {
    APP_ENV: "test",
    DB: db,
    RATE_LIMIT_SHARE: limiter,
    RATE_LIMIT_SHARE_IMAGE: limiter,
    SESSION_SIGNING_SECRET: secret,
  } as CloudflareEnv;
}

function postRequest(body: unknown) {
  return new Request("https://puzzgrind.test/api/sudoku/leaderboard", {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
  });
}

describe("daily leaderboard API", () => {
  beforeEach(() => { context.env = undefined as unknown as CloudflareEnv; });

  it("allows a verified completion and ignores client-forged score fields", async () => {
    const now = Math.floor(Date.now() / 1000);
    const db = new FakeD1Database();
    db.queueFirst(sessionRow(now));
    db.queueFirst(puzzleRow(now));
    db.queueRun();
    db.queueAll([rankedRow()]);
    db.queueFirst(rankedRow());
    db.queueFirst(statsRow(now));
    env(db);

    const response = await POST(postRequest({
      displayName: "Ada", token: await token(now), completionTime: 1, hintsUsed: 0, rank: 1,
    }));
    expect(response.status).toBe(201);
    const payload = await response.json();
    expect(payload).toMatchObject({ completionCount: 8, joinedCount: 4, ownRank: 1 });
    const insert = db.statements.find((statement) => statement.query.includes("INSERT INTO sudoku_daily_leaderboard"));
    expect(insert?.bindings[5]).toBe(120);
    expect(insert?.bindings[6]).toBe(2);
    expect(JSON.stringify(payload)).not.toContain("anonymous-1");
  });

  it("rejects an unfinished session before score creation", async () => {
    const now = Math.floor(Date.now() / 1000);
    const db = new FakeD1Database();
    db.queueFirst(sessionRow(now, "in_progress"));
    env(db);
    const response = await POST(postRequest({ displayName: "Ada", token: await token(now) }));
    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({ error: "session_closed" });
    expect(db.statements).toHaveLength(1);
  });

  it("makes a completion single-use and blocks duplicate player/puzzle records through constraints", async () => {
    const now = Math.floor(Date.now() / 1000);
    const db = new FakeD1Database();
    db.queueFirst(sessionRow(now));
    db.queueFirst(puzzleRow(now));
    db.queueError(new Error("UNIQUE constraint failed: sudoku_daily_leaderboard.session_id"));
    env(db);
    const response = await POST(postRequest({ displayName: "Ada", token: await token(now) }));
    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({ error: "leaderboard_already_joined" });
  });

  it("rejects and audits an implausibly fast server-derived completion", async () => {
    const now = Math.floor(Date.now() / 1000);
    const db = new FakeD1Database();
    db.queueFirst(sessionRow(now, "won", 10));
    db.queueFirst(puzzleRow(now));
    db.queueRun();
    env(db);
    const response = await POST(postRequest({ displayName: "Ada", token: await token(now), completionTime: 300 }));
    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toEqual({ error: "completion_not_eligible" });
    expect(db.statements.at(-1)?.bindings[3]).toBe("completion_too_fast");
  });

  it("closes submission when the UTC puzzle date changes", async () => {
    const now = Math.floor(Date.now() / 1000);
    const db = new FakeD1Database();
    db.queueFirst(sessionRow(now));
    db.queueFirst(puzzleRow(now, "2000-01-01"));
    env(db);
    const response = await POST(postRequest({ displayName: "Ada", token: await token(now) }));
    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({ error: "leaderboard_closed" });
  });

  it("returns public empty-board totals to users who have not completed", async () => {
    const now = Math.floor(Date.now() / 1000);
    const db = new FakeD1Database();
    db.queueFirst(puzzleRow(now));
    db.queueAll([]);
    db.queueFirst(statsRow(now));
    env(db);
    const response = await GET(new Request("https://puzzgrind.test/api/sudoku/leaderboard?limit=20"));
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ entries: [], completionCount: 8, joinedCount: 0, ownRank: null });
  });

  it("rate limits score submission with the existing binding", async () => {
    const now = Math.floor(Date.now() / 1000);
    const db = new FakeD1Database();
    db.queueFirst(sessionRow(now));
    env(db, { limit: async () => ({ success: false }) });
    const response = await POST(postRequest({ displayName: "Ada", token: await token(now) }));
    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("60");
    expect(db.statements).toHaveLength(1);
  });
});
