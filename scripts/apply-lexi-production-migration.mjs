import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  assertExpectedLexiSchema,
  assertMigrationHash,
  buildRemoteMigrationImport,
  expectedLexiObjectNames,
  LEXI_MIGRATION_NAME,
} from "./lib/lexi-production-migration.mjs";
import {
  assertProductionTarget,
  parseProductionArguments,
  productionTargetSummary,
} from "./lib/lexi-production-target.mjs";

function fail(message) {
  throw new Error(`Production Lexi migration guard failed: ${message}`);
}

const parsed = parseProductionArguments(process.argv.slice(2));
assertProductionTarget(parsed);
const target = productionTargetSummary();
const migrationPath = resolve(process.cwd(), "migrations", LEXI_MIGRATION_NAME);
const migrationSql = readFileSync(migrationPath, "utf8");
assertMigrationHash(migrationSql);
console.log(JSON.stringify({ mode: parsed.flags.has("--execute") ? "execute" : "dry-run",
  target, migration: LEXI_MIGRATION_NAME,
  migrationSha256: "bb8a604455e9f78fa237f8408faaafa59574e606a3b30262521cae2f855d6da8" }, null, 2));
if (!parsed.flags.has("--execute")) process.exit(0);

assertProductionTarget(parsed, { requireExecution: true });
const wrangler = "./node_modules/.bin/wrangler";
const baseArgs = ["d1", "execute", target.databaseName, "--remote", "--env", "production",
  "--experimental-auto-create", "false"];
const list = JSON.parse(execFileSync(wrangler, ["d1", "list", "--json"], { encoding: "utf8" }));
if (list.filter(({ name, uuid }) => name === target.databaseName && uuid === target.databaseId).length !== 1) {
  fail("authenticated Cloudflare D1 list does not contain the exact guarded target");
}
const query = (sql) => JSON.parse(execFileSync(
  wrangler, [...baseArgs, "--command", sql, "--json"], { encoding: "utf8" }));
const ledger = query("SELECT name FROM d1_migrations ORDER BY id;")[0]?.results?.map(({ name }) => name) ?? [];
if (!ledger.includes("0001_sudoku_core.sql") || !ledger.includes("0002_daily_leaderboard.sql")) {
  fail("0001 and 0002 must already be recorded");
}
const objectRows = query(`SELECT type,name FROM sqlite_master
  WHERE name LIKE 'lexi_%' OR name LIKE 'idx_lexi_%' ORDER BY type,name;`)[0]?.results ?? [];
if (ledger.includes(LEXI_MIGRATION_NAME)) {
  const actual = { table: [], index: [], trigger: [] };
  for (const row of objectRows) {
    if (row.type in actual && !row.name.startsWith("sqlite_autoindex_")) actual[row.type].push(row.name);
  }
  assertExpectedLexiSchema(actual);
  console.log(`${LEXI_MIGRATION_NAME} is already complete; no remote write required.`);
  process.exit(0);
}
if (objectRows.length !== 0) fail("partial Lexi schema exists without the 0003 ledger entry");

const privateRoot = resolve(process.cwd(), ".private/lexi-production");
mkdirSync(privateRoot, { recursive: true, mode: 0o700 });
const tempFile = resolve(privateRoot, `${LEXI_MIGRATION_NAME}.production-migration.sql.local`);
try {
  writeFileSync(tempFile, buildRemoteMigrationImport(migrationSql), { mode: 0o600 });
  execFileSync(wrangler, [...baseArgs, "--file", tempFile, "--yes"], { stdio: "inherit" });
} finally {
  rmSync(tempFile, { force: true });
}

const afterLedger = query(`SELECT COUNT(*) AS count FROM d1_migrations
  WHERE name='${LEXI_MIGRATION_NAME}';`)[0]?.results?.[0]?.count;
const afterRows = query(`SELECT type,name FROM sqlite_master
  WHERE name LIKE 'lexi_%' OR name LIKE 'idx_lexi_%' ORDER BY type,name;`)[0]?.results ?? [];
const after = { table: [], index: [], trigger: [] };
for (const row of afterRows) {
  if (row.type in after && !row.name.startsWith("sqlite_autoindex_")) after[row.type].push(row.name);
}
if (afterLedger !== 1) fail("0003 was not recorded exactly once");
assertExpectedLexiSchema(after);
console.log(JSON.stringify({ migration: LEXI_MIGRATION_NAME, ledgerCount: afterLedger,
  objects: expectedLexiObjectNames() }, null, 2));
