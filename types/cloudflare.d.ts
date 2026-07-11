import type { D1DatabaseLike } from "@/lib/db/d1";

declare global {
  interface CloudflareEnv {
    DB: D1DatabaseLike;
  }
}

export {};
