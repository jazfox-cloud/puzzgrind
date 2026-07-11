import { getCloudflareContext } from "@opennextjs/cloudflare";
import { NextResponse } from "next/server";

import { SudokuSessionRepository } from "@/lib/db";
import { parseBoard } from "@/lib/sudoku";
import { readDailyPuzzle, utcDate } from "@/lib/sudoku/daily";

const anonymousIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const anonymousId = typeof body === "object" && body && "anonymousId" in body ? body.anonymousId : null;
  if (typeof anonymousId !== "string" || !anonymousIdPattern.test(anonymousId)) {
    return NextResponse.json({ error: "invalid_anonymous_id" }, { status: 400 });
  }

  try {
    const db = getCloudflareContext().env.DB;
    const puzzle = await readDailyPuzzle(db, utcDate());
    if (!puzzle) return NextResponse.json({ error: "daily_puzzle_unavailable" }, { status: 404 });
    const repository = new SudokuSessionRepository(db);
    const existing = await repository.findByAnonymousPuzzle(anonymousId, puzzle.puzzleId);
    if (existing) {
      return NextResponse.json({ sessionId: existing.id, restored: true, status: existing.status });
    }

    const now = Math.floor(Date.now() / 1000);
    const sessionId = crypto.randomUUID();
    const challengeNonce = crypto.randomUUID();
    await repository.create({
      id: sessionId,
      anonymousId,
      puzzleId: puzzle.puzzleId,
      status: "started",
      boardState: { values: [...parseBoard(puzzle.givens)] },
      notes: Array.from({ length: 81 }, () => []),
      mistakes: 0,
      hintCount: 0,
      maxHintLevel: 0,
      durationSeconds: null,
      challengeNonce,
      startedAt: now,
      completedAt: null,
      updatedAt: now,
    });
    return NextResponse.json({ sessionId, challengeNonce, restored: false, status: "started" }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "session_start_failed" }, { status: 503 });
  }
}
