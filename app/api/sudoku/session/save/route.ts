import { getCloudflareContext } from "@opennextjs/cloudflare";
import { NextResponse } from "next/server";

import { SudokuPuzzleRepository, SudokuSessionRepository } from "@/lib/db";
import { verifySessionToken } from "@/lib/security/session-token";
import { findGivenViolations, parseBoard } from "@/lib/sudoku";

type SaveRequest = {
  board?: unknown;
  elapsedSeconds?: unknown;
  mistakes?: unknown;
  notes?: unknown;
  paused?: unknown;
  token?: unknown;
};

export async function POST(request: Request) {
  let body: SaveRequest;
  try { body = await request.json() as SaveRequest; } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  if (
    typeof body.token !== "string" || typeof body.board !== "string" || !Array.isArray(body.notes) ||
    !Number.isInteger(body.elapsedSeconds) || (body.elapsedSeconds as number) < 0 || (body.elapsedSeconds as number) > 86400 ||
    !Number.isInteger(body.mistakes) || (body.mistakes as number) < 0 || (body.mistakes as number) > 999 ||
    typeof body.paused !== "boolean"
  ) return NextResponse.json({ error: "invalid_save_request" }, { status: 400 });

  try {
    const { env } = getCloudflareContext();
    const now = Math.floor(Date.now() / 1000);
    const payload = await verifySessionToken(body.token, env.SESSION_SIGNING_SECRET, now);
    if (!payload) return NextResponse.json({ error: "invalid_session_token" }, { status: 401 });
    const sessions = new SudokuSessionRepository(env.DB);
    const session = await sessions.findById(payload.sessionId);
    if (!session || session.puzzleId !== payload.puzzleId || session.anonymousId !== payload.anonymousId || session.challengeNonce !== payload.nonce) {
      return NextResponse.json({ error: "session_mismatch" }, { status: 401 });
    }
    if (session.status === "won" || session.status === "rejected") {
      return NextResponse.json({ error: "session_closed" }, { status: 409 });
    }
    const puzzle = await new SudokuPuzzleRepository(env.DB).findById(session.puzzleId);
    if (!puzzle) return NextResponse.json({ error: "puzzle_not_found" }, { status: 404 });
    const board = parseBoard(body.board);
    if (findGivenViolations(parseBoard(puzzle.givens), board).length) {
      return NextResponse.json({ error: "givens_modified" }, { status: 422 });
    }
    await sessions.saveProgress({
      id: session.id,
      boardState: { values: [...board] },
      notes: body.notes,
      mistakes: body.mistakes as number,
      durationSeconds: body.elapsedSeconds as number,
      status: body.paused ? "paused" : "in_progress",
      now,
    });
    return NextResponse.json({ saved: true, savedAt: now });
  } catch {
    return NextResponse.json({ error: "save_failed" }, { status: 503 });
  }
}
