export const PRODUCTION_ACCOUNT_ID: string;
export const PRODUCTION_DATABASE_NAME: string;
export const PRODUCTION_DATABASE_ID: string;
export type ParsedProductionArguments = { flags: Set<string>; values: Map<string, string> };
export function parseProductionArguments(argv: string[]): ParsedProductionArguments;
export function assertProductionTarget(parsed: ParsedProductionArguments,
  options?: { requireExecution?: boolean }): {
    accountId: string;
    databaseId: string;
    databaseName: string;
  };
export function productionTargetSummary(): {
  accountId: string;
  databaseName: string;
  databaseId: string;
  environment: string;
};
