# PuzzGrind

PuzzGrind is a puzzle platform beginning with an explainable Daily Sudoku. Phase 0 is intentionally a single-game validation project.

## Local development

Requirements: Node 22.22.0 and pnpm 11.7.0.

```bash
pnpm install
pnpm dev
```

## Quality checks

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm preview
```

The Cloudflare production bundle is generated in `.open-next/`.

## API security deployment

Sudoku write and compute-heavy APIs use Cloudflare native Rate Limiting bindings declared in `wrangler.jsonc`. Production and staging have separate namespace IDs and the following fixed 60-second limits:

| Route class | Binding | Limit |
| --- | --- | ---: |
| Session start | `RATE_LIMIT_START` | 12 |
| Session save | `RATE_LIMIT_SAVE` | 60 |
| Session complete | `RATE_LIMIT_COMPLETE` | 6 |
| Hint | `RATE_LIMIT_HINT` | 12 |
| Share token | `RATE_LIMIT_SHARE` | 10 |
| Share image | `RATE_LIMIT_SHARE_IMAGE` | 120 |

The key combines the route class, Cloudflare's trusted `CF-Connecting-IP`, and a bounded session identity where available. Session start is IP-only so rotating client-generated anonymous UUIDs cannot bypass creation protection. The share-image limit is also IP-based and intentionally higher for social crawler refetches. Cloudflare's native counters are location-scoped, permissive, and eventually consistent; they are abuse controls rather than exact accounting.

`APP_ENV` supports `local`, `test`, `preview`, `staging`, and `production`. Preview, staging, and production fail closed with `503 rate_limiter_unavailable` when a required binding is absent or errors. They return `503 client_identity_unavailable` when Cloudflare's trusted client-IP header is missing. Local and test runs allow a controlled `local` identity fallback and may run without Cloudflare's native binding.

Automatic Git previews use the top-level Wrangler configuration: `APP_ENV=preview`, preview-only rate-limit namespaces `3101` through `3106`, and the non-production staging D1 database. Explicit `--env production` and `--env staging` targets select their own bindings. Preview and staging share test data, so preview data is disposable and must never be treated as production. The Git integration currently uploads preview versions to the same Worker service, so `SESSION_SIGNING_SECRET` remains the service secret; it is never printed or exposed to preview clients. This accepted limitation avoids creating a new secret while D1 data and rate counters remain isolated from production.

Session routes verify the signed token before reading D1, then rate-limit the authorized session before mutation. Invalid signatures therefore cause no D1 lookup. A replayed valid token can cause one indexed session lookup before the session-scoped limiter runs; this is a known residual read-amplification risk. A second pre-authorization binding was not added because it would require another independent counter policy (or incorrectly count the same binding twice).

JSON request limits are 256 bytes for session start, 512 bytes for share-token creation, 1,024 bytes for hints, and 8,192 bytes for save/complete. Oversized bodies return 413 before JSON parsing completes.

## Scope

Read [the Phase 0 constraints](docs/puzzgrind-phase-0-sudoku-spec.md) and the active task file before making changes. Do not advance to a later task without explicit approval.
