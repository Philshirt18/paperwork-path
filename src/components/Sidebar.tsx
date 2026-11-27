"use client";
import type { Answer, Circle, DoNowItem, MapView, ProfileSummary } from "@/graph/queries.ts";
import { PROFILE_COLOR } from "./MetroMap";
import demoUser from "../../data/demo-user.json";

type Props = {
  isDemo: boolean;
  userId: string;
  view: MapView;
  profiles: ProfileSummary[];
  now: Answer<DoNowItem[]>;
  circles: Circle[];
  onProfile: (id: string) => void;
  onDone: (id: string, done: boolean) => void;
  onSelect: (id: string) => void;
  onShowCircle: (index: number) => void;
};

export function Sidebar(p: Props) {
  const stations = p.view.stations.filter((s) => s.status !== "not_needed" && !(s.isWayOut && s.status !== "done"));
  const done = stations.filter((s) => s.status === "done").length;
  const stuck = p.circles.map((c, i) => ({ c, i })).filter(({ c }) => c.affectsYou && !c.escaped);
  const escaped = p.circles.map((c, i) => ({ c, i })).filter(({ c }) => c.affectsYou && c.escaped);
  const profile = p.profiles.find((x) => x.id === p.view.profile);

  return (
    <aside className="space-y-5 lg:sticky lg:top-4 lg:self-start" aria-label="You and your next steps">
      {/* Who */}
      <section className="rounded-lg border border-rule bg-card p-4">
        <p className="eyebrow">{p.isDemo ? "Demo traveller" : "Your plan"}</p>
        {p.isDemo ? (
          <>
            <p className="mt-1 font-serif text-3xl leading-tight">{demoUser.name}</p>
            <p className="text-sm text-ink-soft">{demoUser.tagline}. Fictional.</p>
          </>
        ) : (
          <p className="mt-1 font-serif text-3xl leading-tight">You</p>
        )}

        <fieldset className="mt-4">
          <legend className="eyebrow mb-2">Profile</legend>
          <div className="grid gap-1.5">
            {p.profiles.map((pr) => {
              const on = pr.id === p.view.profile;
              return (
                <label key={pr.id}
                  className={`flex cursor-pointer items-center gap-3 rounded-md border px-3 py-2 text-sm transition-colors ${on ? "border-ink bg-paper" : "border-transparent hover:bg-paper-deep"}`}>
                  <input type="radio" name="profile" className="sr-only" checked={on} onChange={() => p.onProfile(pr.id)} />
                  <span aria-hidden className="h-2.5 w-6 rounded-full" style={{ background: PROFILE_COLOR[pr.id] }} />
                  <span className="flex-1">{pr.name}</span>
                  <span className="small-caps text-[11px] text-muted">{pr.nameEs}</span>
                </label>
              );
            })}
          </div>
          {p.isDemo && <p className="mt-2 text-xs text-muted">Changing the profile starts your own plan.</p>}
        </fieldset>

        <div className="mt-4">
          <div className="flex items-baseline justify-between text-sm">
            <span className="text-ink-soft">Stamped</span>
            <span className="font-semibold tabular-nums">{done} of {stations.length}</span>
          </div>
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-paper-deep" role="progressbar"
            aria-valuemin={0} aria-valuemax={stations.length} aria-valuenow={done} aria-label="Steps done">
            <div className="h-full rounded-full bg-olive transition-[width] duration-300" style={{ width: `${(done / Math.max(1, stations.length)) * 100}%` }} />
          </div>
          {profile && <p className="mt-2 text-xs text-muted">Goals: {profile.goals.map((g) => p.view.stations.find((s) => s.id === g)?.shortName).filter(Boolean).join(" · ")}</p>}
        </div>
      </section>

      {/* Circle alert */}
      {stuck.length > 0 && (
        <section className="fade-up rounded-lg border border-terracotta/40 bg-terracotta-soft/60 p-4" data-tour="circle-card">
          <p className="eyebrow !text-terracotta">Circle detected</p>
          <p className="mt-1 font-serif text-2xl leading-tight">
            {stuck.length === 1 ? "You're in a circle." : `You're in ${stuck.length} circles.`}
          </p>
          <ul className="mt-2 space-y-2">
            {stuck.map(({ c, i }) => (
              <li key={i}>
                <button onClick={() => p.onShowCircle(i)} className="w-full text-left text-sm hover:underline">
                  {c.stations.map((s) => s.shortName).join(" → ")} → …
                  <span className="ml-1 text-xs text-muted">({c.allOfficial ? "official rules" : "common practice"})</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {stuck.length === 0 && escaped.length > 0 && (
        <section className="fade-up rounded-lg border border-olive/40 bg-olive-soft/60 p-4">
          <p className="eyebrow !text-olive">Way out taken</p>
          <p className="mt-1 font-serif text-2xl leading-tight">You&apos;re out of the circle.</p>
          <p className="mt-1 text-sm text-ink-soft">
            The loop is still in the rules, but your NIE number covers the steps inside it.{" "}
            <button className="underline" onClick={() => p.onShowCircle(escaped[0].i)}>See the circle</button>
          </p>
        </section>
      )}

      {/* Do this now */}
      <section className="rounded-lg border border-rule bg-card p-4" data-tour="now" aria-labelledby="now-h">
        <div className="flex items-baseline justify-between">
          <h2 id="now-h" className="font-serif text-2xl">Do this now</h2>
          <span className="text-xs text-muted">{p.now.data.length} open</span>
        </div>
        {p.now.data.length === 0 ? (
          <p className="mt-3 text-sm text-ink-soft">
            {done === stations.length
              ? "Every step on your route is stamped. Enhorabuena."
              : "Nothing can be started right now. Check the circles above for a way out."}
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-rule">
            {p.now.data.map((s) => (
              <li key={s.id} className="flex items-start gap-3 py-2.5">
                <span aria-hidden className={`mt-1.5 h-2.5 w-2.5 shrink-0 ${s.isWayOut ? "rotate-45 rounded-[2px] border-2 border-terracotta" : "rounded-full border-[3px] border-ink"}`} />
                <div className="min-w-0 flex-1">
                  <button onClick={() => p.onSelect(s.id)} className="text-left text-sm font-medium leading-snug hover:underline">
                    {s.name}
                  </button>
                  <p className="small-caps text-[11px] text-muted">{s.nameEs}</p>
                  {s.isWayOut && <p className="mt-0.5 text-xs text-terracotta">Way out of a circle</p>}
                  {!s.verified && <p className="mt-0.5 text-xs text-terracotta">Not yet verified, check the source</p>}
                </div>
                <button onClick={() => p.onDone(s.id, true)} className="btn-small shrink-0" aria-label={`Mark ${s.name} as done`}>
                  Done
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </aside>
  );
}
