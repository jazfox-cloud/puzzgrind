import type { D1DatabaseLike } from "@/lib/db/d1";
import type { RateLimitBinding } from "@/lib/api/rate-limit";

declare global {
  interface CloudflareEnv {
    ALLOW_STAGING_PUZZLE_FALLBACK?: string;
    APP_ENV?: "local" | "preview" | "production" | "staging" | "test";
    DB: D1DatabaseLike;
    RATE_LIMIT_COMPLETE?: RateLimitBinding;
    RATE_LIMIT_HINT?: RateLimitBinding;
    RATE_LIMIT_LEXI_GUESS?: RateLimitBinding;
    RATE_LIMIT_LEXI_HINT?: RateLimitBinding;
    RATE_LIMIT_LEXI_READ?: RateLimitBinding;
    RATE_LIMIT_LEXI_START?: RateLimitBinding;
    RATE_LIMIT_LEXI_SUBMIT?: RateLimitBinding;
    RATE_LIMIT_SAVE?: RateLimitBinding;
    RATE_LIMIT_SHARE?: RateLimitBinding;
    RATE_LIMIT_SHARE_IMAGE?: RateLimitBinding;
    RATE_LIMIT_START?: RateLimitBinding;
    SESSION_SIGNING_SECRET: string;
  }
}

export {};
