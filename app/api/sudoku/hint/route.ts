import { getCloudflareContext } from "@opennextjs/cloudflare";
import { NextResponse } from "next/server";

import { SudokuHintEventRepository, SudokuPuzzleRepository, SudokuSessionRepository } from "@/lib/db";
import { isJsonObject, JSON_BODY_LIMITS, readJsonBody } from "@/lib/api/request";
import { limitApiRequest } from "@/lib/api/rate-limit";
import { authorizeSession } from "@/lib/security/session-authorization";
import { findConflicts, findGivenViolations, findNextBasicStep, parseBoard } from "@/lib/sudoku";
import { explainStep } from "@/lib/sudoku/hints";
import type { HintLevel } from "@/lib/sudoku/hints";

type HintRequest = { board?: unknown; level?: unknown; sessionId?: unknown; sessionToken?: unknown };

export async function POST(request: Request) {
  const bodyResult = await readJsonBody<HintRequest>(request, JSON_BODY_LIMITS.hint);
  if (!bodyResult.ok) return bodyResult.response;
  const body = bodyResult.value;
  if (!isJsonObject(body)) return NextResponse.json({ error: "invalid_hint_request" }, { status: 400 });
  if (typeof body.sessionToken !== "string") {
    return NextResponse.json({ error: "missing_session_token" }, { status: 400 });
  }
  if (typeof body.sessionId !== "string" || typeof body.board !== "string" || ![1, 2, 3].includes(body.level as number)) {
    return NextResponse.json({ error: "invalid_hint_request" }, { status: 400 });
  }

  try {
    const { env } = getCloudflareContext();
    const db = env.DB;
    const now = Math.floor(Date.now() / 1000);
    const authorization = await authorizeSession({
      allowedStatuses: ["started", "in_progress"], db, now, requestedSessionId: body.sessionId,
      secret: env.SESSION_SIGNING_SECRET, token: body.sessionToken,
    });
    if (!authorization.ok) return authorization.response;
    const session = authorization.session;
    const limited = await limitApiRequest(request, env, "hint", session.id);
    if (limited) return limited;
    const sessions = new SudokuSessionRepository(db);
    const puzzle = await new SudokuPuzzleRepository(db).findById(session.puzzleId);
    if (!puzzle) return NextResponse.json({ error: "puzzle_not_found" }, { status: 404 });
    const board = parseBoard(body.board);
    if (findGivenViolations(parseBoard(puzzle.givens), board).length || findConflicts(board).length) {
      return NextResponse.json({ error: "invalid_board" }, { status: 422 });
    }
    const step = findNextBasicStep(board);
    if (!step) return NextResponse.json({ error: "no_basic_hint_available" }, { status: 409 });
    const level = body.level as HintLevel;
    await new SudokuHintEventRepository(db).create({
      id: crypto.randomUUID(),
      sessionId: session.id,
      puzzleId: puzzle.id,
      technique: step.technique,
      hintLevel: level,
      targetCells: [...step.targetCells],
      createdAt: now,
    });
    await sessions.recordHint(session.id, level, now);
    return NextResponse.json({ hint: explainStep(step, level) });
  } catch {
    return NextResponse.json({ error: "hint_failed" }, { status: 503 });
  }
}
