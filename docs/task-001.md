# TASK-001 — Project initialization and Cloudflare deployment

## Goal

Initialize the PuzzGrind Phase 0 single Next.js application, establish local quality gates, and publish it through a GitHub-backed Cloudflare deployment.

## In scope

- Next.js App Router, React, TypeScript strict and Tailwind CSS.
- pnpm with a pinned Node runtime.
- Vitest, Playwright and GitHub Actions.
- OpenNext Cloudflare adapter and Worker configuration.
- Minimal brand landing page and health endpoint.

## Out of scope

- D1 business tables.
- Sudoku domain logic or UI.
- Authentication.
- Multiple games, monorepo, SDK or plugin abstractions.

## Acceptance commands

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm preview
```

Production is accepted only after GitHub is the Cloudflare deployment source and the deployed commit is verified over HTTP.
