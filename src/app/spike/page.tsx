"use client";
// Phase 0 spike page: runs every Cypher feature test in the real browser
// against the Relate WASM build. Not part of the product; removed later.
import { useEffect, useState } from "react";
import type { Outcome } from "@/spike/run.ts";

export default function SpikePage() {
  const [results, setResults] = useState<Outcome[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ms, setMs] = useState(0);

  useEffect(() => {
    (async () => {
      try {
        const t0 = performance.now();
        const relate = await import("@relate/relate-wasm");
        await relate.default({ module_or_path: "/relate/relate_bg.wasm" });
        const { runSpike } = await import("@/spike/run.ts");
        const out = runSpike(() => new relate.RelateDb());
        setMs(Math.round(performance.now() - t0));
        setResults(out);
        (window as unknown as { __spike: Outcome[] }).__spike = out;
      } catch (e) {
        setError(String(e));
      }
    })();
  }, []);

  const passed = results?.filter((r) => r.ok).length ?? 0;
  return (
    <main style={{ fontFamily: "ui-monospace, monospace", padding: 24, fontSize: 13 }}>
      <h1 style={{ fontSize: 20, marginBottom: 12 }}>Relate WASM spike</h1>
      {error && <p style={{ color: "crimson" }}>Error: {error}</p>}
      {!results && !error && <p>Loading Relate…</p>}
      {results && (
        <>
          <p id="summary">
            {passed}/{results.length} passed in {ms} ms (load + run)
          </p>
          <ul>
            {results.map((r) => (
              <li key={r.name} style={{ margin: "8px 0", color: r.ok ? "#2f5d2f" : "crimson" }}>
                {r.ok ? "PASS" : "FAIL"} {r.name}
                <div style={{ color: "#555" }}>{r.detail}</div>
              </li>
            ))}
          </ul>
        </>
      )}
    </main>
  );
}
