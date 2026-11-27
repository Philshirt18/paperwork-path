// Works out the metro map layout for each profile with ELK and saves it to
// src/lib/layouts.json, so the browser does not need ELK. Run after changing
// the data:  npm run layouts   (the tests fail if a layout is missing).
import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { initSync, RelateDb } from "@relate/relate-wasm";
import { Graph } from "../src/graph/db.ts";
import { createUser } from "../src/graph/plan.ts";
import { listProfiles, mapView } from "../src/graph/queries.ts";
import { layoutMap, shapeKey, type MapLayout } from "../src/lib/layout.ts";

const require = createRequire(import.meta.url);
initSync({ module: readFileSync(require.resolve("@relate/relate-wasm/relate_bg.wasm")) });

const graph = new Graph(new RelateDb());
graph.loadSeed();
const out: Record<string, MapLayout> = {};
for (const p of listProfiles(graph).data) {
  createUser(graph, { id: `layout_${p.id}`, profile: p.id });
  const view = mapView(graph, `layout_${p.id}`).data;
  out[shapeKey(view)] = await layoutMap(view);
  console.log(`${p.id}: ${view.stations.length} stations`);
}
writeFileSync("src/lib/layouts.json", JSON.stringify(out) + "\n");
console.log("Wrote src/lib/layouts.json");
