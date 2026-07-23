import { createHash } from "node:crypto";
import {
  chmodSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, relative, resolve } from "node:path";

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
  const sourceReference =
    `ESDB:${schedule.summary.esdbCommit};schedule:${schedule.summary.scheduleSha256}`;
  const values = schedule.rows.map((row) => `(${[
    row.id, row.puzzleDate, row.answer, row.status,
    sourceReference,
    "lexi-production-schedule-v1", row.publishedAt, row.createdAt, row.updatedAt,
  ].map((value) => value === null ? "NULL" :
    typeof value === "number" ? value : sqlString(value)).join(",")})`).join(",\n");
  return `WITH incoming (
  id,puzzle_date,answer,status,source_reference,validation_version,
  published_at,created_at,updated_at
) AS (
  VALUES
${values}
),
conflicts AS (
  SELECT 1 AS conflict
  FROM lexi_puzzles existing
  JOIN incoming ON incoming.puzzle_date = existing.puzzle_date
  WHERE incoming.answer != existing.answer
  UNION ALL
  SELECT 1
  FROM lexi_puzzles existing
  JOIN incoming ON incoming.answer = existing.answer
  WHERE incoming.puzzle_date != existing.puzzle_date
  UNION ALL
  SELECT 1
  FROM lexi_puzzles existing
  JOIN incoming
    ON incoming.puzzle_date = existing.puzzle_date
   AND incoming.answer = existing.answer
  WHERE existing.id != incoming.id
     OR existing.status != incoming.status
     OR IFNULL(existing.source_reference, '') != incoming.source_reference
     OR existing.validation_version != incoming.validation_version
     OR existing.published_at IS NOT incoming.published_at
  UNION ALL
  SELECT 1
  FROM lexi_puzzles existing
  JOIN incoming ON incoming.id = existing.id
  WHERE incoming.puzzle_date != existing.puzzle_date
     OR incoming.answer != existing.answer
)
INSERT INTO lexi_puzzles (
  id,puzzle_date,answer,status,source_reference,validation_version,
  published_at,created_at,updated_at
)
SELECT id,puzzle_date,answer,status,source_reference,validation_version,
  published_at,created_at,updated_at
FROM incoming
WHERE NOT EXISTS (SELECT 1 FROM conflicts)
  AND NOT EXISTS (
    SELECT 1
    FROM lexi_puzzles existing
    WHERE existing.puzzle_date = incoming.puzzle_date
      AND existing.answer = incoming.answer
  );
`;
}

export function withAtomicSeedSqlFile(schedule, file, callback) {
  mkdirSync(dirname(file), { recursive: true, mode: 0o700 });
  try {
    writeFileSync(file, buildAtomicSeedSql(schedule), { mode: 0o600 });
    chmodSync(file, 0o600);
    if ((statSync(file).mode & 0o777) !== 0o600) {
      throw new Error("Private seed SQL must use mode 0600");
    }
    return callback(file);
  } finally {
    rmSync(file, { force: true });
  }
}

export function applySeedLocally(db, schedule) {
  db.exec("BEGIN IMMEDIATE");
  try {
    db.exec(buildAtomicSeedSql(schedule));
    const sourceReference =
      `ESDB:${schedule.summary.esdbCommit};schedule:${schedule.summary.scheduleSha256}`;
    const verification = db.prepare(`SELECT COUNT(*) AS count,
      COUNT(DISTINCT puzzle_date) AS unique_dates,
      COUNT(DISTINCT answer) AS unique_answers,
      SUM(CASE WHEN puzzle_date=? AND status='published' AND published_at IS NOT NULL
        THEN 1 ELSE 0 END) AS published_count,
      SUM(CASE WHEN puzzle_date>? AND status='scheduled' AND published_at IS NULL
        THEN 1 ELSE 0 END) AS scheduled_count,
      SUM(CASE WHEN source_reference=? AND validation_version='lexi-production-schedule-v1'
        THEN 1 ELSE 0 END) AS source_count
      FROM lexi_puzzles
      WHERE puzzle_date BETWEEN ? AND ?`).get(
      schedule.summary.firstDate,
      schedule.summary.firstDate,
      sourceReference,
      schedule.summary.firstDate,
      schedule.summary.lastDate,
    );
    if (verification.count !== 90 || verification.unique_dates !== 90 ||
      verification.unique_answers !== 90 || verification.published_count !== 1 ||
      verification.scheduled_count !== 89 || verification.source_count !== 90) {
      throw new Error("Local answer-free post-seed verification failed");
    }
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}
