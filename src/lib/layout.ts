// Lays out the step graph as a metro map with ELK's "layered" algorithm:
// time runs left to right (a requirement sits left of the step that needs it),
// lines are routed orthogonally. ELK breaks cycles to lay them out, but keeps
// every edge, so the circles stay on the map; we draw them on top in terracotta.
import type { ElkNode, ElkExtendedEdge } from "elkjs/lib/elk-api";
import type { MapView } from "@/graph/queries.ts";

export const NODE_W = 144;
export const NODE_H = 76;
export const DOT_Y = 16; // station dot centre, from the top of the node box

export type Point = { x: number; y: number };
export type LaidOutStation = { id: string; x: number; y: number }; // dot centre
export type LaidOutEdge = { key: string; from: string; to: string; kind: "requires" | "wayout"; points: Point[] };
export type MapLayout = { width: number; height: number; stations: Record<string, LaidOutStation>; edges: LaidOutEdge[] };

export const edgeKey = (from: string, to: string) => `${from}>${to}`;

// ELK is large, so it loads only when the map is first drawn.
let elkPromise: Promise<{ layout: (g: ElkNode) => Promise<ElkNode> }> | null = null;
const getElk = () =>
  (elkPromise ??= import("elkjs/lib/elk.bundled.js").then(({ default: ELK }) => new ELK()));

export async function layoutMap(view: MapView): Promise<MapLayout> {
  const children: ElkNode[] = view.stations.map((s) => ({
    id: s.id,
    width: NODE_W,
    height: NODE_H,
    layoutOptions: { "elk.portConstraints": "FIXED_POS" },
    ports: [
      { id: `${s.id}:in`, x: 0, y: DOT_Y, width: 0, height: 0, layoutOptions: { "elk.port.side": "WEST" } },
      { id: `${s.id}:out`, x: NODE_W, y: DOT_Y, width: 0, height: 0, layoutOptions: { "elk.port.side": "EAST" } },
    ],
  }));
  // Draw arrows in time order: requirement (to) -> step that needs it (from).
  const edges: ElkExtendedEdge[] = [
    ...view.lines.map((l) => ({
      id: `r:${edgeKey(l.from, l.to)}`,
      sources: [`${l.to}:out`],
      targets: [`${l.from}:in`],
    })),
    ...view.wayOutLinks.map((w) => ({
      id: `w:${edgeKey(w.from, w.to)}`,
      sources: [`${w.from}:out`],
      targets: [`${w.to}:in`],
    })),
  ];

  const elk = await getElk();
  const result: ElkNode = await elk.layout({
    id: "root",
    layoutOptions: {
      "elk.algorithm": "layered",
      "elk.direction": "RIGHT",
      "elk.edgeRouting": "ORTHOGONAL",
      "elk.layered.cycleBreaking.strategy": "DEPTH_FIRST",
      "elk.layered.nodePlacement.strategy": "NETWORK_SIMPLEX",
      "elk.layered.crossingMinimization.strategy": "LAYER_SWEEP",
      "elk.layered.spacing.nodeNodeBetweenLayers": "56",
      "elk.spacing.nodeNode": "34",
      "elk.spacing.edgeEdge": "14",
      "elk.layered.spacing.edgeEdgeBetweenLayers": "14",
      "elk.layered.spacing.edgeNodeBetweenLayers": "22",
      "elk.padding": "[top=36,left=36,bottom=36,right=36]",
    },
    children,
    edges,
  });

  const stations: Record<string, LaidOutStation> = {};
  for (const n of result.children ?? []) {
    stations[n.id] = { id: n.id, x: (n.x ?? 0) + NODE_W / 2, y: (n.y ?? 0) + DOT_Y };
  }
  const laidEdges: LaidOutEdge[] = (result.edges ?? []).map((e) => {
    const [kind, key] = [e.id.startsWith("w:") ? "wayout" : "requires", e.id.slice(2)] as const;
    const [from, to] = key.split(">");
    const points: Point[] = [];
    for (const s of e.sections ?? []) {
      points.push(s.startPoint, ...(s.bendPoints ?? []), s.endPoint);
    }
    // Run the line all the way into the dots, like a metro line through a station.
    const src = stations[e.sources[0].split(":")[0]];
    const tgt = stations[e.targets[0].split(":")[0]];
    if (src && points.length) points.unshift({ x: src.x, y: src.y });
    if (tgt && points.length) points.push({ x: tgt.x, y: tgt.y });
    return { key, from, to, kind, points: dedupe(points) };
  });
  return { width: result.width ?? 0, height: result.height ?? 0, stations, edges: laidEdges };
}

function dedupe(points: Point[]) {
  return points.filter((p, i) => i === 0 || p.x !== points[i - 1].x || p.y !== points[i - 1].y);
}

/** An SVG path through orthogonal points, with rounded corners. */
export function roundedPath(points: Point[], radius = 14): string {
  if (points.length < 2) return "";
  let d = `M${points[0].x},${points[0].y}`;
  for (let i = 1; i < points.length - 1; i++) {
    const [a, b, c] = [points[i - 1], points[i], points[i + 1]];
    const r = Math.min(radius, dist(a, b) / 2, dist(b, c) / 2);
    const p1 = toward(b, a, r);
    const p2 = toward(b, c, r);
    d += ` L${p1.x},${p1.y} Q${b.x},${b.y} ${p2.x},${p2.y}`;
  }
  const last = points[points.length - 1];
  return d + ` L${last.x},${last.y}`;
}

const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
function toward(from: Point, to: Point, r: number): Point {
  const d = dist(from, to) || 1;
  return { x: from.x + ((to.x - from.x) / d) * r, y: from.y + ((to.y - from.y) / d) * r };
}
