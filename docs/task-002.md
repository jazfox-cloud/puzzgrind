# TASK-002 — D1 binding, migrations, and Sudoku repositories

## Goal

Create the minimum Sudoku-specific D1 schema and repository layer needed by later Daily Puzzle, anonymous session, explainable hint, and aggregate statistics tasks.

## Inputs

- Approved Phase 0 execution constraints in `docs/puzzgrind-phase-0-sudoku-spec.md`.
- The four-table TASK-002 plan approved on 2026-07-11.

## Outputs

- A replayable SQL migration for the Sudoku core schema.
- A small typed D1 boundary and Sudoku-specific repositories.
- Unit tests for query binding, row mapping, and error handling.
- A staging-only D1 database and Worker deployment for user acceptance.

## File scope

- `migrations/**`
- `lib/db/**`
- `tests/unit/db/**`
- `wrangler.jsonc`
- `package.json`
- `docs/task-002.md`

## Explicit exclusions

- Production D1 creation or migration before user acceptance.
- Sudoku UI, validator, solver, hint algorithm, Daily API, or completion API.
- Authentication, users, cloud saves, leaderboards, achievements, favorites, or multiple difficulties.
- KV, ORM, generic game tables, SDK, plugin system, or monorepo changes.

## Acceptance criteria

- The migration creates `sudoku_puzzles`, `sudoku_sessions`, `sudoku_puzzle_stats`, and `sudoku_hint_events` with foreign keys and constraints.
- A test Medium puzzle can be inserted and read through parameterized queries.
- Duplicate puzzle dates and duplicate anonymous sessions are rejected.
- Hint events remain attributable to a server session.
- Local and staging migrations apply successfully.
- Lint, TypeScript, unit tests, Next.js build, and OpenNext build pass.
- A staging Worker uses a staging-only D1 database.
- Production remains unchanged until explicit user approval.

## Test commands

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm exec opennextjs-cloudflare build
pnpm exec wrangler d1 migrations apply puzzgrind-staging-db --local
pnpm exec wrangler d1 migrations apply puzzgrind-staging-db --remote
```

## Risks

- D1 constraints cannot validate Sudoku uniqueness or logical correctness; TASK-003 and TASK-004 own those checks.
- `abandoned_count` cannot be updated accurately on tab close and must later be computed from timed-out sessions.
- Production and staging database IDs must never be swapped.
