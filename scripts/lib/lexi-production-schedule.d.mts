import type { DatabaseSync } from "node:sqlite";

export type ProductionInput = {
  schemaVersion: number;
  releaseDate: string;
  answers: string[];
};
export type ProductionAudit = {
  schemaVersion: number;
  approvedAnswerCount: number;
  approvedInputSha256: string;
  source: {
    release: string;
    commit: string;
    validGuessesSha256: string;
  };
};
export type ProductionSchedule = {
  rows: Array<{
    id: string;
    puzzleDate: string;
    answer: string;
    status: string;
    publishedAt: number | null;
    createdAt: number;
    updatedAt: number;
  }>;
  summary: {
    count: number;
    firstDate: string;
    lastDate: string;
    inputSha256: string;
    scheduleSha256: string;
    esdbRelease: string;
    esdbCommit: string;
  };
};

export function sha256(value: string): string;
export function canonicalPrivateInput(input: ProductionInput): string;
export function readPrivateProductionInput(path: string): { file: string; input: ProductionInput };
export function validateAndBuildSchedule(input: ProductionInput, audit: ProductionAudit, options?: {
  validGuesses?: Set<string>;
  wordlistReport?: {
    source: { release: string; commit: string };
    artifacts: { validGuessesSha256: string };
  };
  generatedAt?: number;
}): ProductionSchedule;
export function buildAtomicSeedSql(schedule: ProductionSchedule): string;
export function applySeedLocally(db: DatabaseSync, schedule: ProductionSchedule): void;
