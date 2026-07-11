import type {
  D1AllResult,
  D1DatabaseLike,
  D1PreparedStatementLike,
  D1RunResult,
  D1Value,
} from "@/lib/db/d1";

type QueuedResult =
  | { kind: "all"; value: D1AllResult<unknown> }
  | { kind: "error"; value: Error }
  | { kind: "first"; value: unknown | null }
  | { kind: "run"; value: D1RunResult };

export type CapturedStatement = {
  bindings: D1Value[];
  query: string;
};

class FakePreparedStatement implements D1PreparedStatementLike {
  constructor(
    private readonly capture: CapturedStatement,
    private readonly result: QueuedResult,
  ) {}

  bind(...values: D1Value[]): D1PreparedStatementLike {
    this.capture.bindings = values;
    return this;
  }

  async first<Row>(): Promise<Row | null> {
    if (this.result.kind === "error") {
      throw this.result.value;
    }
    if (this.result.kind !== "first") {
      throw new Error(`Expected a first result, received ${this.result.kind}.`);
    }
    return this.result.value as Row | null;
  }

  async all<Row>(): Promise<D1AllResult<Row>> {
    if (this.result.kind === "error") {
      throw this.result.value;
    }
    if (this.result.kind !== "all") {
      throw new Error(`Expected an all result, received ${this.result.kind}.`);
    }
    return this.result.value as D1AllResult<Row>;
  }

  async run(): Promise<D1RunResult> {
    if (this.result.kind === "error") {
      throw this.result.value;
    }
    if (this.result.kind !== "run") {
      throw new Error(`Expected a run result, received ${this.result.kind}.`);
    }
    return this.result.value;
  }
}

export class FakeD1Database implements D1DatabaseLike {
  readonly statements: CapturedStatement[] = [];
  private readonly results: QueuedResult[] = [];

  queueFirst(value: unknown | null): void {
    this.results.push({ kind: "first", value });
  }

  queueAll(value: unknown[]): void {
    this.results.push({ kind: "all", value: { results: value, success: true } });
  }

  queueRun(): void {
    this.results.push({ kind: "run", value: { meta: { changes: 1 }, success: true } });
  }

  queueError(value: Error): void {
    this.results.push({ kind: "error", value });
  }

  prepare(query: string): D1PreparedStatementLike {
    const result = this.results.shift();
    if (!result) {
      throw new Error("No fake D1 result was queued.");
    }

    const capture = { bindings: [], query } satisfies CapturedStatement;
    this.statements.push(capture);
    return new FakePreparedStatement(capture, result);
  }
}
