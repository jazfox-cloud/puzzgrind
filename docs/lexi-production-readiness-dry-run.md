# Lexi Daily Production readiness dry-run

Status: preparation only, recorded 2026-07-23. No Production write, binding
change, limiter deployment, migration, seed, push, or deployment was performed.

## Exact target and read-only evidence

- Cloudflare account: `7a04450464f7860772c01d269c4bf8af`
- D1 name: `puzzgrind-db`
- D1 ID: `d3e6e288-046a-4552-b6d2-39f014276af7`
- The name and ID match `wrangler.jsonc`, `wrangler d1 list`, and
  `wrangler d1 info`.
- D1 reports the production storage backend and the Time Travel info command
  returned a current bookmark.
- Production ledger contains exactly `0001_sudoku_core.sql` and
  `0002_daily_leaderboard.sql`; `0003_lexi_daily.sql` is absent.
- No `lexi_*` table, explicit index, or trigger exists in Production.
- All six expected Sudoku tables and eight explicit Sudoku indexes exist.
  `pragma_foreign_key_check` returned zero violations.
- The remote API rejects `PRAGMA integrity_check` with `SQLITE_AUTH`; this is a
  Cloudflare query restriction, not an observed integrity failure.

## Trigger-safe migration

The pinned SHA-256 of `migrations/0003_lexi_daily.sql` is
`bb8a604455e9f78fa237f8408faaafa59574e606a3b30262521cae2f855d6da8`.
The Production command uses `wrangler d1 execute --file` internally, not the
known-failing migrations/query statement splitter. The schema and ledger insert
are in the same D1 import. Cloudflare documents that a failed remote file import
returns the database to its original state.

Dry-run:

```sh
pnpm d1:migrate:production -- \
  --env production \
  --account-id 7a04450464f7860772c01d269c4bf8af \
  --database-name puzzgrind-db \
  --database-id d3e6e288-046a-4552-b6d2-39f014276af7
```

Exact release-time write command — do not run before approval:

```sh
pnpm d1:migrate:production -- \
  --env production \
  --account-id 7a04450464f7860772c01d269c4bf8af \
  --database-name puzzgrind-db \
  --database-id d3e6e288-046a-4552-b6d2-39f014276af7 \
  --execute \
  --confirm-production
```

Local validation covered a fresh in-memory database and an independent
temporary file database. Both passed first import, 5 tables, 6 explicit
indexes, 4 triggers, constraints, ledger, second-run no-op, and real trigger
behavior. An injected failure rolled schema and ledger back together. The 15
normalized `sqlite_master` definitions produced by repository `0003` match the
15 current Staging definitions exactly.

## D1 recovery

Cloudflare D1 Time Travel is always on for this database's production storage
backend. At the release gate, record the returned bookmark and UTC timestamp in
the private release record:

```sh
pnpm exec wrangler d1 info puzzgrind-db --env production --json
pnpm exec wrangler d1 time-travel info puzzgrind-db --env production --json
```

Verify a recorded timestamp resolves to a bookmark:

```sh
pnpm exec wrangler d1 time-travel info puzzgrind-db \
  --env production \
  --timestamp "<release-gate-RFC3339-UTC>" \
  --json
```

Destructive recovery command — only after incident approval, with the exact
privately recorded bookmark:

```sh
pnpm exec wrangler d1 time-travel restore puzzgrind-db \
  --env production \
  --bookmark "<exact-private-release-bookmark>"
```

A D1 restore overwrites the entire `puzzgrind-db` state in place, including
Sudoku and Lexi, and cancels in-flight queries. It is not a schema-only rollback.
Cloudflare returns the previous bookmark so the restore can itself be undone.
A Worker rollback changes executable code and bindings only:

```sh
pnpm exec wrangler rollback "<known-good-worker-version-id>" \
  --name puzzgrind \
  --env production \
  --message "Rollback Lexi release"
```

Normal Worker rollback must retain the additive Lexi tables. Use D1 Time Travel
only for a confirmed database incident.

References:

- https://developers.cloudflare.com/d1/reference/time-travel/
- https://developers.cloudflare.com/d1/best-practices/import-export-data/
- https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/

