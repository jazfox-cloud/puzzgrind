import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const STAGING_NAME = "puzzgrind-staging-db";
const STAGING_ID = "d3f0b3d8-81a8-40de-96f4-7ed248e0fb93";
const values = new Map();
const args = process.argv.slice(2).filter((value) => value !== "--");
for (let index = 0; index < args.length; index += 2) values.set(args[index], args[index + 1]);
if (values.get("--remote") !== "true" || values.get("--env") !== "staging" ||
  values.get("--database-id") !== STAGING_ID || values.get("--confirm") !== STAGING_NAME ||
  values.get("--acknowledge") !== "SUDOKU_STAGING_QA_ONLY") {
  throw new Error("Explicit remote Staging target and SUDOKU_STAGING_QA_ONLY acknowledgement are required");
}
const config = JSON.parse(readFileSync(new URL("../wrangler.jsonc", import.meta.url), "utf8"));
const stagingDb = config.env?.staging?.d1_databases?.find(({ binding }) => binding === "DB");
const productionDb = config.env?.production?.d1_databases?.find(({ binding }) => binding === "DB");
if (config.env?.staging?.name !== "puzzgrind-staging" || stagingDb?.database_id !== STAGING_ID ||
  productionDb?.database_id === STAGING_ID) throw new Error("Staging isolation guard failed");

const date = new Date().toISOString().slice(0, 10);
const now = Math.floor(Date.now() / 1_000);
const wrangler = "./node_modules/.bin/wrangler";
const base = ["d1", "execute", STAGING_NAME, "--remote", "--env", "staging"];
const query = (sql) => JSON.parse(execFileSync(wrangler, [...base, "--command", sql, "--json"], { encoding: "utf8" }));
const current = query(`SELECT id,source_reference FROM sudoku_puzzles WHERE puzzle_date='${date}' AND difficulty='medium';`)[0]?.results ?? [];
if (current.some(({ source_reference: source }) => source !== "STAGING_QA_COPY")) {
  throw new Error("A non-QA Sudoku puzzle already occupies the current UTC date");
}
if (current.length === 0) {
  query(`INSERT INTO sudoku_puzzles (
    id,puzzle_date,difficulty,givens,solution,technique_profile_json,source_type,source_reference,
    validation_version,status,published_at,created_at,updated_at
  ) SELECT 'sudoku-staging-qa-current','${date}',difficulty,givens,solution,technique_profile_json,
    'staging_qa','STAGING_QA_COPY','staging-qa-v1','published',${now},${now},${now}
    FROM sudoku_puzzles WHERE status='published' ORDER BY puzzle_date DESC LIMIT 1;`);
}
const verified = query(`SELECT puzzle_date,difficulty,status,source_reference FROM sudoku_puzzles WHERE id='sudoku-staging-qa-current';`)[0]?.results ?? [];
if (verified.length !== 1 || verified[0].puzzle_date !== date || verified[0].source_reference !== "STAGING_QA_COPY") {
  throw new Error("Current-day Staging Sudoku QA copy was not verified");
}
console.log(JSON.stringify({ target: STAGING_NAME, databaseId: STAGING_ID, qaPuzzle: verified[0] }, null, 2));
