import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  buildAtomicSeedSql,
  sha256,
  withAtomicSeedSqlFile,
} from "./lib/lexi-production-schedule.mjs";

const ACCOUNT_ID = "7a04450464f7860772c01d269c4bf8af";
const STAGING_NAME = "puzzgrind-staging-db";
const STAGING_ID = "d3f0b3d8-81a8-40de-96f4-7ed248e0fb93";
const MARKER = "STAGING_SEED_COMPAT_QA";
const ID_PREFIX = "lexi-staging-seed-compat-";
const FIRST_DATE = "2099-01-01";
const GENERATED_AT = 4_070_908_800;
const wrangler = "./node_modules/.bin/wrangler";
const baseArgs = [
  "d1", "execute", STAGING_NAME, "--remote", "--env", "staging",
  "--experimental-auto-create", "false",
];
const results = [];

function fail(message) {
  throw new Error(`Staging Lexi seed compatibility guard failed: ${message}`);
}

const args = process.argv.slice(2).filter((value) => value !== "--");
const values = new Map();
for (let index = 0; index < args.length; index += 2) values.set(args[index], args[index + 1]);
if (values.get("--env") !== "staging") fail("--env staging is required");
if (values.get("--account-id") !== ACCOUNT_ID) fail("the exact Cloudflare account ID is required");
if (values.get("--database-name") !== STAGING_NAME) fail("the exact Staging D1 name is required");
if (values.get("--database-id") !== STAGING_ID) fail("the exact Staging D1 ID is required");
if (values.get("--confirm") !== "LEXI_SEED_COMPAT_QA") {
  fail("--confirm LEXI_SEED_COMPAT_QA is required");
}

const config = JSON.parse(readFileSync(resolve("wrangler.jsonc"), "utf8"));
const stagingDatabase = config.env?.staging?.d1_databases?.find(({ binding }) => binding === "DB");
const productionDatabase = config.env?.production?.d1_databases?.find(({ binding }) => binding === "DB");
if (config.env?.staging?.name !== "puzzgrind-staging" ||
  stagingDatabase?.database_name !== STAGING_NAME || stagingDatabase.database_id !== STAGING_ID) {
  fail("wrangler.jsonc does not identify the approved isolated Staging target");
}
if (!productionDatabase?.database_id || productionDatabase.database_id === STAGING_ID) {
  fail("Staging and Production D1 are not isolated");
}
const listed = JSON.parse(execFileSync(wrangler, ["d1", "list", "--json"], { encoding: "utf8" }));
if (listed.filter(({ name, uuid }) => name === STAGING_NAME && uuid === STAGING_ID).length !== 1) {
  fail("authenticated D1 inventory does not contain the exact Staging target");
}

function query(sql) {
  const output = execFileSync(wrangler, [...baseArgs, "--command", sql, "--json"], {
    encoding: "utf8",
  });
  const parsed = JSON.parse(output);
  if (!parsed[0]?.success) fail("a Staging verification query failed");
  return parsed[0].results ?? [];
}

function day(offset) {
  return new Date(Date.parse(`${FIRST_DATE}T00:00:00.000Z`) + offset * 86_400_000)
    .toISOString().slice(0, 10);
}

function qaAnswer(index) {
  let value = index;
  let suffix = "";
  for (let position = 0; position < 4; position += 1) {
    suffix = String.fromCharCode(97 + (value % 26)) + suffix;
    value = Math.floor(value / 26);
  }
  return `q${suffix}`;
}

const rows = Array.from({ length: 90 }, (_, index) => ({
  id: `${ID_PREFIX}${day(index)}`,
  puzzleDate: day(index),
  answer: qaAnswer(index),
  status: index === 0 ? "published" : "scheduled",
  publishedAt: index === 0 ? Math.floor(Date.parse(`${FIRST_DATE}T00:00:00.000Z`) / 1_000) : null,
  createdAt: GENERATED_AT,
  updatedAt: GENERATED_AT,
}));
const scheduleSha256 = sha256(`${JSON.stringify(rows.map(({ puzzleDate, answer }) =>
  [puzzleDate, answer]))}\n`);
