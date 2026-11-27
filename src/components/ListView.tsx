"use client";
// The same route as the map, as an ordered list: for screen readers, small
// screens, and anyone who prefers text. Ordered so requirements come first.
import type { Circle, MapView } from "@/graph/queries.ts";
import type { Highlight } from "./MetroMap";
import type { Mode } from "./ModeBar";

const STATUS: Record<string, { label: string; cls: string }> = {
  done: { label: "Done", cls: "bg-olive-soft text-olive" },
  open: { label: "Do now", cls: "bg-ink text-paper" },
  blocked: { label: "Blocked", cls: "bg-paper-deep text-ink-soft" },
  not_needed: { label: "Not needed", cls: "bg-paper-deep text-muted" },
};

export function ListView({ view, circles, highlight, onSelect, mode }: {
  view: MapView; circles: Circle[]; highlight: Highlight | null; onSelect: (id: string) => void; mode: Mode;
}) {
  const order = topoOrder(view);
  const needs = (id: string) => view.lines.filter((l) => l.from === id);
  const inCircle = new Set(circles.flatMap((c) => c.stations.map((s) => s.id)));
  const action = mode === "whatif" ? "Suppose this falls through" : mode === "why" ? "Why can't I get this" : "Details";

  return (
    <ol className="divide-y divide-rule">
      {order.map((id, i) => {
        const s = view.stations.find((x) => x.id === id)!;
        const lit = highlight && (highlight.stations.has(id) || highlight.focus === id);
        return (
          <li key={id} className={`flex flex-wrap items-start gap-x-4 gap-y-1 px-4 py-3 ${highlight && !lit ? "opacity-45" : ""} ${lit && highlight?.tone !== "why" ? "bg-terracotta-soft/50" : ""}`}>
            <span className="w-6 pt-0.5 text-right font-mono text-xs text-muted">{i + 1}</span>
            <div className="min-w-0 flex-1">
              <p className="font-medium">
                {s.name}
                {s.isGoal && <span className="ml-2 text-xs text-muted">Goal</span>}
                {s.isWayOut && <span className="ml-2 text-xs text-terracotta">Way out</span>}
                {inCircle.has(id) && <span className="ml-2 text-xs text-terracotta">In a circle</span>}
                {!s.verified && <span className="ml-2 text-xs text-terracotta">Not yet verified</span>}
              </p>
              <p className="small-caps text-xs text-muted">{s.nameEs}</p>
              {needs(id).length > 0 && (
                <p className="mt-1 text-sm text-ink-soft">
                  Needs:{" "}
                  {needs(id).map((l, k) => (
                    <span key={l.to}>
                      {k > 0 && ", "}
                      {view.stations.find((x) => x.id === l.to)?.shortName}
                      {l.basis === "practice" && <em className="text-muted"> (common practice)</em>}
                    </span>
                  ))}
                </p>
              )}
            </div>
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS[s.status].cls}`}>{STATUS[s.status].label}</span>
            <button className="btn-small" onClick={() => onSelect(id)} aria-label={`${action}: ${s.name}`}>{action}</button>
          </li>
        );
      })}
    </ol>
  );
}

/** Requirements before the steps that need them; circles keep their data order. */
function topoOrder(view: MapView): string[] {
  const ids = view.stations.map((s) => s.id);
  const out: string[] = [];
  const seen = new Set<string>();
  const visit = (id: string, stack: Set<string>) => {
    if (seen.has(id) || stack.has(id)) return;
    stack.add(id);
    for (const l of view.lines.filter((x) => x.from === id)) visit(l.to, stack);
    for (const w of view.wayOutLinks.filter((x) => x.to === id)) visit(w.from, stack);
    stack.delete(id);
    seen.add(id);
    out.push(id);
  };
  for (const id of ids) visit(id, new Set());
  return out;
}
