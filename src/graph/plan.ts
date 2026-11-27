// The user's own plan lives in the same Relate graph as the official steps:
// a :User node, linked to a :Profile and to the :Step nodes they completed.
// A plan file is a small Cypher script that recreates just that part.
import type { Graph } from "./db.ts";
import demoUser from "../../data/demo-user.json" with { type: "json" };

export const PLAN_FILE_HEADER = "// Paperwork Path plan file — openCypher for Relate";

export function createUser(graph: Graph, user: { id: string; profile: string; completed?: string[] }) {
  graph.run(`MATCH (u:User {id: $id}) DETACH DELETE u`, { id: user.id });
  const made = graph.run(
    `MATCH (p:Profile {id: $profile}) CREATE (u:User {id: $id})-[:IS]->(p) RETURN u.id AS id`,
    { id: user.id, profile: user.profile },
  );
  if (!made.length) throw new Error(`Unknown profile "${user.profile}"`);
  for (const step of user.completed ?? []) markDone(graph, user.id, step);
}

export function loadDemoUser(graph: Graph) {
  createUser(graph, demoUser);
  return demoUser;
}

export function markDone(graph: Graph, userId: string, stepId: string) {
  const rows = graph.run(
    `MATCH (u:User {id: $userId}), (s:Step {id: $stepId}) MERGE (u)-[:COMPLETED]->(s) RETURN s.id AS id`,
    { userId, stepId },
  );
  if (!rows.length) throw new Error(`Unknown user or step: ${userId} / ${stepId}`);
}

export function markUndone(graph: Graph, userId: string, stepId: string) {
  graph.run(`MATCH (:User {id: $userId})-[c:COMPLETED]->(:Step {id: $stepId}) DELETE c`, { userId, stepId });
}

export function completedSteps(graph: Graph, userId: string): string[] {
  return graph
    .run<{ id: string }>(`MATCH (:User {id: $userId})-[:COMPLETED]->(s:Step) RETURN s.id AS id ORDER BY id`, { userId })
    .map((r) => r.id);
}

/** Cypher text that recreates the user's plan on top of the official steps. */
export function exportPlan(graph: Graph, userId: string): string {
  const [user] = graph.run<{ profile: string }>(
    `MATCH (:User {id: $userId})-[:IS]->(p:Profile) RETURN p.id AS profile`,
    { userId },
  );
  if (!user) throw new Error(`Unknown user "${userId}"`);
  const done = completedSteps(graph, userId);
  const lit = (s: string) => JSON.stringify(s); // JSON strings are valid Cypher strings
  return [
    PLAN_FILE_HEADER,
    `// Load into Relate after the official steps. Exported ${new Date().toISOString().slice(0, 10)}.`,
    `MATCH (u:User {id: ${lit(userId)}}) DETACH DELETE u;`,
    `MATCH (p:Profile {id: ${lit(user.profile)}}) CREATE (:User {id: ${lit(userId)}})-[:IS]->(p);`,
    ...done.map(
      (s) => `MATCH (u:User {id: ${lit(userId)}}), (s:Step {id: ${lit(s)}}) MERGE (u)-[:COMPLETED]->(s);`,
    ),
    "",
  ].join("\n");
}

/**
 * Loads a plan file. We do not run uploaded text as-is: we read the ids out of
 * it with strict patterns and rebuild the plan with our own parameterised
 * queries, so a file cannot change the official steps.
 */
export function importPlan(graph: Graph, text: string): { userId: string; profile: string; completed: string[] } {
  if (!text.startsWith(PLAN_FILE_HEADER)) throw new Error("This is not a Paperwork Path plan file.");
  const id = String.raw`"((?:[^"\\]|\\.){1,64})"`;
  const profile = text.match(new RegExp(String.raw`^MATCH \(p:Profile \{id: ${id}\}\) CREATE \(:User \{id: ${id}\}\)`, "m"));
  if (!profile) throw new Error("The plan file has no profile line.");
  const userId = JSON.parse(`"${profile[2]}"`) as string;
  const completed = [...text.matchAll(new RegExp(String.raw`\(s:Step \{id: ${id}\}\) MERGE`, "g"))].map(
    (m) => JSON.parse(`"${m[1]}"`) as string,
  );
  createUser(graph, { id: userId, profile: JSON.parse(`"${profile[1]}"`), completed });
  return { userId, profile: JSON.parse(`"${profile[1]}"`), completed };
}
