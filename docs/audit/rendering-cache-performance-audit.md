# PuzzGrind Rendering and Cache Performance Audit

Audit date: 2026-07-13 (America/Los_Angeles)

Source baseline: `2884a55b0627bda7795313a45d524d2ef4be7813` (`analytics: add consent-gated GA4 foundation`)

Scope: repository and build-output inspection, read-only Cloudflare deployment inspection, and low-frequency GET measurements against `https://puzzgrind.com`. No application, Dashboard, cache, database, Secret, migration, staging, or Production change was made.

## Executive Summary

PuzzGrind currently pays the request-time rendering cost for every HTML page even though three of the four page types do not contain request-specific server data. Next.js 16.2.10 and OpenNext 1.20.1 both classify `/`, `/privacy`, `/sudoku`, and `/sudoku/share/[token]` as dynamic. The direct tree-wide cause is `export const dynamic = "force-dynamic"` in `app/layout.tsx`; `/sudoku` repeats the same directive. The architectural reason for the root directive is the request-time `APP_ENV` read used to choose Production metadata versus Preview/Staging `noindex`, but `getAppEnvironment()` itself is not a Next.js Dynamic API. The client-side Analytics consent state and `@next/third-parties` do not require dynamic SSR.

The static exceptions are `/manifest.webmanifest` and `/sitemap.xml`, which are present in `prerender-manifest.json`. `/robots.txt` is an environment-sensitive dynamic metadata route. The two health endpoints are dynamic Route Handlers; `/api/health/db` must remain request-time because it queries D1, while `/api/health` is a cheap live-process check. The signed Share page must remain dynamic and non-public-cacheable because it consumes a dynamic token parameter and the runtime signing Secret.

Production HTML is not CDN cached. `/`, `/sudoku`, and `/privacy` consistently returned `Cache-Control: private, no-cache, no-store, max-age=0, must-revalidate`, without `CF-Cache-Status`, `Age`, validator, `Server-Timing`, `x-opennext-*`, or `x-nextjs-*` headers. In a seven-sample, single-threaded run, median TTFB was 1,236 ms for `/`, 794 ms for `/sudoku`, and 877 ms for `/privacy`. The earlier approximately 1,518 ms homepage observation was reproduced once at 1,576 ms, but it was the delayed sample rather than the first sample. There is no clear cold-start signature.

The homepage was slower than Sudoku throughout this ordered run except for a small overlap between the fastest homepage and slowest Sudoku samples. That difference is real for this run, but its cause is unproven. Every request established a fresh connection through the audit environment, `CF-Ray` terminated in LHR, and mean TLS completion alone was 639 ms for `/` and 534 ms for `/sudoku`. The homepage performs no D1 query or server fetch; its main observable differences are a roughly 20% larger compressed HTML response and server rendering of an 81-cell decorative grid. Those differences are not enough evidence to assign the roughly 442 ms median gap to application code.

The recommended sequence is deliberately conservative:

1. **PR #6B:** introduce an explicit per-build environment contract, remove the root dynamic boundary, and statically generate `/` and `/privacy` while leaving `/sudoku`, Share, APIs, D1, cache rules, and OpenNext cache infrastructure unchanged.
2. **PR #6C:** after proving Production/Preview metadata isolation, statically generate the `/sudoku` HTML shell and separately evaluate safe HTML caching or OpenNext cache persistence.
3. **Later:** consider R2-backed incremental cache/cache interception, narrowly scoped Cache Rules, bundle deferral, or an independent Preview service only when traffic and multi-game complexity justify them.

This audit does **not** recommend enabling public HTML cache before environment-specific artifacts and cache-key separation are verified. Static rendering and CDN caching are separate decisions.

## Current Route Rendering Matrix

Build symbols below are from both `CI=1 pnpm build` and `CI=1 pnpm exec opennextjs-cloudflare build`: `○` means static prerendering and `ƒ` means request-time rendering.