## Private schedule and seed

The real ordered input belongs only under `.private/lexi-production/`. The
committable human audit contains count, date range, ESDB provenance, and the
SHA-256 of the canonical private input, but no answer. The validator requires:

- exactly 90 unique lowercase ASCII five-letter answers;
- membership in the pinned 5,097-word ESDB valid-guess set;
- an exact match to the human-approved input hash and ESDB provenance;
- 90 unique consecutive UTC dates beginning at the explicit release date;
- deterministic IDs, one first-day `published` row whose `published_at` is UTC
  midnight, and 89 future `scheduled` rows with null `published_at`.

The seed is dry-run by default. Remote execution additionally requires
`--execute`, `--confirm-production`, and exact account/name/ID arguments. The
release date must equal the current UTC date. A temporary SQL file is created
with mode `0600` inside the gitignored private directory and deleted in
`finally`.

The seed import uses temporary proposed rows and constraint guards. Same
date/same answer is a no-op; same date/different answer or the same answer on a
different date aborts the whole D1 file import. Output is limited to target,
count, first/last date, ESDB provenance, input hash, and schedule hash.

Dry-run, after the private input and answer-free human audit exist:

```sh
pnpm d1:lexi:seed:production -- \
  --env production \
  --account-id 7a04450464f7860772c01d269c4bf8af \
  --database-name puzzgrind-db \
  --database-id d3e6e288-046a-4552-b6d2-39f014276af7 \
  --input .private/lexi-production/approved-schedule.json \
  --audit docs/lexi-production-answer-audit.json
```

Exact release-time write command — do not run before the schedule is approved:

```sh
pnpm d1:lexi:seed:production -- \
  --env production \
  --account-id 7a04450464f7860772c01d269c4bf8af \
  --database-name puzzgrind-db \
  --database-id d3e6e288-046a-4552-b6d2-39f014276af7 \
  --input .private/lexi-production/approved-schedule.json \
  --audit docs/lexi-production-answer-audit.json \
  --execute \
  --confirm-production
```

## Rate Limiter audit and limitation

The account has two uploaded Workers. Current settings and the 10 visible
versions for each were inspected. Repository and account-visible usage is:

- Production Sudoku: `1101`–`1106`
- Staging Sudoku: `2101`–`2106`
- Staging Lexi: `2201`–`2205`
- Preview/default Sudoku: `3101`–`3106`

The audited unused Production Lexi reservation is `1201`–`1205`, mapped in
`docs/lexi-production-rate-limit.diff`.

Cloudflare does not expose Rate Limiter namespaces as separately created
resources. `namespace_id` is an account-unique positive integer defined on a
Worker version's binding. Therefore the literal release steps “create namespace”
then “bind it” cannot be two independent API operations. The safe equivalent is:

1. reserve the audited IDs in the release record;
2. apply the Production-only config diff locally and validate it;
3. optionally upload an inactive Production version to validate bindings;
4. complete D1 migration and seed;
5. only then allow the source-SHA deployment to receive traffic.

This capability adjustment needs human acceptance before the release. Current
application code returns `503 rate_limiter_unavailable` before any D1 statement
when a Lexi binding is missing; a unit test asserts zero D1 statements.
The currently deployed Production version predates Lexi and returns 404 for
`/api/lexi/today`, so it also cannot reach D1 through a Lexi route; its D1 health
endpoint returned 200 during this read-only audit.

## Release simulation

`pnpm lexi:production:dry-run` passed 16/16 checks:

- migration first run and repeat no-op in both databases;
- virtual 90-row consecutive schedule;
- seed first run and same-input repeat;
- same date/different answer conflict with unchanged 90-row state;
- current-date-style published query;
- injected migration failure rollback;
- Worker rollback model leaves additive schema intact;
- proposed limiter structure uses `1201`–`1205` with approved thresholds.
- the seed CLI defaults to dry-run and deletes its virtual private fixtures.

The Production build, local Playwright smoke, full unit/API/migration suite, and
secrecy scan are run again at the final gate. Actual Worker version rollback,
inactive version upload, D1 bookmark capture at the release instant, binding
activation, migration, seed, push, and smoke remain manual Production actions.
