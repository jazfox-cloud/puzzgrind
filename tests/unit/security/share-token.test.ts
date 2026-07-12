import { describe, expect, it } from "vitest";

import { createShareToken, verifyShareToken } from "@/lib/security/share-token";

const payload = {
  puzzleDate: "2026-07-12",
  durationSeconds: 127,
  mistakes: 0,
  hintCount: 1,
  maxHintLevel: 1 as const,
  issuedAt: 1_783_818_000,
};

describe("public Sudoku share tokens", () => {
  it("round-trips a valid result without anonymous identity", async () => {
    const token = await createShareToken(payload, "test-secret");
    expect(await verifyShareToken(token, "test-secret")).toEqual(payload);
    expect(token).not.toContain("anonymous");
  });

  it("rejects tampering and a different secret", async () => {
    const token = await createShareToken(payload, "test-secret");
    expect(await verifyShareToken(`${token}x`, "test-secret")).toBeNull();
    expect(await verifyShareToken(token, "different-secret")).toBeNull();
  });

  it("rejects invalid public result data", async () => {
    await expect(createShareToken({ ...payload, durationSeconds: 0 }, "test-secret")).rejects.toThrow("Invalid share payload");
  });
});
