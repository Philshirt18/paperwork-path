// The assistant loop, in the browser. Ask the proxy for one model turn; if the
// model asks for tools, run them here against the user's own Relate graph and
// send only the results back. Repeat until it answers.
import type Anthropic from "@anthropic-ai/sdk";
import type { Graph } from "../graph/db.ts";
import type { PlanContext } from "./prompt.ts";
import { MAX_TURNS, type Mode } from "./request.ts";
import { runTool, type ToolRun } from "./tools.ts";

export type AgentFailure = "not_configured" | "rate_limited" | "budget" | "upstream_busy" | "upstream" | "bad_request" | "network";

export type AgentResult =
  | { status: "answered"; text: string; toolRuns: ToolRun[]; note?: string }
  | { status: "failed"; reason: AgentFailure; message?: string; toolRuns: ToolRun[] };

type TurnReply = { content: Anthropic.ContentBlock[]; stop_reason: Anthropic.Message["stop_reason"] };

async function oneTurn(body: object, signal?: AbortSignal): Promise<TurnReply | { error: AgentFailure; message?: string }> {
  let res: Response;
  try {
    res = await fetch("/api/agent", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal,
    });
  } catch (e) {
    if ((e as Error).name === "AbortError") throw e;
    return { error: "network" };
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return { error: (data.error as AgentFailure) ?? "upstream", message: data.message };
  return data as TurnReply;
}

const textOf = (content: Anthropic.ContentBlock[]) =>
  content.filter((b): b is Anthropic.TextBlock => b.type === "text").map((b) => b.text).join("\n\n").trim();

export async function askAgent(opts: {
  mode: Mode;
  question: string;
  context: PlanContext;
  graph: Graph;
  userId: string;
  onToolRun?: (runs: ToolRun[]) => void;
  signal?: AbortSignal;
}): Promise<AgentResult> {
  const messages: Anthropic.MessageParam[] = [{ role: "user", content: opts.question }];
  const toolRuns: ToolRun[] = [];

  for (let turn = 0; turn < MAX_TURNS; turn++) {
    const reply = await oneTurn({ mode: opts.mode, context: opts.context, messages }, opts.signal);
    if ("error" in reply) return { status: "failed", reason: reply.error, message: reply.message, toolRuns };

    const text = textOf(reply.content);
    if (reply.stop_reason === "refusal")
      return { status: "answered", text: text || "The assistant declined to answer this question.", toolRuns, note: "declined" };
    if (reply.stop_reason !== "tool_use")
      return {
        status: "answered",
        text: text || "The assistant gave no answer. Please try asking in a different way.",
        toolRuns,
        note: reply.stop_reason === "max_tokens" ? "cut_off" : undefined,
      };

    // Echo the model's turn back unchanged (thinking blocks included), then the results.
    messages.push({ role: "assistant", content: reply.content });
    const results: Anthropic.ToolResultBlockParam[] = [];
    for (const block of reply.content) {
      if (block.type !== "tool_use") continue;
      const run = runTool(opts.graph, opts.userId, block.id, block.name, block.input);
      toolRuns.push(run);
      results.push({ type: "tool_result", tool_use_id: block.id, content: run.result, ...(run.ok ? {} : { is_error: true }) });
    }
    opts.onToolRun?.([...toolRuns]);
    messages.push({ role: "user", content: results });
  }
  return {
    status: "answered",
    text: "The assistant needed more steps than allowed for one answer. Try a narrower question.",
    toolRuns,
    note: "too_many_steps",
  };
}
