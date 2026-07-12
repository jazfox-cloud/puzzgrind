# PuzzGrind Phase 0 Baseline Audit

Audit date: 2026-07-12 (America/Los_Angeles)

Scope: local repository, GitHub remote state, checked-in Cloudflare configuration, read-only Cloudflare account queries, and live `https://puzzgrind.com` checks.

Baseline commit: `12772de4d5c324c774ed8a988cc3c78a89053914` (`fix: bundle share cards in Cloudflare worker`)

## 1. Executive Summary

PuzzGrind is already a functioning Phase 0 Sudoku product, not a starter shell. It has a Next.js 16 App Router frontend, a Cloudflare Worker produced by OpenNext, production and staging D1 databases, daily Medium puzzles, local/server recovery, deterministic tiered hints, verified completion, aggregate result statistics, and signed public result sharing.

The repository was clean at audit start. `main`, `origin/main`, and the live GitHub `main` ref all pointed to `12772de4d5c324c774ed8a988cc3c78a89053914`; there were no local-only or remote-only commits and no existing tags. This commit is the audited product source baseline and is the required target for the eventual `phase0-baseline` tag; the PR #1 audit-document merge commit must not be used as that tag target. Historical Production Worker deployment records are primarily upload-based or unknown-source and still cannot reliably prove that the deployed artifact matches `12772de4d5c324c774ed8a988cc3c78a89053914`. Separately, PR #1 has now demonstrated Cloudflare Git integration for previews: audit commit `7edba7245290c8c6ea0b4f82661a6e07b15cb4ad` produced both commit-specific and branch-specific Preview deployments. The remaining provenance gap is therefore Production Git SHA traceability and a controlled Production release process, not Preview commit association.

Quality gates are healthy: frozen install, lint, typecheck, 33 unit tests, production build, and the single Playwright E2E test pass. The E2E test initially could not launch because the Playwright browser binary was absent; after installing the declared Chromium runtime it passed without code changes.

The main blockers before SEO/growth work are missing `sitemap.xml`, incomplete `robots.txt`, absent canonical/OG/Twitter metadata on the indexable home and Sudoku pages, no favicon, no custom 404, no Schema.org markup, incomplete Production deploy-to-commit provenance, and no API rate limiting. PR Preview deployments already have Git commit association. The hint endpoint also authorizes only by a user-supplied session ID, unlike save/complete/share endpoints, which require an HMAC session token.

## 2. Current Architecture

### Git and repository state

- Audit branch: `chore/phase0-baseline-audit`, created from `main` at `12772de`.
- Remote: `origin = https://github.com/jazfox-cloud/puzzgrind.git`.
- Start state: clean (`main...origin/main`); no staged, modified, or untracked files.
- Ahead/behind at baseline: `0/0`; `git ls-remote` confirmed remote `main` at `12772de`.
- Existing remote feature branches: `codex/fix-hint-share-ui`, `codex/public-result-sharing`, and `codex/task-002-d1`.
- Tags: none.
- Recent history is a sequence of Sudoku Phase 0 deliveries: Cloudflare share-card bundling, public result sharing, hint/share UI, D1 seed compatibility, production seed data, completed-session locking, verified completion, hints, local recovery, UTC rollover handling, and Worker runtime support.

### Stack and deployment model

- Framework: Next.js `16.2.10`, App Router, React/React DOM `19.2.7`, TypeScript `^5.9`.
- Package manager: pnpm `11.7.0`, locked by `pnpm-lock.yaml`; Node requirement `>=22.13.0`.
- Styling: Tailwind CSS `4.3.2` through `@tailwindcss/postcss`.
- Test/tooling: ESLint 9, Vitest `4.1.10` with jsdom, Playwright `1.61.1`.
- Cloudflare adapter: `@opennextjs/cloudflare 1.20.1`; build output is `.open-next/worker.js` plus `.open-next/assets`.
- Runtime: Cloudflare Workers, not Cloudflare Pages. Deploy scripts call `opennextjs-cloudflare deploy` directly.
- Persistence: D1 only. No KV, R2, Queues, Durable Objects, Analytics Engine, or external database bindings were found.
- D1 bindings: production `puzzgrind-db` (`d3e6…af7`) and staging `puzzgrind-staging-db` (`d3f0…e0f`) both exist in the queried account.
- Runtime secret: `SESSION_SIGNING_SECRET` exists by name in both production and staging. `NEXT_PUBLIC_SITE_URL` is build-time metadata configuration; `.env.example` contains only its public production URL.
- No clearly duplicate dependency was found. `jsdom` is required by the Vitest configuration, Playwright covers E2E, and Wrangler/OpenNext serve distinct build/deploy roles. Exact version pinning is mixed (`next`, React, OpenNext, Playwright, Tailwind, Vitest, Wrangler pinned; type packages/ESLint/TypeScript ranged), which is acceptable with a committed lockfile but should be kept intentional.

