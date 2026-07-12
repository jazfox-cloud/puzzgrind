import { getCloudflareContext } from "@opennextjs/cloudflare";
import { NextResponse } from "next/server";

import { SudokuPuzzleRepository, SudokuSessionRepository } from "@/lib/db";
import { isJsonObject, JSON_BODY_LIMITS, readJsonBody } from "@/lib/api/request";
import { limitApiRequest } from "@/lib/api/rate-limit";
import { isValidSudokuNotes } from "@/lib/security/notes";
import { authorizeSession } from "@/lib/security/session-authorization";
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
  const bodyResult = await readJsonBody<SaveRequest>(request, JSON_BODY_LIMITS.sessionSave);
  if (!bodyResult.ok) return bodyResult.response;
  const body = bodyResult.value;
  if (!isJsonObject(body)) return NextResponse.json({ error: "invalid_save_request" }, { status: 400 });
  if (
    typeof body.token !== "string" || typeof body.board !== "string" || !isValidSudokuNotes(body.notes) ||
    !Number.isInteger(body.elapsedSeconds) || (body.elapsedSeconds as number) < 0 || (body.elapsedSeconds as number) > 86400 ||
    !Number.isInteger(body.mistakes) || (body.mistakes as number) < 0 || (body.mistakes as number) > 999 ||
    typeof body.paused !== "boolean"
  ) return NextResponse.json({ error: "invalid_save_request" }, { status: 400 });

  try {
    const { env } = getCloudflareContext();
    const now = Math.floor(Date.now() / 1000);
    const authorization = await authorizeSession({
      allowedStatuses: ["started", "in_progress", "paused"], db: env.DB, now,
      secret: env.SESSION_SIGNING_SECRET, token: body.token,
    });
    if (!authorization.ok) return authorization.response;
    const session = authorization.session;
    const limited = await limitApiRequest(request, env, "sessionSave", session.id);
    if (limited) return limited;
    const sessions = new SudokuSessionRepository(env.DB);
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
