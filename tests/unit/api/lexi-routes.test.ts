import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET as getToday } from "@/app/api/lexi/today/route";
import { POST as startSession } from "@/app/api/lexi/session/start/route";
import { POST as submitGuess } from "@/app/api/lexi/guess/route";
import { utcDate } from "@/lib/daily/utc";
import { createLexiSessionToken } from "@/lib/security/lexi-session-token";
import { FakeD1Database } from "@/tests/unit/db/fake-d1";

const context = vi.hoisted(() => ({ env: undefined as unknown as CloudflareEnv }));
vi.mock("@opennextjs/cloudflare", () => ({ getCloudflareContext: () => ({ env: context.env }) }));

const now = () => Math.floor(Date.now() / 1_000);
const allow = { limit: async () => ({ success: true }) };
const puzzleRow = () => ({ id: "lexi-test-puzzle", puzzle_date: utcDate(), answer: "jazzy",
  word_length: 5, max_attempts: 6, status: "published", source_reference: "TEST_ONLY",
  validation_version: "TEST_ONLY", published_at: 1, created_at: 1, updated_at: 1 });
const scheduledPuzzleRow = () => ({ ...puzzleRow(), status: "scheduled", published_at: null });
const sessionRow = (overrides: Record<string, unknown> = {}) => ({ id: "lexi-test-session",
  anonymous_id: "1b6ffb08-65be-4b0d-8dc5-ef834cdf1141", puzzle_id: "lexi-test-puzzle",
  status: "started", guesses_json: "[]", attempt_count: 0, hint_count: 0, hint_letter: null,
  revision: 0, challenge_nonce: "lexi-test-nonce", started_at: now() - 10,
  completed_at: null, duration_seconds: null, updated_at: now() - 10, ...overrides });