### Project structure

- Pages: `/` (`app/page.tsx`), `/sudoku` (`app/sudoku/page.tsx`), and signed `/sudoku/share/[token]` result pages.
- API routes: health, D1 health, daily puzzle, session start/save/complete, hint, share-token creation, and dynamic share-card image generation.
- UI components: `components/sudoku/SudokuGame.tsx` and `PublicShareActions.tsx`.
- Game logic: `lib/sudoku/` contains board parsing, validation, candidates, solver, techniques, hints, daily puzzle reads, and local storage.
- Data layer: `lib/db/` repositories, row mappers, types, and D1 interfaces; schema is in `migrations/0001_sudoku_core.sql`.
- Security: HMAC session/share tokens in `lib/security/`.
- Configuration: `next.config.ts`, `open-next.config.ts`, `wrangler.jsonc`, TypeScript, ESLint, Vitest, Playwright, PostCSS, pnpm workspace/lock files.
- Static assets: no `public/` files were found.
- SEO files: root/page metadata exists, but there are no robots, sitemap, manifest, favicon/icon, structured-data, or custom not-found source files.

### Rendering model

The production build reports `/` and the framework `_not-found` as static. `/sudoku`, share pages, and all APIs are dynamic server-rendered Worker routes. `/sudoku` explicitly uses `force-dynamic`; its live response is `private, no-cache, no-store`. The homepage is prerendered and currently served with `s-maxage=31536000`.

## 3. Existing Features

| Feature | Status | Code-based finding |
| --- | --- | --- |
| Sudoku board | Available | Interactive 9×9 grid with givens, selection, row/column labels, conflict and hint highlighting. |
| New game | Partial | One UTC daily puzzle; `Restart` resets the current daily puzzle. There is no random/new puzzle generator exposed to users. |
| Difficulty selection | Not available | Data model and UI are intentionally fixed to `medium`. |
| Number input | Available | On-screen 1–9 buttons and keyboard 1–9; erase supports button, Backspace/Delete/0. |
| Notes | Available | Candidate note mode with toggle and per-cell candidates. |
| Error feedback | Available | Duplicate conflicts are marked red with `!`; mistake count increments on newly introduced conflicts. It does not immediately compare ordinary entries to the stored solution. |
| Timer | Available | Counts by second, supports pause/resume, saves/restores elapsed time, and stops after completion. |
| Undo | Available | Undo and redo with local history/future, capped to 100 snapshots in persisted storage. Keyboard Cmd/Ctrl+Z supports undo. |
| Hint | Available | Deterministic Level 1–3 explanations; highlights target cells and does not fill a value. Techniques include singles and configured elimination techniques. |
| Completion | Available | Client detects a complete valid grid; server verifies givens, validity, and exact D1 solution before marking the session won. |
| Local save | Available | Versioned `localStorage` save includes board, notes, selection, timer, pause, history, mistakes, and hints. |
| Server save | Available | Signed session token, debounced save plus 15-second periodic save, D1 recovery by anonymous browser UUID and puzzle. |
| Daily Puzzle | Available | UTC daily published Medium puzzle from D1; response includes expiry and is shared worldwide. Staging may fall back to latest published puzzle. |
| Completion stats | Available | Starts/completions/time/hints aggregate in D1; UI reveals aggregate rate/time only after at least 20 completions. |
| Public sharing | Available | Signed result URL, generated 1200×630 result card, native/copy sharing, and platform launch helpers. Public result pages are deliberately `noindex`. |

Not found: difficulty chooser, random unlimited puzzles, accounts/login, cross-device identity beyond anonymous ID, leaderboard, streak/calendar UI, offline/PWA mode, or automated puzzle publication scheduling.

## 4. Build and Test Results

Commands were run on 2026-07-12 against `12772de` before the audit-document commit.

