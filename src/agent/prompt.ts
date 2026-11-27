// The assistant's instructions. Both modes ("without graph" and "with graph")
// get exactly the same system prompt, including the traveller's profile and
// what they have marked done. The only difference: "with graph" also gets the
// tools, plus the rules for using them. That keeps the comparison fair.
import steps from "../../data/steps.json" with { type: "json" };
import profiles from "../../data/profiles.json" with { type: "json" };

export const MODEL = "claude-haiku-5-5";

export type PlanContext = { profile: string; completed: string[] };

/** Accept only known ids, so nothing free-form from the browser reaches the prompt. */
export function checkContext(raw: unknown): PlanContext | null {
  const c = raw as Partial<PlanContext> | null;
  if (!c || typeof c !== "object") return null;
  if (typeof c.profile !== "string" || !profiles.some((p) => p.id === c.profile)) return null;
  if (!Array.isArray(c.completed) || c.completed.length > steps.length) return null;
  const ids = new Set(steps.map((s) => s.id));
  if (!c.completed.every((x) => typeof x === "string" && ids.has(x))) return null;
  return { profile: c.profile, completed: [...new Set(c.completed)] };
}

export function systemPrompt(ctx: PlanContext): string {
  const profile = profiles.find((p) => p.id === ctx.profile)!;
  const done = ctx.completed.map((id) => steps.find((s) => s.id === id)!.shortName);
  return `You help EU citizens who are moving to Málaga, Spain, with the paperwork: residence registration, town hall registration, tax and Social Security.

The traveller
- Profile: ${profile.name} (${profile.nameEs}).
- Already done: ${done.length ? done.join(", ") : "nothing yet"}.

How to answer
- Answer the traveller's question directly, in plain English, in at most about 150 words.
- Use short paragraphs or a short numbered list. Plain text only: no Markdown headings, bold or tables.
- Be accurate. If you are not sure about something, say so. Do not make up fees, waiting times, deadlines or web addresses.
- Rules vary by province and change over time; when it matters, tell the traveller to check the official source.
- This is a simplified guide, not legal advice.`;
}

/** Added only in "with graph" mode, together with the tools. */
export const GRAPH_RULES = `

Tools
You have tools that query this traveller's own plan in a graph database of official Spanish requirements. Each result includes the official sources behind it.
- Answer only from tool results. Call the tools you need before answering; you can call several.
- If the tools do not cover the question, say plainly that the graph has no answer for it, and do not fill the gap from your own knowledge.
- When a result marks a step or link as not verified, or as common practice rather than an official rule, say so.
- Name the step names the tools return. Mention which official page backs the key point (by its title or site), not a long list.`;
