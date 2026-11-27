// The four core questions, plus two lookups, as typed functions over Relate.
// Every answer carries the exact Cypher and the official sources it used, so
// the UI can show a "How we know" panel and the agent can cite them.
//
// Rules the queries share:
// - A REQUIRES edge applies to a profile when its `profiles` list is empty
//   (everyone) or contains the profile id.
// - A requirement is MET when the user completed that step, or completed a
//   step that is a WORKAROUND_FOR it (e.g. the NIE number stands in for the
//   certificate when another office only needs your NIE).
// - A step is RELEVANT to a user when one of their profile's goals needs it
//   (directly or indirectly), or when it is a way out for a relevant step.
import type { Graph, Row } from "./db.ts";

export type Source = { url: string; title: string };
export type Explain = { cypher: string; params: Row; sources: Source[] };
export type Answer<T> = { data: T; explain: Explain };

export type StepSummary = {
  id: string;
  name: string;
  nameEs: string;
  verified: boolean;
  sourceUrl: string | null;
  sourceTitle: string | null;
};

export type ChainLink = {
  from: string;
  to: string;
  basis: "official" | "practice";
  why: string;
  sourceUrl: string | null;
  sourceTitle: string | null;
};

// ---- Cypher building blocks -------------------------------------------------

/** Does relationship `r` apply to profile `p`? */
const applies = (r: string) => `(size(${r}.profiles) = 0 OR p.id IN ${r}.profiles)`;

/** Is requirement step `n` met for user `u`? */
const met = (n: string) =>
  `(EXISTS { MATCH (u)-[:COMPLETED]->(${n}) } OR EXISTS { MATCH (u)-[:COMPLETED]->(:Step)-[:WORKAROUND_FOR]->(${n}) })`;

/** Binds u, p and `relevant` (list of Step nodes) for $userId. */
const RELEVANT = `
MATCH (u:User {id: $userId})-[:IS]->(p:Profile)-[:GOAL]->(g:Step)
MATCH reach = (g)-[:REQUIRES*0..12]->(s:Step)
WHERE all(r IN relationships(reach) WHERE ${applies("r")})
WITH u, p, collect(DISTINCT s) AS reached
OPTIONAL MATCH (w:Step)-[:WORKAROUND_FOR]->(t:Step) WHERE t IN reached
WITH u, p, reached, collect(DISTINCT w) AS ways
WITH u, p, reached + ways AS relevant`;

const STEP_FIELDS = (n: string) =>
  `${n}.id AS id, ${n}.name AS name, ${n}.nameEs AS nameEs, ${n}.verified AS verified,
   ${n}.sourceUrl AS sourceUrl, ${n}.sourceTitle AS sourceTitle`;

const CHAIN = (path: string) =>
  `[r IN relationships(${path}) | {from: startNode(r).id, to: endNode(r).id, basis: r.basis, why: r.why,
     sourceUrl: r.sourceUrl, sourceTitle: r.sourceTitle}]`;

const tidy = (q: string) => q.replace(/^\n/, "").replace(/\n\s*\n/g, "\n");

function collectSources(items: { sourceUrl?: unknown; sourceTitle?: unknown }[]): Source[] {
  const seen = new Map<string, Source>();
  for (const i of items) {
    if (typeof i.sourceUrl === "string" && !seen.has(i.sourceUrl))
      seen.set(i.sourceUrl, { url: i.sourceUrl, title: String(i.sourceTitle ?? i.sourceUrl) });
  }
  return [...seen.values()];
}

function ask<T extends Row>(graph: Graph, cypher: string, params: Row) {
  const query = tidy(cypher);
  return { rows: graph.run<T>(query, params), query };
}

// ---- 1. Do this now ---------------------------------------------------------

export type DoNowItem = StepSummary & { isWayOut: boolean };

/** Open steps: relevant, not done, and every requirement for this profile met. */
export function doThisNow(graph: Graph, userId: string): Answer<DoNowItem[]> {
  const params = { userId };
  const { rows, query } = ask<DoNowItem & Row>(graph, `${RELEVANT}
UNWIND relevant AS s
WITH DISTINCT u, p, s
WHERE NOT (u)-[:COMPLETED]->(s)
  AND NOT EXISTS {
    MATCH (s)-[r:REQUIRES]->(req:Step)
    WHERE ${applies("r")} AND NOT ${met("req")}
  }
  // A way out is only useful while what it stands in for is not done yet.
  AND NOT EXISTS { MATCH (s)-[:WORKAROUND_FOR]->(t:Step) WHERE ${met("t")} }
RETURN ${STEP_FIELDS("s")}, EXISTS { MATCH (s)-[:WORKAROUND_FOR]->() } AS isWayOut
ORDER BY isWayOut DESC, name`, params);
  return { data: rows, explain: { cypher: query, params, sources: collectSources(rows) } };
}

