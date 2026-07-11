export type DatabaseErrorCode = "constraint" | "invalid_data" | "unavailable";

export class DatabaseError extends Error {
  readonly code: DatabaseErrorCode;
  readonly cause?: unknown;

  constructor(code: DatabaseErrorCode, message: string, cause?: unknown) {
    super(message);
    this.name = "DatabaseError";
    this.code = code;
    this.cause = cause;
  }
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function toDatabaseError(error: unknown, operation: string): DatabaseError {
  if (error instanceof DatabaseError) {
    return error;
  }

  const message = getErrorMessage(error);
  const normalized = message.toLowerCase();

  if (normalized.includes("constraint") || normalized.includes("unique")) {
    return new DatabaseError("constraint", `${operation} violated a database constraint.`, error);
  }

  return new DatabaseError("unavailable", `${operation} could not access D1.`, error);
}
