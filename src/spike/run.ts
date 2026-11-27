// Runs the spike cases against any RelateDb instance (Node or browser).
import { CASES, SEED } from "./cases.ts";

type Db = {
  execute(q: string, p?: string | null): string;
  executeScript(q: string, p?: string | null): string[];
};
type Envelope = { rows: Record<string, unknown>[]; error: unknown };

export type Outcome = { name: string; ok: boolean; detail: string; query?: string };

function run(db: Db, q: string, params?: Record<string, unknown>): Envelope {
  return JSON.parse(db.execute(q, params ? JSON.stringify(params) : null));
}

// Turn the whole graph into a Cypher script that rebuilds it. Values go in as
// JSON literals; keys stay as they are. This is our browser "export file".
export function dumpToCypher(db: Db): string {
  const nodes = run(db, `MATCH (n) RETURN elementId(n) AS eid, labels(n) AS labels, properties(n) AS props`).rows;
  const rels = run(db, `MATCH (a)-[r]->(b) RETURN elementId(a) AS a, elementId(b) AS b, type(r) AS t, properties(r) AS props`).rows;
  const lit = (v: unknown): string =>
    Array.isArray(v) ? `[${v.map(lit).join(", ")}]` : JSON.stringify(v);
  const map = (o: Record<string, unknown>) =>
    `{${Object.entries(o).map(([k, v]) => `\`${k}\`: ${lit(v)}`).join(", ")}}`;
  const varOf = new Map(nodes.map((n, i) => [String(n.eid), `n${i}`]));
  const lines = nodes.map(
    (n, i) => `CREATE (n${i}:${(n.labels as string[]).join(":")} ${map(n.props as Record<string, unknown>)})`,
  );
  for (const r of rels) {
    lines.push(`CREATE (${varOf.get(String(r.a))})-[:${r.t} ${map(r.props as Record<string, unknown>)}]->(${varOf.get(String(r.b))})`);
  }
  return lines.join("\n") + ";\n";
}

export function runSpike(makeDb: () => Db): Outcome[] {
  const out: Outcome[] = [];
  const db = makeDb();
  const seeded = run(db, SEED);
  out.push({ name: "Seed graph loads (multi-CREATE statement)", ok: !seeded.error, detail: seeded.error ? JSON.stringify(seeded.error) : "ok" });

  for (const c of CASES) {
    const env = run(db, c.query, c.params);
    if (env.error) {
      out.push({ name: c.name, ok: false, detail: JSON.stringify(env.error), query: c.query });
      continue;
    }
    const problem = c.check(env.rows);
    out.push({ name: c.name, ok: !problem, detail: problem ?? `ok ${JSON.stringify(env.rows).slice(0, 160)}`, query: c.query });
  }

  // Round trip: dump to Cypher text, load into a fresh db, compare counts and a query.
  try {
    const script = dumpToCypher(db);
    const fresh = makeDb();
    const envs = fresh.executeScript(script, null).map((s) => JSON.parse(s) as Envelope);
    const err = envs.find((e) => e.error);
    const count = (d: Db, q: string) => String(run(d, q).rows[0]?.n);
    const same =
      count(db, "MATCH (n) RETURN count(n) AS n") === count(fresh, "MATCH (n) RETURN count(n) AS n") &&
      count(db, "MATCH ()-[r]->() RETURN count(r) AS n") === count(fresh, "MATCH ()-[r]->() RETURN count(r) AS n") &&
      JSON.stringify(run(fresh, `MATCH (:Step {id:'reta'})-[r:REQUIRES]->(:Step {id:'ss'}) RETURN r.profiles AS p`).rows) ===
        `[{"p":["autonomo"]}]`;
    out.push({
      name: "Export to Cypher script and re-import into a fresh db",
      ok: !err && same,
      detail: err ? JSON.stringify(err.error) : same ? `ok (${script.length} chars)` : "counts or list property differ",
    });
  } catch (e) {
    out.push({ name: "Export to Cypher script and re-import into a fresh db", ok: false, detail: String(e) });
  }
  return out;
}