// ---- 2. What if X falls through ---------------------------------------------

export type BlockedItem = StepSummary & { hops: number; chain: ChainLink[] };
export type WhatIfResult = { failed: StepSummary; blocked: BlockedItem[]; wayOuts: StepSummary[] };

/**
 * If `stepId` cannot be done, which of the user's open steps get stuck?
 * A step is stuck when it needs X (directly or through other steps that are
 * not done yet). Steps already done, or X already covered by a way out you
 * completed, are not affected.
 */
export function whatIf(graph: Graph, userId: string, stepId: string): Answer<WhatIfResult> {
  const params = { userId, stepId };
  const { rows, query } = ask<BlockedItem & Row>(graph, `${RELEVANT}
MATCH (x:Step {id: $stepId})
MATCH path = (b:Step)-[:REQUIRES*1..12]->(x)
WHERE b IN relevant AND b <> x
  AND all(r IN relationships(path) WHERE ${applies("r")})
  // b itself counts as safe only if really done; a way out never replaces it.
  AND NOT (u)-[:COMPLETED]->(b)
  AND none(n IN nodes(path)[1..-1] WHERE ${met("n")})
  AND NOT EXISTS { MATCH (u)-[:COMPLETED]->(:Step)-[:WORKAROUND_FOR]->(x) }
WITH b, path ORDER BY length(path)
WITH b, collect(path)[0] AS shortest
RETURN ${STEP_FIELDS("b")}, length(shortest) AS hops, ${CHAIN("shortest")} AS chain
ORDER BY hops, name`, params);

  const failed = getStep(graph, stepId).data;
  if (!failed) throw new Error(`Unknown step "${stepId}"`);
  const wayOuts = graph.run<StepSummary & Row>(
    `MATCH (w:Step)-[:WORKAROUND_FOR]->(:Step {id: $stepId}) RETURN ${STEP_FIELDS("w")}`,
    { stepId },
  );
  const sources = collectSources([failed, ...rows, ...rows.flatMap((r) => r.chain), ...wayOuts]);
  return { data: { failed, blocked: rows, wayOuts }, explain: { cypher: query, params, sources } };
}

// ---- 3. Why can't I ... ------------------------------------------------------

export type MissingItem = StepSummary & { open: boolean; chain: ChainLink[] };
export type WhyCantResult = { goal: StepSummary; done: boolean; missing: MissingItem[] };

/**
 * Everything standing between the user and `goalId`, each with the shortest
 * chain of unmet requirements that leads to it. `open` = can be done now.
 * (Paths in Cypher may revisit a station, so we keep only the shortest one.)
 */
export function whyCant(graph: Graph, userId: string, goalId: string): Answer<WhyCantResult> {
  const params = { userId, goalId };
  const goal = getStep(graph, goalId).data;
  if (!goal) throw new Error(`Unknown step "${goalId}"`);
  const done =
    graph.run(`MATCH (:User {id: $userId})-[:COMPLETED]->(:Step {id: $goalId}) RETURN 1 AS x`, params).length > 0;

  const { rows, query } = ask<MissingItem & Row>(graph, `
MATCH (u:User {id: $userId})-[:IS]->(p:Profile)
MATCH path = (g:Step {id: $goalId})-[:REQUIRES*1..12]->(m:Step)
WHERE NOT (u)-[:COMPLETED]->(g)
  AND all(r IN relationships(path) WHERE ${applies("r")})
  AND none(n IN nodes(path)[1..] WHERE ${met("n")})
WITH u, p, m, path ORDER BY length(path)
WITH u, p, m, collect(path)[0] AS shortest
RETURN ${STEP_FIELDS("m")}, ${CHAIN("shortest")} AS chain,
  NOT EXISTS {
    MATCH (m)-[r:REQUIRES]->(req:Step) WHERE ${applies("r")} AND NOT ${met("req")}
  } AS open
ORDER BY size(chain), name`, params);

  const sources = collectSources([goal, ...rows, ...rows.flatMap((r) => r.chain)]);
  return { data: { goal, done, missing: done ? [] : rows }, explain: { cypher: query, params, sources } };
}

// ---- 4. Circle detector -----------------------------------------------------

export type Circle = {
  stations: StepSummary[];
  links: ChainLink[];
  allOfficial: boolean;
  /** True when at least one station is relevant to the user and not done. */
  affectsYou: boolean;
  wayOuts: (StepSummary & { how: string; done: boolean })[];
};

