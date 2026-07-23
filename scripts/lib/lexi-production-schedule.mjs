import { createHash } from "node:crypto";
import { readFileSync, realpathSync } from "node:fs";
import { relative, resolve } from "node:path";

const ASCII_FIVE = /^[a-z]{5}$/u;
const DATE = /^\d{4}-\d{2}-\d{2}$/u;
const PRIVATE_ROOT = resolve(process.cwd(), ".private/lexi-production");
const VALID_GUESSES_PATH = resolve(process.cwd(), "data/lexi/esdb-valid-guesses.txt");
const WORDLIST_REPORT_PATH = resolve(process.cwd(), "data/lexi/wordlist-report.json");

export function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

export function canonicalPrivateInput(input) {
  return `${JSON.stringify({
    schemaVersion: input.schemaVersion,
    releaseDate: input.releaseDate,
    answers: input.answers,
  })}\n`;
}

export function readPrivateProductionInput(path) {
  const file = realpathSync(resolve(process.cwd(), path));
  const pathFromRoot = relative(PRIVATE_ROOT, file);
  if (!pathFromRoot || pathFromRoot.startsWith("..") || pathFromRoot.startsWith("/")) {
    throw new Error("Production answers must be read from .private/lexi-production/");
  }
  return { file, input: JSON.parse(readFileSync(file, "utf8")) };
}

function parseUtcDate(date) {
  if (!DATE.test(date)) throw new Error("releaseDate must use YYYY-MM-DD");
  const timestamp = Date.parse(`${date}T00:00:00.000Z`);
  if (!Number.isFinite(timestamp) || new Date(timestamp).toISOString().slice(0, 10) !== date) {
    throw new Error("releaseDate must be a real UTC calendar date");
  }
  return timestamp;
}

export function validateAndBuildSchedule(input, audit, options = {}) {
  if (input?.schemaVersion !== 1 || !Array.isArray(input.answers)) {
    throw new Error("Private Production input schemaVersion 1 with answers is required");
  }
  if (input.answers.length !== 90) throw new Error("Production schedule requires exactly 90 answers");
  if (input.answers.some((word) => typeof word !== "string" || !ASCII_FIVE.test(word))) {
    throw new Error("Every Production answer must be five lowercase ASCII letters");
  }
  if (new Set(input.answers).size !== input.answers.length) throw new Error("Production answers must be unique");

  const wordlist = options.validGuesses ??
    new Set(readFileSync(VALID_GUESSES_PATH, "utf8").trim().split(/\r?\n/u));
  const absent = input.answers.filter((word) => !wordlist.has(word));
  if (absent.length > 0) throw new Error(`${absent.length} Production answers are outside the valid ESDB lexicon`);

  const inputSha256 = sha256(canonicalPrivateInput(input));
  const report = options.wordlistReport ??
    JSON.parse(readFileSync(WORDLIST_REPORT_PATH, "utf8"));
  if (audit?.schemaVersion !== 1 || audit.approvedAnswerCount !== 90 ||
    audit.approvedInputSha256 !== inputSha256) {
    throw new Error("Private input hash does not match the human-approved answer audit");
  }
  if (audit.source?.release !== report.source.release ||
    audit.source?.commit !== report.source.commit ||
    audit.source?.validGuessesSha256 !== report.artifacts.validGuessesSha256) {
    throw new Error("Answer audit ESDB provenance does not match the pinned repository wordlist");
  }

  const firstTimestamp = parseUtcDate(input.releaseDate);
  const generatedAt = options.generatedAt ?? Math.floor(Date.now() / 1_000);
  const rows = input.answers.map((answer, index) => {
    const timestamp = firstTimestamp + index * 86_400_000;
    const puzzleDate = new Date(timestamp).toISOString().slice(0, 10);
    return {
      id: `lexi-daily-${puzzleDate}`,
      puzzleDate,
      answer,
      status: index === 0 ? "published" : "scheduled",
      publishedAt: index === 0 ? Math.floor(timestamp / 1_000) : null,
      createdAt: generatedAt,
      updatedAt: generatedAt,
    };
  });
  if (new Set(rows.map(({ puzzleDate }) => puzzleDate)).size !== 90) {
    throw new Error("Production puzzle dates must be unique");
  }
  for (let index = 1; index < rows.length; index += 1) {
    if (Date.parse(`${rows[index].puzzleDate}T00:00:00.000Z`) -
      Date.parse(`${rows[index - 1].puzzleDate}T00:00:00.000Z`) !== 86_400_000) {
      throw new Error("Production puzzle dates must be consecutive UTC days");
    }
  }
  const scheduleSha256 = sha256(`${JSON.stringify(rows.map(({ puzzleDate, answer }) =>
    [puzzleDate, answer]))}\n`);
  return {
    rows,
    summary: {
      count: rows.length,
      firstDate: rows[0].puzzleDate,
      lastDate: rows.at(-1).puzzleDate,
      inputSha256,
      scheduleSha256,
      esdbRelease: report.source.release,
      esdbCommit: report.source.commit,
    },
  };
}

