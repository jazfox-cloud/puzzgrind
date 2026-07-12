import { describe, expect, it } from "vitest";

import type { SudokuSession } from "@/lib/db";
import { authorizeSession } from "@/lib/security/session-authorization";
import { createSessionToken } from "@/lib/security/session-token";

const secret = "test-secret-with-enough-entropy";
const now = 1_000_000;
const payload = { sessionId: "session-1", puzzleId: "puzzle-1", anonymousId: "anonymous-1", nonce: "nonce-1", issuedAt: now };
const session: SudokuSession = {
  id: payload.sessionId,
  anonymousId: payload.anonymousId,
  puzzleId: payload.puzzleId,
  status: "in_progress",
  boardState: {},
  notes: [],
  mistakes: 0,
  hintCount: 0,
  maxHintLevel: 0,
  durationSeconds: 10,
  challengeNonce: payload.nonce,
  startedAt: now,
  completedAt: null,
  updatedAt: now,
};

async function authorize(input: {
  requestedSessionId?: string;
  session?: SudokuSession | null;
  token?: string;
}) {
  const token = input.token ?? await createSessionToken(payload, secret);
  return authorizeSession({
    allowedStatuses: ["started", "in_progress"],
    findSession: async () => input.session === undefined ? session : input.session,
    now,
    requestedSessionId: input.requestedSessionId ?? payload.sessionId,
    secret,
    token,
  });
}

async function errorOf(result: Awaited<ReturnType<typeof authorize>>) {
  if (result.ok) return null;
  return (await result.response.json()) as { error: string };
}

describe("Hint session authorization", () => {
  it("accepts a valid signed token bound to the session", async () => {
    const result = await authorize({});
    expect(result.ok).toBe(true);
  });

  it("rejects an invalid signature", async () => {
    let lookups = 0;
    const result = await authorizeSession({
      allowedStatuses: ["started", "in_progress"],
      findSession: async () => { lookups += 1; return session; },
      now,
      secret,
      token: "invalid.token",
    });
    expect(await errorOf(result)).toEqual({ error: "invalid_session_token" });
    expect(lookups).toBe(0);
  });

  it("performs one session lookup for a valid signed token", async () => {
    let lookups = 0;
    const token = await createSessionToken(payload, secret);
    const result = await authorizeSession({
      allowedStatuses: ["started", "in_progress"],
      findSession: async () => { lookups += 1; return session; },
      now,
      secret,
      token,
    });
    expect(result.ok).toBe(true);
    expect(lookups).toBe(1);
  });

  it("distinguishes an expired token", async () => {
    const token = await createSessionToken({ ...payload, issuedAt: now - 8 * 86400 }, secret);
    expect(await errorOf(await authorize({ token }))).toEqual({ error: "expired_session_token" });
  });

  it("rejects a request session ID mismatch", async () => {
    expect(await errorOf(await authorize({ requestedSessionId: "other-session" }))).toEqual({ error: "session_id_mismatch" });
  });

  it("rejects a missing session", async () => {
    expect(await errorOf(await authorize({ session: null }))).toEqual({ error: "session_not_found" });
  });

  it.each([
    ["anonymous ownership", { anonymousId: "other" }, "session_ownership_mismatch"],
    ["puzzle", { puzzleId: "other" }, "puzzle_mismatch"],
    ["nonce", { challengeNonce: "other" }, "nonce_mismatch"],
  ])("rejects a %s mismatch", async (_label, change, error) => {
    const result = await authorize({ session: { ...session, ...change } });
    expect(await errorOf(result)).toEqual({ error });
  });

  it("rejects a closed session", async () => {
    expect(await errorOf(await authorize({ session: { ...session, status: "won" } }))).toEqual({ error: "session_closed" });
  });
});
