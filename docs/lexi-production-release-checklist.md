# Lexi Daily — Production release checklist

Status: pre-release checklist only. None of these Production actions were
executed during Phase 1B batch five preparation.

## Locked release order

1. Run final local lint, typecheck, unit/API/migration tests, Playwright,
   Production build, `git diff --check`, deploy guard, and Production answer
   secrecy guard.
2. Commit only the approved fifth-batch code; do not push.
3. Reserve the audited Production Lexi Rate Limiter IDs `1201`–`1205`, apply
   only the reviewed `env.production.ratelimits` diff, and validate an inactive
   version's bindings if that optional Cloudflare step is approved.
4. Capture and privately record the Production D1 Time Travel bookmark.
5. Reconfirm account `7a04450464f7860772c01d269c4bf8af`, database
   `puzzgrind-db`, and ID `d3e6e288-046a-4552-b6d2-39f014276af7`.
6. Run the trigger-safe 0003 atomic file import, then verify five tables, six
   explicit indexes, four triggers, and one ledger row.
7. Generate the private approved 90-day schedule and run seed dry-run.
8. Execute the idempotent Production seed and verify today's `published` row
   without selecting or logging its answer.
9. Push the exact commit only after bindings, migration, and today's puzzle are
   ready.
10. Wait for Git-integrated Production deployment and verify its source SHA.
11. Run Lexi API/UI smoke, Sudoku regression, SEO/static-route checks, Rate
    Limit checks, and answer/log leakage checks.
12. For Worker failure, roll back the Worker version and retain additive Lexi
    schema. Use full-database D1 Time Travel only for a confirmed D1 incident.

Cloudflare Rate Limiter namespace IDs are defined by Worker bindings, not
standalone resources. The reviewed safe equivalent to separate “create” and
“bind” steps is documented in `lexi-production-readiness-dry-run.md`; human
acceptance of that capability adjustment is a release gate.

## Release gate

- [ ] Review and checkpoint every uncommitted batch-four code/config change, including the D1 trigger `meta.changes > 0` fixes found in real Staging.
- [ ] Resolve the Wrangler 4.110 remote migration parser blocker. `0003_lexi_daily.sql` contains SQLite trigger bodies that pass local D1/SQLite but fail the standard remote `query` migration path with `incomplete input`. Approve either a tested Wrangler upgrade or a Production-specific atomic file-ingestion runner with exact target guards and same-import ledger recording.
- [ ] Rerun lint, typecheck, all unit/API/migration tests, Playwright, Production build, artifact validation, and `git diff --check` from the intended release commit.
- [ ] Confirm the release commit contains no `reports/`, `.wrangler/`, local D1/SQLite files, Playwright traces/screenshots, temporary build directories, QA SQL, secrets, tokens, or dated answer schedule.

## Production migration

- [ ] Read-only list pending migrations against the exact Production database name/ID; do not infer the target from a binding name.
- [ ] Record the Production D1 Time Travel bookmark immediately before migration.
- [ ] Confirm migrations are additive and no rollback plan deletes tables.
- [ ] Apply only approved pending migrations using the resolved trigger-safe path.
- [ ] Verify ledger order, five `lexi_*` tables, indexes, four triggers, foreign keys, unique constraints, and CHECK constraints.
- [ ] Run read-only Sudoku schema/data compatibility checks; do not alter historical Sudoku rows.

## Production Rate Limiter resources and bindings

- [ ] Allocate five new account-unique Production namespace IDs for `RATE_LIMIT_LEXI_START`, `RATE_LIMIT_LEXI_GUESS`, `RATE_LIMIT_LEXI_HINT`, `RATE_LIMIT_LEXI_READ`, and `RATE_LIMIT_LEXI_SUBMIT`.
- [ ] Confirm they do not overlap Production Sudoku, Preview, or Staging namespaces.
- [ ] Bind only in `env.production` with 12/min, 12/min, 4/min, 60/min, and 6/min respectively.
- [ ] Regenerate Cloudflare type definitions and verify all Lexi routes fail closed when a required binding is missing.
- [ ] Re-run the Production deploy guard and inspect the planned binding diff before upload.

## Formal 90-day answer schedule and seed

- [ ] Obtain separate human approval for at least 90 answers after proper-name, offensive/sensitive, regional, spelling, repetition, and familiarity review.
- [ ] Create a dated schedule in a non-public release channel; do not commit it to a public repository or static asset directory.
- [ ] Check duplicate dates/answers, UTC continuity, five-letter lowercase ASCII constraints, valid-guess membership, and source attribution.
- [ ] Generate a Production-only seed from the separately approved schedule; do not reuse Development or Staging QA seed scripts.
- [ ] Require explicit Production env, database name/ID, release identifier, and second confirmation before seed execution.
- [ ] Seed only the approved window and verify no answer is exposed through HTML, RSC, client bundles, source maps, static JSON, or public files.

## Production deploy

- [ ] Confirm the target Worker is `puzzgrind`, the intended release commit is checked out, and no push/branch action can trigger an unintended deployment.
- [ ] Build the Production artifact with Production indexability: canonical, `og:url`, sitemap, and robots must pass artifact validation.
- [ ] Deploy with the guarded Production script only after migration, bindings, and seed gates are green.
- [ ] Record deployment ID, version ID, Worker URL, commit SHA, D1 bookmark, and exact binding inventory without recording secrets.

## Production smoke

- [ ] Verify `/games/lexi-daily`, `/api/lexi/today`, session start, invalid/duplicate/revision behavior, repeated letters, hint gate/idempotency, win, sixth-attempt loss, share, streak, leaderboard Top 10/20/`isYou`, UTC expiry, rate limits, and cross-game token isolation.
- [ ] Verify home game entries, full Sudoku play/save/hint/completion, Privacy, robots, four-URL sitemap, canonical, JSON-LD, Footer, custom 404, manifest, and 390×844 plus 1440×900 layouts.
- [ ] Verify `/api/lexi/today` and pre-loss start responses do not reveal the answer; scan HTML/RSC/client assets/source maps for wordlists, candidate lists, schedules, tokens, and secrets.
- [ ] Confirm analytics events contain event metadata only—never guesses, answers, tokens, anonymous IDs, nicknames, or personal information.

## Rollback

- [ ] Define the previously known-good Production Worker version before deployment.
- [ ] If runtime smoke fails, shift traffic back to that Worker version; leave additive D1 schema in place.
- [ ] Disable or withdraw only the Lexi route/navigation exposure if needed; do not roll back by deleting D1 tables.
- [ ] Use D1 Time Travel only for demonstrated data corruption and only after a separate destructive-action approval.
- [ ] Record incident evidence and the exact rollback decision before retrying release.

## GSC and sitemap follow-up

- [ ] After stable Production smoke, inspect the live sitemap and robots response from the formal domain.
- [ ] Submit or refresh `https://puzzgrind.com/sitemap.xml` in Google Search Console.
- [ ] Request indexing for the Lexi page only after canonical/noindex checks pass.
- [ ] Monitor crawl/index status and page-level errors; do not create answer, archive, bulk word, or tool pages in this phase.
