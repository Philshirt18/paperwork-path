// Builds the exact request the proxy sends to Claude. The browser can only
// choose the mode, send the question (and, in "with graph" mode, the tool loop
// so far) and its plan context as known ids. Model, prompt, tools and limits
// are fixed here on the server.
import type Anthropic from "@anthropic-ai/sdk";
import { GRAPH_RULES, MODEL, checkContext, systemPrompt } from "./prompt.ts";
import { TOOLS } from "./tools.ts";

export type Mode = "graph" | "plain";
export const MAX_QUESTION = 500;
/** Model turns allowed in one "with graph" answer (each turn may call several tools). */
export const MAX_TURNS = 6;
const MAX_BODY = 120_000;
const MAX_TOOL_RESULT = 20_000;

export type AgentBody = { mode: Mode; context: unknown; messages: Anthropic.MessageParam[] };

type Fail = { ok: false; message: string };
type Built = { ok: true; params: Anthropic.MessageCreateParamsNonStreaming };

const ASSISTANT_BLOCKS = new Set(["text", "thinking", "redacted_thinking", "tool_use"]);

export function buildRequest(raw: unknown, rawSize: number): Built | Fail {
  const fail = (message: string): Fail => ({ ok: false, message });
  if (rawSize > MAX_BODY) return fail("Request too large.");
  const body = raw as Partial<AgentBody> | null;
  if (!body || (body.mode !== "graph" && body.mode !== "plain")) return fail("Unknown mode.");
  const ctx = checkContext(body.context);
  if (!ctx) return fail("Unknown plan context.");
  const msgs = body.messages;
  if (!Array.isArray(msgs) || msgs.length === 0) return fail("No question.");

  const [first, ...rest] = msgs;
  if (first?.role !== "user" || typeof first.content !== "string") return fail("The first message must be the question.");
  const question = first.content.trim();
  if (!question) return fail("The question is empty.");
  if (question.length > MAX_QUESTION) return fail(`Please keep the question under ${MAX_QUESTION} characters.`);

  if (body.mode === "plain" && rest.length > 0) return fail("Without the graph there is one question and one answer.");
  if (rest.length > MAX_TURNS * 2) return fail("Too many steps for one answer.");

  // The rest must alternate: assistant turn (from Claude, echoed back unchanged), then tool results.
  for (let i = 0; i < rest.length; i++) {
    const m = rest[i];
    const expect = i % 2 === 0 ? "assistant" : "user";
    if (m?.role !== expect || !Array.isArray(m.content) || m.content.length === 0) return fail("Malformed conversation.");
    if (expect === "assistant") {
      if (!m.content.every((b) => b && ASSISTANT_BLOCKS.has((b as { type: string }).type))) return fail("Malformed assistant turn.");
    } else {
      for (const b of m.content) {
        const r = b as Anthropic.ToolResultBlockParam;
        if (r?.type !== "tool_result" || typeof r.tool_use_id !== "string") return fail("Only tool results can follow a tool call.");
        if (typeof r.content !== "string" || r.content.length > MAX_TOOL_RESULT) return fail("Tool result too large.");
      }
    }
  }
  if (rest.length % 2 === 1) return fail("A tool call is waiting for its result.");

  const system = systemPrompt(ctx) + (body.mode === "graph" ? GRAPH_RULES : "");
  return {
    ok: true,
    params: {
      model: MODEL,
      max_tokens: 4096,
      // Same model, effort and prompt in both modes; only the tools differ.
      output_config: { effort: "low" },
      system,
      messages: [{ role: "user", content: question }, ...rest],
      ...(body.mode === "graph" ? { tools: TOOLS } : {}),
    },
  };
}
