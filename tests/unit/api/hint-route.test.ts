import { beforeEach, describe, expect, it, vi } from "vitest";

import { FakeD1Database } from "@/tests/unit/db/fake-d1";

const context = vi.hoisted(() => ({ env: undefined as unknown as CloudflareEnv }));

vi.mock("@opennextjs/cloudflare", () => ({
  getCloudflareContext: () => ({ env: context.env }),
}));

import { POST } from "@/app/api/sudoku/hint/route";
import { createSessionToken } from "@/lib/security/session-token";

function request(body: unknown) {
  return new Request("https://puzzgrind.test/api/sudoku/hint", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("Hint API request authorization contract", () => {
  beforeEach(() => {
    context.env = undefined as unknown as CloudflareEnv;
  });

  it("accepts a valid token bound to the requested session", async () => {
    const db = new FakeD1Database();
    const solution = "534678912672195348198342567859761423426853791713924856961537284287419635345286179";
    const board = `${solution.slice(0, -1)}0`;
    db.queueFirst({
      id: "session-1", anonymous_id: "anonymous-1", puzzle_id: "puzzle-1", status: "in_progress",
      board_state_json: JSON.stringify({ values: [] }), notes_json: JSON.stringify(Array.from({ length: 81 }, () => [])),
      mistakes: 0, hint_count: 0, max_hint_level: 0, duration_seconds: 10, challenge_nonce: "nonce-1",
      started_at: 1, completed_at: null, updated_at: 1,
    });
    db.queueFirst({
      id: "puzzle-1", puzzle_date: "2026-07-12", difficulty: "medium", givens: board, solution,
      technique_profile_json: null, source_type: "test", source_reference: "test", validation_version: "test",
      status: "published", published_at: 1, created_at: 1, updated_at: 1,
    });
    db.queueRun();
    db.queueRun();
    const now = Math.floor(Date.now() / 1000);
    const secret = "test-secret-with-enough-entropy";
    const sessionToken = await createSessionToken({
      sessionId: "session-1", anonymousId: "anonymous-1", puzzleId: "puzzle-1", nonce: "nonce-1", issuedAt: now,
    }, secret);
    context.env = {
      APP_ENV: "test",
      DB: db,
      RATE_LIMIT_HINT: { limit: async () => ({ success: true }) },
      SESSION_SIGNING_SECRET: secret,
    } as CloudflareEnv;

    const response = await POST(request({ sessionId: "session-1", sessionToken, board, level: 1 }));
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ hint: { level: 1, targetCells: [80] } });
  });

  it("rejects a missing session token before database access", async () => {
    const response = await POST(request({ sessionId: "session-1", board: "0".repeat(81), level: 1 }));
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "missing_session_token" });
  });

  it("rejects an otherwise malformed request body predictably", async () => {
    const response = await POST(request({ sessionToken: "token", sessionId: null, board: [], level: 4 }));
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "invalid_hint_request" });
  });

  it("rejects a non-object JSON body", async () => {
    const response = await POST(request(null));
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "invalid_hint_request" });
  });
});
