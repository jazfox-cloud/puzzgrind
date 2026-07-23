import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  buildAtomicSeedSql,
  readPrivateProductionInput,
  validateAndBuildSchedule,
} from "./lib/lexi-production-schedule.mjs";
import {
  assertProductionTarget,
  parseProductionArguments,
  productionTargetSummary,
} from "./lib/lexi-production-target.mjs";

function fail(message) {
  throw new Error(`Production Lexi seed guard failed: ${message}`);
}

const parsed = parseProductionArguments(process.argv.slice(2));
assertProductionTarget(parsed);
const inputPath = parsed.values.get("--input");
const auditPath = parsed.values.get("--audit");
if (!inputPath) fail("--input is required");
if (!auditPath) fail("--audit is required");
const { input } = readPrivateProductionInput(inputPath);
const audit = JSON.parse(readFileSync(resolve(process.cwd(), auditPath), "utf8"));
const schedule = validateAndBuildSchedule(input, audit);
const target = productionTargetSummary();
const dryRun = !parsed.flags.has("--execute");

console.log(JSON.stringify({ mode: dryRun ? "dry-run" : "execute", target,
  schedule: schedule.summary }, null, 2));
if (dryRun) process.exit(0);

assertProductionTarget(parsed, { requireExecution: true });
const today = new Date().toISOString().slice(0, 10);
if (schedule.summary.firstDate !== today) {
  fail("a Production write requires the explicit release date to equal the current UTC date");
}

const wrangler = "./node_modules/.bin/wrangler";
const baseArgs = ["d1", "execute", target.databaseName, "--remote", "--env", "production",
  "--experimental-auto-create", "false"];
const list = JSON.parse(execFileSync(wrangler, ["d1", "list", "--json"], { encoding: "utf8" }));
const exactDatabase = list.filter(({ name, uuid }) =>
  name === target.databaseName && uuid === target.databaseId);
if (exactDatabase.length !== 1) fail("authenticated Cloudflare D1 list does not contain the exact guarded target");

const query = (sql) => JSON.parse(execFileSync(
  wrangler, [...baseArgs, "--command", sql, "--json"], { encoding: "utf8" }));
const readiness = query(`SELECT
  (SELECT COUNT(*) FROM d1_migrations WHERE name='0003_lexi_daily.sql') AS migration_count,
  (SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='lexi_puzzles') AS table_count;`)[0]?.results?.[0];
if (readiness?.migration_count !== 1 || readiness?.table_count !== 1) {
  fail("0003 ledger and lexi_puzzles must exist before Production seed");
}

const privateRoot = resolve(process.cwd(), ".private/lexi-production");
mkdirSync(privateRoot, { recursive: true, mode: 0o700 });
const tempFile = resolve(privateRoot, `lexi-${schedule.summary.scheduleSha256}.production-seed.sql.local`);
try {
  writeFileSync(tempFile, buildAtomicSeedSql(schedule), { mode: 0o600 });
  execFileSync(wrangler, [...baseArgs, "--file", tempFile, "--yes"], { stdio: "inherit" });
} finally {
  rmSync(tempFile, { force: true });
}

const escapedFirstDate = schedule.summary.firstDate.replaceAll("'", "''");
const escapedLastDate = schedule.summary.lastDate.replaceAll("'", "''");
const escapedSource = `ESDB:${schedule.summary.esdbCommit};schedule:${schedule.summary.scheduleSha256}`
  .replaceAll("'", "''");
const verification = query(`SELECT COUNT(*) AS count, MIN(puzzle_date) AS first_date,
  MAX(puzzle_date) AS last_date,
  COUNT(DISTINCT puzzle_date) AS unique_dates,
  COUNT(DISTINCT answer) AS unique_answers,
  SUM(CASE WHEN puzzle_date='${escapedFirstDate}' AND status='published'
    AND published_at IS NOT NULL THEN 1 ELSE 0 END) AS published_count,
  SUM(CASE WHEN puzzle_date>'${escapedFirstDate}' AND status='scheduled'
    AND published_at IS NULL THEN 1 ELSE 0 END) AS scheduled_count,
  SUM(CASE WHEN source_reference='${escapedSource}'
    AND validation_version='lexi-production-schedule-v1' THEN 1 ELSE 0 END) AS source_count
  FROM lexi_puzzles
  WHERE puzzle_date BETWEEN '${escapedFirstDate}' AND '${escapedLastDate}';`)[0]?.results?.[0];
if (verification?.count !== 90 || verification.first_date !== schedule.summary.firstDate ||
  verification.last_date !== schedule.summary.lastDate || verification.unique_dates !== 90 ||
  verification.unique_answers !== 90 || verification.published_count !== 1 ||
  verification.scheduled_count !== 89 || verification.source_count !== 90) {
  fail("answer-free post-seed verification did not match the approved schedule summary");
}
console.log(JSON.stringify({ insertedOrAlreadyPresent: verification.count,
  firstDate: verification.first_date, lastDate: verification.last_date,
  published: verification.published_count, scheduled: verification.scheduled_count,
  scheduleSha256: schedule.summary.scheduleSha256 }, null, 2));
