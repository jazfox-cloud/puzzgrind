// @vitest-environment node
import { describe, expect, it } from "vitest";
import { createLexiSessionToken, verifyLexiSessionToken } from "@/lib/security/lexi-session-token";
import { createSessionToken, verifySessionTokenDetailed } from "@/lib/security/session-token";

const base = { anonymousId: "anonymous-test", sessionId: "session-test", puzzleId: "puzzle-test", nonce: "nonce-test", issuedAt: 100 };

describe("Lexi session token scope", () => {
  it("round trips with explicit scope and expiry", async () => {
    const token = await createLexiSessionToken({ ...base, expiresAt: 200 }, "secret");
    const result = await verifyLexiSessionToken(token, "secret", 150);
    expect(result).toMatchObject({ ok: true, payload: { scope: "lexi_daily", expiresAt: 200 } });
    expect(await verifyLexiSessionToken(token, "secret", 200)).toEqual({ ok: false, reason: "expired" });
  });

  it("rejects Sudoku tokens in Lexi and Lexi tokens in Sudoku", async () => {
    const sudoku = await createSessionToken(base, "secret");
    const lexi = await createLexiSessionToken({ ...base, expiresAt: 200 }, "secret");
    expect(await verifyLexiSessionToken(sudoku, "secret", 150)).toEqual({ ok: false, reason: "invalid" });
    expect(await verifySessionTokenDetailed(lexi, "secret", 150)).toEqual({ ok: false, reason: "invalid" });
  });
});
