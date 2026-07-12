import { NextResponse } from "next/server";

import { SudokuSessionRepository } from "@/lib/db";
import type { D1DatabaseLike } from "@/lib/db/d1";
import type { SudokuSession, SessionStatus } from "@/lib/db/sudoku-types";
import { verifySessionTokenDetailed } from "@/lib/security/session-token";

type AuthorizationResult =
  | { ok: true; session: SudokuSession }
  | { ok: false; response: NextResponse };

type FindSession = (id: string) => Promise<SudokuSession | null>;

function failure(error: string, status: number): AuthorizationResult {
  return { ok: false, response: NextResponse.json({ error }, { status }) };
}

export async function authorizeSession(input: {
  allowedStatuses: readonly SessionStatus[];
  db?: D1DatabaseLike;
  findSession?: FindSession;
  now: number;
  requestedSessionId?: string;
  secret: string;
  token: string;
}): Promise<AuthorizationResult> {
  const tokenResult = await verifySessionTokenDetailed(input.token, input.secret, input.now);
  if (!tokenResult.ok) {
    return failure(tokenResult.reason === "expired" ? "expired_session_token" : "invalid_session_token", 401);
  }
  const payload = tokenResult.payload;
  if (input.requestedSessionId && payload.sessionId !== input.requestedSessionId) {
    return failure("session_id_mismatch", 401);
  }

  const findSession = input.findSession ?? (input.db
    ? (id: string) => new SudokuSessionRepository(input.db!).findById(id)
    : undefined);
  if (!findSession) throw new Error("Session lookup is required");
  const session = await findSession(payload.sessionId);
  if (!session) return failure("session_not_found", 404);
  if (session.anonymousId !== payload.anonymousId) return failure("session_ownership_mismatch", 401);
  if (session.puzzleId !== payload.puzzleId) return failure("puzzle_mismatch", 401);
  if (session.challengeNonce !== payload.nonce) return failure("nonce_mismatch", 401);
  if (!input.allowedStatuses.includes(session.status)) return failure("session_closed", 409);
  return { ok: true, session };
}
