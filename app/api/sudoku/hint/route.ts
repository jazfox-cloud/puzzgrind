import { getCloudflareContext } from "@opennextjs/cloudflare";
import { NextResponse } from "next/server";

import { SudokuHintEventRepository, SudokuPuzzleRepository, SudokuSessionRepository } from "@/lib/db";
import { findConflicts, findGivenViolations, findNextBasicStep, parseBoard } from "@/lib/sudoku";
import { explainStep } from "@/lib/sudoku/hints";
import type { HintLevel } from "@/lib/sudoku/hints";

type HintRequest = { board?: unknown; level?: unknown; sessionId?: unknown };

export async function POST(request: Request) {
  let body: HintRequest;
  try {
    body = await request.json() as HintRequest;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  if (typeof body.sessionId !== "string" || typeof body.board !== "string" || ![1, 2, 3].includes(body.level as number)) {
    return NextResponse.json({ error: "invalid_hint_request" }, { status: 400 });
  }

  try {
    const db = getCloudflareContext().env.DB;
    const sessions = new SudokuSessionRepository(db);
    const session = await sessions.findById(body.sessionId);
    if (!session) return NextResponse.json({ error: "session_not_found" }, { status: 404 });
    const puzzle = await new SudokuPuzzleRepository(db).findById(session.puzzleId);
    if (!puzzle) return NextResponse.json({ error: "puzzle_not_found" }, { status: 404 });
    const board = parseBoard(body.board);
    if (findGivenViolations(parseBoard(puzzle.givens), board).length || findConflicts(board).length) {
      return NextResponse.json({ error: "invalid_board" }, { status: 422 });
    }
    const step = findNextBasicStep(board);
    if (!step) return NextResponse.json({ error: "no_basic_hint_available" }, { status: 409 });
    const level = body.level as HintLevel;
    const now = Math.floor(Date.now() / 1000);
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
