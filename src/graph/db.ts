// A small wrapper around Relate's RelateDb so the rest of the app gets plain
// rows back and real errors (Relate returns errors inside the result instead
// of throwing). Works with the WASM build in the browser and in Node tests.
import { seedStatements } from "./seed.ts";

/** The two methods we use from @relate/relate-wasm's RelateDb. */
export type RelateLike = {
  execute(query: string, paramsJson?: string | null): string;
  executeScript(script: string, paramsJson?: string | null): string[];
};

export type Row = Record<string, unknown>;

export class GraphError extends Error {
  readonly query: string;
  readonly detail: unknown;
  constructor(message: string, query: string, detail: unknown) {
    super(message);
    this.query = query;
    this.detail = detail;
    this.name = "GraphError";
  }
}

export class Graph {
  readonly relate: RelateLike;
  constructor(relate: RelateLike) {
    this.relate = relate;
  }

  run<T extends Row = Row>(query: string, params: Row = {}): T[] {
    const envelope = JSON.parse(this.relate.execute(query, JSON.stringify(params)));
    if (envelope.error) {
      const e = envelope.error;
      const msg = typeof e === "string" ? e : (e.message ?? JSON.stringify(e));
      throw new GraphError(`Relate query failed: ${msg}`, query, e);
    }
    return envelope.rows as T[];
  }

  /** Runs a multi-statement Cypher script (used for importing a plan file). */
  runScript(script: string): void {
    for (const text of this.relate.executeScript(script, null)) {
      const envelope = JSON.parse(text);
      if (envelope.error) throw new GraphError("Relate script failed", script, envelope.error);
    }
  }

  /** Empties the database and loads the official step graph from /data. */
  loadSeed(): void {
    this.run("MATCH (n) DETACH DELETE n");
    for (const s of seedStatements()) this.run(s.query, s.params);
  }
}
