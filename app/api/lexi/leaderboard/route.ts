import { getCloudflareContext } from "@opennextjs/cloudflare";
import { NextResponse } from "next/server";
import { isJsonObject, JSON_BODY_LIMITS, readJsonBody } from "@/lib/api/request";
import { limitApiRequest } from "@/lib/api/rate-limit";
import { isPlayableLexiPuzzle, LexiLeaderboardRepository, LexiPuzzleRepository } from "@/lib/db";
import type { RankedLexiLeaderboardEntry } from "@/lib/db";
import { utcDate } from "@/lib/daily/utc";
import { normalizeDisplayName } from "@/lib/leaderboard/display-name";
import { hashAnonymousPlayerId } from "@/lib/security/anonymous-player";
import { authorizeLexiSession } from "@/lib/security/lexi-session-authorization";

function bearer(request: Request): string | null {
  const value = request.headers.get("authorization");
  return value?.startsWith("Bearer ") ? value.slice(7).trim() || null : null;
}
function publicEntry(entry: RankedLexiLeaderboardEntry, own: string | null) {
  return { displayName: entry.displayName, hints: entry.verifiedHintsUsed,
    attempts: entry.verifiedAttempts, completionSeconds: entry.verifiedCompletionSeconds,
    rank: entry.rank, isYou: own !== null && own === entry.playerKeyHash };
}
async function snapshot(db: CloudflareEnv["DB"], puzzleId: string, puzzleDate: string,
  limit: 10 | 20, own: string | null) {
  const repository = new LexiLeaderboardRepository(db);
  const [entries, ownEntry] = await Promise.all([repository.top(puzzleId, limit),
    own ? repository.rankForPlayer(puzzleId, own) : Promise.resolve(null)]);
  return { puzzleId, puzzleDate, joinedCount: entries[0]?.totalCount ?? ownEntry?.totalCount ?? 0,
    entries: entries.map((entry) => publicEntry(entry, own)), ownRank: ownEntry?.rank ?? null };
}

export async function GET(request: Request) {
  try {
    const { env } = getCloudflareContext();
    const puzzle = await new LexiPuzzleRepository(env.DB).findPlayableByDate(utcDate());
    if (!puzzle) return NextResponse.json({ error: "puzzle_unavailable" }, { status: 503 });
    const limited = await limitApiRequest(request, env, "lexiLeaderboardQuery", puzzle.id);
    if (limited) return limited;
    let own: string | null = null;
    const token = bearer(request);
    if (token) {
      const authorization = await authorizeLexiSession({ allowedStatuses: ["started", "in_progress", "won", "lost"],
        db: env.DB, now: Math.floor(Date.now() / 1_000), secret: env.SESSION_SIGNING_SECRET, token });
      if (authorization.ok && authorization.session.puzzleId === puzzle.id) {
        own = await hashAnonymousPlayerId(authorization.session.anonymousId, env.SESSION_SIGNING_SECRET);
      }
    }
    const limit = new URL(request.url).searchParams.get("limit") === "20" ? 20 : 10;
    return NextResponse.json(await snapshot(env.DB, puzzle.id, puzzle.puzzleDate, limit, own),
      { headers: { "Cache-Control": "private, no-store" } });
  } catch { return NextResponse.json({ error: "leaderboard_unavailable" }, { status: 503 }); }
}

export async function POST(request: Request) {
  const parsed = await readJsonBody<unknown>(request, JSON_BODY_LIMITS.lexiLeaderboardSubmit);
  if (!parsed.ok) return parsed.response;
  if (!isJsonObject(parsed.value) || typeof parsed.value.token !== "string") {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }
  const name = normalizeDisplayName(parsed.value.nickname);
  if (!name.ok) return NextResponse.json({ error: name.error }, { status: 400 });
  try {
    const { env } = getCloudflareContext();
    const now = Math.floor(Date.now() / 1_000);
    const authorization = await authorizeLexiSession({ allowedStatuses: ["won"], db: env.DB,
      now, secret: env.SESSION_SIGNING_SECRET, token: parsed.value.token });
    if (!authorization.ok) return authorization.response;
    const session = authorization.session;
    const limited = await limitApiRequest(request, env, "lexiLeaderboardSubmit", session.id);
    if (limited) return limited;
    const puzzle = await new LexiPuzzleRepository(env.DB).findById(session.puzzleId);
    if (!puzzle || !isPlayableLexiPuzzle(puzzle, utcDate(new Date(now * 1_000))) ||
      session.completedAt === null || session.durationSeconds === null) {
      return NextResponse.json({ error: "session_expired" }, { status: 409 });
    }
    const playerKeyHash = await hashAnonymousPlayerId(session.anonymousId, env.SESSION_SIGNING_SECRET);
    const result = await new LexiLeaderboardRepository(env.DB).createOrReturn({ id: crypto.randomUUID(),
      puzzleId: puzzle.id, puzzleDate: puzzle.puzzleDate, playerKeyHash, displayName: name.value,
      verifiedHintsUsed: session.hintCount, verifiedAttempts: session.attemptCount,
      verifiedCompletionSeconds: session.durationSeconds, completedAt: session.completedAt,
      createdAt: now, sessionId: session.id });
    return NextResponse.json(await snapshot(env.DB, puzzle.id, puzzle.puzzleDate, 20, playerKeyHash),
      { status: result.created ? 201 : 200, headers: { "Cache-Control": "private, no-store" } });
  } catch { return NextResponse.json({ error: "leaderboard_unavailable" }, { status: 503 }); }
}
