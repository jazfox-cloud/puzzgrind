import { describe, expect, it } from "vitest";

import { hashAnonymousPlayerId } from "@/lib/security/anonymous-player";

describe("anonymous leaderboard identity", () => {
  it("creates a stable, non-reversible keyed hash without exposing the player id", async () => {
    const first = await hashAnonymousPlayerId("player-123", "test-secret");
    const second = await hashAnonymousPlayerId("player-123", "test-secret");
    expect(first).toBe(second);
    expect(first).toMatch(/^[a-f0-9]{64}$/u);
    expect(first).not.toContain("player-123");
    expect(await hashAnonymousPlayerId("player-123", "other-secret")).not.toBe(first);
  });
});
