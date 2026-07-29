import { getCloudflareContext } from "@opennextjs/cloudflare";
import { NextResponse } from "next/server";
import { isJsonObject, JSON_BODY_LIMITS, readJsonBody } from "@/lib/api/request";
import { limitApiRequest } from "@/lib/api/rate-limit";
import { isPlayableLexiPuzzle, LexiPuzzleRepository, LexiSessionRepository } from "@/lib/db";
import { utcDate } from "@/lib/daily/utc";
import { determineLexiStatus, evaluateLexiGuess, normalizeValidLexiWord } from "@/lib/lexi";
import { validLexiGuesses } from "@/lib/lexi/server/lexicon";
import { authorizeLexiSession } from "@/lib/security/lexi-session-authorization";

export async function POST(request: Request) {
  const parsed = await readJsonBody<unknown>(request, JSON_BODY_LIMITS.lexiGuess);
  if (!parsed.ok) return parsed.response;
  if (!isJsonObject(parsed.value) || typeof parsed.value.token !== "string" ||
    typeof parsed.value.guess !== "string" || !Number.isInteger(parsed.value.revision)) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }
  const guess = normalizeValidLexiWord(parsed.value.guess);
  if (!guess || !validLexiGuesses.has(guess)) return NextResponse.json({ error: "invalid_word" }, { status: 422 });
  try {
    const { env } = getCloudflareContext();
    const now = Math.floor(Date.now() / 1_000);
    const authorization = await authorizeLexiSession({ allowedStatuses: ["started", "in_progress", "won", "lost"],
      db: env.DB, now, secret: env.SESSION_SIGNING_SECRET, token: parsed.value.token });
    if (!authorization.ok) return authorization.response;
    const session = authorization.session;
    const limited = await limitApiRequest(request, env, "lexiGuess", session.id);
    if (limited) return limited;
    const puzzle = await new LexiPuzzleRepository(env.DB).findById(session.puzzleId);
    if (!puzzle || !isPlayableLexiPuzzle(puzzle, utcDate(new Date(now * 1_000)))) {
      await new LexiSessionRepository(env.DB).expire(session.id, session.revision, now);
      return NextResponse.json({ error: "session_expired" }, { status: 409 });
    }
    if (session.guesses.some((row) => row.guess === guess)) {
      return NextResponse.json({ error: "duplicate_guess" }, { status: 409 });
    }
    if (session.status === "won" || session.status === "lost") {
      return NextResponse.json({ error: "already_completed" }, { status: 409 });
    }
    const evaluation = evaluateLexiGuess(puzzle.answer, guess);
    const guesses = [...session.guesses, { guess, evaluation }];
    const status = determineLexiStatus(guesses, puzzle.answer);
    const committed = await new LexiSessionRepository(env.DB).commitGuess({
      id: session.id, expectedRevision: parsed.value.revision as number, guess, guesses, status, now,
    });
    if (!committed.ok) {
      const statusCode = committed.reason === "revision_conflict" ? 409 : 409;
      return NextResponse.json({ error: committed.reason }, { status: statusCode });
    }
    return NextResponse.json({ evaluation, status: committed.session.status,
      attemptCount: committed.session.attemptCount, revision: committed.session.revision,
      durationSeconds: committed.session.durationSeconds,
      ...(committed.session.status === "lost" ? { answer: puzzle.answer } : {}) },
    { headers: { "Cache-Control": "private, no-store" } });
  } catch { return NextResponse.json({ error: "guess_unavailable" }, { status: 503 }); }
}
