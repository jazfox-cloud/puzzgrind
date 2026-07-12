import { describe, expect, it } from "vitest";

import { createSessionToken, verifySessionToken } from "@/lib/security/session-token";

const payload = { sessionId: "s1", puzzleId: "p1", anonymousId: "a1", issuedAt: 1000, nonce: "n1" };

describe("session token", () => {
  it("round-trips a valid signed payload", async () => {
    const token = await createSessionToken(payload, "test-secret-with-enough-entropy");
    await expect(verifySessionToken(token, "test-secret-with-enough-entropy", 1200)).resolves.toEqual(payload);
  });

  it("rejects tampering, wrong secrets, and expired tokens", async () => {
    const token = await createSessionToken(payload, "test-secret-with-enough-entropy");
    await expect(verifySessionToken(`${token}x`, "test-secret-with-enough-entropy", 1200)).resolves.toBeNull();
    await expect(verifySessionToken(token, "wrong-secret", 1200)).resolves.toBeNull();
    await expect(verifySessionToken(token, "test-secret-with-enough-entropy", 1000 + 8 * 86400)).resolves.toBeNull();
  });
});
