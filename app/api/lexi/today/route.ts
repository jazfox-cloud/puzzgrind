import { getCloudflareContext } from "@opennextjs/cloudflare";
import { NextResponse } from "next/server";
import { limitApiRequest } from "@/lib/api/rate-limit";
import { LexiPuzzleRepository } from "@/lib/db";
import { nextUtcMidnight, utcDate } from "@/lib/daily/utc";

export async function GET(request: Request) {
  try {
    const { env } = getCloudflareContext();
    const limited = await limitApiRequest(request, env, "lexiToday");
    if (limited) return limited;
    const puzzle = await new LexiPuzzleRepository(env.DB).findPublishedByDate(utcDate());
    if (!puzzle) return NextResponse.json({ error: "puzzle_unavailable" }, { status: 503 });
    return NextResponse.json({ puzzleId: puzzle.id, puzzleDate: puzzle.puzzleDate,
      wordLength: puzzle.wordLength, maxAttempts: puzzle.maxAttempts,
      expiresAt: nextUtcMidnight(puzzle.puzzleDate) },
    { headers: { "Cache-Control": "private, no-store" } });
  } catch { return NextResponse.json({ error: "puzzle_unavailable" }, { status: 503 }); }
}
