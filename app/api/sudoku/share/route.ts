import { getCloudflareContext } from "@opennextjs/cloudflare";
import { NextResponse } from "next/server";

import { SudokuPuzzleRepository } from "@/lib/db";
import { isJsonObject, JSON_BODY_LIMITS, readJsonBody } from "@/lib/api/request";
import { limitApiRequest } from "@/lib/api/rate-limit";
import { createShareToken } from "@/lib/security/share-token";
import { authorizeSession } from "@/lib/security/session-authorization";

export async function POST(request: Request) {
  const bodyResult = await readJsonBody<{ token?: unknown }>(request, JSON_BODY_LIMITS.share);
  if (!bodyResult.ok) return bodyResult.response;
  if (!isJsonObject(bodyResult.value)) return NextResponse.json({ error: "invalid_share_request" }, { status: 400 });
  const token = bodyResult.value.token;
  if (typeof token !== "string") return NextResponse.json({ error: "invalid_share_request" }, { status: 400 });

  try {
    const { env } = getCloudflareContext();
    const now = Math.floor(Date.now() / 1000);
    const authorization = await authorizeSession({
      allowedStatuses: ["won"], db: env.DB, now, secret: env.SESSION_SIGNING_SECRET, token,
    });
    if (!authorization.ok) return authorization.response;
    const session = authorization.session;
    if (session.durationSeconds === null) return NextResponse.json({ error: "completed_session_required" }, { status: 409 });
    const limited = await limitApiRequest(request, env, "share", session.id);
    if (limited) return limited;
    const puzzle = await new SudokuPuzzleRepository(env.DB).findById(session.puzzleId);
    if (!puzzle) return NextResponse.json({ error: "puzzle_not_found" }, { status: 404 });
    const shareToken = await createShareToken({
      puzzleDate: puzzle.puzzleDate,
      durationSeconds: session.durationSeconds,
      mistakes: session.mistakes,
      hintCount: session.hintCount,
      maxHintLevel: session.maxHintLevel,
      issuedAt: now,
    }, env.SESSION_SIGNING_SECRET);
    const url = new URL(`/sudoku/share/${shareToken}`, request.url).toString();
    return NextResponse.json({ url });
  } catch {
    return NextResponse.json({ error: "share_creation_failed" }, { status: 503 });
  }
}
