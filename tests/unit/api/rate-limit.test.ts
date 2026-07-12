import { describe, expect, it } from "vitest";

import { enforceRateLimit, limitApiRequest, rateLimitKey } from "@/lib/api/rate-limit";
import type { RateLimitBinding } from "@/lib/api/rate-limit";

class FakeFixedWindowLimiter implements RateLimitBinding {
  private counts = new Map<string, { count: number; window: number }>();

  constructor(private readonly limitValue: number, private now = 0, private readonly period = 60) {}

  advance(seconds: number) { this.now += seconds; }

  async limit({ key }: { key: string }): Promise<{ success: boolean }> {
    const window = Math.floor(this.now / this.period);
    const current = this.counts.get(key);
    const count = current?.window === window ? current.count + 1 : 1;
    this.counts.set(key, { count, window });
    return { success: count <= this.limitValue };
  }
}

async function check(binding: RateLimitBinding, key: string) {
  return enforceRateLimit({ binding, envName: "test", key, period: 60 });
}

describe("API rate limiting", () => {
  it("allows requests within the limit and returns 429 with Retry-After above it", async () => {
    const limiter = new FakeFixedWindowLimiter(2);
    expect(await check(limiter, "hint:a")).toBeNull();
    expect(await check(limiter, "hint:a")).toBeNull();
    const blocked = await check(limiter, "hint:a");
    expect(blocked?.status).toBe(429);
    expect(blocked?.headers.get("Retry-After")).toBe("60");
  });

  it("recovers after the window and isolates routes and identities", async () => {
    const limiter = new FakeFixedWindowLimiter(1);
    expect(await check(limiter, "hint:a")).toBeNull();
    expect((await check(limiter, "hint:a"))?.status).toBe(429);
    expect(await check(limiter, "save:a")).toBeNull();
    expect(await check(limiter, "hint:b")).toBeNull();
    limiter.advance(60);
    expect(await check(limiter, "hint:a")).toBeNull();
  });

  it("permits the normal 60-per-minute save budget", async () => {
    const limiter = new FakeFixedWindowLimiter(60);
    for (let index = 0; index < 60; index += 1) expect(await check(limiter, "save:session")).toBeNull();
    expect((await check(limiter, "save:session"))?.status).toBe(429);
  });

  it("fails closed in deployed environments when the binding is missing", async () => {
    expect((await enforceRateLimit({ envName: "production", key: "x", period: 60 }))?.status).toBe(503);
    expect((await enforceRateLimit({ envName: "preview", key: "x", period: 60 }))?.status).toBe(503);
    expect((await enforceRateLimit({ envName: "staging", key: "x", period: 60 }))?.status).toBe(503);
    expect(await enforceRateLimit({ envName: "local", key: "x", period: 60 })).toBeNull();
    expect(await enforceRateLimit({ envName: "test", key: "x", period: 60 })).toBeNull();
  });

  it("uses a configured binding in preview", async () => {
    const binding = new FakeFixedWindowLimiter(1);
    const env = { APP_ENV: "preview", RATE_LIMIT_HINT: binding } as unknown as CloudflareEnv;
    const request = new Request("https://preview.puzzgrind.test", {
      headers: { "cf-connecting-ip": "203.0.113.4" },
    });
    expect(await limitApiRequest(request, env, "hint", "session-1")).toBeNull();
    expect((await limitApiRequest(request, env, "hint", "session-1"))?.status).toBe(429);
  });

  it("rejects a missing trusted client IP in deployed environments", async () => {
    const request = new Request("https://preview.puzzgrind.test", {
      headers: { "x-forwarded-for": "198.51.100.2" },
    });
    const response = await limitApiRequest(request, { APP_ENV: "preview" } as CloudflareEnv, "hint");
    expect(response?.status).toBe(503);
    expect(await response?.json()).toEqual({ error: "client_identity_unavailable" });
  });

  it("uses an explicit local fallback when the trusted client IP is absent", () => {
    const request = new Request("http://localhost:3000");
    expect(rateLimitKey(request, "hint", "session-1", "local")).toBe("hint:local:session-1");
    expect(rateLimitKey(request, "hint", "session-1", "test")).toBe("hint:local:session-1");
  });

  it("uses only Cloudflare's trusted IP header", () => {
    const request = new Request("https://puzzgrind.test", {
      headers: { "cf-connecting-ip": "203.0.113.4", "x-forwarded-for": "198.51.100.2" },
    });
    expect(rateLimitKey(request, "hint", "session-1")).toBe("hint:203.0.113.4:session-1");
  });
});
