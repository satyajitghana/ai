"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"

// One ALoDLM denoising step, run by the same rules as the released decoder
// (amazon-science/ALoDLM, alodlm/inference.py, Decoder._window, lines 100-146):
//   - after every pass, an unresolved position commits if its entropy plus a
//     position penalty is below tau ("entropy" mode), or the leftmost
//     unresolved position commits ("left1", the Table 1 quality preset);
//   - each position's gate hazard multiplies into a survival product, and the
//     inner loop stops when the mean of (1 - survival) over the positions still
//     unresolved reaches q, when nothing is unresolved, or after pass K = 4;
//   - if the loop stops with nothing committed, the lowest-entropy position is
//     committed so the step makes progress.
// The rules and the 8B layer split (10 prelude, 16 core, 10 coda) are real.
// The per-token entropies and hazards below are ILLUSTRATIVE: the decoder does
// not publish them, so I made easy tokens confident early and number tokens
// late, with lower halting hazards on numbers, the direction the paper's
// Figure 4 reports.

type Tok = { t: string; e: [number, number, number, number]; h: [number, number, number] }

const EASY = { e: [0.2, 0.08, 0.05, 0.04], h: [0.55, 0.6, 0.7] } as const
const MID = { e: [0.9, 0.45, 0.22, 0.12], h: [0.45, 0.5, 0.6] } as const
const NUM = { e: [2.4, 1.3, 0.55, 0.28], h: [0.3, 0.35, 0.45] } as const
const HARD = { e: [3.1, 2.1, 1.05, 0.5], h: [0.25, 0.3, 0.4] } as const

function tok(t: string, k: { e: readonly number[]; h: readonly number[] }): Tok {
  return { t, e: [k.e[0], k.e[1], k.e[2], k.e[3]], h: [k.h[0], k.h[1], k.h[2]] }
}

const WINDOW: Tok[] = [
  tok("She", EASY),
  tok("sells", MID),
  tok("16", MID),
  tok("−", EASY),
  tok("3", MID),
  tok("−", EASY),
  tok("4", MID),
  tok("=", EASY),
  tok("9", NUM),
  tok("eggs", EASY),
  tok("so", MID),
  tok("$18", HARD),
]

const K = 4
const GAMMA = 0.02 // position coefficient used in the paper's sweeps
const PRELUDE = 10
const CORE = 16
const CODA = 10
const AR_LAYERS = 36

type Result = {
  pass: number[] // pass (1..K) at which each position committed, 0 if not
  cdf: number[] // mean exit CDF over unresolved positions after each executed pass
  passes: number
  reason: string
}

function runStep(mode: "entropy" | "left1", tau: number, q: number): Result {
  const n = WINDOW.length
  const pass = new Array<number>(n).fill(0)
  const survival = new Array<number>(n).fill(1)
  const cdf: number[] = []
  for (let s = 0; s < K; s++) {
    const adjusted = WINDOW.map((w, i) => w.e[s] + i * GAMMA)
    for (let i = 0; i < n; i++) {
      const hz = s < K - 1 ? WINDOW[i].h[s] : 1
      survival[i] = survival[i] * (1 - hz)
    }
    const newly: number[] = []
    if (mode === "left1") {
      const first = pass.findIndex((p) => p === 0)
      if (first >= 0) newly.push(first)
    } else {
      for (let i = 0; i < n; i++) if (pass[i] === 0 && adjusted[i] < tau) newly.push(i)
    }
    for (const i of newly) pass[i] = s + 1
    const residual = pass.map((p, i) => (p === 0 ? i : -1)).filter((i) => i >= 0)
    let mean = 1
    if (residual.length) {
      let sum = 0
      for (const i of residual) sum += 1 - survival[i]
      mean = sum / residual.length
    }
    cdf.push(mean)
    let reason = ""
    if (s === K - 1) reason = "depth cap K = 4"
    else if (!residual.length) reason = "every position committed"
    else if (mean >= q) reason = `mean exit CDF ${mean.toFixed(2)} ≥ q`
    if (reason) {
      if (!pass.some((p) => p > 0)) {
        let best = 0
        for (let i = 1; i < n; i++) if (adjusted[i] < adjusted[best]) best = i
        pass[best] = s + 1
        reason += ", forced one commit"
      }
      return { pass, cdf, passes: s + 1, reason }
    }
  }
  return { pass, cdf, passes: K, reason: "depth cap K = 4" }
}

const SHADES = ["", "oklch(0.86 0.06 250)", "oklch(0.74 0.1 250)", "oklch(0.6 0.13 250)", "oklch(0.47 0.15 255)"]
const ACCENT = "oklch(0.55 0.15 255)"

