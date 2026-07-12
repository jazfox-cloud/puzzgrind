import { getCloudflareContext } from "@opennextjs/cloudflare";
import { NextResponse } from "next/server";

import { SudokuPuzzleRepository, SudokuSessionRepository, SudokuStatsRepository } from "@/lib/db";
import { verifySessionToken } from "@/lib/security/session-token";
import { findGivenViolations, isCompleteValidBoard, parseBoard, serializeBoard } from "@/lib/sudoku";

type CompleteRequest = { board?: unknown; elapsedSeconds?: unknown; mistakes?: unknown; notes?: unknown; token?: unknown };

export async function POST(request: Request) {
  let body: CompleteRequest;
  try { body = await request.json() as CompleteRequest; } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  if (
    typeof body.token !== "string" || typeof body.board !== "string" || !Array.isArray(body.notes) ||
    !Number.isInteger(body.elapsedSeconds) || (body.elapsedSeconds as number) < 1 || (body.elapsedSeconds as number) > 86400 ||
    !Number.isInteger(body.mistakes) || (body.mistakes as number) < 0 || (body.mistakes as number) > 999
  ) return NextResponse.json({ error: "invalid_complete_request" }, { status: 400 });

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
    if (session.status === "won") return NextResponse.json({ error: "already_completed" }, { status: 409 });
    const puzzle = await new SudokuPuzzleRepository(env.DB).findById(session.puzzleId);
    if (!puzzle) return NextResponse.json({ error: "puzzle_not_found" }, { status: 404 });
    const board = parseBoard(body.board);
    if (
      findGivenViolations(parseBoard(puzzle.givens), board).length || !isCompleteValidBoard(board) ||
      serializeBoard(board) !== puzzle.solution
    ) return NextResponse.json({ error: "invalid_solution" }, { status: 422 });

    const duration = body.elapsedSeconds as number;
    const mistakes = Math.max(session.mistakes, body.mistakes as number);
    await env.DB.batch([
      env.DB.prepare(`
        UPDATE sudoku_sessions
        SET status = 'won', board_state_json = ?, notes_json = ?, mistakes = ?,
            duration_seconds = ?, completed_at = ?, updated_at = ?
        WHERE id = ? AND status NOT IN ('won', 'rejected')
      `).bind(JSON.stringify({ values: [...board] }), JSON.stringify(body.notes), mistakes, duration, now, now, session.id),
      env.DB.prepare(`
        UPDATE sudoku_puzzle_stats
        SET completion_count = completion_count + 1,
            total_completion_seconds = total_completion_seconds + ?,
            total_mistakes = total_mistakes + ?,
            total_hints = total_hints + ?,
            no_hint_completions = no_hint_completions + ?,
            updated_at = ?
        WHERE puzzle_id = ?
      `).bind(duration, mistakes, session.hintCount, session.hintCount === 0 ? 1 : 0, now, puzzle.id),
    ]);
    const stats = await new SudokuStatsRepository(env.DB).findByPuzzleId(puzzle.id);
    return NextResponse.json({
      completed: true,
      result: { durationSeconds: duration, mistakes, hintCount: session.hintCount, maxHintLevel: session.maxHintLevel },
      sample: stats ? {
        starts: stats.startCount,
        completions: stats.completionCount,
        totalCompletionSeconds: stats.totalCompletionSeconds,
        totalHints: stats.totalHints,
      } : null,
    });
  } catch {
    return NextResponse.json({ error: "complete_failed" }, { status: 503 });
  }
}
