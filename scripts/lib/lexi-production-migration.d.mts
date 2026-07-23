import type { DatabaseSync } from "node:sqlite";

export const LEXI_MIGRATION_NAME: string;
export const LEXI_MIGRATION_SHA256: string;
export const LEXI_TABLES: string[];
export const LEXI_INDEXES: string[];
export const LEXI_TRIGGERS: string[];
export function migrationSha256(sql: string): string;
export function assertMigrationHash(sql: string): void;
export function expectedLexiObjectNames(): { table: string[]; index: string[]; trigger: string[] };
export function inspectLocalLexiSchema(db: DatabaseSync): { table: string[]; index: string[]; trigger: string[] };
export function assertExpectedLexiSchema(actual: { table: string[]; index: string[]; trigger: string[] }): void;
export function applyMigrationLocally(db: DatabaseSync, sql: string,
  options?: { failAfterSchema?: boolean }): { applied: boolean };
export function buildRemoteMigrationImport(sql: string): string;
