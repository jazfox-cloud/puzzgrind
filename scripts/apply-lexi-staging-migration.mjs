import { execFileSync } from "node:child_process";
import { readFileSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const STAGING_NAME = "puzzgrind-staging-db";
const STAGING_ID = "d3f0b3d8-81a8-40de-96f4-7ed248e0fb93";
const MIGRATION_NAME = "0003_lexi_daily.sql";

function fail(message) {
  throw new Error(`Staging migration guard failed: ${message}`);
}

const values = new Map();
const args = process.argv.slice(2).filter((value) => value !== "--");
for (let index = 0; index < args.length; index += 2) {
  values.set(args[index], args[index + 1]);
}
if (values.get("--env") !== "staging") fail("--env staging is required");
if (values.get("--database-id") !== STAGING_ID) fail("the exact Staging database ID is required");
if (values.get("--confirm") !== STAGING_NAME) fail(`--confirm ${STAGING_NAME} is required`);

const config = JSON.parse(readFileSync(new URL("../wrangler.jsonc", import.meta.url), "utf8"));
const staging = config.env?.staging;
const production = config.env?.production;
const stagingDatabase = staging?.d1_databases?.find(({ binding }) => binding === "DB");
const productionDatabase = production?.d1_databases?.find(({ binding }) => binding === "DB");
if (staging?.name !== "puzzgrind-staging" || staging?.vars?.APP_ENV !== "staging") {
  fail("env.staging does not identify the isolated Staging Worker");
}
if (stagingDatabase?.database_name !== STAGING_NAME || stagingDatabase?.database_id !== STAGING_ID) {
  fail("wrangler.jsonc Staging D1 name/ID does not match the approved target");
}
if (!productionDatabase?.database_id || productionDatabase.database_id === STAGING_ID) {
  fail("Staging and Production D1 IDs are not demonstrably isolated");
}

const wrangler = "./node_modules/.bin/wrangler";
const baseArgs = ["d1", "execute", STAGING_NAME, "--remote", "--env", "staging"];
const query = (sql) => JSON.parse(execFileSync(wrangler, [...baseArgs, "--command", sql, "--json"], { encoding: "utf8" }));
const ledgerBefore = query("SELECT name FROM d1_migrations ORDER BY id;")[0]?.results?.map(({ name }) => name) ?? [];
if (!ledgerBefore.includes("0001_sudoku_core.sql") || !ledgerBefore.includes("0002_daily_leaderboard.sql")) {
  fail("0001 and 0002 must already be recorded before applying 0003");
}
if (ledgerBefore.includes(MIGRATION_NAME)) {
  console.log(`${MIGRATION_NAME} is already recorded on the isolated Staging D1; no work required.`);
  process.exit(0);
}

const migrationPath = new URL(`../migrations/${MIGRATION_NAME}`, import.meta.url);
const tempFile = resolve(process.cwd(), `${MIGRATION_NAME}.staging.local`);
const migration = readFileSync(migrationPath, "utf8");
const sql = `${migration}\nINSERT INTO d1_migrations (name) VALUES ('${MIGRATION_NAME}');\n`;

console.log(`Target: ${STAGING_NAME} (${STAGING_ID}); environment: staging; migration: ${MIGRATION_NAME}`);
try {
  writeFileSync(tempFile, sql, { mode: 0o600 });
  execFileSync(wrangler, [...baseArgs.slice(0, 3), "--remote", "--env", "staging", "--file", tempFile], {
    stdio: "inherit",
  });
} finally {
  rmSync(tempFile, { force: true });
}

const ledgerAfter = query(`SELECT name FROM d1_migrations WHERE name = '${MIGRATION_NAME}';`)[0]?.results ?? [];
if (ledgerAfter.length !== 1) fail(`${MIGRATION_NAME} was not recorded exactly once`);
console.log(`Applied and recorded ${MIGRATION_NAME} on the isolated Staging D1.`);
