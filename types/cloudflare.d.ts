import type { D1DatabaseLike } from "@/lib/db/d1";
import type { RateLimitBinding } from "@/lib/api/rate-limit";

declare global {
  interface CloudflareEnv {
    ALLOW_STAGING_PUZZLE_FALLBACK?: string;
    APP_ENV?: "local" | "production" | "staging" | "test";
    DB: D1DatabaseLike;
    RATE_LIMIT_COMPLETE?: RateLimitBinding;
    RATE_LIMIT_HINT?: RateLimitBinding;
    RATE_LIMIT_SAVE?: RateLimitBinding;
    RATE_LIMIT_SHARE?: RateLimitBinding;
    RATE_LIMIT_SHARE_IMAGE?: RateLimitBinding;
    RATE_LIMIT_START?: RateLimitBinding;
    SESSION_SIGNING_SECRET: string;
  }
}

export {};
