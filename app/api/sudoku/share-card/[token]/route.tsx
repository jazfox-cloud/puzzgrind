import { getCloudflareContext } from "@opennextjs/cloudflare";
import { ImageResponse } from "next/og";

import { verifyShareToken } from "@/lib/security/share-token";

export async function GET(_: Request, context: { params: Promise<{ token: string }> }) {
  const { token } = await context.params;
  const result = await verifyShareToken(token, getCloudflareContext().env.SESSION_SIGNING_SECRET);
  if (!result) return new Response("Not found", { status: 404 });
  const formattedTime = `${String(Math.floor(result.durationSeconds / 60)).padStart(2, "0")}:${String(result.durationSeconds % 60).padStart(2, "0")}`;
  return new ImageResponse(
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "64px 72px", background: "#f6f3ea", color: "#14221d", fontFamily: "Arial, sans-serif" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}><span style={{ fontSize: 34, fontWeight: 800 }}>PuzzGrind</span><span style={{ padding: "12px 22px", borderRadius: 999, background: "#dbff6e", fontSize: 22, fontWeight: 800, letterSpacing: 3 }}>DAILY SUDOKU</span></div>
      <div style={{ display: "flex", flexDirection: "column" }}><span style={{ fontSize: 24, color: "#08715a", fontWeight: 800, letterSpacing: 5 }}>VERIFIED RESULT · {result.puzzleDate}</span><span style={{ marginTop: 18, fontSize: 86, lineHeight: 1, fontWeight: 900, letterSpacing: -5 }}>Puzzle complete.</span></div>
      <div style={{ display: "flex", gap: 18 }}>
        {[["TIME", formattedTime], ["MISTAKES", String(result.mistakes)], ["HINTS", String(result.hintCount)]].map(([label, value]) => <div key={label} style={{ display: "flex", flex: 1, flexDirection: "column", padding: "24px 28px", borderRadius: 22, background: "#ffffff" }}><span style={{ fontSize: 18, color: "#50615a", letterSpacing: 2 }}>{label}</span><span style={{ marginTop: 8, fontSize: 42, fontWeight: 900 }}>{value}</span></div>)}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 24, fontWeight: 700 }}><span>Can you beat this result?</span><span>puzzgrind.com/sudoku</span></div>
    </div>,
    { width: 1200, height: 630, headers: { "cache-control": "public, max-age=31536000, immutable" } },
  );
}
