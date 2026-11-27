"use client";
import { useRef, useState } from "react";
import type { ProfileSummary } from "@/graph/queries.ts";

type Props = {
  isDemo: boolean;
  hasOwnPlan: boolean;
  profiles: ProfileSummary[];
  onStartFresh: (profile: string) => void;
  onShowDemo: () => void;
  onBackToMine: () => void;
  exportFile: () => string;
  importFile: (text: string) => void;
  onTour: () => void;
};

export function Header(p: Props) {
  const [picking, setPicking] = useState(false);
  const [notice, setNotice] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const download = () => {
    const blob = new Blob([p.exportFile()], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = p.isDemo ? "lena-plan.cypher" : "my-paperwork-plan.cypher";
    a.click();
    URL.revokeObjectURL(url);
    setNotice({ tone: "ok", text: "Plan saved as a Cypher file. Upload it here any time to continue." });
  };

  const upload = async (file: File) => {
    try {
      if (file.size > 200_000) throw new Error("That file is too large to be a plan file.");
      p.importFile(await file.text());
      setNotice({ tone: "ok", text: `Loaded your plan from ${file.name}.` });
    } catch (e) {
      setNotice({ tone: "error", text: e instanceof Error ? e.message : "That file could not be read." });
    }
  };

  return (
    <header className="mx-auto max-w-[1680px] px-4 pt-6 pb-5 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4 border-b border-rule pb-5">
        <div>
          <p className="small-caps text-xs text-muted">Moving to Spain · Málaga</p>
          <h1 className="font-serif text-[44px] leading-[0.95] tracking-tight sm:text-[56px]">
            Paperwork Path
          </h1>
          <p className="mt-2 max-w-xl font-serif text-xl italic text-ink-soft">
            Every bureaucracy is a graph. Here is yours, with the circles and the ways out.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2" data-tour="plan">
          <button onClick={p.onTour} className="btn-ghost">Take the tour</button>
          <button onClick={download} className="btn-ghost">Download plan</button>
          <button onClick={() => fileRef.current?.click()} className="btn-ghost">Upload plan</button>
          <input
            ref={fileRef}
            type="file"
            accept=".cypher,text/plain"
            className="sr-only"
            aria-label="Upload a plan file"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) upload(f);
              e.target.value = "";
            }}
          />
          {p.isDemo ? (
            <div className="relative">
              <button onClick={() => setPicking((v) => !v)} className="btn-primary" aria-expanded={picking}>
                Start fresh
              </button>
              {picking && (
                <div className="fade-up absolute right-0 z-40 mt-2 w-72 rounded-lg border border-rule bg-card p-3 shadow-[0_12px_32px_-16px_rgba(27,42,65,0.35)]">
                  <p className="px-1 pb-2 text-sm font-semibold">Which describes you?</p>
                  {p.profiles.map((pr) => (
                    <button
                      key={pr.id}
                      onClick={() => {
                        setPicking(false);
                        p.onStartFresh(pr.id);
                      }}
                      className="flex w-full items-baseline justify-between rounded-md px-2 py-2 text-left text-sm hover:bg-paper-deep"
                    >
                      <span>{pr.name}</span>
                      <span className="small-caps text-xs text-muted">{pr.nameEs}</span>
                    </button>
                  ))}
                  {p.hasOwnPlan && (
                    <button onClick={() => { setPicking(false); p.onBackToMine(); }} className="mt-1 w-full rounded-md px-2 py-2 text-left text-sm text-terracotta hover:bg-paper-deep">
                      Back to my saved plan
                    </button>
                  )}
                </div>
              )}
            </div>
          ) : (
            <button onClick={p.onShowDemo} className="btn-ghost">Show demo (Lena)</button>
          )}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs text-muted">
        <p>
          <span className="font-semibold text-terracotta">Simplified guide, not legal advice.</span> Rules vary by
          province, check the linked source.
        </p>
        {notice && (
          <p role="status" className={notice.tone === "error" ? "text-terracotta" : "text-olive"}>
            {notice.text}{" "}
            <button className="underline" onClick={() => setNotice(null)}>Dismiss</button>
          </p>
        )}
      </div>
    </header>
  );
}
