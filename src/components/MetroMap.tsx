"use client";
// The transit map. Stations are steps, lines are requirements, the user's
// profile is the line colour. Circles are always outlined in terracotta;
// a "highlight" (circle / what if / why) brings its part forward and draws it in.
import { memo } from "react";
import type { MapStation, MapView } from "@/graph/queries.ts";
import { edgeKey, roundedPath, type MapLayout } from "@/lib/layout.ts";

export type Highlight = {
  id: string; // changes re-trigger the draw-in animation
  tone: "circle" | "whatif" | "why";
  stations: Set<string>;
  edges: Set<string>; // edgeKey(from, to) of REQUIRES (from needs to)
  focus?: string; // the station the question is about
  wayOuts?: Set<string>;
};

export const PROFILE_COLOR: Record<string, string> = {
  employee: "var(--color-line-employee)",
  autonomo: "var(--color-line-autonomo)",
  own_means: "var(--color-line-own)",
};

type Props = {
  view: MapView;
  layout: MapLayout;
  circleEdges: Set<string>;
  highlight: Highlight | null;
  selected: string | null;
  onSelect: (id: string) => void;
  pickHint?: string; // e.g. "Pick a station that might fall through"
};

const TONE_COLOR = { circle: "var(--color-terracotta)", whatif: "var(--color-terracotta)", why: "var(--color-ink)" };

function MetroMapInner({ view, layout, circleEdges, highlight, selected, onSelect, pickHint }: Props) {
  const line = PROFILE_COLOR[view.profile] ?? "var(--color-ink)";
  const basis = Object.fromEntries(view.lines.map((l) => [edgeKey(l.from, l.to), l.basis]));
  const dim = (on: boolean) => (highlight && !on ? 0.22 : 1);

  return (
    <svg
      viewBox={`0 0 ${layout.width} ${layout.height}`}
      className="block h-auto w-full"
      role="group"
      aria-label={`Metro map of ${view.stations.length} steps. ${pickHint ?? "Select a station for details."}`}
    >
      <defs>
        <pattern id="hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="6" stroke="var(--color-rule)" strokeWidth="2" />
        </pattern>
      </defs>

      {/* Lines */}
      <g fill="none" strokeLinecap="round" strokeLinejoin="round">
        {layout.edges.map((e) => {
          const d = roundedPath(e.points);
          if (e.kind === "wayout") {
            const on = !highlight || highlight.wayOuts?.has(e.from) || highlight.stations.has(e.from);
            return (
              <path key={`w${e.key}`} d={d} stroke="var(--color-terracotta)" strokeWidth={2.5}
                strokeDasharray="1 7" opacity={dim(Boolean(on))} />
            );
          }
          const practice = basis[e.key] === "practice";
          const on = Boolean(highlight?.edges.has(e.key));
          const inCircle = circleEdges.has(e.key);
          return (
            <g key={e.key} opacity={dim(on)} style={{ transition: "opacity 300ms var(--ease-out-soft)" }}>
              {/* paper casing so crossings read cleanly */}
              <path d={d} stroke="var(--color-paper)" strokeWidth={13} />
              {inCircle && <path d={d} stroke="var(--color-terracotta)" strokeWidth={14} opacity={0.42} />}
              <path d={d} stroke={line} strokeWidth={6} strokeDasharray={practice ? "10 8" : undefined}
                strokeLinecap={practice ? "butt" : "round"} />
            </g>
          );
        })}
      </g>

      {/* Highlight overlay, drawn in on top */}
      {highlight && (
        <g key={highlight.id} fill="none" strokeLinecap="round" strokeLinejoin="round">
          {layout.edges
            .filter((e) => e.kind === "requires" && highlight.edges.has(e.key))
            .map((e) => (
              <path key={e.key} d={roundedPath(e.points)} pathLength={1} className="draw-in"
                stroke={TONE_COLOR[highlight.tone]} strokeWidth={highlight.tone === "why" ? 4 : 5} />
            ))}
        </g>
      )}

      {/* Stations */}
      {view.stations.map((s) => {
        const p = layout.stations[s.id];
        if (!p) return null;
        const on = !highlight || highlight.stations.has(s.id) || highlight.focus === s.id || Boolean(highlight.wayOuts?.has(s.id));
        return (
          <Station key={s.id} s={s} x={p.x} y={p.y} line={line} selected={selected === s.id}
            opacity={dim(on)} hl={highlight} onSelect={onSelect} />
        );
      })}
    </svg>
  );
}

export const MetroMap = memo(MetroMapInner);

const STATUS_LABEL: Record<MapStation["status"], string> = {
  done: "done",
  open: "you can do this now",
  blocked: "blocked",
  not_needed: "not needed any more",
};

