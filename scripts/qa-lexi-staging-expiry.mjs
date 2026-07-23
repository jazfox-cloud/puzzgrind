import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const BASE_URL = "https://puzzgrind-staging.jazfoxbrook.workers.dev";
const STAGING_NAME = "puzzgrind-staging-db";
const STAGING_ID = "d3f0b3d8-81a8-40de-96f4-7ed248e0fb93";
const values = new Map();
const args = process.argv.slice(2).filter((value) => value !== "--");
for (let index = 0; index < args.length; index += 2) values.set(args[index], args[index + 1]);
if (values.get("--env") !== "staging" || values.get("--database-id") !== STAGING_ID ||
  values.get("--confirm") !== STAGING_NAME) throw new Error("Explicit Staging env, database ID, and name confirmation are required");

const config = JSON.parse(readFileSync(new URL("../wrangler.jsonc", import.meta.url), "utf8"));
const stagingDb = config.env?.staging?.d1_databases?.find(({ binding }) => binding === "DB");
const productionDb = config.env?.production?.d1_databases?.find(({ binding }) => binding === "DB");
if (config.env?.staging?.name !== "puzzgrind-staging" || stagingDb?.database_id !== STAGING_ID ||
  productionDb?.database_id === STAGING_ID) throw new Error("Staging isolation guard failed");

const json = async (response) => ({ response, body: await response.json().catch(() => ({})) });
const today = await json(await fetch(`${BASE_URL}/api/lexi/today`, { signal: AbortSignal.timeout(30_000) }));
if (today.response.status !== 200 || !String(today.body.puzzleId).startsWith("lexi-staging-qa-")) {
  throw new Error("Current puzzle is not a protected Staging QA puzzle");
}
const started = await json(await fetch(`${BASE_URL}/api/lexi/session/start`, {
  method: "POST", headers: { "content-type": "application/json" },
  body: JSON.stringify({ anonymousId: crypto.randomUUID() }), signal: AbortSignal.timeout(30_000),
}));
if (![200, 201].includes(started.response.status) || typeof started.body.token !== "string") {
  throw new Error("Could not start protected expiry QA session");
}

const wrangler = "./node_modules/.bin/wrangler";
const execute = (sql) => execFileSync(wrangler, ["d1", "execute", STAGING_NAME, "--remote", "--env", "staging", "--command", sql, "--json"], { stdio: "pipe" });
const safeId = String(today.body.puzzleId).replaceAll("'", "''");
const safeDate = String(today.body.puzzleDate).replaceAll("'", "''");
let result;
try {
  execute(`UPDATE lexi_puzzles SET puzzle_date='2000-01-01' WHERE id='${safeId}' AND source_reference='STAGING_QA_ONLY';`);
  result = await json(await fetch(`${BASE_URL}/api/lexi/guess`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ token: started.body.token, guess: "cigar", revision: 0 }),
    signal: AbortSignal.timeout(30_000),
  }));
} finally {
  execute(`UPDATE lexi_puzzles SET puzzle_date='${safeDate}' WHERE id='${safeId}' AND source_reference='STAGING_QA_ONLY';`);
}
if (result.response.status !== 409 || result.body.error !== "session_expired") {
  throw new Error(`UTC expiry boundary failed (HTTP ${result.response.status}, error ${result.body.error ?? "none"})`);
}
const restored = await json(await fetch(`${BASE_URL}/api/lexi/today`, { signal: AbortSignal.timeout(30_000) }));
if (restored.response.status !== 200 || restored.body.puzzleDate !== today.body.puzzleDate) {
  throw new Error("QA puzzle date was not restored");
}
console.log(JSON.stringify({ utcExpiry: "passed", status: result.response.status, error: result.body.error, puzzleRestored: true }, null, 2));
