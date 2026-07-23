# Lexi Daily local and staging runbook

## Local development only

Run `pnpm d1:lexi:setup:local`. It applies repository migrations to Wrangler's local `puzzgrind-staging-db` state and then runs `scripts/seed-lexi-development.mjs`.

The seed is development/test only. It calculates yesterday, today, and tomorrow at execution time and creates exact `lexi-dev-*` records: a published current puzzle, an archived past puzzle, a scheduled future puzzle, won/lost/in-progress/expired sessions, and one leaderboard score. It refuses `--remote`, `APP_ENV=preview`, and `APP_ENV=production`. Production migration commands never invoke it.

## Cloudflare resources required before staging

Create five independent Rate Limiter bindings in each deployed environment:

- `RATE_LIMIT_LEXI_START`
- `RATE_LIMIT_LEXI_GUESS`
- `RATE_LIMIT_LEXI_HINT`
- `RATE_LIMIT_LEXI_READ`
- `RATE_LIMIT_LEXI_SUBMIT`

Cloudflare Rate Limiting namespace IDs are account-unique positive integers defined in Worker configuration; they are not separately provisioned UUID resources. Staging uses Lexi-only namespaces `2201`–`2205`, distinct from Production `1101`–`1106`, Staging Sudoku `2101`–`2106`, and Preview `3101`–`3106`.

Wrangler's remote migration `query` path cannot parse the trigger bodies in `0003_lexi_daily.sql` even though the same SQL passes local D1 and SQLite tests. The Staging-only `d1:migrate:staging` command therefore uses Wrangler's atomic remote file-ingestion path and records `0003` in `d1_migrations` in the same import. It requires explicit `--env staging`, the exact Staging database ID, and the database name confirmation. This compatibility path must not be used for Production.

The Staging QA seed is separate from the development seed and refuses implicit targets. Put exactly three unique QA-only answers in a JSON `answers` array under the gitignored `.private/lexi-staging/` directory. Run `pnpm d1:lexi:seed:staging -- --remote true --env staging --database-id <staging-id> --confirm puzzgrind-staging-db --acknowledge LEXI_STAGING_QA_ONLY --qa-file .private/lexi-staging/<private-file>.json`. It protects occupied dates, writes only three clearly labeled QA puzzles and four fixture sessions, never prints the private answers, and deletes its temporary SQL file after import.

If Staging has no current-UTC Sudoku fixture, `pnpm d1:sudoku:seed:staging -- --remote true --env staging --database-id <staging-id> --confirm puzzgrind-staging-db --acknowledge SUDOKU_STAGING_QA_ONLY` copies the most recent Staging-only published grid into the current date without printing its givens or solution. It refuses to replace a non-QA current-date puzzle.

## Proposed staging sequence — do not run without approval

1. Create staging Rate Limiter resources and add only their verified staging bindings.
2. Run `pnpm d1:migrate:staging` to apply the additive migration to the existing staging D1 database.
3. Use a separately reviewed staging seed containing one current test puzzle. Do not reuse the development seed and do not include the future production schedule.
4. Deploy a staging Worker and smoke-test `/games/lexi-daily`, all five `/api/lexi/*` route groups, `/sudoku`, `/privacy`, `/robots.txt`, and `/sitemap.xml`.
5. Verify missing limiter bindings fail closed, tokens remain scope-isolated, and browser artifacts contain no server word list or candidate answers.

## Rollback

The migration is additive. Roll back the Worker deployment first and leave the unused Lexi tables in place; do not drop tables during an incident. Disable Lexi navigation/routes in a follow-up build if needed. Remove or rotate staging limiter bindings only after the rolled-back Worker is confirmed healthy. Production migration and seed require a separate approval and rollback review.
