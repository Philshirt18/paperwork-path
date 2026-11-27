// Run the Phase 0 spike in Node with the same WASM build the browser uses.
// Usage: node scripts/spike-node.ts
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { initSync, RelateDb } from "@relate/relate-wasm";
import { runSpike } from "../src/spike/run.ts";

const require = createRequire(import.meta.url);
initSync({ module: readFileSync(require.resolve("@relate/relate-wasm/relate_bg.wasm")) });

const results = runSpike(() => new RelateDb());
for (const r of results) {
  console.log(`${r.ok ? "PASS" : "FAIL"}  ${r.name}\n      ${r.detail}`);
}
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
