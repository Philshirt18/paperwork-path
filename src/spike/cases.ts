// Phase 0 spike: every Cypher feature Paperwork Path depends on, as a list of
// small tests. The same list runs in Node (scripts/spike-node.mjs) and in the
// browser (/spike page), so we know the WASM build behaves the same in both.

export type Case = {
  name: string;
  query: string;
  params?: Record<string, unknown>;
  // Returns null when the result looks right, or a short reason when it doesn't.
  check: (rows: Record<string, unknown>[]) => string | null;
};

// A tiny graph with the classic Spanish circle in it:
// rental contract -> NIE -> padrón -> rental contract.
export const SEED = `
CREATE (emp:Profile {id: 'employee', name: 'Employee'})
CREATE (aut:Profile {id: 'autonomo', name: 'Self-employed'})
CREATE (rent:Step {id: 'rental', name: 'Rental contract', tags: ['housing', 'private']})
CREATE (nie:Step {id: 'nie', name: 'NIE certificate'})
CREATE (pad:Step {id: 'padron', name: 'Padrón registration'})
CREATE (ss:Step {id: 'ss', name: 'Social Security number'})
CREATE (reta:Step {id: 'reta', name: 'Register as autónomo (RETA)'})
CREATE (bank:Step {id: 'bank', name: 'Bank account'})
CREATE (cita:Step {id: 'cita', name: 'Appointment without address'})
CREATE (rent)-[:REQUIRES {profiles: []}]->(nie)
CREATE (nie)-[:REQUIRES {profiles: []}]->(pad)
CREATE (pad)-[:REQUIRES {profiles: []}]->(rent)
CREATE (ss)-[:REQUIRES {profiles: []}]->(nie)
CREATE (reta)-[:REQUIRES {profiles: ['autonomo']}]->(ss)
CREATE (reta)-[:REQUIRES {profiles: ['autonomo']}]->(bank)
CREATE (bank)-[:REQUIRES {profiles: ['employee', 'autonomo']}]->(nie)
CREATE (cita)-[:WORKAROUND_FOR]->(pad)
CREATE (aut)-[:GOAL]->(reta)
CREATE (emp)-[:GOAL]->(ss)
CREATE (u:User {id: 'lena'})-[:IS]->(aut)
CREATE (u)-[:COMPLETED]->(cita)
`;

const ids = (rows: Record<string, unknown>[], col = "id") =>
  rows.map((r) => String(r[col])).sort().join(",");

const expect = (got: string, want: string) =>
  got === want ? null : `expected ${want}, got ${got}`;

