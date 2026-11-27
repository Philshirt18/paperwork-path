"use client";
import type {
  Answer, Circle, DoNowItem, Explain, StationStatus, StepDetail, WhatIfResult, WhyCantResult,
} from "@/graph/queries.ts";
import type { Mode } from "./ModeBar";

type Props = {
  mode: Mode;
  step: Answer<StepDetail | null> | null;
  stepStatus?: StationStatus;
  isDemo: boolean;
  onDone: (id: string, done: boolean) => void;
  onClose: () => void;
  circles: Answer<Circle[]>;
  circleIndex: number;
  onCircle: (i: number) => void;
  whatIf: Answer<WhatIfResult> | null;
  why: Answer<WhyCantResult> | null;
  now: Answer<DoNowItem[]>;
  onSelect: (id: string) => void;
  names: Record<string, string>;
};

export function Drawer(p: Props) {
  return (
    <aside
      aria-label="Details"
      aria-live="polite"
      className="rounded-lg border border-rule bg-card xl:sticky xl:top-4 xl:max-h-[calc(100dvh-2rem)] xl:overflow-y-auto"
      data-tour="drawer"
    >
      <div className="p-5">
        {p.mode === "map" && p.step?.data ? (
          <StationPanel {...p} detail={p.step.data} explain={p.step.explain} />
        ) : p.mode === "map" ? (
          <RoutePanel now={p.now} />
        ) : p.mode === "circles" ? (
          <CirclePanel {...p} />
        ) : p.mode === "whatif" ? (
          <WhatIfPanel answer={p.whatIf} onSelect={p.onSelect} names={p.names} />
        ) : (
          <WhyPanel answer={p.why} onSelect={p.onSelect} names={p.names} />
        )}
      </div>
    </aside>
  );
}

// ---- Station details ----------------------------------------------------------

function StationPanel(p: Props & { detail: StepDetail; explain: Explain }) {
  const d = p.detail;
  const done = p.stepStatus === "done";
  return (
    <div className="fade-up" key={d.id}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="small-caps text-xs text-muted">{d.nameEs}</p>
          <h2 className="mt-0.5 font-serif text-[28px] leading-tight">{d.name}</h2>
        </div>
        <button onClick={p.onClose} className="btn-small" aria-label="Close details">Close</button>
      </div>

      {!d.verified && (
        <div className="mt-3 rounded-md border border-terracotta/40 bg-terracotta-soft/50 p-3 text-sm">
          <p className="font-semibold text-terracotta">Not yet verified</p>
          <p className="mt-0.5 text-ink-soft">{d.unverifiedReason}</p>
        </div>
      )}

      <dl className="mt-4 space-y-3 text-sm">
        <div>
          <dt className="eyebrow">Where</dt>
          <dd className="mt-0.5">{d.office}</dd>
        </div>
        {d.whatToBring.length > 0 && (
          <div>
            <dt className="eyebrow">What to bring</dt>
            <dd>
              <ul className="mt-1 list-disc space-y-1 pl-4 marker:text-muted">
                {d.whatToBring.map((w) => <li key={w}>{w}</li>)}
              </ul>
            </dd>
          </div>
        )}
        {d.requires.length > 0 && (
          <div>
            <dt className="eyebrow">Needs first</dt>
            <dd>
              <ul className="mt-1 space-y-2">
                {d.requires.map((r) => (
                  <li key={r.to} className="border-l-2 pl-3" style={{ borderColor: r.basis === "practice" ? "var(--color-rule)" : "var(--color-ink)" }}>
                    <button className="font-medium hover:underline" onClick={() => p.onSelect(r.to)}>{p.names[r.to] ?? r.to}</button>
                    {r.profiles.length > 0 && <span className="ml-1 text-xs text-muted">({r.profiles.join(", ")} only)</span>}
                    <p className="text-ink-soft">{r.why}</p>
                    <p className="text-xs text-muted">
                      {r.basis === "practice" ? "Common practice, not an official rule." : r.sourceUrl ? <SourceLink url={r.sourceUrl} title={r.sourceTitle} /> : "Our reading; no page cited."}
                    </p>
                  </li>
                ))}
              </ul>
            </dd>
          </div>
        )}
        {d.wayOutFor.length > 0 && (
          <div>
            <dt className="eyebrow !text-terracotta">Way out</dt>
            {d.wayOutFor.map((w) => <dd key={w.id} className="mt-0.5 text-ink-soft">{w.how}</dd>)}
          </div>
        )}
        {d.requiredBy.length > 0 && (
          <div>
            <dt className="eyebrow">Unlocks</dt>
            <dd className="mt-1 flex flex-wrap gap-1.5">
              {d.requiredBy.map((id) => (
                <button key={id} onClick={() => p.onSelect(id)} className="btn-small">{p.names[id] ?? id}</button>
              ))}
            </dd>
          </div>
        )}
      </dl>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <button onClick={() => p.onDone(d.id, !done)} className={done ? "btn-ghost" : "btn-primary"}>
          {done ? "Mark as not done" : "Mark as done"}
        </button>
        {p.isDemo && <span className="text-xs text-muted">Changes to Lena&apos;s demo aren&apos;t saved.</span>}
      </div>

      <HowWeKnow explain={p.explain} lead={d.lastChecked ? `Official source read on ${d.lastChecked}.` : "No official source for this step."} />
    </div>
  );
}