function post(url: string, body: unknown) {
  return new Request(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
}

describe("Lexi API response and authorization boundaries", () => {
  beforeEach(() => { context.env = undefined as unknown as CloudflareEnv; });

  it("today exposes metadata only and never the answer or source", async () => {
    const db = new FakeD1Database();
    db.queueFirst(puzzleRow());
    context.env = { APP_ENV: "test", DB: db, RATE_LIMIT_LEXI_READ: allow,
      SESSION_SIGNING_SECRET: "test-secret" } as CloudflareEnv;
    const response = await getToday(new Request("https://puzzgrind.test/api/lexi/today"));
    const body = await response.json() as Record<string, unknown>;
    expect(response.status).toBe(200);
    expect(body).toMatchObject({ puzzleId: "lexi-test-puzzle", wordLength: 5, maxAttempts: 6 });
    expect(body).not.toHaveProperty("answer");
    expect(body).not.toHaveProperty("sourceReference");
    expect(JSON.stringify(body)).not.toContain("jazzy");
  });

  it("today treats the current UTC scheduled puzzle as playable without leaking the answer", async () => {
    const db = new FakeD1Database();
    db.queueFirst(scheduledPuzzleRow());
    context.env = { APP_ENV: "test", DB: db, RATE_LIMIT_LEXI_READ: allow,
      SESSION_SIGNING_SECRET: "test-secret" } as CloudflareEnv;
    const response = await getToday(new Request("https://puzzgrind.test/api/lexi/today"));
    const body = await response.json() as Record<string, unknown>;
    expect(response.status).toBe(200);
    expect(body).toMatchObject({ puzzleDate: utcDate(), puzzleId: "lexi-test-puzzle" });
    expect(body).not.toHaveProperty("answer");
    expect(JSON.stringify(body)).not.toContain("jazzy");
    expect(db.statements[0]?.query).toContain("puzzle_date = ?");
    expect(db.statements[0]?.query).toContain("status IN ('published', 'scheduled')");
    expect(db.statements[0]?.bindings).toEqual([utcDate()]);
  });

  it("today returns a controlled unavailable error when no current UTC puzzle exists", async () => {
    const db = new FakeD1Database();
    db.queueFirst(null);
    context.env = { APP_ENV: "test", DB: db, RATE_LIMIT_LEXI_READ: allow,
      SESSION_SIGNING_SECRET: "test-secret" } as CloudflareEnv;
    const response = await getToday(new Request("https://puzzgrind.test/api/lexi/today"));
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({ error: "puzzle_unavailable" });
  });

  it("fails closed in production before reading a puzzle when limiter is absent", async () => {
    const db = new FakeD1Database();
    context.env = { APP_ENV: "production", DB: db, SESSION_SIGNING_SECRET: "test" } as CloudflareEnv;
    const response = await getToday(new Request("https://puzzgrind.test/api/lexi/today",
      { headers: { "cf-connecting-ip": "203.0.113.5" } }));
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({ error: "rate_limiter_unavailable" });
    expect(db.statements).toHaveLength(0);
  });

  it("starts a session without returning an answer", async () => {
    const db = new FakeD1Database();
    db.queueFirst(puzzleRow());
    db.queueRun();
    db.queueFirst(sessionRow());
    context.env = { APP_ENV: "test", DB: db, RATE_LIMIT_LEXI_START: allow,
      SESSION_SIGNING_SECRET: "test-secret" } as CloudflareEnv;
    const response = await startSession(post("https://puzzgrind.test/api/lexi/session/start",
      { anonymousId: sessionRow().anonymous_id }));
    const body = await response.json() as Record<string, unknown>;
    expect(response.status).toBe(201);
    expect(body).toMatchObject({ restored: false, attemptCount: 0, revision: 0 });
    expect(body).toHaveProperty("token");
    expect(body).not.toHaveProperty("answer");
    const insert = db.statements.find((statement) => /INSERT OR IGNORE INTO lexi_sessions/u.test(statement.query));
    expect(insert?.bindings.at(-1)).toBe("test");
  });

  it("fails closed before inserting a session when APP_ENV is missing", async () => {
    const db = new FakeD1Database();
    db.queueFirst(puzzleRow());
    context.env = { DB: db, RATE_LIMIT_LEXI_START: allow,
      SESSION_SIGNING_SECRET: "test-secret" } as CloudflareEnv;

    const response = await startSession(post("https://puzzgrind.test/api/lexi/session/start",
      { anonymousId: sessionRow().anonymous_id }));

    expect(response.status).toBe(503);
    expect(db.statements.some((statement) => /INSERT OR IGNORE INTO lexi_sessions/u.test(statement.query))).toBe(false);
  });

  it("starts a session for today's scheduled puzzle without returning an answer", async () => {
    const db = new FakeD1Database();
    db.queueFirst(scheduledPuzzleRow());
    db.queueRun();
    db.queueFirst(sessionRow());
    context.env = { APP_ENV: "test", DB: db, RATE_LIMIT_LEXI_START: allow,
      SESSION_SIGNING_SECRET: "test-secret" } as CloudflareEnv;
    const response = await startSession(post("https://puzzgrind.test/api/lexi/session/start",
      { anonymousId: sessionRow().anonymous_id }));
    const body = await response.json() as Record<string, unknown>;
    expect(response.status).toBe(201);
    expect(body).toMatchObject({ restored: false, attemptCount: 0, revision: 0 });
    expect(body).not.toHaveProperty("answer");
  });

  it("recognizes a new session when an insert trigger increases D1 meta changes", async () => {
    const db = new FakeD1Database();
    db.queueFirst(puzzleRow());
    db.queueRun(2);
    db.queueFirst(sessionRow());
    context.env = { APP_ENV: "test", DB: db, RATE_LIMIT_LEXI_START: allow,
      SESSION_SIGNING_SECRET: "test-secret" } as CloudflareEnv;
    const response = await startSession(post("https://puzzgrind.test/api/lexi/session/start",
      { anonymousId: sessionRow().anonymous_id }));
    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toMatchObject({ restored: false });
  });

  it("evaluates and commits a winning guess entirely from server state", async () => {
    const db = new FakeD1Database();
    const issuedAt = now();
    const secret = "test-secret";
    const token = await createLexiSessionToken({ sessionId: "lexi-test-session", puzzleId: "lexi-test-puzzle",
      anonymousId: sessionRow().anonymous_id as string, nonce: "lexi-test-nonce", issuedAt, expiresAt: issuedAt + 60 }, secret);
    db.queueFirst(sessionRow());
    db.queueFirst(puzzleRow());
    db.queueRun(2);
    db.queueFirst(sessionRow({ status: "won", guesses_json: JSON.stringify([{ guess: "jazzy",
      evaluation: ["correct", "correct", "correct", "correct", "correct"] }]), attempt_count: 1,
      revision: 1, completed_at: issuedAt, duration_seconds: 10, updated_at: issuedAt }));
    context.env = { APP_ENV: "test", DB: db, RATE_LIMIT_LEXI_GUESS: allow,
      SESSION_SIGNING_SECRET: secret } as CloudflareEnv;
    const response = await submitGuess(post("https://puzzgrind.test/api/lexi/guess",
      { token, guess: "JAZZY", revision: 0, status: "lost", attempts: 6 }));
    const body = await response.json() as Record<string, unknown>;
    expect(response.status).toBe(200);
    expect(body).toMatchObject({ status: "won", attemptCount: 1, revision: 1,
      evaluation: ["correct", "correct", "correct", "correct", "correct"] });
    expect(body).not.toHaveProperty("answer");
  });

  it("keeps valid non-answer guesses revision-protected for today's scheduled puzzle", async () => {
    const db = new FakeD1Database();
    const issuedAt = now();
    const secret = "test-secret";
    const token = await createLexiSessionToken({ sessionId: "lexi-test-session", puzzleId: "lexi-test-puzzle",
      anonymousId: sessionRow().anonymous_id as string, nonce: "lexi-test-nonce", issuedAt, expiresAt: issuedAt + 60 }, secret);
    db.queueFirst(sessionRow());
    db.queueFirst(scheduledPuzzleRow());
    db.queueRun(1);
    db.queueFirst(sessionRow({ status: "in_progress", guesses_json: JSON.stringify([{ guess: "cigar",
      evaluation: ["absent", "absent", "absent", "absent", "absent"] }]), attempt_count: 1,
      revision: 1, updated_at: issuedAt }));
    context.env = { APP_ENV: "test", DB: db, RATE_LIMIT_LEXI_GUESS: allow,
      SESSION_SIGNING_SECRET: secret } as CloudflareEnv;
    const response = await submitGuess(post("https://puzzgrind.test/api/lexi/guess",
      { token, guess: "cigar", revision: 0 }));
    const body = await response.json() as Record<string, unknown>;
    expect(response.status).toBe(200);
    expect(body).toMatchObject({ status: "in_progress", attemptCount: 1, revision: 1 });
    expect(body).not.toHaveProperty("answer");
  });

  it("returns duplicate_guess on a network retry even when the first request won", async () => {
    const db = new FakeD1Database();
    const issuedAt = now();
    const secret = "test-secret";
    const won = sessionRow({ status: "won", guesses_json: JSON.stringify([{ guess: "jazzy",
      evaluation: ["correct", "correct", "correct", "correct", "correct"] }]), attempt_count: 1,
      revision: 1, completed_at: issuedAt, duration_seconds: 10, updated_at: issuedAt });
    const token = await createLexiSessionToken({ sessionId: "lexi-test-session", puzzleId: "lexi-test-puzzle",
      anonymousId: won.anonymous_id as string, nonce: "lexi-test-nonce", issuedAt, expiresAt: issuedAt + 60 }, secret);
    db.queueFirst(won);
    db.queueFirst(puzzleRow());
    context.env = { APP_ENV: "test", DB: db, RATE_LIMIT_LEXI_GUESS: allow,
      SESSION_SIGNING_SECRET: secret } as CloudflareEnv;
    const response = await submitGuess(post("https://puzzgrind.test/api/lexi/guess",
      { token, guess: "jazzy", revision: 0 }));
    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({ error: "duplicate_guess" });
    expect(db.statements.every((statement) => !/UPDATE lexi_sessions/u.test(statement.query))).toBe(true);
  });
});
