// Builds mcp/paperwork-path.rl: the official steps and the demo traveller
// (Lena) in a real Relate file, for `relate serve --mcp stdio`. It uses the
// same seed and the same queries as the browser app, through Relate's native
// Node client, and checks that the four core questions give the same answers.
//
//   npm run mcp:build
import { mkdirSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { Graph, type RelateLike } from "../src/graph/db.ts";
import { loadDemoUser } from "../src/graph/plan.ts";
import { doThisNow, findCircles, whatIf, whyCant } from "../src/graph/queries.ts";

const require = createRequire(import.meta.url);
const { Database } = require("@relate/relate");

const file = resolve(process.argv[2] ?? "mcp/paperwork-path.rl");
mkdirSync(resolve(file, ".."), { recursive: true });
rmSync(file, { force: true });

// The native client returns rows and throws on errors; the app's Graph class
// expects the WASM build's JSON envelope. This adapter makes them match.
const conn = Database.open(file).connect();
const native: RelateLike = {
  execute(query, paramsJson) {
    try {
      const r = conn.query(query, paramsJson ? JSON.parse(paramsJson) : {});
      return JSON.stringify({ rows: r.rows, error: null });
    } catch (e) {
      return JSON.stringify({ rows: [], error: e instanceof Error ? e.message : String(e) });
    }
  },
  executeScript() {
    throw new Error("Not needed for building the MCP file.");
  },
};

const graph = new Graph(native);
graph.loadSeed();
loadDemoUser(graph);

const count = (q: string) => graph.run<{ n: number }>(q)[0].n;
const circles = findCircles(graph, "lena").data;
const checks: [string, boolean][] = [
  ["14 steps", count("MATCH (s:Step) RETURN count(s) AS n") === 14],
  ["3 profiles", count("MATCH (p:Profile) RETURN count(p) AS n") === 3],
  ["Lena is in an official circle", circles.some((c) => c.allOfficial && c.affectsYou)],
  ["the way out is the NIE number", circles.some((c) => c.wayOuts.some((w) => w.id === "nie_number"))],
  ["Lena can start the NIE number now", doThisNow(graph, "lena").data.some((s) => s.id === "nie_number")],
  ["what if the certificate fails: RETA is stuck", whatIf(graph, "lena", "eu_certificate").data.blocked.some((b) => b.id === "reta")],
  ["why can't Lena get RETA: something is missing", whyCant(graph, "lena", "reta").data.missing.length > 0],
];
for (const [name, ok] of checks) console.log(`${ok ? "ok  " : "FAIL"} ${name}`);
if (checks.some(([, ok]) => !ok)) process.exit(1);
console.log(`\nWrote ${file}\nServe it with:\n  relate serve --mcp stdio --database "${file}" --read-only`);
