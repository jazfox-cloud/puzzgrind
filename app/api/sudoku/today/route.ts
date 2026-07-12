import { getCloudflareContext } from "@opennextjs/cloudflare";
import { NextResponse } from "next/server";

import { readDailyPuzzle, utcDate } from "@/lib/sudoku/daily";

export async function GET() {
  try {
    const date = utcDate();
    const { env } = getCloudflareContext();
    const puzzle = await readDailyPuzzle(env.DB, date, {
      allowLatestPublished: env.ALLOW_STAGING_PUZZLE_FALLBACK === "true",
    });
    if (!puzzle) {
      return NextResponse.json({ error: "daily_puzzle_unavailable", puzzleDate: date }, { status: 404 });
    }
    return NextResponse.json(puzzle, { headers: { "Cache-Control": "public, max-age=60, s-maxage=300" } });
  } catch {
    return NextResponse.json({ error: "daily_puzzle_unavailable" }, { status: 503 });
  }
}