| Check | Result | Notes |
| --- | --- | --- |
| `CI=1 pnpm install --frozen-lockfile` | Pass | Already up to date; pnpm 11.7.0. An initial non-CI invocation was blocked by no-TTY module purge behavior and registry access, not a lockfile error. |
| `CI=1 pnpm lint` | Pass | `eslint . --max-warnings=0`, no warnings. |
| `CI=1 pnpm typecheck` | Pass | `tsc --noEmit`. |
| `CI=1 pnpm test` | Pass | 12 files, 33 tests, 0 failures. |
| `CI=1 pnpm test:e2e` | Pass after environment setup | First run failed because Playwright Chromium was not installed; `pnpm exec playwright install chromium` fixed the environment. One Chromium test passed. A harmless Next dev `allowedDevOrigins` warning was emitted. |
| `CI=1 pnpm build` | Pass | Next.js 16.2.10 webpack production build compiled, typed, and generated 11 static page entries successfully. |

Test coverage risk: unit coverage is strong for Sudoku logic, storage, D1 repositories, and token security, but the E2E suite has only one homepage smoke test. It does not exercise the daily puzzle API, gameplay, hints, recovery, completion, sharing, or staging/production Worker runtime.

## 5. Cloudflare Deployment Review

### Checked-in configuration

- `wrangler.jsonc` points `main` to `.open-next/worker.js` and assets to `.open-next/assets`.
- Compatibility date is `2026-07-11` with `nodejs_compat`; observability is enabled.
- Production Worker name is `puzzgrind`; staging resolves to `puzzgrind-staging` and sets `ALLOW_STAGING_PUZZLE_FALLBACK=true`.
- Production and staging use distinct D1 bindings and both have `SESSION_SIGNING_SECRET` configured by name.
- The checked-in manual build command is effectively `opennextjs-cloudflare build`; `pnpm deploy` and `pnpm deploy:staging` perform direct Worker uploads. This is a Workers deployment, not a Cloudflare Pages project, so Pages-specific build/output terminology does not apply.
- Cloudflare Git integration is active for pull requests even though its settings are not represented in `wrangler.jsonc`: PR #1 automatically produced commit and branch Preview URLs tied to commit `7edba7245290c8c6ea0b4f82661a6e07b15cb4ad`. The checked-in configuration still does not document or enforce the Production branch, approval, or Git-SHA release policy.

### Live/account findings

- Wrangler authentication succeeded against account `7a044…f8af`; one nonessential OAuth scope warning (`challenge-widgets.write`) was reported.
- Production and staging deployment histories exist. Sources are recorded as `Upload`, `Unknown (deployment)`, or `Secret Change`, not GitHub commit SHAs.
- Latest queried production deployment: 2026-07-12 06:08:16 UTC, version `828584e4-…`.
- Latest queried staging deployment: 2026-07-12 06:00:02 UTC, version `055e26ed-…`.
- After the initial audit, Cloudflare Bot reported a successful Git-integrated PR Preview for audit commit `7edba7245290c8c6ea0b4f82661a6e07b15cb4ad`: commit Preview `https://276b17b8-puzzgrind.jazfoxbrook.workers.dev` and branch Preview `https://chore-phase0-baseline-audit-puzzgrind.jazfoxbrook.workers.dev`.
- `https://puzzgrind.com/`, `/sudoku`, `/api/health`, and `/api/health/db` returned HTTP 200. D1 health reported `connected`, four schema tables, and 120 puzzles.

### Deployment risks

1. Incomplete Production commit-to-deployment provenance: historical Production records do not reliably tie the live artifact to `12772de4d5c324c774ed8a988cc3c78a89053914`. This does not apply to PR Preview, where Cloudflare has demonstrated commit- and branch-specific association for `7edba7245290c8c6ea0b4f82661a6e07b15cb4ad`.
2. No documented, source-controlled Production release policy: authorized local checkouts can still invoke a direct Production deploy, and the audit found no enforced Production branch/approval/SHA-recording path. PR Preview branch mapping is working and is not the gap.
3. No CI workflow is checked in for repeatable build, migration, deploy, smoke test, or rollback evidence.
4. D1 database identifiers are intentionally public configuration, not secrets; the actual HMAC secret is correctly absent from Git and stored as Worker secret text.
5. Local `next build` validates Next output but does not build `.open-next`; the deployment scripts do. A CI gate should also run `opennextjs-cloudflare build`.

## 6. SEO Review