| Route | Route/build type | Worker behavior and prerender evidence | D1 / runtime environment / Dynamic API | User-specific data | Current Production cache | Ideal mode |
| --- | --- | --- | --- | --- | --- | --- |
| `/` | `ƒ` Dynamic SSR page | Worker renders on every request; absent from `prerender-manifest.json`; no prerendered page HTML | No D1 or server fetch. Reads runtime `APP_ENV` in page metadata, page body, and root layout. No `headers()`, `cookies()`, or other Next Dynamic API. | None | `private, no-cache, no-store`; no `CF-Cache-Status` | Build-time static HTML, public-cache eligible only after environment artifact isolation |
| `/sudoku` | `ƒ` Dynamic SSR page | Worker renders shell on every request; absent from prerender manifest; explicit page and root `force-dynamic` | HTML request does not touch D1. Reads runtime `APP_ENV` for metadata/root. After hydration, the client GETs `/api/sudoku/today` and POSTs `/api/sudoku/session/start`, which do use D1. | No user state in initial HTML; user state starts client-side/API-side | `private, no-cache, no-store`; no `CF-Cache-Status` | Keep dynamic in #6B; later static/cacheable HTML shell with all session APIs dynamic |
| `/privacy` | `ƒ` Dynamic SSR page | Dynamic only because it inherits the root boundary and request-time metadata environment; no page-specific dynamic directive | No D1, fetch, params, or Next Dynamic API. Runtime `APP_ENV` only for metadata/root | None | `private, no-cache, no-store`; no `CF-Cache-Status` | Fully static at build time; public-cache eligible per environment |
| `/sudoku/share/[token]` | `ƒ` Dynamic SSR page with dynamic param | Worker verifies the token for metadata and body at request time; invalid-token probe returned 404 | No D1. Reads runtime `SESSION_SIGNING_SECRET`; uses async `params`; dynamic metadata | Token-specific result metrics; effectively per-link content | Invalid-token response: `private, no-cache, no-store`; no `CF-Cache-Status` | Must remain dynamic and no-store; never place in public CDN cache |
| `/robots.txt` | `ƒ` dynamic Metadata Route | Worker generates environment-specific rules; absent from prerender manifest; explicit `force-dynamic` | No D1. Reads runtime `APP_ENV`; no Next Dynamic API | None, but environment-specific | `public, max-age=0, must-revalidate`; no `CF-Cache-Status` | Static per build or small dynamic route; Preview/Staging must disallow all |
| `/sitemap.xml` | `○` static Metadata Route | Present in prerender manifest and `.open-next/cache`; Production still follows Worker/OpenNext path and returned `x-nextjs-cache: MISS` in all seven samples | No D1, runtime env, params, or dynamic API | None | `public, max-age=0, must-revalidate`; no `CF-Cache-Status`; repeated `x-nextjs-cache: MISS` | Static, public cached, Production-only URLs |
| `/manifest.webmanifest` | `○` static Metadata Route | Present in prerender manifest and `.open-next/cache`; Production returned `x-nextjs-cache: MISS` in all samples | No D1, runtime env, params, or dynamic API | None | `public, max-age=0, must-revalidate`; no `CF-Cache-Status`; repeated `x-nextjs-cache: MISS` | Static asset/public cached |
| `/api/health` | `ƒ` Route Handler | Worker executes GET per request; Route Handlers are not cached by default | No D1, runtime env, or user input | None | No explicit `Cache-Control` and no `CF-Cache-Status` observed | Dynamic, no-store/fresh; optional very short operational cache only by explicit decision |
| `/api/health/db` | `ƒ` Route Handler | Worker executes GET and runs a D1 schema/puzzle-count query | Reads runtime `DB` binding and D1; no user input | Operational database state | No explicit `Cache-Control` and no `CF-Cache-Status` observed | Must remain dynamic and uncached |

The `staticRoutes` array in `.next/routes-manifest.json` describes non-parameterized URL matchers; it is not proof of static generation. `prerender-manifest.json` and the build route symbols are authoritative for prerender status. Its only application entries are `manifest.webmanifest` and `sitemap.xml` (plus the framework global error artifact).

Public-cache eligibility is narrower than “not user-specific.” It also requires environment-correct canonical/robots output, a cache key that cannot cross Production/Preview/Staging, and exclusion of Share/API paths.

## Dynamic Rendering Root Causes

### Inventory

| Factor | Finding | Classification |
| --- | --- | --- |
| Root `export const dynamic = "force-dynamic"` | Directly opts every descendant page in the root layout tree into request-time rendering. Build output confirms `/`, `/_not-found`, `/privacy`, `/sudoku`, and Share are dynamic. It does not force independent Route Handlers or metadata routes such as sitemap to share that classification. | **Can remove** after environment logic moves |
| Sudoku `force-dynamic` | Redundant while the root is dynamic, but would keep `/sudoku` dynamic after the root is fixed. The server page has no D1 or fetch dependency. | **Keep in #6B; remove experimentally in #6C** |
| Robots `force-dynamic` | Ensures the route can read runtime `APP_ENV` and emit different rules. | **Can move to build time**, or keep as a small isolated dynamic route |
| `getAppEnvironment()` | Calls synchronous `getCloudflareContext().env.APP_ENV`, catches build/dev errors, then falls back to `process.env.APP_ENV` or `local`. It is the architectural motivation for dynamic pages, but not a recognized Next Dynamic API. | **Move page/metadata use to build time**; retain a runtime resolver for APIs/Worker concerns if needed |
| Root/page `generateMetadata` | Metadata generation itself is not inherently dynamic. It becomes request-time because the input is runtime environment state and the root is forced dynamic. | **Move to build time** |
| Homepage body environment check | Chooses whether to emit root canonical and `og:url` tags at request time. | **Move to build-time metadata** |
| GA4 Measurement ID | `process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID` is read by server code and passed to the client component. Next public values are build-time substituted; this does not require request-time SSR. | **Keep build-time** |
| Analytics Consent UI | A root Client Component uses `useSyncExternalStore` with server snapshot `unknown`, then reads localStorage after hydration. Client Components are compatible with static HTML. GoogleAnalytics is rendered only after Production + valid ID + granted consent. | **Must retain client behavior; does not require dynamic SSR** |
| Preview/Staging noindex | Currently decided in root/page metadata at request time from `APP_ENV`. | **Move to an explicit per-trigger build variable**, with response-header defense in depth if desired |
| `robots.txt` environment decision | Runtime choice between Production allow rules and non-Production disallow-all. | **Build-time candidate**; isolated dynamic route is also acceptable |
| Share dynamic `params` and Secret | Share metadata/body must verify the URL token with `SESSION_SIGNING_SECRET`; output varies by token. | **Must retain dynamic** |
| API `getCloudflareContext()` | D1, Rate Limit and Secret bindings are runtime resources. | **Must retain dynamic** for corresponding API routes |
| Client `fetch` in `SudokuGame` | Runs only after hydration. It does not make the server page dynamic. `/api/sudoku/today` and session APIs remain independent Worker routes. | **Must retain client/API behavior** |
| `headers()`, `cookies()`, `connection()`, server `searchParams`, uncached server fetch, Server Actions | Repository-wide search found none in the page/layout tree. No `"use server"` action was found. | Not a current cause |