export const CASES: Case[] = [
  {
    name: "List property on a relationship is stored and read back",
    query: `MATCH (:Step {id:'reta'})-[r:REQUIRES]->(:Step {id:'ss'}) RETURN r.profiles AS p`,
    check: (rows) => expect(JSON.stringify(rows[0]?.p), `["autonomo"]`),
  },
  {
    name: "Empty list property on a relationship",
    query: `MATCH (:Step {id:'rental'})-[r:REQUIRES]->() RETURN r.profiles AS p, size(r.profiles) AS n`,
    check: (rows) => expect(String(rows[0]?.n), "0"),
  },
  {
    name: "Profile filter: IN on list property, with empty = everyone",
    query: `MATCH (s:Step)-[r:REQUIRES]->(t:Step)
            WHERE size(r.profiles) = 0 OR $profile IN r.profiles
            RETURN s.id + '>' + t.id AS id`,
    params: { profile: "employee" },
    check: (rows) =>
      expect(ids(rows), "bank>nie,nie>padron,padron>rental,rental>nie,ss>nie"),
  },
  {
    name: "Variable-length path *1..8 with a parameter start node",
    query: `MATCH (g:Step {id: $goal})-[:REQUIRES*1..8]->(d:Step) RETURN DISTINCT d.id AS id`,
    params: { goal: "reta" },
    check: (rows) => expect(ids(rows), "bank,nie,padron,rental,ss"),
  },
  {
    name: "relationships(path) and all() predicate over them",
    query: `MATCH p = (g:Step {id:'reta'})-[:REQUIRES*1..8]->(d:Step {id:'nie'})
            WHERE all(r IN relationships(p) WHERE size(r.profiles) = 0 OR 'autonomo' IN r.profiles)
            RETURN length(p) AS len, [n IN nodes(p) | n.id] AS chain ORDER BY len`,
    check: (rows) =>
      // Cypher paths may repeat nodes (not relationships), so we also get the
      // two longer paths that go round the circle. Both short ones must exist.
      rows.filter((r) => r.len === 2).length === 2 && rows.length === 4
        ? null
        : `expected 2 short + 2 looping paths, got ${JSON.stringify(rows)}`,
  },
  {
    name: "all() filters out paths for the wrong profile",
    query: `MATCH p = (g:Step {id:'reta'})-[:REQUIRES*1..8]->(d:Step {id:'nie'})
            WHERE all(r IN relationships(p) WHERE size(r.profiles) = 0 OR 'employee' IN r.profiles)
            RETURN count(p) AS n`,
    check: (rows) => expect(String(rows[0]?.n), "0"),
  },
  {
    name: "List comprehension",
    query: `MATCH (s:Step {id:'rental'}) RETURN [t IN s.tags WHERE t <> 'private' | toUpper(t)] AS x`,
    check: (rows) => expect(JSON.stringify(rows[0]?.x), `["HOUSING"]`),
  },
  {
    name: "Pattern comprehension",
    query: `MATCH (s:Step {id:'reta'})
            RETURN [(s)-[r:REQUIRES]->(t:Step) | t.id] AS reqs`,
    check: (rows) =>
      expect(((rows[0]?.reqs as string[]) ?? []).slice().sort().join(","), "bank,ss"),
  },
  {
    name: "Cycle detection (s)-[:REQUIRES*2..6]->(s)",
    query: `MATCH p = (s:Step)-[:REQUIRES*2..6]->(s)
            RETURN s.id AS id, [n IN nodes(p) | n.id] AS loop`,
    check: (rows) => expect(ids(rows), "nie,padron,rental"),
  },
  {
    name: "Cycle + its documented way out (WORKAROUND_FOR)",
    query: `MATCH p = (s:Step)-[:REQUIRES*2..6]->(s)
            WITH DISTINCT [n IN nodes(p) | n] AS loopNodes
            UNWIND loopNodes AS n
            MATCH (w:Step)-[:WORKAROUND_FOR]->(n)
            RETURN DISTINCT w.id AS id`,
    check: (rows) => expect(ids(rows), "cita"),
  },
  {
    name: "Do this now: open steps whose requirements are all done (NOT EXISTS subquery)",
    query: `MATCH (u:User {id:$user})-[:IS]->(pr:Profile)
            MATCH (s:Step)
            WHERE NOT (u)-[:COMPLETED]->(s)
              AND NOT EXISTS {
                MATCH (s)-[r:REQUIRES]->(req:Step)
                WHERE (size(r.profiles) = 0 OR pr.id IN r.profiles)
                  AND NOT (u)-[:COMPLETED]->(req)
              }
            RETURN s.id AS id`,
    params: { user: "lena" },
    check: (rows) => expect(ids(rows), ""),
  },
  {
    name: "What if: steps downstream of a failed step (reverse direction)",
    query: `MATCH (x:Step {id:$failed})<-[:REQUIRES*1..8]-(blocked:Step) RETURN DISTINCT blocked.id AS id`,
    params: { failed: "bank" },
    check: (rows) => expect(ids(rows), "reta"),
  },
  {
    name: "shortestPath (nice to have for 'Why can't I')",
    query: `MATCH p = shortestPath((g:Step {id:'reta'})-[:REQUIRES*..8]->(d:Step {id:'padron'}))
            RETURN [n IN nodes(p) | n.id] AS chain`,
    check: (rows) =>
      Array.isArray(rows[0]?.chain) && (rows[0].chain as string[]).length === 4
        ? null
        : `got ${JSON.stringify(rows)}`,
  },
  {
    name: "Write: MERGE a COMPLETED edge, then read it",
    query: `MATCH (u:User {id:'lena'}), (s:Step {id:'bank'}) MERGE (u)-[:COMPLETED]->(s)
            WITH u MATCH (u)-[:COMPLETED]->(d) RETURN d.id AS id`,
    check: (rows) => expect(ids(rows), "bank,cita"),
  },
  {
    name: "Export: dump every node with labels and properties",
    query: `MATCH (n) RETURN elementId(n) AS eid, labels(n) AS labels, properties(n) AS props`,
    check: (rows) => (rows.length === 10 ? null : `expected 10 nodes, got ${rows.length}`),
  },
  {
    name: "Export: dump every relationship with type and properties",
    query: `MATCH (a)-[r]->(b) RETURN elementId(a) AS from, elementId(b) AS to, type(r) AS type, properties(r) AS props`,
    check: (rows) => (rows.length === 13 ? null : `expected 13 rels, got ${rows.length}`),
  },
];
