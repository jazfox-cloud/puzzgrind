# PuzzGrind Phase 1 — Lexi Daily execution specification

Status: approved for incremental development

Approved: 2026-07-22

## Product scope

PuzzGrind is an English-language Daily Puzzle Platform. Phase 0 delivered Explainable Daily
Sudoku. Phase 1 adds the second game, Lexi Daily, without changing Sudoku URLs, data, SEO, or
leaderboards. Nonogram remains a future candidate and is outside this phase.

Phase 1 must retain the current Next.js App Router, TypeScript, pnpm, Cloudflare Workers, D1,
Vitest, and Playwright stack. It must not introduce a monorepo, plugin SDK, generic game engine,
account system, CMS, permanent global leaderboard, friend system, or real-time AI API.

## Lexi Daily rules

- Each UTC day has one globally shared answer.
- Answers and accepted guesses contain exactly five lowercase ASCII letters.
- A player receives at most six accepted guesses.
- Input is trimmed and normalized to lowercase before validation.
- A guess must be present in the accepted-guess lexicon.
- Invalid words do not consume an attempt or change persisted state.
- Repeating an already accepted guess returns `duplicate_guess`. It does not consume an attempt,
  change `guesses_json`, increment a revision, or write statistics. The UI message is
  `You already tried this word.` Network retries must not record a guess twice.
- Feedback values are `correct`, `present`, and `absent`. The evaluator uses two passes so repeated
  letters cannot claim more matches than the answer contains.
- The keyboard aggregates status using `correct > present > absent`.
- Correct uses blue, present uses orange, and absent uses neutral gray. Text, icons, borders, and
  accessible labels must also communicate status; color alone is insufficient.
- Matching the answer within six guesses wins. Six accepted misses lose. A UTC rollover before
  completion expires the old session rather than recording a six-guess loss.

## Hint policy

- A hint becomes available after at least two accepted guesses.
- Each session can use at most one hint.
- The server deterministically chooses an answer letter not already discovered through correct or
  present feedback.
- A hint reveals letter membership only, never position, multiplicity, or the complete answer.
- If all distinct answer letters are already discovered, the result is `no_hint_available` and no
  hint is consumed.
- Hint state is server-authoritative. No real-time AI is used.

## Leaderboard order

Only verified wins enter the daily leaderboard. Order is:

1. hints ascending;
2. attempts ascending;
3. verified completion time ascending;
4. `completed_at` ascending;
5. ID ascending.

Failed, expired, and incomplete sessions may contribute to aggregate statistics but do not receive
a public rank. The same anonymous player and puzzle can create at most one ranked result.

## Sharing

Answer-free sharing includes the game name, UTC date, attempts, hint count, completion time, a
blue/orange/neutral evaluation grid, and `https://puzzgrind.com/games/lexi-daily`. It never includes
the answer, submitted words, anonymous ID, session ID, or token. The wording and visual treatment
must remain PuzzGrind-specific and must not copy another game's fixed share text.

## Daily content and answer review

- The first scheduling batch covers 180 days.
- At least the next 90 scheduled answers require explicit human approval before production release.
- The accepted-guess lexicon and answer candidates are separate artifacts.
- Answer candidates must be common, fair, non-offensive English words and a subset of the accepted
  guesses.
- Production schedules must not be committed in date order to a public repository.
- This phase does not use leaked Wordle lists, `wordfreq`, or unverified GitHub word lists.

## ESDB source and license policy

The accepted-guess source is the official English Speller Database (ESDB, formerly SCOWL):

- repository: `https://github.com/en-wl/wordlist`;
- fixed tag: `rel-2026.02.25`;
- fixed commit: `7e99edab8e32f9f9ea2b15f249ca8d4d67237410`;
- download date: `2026-07-22`;
- archive SHA-256: `36efd5577ff6d8feaf6d16feda321381b2be633da38ce55e4644284433bb5ae6`.

PuzzGrind uses an American-English size-60 generated word list, variant level 1, excluding
abbreviations and special categories. It does not use Australian spelling codes or lists above
size 80. The upstream copyright and permission notice must remain in `third_party/esdb/Copyright`,
and attribution must remain in `THIRD_PARTY_NOTICES.md` and the repository source documentation.

The offline filter retains only five lowercase ASCII letters and removes ESDB no-suggest entries,
abbreviations, special categories, proper-case entries, punctuation, digits, diacritics, manual
offensive exclusions, and reviewed non-English noise. The generated lexicon must never be placed
under `public/`, imported by a Client Component, emitted as public JSON, or exposed through source
maps.

If a future ESDB tag changes these license obligations, generation must stop pending human review.

## Phase 1B batch boundaries

The first implementation batch includes documentation, small shared primitives, pure Lexi logic,
tests, fixed-source licensing records, offline filtering, and an undated 180-word candidate review
set. It explicitly excludes D1 migrations, API routes, UI, production seed generation, Cloudflare
binding changes, push, and deployment.
