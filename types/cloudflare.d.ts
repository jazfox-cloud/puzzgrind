import type { D1DatabaseLike } from "@/lib/db/d1";

declare global {
  interface CloudflareEnv {
    ALLOW_STAGING_PUZZLE_FALLBACK?: string;
    DB: D1DatabaseLike;
  }
}

export {};
