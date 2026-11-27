"use client";
// "Ask in your own words". The model only picks from six fixed graph tools;
// they run here, in this tab, against your own plan. Every call is shown.
// The compare switch runs the same model and prompt without the tools.
import { useEffect, useRef, useState } from "react";
import type { Graph } from "@/graph/db.ts";
import { completedSteps } from "@/graph/plan.ts";
import { askAgent, type AgentFailure, type AgentResult } from "@/agent/client.ts";
import { MAX_QUESTION } from "@/agent/request.ts";
import type { ToolRun } from "@/agent/tools.ts";
import { SourceLink } from "./Drawer";

const VIDEO_URL = process.env.NEXT_PUBLIC_DEMO_VIDEO_URL || null;

const SUGGESTIONS = [
  "What should I do first?",
  "Why can't I register as self-employed yet?",
  "What happens if my EU certificate is refused?",
  "How much does the NIE cost?",
];

const TOOL_LABEL: Record<ToolRun["name"], string> = {
  doThisNow: "Do this now",
  whatIf: "What if…",
  whyCant: "Why can't I…",
  findCircles: "Find circles",
  getStep: "Look up step",
  listProfiles: "List profiles",
};

type Run = { status: "idle" } | { status: "running"; toolRuns: ToolRun[] } | { status: "done"; result: AgentResult };

type Props = {
  graph: Graph;
  userId: string;
  profile: string;
  who: string;
  names: Record<string, string>;
  onShow: (run: ToolRun) => void;
};

export function AgentPanel(p: Props) {
  const [available, setAvailable] = useState<"checking" | "yes" | "no">("checking");
  const [question, setQuestion] = useState("");
  const [compare, setCompare] = useState(false);
  const [asked, setAsked] = useState<{ q: string; who: string; compare: boolean } | null>(null);
  const [withGraph, setWithGraph] = useState<Run>({ status: "idle" });
  const [without, setWithout] = useState<Run>({ status: "idle" });
  const abort = useRef<AbortController | null>(null);

  useEffect(() => {
    let live = true;
    fetch("/api/agent")
      .then((r) => r.json())
      .then((d) => live && setAvailable(d.configured ? "yes" : "no"))
      .catch(() => live && setAvailable("no"));
    return () => {
      live = false;
      abort.current?.abort();
    };
  }, []);

  const busy = withGraph.status === "running" || without.status === "running";

  const ask = async (q: string) => {
    const text = q.trim();
    if (!text || busy) return;
    abort.current?.abort();
    const ctl = new AbortController();
    abort.current = ctl;
    const context = { profile: p.profile, completed: completedSteps(p.graph, p.userId) };
    const common = { question: text, context, graph: p.graph, userId: p.userId, signal: ctl.signal };
    setAsked({ q: text, who: p.who, compare });
    setWithGraph({ status: "running", toolRuns: [] });
    setWithout(compare ? { status: "running", toolRuns: [] } : { status: "idle" });

    const run = (mode: "graph" | "plain", set: (r: Run) => void) =>
      askAgent({ ...common, mode, onToolRun: (toolRuns) => set({ status: "running", toolRuns }) })
        .then((result) => !ctl.signal.aborted && set({ status: "done", result }))
        .catch((e) => {
          if ((e as Error).name !== "AbortError") set({ status: "done", result: { status: "failed", reason: "network", toolRuns: [] } });
        });
    await Promise.all([run("graph", setWithGraph), compare ? run("plain", setWithout) : Promise.resolve()]);
  };

  return (
    <section className="mt-6 rounded-lg border border-rule bg-card p-4 sm:p-5" aria-labelledby="agent-h" data-tour="agent">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="agent-h" className="font-serif text-2xl sm:text-3xl">Ask in your own words</h2>
        <p className="text-xs text-muted">Answers only from the graph, with every query shown</p>
      </div>

      {available === "checking" && <p className="mt-3 text-sm text-muted" role="status">Checking whether the assistant is available…</p>}

      {available === "no" && (
        <div className="mt-3 rounded-md border border-rule bg-paper p-4 text-sm">
          <p className="font-medium">The assistant is switched off on this copy of the app.</p>
          <p className="mt-1 text-ink-soft">
            It needs an Anthropic API key on the server, and none is set here. Everything else on this page works without it:
            the map, the circles, “What if…” and “Why can&apos;t I…” all run in your browser.
          </p>
          <VideoLine prefix="You can see the assistant at work in the demo video." />
        </div>
      )}

      {available === "yes" && (
        <>
          <form
            className="mt-3"
            onSubmit={(e) => {
              e.preventDefault();
              ask(question);
            }}
          >
            <label htmlFor="agent-q" className="sr-only">Your question</label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                id="agent-q"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                maxLength={MAX_QUESTION}
                placeholder="e.g. Can I get my town hall registration before the EU certificate?"
                className="min-w-0 flex-1 rounded-full border border-rule bg-paper px-4 py-2 text-sm placeholder:text-muted focus:border-ink focus:outline-none"
              />
              <button type="submit" className="btn-primary justify-center disabled:opacity-50" disabled={busy || !question.trim()}>
                {busy ? "Asking…" : "Ask"}
              </button>
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5" aria-label="Example questions">
              {SUGGESTIONS.map((s) => (
                <button key={s} type="button" className="btn-small disabled:opacity-50" disabled={busy}
                  onClick={() => {
                    setQuestion(s);
                    ask(s);
                  }}>
                  {s}
                </button>
              ))}
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
              <label className="inline-flex cursor-pointer items-center gap-2 text-sm">
                <input type="checkbox" className="peer sr-only" checked={compare} onChange={(e) => setCompare(e.target.checked)} />
                <span aria-hidden className="relative h-5 w-9 rounded-full bg-paper-deep transition-colors peer-checked:bg-ink peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ink after:absolute after:left-0.5 after:top-0.5 after:h-4 after:w-4 after:rounded-full after:bg-card after:shadow after:transition-transform peer-checked:after:translate-x-4" />
                Compare side by side: without graph / with graph
              </label>
              <p className="text-xs text-muted">Questions to the assistant are sent to Anthropic. Your plan stays in your browser.</p>
            </div>
          </form>

          {asked && (
            <div className="mt-5 border-t border-rule pt-4">
              <p className="text-sm">
                <span className="text-muted">Asked for {asked.who}: </span>
                <span className="font-medium">“{asked.q}”</span>
              </p>
              <div className={`mt-3 grid gap-4 ${asked.compare ? "lg:grid-cols-2" : ""}`}>
                {asked.compare && (
                  <AnswerCard title="Without graph" lead="Same model, same prompt, no tools. Not checked against anything." run={without} graphMode={false} {...p} retry={() => ask(asked.q)} />
                )}
                <AnswerCard title={asked.compare ? "With graph" : "Answer"} lead="Built only from the graph tools below, run on Relate in your browser." run={withGraph} graphMode {...p} retry={() => ask(asked.q)} />
              </div>
              {asked.compare && (
                <p className="mt-3 text-xs text-muted">
                  How this comparison is fair: both sides use {"Claude Haiku 5.5"}, the same system prompt with your profile and finished
                  steps, and the same question. The graph side also gets the six tools and a short note on how to use them.
                </p>
              )}
            </div>
          )}
        </>
      )}
    </section>
  );
}

