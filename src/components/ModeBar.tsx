"use client";
import type { MapStation } from "@/graph/queries.ts";

export type Mode = "map" | "circles" | "whatif" | "why";

type Props = {
  mode: Mode;
  onMode: (m: Mode) => void;
  display: "map" | "list";
  onDisplay: (d: "map" | "list") => void;
  circleCount: number;
  goals: MapStation[];
  whyGoal: string | null;
  onWhyGoal: (id: string) => void;
  whatIfStep: string | null;
  whatIfName?: string;
  onClearWhatIf: () => void;
};

const TABS: { id: Mode; label: string }[] = [
  { id: "map", label: "Route" },
  { id: "circles", label: "Circles" },
  { id: "whatif", label: "What if…" },
  { id: "why", label: "Why can't I…" },
];

export function ModeBar(p: Props) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="tablist" aria-label="Question" className="inline-flex rounded-full border border-rule bg-card p-1" data-tour="modes">
          {TABS.map((t) => (
            <button
              key={t.id}
              role="tab"
              aria-selected={p.mode === t.id}
              onClick={() => p.onMode(t.id)}
              data-tour={`tab-${t.id}`}
              className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors sm:px-4 ${
                p.mode === t.id ? "bg-ink text-paper" : "text-ink-soft hover:text-ink"
              }`}
            >
              {t.label}
              {t.id === "circles" && p.circleCount > 0 && (
                <span className={`ml-1.5 rounded-full px-1.5 text-xs ${p.mode === t.id ? "bg-terracotta text-paper" : "bg-terracotta-soft text-terracotta"}`}>
                  {p.circleCount}
                </span>
              )}
            </button>
          ))}
        </div>
        <div role="group" aria-label="View" className="inline-flex rounded-full border border-rule bg-card p-1 text-sm">
          {(["map", "list"] as const).map((d) => (
            <button key={d} onClick={() => p.onDisplay(d)} aria-pressed={p.display === d}
              className={`rounded-full px-3 py-1 ${p.display === d ? "bg-paper-deep font-medium" : "text-ink-soft"}`}>
              {d === "map" ? "Map" : "List"}
            </button>
          ))}
        </div>
      </div>

      <div className="min-h-[28px] text-sm text-ink-soft" aria-live="polite">
        {p.mode === "map" && <p>Your route, left to right. Select a station to see what to bring and how we know.</p>}
        {p.mode === "circles" && <p>Loops in the requirements: every step waits for another one in the loop. Each comes with its documented way out.</p>}
        {p.mode === "whatif" &&
          (p.whatIfStep ? (
            <p>
              If <strong className="text-terracotta">{p.whatIfName}</strong> falls through, the steps in terracotta are stuck.{" "}
              <button className="underline" onClick={p.onClearWhatIf}>Pick another station</button>
            </p>
          ) : (
            <p><strong>Pick a station</strong> that might fall through. We&apos;ll show everything that gets stuck.</p>
          ))}
        {p.mode === "why" && (
          <div className="flex flex-wrap items-center gap-2">
            <span>Why can&apos;t I get…</span>
            {p.goals.map((g) => (
              <button key={g.id} onClick={() => p.onWhyGoal(g.id)} aria-pressed={p.whyGoal === g.id}
                className={`rounded-full border px-3 py-0.5 text-sm ${p.whyGoal === g.id ? "border-ink bg-ink text-paper" : "border-rule hover:border-ink-soft"}`}>
                {g.shortName}
              </button>
            ))}
            <span className="text-xs text-muted">or pick any station on the map</span>
          </div>
        )}
      </div>
    </div>
  );
}
