import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { initSync, RelateDb } from "@relate/relate-wasm";
import { Graph, GraphError } from "./db.ts";
import { validateData } from "./seed.ts";
import { doThisNow, findCircles, getStep, listProfiles, mapView, whatIf, whyCant } from "./queries.ts";
import { hasPrelaidLayout } from "../lib/prelaid.ts";
import { createUser, exportPlan, importPlan, loadDemoUser, markDone, completedSteps } from "./plan.ts";

const require = createRequire(import.meta.url);
let graph: Graph;

beforeAll(() => {
  initSync({ module: readFileSync(require.resolve("@relate/relate-wasm/relate_bg.wasm")) });
});
beforeEach(() => {
  graph = new Graph(new RelateDb());
  graph.loadSeed();
});

const ids = (xs: { id: string }[]) => xs.map((x) => x.id).sort();

describe("seed data", () => {
  it("has no broken references", () => {
    expect(validateData()).toEqual([]);
  });
  it("loads all steps and profiles", () => {
    expect(graph.run("MATCH (s:Step) RETURN count(s) AS n")[0].n).toBe(14);
    expect(ids(listProfiles(graph).data)).toEqual(["autonomo", "employee", "own_means"]);
  });
  it("turns Relate errors into exceptions that keep the query", () => {
    expect(() => graph.run("MATCH (n RETURN n")).toThrow(GraphError);
  });
});

describe("circle detector", () => {
  it("finds the official self-employed circle: certificate <-> tax registration", () => {
    loadDemoUser(graph); // Lena, autonomo
    const circles = findCircles(graph, "lena").data;
    const official = circles.filter((c) => c.allOfficial);
    expect(official).toHaveLength(1);
    expect(ids(official[0].stations)).toEqual(["alta_censal", "eu_certificate"]);
    expect(official[0].affectsYou).toBe(true);
    expect(ids(official[0].wayOuts)).toEqual(["nie_number"]);
  });

  it("finds the common-practice circle (certificate -> padrón -> housing) and labels it", () => {
    loadDemoUser(graph);
    const practice = findCircles(graph, "lena").data.filter((c) => !c.allOfficial);
    expect(practice.map((c) => ids(c.stations))).toEqual([["eu_certificate", "housing", "padron"]]);
    expect(practice[0].links.some((l) => l.basis === "practice")).toBe(true);
  });

  it("marks circles as escaped once a way out is done", () => {
    loadDemoUser(graph);
    expect(findCircles(graph, "lena").data.every((c) => !c.escaped)).toBe(true);
    markDone(graph, "lena", "nie_number");
    expect(findCircles(graph, "lena").data.every((c) => c.escaped)).toBe(true);
  });

  it("lists each circle once (no duplicates per station, no figure eights)", () => {
    loadDemoUser(graph);
    expect(findCircles(graph, "lena").data).toHaveLength(2);
  });

  it("does not show the tax-registration circle to employees", () => {
    createUser(graph, { id: "e", profile: "employee" });
    const circles = findCircles(graph, "e").data;
    expect(circles.some((c) => ids(c.stations).includes("alta_censal"))).toBe(false);
    expect(circles).toHaveLength(1);
  });

  it("returns the Cypher and official sources for 'How we know'", () => {
    loadDemoUser(graph);
    const { explain } = findCircles(graph, "lena");
    expect(explain.cypher).toContain("REQUIRES*2..8");
    expect(explain.sources.map((s) => s.url)).toContain(
      "https://sede.policia.gob.es/portalCiudadano/_es/tramites_extranjeria_tramite_asignacion_nie.php",
    );
  });
});

describe("what if", () => {
  it("bank account falls through: only RETA is blocked for a self-employed user", () => {
    loadDemoUser(graph);
    const r = whatIf(graph, "lena", "bank_account").data;
    expect(ids(r.blocked)).toEqual(["reta"]);
    expect(r.blocked[0].chain.map((l) => `${l.from}>${l.to}`)).toEqual(["reta>bank_account"]);
  });

  it("certificate falls through: everything that needs your NIE is blocked", () => {
    loadDemoUser(graph);
    const r = whatIf(graph, "lena", "eu_certificate").data;
    expect(ids(r.blocked)).toEqual(["alta_censal", "bank_account", "housing", "nuss", "padron", "reta"]);
    expect(r.blocked.find((b) => b.id === "reta")!.hops).toBe(2);
    expect(ids(r.wayOuts)).toEqual(["nie_number"]);
  });

  it("a completed way out protects the steps that only needed the NIE", () => {
    loadDemoUser(graph);
    markDone(graph, "lena", "nie_number");
    expect(whatIf(graph, "lena", "eu_certificate").data.blocked).toEqual([]);
  });

  it("steps already done are not blocked", () => {
    createUser(graph, { id: "e", profile: "employee", completed: ["id_document", "job_offer", "nie_number", "nuss"] });
    const r = whatIf(graph, "e", "eu_certificate").data;
    expect(r.blocked).toEqual([]);
    const job = whatIf(graph, "e", "job_offer").data;
    expect(ids(job.blocked)).toEqual(["alta_employee", "eu_certificate"]);
  });

  it("ignores steps that belong to other profiles", () => {
    createUser(graph, { id: "o", profile: "own_means" });
    const r = whatIf(graph, "o", "eu_certificate").data;
    expect(ids(r.blocked)).toEqual(["housing", "padron"]); // no RETA, no bank account, no NUSS
  });
});

