import { getCloudflareContext } from "@opennextjs/cloudflare";
import { NextResponse } from "next/server";

import { isJsonObject, JSON_BODY_LIMITS, readJsonBody } from "@/lib/api/request";
import { limitApiRequest } from "@/lib/api/rate-limit";
import {
  DatabaseError,
  SudokuLeaderboardRepository,
  SudokuPuzzleRepository,
  SudokuStatsRepository,
} from "@/lib/db";
import type { RankedSudokuLeaderboardEntry } from "@/lib/db";
import { hashAnonymousPlayerId } from "@/lib/security/anonymous-player";
import { authorizeSession } from "@/lib/security/session-authorization";
import { utcDate } from "@/lib/sudoku/daily";
import {
  MAX_LEADERBOARD_SECONDS,
  MIN_LEADERBOARD_SECONDS,
  normalizeDisplayName,
} from "@/lib/sudoku/leaderboard";
import type { LeaderboardSnapshot } from "@/lib/sudoku/leaderboard";

type SubmitRequest = { displayName?: unknown; token?: unknown };

function publicEntry(entry: RankedSudokuLeaderboardEntry, playerKeyHash: string | null) {
  return {
    displayName: entry.displayName,
    durationSeconds: entry.verifiedCompletionSeconds,
    hintsUsed: entry.verifiedHintsUsed,
    isYou: playerKeyHash !== null && entry.playerKeyHash === playerKeyHash,
    rank: entry.rank,
  };
}

async function snapshot(input: {
  db: CloudflareEnv["DB"];
  limit: 10 | 20;
  playerKeyHash: string | null;
  puzzleDate: string;
  puzzleId: string;
}): Promise<LeaderboardSnapshot> {
  const repository = new SudokuLeaderboardRepository(input.db);
  const [entries, ownEntry, stats] = await Promise.all([
    repository.top(input.puzzleId, input.limit),
    input.playerKeyHash ? repository.rankForPlayer(input.puzzleId, input.playerKeyHash) : Promise.resolve(null),
    new SudokuStatsRepository(input.db).findByPuzzleId(input.puzzleId),
  ]);
  const joinedCount = entries[0]?.totalCount ?? ownEntry?.totalCount ?? 0;
  return {
    completionCount: stats?.completionCount ?? 0,
    entries: entries.map((entry) => publicEntry(entry, input.playerKeyHash)),
    joinedCount,
    ownRank: ownEntry?.rank ?? null,
    puzzleDate: input.puzzleDate,
    puzzleId: input.puzzleId,
  };
}

function bearerToken(request: Request): string | null {
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) return null;
  const token = authorization.slice("Bearer ".length).trim();
  return token || null;
}

export async function GET(request: Request) {
  try {
    const { env } = getCloudflareContext();
    const today = utcDate();
    const puzzle = await new SudokuPuzzleRepository(env.DB).findByDate(today);
    if (!puzzle || puzzle.status !== "published") {
      return NextResponse.json({ error: "puzzle_not_found" }, { status: 404 });
    }
    const limited = await limitApiRequest(request, env, "leaderboardQuery", puzzle.id);
    if (limited) return limited;

    let playerKeyHash: string | null = null;
    const token = bearerToken(request);
    if (token) {
      const authorization = await authorizeSession({
        allowedStatuses: ["started", "in_progress", "paused", "won"],
        db: env.DB,
        now: Math.floor(Date.now() / 1000),
        secret: env.SESSION_SIGNING_SECRET,
        token,
      });
      if (authorization.ok && authorization.session.puzzleId === puzzle.id) {
        playerKeyHash = await hashAnonymousPlayerId(authorization.session.anonymousId, env.SESSION_SIGNING_SECRET);
      }
    }

    const limit = new URL(request.url).searchParams.get("limit") === "20" ? 20 : 10;
    return NextResponse.json(await snapshot({
      db: env.DB,
      limit,
      playerKeyHash,
      puzzleDate: puzzle.puzzleDate,
      puzzleId: puzzle.id,
    }), { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return NextResponse.json({ error: "leaderboard_unavailable" }, { status: 503 });
  }
}

export async function POST(request: Request) {
  const bodyResult = await readJsonBody<SubmitRequest>(request, JSON_BODY_LIMITS.leaderboardSubmit);
  if (!bodyResult.ok) return bodyResult.response;
  const body = bodyResult.value;
  if (!isJsonObject(body) || typeof body.token !== "string") {
    return NextResponse.json({ error: "invalid_leaderboard_request" }, { status: 400 });
  }
  const displayName = normalizeDisplayName(body.displayName);
  if (!displayName.ok) return NextResponse.json({ error: displayName.error }, { status: 400 });

  try {
    const { env } = getCloudflareContext();
    const now = Math.floor(Date.now() / 1000);
    const authorization = await authorizeSession({
      allowedStatuses: ["won"],
      db: env.DB,
      now,
      secret: env.SESSION_SIGNING_SECRET,
      token: body.token,
    });
    if (!authorization.ok) return authorization.response;
    const session = authorization.session;
    const limited = await limitApiRequest(request, env, "leaderboardSubmit", session.id);
    if (limited) return limited;

    const puzzle = await new SudokuPuzzleRepository(env.DB).findById(session.puzzleId);
    if (!puzzle || puzzle.status !== "published" || puzzle.puzzleDate !== utcDate(new Date(now * 1000))) {
      return NextResponse.json({ error: "leaderboard_closed" }, { status: 409 });
    }
    if (session.completedAt === null || session.completedAt < session.startedAt) {
      return NextResponse.json({ error: "completion_not_verified" }, { status: 409 });
    }

    const verifiedCompletionSeconds = session.completedAt - session.startedAt;
    if (verifiedCompletionSeconds < MIN_LEADERBOARD_SECONDS || verifiedCompletionSeconds > MAX_LEADERBOARD_SECONDS) {
      await new SudokuLeaderboardRepository(env.DB).recordRejection({
        completedAt: session.completedAt,
        id: crypto.randomUUID(),
        now,
        puzzleId: puzzle.id,
        reason: verifiedCompletionSeconds < MIN_LEADERBOARD_SECONDS ? "completion_too_fast" : "completion_too_slow",
        sessionId: session.id,
      });
      return NextResponse.json({ error: "completion_not_eligible" }, { status: 422 });
    }

    const playerKeyHash = await hashAnonymousPlayerId(session.anonymousId, env.SESSION_SIGNING_SECRET);
    const repository = new SudokuLeaderboardRepository(env.DB);
    try {
      await repository.create({
        completedAt: session.completedAt,
        createdAt: now,
        displayName: displayName.value,
        id: crypto.randomUUID(),
        playerKeyHash,
        puzzleDate: puzzle.puzzleDate,
        puzzleId: puzzle.id,
        sessionId: session.id,
        verifiedCompletionSeconds,
        verifiedHintsUsed: session.hintCount,
      });
    } catch (error) {
      if (error instanceof DatabaseError && error.code === "constraint") {
        return NextResponse.json({ error: "leaderboard_already_joined" }, { status: 409 });
      }
      throw error;
    }

    return NextResponse.json(await snapshot({
      db: env.DB,
      limit: 20,
      playerKeyHash,
      puzzleDate: puzzle.puzzleDate,
      puzzleId: puzzle.id,
    }), { status: 201, headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return NextResponse.json({ error: "leaderboard_submit_failed" }, { status: 503 });
  }
}
