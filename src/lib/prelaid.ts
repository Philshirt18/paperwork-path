// Map layouts worked out ahead of time with ELK (npm run layouts), one per
// profile. The browser then skips downloading and running ELK (1.4 MB) for
// every map this app can show. Any other shape still falls back to ELK.
import { layoutMap, shapeKey, type MapLayout } from "./layout.ts";
import type { MapView } from "../graph/queries.ts";
import prelaid from "./layouts.json" with { type: "json" };

const LAYOUTS = prelaid as Record<string, MapLayout>;

export function getLayout(view: MapView): Promise<MapLayout> {
  return Promise.resolve(LAYOUTS[shapeKey(view)] ?? layoutMap(view));
}

export const hasPrelaidLayout = (view: MapView) => shapeKey(view) in LAYOUTS;
