import { getCloudflareContext } from "@opennextjs/cloudflare";
import { NextResponse } from "next/server";

import { SudokuSessionRepository, SudokuStatsRepository } from "@/lib/db";
import { JSON_BODY_LIMITS, readJsonBody } from "@/lib/api/request";
import { limitApiRequest } from "@/lib/api/rate-limit";
import { createSessionToken } from "@/lib/security/session-token";
import { parseBoard } from "@/lib/sudoku";
import { readDailyPuzzle, utcDate } from "@/lib/sudoku/daily";

const anonymousIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(request: Request) {
  const bodyResult = await readJsonBody<unknown>(request, JSON_BODY_LIMITS.sessionStart);
  if (!bodyResult.ok) return bodyResult.response;
  const body = bodyResult.value;
  const anonymousId = typeof body === "object" && body && "anonymousId" in body ? body.anonymousId : null;
  if (typeof anonymousId !== "string" || !anonymousIdPattern.test(anonymousId)) {
    return NextResponse.json({ error: "invalid_anonymous_id" }, { status: 400 });
  }

  try {
    const { env } = getCloudflareContext();
    // IP-only here prevents attackers from evading the creation limit by
    // rotating client-generated anonymous UUIDs.
    const limited = await limitApiRequest(request, env, "sessionStart");
    if (limited) return limited;
    const db = env.DB;
    const puzzle = await readDailyPuzzle(db, utcDate(), {
      allowLatestPublished: env.ALLOW_STAGING_PUZZLE_FALLBACK === "true",
    });
    if (!puzzle) return NextResponse.json({ error: "daily_puzzle_unavailable" }, { status: 404 });
    const repository = new SudokuSessionRepository(db);
    const existing = await repository.findByAnonymousPuzzle(anonymousId, puzzle.puzzleId);
    const now = Math.floor(Date.now() / 1000);
    const challengeNonce = crypto.randomUUID();
    if (existing) {
      await repository.refreshNonce(existing.id, challengeNonce, now);
      const sessionToken = await createSessionToken({
        sessionId: existing.id, puzzleId: puzzle.puzzleId, anonymousId, issuedAt: now, nonce: challengeNonce,
      }, env.SESSION_SIGNING_SECRET);
      return NextResponse.json({
        sessionId: existing.id,
        sessionToken,
        restored: true,
        status: existing.status,
        boardState: existing.boardState,
        notes: existing.notes,
        durationSeconds: existing.durationSeconds,
        mistakes: existing.mistakes,
        hintCount: existing.hintCount,
        maxHintLevel: existing.maxHintLevel,
        result: existing.status === "won" ? {
          durationSeconds: existing.durationSeconds ?? 0,
          mistakes: existing.mistakes,
          hintCount: existing.hintCount,
          maxHintLevel: existing.maxHintLevel,
        } : null,
      });
    }

    const sessionId = crypto.randomUUID();
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
    }, env.APP_ENV);
    await new SudokuStatsRepository(db).recordStart(puzzle.puzzleId, now);
    const sessionToken = await createSessionToken({
      sessionId, puzzleId: puzzle.puzzleId, anonymousId, issuedAt: now, nonce: challengeNonce,
    }, env.SESSION_SIGNING_SECRET);
    return NextResponse.json({ sessionId, sessionToken, restored: false, status: "started" }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "session_start_failed" }, { status: 503 });
  }
}