describe("do this now", () => {
  it("Lena: the way out of her circle comes first", () => {
    loadDemoUser(graph);
    const items = doThisNow(graph, "lena").data;
    expect(items[0]).toMatchObject({ id: "nie_number", isWayOut: true });
    expect(ids(items)).toEqual(["nie_number"]);
  });

  it("after the NIE number, the circle opens", () => {
    loadDemoUser(graph);
    markDone(graph, "lena", "nie_number");
    expect(ids(doThisNow(graph, "lena").data)).toEqual(["alta_censal", "bank_account", "housing", "nuss"]);
  });

  it("a fresh retiree starts with ID, insurance, funds and the appointment", () => {
    createUser(graph, { id: "o", profile: "own_means" });
    expect(ids(doThisNow(graph, "o").data)).toEqual([
      "cita_extranjeria", "health_insurance", "id_document", "nie_number", "proof_of_funds",
    ]);
  });
});

describe("why can't I", () => {
  it("Lena can't register for RETA: shows the chain to each missing step", () => {
    loadDemoUser(graph);
    const r = whyCant(graph, "lena", "reta").data;
    expect(r.done).toBe(false);
    expect(ids(r.missing)).toEqual(["alta_censal", "bank_account", "eu_certificate", "housing", "nuss", "padron"]);
    const cert = r.missing.find((m) => m.id === "eu_certificate")!;
    // Shortest official chain (via NUSS or tax registration), never via the bank (common practice).
    expect(cert.chain).toHaveLength(2);
    expect(cert.chain.every((l) => l.basis === "official")).toBe(true);
    expect(cert.chain[1].to).toBe("eu_certificate");
    expect(r.missing.every((m) => !m.open)).toBe(true); // all stuck: that's the circle
  });

  it("marks steps that can be done now as open", () => {
    createUser(graph, { id: "o", profile: "own_means" });
    const r = whyCant(graph, "o", "eu_certificate").data;
    const open = r.missing.filter((m) => m.open).map((m) => m.id).sort();
    expect(open).toEqual(["cita_extranjeria", "health_insurance", "id_document", "proof_of_funds"]);
  });

  it("a finished goal has nothing missing", () => {
    createUser(graph, { id: "o", profile: "own_means", completed: ["padron"] });
    expect(whyCant(graph, "o", "padron").data).toMatchObject({ done: true, missing: [] });
  });
});

describe("lookups", () => {
  it("getStep returns details, requirements and sources", () => {
    const s = getStep(graph, "padron").data!;
    expect(s.nameEs).toBe("Empadronamiento");
    expect(s.requires.map((r) => r.to).sort()).toEqual(["housing", "id_document"]);
    expect(s.sourceUrl).toContain("sede.malaga.eu");
  });
  it("getStep returns null for an unknown id", () => {
    expect(getStep(graph, "nope").data).toBeNull();
  });
  it("unverified steps carry the reason", () => {
    expect(getStep(graph, "bank_account").data).toMatchObject({ verified: false });
    expect(getStep(graph, "bank_account").data!.unverifiedReason).toBeTruthy();
  });
});

describe("plan file", () => {
  it("round-trips a plan through the exported Cypher", () => {
    loadDemoUser(graph);
    markDone(graph, "lena", "nie_number");
    const file = exportPlan(graph, "lena");

    const fresh = new Graph(new RelateDb());
    fresh.loadSeed();
    const loaded = importPlan(fresh, file);
    expect(loaded.profile).toBe("autonomo");
    expect(completedSteps(fresh, "lena")).toEqual(["cita_extranjeria", "id_document", "nie_number"]);
  });

  it("the exported file is valid Cypher that Relate runs as-is", () => {
    loadDemoUser(graph);
    const file = exportPlan(graph, "lena");
    const fresh = new Graph(new RelateDb());
    fresh.loadSeed();
    fresh.runScript(file);
    expect(completedSteps(fresh, "lena")).toEqual(["cita_extranjeria", "id_document"]);
  });

  it("rejects files that are not plan files, and unknown steps", () => {
    expect(() => importPlan(graph, "MATCH (n) DETACH DELETE n")).toThrow(/not a Paperwork Path plan/);
    loadDemoUser(graph);
    const bad = exportPlan(graph, "lena").replace('"id_document"', '"made_up"');
    expect(() => importPlan(new Graph(new RelateDb()), bad)).toThrow();
  });
});

describe("map view", () => {
  it("Lena's map: statuses, goals and lines for her profile only", async () => {
    
    loadDemoUser(graph);
    const m = mapView(graph, "lena").data;
    const status = Object.fromEntries(m.stations.map((s) => [s.id, s.status]));
    expect(status).toMatchObject({
      id_document: "done", cita_extranjeria: "done", nie_number: "open",
      eu_certificate: "blocked", alta_censal: "blocked", reta: "blocked",
    });
    expect(status.job_offer).toBeUndefined(); // employee-only step not on her map
    expect(m.stations.filter((s) => s.isGoal).map((s) => s.id).sort()).toEqual(["eu_certificate", "padron", "reta"]);
    expect(m.lines.some((l) => l.from === "eu_certificate" && l.to === "health_insurance")).toBe(false);
    expect(m.wayOutLinks).toEqual([{ from: "nie_number", to: "eu_certificate" }]);
  });
  it("a way out becomes 'not needed' once the certificate is done", async () => {
    
    loadDemoUser(graph);
    markDone(graph, "lena", "eu_certificate");
    expect(mapView(graph, "lena").data.stations.find((s) => s.id === "nie_number")!.status).toBe("not_needed");
  });
});

describe("precomputed map layouts", () => {
  it("exist for every profile (run `npm run layouts` after changing the data)", () => {
    for (const p of listProfiles(graph).data) {
      createUser(graph, { id: `t_${p.id}`, profile: p.id });
      expect(hasPrelaidLayout(mapView(graph, `t_${p.id}`).data), p.id).toBe(true);
    }
  });
});
