"use client";
// The whole app on one page: left = who you are + "Do this now",
// centre = the metro map (or list), right = details and "How we know".
// Every answer comes from a Cypher query over the Relate graph in this tab.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useGraph } from "@/lib/useGraph";
import { doThisNow, findCircles, getStep, listProfiles, mapView, whatIf, whyCant } from "@/graph/queries.ts";
import { edgeKey, shapeKey, type MapLayout } from "@/lib/layout";
import { getLayout } from "@/lib/prelaid";
import { MetroMap, type Highlight } from "./MetroMap";
import { Header } from "./Header";
import { Sidebar } from "./Sidebar";
import { Drawer } from "./Drawer";
import { ListView } from "./ListView";
import { ModeBar, type Mode } from "./ModeBar";
import { Tour, type TourTarget } from "./Tour";
import { Legend } from "./Legend";
import { AgentPanel } from "./AgentPanel";
import type { ToolRun } from "@/agent/tools.ts";

export function App() {
  const api = useGraph();
  const s = api.state;
  const [mode, setMode] = useState<Mode>("map");
  const [selected, setSelected] = useState<string | null>(null);
  const [whatIfStep, setWhatIfStep] = useState<string | null>(null);
  const [whyGoal, setWhyGoal] = useState<string | null>(null);
  const [circleIndex, setCircleIndex] = useState(0);
  const [display, setDisplay] = useState<"map" | "list">("map");
  const [layout, setLayout] = useState<MapLayout | null>(null);
  const [layoutError, setLayoutError] = useState<string | null>(null);
  const [tourOn, setTourOn] = useState(false);
  const drawerRef = useRef<HTMLDivElement>(null);

  // ---- Answers from the graph (recomputed whenever the plan changes) ----
  const ready = s.status === "ready" ? s : null;
  const view = useMemo(() => (ready ? mapView(ready.graph, ready.userId) : null), [ready]);
  const now = useMemo(() => (ready ? doThisNow(ready.graph, ready.userId) : null), [ready]);
  const circles = useMemo(() => (ready ? findCircles(ready.graph, ready.userId) : null), [ready]);
  const profiles = useMemo(() => (ready ? listProfiles(ready.graph).data : []), [ready]);
  const whatIfAnswer = useMemo(
    () => (ready && whatIfStep ? whatIf(ready.graph, ready.userId, whatIfStep) : null),
    [ready, whatIfStep],
  );
  const whyAnswer = useMemo(
    () => (ready && whyGoal ? whyCant(ready.graph, ready.userId, whyGoal) : null),
    [ready, whyGoal],
  );
  const stepAnswer = useMemo(() => (ready && selected ? getStep(ready.graph, selected) : null), [ready, selected]);

  // Layout only depends on which stations and lines exist, not on their status.
  const shape = view ? shapeKey(view.data) : "";
  useEffect(() => {
    if (!view) return;
    let live = true;
    getLayout(view.data)
      .then((l) => live && (setLayout(l), setLayoutError(null)))
      .catch((e) => live && setLayoutError(String(e)));
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shape]);

  // Profile switch or goal change can make a remembered choice disappear.
  useEffect(() => {
    if (!view) return;
    const ids = new Set(view.data.stations.map((x) => x.id));
    if (selected && !ids.has(selected)) setSelected(null);
    if (whatIfStep && !ids.has(whatIfStep)) setWhatIfStep(null);
    if (whyGoal && !ids.has(whyGoal)) setWhyGoal(null);
    if (circles && circleIndex >= circles.data.length) setCircleIndex(0);
  }, [view, circles, selected, whatIfStep, whyGoal, circleIndex]);

  // First visit: offer the 30-second tour once.
  useEffect(() => {
    if (s.status !== "ready") return;
    try {
      if (!window.localStorage.getItem("paperwork-path:toured") && s.isDemo) setTourOn(true);
    } catch {
      /* storage blocked: skip the automatic tour */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.status]);

  // ---- Highlight on the map for the current question ----
  const circleEdges = useMemo(() => {
    const set = new Set<string>();
    circles?.data.forEach((c) => c.links.forEach((l) => set.add(edgeKey(l.from, l.to))));
    return set;
  }, [circles]);

  const highlight: Highlight | null = useMemo(() => {
    if (mode === "circles" && circles?.data[circleIndex]) {
      const c = circles.data[circleIndex];
      return {
        id: `c${circleIndex}-${ready?.version}`,
        tone: "circle",
        stations: new Set(c.stations.map((x) => x.id)),
        edges: new Set(c.links.map((l) => edgeKey(l.from, l.to))),
        wayOuts: new Set(c.wayOuts.map((w) => w.id)),
      };
    }
    if (mode === "whatif" && whatIfAnswer) {
      const d = whatIfAnswer.data;
      return {
        id: `w${whatIfStep}-${ready?.version}`,
        tone: "whatif",
        focus: d.failed.id,
        stations: new Set(d.blocked.map((b) => b.id)),
        edges: new Set(d.blocked.flatMap((b) => b.chain.map((l) => edgeKey(l.from, l.to)))),
        wayOuts: new Set(d.wayOuts.map((w) => w.id)),
      };
    }
    if (mode === "why" && whyAnswer) {
      const d = whyAnswer.data;
      return {
        id: `y${whyGoal}-${ready?.version}`,
        tone: "why",
        focus: d.goal.id,
        stations: new Set(d.missing.map((m) => m.id)),
        edges: new Set(d.missing.flatMap((m) => m.chain.map((l) => edgeKey(l.from, l.to)))),
      };
    }
    return null;
  }, [mode, circles, circleIndex, whatIfAnswer, whatIfStep, whyAnswer, whyGoal, ready?.version]);

  // ---- Interaction ----
  // On narrow screens the details sit below the map: bring them into view.
  const revealDetails = () => {
    if (window.innerWidth < 1280 && !tourOn)
      requestAnimationFrame(() => drawerRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };
  const onStation = useCallback(
    (id: string) => {
      revealDetails();
      if (mode === "whatif") setWhatIfStep((cur) => (cur === id ? null : id));
      else if (mode === "why") setWhyGoal(id);
      else setSelected(id);
      if (mode !== "map") setSelected(null);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [mode, tourOn],
  );

  const changeMode = (m: Mode) => {
    setMode(m);
    setSelected(null);
    if (m === "why" && !whyGoal && view) {
      // Start with the first goal that isn't done yet.
      const g = view.data.stations.find((x) => x.isGoal && x.status !== "done");
      setWhyGoal(g?.id ?? null);
    }
  };

  const tourGo = (t: TourTarget) => {
    setDisplay("map");
    if (t === "circle") {
      changeMode("circles");
      setCircleIndex(0);
    }
    if (t === "whatif") {
      setMode("whatif");
      setSelected(null);
      setWhatIfStep("eu_certificate");
    }
    if (t === "why") {
      setMode("why");
      setSelected(null);
      setWhyGoal("reta");
    }
    if (t === "agent") {
      changeMode("map");
      requestAnimationFrame(() => document.querySelector('[data-tour="agent"]')?.scrollIntoView({ behavior: "smooth", block: "center" }));
    }
    if (t === "now") {
      changeMode("map");
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  // "Show on map" from the assistant: open the same question in the map.
  const showToolRun = (r: ToolRun) => {
    setDisplay("map");
    const id = r.input.stepId;
    if (r.name === "whatIf" && id) {
      setMode("whatif");
      setSelected(null);
      setWhatIfStep(id);
    } else if (r.name === "whyCant" && id) {
      setMode("why");
      setSelected(null);
      setWhyGoal(id);
    } else if (r.name === "findCircles") {
      changeMode("circles");
      setCircleIndex(0);
    } else {
      changeMode("map");
      if (r.name === "getStep" && id) setSelected(id);
    }
    requestAnimationFrame(() => document.querySelector('[data-tour="modes"]')?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };

  const endTour = () => {
    setTourOn(false);
    try {
      window.localStorage.setItem("paperwork-path:toured", "1");
    } catch {
      /* fine */
    }
  };

  // ---- States ----
  if (s.status === "loading") return <LoadingScreen />;
  if (s.status === "error") return <ErrorScreen message={s.message} />;
  if (!view || !now || !circles) return <LoadingScreen />;

  const station = (id: string) => view.data.stations.find((x) => x.id === id);

  return (
    <div className="min-h-dvh">
      <Header
        isDemo={s.isDemo}
        hasOwnPlan={api.hasOwnPlan()}
        profiles={profiles}
        onStartFresh={(p) => {
          api.startFresh(p);
          setSelected(null);
          setMode("map");
          setWhatIfStep(null);
          setWhyGoal(null);
        }}
        onShowDemo={() => {
          api.showDemo();
          setSelected(null);
        }}
        onBackToMine={() => {
          api.backToMine();
          setSelected(null);
        }}
        exportFile={api.exportFile}
        importFile={api.importFile}
        onTour={() => setTourOn(true)}
      />

      <div className="mx-auto grid max-w-[1680px] grid-cols-[minmax(0,1fr)] gap-6 px-4 pb-16 sm:px-6 lg:grid-cols-[280px_minmax(0,1fr)] xl:grid-cols-[280px_minmax(0,1fr)_360px]">
        <Sidebar
          isDemo={s.isDemo}
          userId={s.userId}
          view={view.data}
          profiles={profiles}
          now={now}
          circles={circles.data}
          onProfile={(p) => api.setProfile(p)}
          onDone={(id, done) => api.toggleDone(id, done)}
          onSelect={(id) => {
            changeMode("map");
            setSelected(id);
          }}
          onShowCircle={(i) => {
            setDisplay("map");
            changeMode("circles");
            setCircleIndex(i);
          }}
        />

        <section aria-label="Your route" className="min-w-0">
          <ModeBar
            mode={mode}
            onMode={changeMode}
            display={display}
            onDisplay={setDisplay}
            circleCount={circles.data.length}
            goals={view.data.stations.filter((x) => x.isGoal)}
            whyGoal={whyGoal}
            onWhyGoal={setWhyGoal}
            whatIfStep={whatIfStep}
            whatIfName={whatIfStep ? station(whatIfStep)?.shortName : undefined}
            onClearWhatIf={() => setWhatIfStep(null)}
          />
          <div className="relative mt-3 overflow-hidden rounded-lg border border-rule bg-card/70" data-tour="map">
            {display === "list" ? (
              <ListView view={view.data} circles={circles.data} highlight={highlight} onSelect={onStation} mode={mode} layout={layout} />
            ) : layoutError ? (
              <div className="p-8 text-sm">
                <p className="font-semibold">The map could not be drawn.</p>
                <p className="mt-1 text-muted">Everything still works in the list.</p>
                <button className="mt-3 underline" onClick={() => setDisplay("list")}>Show the list</button>
              </div>
            ) : !layout ? (
              <div className="grid h-[420px] place-items-center text-sm text-muted">Drawing the map…</div>
            ) : (
              <div className="overflow-x-auto">
                <div className="p-2" style={{ minWidth: Math.round(layout.width * 0.72) }}>
                  <MetroMap
                    view={view.data}
                    layout={layout}
                    circleEdges={circleEdges}
                    highlight={highlight}
                    selected={selected}
                    onSelect={onStation}
                    pickHint={mode === "whatif" ? "Pick a station that might fall through." : mode === "why" ? "Pick a goal." : undefined}
                  />
                </div>
              </div>
            )}
          </div>
          <Legend profile={view.data.profile} />
          <AgentPanel
            graph={s.graph}
            userId={s.userId}
            profile={view.data.profile}
            who={s.isDemo ? "Lena" : "you"}
            names={Object.fromEntries(view.data.stations.map((x) => [x.id, x.shortName]))}
            onShow={showToolRun}
          />
        </section>

        <div ref={drawerRef} className="scroll-mt-4 lg:col-span-2 xl:col-span-1">
        <Drawer
          mode={mode}
          step={stepAnswer}
          isDemo={s.isDemo}
          stepStatus={selected ? station(selected)?.status : undefined}
          onDone={(id, done) => api.toggleDone(id, done)}
          onClose={() => setSelected(null)}
          circles={circles}
          circleIndex={circleIndex}
          onCircle={setCircleIndex}
          whatIf={whatIfAnswer}
          why={whyAnswer}
          now={now}
          onSelect={(id) => {
            changeMode("map");
            setSelected(id);
          }}
          names={Object.fromEntries(view.data.stations.map((x) => [x.id, x.shortName]))}
        />
        </div>
      </div>

      {tourOn && <Tour onGo={tourGo} onEnd={endTour} />}
    </div>
  );
}

function LoadingScreen() {
  return (
    <main className="grid min-h-dvh place-items-center px-6">
      <div className="text-center">
        <p className="font-serif text-4xl">Paperwork Path</p>
        <p className="mt-3 text-sm text-muted" role="status">Loading the graph database in your browser…</p>
      </div>
    </main>
  );
}

function ErrorScreen({ message }: { message: string }) {
  return (
    <main className="grid min-h-dvh place-items-center px-6">
      <div className="max-w-md">
        <p className="font-serif text-4xl">Something went wrong</p>
        <p className="mt-3 text-sm text-ink-soft">
          The graph database could not start in this browser. It needs WebAssembly, which all current browsers support.
          Try reloading the page, or another browser.
        </p>
        <pre className="mt-4 overflow-auto rounded bg-paper-deep p-3 font-mono text-xs text-ink-soft">{message}</pre>
        <button onClick={() => location.reload()} className="mt-4 rounded-full bg-ink px-4 py-2 text-sm text-paper">Reload</button>
      </div>
    </main>
  );
}
