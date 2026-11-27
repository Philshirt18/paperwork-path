// The assistant's tools. A fixed, typed list: the four core questions plus two
// lookups. The model can only pick a tool and fill in ids from a closed list;
// it never writes Cypher. The same definitions are used by the server (to send
// to the model) and the browser (to run them against the user's own graph).
import type Anthropic from "@anthropic-ai/sdk";
import type { Graph } from "../graph/db.ts";
import {
  doThisNow, findCircles, getStep, listProfiles, whatIf, whyCant,
  type Answer, type ChainLink, type Source,
} from "../graph/queries.ts";
import steps from "../../data/steps.json" with { type: "json" };

export const STEP_IDS = steps.map((s) => s.id);
const STEP_LIST = steps.map((s) => `${s.id} = ${s.shortName}`).join("; ");

export type ToolName = "doThisNow" | "whatIf" | "whyCant" | "findCircles" | "getStep" | "listProfiles";

const noInput = { type: "object" as const, properties: {}, required: [], additionalProperties: false };
const stepInput = (field: string, ids: string[], what: string) => ({
  type: "object" as const,
  properties: { [field]: { type: "string", enum: ids, description: what } },
  required: [field],
  additionalProperties: false,
});

export const TOOLS: Anthropic.Tool[] = [
  {
    name: "doThisNow",
    description:
      "The steps this traveller can start right now: every requirement is met, the step itself is not done. " +
      "Includes ways out of circles. Uses the traveller's own plan in their browser.",
    input_schema: noInput,
    strict: true,
  },
  {
    name: "whatIf",
    description:
      "Suppose one step falls through (is refused or delayed). Returns every step of this traveller that gets stuck, " +
      `with the chain of requirements behind each, and any documented way out. Step ids: ${STEP_LIST}.`,
    input_schema: stepInput("stepId", STEP_IDS, "The step that falls through."),
    strict: true,
  },
  {
    name: "whyCant",
    description:
      "Why can't the traveller get a step yet? Returns the missing requirements, each with the shortest chain from the step " +
      `down to it, preferring official rules. Works for any step, typically a goal. Step ids: ${STEP_LIST}.`,
    input_schema: stepInput("stepId", STEP_IDS, "The step the traveller wants."),
    strict: true,
  },
  {
    name: "findCircles",
    description:
      "Loops in the requirements for this traveller's profile (A needs B, B needs A), whether they affect the traveller, " +
      "whether they are official rules or common practice, and the documented way out of each.",
    input_schema: noInput,
    strict: true,
  },
  {
    name: "getStep",
    description:
      "Details of one step: Spanish name, office, what to bring, whether it is verified, its official source, " +
      `what it requires (and for which profiles), and what requires it. Step ids: ${STEP_LIST}.`,
    input_schema: stepInput("stepId", STEP_IDS, "The step to look up."),
    strict: true,
  },
  {
    name: "listProfiles",
    description: "The profiles in the graph (employee, self-employed, own funds) and the goal steps of each.",
    input_schema: noInput,
    strict: true,
  },
];

export const TOOL_NAMES = TOOLS.map((t) => t.name) as ToolName[];

/** What one tool call did, for the "Tool calls" list in the UI. */
export type ToolRun = {
  id: string;
  name: ToolName;
  input: Record<string, string>;
  ok: boolean;
  /** Compact JSON that goes back to the model. */
  result: string;
  /** Paths through the graph this answer used, as names, for display. */
  paths: { names: string[]; basis: ("official" | "practice")[] }[];
  sources: Source[];
  cypher: string;
};

/** Validate the model's input against the closed schema. Never trust it blindly. */
export function checkInput(name: string, input: unknown): { ok: true; input: Record<string, string> } | { ok: false; error: string } {
  if (!TOOL_NAMES.includes(name as ToolName)) return { ok: false, error: `Unknown tool "${name}".` };
  const obj = (input ?? {}) as Record<string, unknown>;
  if (typeof obj !== "object" || Array.isArray(obj)) return { ok: false, error: "Input must be an object." };
  const needsStep = name === "whatIf" || name === "whyCant" || name === "getStep";
  const keys = Object.keys(obj);
  if (!needsStep) return keys.length === 0 ? { ok: true, input: {} } : { ok: false, error: "This tool takes no input." };
  if (keys.length !== 1 || typeof obj.stepId !== "string" || !STEP_IDS.includes(obj.stepId))
    return { ok: false, error: `stepId must be one of: ${STEP_IDS.join(", ")}.` };
  return { ok: true, input: { stepId: obj.stepId } };
}

