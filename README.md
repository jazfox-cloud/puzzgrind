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

Rate limiting is not enforced by Cloudflare during local development. Code without a binding allows requests only when `APP_ENV` is neither `production` nor `staging`; deployed environments fail closed with `503 rate_limiter_unavailable` if a required binding is absent or errors. Before any deployment, confirm all six bindings exist in that environment. No D1 migration or new secret is required.

JSON request limits are 256 bytes for session start, 512 bytes for share-token creation, 1,024 bytes for hints, and 8,192 bytes for save/complete. Oversized bodies return 413 before JSON parsing completes.

## Scope

Read [the Phase 0 constraints](docs/puzzgrind-phase-0-sudoku-spec.md) and the active task file before making changes. Do not advance to a later task without explicit approval.
