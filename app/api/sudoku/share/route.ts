import { getCloudflareContext } from "@opennextjs/cloudflare";
import { NextResponse } from "next/server";

import { SudokuPuzzleRepository, SudokuSessionRepository } from "@/lib/db";
import { createShareToken } from "@/lib/security/share-token";
import { verifySessionToken } from "@/lib/security/session-token";

export async function POST(request: Request) {
  let token: unknown;
  try {
    const body = await request.json() as { token?: unknown };
    token = body.token;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  if (typeof token !== "string") return NextResponse.json({ error: "invalid_share_request" }, { status: 400 });

  try {
    const { env } = getCloudflareContext();
    const now = Math.floor(Date.now() / 1000);
    const sessionPayload = await verifySessionToken(token, env.SESSION_SIGNING_SECRET, now);
    if (!sessionPayload) return NextResponse.json({ error: "invalid_session_token" }, { status: 401 });
    const session = await new SudokuSessionRepository(env.DB).findById(sessionPayload.sessionId);
    if (
      !session || session.status !== "won" || session.anonymousId !== sessionPayload.anonymousId ||
      session.puzzleId !== sessionPayload.puzzleId || session.challengeNonce !== sessionPayload.nonce ||
      session.durationSeconds === null
    ) return NextResponse.json({ error: "completed_session_required" }, { status: 409 });
    const puzzle = await new SudokuPuzzleRepository(env.DB).findById(session.puzzleId);
    if (!puzzle) return NextResponse.json({ error: "puzzle_not_found" }, { status: 404 });
    const shareToken = await createShareToken({
      puzzleDate: puzzle.puzzleDate,
      durationSeconds: session.durationSeconds,
      mistakes: session.mistakes,
      hintCount: session.hintCount,
      maxHintLevel: session.maxHintLevel,
      issuedAt: now,
    }, env.SESSION_SIGNING_SECRET);
    const url = new URL(`/sudoku/share/${shareToken}`, request.url).toString();
    return NextResponse.json({ url });
  } catch {
    return NextResponse.json({ error: "share_creation_failed" }, { status: 503 });
  }
}