function Station({ s, x, y, line, selected, opacity, hl, onSelect }: {
  s: MapStation; x: number; y: number; line: string; selected: boolean; opacity: number;
  hl: Highlight | null; onSelect: (id: string) => void;
}) {
  const lines = wrap(s.shortName, 17, 2);
  const isFocus = hl?.focus === s.id;
  const lit = hl?.stations.has(s.id) && hl.tone !== "why";
  const ring =
    isFocus && hl?.tone === "whatif" ? "var(--color-terracotta)" :
    s.status === "done" ? "var(--color-olive)" :
    s.status === "blocked" || s.status === "not_needed" ? "#9a9da3" : "var(--color-ink)";
  const label = `${s.name} (${s.nameEs}), ${STATUS_LABEL[s.status]}${s.isGoal ? ", goal" : ""}${s.isWayOut ? ", way out" : ""}${s.verified ? "" : ", not yet verified"}`;

  return (
    <g
      transform={`translate(${x},${y})`}
      opacity={opacity}
      style={{ transition: "opacity 300ms var(--ease-out-soft)", cursor: "pointer" }}
      role="button"
      tabIndex={0}
      aria-label={label}
      aria-pressed={selected}
      onClick={() => onSelect(s.id)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect(s.id);
        }
      }}
      className="group outline-none"
    >
      {/* generous hit area */}
      <rect x={-70} y={-18} width={140} height={78} fill="transparent" />
      {selected && <circle r={22} fill="none" stroke="var(--color-ink)" strokeWidth={1.5} strokeDasharray="3 3" />}
      <circle r={20} fill="none" stroke="var(--color-terracotta)" strokeWidth={2.5}
        className="opacity-0 group-focus-visible:opacity-100" />

      {s.isWayOut ? (
        <rect x={-11} y={-11} width={22} height={22} rx={5} transform="rotate(45)"
          fill={s.status === "done" ? "var(--color-olive)" : "var(--color-paper)"}
          stroke={s.status === "not_needed" ? "#9a9da3" : "var(--color-terracotta)"} strokeWidth={4} />
      ) : (
        <>
          {s.isGoal && <circle r={16} fill="var(--color-paper)" stroke={ring} strokeWidth={2} />}
          <circle r={s.status === "not_needed" ? 6 : 10.5}
            fill={s.status === "done" ? "var(--color-olive)" : lit && hl?.tone === "whatif" ? "var(--color-terracotta-soft)" : "var(--color-paper)"}
            stroke={lit && hl?.tone === "whatif" && !isFocus ? "var(--color-terracotta)" : ring}
            strokeWidth={s.status === "blocked" ? 3 : 4.5} />
          {isFocus && hl?.tone === "whatif" && (
            <path d="M-5,-5 L5,5 M5,-5 L-5,5" stroke="var(--color-terracotta)" strokeWidth={3} strokeLinecap="round" />
          )}
        </>
      )}

      {s.status === "done" && (
        <g transform="translate(36,-15)"><g className="stamp">
          <rect x={-27} y={-8} width={54} height={16} rx={2} fill="var(--color-paper)" stroke="var(--color-olive)" strokeWidth={1.5} />
          <text textAnchor="middle" y={4} fontSize={9.5} fontWeight={700} letterSpacing="0.14em" fill="var(--color-olive)"
            style={{ fontFamily: "var(--font-sans)" }}>SELLADO</text>
        </g></g>
      )}
      {s.status === "open" && !s.isWayOut && (
        <circle r={4} fill={line} />
      )}

      <text textAnchor="middle" y={32} fontSize={12.5} fontWeight={600} fill="var(--color-ink)" style={{ fontFamily: "var(--font-sans)" }}>
        {lines.map((t, i) => (
          <tspan key={i} x={0} dy={i === 0 ? 0 : 15}>{t}</tspan>
        ))}
        {!s.verified && <tspan fill="var(--color-terracotta)" fontSize={11} dx={3}> ?</tspan>}
      </text>
      <text textAnchor="middle" y={32 + lines.length * 15} fontSize={10.5} fill="var(--color-muted)"
        className="small-caps" style={{ fontFamily: "var(--font-sans)" }}>
        {truncate(s.nameEs, 28)}
      </text>
    </g>
  );
}

function wrap(text: string, width: number, maxLines: number): string[] {
  const words = text.replace(/\s*\(.*?\)\s*/g, " ").trim().split(/\s+/);
  const out: string[] = [];
  let cur = "";
  for (const w of words) {
    if ((cur + " " + w).trim().length > width && cur) {
      out.push(cur);
      cur = w;
    } else cur = (cur + " " + w).trim();
  }
  if (cur) out.push(cur);
  if (out.length > maxLines) {
    const kept = out.slice(0, maxLines);
    kept[maxLines - 1] = truncate(kept[maxLines - 1] + " " + out.slice(maxLines).join(" "), width);
    return kept;
  }
  return out;
}

function truncate(t: string, n: number) {
  return t.length > n ? t.slice(0, n - 1).trimEnd() + "…" : t;
}
