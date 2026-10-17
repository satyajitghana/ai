"use client"

import { useState } from "react"

// What `earshot fit` (kind auto) did on our six targets, read from the JSON each run
// wrote (fit_engine.character.class and fit_engine.candidates). Under 1 s every one of
// the six candidate models is fitted; at 1 s or longer, the four the class plans first.
// Each candidate is rendered once (seed 0) and scored against the target with
// quality.score: mel dB + 0.3 tone dB + 8 (1 - envelope r) + onset error (capped at 2)
// + 1.5 excess dB + missing dB. Lowest wins. Measured by us, 17 Oct 2026, shared CPU VM.

type Cand = { k: string; score: number; s: number }
type Target = { id: string; label: string; cls: string; planned: string; cands: Cand[] }

const TARGETS: Target[] = [
  {
    id: "bar",
    label: "struck bar",
    cls: "ringing",
    planned: "sines",
    cands: [
      { k: "sines", score: 4.305, s: 1.98 },
      { k: "modal", score: 5.325, s: 1.01 },
      { k: "sines + spectral", score: 5.36, s: 1.08 },
      { k: "spectral", score: 12.127, s: 1.11 },
    ],
  },
  {
    id: "glide",
    label: "glide",
    cls: "glide",
    planned: "sines",
    cands: [
      { k: "sines", score: 10.928, s: 1.13 },
      { k: "sines + modal + spectral", score: 11.285, s: 1.51 },
      { k: "sines + spectral", score: 12.778, s: 0.52 },
      { k: "modal", score: 33.816, s: 0.69 },
      { k: "spectral", score: 20.162, s: 0.5 },
      { k: "modal + spectral", score: 30.278, s: 0.57 },
    ],
  },
  {
    id: "ding",
    label: "earshot ding",
    cls: "struck",
    planned: "modal",
    cands: [
      { k: "modal", score: 25.65, s: 0.9 },
      { k: "sines + modal + spectral", score: 16.601, s: 3.33 },
      { k: "modal + spectral", score: 23.784, s: 0.26 },
      { k: "sines", score: 7.898, s: 0.56 },
      { k: "spectral", score: 19.207, s: 0.34 },
      { k: "sines + spectral", score: 12.562, s: 0.5 },
    ],
  },
  {
    id: "pop",
    label: "earshot pop",
    cls: "struck",
    planned: "modal",
    cands: [
      { k: "modal", score: 11.897, s: 0.57 },
      { k: "sines + modal + spectral", score: 15.443, s: 1.67 },
      { k: "modal + spectral", score: 16.435, s: 0.31 },
      { k: "sines", score: 7.527, s: 0.41 },
      { k: "spectral", score: 9.014, s: 0.26 },
      { k: "sines + spectral", score: 10.453, s: 0.27 },
    ],
  },
  {
    id: "twig",
    label: "twig snap (real)",
    cls: "mixed",
    planned: "modal",
    cands: [
      { k: "modal", score: 16.426, s: 5.66 },
      { k: "spectral", score: 26.62, s: 1.69 },
      { k: "modal + spectral", score: 21.107, s: 1.57 },
      { k: "sines", score: 9.536, s: 4.11 },
      { k: "sines + spectral", score: 20.255, s: 2.53 },
      { k: "sines + modal + spectral", score: 19.26, s: 14.27 },
    ],
  },
  {
    id: "whoosh",
    label: "earshot whoosh",
    cls: "gesture",
    planned: "spectral",
    cands: [
      { k: "spectral", score: 9.304, s: 1.79 },
      { k: "sines + spectral", score: 9.02, s: 6.6 },
      { k: "modal", score: 11.547, s: 8.47 },
      { k: "sines", score: 6.55, s: 5.33 },
    ],
  },
]

const MAX = 34 // the worst score in the set, for the bar scale

export function FitCandidates() {
  const [i, setI] = useState(0)
  const t = TARGETS[i]
  const best = Math.min(...t.cands.map((c) => c.score))
  const winner = t.cands.find((c) => c.score === best)

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center gap-1 border-b px-4 py-2.5 font-mono text-[11px]">
        <span className="mr-2 text-muted-foreground">earshot fit, kind auto</span>
        {TARGETS.map((q, k) => (
          <button
            key={q.id}
            type="button"
            onClick={() => setI(k)}
            aria-pressed={k === i}
            className={`rounded-md border px-2 py-0.5 ${k === i ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"}`}
          >
            {q.label}
          </button>
        ))}
      </div>
      <div className="p-3 sm:p-4">
        <p className="font-mono text-[11px] text-muted-foreground">
          1. character() names the class: <span className="text-foreground">{t.cls}</span>. Its plan puts{" "}
          <span className="text-foreground">{t.planned}</span> first.
        </p>
        <p className="mt-1 font-mono text-[11px] text-muted-foreground">
          2. Every planned candidate is fitted, rendered and scored, in plan order. Lower is closer.
        </p>
        <ol className="mt-3 space-y-1.5">
          {t.cands.map((c) => {
            const win = c.score === best
            return (
              <li key={c.k} className="grid grid-cols-[9.5rem_1fr_3.2rem] items-center gap-2 font-mono text-[11px] sm:grid-cols-[12rem_1fr_3.5rem]">
                <span className={win ? "text-foreground" : "text-muted-foreground"}>{c.k}</span>
                <span className="relative h-4 rounded-sm bg-muted/40">
                  <span
                    className={`absolute inset-y-0 left-0 rounded-sm ${win ? "bg-emerald-600 dark:bg-emerald-500" : "bg-muted-foreground/50"}`}
                    style={{ width: `${Math.min(100, (c.score / MAX) * 100).toFixed(1)}%` }}
                  />
                </span>
                <span className={`text-right ${win ? "text-foreground" : "text-muted-foreground"}`}>
                  {c.score.toFixed(2)}
                </span>
              </li>
            )
          })}
        </ol>
        <p className="mt-3 font-mono text-[11px]">
          3. Kept: <span className="text-emerald-700 dark:text-emerald-400">{winner?.k}</span>
          {winner && winner.k !== t.planned ? `, not the planned ${t.planned}` : ", as planned"}. Fitting it took{" "}
          {winner?.s.toFixed(2)} s.
        </p>
      </div>
      <figcaption className="border-t px-4 py-2.5 font-mono text-[10px] leading-relaxed text-muted-foreground">
        Read by us from the model JSON of each run (fit_engine), 17 Oct 2026. Score = mel dB + 0.3 tone + 8 (1 - env r) +
        onset error + 1.5 excess + missing. Under 1 s all six candidates are tried; the 1.0 s bar and the 1.06 s whoosh got four.
      </figcaption>
    </figure>
  )
}