// ---- Route (nothing selected) ------------------------------------------------------

function RoutePanel({ now }: { now: Answer<DoNowItem[]> }) {
  return (
    <div className="fade-up">
      <p className="eyebrow">How to read the map</p>
      <h2 className="mt-1 font-serif text-[28px] leading-tight">Stations are steps. Lines are requirements.</h2>
      <p className="mt-2 text-sm text-ink-soft">
        A step sits to the right of everything it needs. Filled stations are stamped. A ringed dot is open now.
        Lines in terracotta form a circle: steps that wait for each other.
      </p>
      <p className="mt-3 text-sm text-ink-soft">
        &ldquo;Do this now&rdquo; is not a checklist someone wrote. It is a graph query: every step whose requirements
        for your profile are already met.
      </p>
      <HowWeKnow explain={now.explain} lead="The query behind “Do this now”, run on the Relate database in this tab." />
    </div>
  );
}

// ---- Circles ------------------------------------------------------------------------

function CirclePanel(p: Props) {
  const list = p.circles.data;
  if (list.length === 0) {
    return (
      <div className="fade-up">
        <p className="eyebrow">Circles</p>
        <h2 className="mt-1 font-serif text-[28px] leading-tight">No circles on your route.</h2>
        <p className="mt-2 text-sm text-ink-soft">Nothing in your requirements waits for itself. Follow “Do this now”.</p>
        <HowWeKnow explain={p.circles.explain} lead="The circle detector looks for paths that lead back to where they started." />
      </div>
    );
  }
  const c = list[p.circleIndex] ?? list[0];
  return (
    <div className="fade-up" key={p.circleIndex}>
      {list.length > 1 && (
        <div role="tablist" aria-label="Circles" className="mb-3 flex gap-1.5">
          {list.map((x, i) => (
            <button key={i} role="tab" aria-selected={i === p.circleIndex} onClick={() => p.onCircle(i)}
              className={`rounded-full px-3 py-1 text-xs font-medium ${i === p.circleIndex ? "bg-terracotta text-paper" : "bg-paper-deep text-ink-soft"}`}>
              Circle {i + 1}{x.allOfficial ? " · official" : " · practice"}
            </button>
          ))}
        </div>
      )}
      <p className="eyebrow !text-terracotta">{c.allOfficial ? "Created by the official rules" : "Created by common practice"}</p>
      <h2 className="mt-1 font-serif text-[28px] leading-tight">
        {c.stations[0].shortName} waits for {c.stations[1].shortName}
        {c.stations.length > 2 ? ", which waits for …" : ""}, which waits for {c.stations[0].shortName}.
      </h2>

      <ol className="mt-4 space-y-0">
        {c.links.map((l, i) => (
          <li key={i} className="relative border-l-2 border-terracotta pb-3 pl-4 last:pb-0">
            <span className="absolute -left-[7px] top-1 h-3 w-3 rounded-full border-2 border-terracotta bg-card" />
            <p className="text-sm">
              <strong>{name(c, l.from)}</strong> needs <strong>{name(c, l.to)}</strong>
              {l.basis === "practice" && <em className="text-muted"> (common practice)</em>}
            </p>
            <p className="text-sm text-ink-soft">{l.why}</p>
            {l.sourceUrl && <p className="text-xs"><SourceLink url={l.sourceUrl} title={l.sourceTitle} /></p>}
          </li>
        ))}
      </ol>

      {c.wayOuts.length > 0 ? (
        <div className="mt-4 rounded-md border border-ink/15 bg-paper p-3">
          <p className="eyebrow">The documented way out</p>
          {c.wayOuts.map((w) => (
            <div key={w.id} className="mt-1">
              <button onClick={() => p.onSelect(w.id)} className="font-medium hover:underline">{w.name}</button>
              {w.done && <span className="ml-2 rounded-full bg-olive-soft px-2 text-xs text-olive">done</span>}
              <p className="text-sm text-ink-soft">{w.how}</p>
              {w.sourceUrl && <p className="text-xs"><SourceLink url={w.sourceUrl} title={w.sourceTitle} /></p>}
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-4 text-sm text-ink-soft">No documented way out yet. Ask at the office and check the sources.</p>
      )}
      <HowWeKnow explain={p.circles.explain} lead="A path of REQUIRES links that returns to its start, keeping only links that apply to your profile." />
    </div>
  );
}

const name = (c: Circle, id: string) => c.stations.find((s) => s.id === id)?.shortName ?? id;

// ---- What if ------------------------------------------------------------------------

function WhatIfPanel({ answer, onSelect, names }: { answer: Answer<WhatIfResult> | null; onSelect: (id: string) => void; names: Record<string, string> }) {
  if (!answer) {
    return (
      <div className="fade-up">
        <p className="eyebrow">What if…</p>
        <h2 className="mt-1 font-serif text-[28px] leading-tight">Pick a station on the map.</h2>
        <p className="mt-2 text-sm text-ink-soft">
          A flat falls through. The bank says no. Pick the step that fails and the graph shows every step that gets stuck
          because of it, and through which chain.
        </p>
      </div>
    );
  }
  const d = answer.data;
  return (
    <div className="fade-up" key={d.failed.id}>
      <p className="eyebrow !text-terracotta">If this falls through</p>
      <h2 className="mt-1 font-serif text-[28px] leading-tight">{d.failed.name}</h2>
      {d.blocked.length === 0 ? (
        <p className="mt-3 text-sm text-ink-soft">
          Nothing else on your route is stuck. Either nothing needs it, or what needs it is already done or covered by a way out.
        </p>
      ) : (
        <>
          <p className="mt-2 text-sm">
            <strong>{d.blocked.length} {d.blocked.length === 1 ? "step is" : "steps are"} stuck</strong>, nearest first:
          </p>
          <ul className="mt-2 space-y-2">
            {d.blocked.map((b) => (
              <li key={b.id} className="rounded-md bg-terracotta-soft/45 px-3 py-2 text-sm">
                <button className="text-left font-medium hover:underline" onClick={() => onSelect(b.id)}>{b.name}</button>
                <p className="text-xs text-ink-soft">
                  {[...b.chain].reverse().map((l) => names[l.to] ?? l.to).join(" → ")} → {b.shortName}
                </p>
              </li>
            ))}
          </ul>
        </>
      )}
      {d.wayOuts.length > 0 && d.blocked.length > 0 && (
        <p className="mt-3 text-sm">
          <span className="font-semibold text-terracotta">Way out:</span>{" "}
          {d.wayOuts.map((w) => w.name).join(", ")} covers the steps that only need your NIE.
        </p>
      )}
      <HowWeKnow explain={answer.explain} lead="Every step that reaches the failed one through REQUIRES links, skipping what is already done." />
    </div>
  );
}

// ---- Why can't I ------------------------------------------------------------------------

function WhyPanel({ answer, onSelect, names }: { answer: Answer<WhyCantResult> | null; onSelect: (id: string) => void; names: Record<string, string> }) {
  if (!answer) {
    return (
      <div className="fade-up">
        <p className="eyebrow">Why can&apos;t I…</p>
        <h2 className="mt-1 font-serif text-[28px] leading-tight">Pick a goal.</h2>
        <p className="mt-2 text-sm text-ink-soft">We trace the chain of missing requirements from the goal down to what you can do today.</p>
      </div>
    );
  }
  const d = answer.data;
  const open = d.missing.filter((m) => m.open);
  return (
    <div className="fade-up" key={d.goal.id}>
      <p className="eyebrow">Why can&apos;t I get</p>
      <h2 className="mt-1 font-serif text-[28px] leading-tight">{d.goal.name}?</h2>
      {d.done ? (
        <p className="mt-3 text-sm text-olive">You already have it. Sellado.</p>
      ) : d.missing.length === 0 ? (
        <p className="mt-3 text-sm text-ink-soft">Nothing is missing. You can do it now.</p>
      ) : (
        <>
          <p className="mt-2 text-sm">
            {d.missing.length} missing {d.missing.length === 1 ? "step" : "steps"}.{" "}
            {open.length > 0
              ? <>Start with <strong>{open.map((m) => m.shortName).join(", ")}</strong>.</>
              : <strong className="text-terracotta">None can be started: they wait for each other. See Circles for the way out.</strong>}
          </p>
          <ul className="mt-3 space-y-2">
            {d.missing.map((m) => (
              <li key={m.id} className="text-sm">
                <div className="flex items-baseline gap-2">
                  <span className={`rounded-full px-2 py-px text-[11px] font-medium ${m.open ? "bg-ink text-paper" : "bg-paper-deep text-ink-soft"}`}>
                    {m.open ? "do now" : "blocked"}
                  </span>
                  <button className="text-left font-medium hover:underline" onClick={() => onSelect(m.id)}>{m.name}</button>
                </div>
                <p className="ml-1 mt-0.5 text-xs text-muted">
                  {d.goal.shortName} → {m.chain.map((l) => names[l.to] ?? l.to).join(" → ")}
                  {m.chain.some((l) => l.basis === "practice") && " (includes common practice)"}
                </p>
              </li>
            ))}
          </ul>
        </>
      )}
      <HowWeKnow explain={answer.explain} lead="Shortest chain of unmet requirements from the goal to each missing step." />
    </div>
  );
}

// ---- How we know --------------------------------------------------------------------------

export function HowWeKnow({ explain, lead }: { explain: Explain; lead: string }) {
  return (
    <details className="group mt-6 border-t border-rule pt-4" data-tour="how">
      <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-semibold">
        How we know
        <span className="text-xs font-normal text-muted group-open:hidden">Show query and sources</span>
        <span className="hidden text-xs font-normal text-muted group-open:inline">Hide</span>
      </summary>
      <p className="mt-2 text-xs text-ink-soft">{lead}</p>
      {explain.sources.length > 0 && (
        <div className="mt-3">
          <p className="eyebrow">Official sources</p>
          <ul className="mt-1 space-y-1 text-xs">
            {explain.sources.map((s) => <li key={s.url}><SourceLink url={s.url} title={s.title} /></li>)}
          </ul>
        </div>
      )}
      <p className="eyebrow mt-3">Cypher, run on Relate in your browser</p>
      <pre className="mt-1 max-h-72 overflow-auto rounded-md bg-ink p-3 font-mono text-[11px] leading-relaxed text-[#e9e2d0]">
        <code>{explain.cypher}</code>
      </pre>
      {Object.keys(explain.params).length > 0 && (
        <p className="mt-1 font-mono text-[11px] text-muted">params: {JSON.stringify(explain.params)}</p>
      )}
    </details>
  );
}

function SourceLink({ url, title }: { url: string; title: string | null }) {
  return (
    <a href={url} target="_blank" rel="noreferrer" className="text-ink underline decoration-rule underline-offset-2 hover:decoration-ink">
      {title ?? url}
      <span className="sr-only"> (opens official page in a new tab)</span>
    </a>
  );
}