export function InnerLoop() {
  const [mode, setMode] = useState<"entropy" | "left1">("entropy")
  const [tau, setTau] = useState(0.4)
  const [q, setQ] = useState(0.5)
  const r = runStep(mode, tau, q)
  const committed = r.pass.filter((p) => p > 0).length
  const perPosition = PRELUDE + r.passes * (CORE + CODA)
  const evals = WINDOW.length * perPosition
  const perToken = committed ? evals / committed : 0

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">one denoising step · rules from alodlm/inference.py</span>
        <span className="font-mono text-[10px] text-muted-foreground">entropies and hazards illustrative</span>
      </div>

      <div className="space-y-4 px-4 py-4">
        <div className="flex flex-wrap gap-2 font-mono text-xs">
          {(["entropy", "left1"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={
                mode === m
                  ? "rounded-md border border-foreground/50 bg-muted px-2.5 py-1"
                  : "rounded-md border px-2.5 py-1 text-muted-foreground"
              }
            >
              {m === "entropy" ? "entropy (parallel, Figures 1 and 3)" : "left1 (Table 1 quality preset)"}
            </button>
          ))}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="flex items-baseline justify-between font-mono text-xs">
              <span>entropy threshold τ{mode === "left1" ? " (inactive)" : ""}</span>
              <span className="font-semibold">{tau.toFixed(1)}</span>
            </span>
            <Range
              min={0.1}
              max={0.9}
              step={0.1}
              value={tau}
              accent={ACCENT}
              disabled={mode === "left1"}
              onChange={(e) => setTau(Number(e.target.value))}
              aria-label="Entropy threshold tau"
              className="mt-1 w-full"
            />
          </label>
          <label className="block">
            <span className="flex items-baseline justify-between font-mono text-xs">
              <span>exit threshold q</span>
              <span className="font-semibold">{q.toFixed(1)}</span>
            </span>
            <Range
              min={0.1}
              max={0.9}
              step={0.1}
              value={q}
              accent={ACCENT}
              onChange={(e) => setQ(Number(e.target.value))}
              aria-label="Exit threshold q"
              className="mt-1 w-full"
            />
          </label>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {WINDOW.map((w, i) => {
            const p = r.pass[i]
            return (
              <div
                key={i}
                className="min-w-[2.6rem] rounded-md border px-2 py-1.5 text-center font-mono text-xs"
                style={{
                  background: p ? SHADES[p] : "transparent",
                  color: p >= 3 ? "white" : undefined,
                  borderStyle: p ? "solid" : "dashed",
                }}
                title={p ? `committed after pass ${p}` : "still [MASK]: goes back to the sequence as a mask"}
              >
                <div>{p ? w.t : "[M]"}</div>
                <div className="text-[9px] opacity-75">{p ? `pass ${p}` : "next step"}</div>
              </div>
            )
          })}
        </div>

        <div className="font-mono text-[11px] text-muted-foreground">
          mean exit CDF over unresolved positions after each pass:{" "}
          {r.cdf.map((c, i) => (
            <span key={i} className="mr-2">
              {i + 1}: {c.toFixed(2)}
            </span>
          ))}
        </div>

        <div className="grid gap-2 sm:grid-cols-3">
          <Stat k="passes run, and why it stopped" v={`${r.passes} · ${r.reason}`} hl />
          <Stat k="positions committed this step" v={`${committed} of ${WINDOW.length}`} />
          <Stat
            k="layer evaluations per committed token"
            v={`${perToken.toFixed(0)} (Qwen3-8B AR: ${AR_LAYERS})`}
          />
        </div>

        <p className="text-[11px] leading-relaxed text-muted-foreground">
          Every position in the window runs every executed pass, committed or not, so a step costs {WINDOW.length}{" "}
          positions × ({PRELUDE} + {r.passes} × {CORE + CODA}) = {evals} token-layer evaluations, divided over the
          tokens it commits. Positions left as [M] lose their latent state and restart from the prelude next step. The
          real decoder uses a 16-position window plus the refreshed prefix; this one shows 12.
        </p>
      </div>
    </figure>
  )
}

function Stat({ k, v, hl }: { k: string; v: string; hl?: boolean }) {
  return (
    <div className={hl ? "rounded-lg border border-foreground/40 bg-muted/40 px-3 py-2" : "rounded-lg border px-3 py-2"}>
      <div className="font-mono text-[10px] text-muted-foreground">{k}</div>
      <div className="mt-0.5 font-mono text-sm">{v}</div>
    </div>
  )
}