| Item | Status | Finding |
| --- | --- | --- |
| Title | Pass | Global title/template and Sudoku-specific title exist. |
| Meta description | Pass | Global and Sudoku-specific descriptions exist. |
| Canonical | Missing on indexable pages | Only signed share pages generate a canonical; home and `/sudoku` do not. |
| robots.txt | Incomplete | Live `/robots.txt` is HTTP 200 but contains only Cloudflare content-signal text, with no `User-agent`, `Allow/Disallow`, or sitemap reference. |
| sitemap.xml | Missing | Live `/sitemap.xml` returns the default 404. |
| Open Graph | Missing on indexable pages | Signed share pages have dynamic OG metadata and image; home and `/sudoku` do not. |
| Twitter Card | Missing on indexable pages | Present only on signed share pages. |
| Schema.org | Missing | No JSON-LD or other structured data. |
| Favicon/icons | Missing | No `public/` assets or App Router icon files. |
| 404 | Functional but generic | Next's default noindex 404 works; no branded `app/not-found.tsx`. |
| Indexability | Partial | Home and Sudoku have no noindex and are indexable. Signed result pages explicitly use `noindex, follow`, which is appropriate for tokenized near-duplicate pages. APIs are not SEO pages. |
| URL structure | Good | Short lowercase routes: `/`, `/sudoku`, `/sudoku/share/[token]`; no duplicate route variants were found in code. |
| Rendering | Mixed, appropriate | Home is static; Sudoku and share/API routes run dynamically on the Worker. Core Sudoku heading/copy is server HTML, while gameplay loads client-side. |

The immediate SEO baseline is therefore incomplete despite correct titles and descriptions. Add canonical metadata, a real robots route/file, sitemap, sitewide social metadata/image, icons, and a branded 404 before intentional indexing or launch promotion.

## 7. Performance Review

- The build emitted about 904 KB of raw JavaScript across all `.next/static/chunks` files counted locally. This is not per-route transfer size and is not gzip/Brotli size.
- The Sudoku route-specific client chunk is about 21.5 KB raw; the share-page client chunk is about 2.2 KB raw. Large shared raw chunks include roughly 222 KB, 200 KB, 190 KB, and 137 KB framework/runtime files, plus a 113 KB legacy polyfill chunk.
- The homepage page chunk is only 183 bytes and is statically prerendered. It receives a one-year shared cache TTL in the live response.
- `/sudoku` is `force-dynamic` and live responses are no-store, even though the shell content changes rarely. The daily puzzle API itself is sensibly cached for 60 seconds browser/300 seconds shared. Consider keeping the page shell static and fetching the daily data client-side (already done) unless dynamic rendering is required for another reason.
- `SudokuGame.tsx` is a single client component of roughly 500 lines and owns fetches, timers, persistence, game state, completion, and sharing. Its route chunk is currently modest, but splitting state/service concerns would reduce regression risk and unnecessary rerenders as Phase 0 expands.
- Autosave is debounced and runs every 15 seconds while active. This is reasonable for recovery but creates recurring Worker/D1 writes; monitor write volume and coalesce unchanged state.
- Share-card responses use `public, max-age=31536000, immutable`, appropriate because signed result-token content is immutable.
- No third-party analytics, ads, fonts, tag managers, or runtime SDK scripts were found. Social platforms are opened only on user action.
- No explicit security/cache header policy is configured in Next or Worker middleware. Static asset caching is delegated to OpenNext/Cloudflare defaults.

## 8. Security Review

Strengths:

- No committed credentials, private keys, API tokens, or secret values were found. `.env.example` contains only a public site URL.
- Save, complete, and share endpoints verify HMAC tokens, expiry, session/puzzle/anonymous ID binding, and a rotating nonce. Signature comparison is constant-time style.
- Completion is authoritative on the server and must match the stored D1 solution; client claims alone cannot mark a win.
- Boards, numeric limits, UUIDs, givens, and token payloads receive meaningful validation. D1 access uses bound parameters.
- Public share tokens disclose only result metrics/date, not anonymous or session IDs, and share pages are noindex.
- No `dangerouslySetInnerHTML` with user-controlled content or user-authored HTML rendering was found.

Risks:

1. **Hint authorization gap (high):** `/api/sudoku/hint` accepts `sessionId`, board, and level without requiring the signed session token or checking nonce/anonymous ownership. A discovered/guessed UUID is difficult to enumerate, but a leaked session ID permits hint-event/stat manipulation. Align it with save/complete authorization.
2. **No rate limiting/abuse controls (high):** session start, hint, save, complete, share, health, and image endpoints have no application-visible throttling or Turnstile/WAF contract. Attackers can create anonymous UUIDs and cause D1 writes or share-card CPU work.
3. **Client-reported metrics (medium):** elapsed time and mistakes are bounded but client-controlled. Results are solution-verified, not cheat-proof; public “verified” wording may overstate timing/mistake integrity.
4. **Share tokens do not expire (medium):** share payloads validate `issuedAt` but do not enforce age. This matches immutable public links but should be an explicit retention/privacy decision and supported by key rotation planning.
5. **Notes shape validation (medium):** save/complete require `notes` to be an array but route-level validation does not visibly enforce exactly 81 cells, digits 1–9, uniqueness, or payload size before persistence. Validate nested shape and request body limits.
6. **Missing response hardening (medium):** live responses did not show an application-set CSP, HSTS, frame-ancestors/X-Frame-Options, Referrer-Policy, or Permissions-Policy. Cloudflare may add account-level controls not visible in the repository; define and test the intended policy in source or documented edge rules.
7. **Host-derived share metadata (low/medium):** share-page origin is built from forwarded/Host headers. Cloudflare normally supplies trusted values, but allowed-host enforcement would prevent poisoned canonical/share URLs if the Worker is reachable through unexpected hostnames.
8. **Public operational health details (low):** `/api/health/db` exposes schema table count and puzzle count. It does not leak secrets, but production access could be restricted or the payload minimized.

## 9. Blocking Issues

Before treating Phase 0 as a launch-ready baseline:

1. Add and verify `sitemap.xml`; current production returns 404.
2. Replace/augment the Cloudflare-only robots response with explicit crawl rules and a sitemap reference.
3. Add home/Sudoku canonicals, OG/Twitter defaults, favicon/icons, and a branded 404.
4. Require the signed session token for hints and validate the token/session nonce relationship.
5. Add abuse controls for D1-writing and image-generation endpoints.
6. Add nested notes/payload-size validation.
7. Extend the working Git-integrated PR Preview path into a reproducible, protected Production Git SHA → Worker version release path with approvals and smoke checks.
8. Expand E2E coverage beyond the homepage so core gameplay and Worker/D1 integrations are release-gated.

The missing difficulty selector and random “new game” are product-scope gaps, not blockers for the current one-daily-Medium specification.

## 10. Recommended Next Tasks

1. **Tag policy:** after PR #1 is reviewed and merged, create annotated `phase0-baseline` specifically at `12772de4d5c324c774ed8a988cc3c78a89053914`. This is the audited product source baseline; do not tag the PR #1 audit-document merge commit. Record that historical Production artifact consistency with this commit remains unproven, while PR Preview commit association is confirmed.
2. **Security patch:** token-protect the hint route, validate notes deeply, impose body-size limits, and add Cloudflare/application rate limits with tests.
3. **SEO foundation:** implement `app/robots.ts`, `app/sitemap.ts`, metadata canonicals, default OG/Twitter image, icons/manifest as needed, Schema.org `WebSite`/`VideoGame` or `Game`-appropriate markup after validating the schema choice, and `app/not-found.tsx`.
4. **Deployment pipeline:** retain the working Git-integrated PR Preview flow and add controlled Production CI for frozen install, lint, typecheck, unit, E2E, Next build, OpenNext build, migration safety, staging deploy/smoke, approval, production deploy, and Worker-version/SHA recording.
5. **Integration coverage:** test daily fetch, input/notes, conflicts, undo/redo, pause/recovery, all hint levels, successful and rejected completion, signed share pages, and production-like OpenNext/D1 behavior.
6. **Performance measurement:** capture route-level compressed JS and Lighthouse/Web Vitals in staging; then decide whether to remove `force-dynamic` from `/sudoku` and split `SudokuGame` based on measured benefit.
7. **Operational controls:** define security headers, host allowlist/canonical redirect, health endpoint exposure, Worker rollback procedure, secret rotation, D1 backup/recovery, and daily puzzle publication monitoring.
8. **Product backlog:** only after the baseline blockers are cleared, decide whether Phase 0 should remain one global Medium daily or add difficulty choice, random puzzles, streaks, accounts, and leaderboards.