const schedule = {
  rows,
  summary: {
    count: 90,
    firstDate: FIRST_DATE,
    lastDate: day(89),
    inputSha256: sha256("STAGING_SEED_COMPAT_QA"),
    scheduleSha256,
    esdbRelease: "STAGING_QA_ONLY",
    esdbCommit: MARKER,
  },
};
const sourceReference = `ESDB:${MARKER};schedule:${scheduleSha256}`;
const tempFile = resolve(
  ".private/lexi-staging",
  `lexi-${scheduleSha256}.seed-compat.sql.local`,
);

function snapshot() {
  return {
    ledger: query("SELECT name FROM d1_migrations ORDER BY id;"),
    objects: query(`SELECT type,name FROM sqlite_master
      WHERE name LIKE 'lexi_%' OR name LIKE 'idx_lexi_%'
      ORDER BY type,name;`),
    counts: query(`SELECT
      (SELECT COUNT(*) FROM sudoku_puzzles) AS sudoku_puzzles,
      (SELECT COUNT(*) FROM sudoku_sessions) AS sudoku_sessions,
      (SELECT COUNT(*) FROM sudoku_puzzle_stats) AS sudoku_stats,
      (SELECT COUNT(*) FROM sudoku_hint_events) AS sudoku_hints,
      (SELECT COUNT(*) FROM sudoku_daily_leaderboard) AS sudoku_leaderboard,
      (SELECT COUNT(*) FROM sudoku_leaderboard_rejections) AS sudoku_rejections,
      (SELECT COUNT(*) FROM lexi_puzzles) AS lexi_puzzles,
      (SELECT COUNT(*) FROM lexi_sessions) AS lexi_sessions,
      (SELECT COUNT(*) FROM lexi_puzzle_stats) AS lexi_stats,
      (SELECT COUNT(*) FROM lexi_hint_events) AS lexi_hints,
      (SELECT COUNT(*) FROM lexi_daily_leaderboard) AS lexi_leaderboard,
      (SELECT COUNT(*) FROM pragma_foreign_key_check) AS foreign_key_violations;`)[0],
  };
}

function executeSchedule(candidate, { expectFailure = false } = {}) {
  let failed = false;
  try {
    withAtomicSeedSqlFile(candidate, tempFile, (file) => {
      execFileSync(wrangler, [...baseArgs, "--file", file, "--yes"], {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
      });
    });
  } catch {
    failed = true;
  }
  if (existsSync(tempFile)) fail("temporary seed SQL was not deleted");
  if (failed !== expectFailure) {
    fail(expectFailure ? "the injected statement unexpectedly succeeded" : "the seed statement failed");
  }
}

function qaCounts() {
  return query(`SELECT COUNT(*) AS count,
    COUNT(DISTINCT puzzle_date) AS unique_dates,
    COUNT(DISTINCT answer) AS unique_answers,
    SUM(CASE WHEN status='published' AND published_at IS NOT NULL THEN 1 ELSE 0 END) AS published,
    SUM(CASE WHEN status='scheduled' AND published_at IS NULL THEN 1 ELSE 0 END) AS scheduled
    FROM lexi_puzzles WHERE id LIKE '${ID_PREFIX}%';`)[0];
}

function cleanup() {
  query(`DELETE FROM lexi_puzzles
    WHERE id LIKE '${ID_PREFIX}%' OR source_reference='${MARKER}'
      OR source_reference='${sourceReference}';`);
}

const before = snapshot();
if (before.counts.foreign_key_violations !== 0) fail("Staging has foreign-key violations before QA");
const collision = query(`SELECT COUNT(*) AS count FROM lexi_puzzles
  WHERE id LIKE '${ID_PREFIX}%'
     OR puzzle_date BETWEEN '${schedule.summary.firstDate}' AND '${schedule.summary.lastDate}'
     OR answer IN (${rows.map(({ answer }) => `'${answer}'`).join(",")});`)[0]?.count;
