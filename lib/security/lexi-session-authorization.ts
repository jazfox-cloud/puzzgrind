import { NextResponse } from "next/server";
import { LexiSessionRepository } from "@/lib/db";
import type { D1DatabaseLike } from "@/lib/db";
import type { LexiSession, LexiSessionStatus } from "@/lib/db";
import { verifyLexiSessionToken } from "./lexi-session-token";

type Result = { ok: true; session: LexiSession } | { ok: false; response: NextResponse };
const fail = (error: string, status: number): Result => ({ ok: false, response: NextResponse.json({ error }, { status }) });

export async function authorizeLexiSession(input: {
  allowedStatuses: readonly LexiSessionStatus[];
  db: D1DatabaseLike;
  now: number;
  secret: string;
  token: string;
}): Promise<Result> {
  const verified = await verifyLexiSessionToken(input.token, input.secret, input.now);
  if (!verified.ok) return fail(verified.reason === "expired" ? "session_expired" : "invalid_token", 401);
  const session = await new LexiSessionRepository(input.db).findById(verified.payload.sessionId);
  if (!session) return fail("invalid_token", 401);
  if (session.id !== verified.payload.sessionId || session.puzzleId !== verified.payload.puzzleId ||
    session.anonymousId !== verified.payload.anonymousId || session.challengeNonce !== verified.payload.nonce) {
    return fail("invalid_token", 401);
  }
  if (!input.allowedStatuses.includes(session.status)) {
    return fail(session.status === "expired" ? "session_expired" : "already_completed", 409);
  }
  return { ok: true, session };
}