/** Run one tool against the user's graph in this browser tab. */
export function runTool(graph: Graph, userId: string, id: string, name: string, rawInput: unknown): ToolRun {
  const checked = checkInput(name, rawInput);
  const base = { id, name: name as ToolName, paths: [], sources: [], cypher: "" };
  if (!checked.ok) return { ...base, input: {}, ok: false, result: JSON.stringify({ error: checked.error }) };
  const input = checked.input;
  const nameOf = new Map(steps.map((s) => [s.id, s.shortName]));
  const pathOf = (chain: ChainLink[]) => ({
    names: chain.length ? [chain[0].from, ...chain.map((l) => l.to)].map((x) => nameOf.get(x) ?? x) : [],
    basis: chain.map((l) => l.basis),
  });
  const link = (l: ChainLink) => ({ from: l.from, to: l.to, basis: l.basis, why: l.why, source: l.sourceUrl });
  const step = (s: { id: string; shortName: string; verified: boolean; sourceUrl: string | null }) => ({
    id: s.id, name: s.shortName, verified: s.verified, source: s.sourceUrl,
  });

  try {
    let answer: Answer<unknown>;
    let data: unknown;
    let paths: ToolRun["paths"] = [];
    switch (name as ToolName) {
      case "doThisNow": {
        const a = doThisNow(graph, userId);
        answer = a;
        data = { canStartNow: a.data.map((s) => ({ ...step(s), isWayOutOfCircle: s.isWayOut })) };
        if (a.data.length === 0) data = { canStartNow: [], note: "No step can be started right now." };
        break;
      }
      case "whatIf": {
        const a = whatIf(graph, userId, input.stepId);
        answer = a;
        paths = a.data.blocked.map((b) => pathOf(b.chain));
        data = {
          failed: step(a.data.failed),
          stuck: a.data.blocked.map((b) => ({ ...step(b), chain: b.chain.map(link) })),
          waysOut: a.data.wayOuts.map(step),
          ...(a.data.blocked.length === 0 ? { note: "Nothing else on this traveller's route depends on this step." } : {}),
        };
        break;
      }
      case "whyCant": {
        const a = whyCant(graph, userId, input.stepId);
        answer = a;
        paths = a.data.missing.map((m) => pathOf(m.chain));
        data = {
          step: step(a.data.goal),
          alreadyDone: a.data.done,
          missing: a.data.missing.map((m) => ({ ...step(m), canStartNow: m.open, chain: m.chain.map(link) })),
          ...(a.data.missing.length === 0 && !a.data.done ? { note: "Every requirement is met: this step can be started now." } : {}),
        };
        break;
      }
      case "findCircles": {
        const a = findCircles(graph, userId);
        answer = a;
        paths = a.data.map((c) => pathOf([...c.links]));
        data = {
          circles: a.data.map((c) => ({
            loop: c.links.map(link),
            basis: c.allOfficial ? "official rules" : "includes common practice",
            affectsTraveller: c.affectsYou,
            alreadyEscaped: c.escaped,
            waysOut: c.wayOuts.map((w) => ({ ...step(w), how: w.how, done: w.done })),
          })),
          ...(a.data.length === 0 ? { note: "No circles for this profile." } : {}),
        };
        break;
      }
      case "getStep": {
        const a = getStep(graph, input.stepId);
        answer = a;
        const s = a.data;
        data = s
          ? {
              ...step(s), nameEs: s.nameEs, office: s.office, whatToBring: s.whatToBring,
              unverifiedReason: s.unverifiedReason, lastChecked: s.lastChecked,
              requires: s.requires.map((r) => ({ ...link(r), onlyForProfiles: r.profiles.length ? r.profiles : "all" })),
              requiredBy: s.requiredBy, wayOutFor: s.wayOutFor,
            }
          : { found: false, note: "This step is not in the graph." };
        break;
      }
      case "listProfiles": {
        const a = listProfiles(graph);
        answer = a;
        data = { profiles: a.data };
        break;
      }
    }
    return {
      ...base, input, ok: true, result: JSON.stringify(data), paths,
      sources: answer!.explain.sources, cypher: answer!.explain.cypher.trim(),
    };
  } catch (e) {
    return { ...base, input, ok: false, result: JSON.stringify({ error: `The graph query failed: ${e instanceof Error ? e.message : String(e)}` }) };
  }
}