if (collision !== 0) fail("reserved Staging QA dates, IDs, or answers are already occupied");

try {
  executeSchedule(schedule);
  const first = qaCounts();
  results.push({ scenario: "empty-first-insert", passed:
    first.count === 90 && first.unique_dates === 90 && first.unique_answers === 90 &&
    first.published === 1 && first.scheduled === 89 });

  executeSchedule(schedule);
  results.push({ scenario: "identical-rerun-idempotent", passed: qaCounts().count === 90 });

  query(`DELETE FROM lexi_puzzles WHERE id IN (
    ${rows.slice(-13).map(({ id }) => `'${id}'`).join(",")}
  );`);
  const partialBefore = qaCounts().count;
  executeSchedule(schedule);
  results.push({ scenario: "matching-partial-supplement", passed:
    partialBefore === 77 && qaCounts().count === 90 });

  cleanup();
  const replacement = qaAnswer(200);
  query(`INSERT INTO lexi_puzzles (
    id,puzzle_date,answer,status,source_reference,validation_version,
    published_at,created_at,updated_at
  ) VALUES (
    '${ID_PREFIX}date-conflict','${FIRST_DATE}','${replacement}','published',
    '${MARKER}','staging-seed-compat-v1',${GENERATED_AT},${GENERATED_AT},${GENERATED_AT}
  );`);
  executeSchedule(schedule);
  results.push({ scenario: "same-date-different-answer-fails-closed", passed:
    qaCounts().count === 1 &&
    query(`SELECT COUNT(*) AS count FROM lexi_puzzles
      WHERE id LIKE '${ID_PREFIX}%' AND id!='${ID_PREFIX}date-conflict';`)[0]?.count === 0 });

  cleanup();
  query(`INSERT INTO lexi_puzzles (
    id,puzzle_date,answer,status,source_reference,validation_version,
    published_at,created_at,updated_at
  ) VALUES (
    '${ID_PREFIX}answer-conflict','2098-12-31','${rows[0].answer}','scheduled',
    '${MARKER}','staging-seed-compat-v1',NULL,${GENERATED_AT},${GENERATED_AT}
  );`);
  executeSchedule(schedule);
  results.push({ scenario: "same-answer-different-date-fails-closed", passed:
    qaCounts().count === 1 &&
    query(`SELECT COUNT(*) AS count FROM lexi_puzzles
      WHERE id LIKE '${ID_PREFIX}%' AND id!='${ID_PREFIX}answer-conflict';`)[0]?.count === 0 });

  cleanup();
  const invalid = {
    ...schedule,
    rows: schedule.rows.map((row, index) =>
      index === 45 ? { ...row, status: "invalid" } : row),
  };
  executeSchedule(invalid, { expectFailure: true });
  results.push({ scenario: "injected-mid-statement-failure-rolls-back", passed:
    qaCounts().count === 0 });
} finally {
  cleanup();
}

const after = snapshot();
results.push({ scenario: "staging-ledger-unchanged", passed:
  JSON.stringify(after.ledger) === JSON.stringify(before.ledger) });
results.push({ scenario: "staging-schema-unchanged", passed:
  JSON.stringify(after.objects) === JSON.stringify(before.objects) });
results.push({ scenario: "staging-data-restored", passed:
  JSON.stringify(after.counts) === JSON.stringify(before.counts) });
results.push({ scenario: "no-temp-or-helper-sql", passed:
  !/CREATE\s+TEMP|TEMP\s+TABLE|CREATE\s+TABLE/iu.test(buildAtomicSeedSql(schedule)) &&
  !existsSync(tempFile) });

const failed = results.filter(({ passed }) => !passed);
console.log(JSON.stringify({
  target: { accountId: ACCOUNT_ID, databaseName: STAGING_NAME, databaseId: STAGING_ID },
  qa: { count: 90, firstDate: schedule.summary.firstDate, lastDate: schedule.summary.lastDate },
  passed: results.length - failed.length,
  failed: failed.length,
  results,
}, null, 2));
if (failed.length > 0) process.exit(1);
