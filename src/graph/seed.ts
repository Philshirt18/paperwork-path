// Turns the JSON files in /data into Cypher statements that build the graph.
// Each statement takes JSON parameters, so no data is pasted into query text.
import steps from "../../data/steps.json" with { type: "json" };
import requires from "../../data/requires.json" with { type: "json" };
import workarounds from "../../data/workarounds.json" with { type: "json" };
import profiles from "../../data/profiles.json" with { type: "json" };
import sourcesRaw from "../../data/sources.json" with { type: "json" };

type Source = { url: string; title: string; checked: string };
const sources = sourcesRaw as unknown as Record<string, Source>;

const src = (key: string | null) => {
  const s = key ? sources[key] : undefined;
  return { sourceUrl: s?.url ?? null, sourceTitle: s?.title ?? null, lastChecked: s?.checked ?? null };
};

export type Statement = { query: string; params: Record<string, unknown> };

export function seedStatements(): Statement[] {
  return [
    {
      query: `UNWIND $rows AS row
              CREATE (:Profile {id: row.id, name: row.name, nameEs: row.nameEs})`,
      params: { rows: profiles.map(({ id, name, nameEs }) => ({ id, name, nameEs })) },
    },
    {
      query: `UNWIND $rows AS row
              CREATE (:Step {id: row.id, name: row.name, shortName: row.shortName, nameEs: row.nameEs, office: row.office,
                whatToBring: row.whatToBring, verified: row.verified, unverifiedReason: row.unverifiedReason,
                sourceUrl: row.sourceUrl, sourceTitle: row.sourceTitle, lastChecked: row.lastChecked})`,
      params: {
        rows: steps.map((s) => ({
          id: s.id, name: s.name, shortName: s.shortName, nameEs: s.nameEs, office: s.office, whatToBring: s.whatToBring,
          verified: s.verified, unverifiedReason: (s as { unverifiedReason?: string }).unverifiedReason ?? null,
          ...src(s.source),
        })),
      },
    },
    {
      query: `UNWIND $rows AS row
              MATCH (a:Step {id: row.from}), (b:Step {id: row.to})
              CREATE (a)-[:REQUIRES {profiles: row.profiles, basis: row.basis, why: row.why,
                sourceUrl: row.sourceUrl, sourceTitle: row.sourceTitle}]->(b)`,
      params: {
        rows: requires.map((r) => {
          const { sourceUrl, sourceTitle } = src(r.source);
          return { from: r.from, to: r.to, profiles: r.profiles, basis: r.basis, why: r.why, sourceUrl, sourceTitle };
        }),
      },
    },
    {
      query: `UNWIND $rows AS row
              MATCH (w:Step {id: row.step}), (t:Step {id: row.for})
              CREATE (w)-[:WORKAROUND_FOR {how: row.how, sourceUrl: row.sourceUrl, sourceTitle: row.sourceTitle}]->(t)`,
      params: {
        rows: workarounds.map((w) => {
          const { sourceUrl, sourceTitle } = src(w.source);
          return { step: w.step, for: w.for, how: w.how, sourceUrl, sourceTitle };
        }),
      },
    },
    {
      query: `UNWIND $rows AS row
              MATCH (p:Profile {id: row.profile}), (s:Step {id: row.goal})
              CREATE (p)-[:GOAL]->(s)`,
      params: { rows: profiles.flatMap((p) => p.goals.map((goal) => ({ profile: p.id, goal }))) },
    },
  ];
}

// Checks the JSON before it reaches the database: every id must exist.
export function validateData(): string[] {
  const problems: string[] = [];
  const stepIds = new Set(steps.map((s) => s.id));
  const profileIds = new Set(profiles.map((p) => p.id));
  const known = (key: string | null, where: string) => {
    if (key && !sources[key]) problems.push(`${where}: unknown source "${key}"`);
  };
  for (const s of steps) {
    known(s.source, `step ${s.id}`);
    if (!s.verified && !(s as { unverifiedReason?: string }).unverifiedReason)
      problems.push(`step ${s.id}: unverified without a reason`);
  }
  for (const r of requires) {
    if (!stepIds.has(r.from)) problems.push(`requires: unknown step "${r.from}"`);
    if (!stepIds.has(r.to)) problems.push(`requires: unknown step "${r.to}"`);
    for (const p of r.profiles) if (!profileIds.has(p)) problems.push(`requires ${r.from}->${r.to}: unknown profile "${p}"`);
    known(r.source, `requires ${r.from}->${r.to}`);
  }
  for (const w of workarounds) {
    if (!stepIds.has(w.step) || !stepIds.has(w.for)) problems.push(`workaround ${w.step}->${w.for}: unknown step`);
    known(w.source, `workaround ${w.step}`);
  }
  for (const p of profiles) for (const g of p.goals) if (!stepIds.has(g)) problems.push(`profile ${p.id}: unknown goal "${g}"`);
  return problems;
}
