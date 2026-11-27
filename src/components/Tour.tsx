"use client";
// A skippable 30-second tour. It drives the real app (switches modes, picks
// stations) instead of showing screenshots, so every step is a live query.
import { useEffect, useRef, useState } from "react";

export type TourTarget = "circle" | "whatif" | "why" | "now";

const STEPS: { target: TourTarget; title: string; body: string }[] = [
  {
    target: "circle",
    title: "Lena is stuck in a circle.",
    body: "She's a freelance designer. Her EU certificate needs her tax registration, but the tax registration needs her NIE, which comes with the certificate. The graph finds the loop, and the official way out: the NIE number on its own (EX-15).",
  },
  {
    target: "whatif",
    title: "What if the certificate falls through?",
    body: "One query follows every requirement backwards. Six of Lena's steps are stuck, and you can see the chain behind each one.",
  },
  {
    target: "why",
    title: "Why can't she register as self-employed?",
    body: "The shortest chain of missing requirements, from the goal down to what she lacks. Here nothing can start, so the answer points back to the circle.",
  },
  {
    target: "now",
    title: "Every answer shows how we know.",
    body: "Open “How we know” for the exact Cypher, run on Relate in your browser, and the official pages behind it. When you're ready, press Start fresh for your own plan.",
  },
];

export function Tour({ onGo, onEnd }: { onGo: (t: TourTarget) => void; onEnd: () => void }) {
  const [i, setI] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    onGo(STEPS[i].target);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i]);

  useEffect(() => {
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onEnd();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onEnd]);

  const step = STEPS[i];
  const last = i === STEPS.length - 1;
  return (
    <div
      ref={ref}
      tabIndex={-1}
      role="dialog"
      aria-modal="false"
      aria-labelledby="tour-title"
      className="fade-up fixed inset-x-3 bottom-3 z-50 mx-auto max-w-xl rounded-xl sm:inset-x-auto sm:left-6 sm:mx-0 sm:w-[440px] border border-ink/20 bg-ink p-5 text-paper shadow-[0_24px_60px_-20px_rgba(27,42,65,0.6)] outline-none sm:bottom-6"
    >
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#d9cfbb]">
          Tour · {i + 1} of {STEPS.length}
        </p>
        <button onClick={onEnd} className="text-xs text-[#d9cfbb] underline-offset-2 hover:underline">Skip tour</button>
      </div>
      <h2 id="tour-title" key={`t${i}`} className="fade-up mt-1 font-serif text-[26px] leading-tight">{step.title}</h2>
      <p key={`b${i}`} className="fade-up mt-1.5 text-sm text-[#e9e2d0]">{step.body}</p>
      <div className="mt-4 flex items-center justify-between">
        <div className="flex gap-1.5" aria-hidden>
          {STEPS.map((_, k) => (
            <span key={k} className={`h-1.5 rounded-full transition-all ${k === i ? "w-6 bg-terracotta" : "w-1.5 bg-[#4a5a75]"}`} />
          ))}
        </div>
        <div className="flex gap-2">
          {i > 0 && (
            <button onClick={() => setI(i - 1)} className="rounded-full border border-[#4a5a75] px-4 py-1.5 text-sm">Back</button>
          )}
          <button onClick={() => (last ? onEnd() : setI(i + 1))} className="rounded-full bg-paper px-4 py-1.5 text-sm font-medium text-ink">
            {last ? "Explore" : "Next"}
          </button>
        </div>
      </div>
    </div>
  );
}
