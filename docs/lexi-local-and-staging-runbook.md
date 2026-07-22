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

Each environment needs real Cloudflare-provided namespace/resource IDs. Local, preview/staging, and production must not share IDs. Record actual IDs only when the resources exist; do not add invented or placeholder IDs to `wrangler.jsonc`.

## Proposed staging sequence — do not run without approval

1. Create staging Rate Limiter resources and add only their verified staging bindings.
2. Run `pnpm d1:migrate:staging` to apply the additive migration to the existing staging D1 database.
3. Use a separately reviewed staging seed containing one current test puzzle. Do not reuse the development seed and do not include the future production schedule.
4. Deploy a staging Worker and smoke-test `/games/lexi-daily`, all five `/api/lexi/*` route groups, `/sudoku`, `/privacy`, `/robots.txt`, and `/sitemap.xml`.
5. Verify missing limiter bindings fail closed, tokens remain scope-isolated, and browser artifacts contain no server word list or candidate answers.

## Rollback

The migration is additive. Roll back the Worker deployment first and leave the unused Lexi tables in place; do not drop tables during an incident. Disable Lexi navigation/routes in a follow-up build if needed. Remove or rotate staging limiter bindings only after the rolled-back Worker is confirmed healthy. Production migration and seed require a separate approval and rollback review.