/** Dependency loops for the user's profile, each with its documented way out. */
export function findCircles(graph: Graph, userId: string): Answer<Circle[]> {
  const params = { userId };
  const { rows, query } = ask(graph, `${RELEVANT}
MATCH loop = (s:Step)-[:REQUIRES*2..8]->(s)
WHERE all(r IN relationships(loop) WHERE ${applies("r")})
WITH u, relevant, loop, nodes(loop) AS ns
RETURN [n IN ns | {id: n.id, name: n.name, nameEs: n.nameEs, verified: n.verified,
          sourceUrl: n.sourceUrl, sourceTitle: n.sourceTitle}] AS stations,
  ${CHAIN("loop")} AS links,
  any(n IN ns WHERE n IN relevant AND NOT (u)-[:COMPLETED]->(n)) AS affectsYou,
  [n IN ns | [(w:Step)-[wf:WORKAROUND_FOR]->(n) | {id: w.id, name: w.name, nameEs: w.nameEs,
     verified: w.verified, sourceUrl: wf.sourceUrl, sourceTitle: wf.sourceTitle, how: wf.how,
     done: EXISTS { MATCH (u)-[:COMPLETED]->(w) }}]] AS ways`, params);

  // The same loop is found once per station on it, and Cypher also returns
  // "figure eights" (two loops joined). Keep each simple loop once.
  const seen = new Set<string>();
  const circles: Circle[] = [];
  for (const row of rows) {
    const stations = (row.stations as StepSummary[]).slice(1); // first = last
    const ids = stations.map((s) => s.id);
    if (new Set(ids).size !== ids.length) continue;
    const key = [...ids].sort().join(",");
    if (seen.has(key)) continue;
    seen.add(key);
    const links = row.links as ChainLink[];
    const wayOuts = new Map<string, Circle["wayOuts"][number]>();
    for (const w of (row.ways as Circle["wayOuts"][]).flat()) wayOuts.set(w.id, w);
    circles.push({
      stations,
      links,
      allOfficial: links.every((l) => l.basis === "official"),
      affectsYou: Boolean(row.affectsYou),
      wayOuts: [...wayOuts.values()],
    });
  }
  // Official circles first: they are the ones the rules themselves create.
  circles.sort((a, b) => Number(b.allOfficial) - Number(a.allOfficial) || a.stations.length - b.stations.length);
  const sources = collectSources(circles.flatMap((c) => [...c.links, ...c.wayOuts]));
  return { data: circles, explain: { cypher: query, params, sources } };
}

// ---- Lookups ----------------------------------------------------------------

export type StepDetail = StepSummary & {
  office: string;
  whatToBring: string[];
  unverifiedReason: string | null;
  lastChecked: string | null;
  requires: (ChainLink & { profiles: string[] })[];
  requiredBy: string[];
  wayOutFor: { id: string; how: string }[];
};

export function getStep(graph: Graph, stepId: string): Answer<StepDetail | null> {
  const params = { stepId };
  const { rows, query } = ask<StepDetail & Row>(graph, `
MATCH (s:Step {id: $stepId})
RETURN ${STEP_FIELDS("s")}, s.office AS office, s.whatToBring AS whatToBring,
  s.unverifiedReason AS unverifiedReason, s.lastChecked AS lastChecked,
  [(s)-[r:REQUIRES]->(t:Step) | {from: s.id, to: t.id, basis: r.basis, why: r.why, profiles: r.profiles,
     sourceUrl: r.sourceUrl, sourceTitle: r.sourceTitle}] AS requires,
  [(b:Step)-[:REQUIRES]->(s) | b.id] AS requiredBy,
  [(s)-[wf:WORKAROUND_FOR]->(t:Step) | {id: t.id, how: wf.how}] AS wayOutFor`, params);
  const step = rows[0] ?? null;
  return { data: step, explain: { cypher: query, params, sources: step ? collectSources([step, ...step.requires]) : [] } };
}

export type ProfileSummary = { id: string; name: string; nameEs: string; goals: string[] };

export function listProfiles(graph: Graph): Answer<ProfileSummary[]> {
  const { rows, query } = ask<ProfileSummary & Row>(graph, `
MATCH (p:Profile)
RETURN p.id AS id, p.name AS name, p.nameEs AS nameEs, [(p)-[:GOAL]->(g:Step) | g.id] AS goals
ORDER BY id`, {});
  return { data: rows, explain: { cypher: query, params: {}, sources: [] } };
}
