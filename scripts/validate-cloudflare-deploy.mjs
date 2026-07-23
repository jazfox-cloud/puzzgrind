import { readFileSync } from "node:fs";

const target = process.argv[2];

function fail(message) {
  console.error(`Production deploy guard failed: ${message}`);
  process.exit(1);
}

if (target !== "production") {
  fail("the target must be explicitly set to production");
}

const config = JSON.parse(readFileSync(new URL("../wrangler.jsonc", import.meta.url), "utf8"));
const production = config.env?.production;

if (!production) fail("wrangler.jsonc is missing env.production");
if (production.name !== "puzzgrind") fail("env.production must target the puzzgrind Worker");
if (production.vars?.APP_ENV !== "production") fail("env.production APP_ENV must be production");

const productionDatabase = production.d1_databases?.find(({ binding }) => binding === "DB");
if (productionDatabase?.database_name !== "puzzgrind-db") fail("env.production must bind puzzgrind-db");
if (productionDatabase?.database_id !== "d3e6e288-046a-4552-b6d2-39f014276af7") {
  fail("env.production has the wrong D1 database ID");
}

const expectedRateLimits = [
  { name: "RATE_LIMIT_START", namespace_id: "1101", simple: { limit: 12, period: 60 } },
  { name: "RATE_LIMIT_SAVE", namespace_id: "1102", simple: { limit: 60, period: 60 } },
  { name: "RATE_LIMIT_COMPLETE", namespace_id: "1103", simple: { limit: 6, period: 60 } },
  { name: "RATE_LIMIT_HINT", namespace_id: "1104", simple: { limit: 12, period: 60 } },
  { name: "RATE_LIMIT_SHARE", namespace_id: "1105", simple: { limit: 10, period: 60 } },
  { name: "RATE_LIMIT_SHARE_IMAGE", namespace_id: "1106", simple: { limit: 120, period: 60 } },
  { name: "RATE_LIMIT_LEXI_START", namespace_id: "1201", simple: { limit: 12, period: 60 } },
  { name: "RATE_LIMIT_LEXI_GUESS", namespace_id: "1202", simple: { limit: 12, period: 60 } },
  { name: "RATE_LIMIT_LEXI_HINT", namespace_id: "1203", simple: { limit: 4, period: 60 } },
  { name: "RATE_LIMIT_LEXI_READ", namespace_id: "1204", simple: { limit: 60, period: 60 } },
  { name: "RATE_LIMIT_LEXI_SUBMIT", namespace_id: "1205", simple: { limit: 6, period: 60 } },
];
if (JSON.stringify(production.ratelimits) !== JSON.stringify(expectedRateLimits)) {
  fail("env.production must use the exact approved Sudoku and Lexi rate-limit bindings");
}
const productionNamespaces = production.ratelimits?.map(({ namespace_id }) => namespace_id) ?? [];

const nonProductionNamespaces = new Set([
  ...(config.ratelimits ?? []).map(({ namespace_id }) => namespace_id),
  ...(config.env?.staging?.ratelimits ?? []).map(({ namespace_id }) => namespace_id),
]);
if (productionNamespaces.some((namespace) => nonProductionNamespaces.has(namespace))) {
  fail("Production rate-limit namespaces overlap Preview or Staging");
}

const previewDatabase = config.d1_databases?.find(({ binding }) => binding === "DB");
const stagingDatabase = config.env?.staging?.d1_databases?.find(({ binding }) => binding === "DB");
if ([previewDatabase?.database_id, stagingDatabase?.database_id].includes(productionDatabase.database_id)) {
  fail("Production D1 overlaps Preview or Staging");
}

console.log("Production deploy guard passed: puzzgrind / production / D1 production / namespaces 1101-1106,1201-1205");
