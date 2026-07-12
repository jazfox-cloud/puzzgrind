export type D1Value = ArrayBuffer | boolean | null | number | string;

export type D1RunMeta = {
  changes?: number;
  last_row_id?: number;
};

export type D1RunResult = {
  meta: D1RunMeta;
  success: boolean;
};

export type D1AllResult<Row> = {
  results: Row[];
  success: boolean;
};

export interface D1PreparedStatementLike {
  all<Row>(): Promise<D1AllResult<Row>>;
  bind(...values: D1Value[]): D1PreparedStatementLike;
  first<Row>(): Promise<Row | null>;
  run(): Promise<D1RunResult>;
}

export interface D1DatabaseLike {
  batch(statements: D1PreparedStatementLike[]): Promise<D1RunResult[]>;
  prepare(query: string): D1PreparedStatementLike;
}
