// Spike: build a real .rl Relate file from the same seed, with the native Node
// client, then reopen it read-only. This is the file `relate serve --mcp` uses.
import { createRequire } from "node:module";
import { SEED } from "../src/spike/cases.ts";
const require = createRequire(import.meta.url);
const { Database } = require("@relate/relate");

const path = process.argv[2] ?? "./spike.rl";
const conn = Database.open(path).connect();
conn.query("MATCH (n) DETACH DELETE n");
conn.query(SEED);
console.log("nodes written:", conn.query("MATCH (n) RETURN count(n) AS n").single());
const cyc = conn.query("MATCH p=(s:Step)-[:REQUIRES*2..6]->(s) RETURN count(p) AS n");
console.log("cycles:", cyc.rows);
