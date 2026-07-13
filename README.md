# PuzzGrind

PuzzGrind is a puzzle platform beginning with an explainable Daily Sudoku. Phase 0 is intentionally a single-game validation project.

## Local development

Requirements: Node 22.22.0 and pnpm 11.7.0.

```bash
pnpm install
pnpm dev
```

## Analytics

GA4 is loaded through Next.js `@next/third-parties/google` only when the deployed runtime reports `APP_ENV=production` and `NEXT_PUBLIC_GA_MEASUREMENT_ID` contains a valid `G-` Measurement ID. Configure the Production build environment with:

```bash
NEXT_PUBLIC_GA_MEASUREMENT_ID=G-N1NLGSYBKD
```

The Measurement ID is public configuration, not a secret, but it is intentionally read from the environment rather than embedded in application code. Preview, staging, local, and test environments never render the Google tag or send events, even if the build can see a Measurement ID. Their browser console reports `Analytics Disabled (<environment>)`; a correctly configured Production deployment reports `Analytics Enabled`.

The root layout initializes GA once. Google Analytics Enhanced Measurement handles initial and App Router history-based page views; keep **Page changes based on browser history events** enabled in the GA4 property. Do not add a second automatic page-view listener unless Enhanced Measurement is disabled, or page views will be duplicated. The analytics module also exposes an explicit `trackPageView` escape hatch and typed Sudoku event helpers from `lib/analytics/events.ts` for future natural instrumentation points.

This foundation does not add Consent Mode, a cookie banner, Search Console, Ads, or gameplay instrumentation. Before a Production merge, set the build variable in the approved hosting environment; no Cloudflare Dashboard or Wrangler configuration is changed by this repository commit.

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

### Cloudflare Git deployment contract

Cloudflare Dashboard path: **Workers & Pages → puzzgrind → Settings → Build → Build configuration**.

| Branch class | Cloudflare command | Required result |
| --- | --- | --- |
| Production branch (`main`) | Deploy command: `pnpm deploy` | `APP_ENV=production`, `puzzgrind-db`, namespaces `1101–1106` |
| Non-production / PR | Version command: `npx wrangler versions upload` | top-level `APP_ENV=preview`, staging D1, namespaces `3101–3106`, no Production traffic change |

The Production deploy command must never be the unqualified `pnpm exec opennextjs-cloudflare deploy`; without `--env production`, Wrangler selects the Preview-safe top-level configuration. `pnpm deploy` runs `scripts/validate-cloudflare-deploy.mjs production` before building and deploying with `--env production`. The guard verifies the Worker name, APP environment, exact Production D1 ID, namespace IDs, and separation from Preview/Staging, and fails non-zero without an explicit Production target.

Dashboard settings are external state and are not changed by repository commits. After merging a deployment configuration change, verify that the Production branch is `main`, change the Dashboard Deploy command from `pnpm exec opennextjs-cloudflare deploy` to `pnpm deploy`, leave the PR Version command unchanged, and validate the next automatic `main` build's actual Worker bindings before considering the incident permanently closed.

Session routes verify the signed token before reading D1, then rate-limit the authorized session before mutation. Invalid signatures therefore cause no D1 lookup. A replayed valid token can cause one indexed session lookup before the session-scoped limiter runs; this is a known residual read-amplification risk. A second pre-authorization binding was not added because it would require another independent counter policy (or incorrectly count the same binding twice).

JSON request limits are 256 bytes for session start, 512 bytes for share-token creation, 1,024 bytes for hints, and 8,192 bytes for save/complete. Oversized bodies return 413 before JSON parsing completes.

## Scope

Read [the Phase 0 constraints](docs/puzzgrind-phase-0-sudoku-spec.md) and the active task file before making changes. Do not advance to a later task without explicit approval.
