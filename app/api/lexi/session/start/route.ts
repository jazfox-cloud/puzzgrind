import { getCloudflareContext } from "@opennextjs/cloudflare";
import { NextResponse } from "next/server";
import { isJsonObject, JSON_BODY_LIMITS, readJsonBody } from "@/lib/api/request";
import { limitApiRequest } from "@/lib/api/rate-limit";
import { LexiPuzzleRepository, LexiSessionRepository } from "@/lib/db";
import { nextUtcMidnight, utcDate } from "@/lib/daily/utc";
import { createLexiSessionToken } from "@/lib/security/lexi-session-token";

const uuidV4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

function publicSession(session: Awaited<ReturnType<LexiSessionRepository["findById"]>>) {
  if (!session) throw new Error("Missing Lexi session");
  return { sessionId: session.id, status: session.status, guesses: session.guesses,
    attemptCount: session.attemptCount, hintCount: session.hintCount, hintLetter: session.hintLetter,
    revision: session.revision, durationSeconds: session.durationSeconds };
}

export async function POST(request: Request) {
  const parsed = await readJsonBody<unknown>(request, JSON_BODY_LIMITS.lexiSessionStart);
  if (!parsed.ok) return parsed.response;
  const anonymousId = isJsonObject(parsed.value) ? parsed.value.anonymousId : null;
  if (typeof anonymousId !== "string" || !uuidV4.test(anonymousId)) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }
  try {
    const { env } = getCloudflareContext();
    const limited = await limitApiRequest(request, env, "lexiSessionStart");
    if (limited) return limited;
    const date = utcDate();
    const puzzle = await new LexiPuzzleRepository(env.DB).findPublishedByDate(date);
    if (!puzzle) return NextResponse.json({ error: "puzzle_unavailable" }, { status: 503 });
    const now = Math.floor(Date.now() / 1_000);
    const repository = new LexiSessionRepository(env.DB);
    const nonce = crypto.randomUUID();
    const result = await repository.createOrRestore({ anonymousId, challengeNonce: nonce,
      id: crypto.randomUUID(), now, puzzleId: puzzle.id });
    const session = result.created ? result.session : await repository.refreshNonce(result.session.id, nonce, now);
    if (!session) throw new Error("Lexi session unavailable after start");
    const expiresAt = Math.floor(new Date(nextUtcMidnight(date)).getTime() / 1_000);
    const token = await createLexiSessionToken({ sessionId: session.id, puzzleId: puzzle.id,
      anonymousId, nonce, issuedAt: now, expiresAt }, env.SESSION_SIGNING_SECRET);
    return NextResponse.json({ ...publicSession(session), token, restored: !result.created,
      ...(session.status === "lost" ? { answer: puzzle.answer } : {}) }, { status: result.created ? 201 : 200,
      headers: { "Cache-Control": "private, no-store" } });
  } catch { return NextResponse.json({ error: "session_unavailable" }, { status: 503 }); }
}
