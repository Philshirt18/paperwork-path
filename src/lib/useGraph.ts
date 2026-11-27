"use client";
// Owns the user's Relate database in the browser. Loads the WASM engine, the
// official steps and either the user's saved plan or the demo user (Lena),
// and exposes plan actions. Every change bumps `version` so views re-query.
import { useCallback, useEffect, useRef, useState } from "react";
import { Graph } from "@/graph/db.ts";
import { createUser, exportPlan, importPlan, loadDemoUser, markDone, markUndone } from "@/graph/plan.ts";

export const ME = "me";
const STORAGE_KEY = "paperwork-path:plan";

export type GraphState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; graph: Graph; userId: string; isDemo: boolean; version: number };

function readSaved(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}
function writeSaved(text: string | null) {
  try {
    if (text === null) window.localStorage.removeItem(STORAGE_KEY);
    else window.localStorage.setItem(STORAGE_KEY, text);
  } catch {
    // Private mode or blocked storage: the plan file download still works.
  }
}

export function useGraph() {
  const [state, setState] = useState<GraphState>({ status: "loading" });
  const graphRef = useRef<Graph | null>(null);
  const userIdRef = useRef("lena");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const relate = await import("@relate/relate-wasm");
        await relate.default({ module_or_path: "/relate/relate_bg.wasm" });
        const graph = new Graph(new relate.RelateDb());
        graph.loadSeed();
        loadDemoUser(graph);
        graphRef.current = graph;
        if (cancelled) return;
        // A plan from an earlier visit? Keep Lena as the first view only for new visitors.
        const saved = readSaved();
        let userId = "lena";
        if (saved) {
          try {
            userId = importPlan(graph, saved).userId;
          } catch {
            writeSaved(null);
          }
        }
        userIdRef.current = userId;
        setState({ status: "ready", graph, userId, isDemo: userId === "lena", version: 1 });
      } catch (e) {
        if (!cancelled)
          setState({ status: "error", message: e instanceof Error ? e.message : String(e) });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (state.status === "ready") userIdRef.current = state.userId;
  }, [state]);

  /**
   * Run a change, save the user's own plan, and tell views to refresh.
   * The database change happens here, outside React's state updater, so it
   * runs exactly once. Errors are thrown to the caller (e.g. a bad upload).
   */
  const change = useCallback((fn: (graph: Graph, userId: string) => string | void) => {
    const graph = graphRef.current;
    if (!graph) return;
    const userId = fn(graph, userIdRef.current) ?? userIdRef.current;
    userIdRef.current = userId;
    if (userId === ME) writeSaved(exportPlan(graph, ME));
    setState((s) => (s.status === "ready" ? { ...s, userId, isDemo: userId === "lena", version: s.version + 1 } : s));
  }, []);

  return {
    state,
    toggleDone: (stepId: string, done: boolean) =>
      change((g, u) => (done ? markDone(g, u, stepId) : markUndone(g, u, stepId))),
    startFresh: (profile: string) =>
      change((g) => {
        createUser(g, { id: ME, profile, completed: [] });
        return ME;
      }),
    setProfile: (profile: string) =>
      change((g, u) => {
        if (u !== ME) {
          createUser(g, { id: ME, profile, completed: [] });
          return ME;
        }
        // Keep what you've done; requirements of the new profile are recomputed.
        const done = g.run<{ id: string }>(`MATCH (:User {id: $u})-[:COMPLETED]->(s) RETURN s.id AS id`, { u }).map((r) => r.id);
        createUser(g, { id: ME, profile, completed: done });
        return ME;
      }),
    showDemo: () =>
      change((g) => {
        loadDemoUser(g);
        return "lena";
      }),
    backToMine: () => change(() => ME),
    hasOwnPlan: () => state.status === "ready" && state.graph.run(`MATCH (u:User {id: $id}) RETURN u`, { id: ME }).length > 0,
    exportFile: () => (state.status === "ready" ? exportPlan(state.graph, state.userId) : ""),
    importFile: (text: string) =>
      change((g) => {
        const { userId } = importPlan(g, text.replace(/^﻿/, ""));
        if (userId !== ME) {
          // Files from someone else (or Lena's) become "my plan" here.
          const done = g.run<{ id: string }>(`MATCH (:User {id: $u})-[:COMPLETED]->(s) RETURN s.id AS id`, { u: userId }).map((r) => r.id);
          const [p] = g.run<{ id: string }>(`MATCH (:User {id: $u})-[:IS]->(p) RETURN p.id AS id`, { u: userId });
          createUser(g, { id: ME, profile: p.id, completed: done });
          if (userId !== "lena") g.run(`MATCH (u:User {id: $u}) DETACH DELETE u`, { u: userId });
          else loadDemoUser(g);
        }
        return ME;
      }),
  };
}

export type GraphApi = ReturnType<typeof useGraph>;
