import { getCloudflareContext } from "@opennextjs/cloudflare";
import { NextResponse } from "next/server";
import { isJsonObject, JSON_BODY_LIMITS, readJsonBody } from "@/lib/api/request";
import { limitApiRequest } from "@/lib/api/rate-limit";
import { LexiHintRepository, LexiPuzzleRepository } from "@/lib/db";
import { utcDate } from "@/lib/daily/utc";
import { selectLexiHintLetter } from "@/lib/lexi";
import { authorizeLexiSession } from "@/lib/security/lexi-session-authorization";

export async function POST(request: Request) {
  const parsed = await readJsonBody<unknown>(request, JSON_BODY_LIMITS.lexiHint);
  if (!parsed.ok) return parsed.response;
  if (!isJsonObject(parsed.value) || typeof parsed.value.token !== "string") {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }
  try {
    const { env } = getCloudflareContext();
    const now = Math.floor(Date.now() / 1_000);
    const authorization = await authorizeLexiSession({ allowedStatuses: ["started", "in_progress", "won", "lost"],
      db: env.DB, now, secret: env.SESSION_SIGNING_SECRET, token: parsed.value.token });
    if (!authorization.ok) return authorization.response;
    const session = authorization.session;
    const limited = await limitApiRequest(request, env, "lexiHint", session.id);
    if (limited) return limited;
    const hints = new LexiHintRepository(env.DB);
    const prior = await hints.findBySession(session.id);
    if (prior) return NextResponse.json({ hintCount: 1, letter: prior.revealedLetter },
      { headers: { "Cache-Control": "private, no-store" } });
    if (session.status === "won" || session.status === "lost") {
      return NextResponse.json({ error: "already_completed" }, { status: 409 });
    }
    const puzzle = await new LexiPuzzleRepository(env.DB).findById(session.puzzleId);
    if (!puzzle || puzzle.status !== "published" || puzzle.puzzleDate !== utcDate(new Date(now * 1_000))) {
      return NextResponse.json({ error: "session_expired" }, { status: 409 });
    }
    const selected = selectLexiHintLetter({ answer: puzzle.answer, guesses: session.guesses,
      hintsUsed: session.hintCount, status: "in_progress" });
    if (!selected.ok) {
      const error = selected.error === "no_hint_available" ? "no_hint_available" : "hint_unavailable";
      return NextResponse.json({ error }, { status: 409 });
    }
    const result = await hints.createOrReturn({ id: crypto.randomUUID(), sessionId: session.id,
      puzzleId: puzzle.id, revealedLetter: selected.letter, createdAt: now });
    if (!result.event) return NextResponse.json({ error: "hint_unavailable" }, { status: 409 });
    return NextResponse.json({ hintCount: 1, letter: result.event.revealedLetter },
      { headers: { "Cache-Control": "private, no-store" } });
  } catch { return NextResponse.json({ error: "hint_unavailable" }, { status: 503 }); }
}
