import { describe, expect, it } from "vitest";

import { readJsonBody } from "@/lib/api/request";

function jsonRequest(body: string, headers?: HeadersInit): Request {
  return new Request("https://puzzgrind.test/api", { method: "POST", body, headers });
}

describe("bounded JSON request reader", () => {
  it("parses a normal request", async () => {
    const result = await readJsonBody<{ ok: boolean }>(jsonRequest('{"ok":true}'), 64);
    expect(result).toEqual({ ok: true, value: { ok: true } });
  });

  it("rejects a declared oversized body before parsing", async () => {
    const result = await readJsonBody(jsonRequest("{}", { "content-length": "65" }), 64);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.response.status).toBe(413);
  });

  it("rejects a streamed oversized body without Content-Length", async () => {
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(`{"value":"${"x".repeat(80)}"}`));
        controller.close();
      },
    });
    const request = new Request("https://puzzgrind.test/api", { method: "POST", body: stream, duplex: "half" } as RequestInit);
    const result = await readJsonBody(request, 64);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.response.status).toBe(413);
  });

  it.each(["", "{"])("rejects empty or invalid JSON", async (body) => {
    const result = await readJsonBody(jsonRequest(body), 64);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.response.status).toBe(400);
  });

  it("accepts valid JSON close to the byte limit", async () => {
    const body = `{"value":"${"x".repeat(50)}"}`;
    const result = await readJsonBody(jsonRequest(body), new TextEncoder().encode(body).byteLength);
    expect(result.ok).toBe(true);
  });
});