The [Next.js previous-model caching guide](https://nextjs.org/docs/app/guides/caching-without-cache-components) confirms that `force-dynamic` makes the route request-time and equivalent to no-store behavior. This repository does not enable Cache Components, so that model matches the observed build.

### Required answers

1. **Why is Root Layout dynamic?** Because it explicitly declares `force-dynamic`, primarily so that it can read runtime `APP_ENV` and choose metadata/Analytics environment at request time.
2. **Does that affect all child routes?** It affects descendant page rendering, as confirmed by `/`, `/privacy`, `/sudoku`, Share, and `_not-found`. Independent Route Handlers and metadata routes keep their own classifications.
3. **Why is `/` dynamic?** It inherits root `force-dynamic`; it also calls `getAppEnvironment()` for page metadata and body canonical output. It has no D1, server fetch, or request-specific content.
4. **Why is `/sudoku` dynamic?** It inherits root dynamic behavior and declares its own `force-dynamic`. The initial HTML shell does not query D1; D1 access begins through client API calls after hydration.
5. **Why is `/privacy` dynamic?** Only inherited root behavior and request-time metadata environment selection. There is no page-specific need.
6. **Is `getAppEnvironment()` the main Next.js trigger?** No. The explicit segment directives are the direct triggers. It is the underlying architecture that led to them and prevents safe static output until build environment is explicit.
7. **How does `getCloudflareContext()` behave at build versus runtime?** At Worker runtime, OpenNext supplies the context and bindings. During static generation, synchronous access throws because there is no Worker context; `getAppEnvironment()` catches that and uses `process.env`. With no build-time environment variable, it resolves to `local`, which would safely noindex but would incorrectly noindex Production if pages were made static without a new build contract.
8. **Does Analytics consent require SSR?** No. Consent is localStorage-backed client state. Static HTML can render the same `unknown` snapshot and hydrate the client gate.
9. **Must Preview/Staging noindex be request-time metadata?** No. Cloudflare Workers Builds executes separate Production and non-production branch triggers, and build variables can be defined per trigger. An explicit build environment can produce different static metadata. See [Workers Builds configuration](https://developers.cloudflare.com/workers/ci-cd/builds/configuration/) and [Build branches](https://developers.cloudflare.com/workers/ci-cd/builds/build-branches/).
10. **Can robots/environment isolation move elsewhere?** Yes: primary metadata/canonical separation should be build-time; `X-Robots-Tag` can add non-Production defense in depth; `robots.txt` can be built per environment or remain a small dynamic route. A response header alone cannot remove an incorrect Production canonical embedded in Preview HTML.
11. **What must remain dynamic?** Signed Share pages/cards, D1/Rate-Limit/Secret APIs, session writes, hints, completion, share creation, DB health, and daily-puzzle lookup unless that GET receives a separately designed cache policy.

## Build Output Analysis

### Next.js and OpenNext result

Both build commands produced the same route summary:

```text
ƒ /                         ƒ /privacy
ƒ /sudoku                   ƒ /sudoku/share/[token]
ƒ /robots.txt               ○ /sitemap.xml
○ /manifest.webmanifest     ƒ /api/health
ƒ /api/health/db            ƒ all Sudoku APIs
```

`CI=1 pnpm build` compiled in 868 ms and `CI=1 pnpm exec opennextjs-cloudflare build` rebuilt in 834 ms before bundling the Worker. Both completed type checking, page-data collection, and generation of 11 static framework entries without error.

Key artifacts:

- `.next/prerender-manifest.json` contains `manifest.webmanifest` and `sitemap.xml`, not `/`, `/privacy`, or `/sudoku`.
- `.open-next/cache/<build-id>/` contains `_global-error.cache`, `manifest.webmanifest.cache`, and `sitemap.xml.cache`; there are no cached HTML page entries.
- `.open-next/assets` is about 1.1 MB and contains public images/icons, CSS, and fingerprinted Next chunks. Wrangler config uses `assets.serve_directly=true` and `raw_run_worker_first=false`, so ordinary asset files can bypass application rendering.
- The outer `.open-next/worker.js` loader is about 2.2 KB. The esbuild metadata reports a bundled server output of 3,737,798 bytes; `handler.mjs` is about 3.6 MB. The expanded server-function directory is about 33 MB because it also contains packaged Next modules; that directory size is not a request transfer size.
- Large server-bundle contributors include the Next app-page runtime (~666 KB), `@vercel/og` (~546 KB), an application/server chunk (~397 KB), React DOM server runtime (~195 KB), and the Next app-route runtime (~182 KB). Share-card image generation explains why `@vercel/og` must remain in the Worker bundle.
- `open-next.config.ts` calls `defineCloudflareConfig()` with defaults. The emitted config resolves Incremental Cache, tag cache, and queue to `dummy`; cache interception is disabled. OpenNext documents that SSR routes are outside its SSG/ISR cache flow and that persistent SSG/ISR caching needs explicit components: [OpenNext Cloudflare caching](https://opennext.js.org/cloudflare/caching/).
- No middleware or custom OpenNext route split is configured. All dynamic application routes are in the default server function.

Static generation alone may reduce page rendering work, but it does not prove CDN HTML hits. The current static metadata routes returned `x-nextjs-cache: MISS` on every sample and had no `CF-Cache-Status`. PR #6B must measure the deployed result before claiming a cache win.

## Production Timing Measurements

### Method

On 2026-07-13, each requested path received seven sequential GETs: one initial request, five follow-ups separated by one second, and one delayed repeat after five seconds. There was no concurrency. `curl --compressed` used a new process and new connection for every sample. Only public pages/assets were requested; no session, hint, save, complete, or share write endpoint was called.

The audit environment routed to Cloudflare LHR (`CF-Ray: ...-LHR`) through an address in the `198.18.0.0/15` benchmarking range. Consequently:

- `time_connect` and `time_appconnect` include the local execution/proxy path and are not clean measurements of the user's TCP/TLS distance to LHR.
- No connection was reused, so browser keep-alive performance is not represented.
- Only one measurement location and a small sample were used. P95 is intentionally omitted.
- TTFB includes DNS, connection, TLS, Cloudflare, Worker, and application time. `Server-Timing` was absent, so Worker execution cannot be isolated precisely.

### HTML statistics

All times are milliseconds; response size is compressed transfer size.

| Path | n | Initial | Follow-up mean | Delayed | Min | Median | Mean | Max | Mean TLS completion | Mean TTFB minus TLS | Mean size |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `/` | 7 | 1,213 | 1,198 | 1,576 | 879 | 1,236 | 1,254 | 1,576 | 639 | 615 | 4,172 B |
| `/sudoku` | 7 | 904 | 824 | 631 | 631 | 794 | 808 | 904 | 534 | 275 | 3,470 B |
| `/privacy` | 7 | 736 | 1,019 | 1,085 | 736 | 877 | 988 | 1,319 | 547 | 442 | 3,709 B |

There is no consistent first-request penalty: homepage initial TTFB is nearly equal to follow-up mean, Privacy's initial request is its fastest, and Sudoku's delayed request is its fastest. The data therefore does not demonstrate Worker cold start. It does demonstrate persistent no-CDN-cache cost because every HTML request reaches dynamic rendering.

### All measured routes

| Path | Status | Mean DNS | Mean connect | Mean TLS completion | Median TTFB | Mean total | Size |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `/` | 200 | 2.6 | 3.0 | 638.9 | 1,236 | 1,259 | 4,172 B |
| `/sudoku` | 200 | 2.3 | 2.7 | 533.5 | 794 | 811 | 3,470 B |
| `/privacy` | 200 | 2.6 | 3.0 | 546.7 | 877 | 991 | 3,709 B |
| `/robots.txt` | 200 | 2.5 | 2.8 | 620.5 | 889 | 903 | 113 B |
| `/sitemap.xml` | 200 | 2.5 | 2.8 | 546.0 | 830 | 804 | 212 B |
| `/manifest.webmanifest` | 200 | 2.5 | 2.9 | 571.7 | 847 | 825 | 255 B |
| `/og/puzzgrind-social.png` | 200 | 2.7 | 3.0 | 620.9 | 1,006 | 1,357 | 56,182 B |
| `/icons/icon-192.png` | 200 | 2.5 | 2.9 | 531.1 | 739 | 769 | 3,580 B |

The approximately 1,518 ms prior homepage sample is plausible and was reproduced at 1,576 ms, but it is not evidence by itself of a cold start. The prior approximately 280 ms Sudoku sample was not reproduced from this network path; the current minimum was 631 ms and mean TLS completion was already 534 ms.

## Response Header and Cache Analysis

| Response class | Observed headers | Interpretation |
| --- | --- | --- |
| `/`, `/sudoku`, `/privacy`, Share 404 | `private, no-cache, no-store, max-age=0, must-revalidate`; `Vary: rsc, next-router-state-tree, next-router-prefetch, next-router-segment-prefetch`; gzip; no `CF-Cache-Status` | Dynamic Worker HTML, deliberately ineligible for shared cache |
| `/robots.txt` | `public, max-age=0, must-revalidate`; same RSC vary; gzip; no `CF-Cache-Status` | Dynamic metadata response, browser-revalidatable but no observed CDN hit |
| `/sitemap.xml`, `/manifest.webmanifest` | `public, max-age=0, must-revalidate`; `x-nextjs-cache: MISS` on all seven samples; no `CF-Cache-Status` | Next prerender artifacts exist, but the live OpenNext path did not produce a persistent cache hit |
| Public PNG assets | `public, max-age=0, must-revalidate`; stable `ETag`; `CF-Cache-Status: HIT`; fixed `Content-Length` | Served by Workers Static Assets/CDN, not application SSR |
| Fingerprinted Next JS | `public, max-age=0, must-revalidate`; weak `ETag`; gzip; `CF-Cache-Status: HIT` | CDN hit, but browser freshness is conservative rather than `immutable` |
| `/api/health`, `/api/health/db` | No explicit `Cache-Control`; no `CF-Cache-Status`; JSON/gzip | Request-time Worker handlers; DB health read returned 200 |

No sampled route returned `Age`, `Last-Modified`, `Server-Timing`, `x-opennext-*`, or an application timing header. HTML and metadata responses lacked ETags. Cloudflare documents `public, max-age=0, must-revalidate`, ETag, and `CF-Cache-Status` as its default static-asset behavior: [Workers Static Assets headers](https://developers.cloudflare.com/workers/static-assets/headers/). The observed PNG/JS headers match that pattern.

The static asset `CF-Cache-Status: HIT` proves the asset layer works. It does not imply HTML caching. Conversely, changing HTML `Cache-Control` alone is insufficient unless the Worker/CDN path, environment key, and exclusions are designed and verified.

## Homepage vs Sudoku Findings

| Dimension | Homepage | Sudoku |
| --- | --- | --- |
| Root layout | Same dynamic root, metadata, Analytics client boundary, CSS | Same |
| Page dynamic directive | Inherits root only | Has an additional explicit `force-dynamic` |
| Server metadata | `createPageMetadata(HOME_SEO, getAppEnvironment())` | Equivalent Sudoku metadata call |
| Runtime environment calls | Page metadata + body + root | Page metadata + root |
| Server D1/fetch | None | None in HTML request |
| Client API/D1 after hydration | None | Daily GET then session-start POST; later save/hint/complete/share |
| Structured data | WebSite JSON-LD | WebApplication JSON-LD |
| Compressed HTML | ~4.17 KB | ~3.47 KB |
| Page-specific modern JS | ~0.19 KB raw | ~21.51 KB raw (`SudokuGame`) |
| Server page module in OpenNext metadata | ~25.3 KB | ~42.0 KB |
| Main server-rendered DOM distinction | Decorative 81-cell preview grid | Heading and loading shell; board appears after client data |

Findings:

- The homepage was consistently slower in this one ordered run: median gap 442 ms and mean post-TLS gap about 340 ms. It also reproduced a 1.5-second sample.
- The measurement was not interleaved by route, used one LHR path, and had materially different TLS means. It cannot establish that the route itself caused the full gap.
- Code inspection found no homepage-only database, network, crypto, filesystem, or runtime platform operation. The repeated `getAppEnvironment()` call is synchronous and cheap after context exists.
- Homepage HTML is about 20% larger and includes 81 decorative cells. This can add serialization work, but there is no timing instrumentation proving it accounts for hundreds of milliseconds.
- Sudoku's HTML request does not access D1 directly. D1 begins after the client component fetches the daily puzzle and starts/restores a session.
- GA4 cannot explain server TTFB: the external tag is conditionally rendered by client consent after the HTML arrives. Before consent it is not downloaded.
- The prior 1,518 ms homepage value is **not an isolated impossible value**, but its attribution to cold start or application logic remains **unproven**.

## Client Bundle Findings

The local production build and live HTML identify the same chunk roles. Sizes below are local raw bytes plus gzip estimates; Cloudflare may use a different compression level or Brotli. The legacy `noModule` polyfill is listed separately because modern browsers do not execute/download it in the normal path.

| Page | Modern initial JS (raw) | Gzip estimate | Page-specific chunk | Notes |
| --- | ---: | ---: | ---: | --- |
| `/` | ~453.4 KB | ~135.3 KB | 191 B raw | Almost entirely shared runtime/layout code |
| `/privacy` | ~453.4 KB | ~135.3 KB | 191 B raw | Same shared payload as home |
| `/sudoku` | ~474.8 KB | ~142.1 KB | 21.5 KB raw / 6.9 KB gzip | Adds `SudokuGame` and game/storage logic |
| Shared layout/runtime | ~453.2 KB | ~135.2 KB | Layout chunk 18.7 KB raw / 6.1 KB gzip | Consent UI and `@next/third-parties` are shared by every page |
| Legacy polyfill (`noModule`) | 112.6 KB | 39.5 KB | Separate | Not counted in modern totals |

Conclusions:

- Root Layout imports the Analytics Client Component, so every page downloads the shared consent-management code and the wrapper code for `@next/third-parties`, even when Analytics is disabled by environment or consent.
- The external Google tag is not part of these Next chunks and is not requested before consent. After consent, `GoogleAnalytics` loads it once.
- The consent UI can remain client-only while the surrounding layout/pages become static. Dynamic SSR is not a bundle requirement.
- A later PR could lazy-load the settings/consent implementation, but the route-specific bundle evidence does not make that the highest-value first step. Rendering/environment isolation is more foundational.
- `SudokuGame` is the only meaningful page-specific bundle in the audited pages. Its raw chunk is modest relative to the shared runtime; splitting it should wait for browser performance/Web Vitals evidence.

## Cloudflare and OpenNext Cache Capabilities

| Mechanism | Current state | Suitable use in PuzzGrind |
| --- | --- | --- |
| Cloudflare Static Assets/CDN | Working; PNG and fingerprinted JS returned `HIT` | Continue for icons, OG image, CSS, JS; consider longer immutable browser TTL for fingerprinted assets in a later isolated change |
| Cloudflare Cache Rules | No repository evidence and no HTML hit observed | Potential Phase 2 HTML cache for exact public paths/hostnames only; exclude APIs and Share; Dashboard operation required |
| Worker Cache API | Not used | Later only if exact keys, purge, environment separation, and failure behavior are justified; Cache API is data-center-local and not tiered |
| Next Full Route Cache | Disabled for dynamic pages; only two metadata artifacts prerendered | Restore for `/` and `/privacy`, later Sudoku shell |
| Next Data Cache | No server `fetch` in audited pages; API/D1 calls are outside page render | Not relevant to current HTML; may apply to a future daily-puzzle server fetch, but current client/API separation is safer |
| ISR / `revalidate` | Not configured | Unnecessary for immutable marketing/privacy shell; potentially useful only for content that changes between deployments |
| `s-maxage` / stale-while-revalidate | Not present on HTML | Phase 2 option after static correctness; environment/host cache keys and purge procedure are mandatory |
| Browser cache | HTML no-store; static assets revalidate on every browser use | Correctly safe for HTML today; fingerprinted asset policy is conservative |
| OpenNext Incremental Cache | Default `dummy`; static route samples remained `MISS` | If ISR/SSG persistence is required, configure an official implementation (for example R2) and test cost/complexity |
| OpenNext cache interception | Disabled | Can reduce cached SSG/ISR NextServer loading, but only after a real cache backend exists and correctness is proven |

Cloudflare's [Cache API documentation](https://developers.cloudflare.com/workers/reference/how-the-cache-works/) notes that Cache API storage is distinct from normal tiered CDN caching. OpenNext's cache guide recommends explicit Incremental Cache, Queue, and tag-cache components for revalidation use cases. PuzzGrind should not introduce all of that merely to make three small immutable shells static.

### Route recommendations

- **Homepage:** fully static per environment. Phase 1 should stop SSR; Phase 2 may add public HTML cache after observing the deployed OpenNext behavior.
- **Sudoku:** statically generate only the HTML shell in a separate PR. Daily puzzle GET, session start/save/complete, hints, local state, and D1 remain dynamic. Never cache a response containing a session token or restored board.
- **Privacy:** fully static. It has no request-time input.
- **Share:** dynamic/no-store. Do not cache by token, even though links are public, without an explicit privacy and revocation design.
- **APIs:** dynamic. Write APIs and D1/session responses must never enter a public cache. A future daily-puzzle GET cache can be evaluated separately with UTC rollover tests.
- **Sitemap/manifest:** static and public. Investigate why the current adapter path always reports `x-nextjs-cache: MISS` before adding infrastructure.

## Environment Isolation Options

### Option A — build-time environment variable

**Assessment: recommended primary design.**

Workers Builds runs separate Production and non-production branch triggers; Cloudflare's Builds API supports environment variables per trigger. Add a server/build-only variable such as `BUILD_APP_ENV=production|preview|staging`, rather than using `NEXT_PUBLIC_*` for SEO logic. Keep runtime `APP_ENV` for Worker/API safety.

- Production trigger builds Production canonical, `og:url`, indexable robots metadata, and Production robots.txt.
- Preview trigger builds no canonical/`og:url`, `noindex`, and disallow-all robots.
- Staging must have an explicit build path/value; it must not silently inherit Production.
- Missing/invalid build environment defaults to non-indexable locally, while the Production deploy guard must reject any artifact not stamped/built as Production.
- Add configuration tests for all five environments and a build-artifact verification step before deployment.

Risk: a wrong build variable can repeat the earlier Preview/Production configuration class of incident. Mitigation is per-trigger variables, fail-closed SEO defaults, artifact assertions, and the existing explicit `--env production` deploy guard. The [Workers Builds API reference](https://developers.cloudflare.com/workers/ci-cd/builds/api-reference/) confirms variables are trigger-specific.

### Option B — `X-Robots-Tag`

**Assessment: useful defense in depth, not a complete replacement.**

`X-Robots-Tag: noindex, nofollow, noarchive` is valid for HTML and non-HTML responses; Google documents it as equivalent to supported robots meta rules: [Google robots/X-Robots specification](https://developers.google.com/search/docs/crawling-indexing/robots-meta-tag). It can protect Preview/Staging without making React metadata dynamic.

Limitations:

- Crawlers must be allowed to fetch the response to see the header. `robots.txt` disallow-all remains a separate crawl-control layer.
- The header does not remove a Production canonical or `og:url` accidentally embedded in Preview HTML.
- Header injection must be scoped by environment and response type; it should not change Production, APIs unexpectedly, or static-asset cache keys.

### Option C — Middleware or Worker response-header injection

**Assessment: viable secondary protection; not the preferred primary metadata source.**

A small environment-aware boundary can add `X-Robots-Tag` on non-Production HTML. OpenNext supports middleware, but the current project has none. It adds Worker execution/maintenance and must be tested against static assets, APIs, RSC responses, Cache-Control, and preview URLs. It should not rewrite canonical HTML at the edge.

If implemented, scope it to document/RSC responses for public page routes, exclude assets and APIs, and add tests proving Production headers remain indexable. Cloudflare notes that headers for Worker-generated SSR responses must be attached by Worker code rather than a static `_headers` file.

### Option D — separate dynamic boundaries

**Assessment: recommended application architecture.**

- Root Layout and ordinary page metadata become build-time/static.
- Consent remains a Client Component with the same localStorage contract.
- Measurement ID remains a build variable; the client still requires Production + valid ID + granted consent.
- `/`, `/privacy`, and later `/sudoku` shell become static.
- Share and APIs keep runtime bindings and dynamic behavior.
- Robots may be static per build or stay as a tiny isolated dynamic metadata route.

This recovers static rendering without changing D1 or gameplay behavior.

### Option E — independent Preview Worker service

**Assessment: defer.**

A separate service would make bindings, domains, runtime variables, and cache namespaces physically clearer, and reduce the blast radius of a bad preview upload. However, PuzzGrind already has preview versions, staging, and production guards. Another service increases Dashboard, domain, Secret, build-trigger, and drift maintenance. It is not justified for Phase 0; revisit for multiple games or a larger release organization.

## Risks and Constraints

Any optimization must preserve these invariants:

- Never public-cache session tokens, restored boards, write API responses, D1 health, or tokenized Share pages/cards unless a separate immutable-card policy is explicitly retained and verified.
- Production and Preview/Staging artifacts, cache namespaces, hostnames, canonicals, robots metadata, and headers must not cross-contaminate.
- Production must keep its canonical/OG URLs and remain indexable; Preview/Staging must remain noindex and should continue omitting canonical/`og:url`.
- Consent-gated GA4 must remain disabled before consent and outside Production. Static rendering must not cause the Google tag to be emitted server-side.
- `/privacy`, persistent Privacy settings, withdrawal, and Sudoku localStorage must not regress.
- Share token verification, noindex metadata, signed card URL, and no-store behavior must remain dynamic.
- Daily puzzle, session start/save/resume, hints, completion, Rate Limits, D1 bindings, Secret bindings, and Production deployment guard must not change in an audit or static-shell PR.
- `robots.txt`, sitemap, 404, and metadata need Production and Preview acceptance tests after every environment change.
- OpenNext static generation does not automatically prove a Cloudflare CDN hit. Cache behavior must be observed on the deployed version.

Specific risks:

1. **Production built with non-Production metadata:** fail closed and block deployment with artifact checks.
2. **Preview receives Production canonical:** use per-trigger build output; `X-Robots-Tag` alone is insufficient.
3. **Public cache captures user state:** cache only static page shells and exact public routes; keep all APIs/Share excluded.
4. **Stale daily puzzle:** do not embed the daily puzzle into cached HTML in #6B; keep the client API and UTC rollover unchanged.
5. **Cache Rule bypass/precedence surprises:** Cloudflare Workers, Cache Rules, and Cache API have precedence interactions. Do not add them together in one rollout.
6. **Misreading network data:** current LHR/proxy measurements cannot isolate Worker CPU or represent all users.

## Recommended Architecture

### Phase 1 — low risk, high value

1. Add `BUILD_APP_ENV` with strict parsing and non-indexable fallback; keep runtime `APP_ENV` unchanged.
2. Configure Production/Preview build triggers with distinct values and document staging's build path.
3. Move root/page metadata and homepage canonical decisions to build-time values.
4. Remove root `force-dynamic` and statically generate `/` and `/privacy`.
5. Keep `/sudoku` explicitly dynamic for the first rollout, and keep Share/API/robots runtime behavior unless robots is safely built per environment.
6. Add build-manifest and live Preview/Production SEO assertions.

Expected benefit: remove unnecessary SSR from the simplest pages and reduce Worker work without touching gameplay. Risk: environment metadata mistakes. Dashboard action: **yes**, per-trigger build variable configuration, but no Cache Rule.

### Phase 2 — HTML shell/cache work

1. Remove Sudoku's `force-dynamic` after proving its HTML contains no user state and its client API flow is unchanged.
2. Measure whether OpenNext serves the resulting SSG artifacts efficiently with the current dummy cache.
3. If not, choose one cache mechanism: direct static-asset delivery, a narrowly scoped CDN Cache Rule, or an OpenNext incremental-cache implementation. Do not combine all three initially.
4. If using cache headers, start with exact `/`, `/privacy`, and possibly `/sudoku` Production paths; exclude `/api/*` and `/sudoku/share/*`; define purge/rollback.

Expected benefit: reduce warm HTML Worker execution and allow observable `CF-Cache-Status: HIT`. Risk: cache isolation and stale artifacts. Dashboard action: only if Cache Rules are selected.

### Phase 3 — advanced optimization

- Evaluate OpenNext R2 incremental cache and cache interception if ISR or many content pages justify the operational components.
- Consider immutable/far-future browser caching for fingerprinted assets.
- Defer Consent UI/client-bundle lazy loading until Web Vitals show shared JS is material.
- Consider an independent Preview service only at multi-game/release-scale complexity.
- Add multi-region synthetic measurements and server timing/observability before making Worker cold-start claims.

These items should not enter PR #6B.

## Proposed PR #6B Scope

**Goal:** restore static capability for Root Layout, homepage, and Privacy while preserving all runtime behavior and leaving cache strategy unchanged.

Expected files:

- `lib/seo.ts` or a new small build-environment module: strict build-time environment resolver and metadata helpers.
- `app/layout.tsx`: remove root `force-dynamic`; use build-time environment; keep Analytics Client Component and Measurement ID behavior.
- `app/page.tsx`: remove request-time environment read; generate canonical/OG metadata at build time.
- `app/privacy/page.tsx`: use build-time metadata.
- Configuration/unit tests covering `local`, `test`, `preview`, `staging`, and `production` output.
- `.env.example` and README/deployment documentation for the non-secret build variable.
- Production deploy guard/build verification script, only as needed to assert the artifact environment.

Files/routes that should **not** change:

- `components/sudoku/SudokuGame.tsx`, Sudoku logic/storage, D1 repositories/migrations, Security/Rate Limit code.
- All session, hint, completion, share, health, and daily-puzzle API behavior.
- Signed Share page/card logic.
- OpenNext incremental cache, Worker Cache API, Cloudflare Cache Rules, or HTML TTLs.
- GA consent state/cookies/event calls.

Cloudflare Dashboard: **required only to add distinct `BUILD_APP_ENV` values to the Production and Preview build triggers**. Do not add a Cache Rule in #6B. Staging needs an explicit equivalent value in its controlled build command/environment.

PR split:

- **#6B:** build environment contract + static root/home/privacy.
- **#6C:** Sudoku static shell + deployed-cache experiment; add exactly one cache mechanism only if evidence supports it.

Rollback: revert #6B's squash commit and let the protected `main` build redeploy the last dynamic version. If post-deploy SEO/environment acceptance fails, restore traffic to the pre-#6B Worker Version. No D1, migration, or Secret rollback is involved.

## Success Metrics

Re-run the same seven-sample method from the same network path/colo, then add at least one independent location before declaring a broad user improvement. These are acceptance baselines, not SLAs.

| Metric | Current baseline | #6B / later success condition |
| --- | --- | --- |
| Homepage cold TTFB | Initial 1,213 ms; max 1,576 ms | Lower first-request and post-TLS component in repeated same-colo runs; no new cold penalty |
| Homepage warm TTFB | Follow-up mean 1,198 ms; median all samples 1,236 ms | Repeated median materially below baseline; record route classification change alongside timing |
| Sudoku cold TTFB | Initial 904 ms | No regression in #6B; #6C must improve or retain it while preserving APIs |
| Sudoku warm TTFB | Follow-up mean 824 ms; median 794 ms | No regression in #6B; later static/cache test should show a repeatable reduction |
| Privacy TTFB | Initial 736 ms; median 877 ms; follow-up mean 1,019 ms | Static build and repeatable reduction without metadata regression |
| HTML Cache-Control | `private, no-store` for all HTML | #6B may remain conservative; Phase 2 must document an intentional public policy only for safe shells |
| HTML `CF-Cache-Status` | Absent | Not required for #6B; Phase 2 success requires repeatable warm `HIT` on exact safe routes |
| Static asset cache | PNG/JS `HIT`, ETag, `max-age=0` | Preserve hits; later asset-TTL change measured separately |
| Homepage modern initial JS | ~453.4 KB raw / 135.3 KB gzip estimate | No meaningful regression in #6B; compare build artifact and live request set |
| Sudoku modern initial JS | ~474.8 KB raw / 142.1 KB gzip estimate | No meaningful regression in #6B/#6C |
| Production SEO | Correct canonical/OG and indexable | Exact metadata assertions pass live |
| Preview/Staging SEO | noindex, no canonical/OG URL; robots disallow | Exact Preview/Staging assertions pass live and via build artifacts |
| GA Consent | No tag before consent/non-Production; one tag after Production consent | Existing unit/E2E plus live network acceptance pass |

Because seven samples are insufficient for stable tail statistics, no P95 target is set. A material performance claim should use multiple interleaved runs, persistent timestamps, and at least two Cloudflare colos.

## Open Questions

1. Why did current prerendered sitemap/manifest responses report `x-nextjs-cache: MISS` in all seven samples? Does OpenNext 1.20.1 require a persistent cache binding or cache interception for this deployment shape?
2. Can pure SSG HTML be promoted into Workers Static Assets in this adapter version, or will it still load the Next server function? Verify with a Preview experiment before choosing cache infrastructure.
3. What exact Production and Preview trigger variable scopes will be used for `BUILD_APP_ENV`, and how will staging build provenance be recorded?
4. Are any account-level Cache Rules active? Live HTML shows no hit, but this audit did not alter or fully inventory zone rules.
5. Does the homepage/Sudoku TTFB gap persist when requests are interleaved, reuse HTTP connections, and originate from multiple regions?
6. Would removing the decorative homepage grid or instrumenting Worker server time change the residual gap? Current code and headers cannot answer.
7. Is the conservative `max-age=0` policy for fingerprinted Next assets intentional, or should a separate asset-only PR add immutable browser caching?
8. At what traffic/content scale would R2 incremental cache, queues/tag cache, or an independent Preview service become worth their operational cost?

### Evidence and verification record

- `CI=1 pnpm install --frozen-lockfile`: pass, already up to date.
- `git diff --check`: pass.
- `CI=1 pnpm lint`: pass, zero warnings.
- `CI=1 pnpm typecheck`: pass.
- `CI=1 pnpm test`: pass, 23 files and 106 tests.
- `CI=1 pnpm build`: pass; Next.js route summary captured above.
- `CI=1 pnpm exec opennextjs-cloudflare build`: pass; same route summary and Worker bundle generated.
- Read-only Production deployment: Version `2c9424d5-4278-4d83-bda0-6bf8bcb0a697`, Deployment `2ff726c1-b40a-4ac8-bd5a-a4126ceb704d`, 100% traffic, `APP_ENV=production`, correct Production D1 and namespaces `1101–1106`.
- Measurement artifacts were kept under `/tmp` only and are not committed.