function AnswerCard(props: Props & { title: string; lead: string; run: Run; graphMode: boolean; retry: () => void }) {
  const { run, graphMode } = props;
  const toolRuns = run.status === "running" ? run.toolRuns : run.status === "done" ? run.result.toolRuns : [];
  return (
    <article className={`min-w-0 rounded-md border p-4 ${graphMode ? "border-ink/30 bg-paper" : "border-rule bg-paper/50"}`} aria-busy={run.status === "running"}>
      <p className="eyebrow">{props.title}</p>
      <p className="mt-0.5 text-xs text-muted">{props.lead}</p>

      {run.status === "running" && (
        <p className="mt-3 text-sm text-ink-soft" role="status">
          {graphMode ? (toolRuns.length ? `Ran ${toolRuns.length} graph ${toolRuns.length === 1 ? "query" : "queries"}, writing the answer…` : "Choosing which graph queries to run…") : "Writing the answer…"}
        </p>
      )}

      {run.status === "done" && run.result.status === "failed" && <Failure reason={run.result.reason} message={run.result.message} retry={props.retry} />}

      {run.status === "done" && run.result.status === "answered" && (
        <div className="mt-3">
          <p className="whitespace-pre-line text-[15px] leading-relaxed">{run.result.text}</p>
          {run.result.note === "cut_off" && <p className="mt-2 text-xs text-terracotta">The answer was cut off because it ran too long.</p>}
          {graphMode && toolRuns.length === 0 && (
            <p className="mt-3 text-xs text-terracotta">No graph query was run for this answer, so nothing in it comes from the graph.</p>
          )}
        </div>
      )}

      {graphMode && toolRuns.length > 0 && <ToolCalls runs={toolRuns} names={props.names} onShow={props.onShow} />}
    </article>
  );
}