function sqlString(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

export function buildAtomicSeedSql(schedule) {
  const values = schedule.rows.map((row) => `(${[
    row.id, row.puzzleDate, row.answer, row.status,
    `ESDB:${schedule.summary.esdbCommit};schedule:${schedule.summary.scheduleSha256}`,
    "lexi-production-schedule-v1", row.publishedAt, row.createdAt, row.updatedAt,
  ].map((value) => value === null ? "NULL" :
    typeof value === "number" ? value : sqlString(value)).join(",")})`).join(",\n");
  return `PRAGMA foreign_keys=ON;
CREATE TEMP TABLE lexi_proposed_schedule (
  id TEXT PRIMARY KEY, puzzle_date TEXT NOT NULL UNIQUE, answer TEXT NOT NULL,
  status TEXT NOT NULL, source_reference TEXT NOT NULL, validation_version TEXT NOT NULL,
  published_at INTEGER, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
);
INSERT INTO lexi_proposed_schedule VALUES
${values};
CREATE TEMP TABLE lexi_seed_guard (ok INTEGER NOT NULL CHECK (ok = 1));
INSERT INTO lexi_seed_guard
SELECT 0 WHERE EXISTS (
  SELECT 1 FROM lexi_puzzles existing
  JOIN lexi_proposed_schedule proposed ON proposed.puzzle_date = existing.puzzle_date
  WHERE existing.answer != proposed.answer
);
INSERT INTO lexi_seed_guard
SELECT 0 WHERE EXISTS (
  SELECT 1 FROM lexi_puzzles existing
  JOIN lexi_proposed_schedule proposed ON proposed.answer = existing.answer
  WHERE existing.puzzle_date != proposed.puzzle_date
);
INSERT INTO lexi_puzzles (
  id,puzzle_date,answer,status,source_reference,validation_version,
  published_at,created_at,updated_at
)
SELECT id,puzzle_date,answer,status,source_reference,validation_version,
  published_at,created_at,updated_at
FROM lexi_proposed_schedule proposed
WHERE NOT EXISTS (
  SELECT 1 FROM lexi_puzzles existing WHERE existing.puzzle_date = proposed.puzzle_date
);
INSERT INTO lexi_seed_guard
SELECT 0 WHERE (
  SELECT COUNT(*) FROM lexi_puzzles existing
  JOIN lexi_proposed_schedule proposed
    ON proposed.puzzle_date = existing.puzzle_date AND proposed.answer = existing.answer
) != 90;
DROP TABLE lexi_seed_guard;
DROP TABLE lexi_proposed_schedule;
`;
}

export function applySeedLocally(db, schedule) {
  db.exec("BEGIN IMMEDIATE");
  try {
    db.exec(buildAtomicSeedSql(schedule));
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}
