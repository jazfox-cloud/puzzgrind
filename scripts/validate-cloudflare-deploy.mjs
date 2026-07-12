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

const expectedNamespaces = ["1101", "1102", "1103", "1104", "1105", "1106"];
const productionNamespaces = production.ratelimits?.map(({ namespace_id }) => namespace_id) ?? [];
if (JSON.stringify(productionNamespaces) !== JSON.stringify(expectedNamespaces)) {
  fail("env.production must use rate-limit namespaces 1101 through 1106");
}

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

console.log("Production deploy guard passed: puzzgrind / production / D1 production / namespaces 1101-1106");