function ToolCalls({ runs, names, onShow }: { runs: ToolRun[]; names: Record<string, string>; onShow: (r: ToolRun) => void }) {
  return (
    <div className="mt-4 border-t border-rule pt-3">
      <p className="eyebrow">Tool calls ({runs.length})</p>
      <ol className="mt-2 space-y-3">
        {runs.map((r) => (
          <li key={r.id} className="fade-up text-sm">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <code className="rounded bg-ink px-1.5 py-0.5 font-mono text-[11px] text-paper">{r.name}</code>
              <span className="text-xs text-muted">{TOOL_LABEL[r.name]}</span>
              {r.input.stepId && <span className="font-mono text-[11px] text-ink-soft">stepId: {r.input.stepId} ({names[r.input.stepId] ?? "not on this route"})</span>}
              {!r.ok && <span className="text-xs text-terracotta">failed</span>}
              {r.ok && r.name !== "listProfiles" && (
                <button className="ml-auto text-xs underline underline-offset-2" onClick={() => onShow(r)}>Show on map</button>
              )}
            </div>
            {r.paths.filter((x) => x.names.length).length > 0 && (
              <ul className="mt-1.5 space-y-1">
                {r.paths.filter((x) => x.names.length).slice(0, 6).map((path, i) => (
                  <li key={i} className="font-mono text-[11px] leading-relaxed text-ink-soft">
                    {path.names.map((n, k) => (
                      <span key={k}>
                        {k > 0 && <span className={path.basis[k - 1] === "practice" ? "text-muted" : "text-terracotta"}>{path.basis[k - 1] === "practice" ? " ~> " : " → "}</span>}
                        {n}
                      </span>
                    ))}
                  </li>
                ))}
                {r.paths.some((x) => x.basis.includes("practice")) && <li className="font-mono text-[11px] text-muted">~&gt; common practice, not an official rule</li>}
              </ul>
            )}
            {r.sources.length > 0 && (
              <p className="mt-1 text-xs text-ink-soft">
                Sources:{" "}
                {r.sources.slice(0, 4).map((s, i) => (
                  <span key={s.url}>{i > 0 && " · "}<SourceLink url={s.url} title={s.title} /></span>
                ))}
                {r.sources.length > 4 && ` and ${r.sources.length - 4} more`}
              </p>
            )}
            <details className="mt-1">
              <summary className="cursor-pointer text-xs text-muted">Cypher and returned data</summary>
              <pre className="mt-1 max-h-56 overflow-auto rounded-md bg-ink p-2.5 font-mono text-[11px] leading-relaxed text-[#e9e2d0]"><code>{r.cypher || "(no query ran)"}</code></pre>
              <pre className="mt-1 max-h-40 overflow-auto rounded-md bg-paper-deep p-2.5 font-mono text-[11px] text-ink-soft"><code>{r.result}</code></pre>
            </details>
          </li>
        ))}
      </ol>
    </div>
  );
}

const FAILURE_TEXT: Record<AgentFailure, string> = {
  not_configured: "The assistant is switched off on this copy of the app.",
  rate_limited: "You've asked a lot of questions in a short time. Please take a break and try again in a little while.",
  budget: "The assistant has used up today's budget for this public demo. It will be back tomorrow.",
  upstream_busy: "The assistant service is busy right now. Please try again in a minute.",
  upstream: "The assistant service had a problem.",
  bad_request: "This question could not be sent.",
  network: "Could not reach the server. Check your connection.",
};

function Failure({ reason, message, retry }: { reason: AgentFailure; message?: string; retry: () => void }) {
  const limited = reason === "rate_limited" || reason === "budget" || reason === "not_configured";
  return (
    <div className="mt-3 rounded-md border border-terracotta/30 bg-terracotta-soft/40 p-3 text-sm" role="alert">
      <p>{FAILURE_TEXT[reason]}</p>
      {reason === "bad_request" && message && <p className="mt-1 text-ink-soft">{message}</p>}
      <p className="mt-1 text-ink-soft">The rest of the app keeps working: the map, circles, “What if…” and “Why can&apos;t I…” run in your browser.</p>
      {limited ? <VideoLine prefix="Meanwhile, the demo video shows the assistant at work." /> : (
        <button className="btn-small mt-2" onClick={retry}>Try again</button>
      )}
    </div>
  );
}

function VideoLine({ prefix }: { prefix: string }) {
  return VIDEO_URL ? (
    <p className="mt-2 text-sm">
      {prefix}{" "}
      <a href={VIDEO_URL} target="_blank" rel="noreferrer" className="font-medium underline underline-offset-2">Watch the demo video</a>
    </p>
  ) : (
    <p className="mt-2 text-sm text-ink-soft">{prefix} It is linked from the project README.</p>
  );
}
