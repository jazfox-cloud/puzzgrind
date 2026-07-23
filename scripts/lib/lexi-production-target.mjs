import { readFileSync } from "node:fs";

export const PRODUCTION_ACCOUNT_ID = "7a04450464f7860772c01d269c4bf8af";
export const PRODUCTION_DATABASE_NAME = "puzzgrind-db";
export const PRODUCTION_DATABASE_ID = "d3e6e288-046a-4552-b6d2-39f014276af7";

export function parseProductionArguments(argv) {
  const args = argv.filter((value) => value !== "--");
  const values = new Map();
  const flags = new Set();
  for (let index = 0; index < args.length; index += 1) {
    const value = args[index];
    if (!value.startsWith("--")) throw new Error(`Unexpected positional argument: ${value}`);
    if (["--execute", "--confirm-production"].includes(value)) {
      flags.add(value);
      continue;
    }
    const next = args[index + 1];
    if (!next || next.startsWith("--")) throw new Error(`${value} requires a value`);
    values.set(value, next);
    index += 1;
  }
  return { flags, values };
}

export function assertProductionTarget({ flags, values }, { requireExecution = false } = {}) {
  if (values.get("--env") !== "production") throw new Error("--env production is required");
  if (values.get("--account-id") !== PRODUCTION_ACCOUNT_ID) throw new Error("the exact Production account ID is required");
  if (values.get("--database-name") !== PRODUCTION_DATABASE_NAME) throw new Error("the exact Production D1 name is required");
  if (values.get("--database-id") !== PRODUCTION_DATABASE_ID) throw new Error("the exact Production D1 ID is required");
  if (requireExecution && !flags.has("--execute")) throw new Error("--execute is required for a remote write");
  if (requireExecution && !flags.has("--confirm-production")) {
    throw new Error("--confirm-production is required for a remote write");
  }
  if (flags.has("--execute") && !flags.has("--confirm-production")) {
    throw new Error("--execute cannot be used without --confirm-production");
  }

  const config = JSON.parse(readFileSync(new URL("../../wrangler.jsonc", import.meta.url), "utf8"));
  const production = config.env?.production;
  const database = production?.d1_databases?.find(({ binding }) => binding === "DB");
  if (production?.name !== "puzzgrind" || production?.vars?.APP_ENV !== "production") {
    throw new Error("env.production does not identify the Production Worker");
  }
  if (database?.database_name !== PRODUCTION_DATABASE_NAME || database?.database_id !== PRODUCTION_DATABASE_ID) {
    throw new Error("wrangler.jsonc Production D1 name/ID does not match the guarded target");
  }
  for (const environment of ["staging"]) {
    const other = config.env?.[environment]?.d1_databases?.find(({ binding }) => binding === "DB");
    if (other?.database_id === PRODUCTION_DATABASE_ID) {
      throw new Error(`Production D1 is shared with ${environment}`);
    }
  }
  const root = config.d1_databases?.find(({ binding }) => binding === "DB");
  if (root?.database_id === PRODUCTION_DATABASE_ID) {
    throw new Error("Production D1 must not be the preview/default D1 target");
  }
  return { accountId: PRODUCTION_ACCOUNT_ID, databaseId: PRODUCTION_DATABASE_ID,
    databaseName: PRODUCTION_DATABASE_NAME };
}

export function productionTargetSummary() {
  return {
    accountId: PRODUCTION_ACCOUNT_ID,
    databaseName: PRODUCTION_DATABASE_NAME,
    databaseId: PRODUCTION_DATABASE_ID,
    environment: "production",
  };
}
