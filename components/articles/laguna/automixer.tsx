"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"
import { Range } from "@/components/articles/ui/range"

// AutoMixer, made playable. The paper turns data-mixture design into an optimization
// loop: sample mixtures over dataset groups, train a swarm of ~0.5B proxy models on each,
// evaluate a handful of capabilities, fit a per-capability surrogate f_j(x) ≈ y_j, then
// maximize a weighted sum of the surrogates over the simplex. This widget lets you move a
// mixture over eight aggregated groups (the ones the paper reports in Table 4) and watch a
// *toy linear* surrogate predict how five capabilities move relative to a hand-designed
// prior. The coefficients are illustrative — chosen so the directions match the paper's
// reported findings (code/synthetic → coding; math → math reasoning; web/books/knowledge →
// commonsense and general knowledge, which the optimized mix trades away slightly). The
// real AutoMixer fits non-linear surrogates over 50+ groups from ~60 proxy models. The
// "AutoMixer-optimized" preset loads XS.2's actual Table-4 mixture.
//
// SSR-safe: pure function of state, no effects, no timers, no randomness. Render always
// terminates (fixed 8×5 loops).

const ACCENT = "oklch(0.72 0.15 195)"

type Group = { id: string; label: string; prior: number; opt: number }

// prior = an illustrative hand-designed, code-heavy starting mix (x0). opt = XS.2's final
// AutoMixer mixture (paper, Table 4). Both are percentages.
const GROUPS: Group[] = [
  { id: "rawcode", label: "raw code", prior: 42, opt: 30.6 },
  { id: "synth", label: "synthetic / code-text", prior: 18, opt: 25.4 },
  { id: "web", label: "web", prior: 14, opt: 25.2 },
  { id: "math", label: "math", prior: 4, opt: 9.0 },
  { id: "knowledge", label: "knowledge", prior: 8, opt: 6.6 },
  { id: "instruction", label: "instruction-like", prior: 2, opt: 1.4 },
  { id: "academic", label: "academic papers", prior: 6, opt: 1.1 },
  { id: "books", label: "books", prior: 6, opt: 0.7 },
]

type Cap = { id: string; label: string; hue: number }
const CAPS: Cap[] = [
  { id: "coding", label: "coding", hue: 195 },
  { id: "math", label: "math reasoning", hue: 265 },
  { id: "stem", label: "STEM knowledge", hue: 155 },
  { id: "common", label: "commonsense", hue: 35 },
  { id: "general", label: "general knowledge", hue: 330 },
]

// toy per-capability sensitivities: BETA[capId][groupIndex]. Directions, not magnitudes.
const BETA: Record<string, number[]> = {
  //            rawcode synth  web    math  know  instr  acad  books
  coding: [0.7, 1.5, 0.15, 0.5, 0.1, 0.6, 0.2, 0.05],
  math: [0.2, 0.7, 0.2, 1.6, 0.2, 0.2, 0.5, 0.1],
  stem: [0.15, 0.3, 0.5, 0.6, 0.8, 0.1, 1.1, 0.4],
  common: [-0.08, -0.04, 0.6, 0.0, 0.55, 0.2, 0.4, 0.9],
  general: [0.05, 0.1, 0.9, 0.1, 0.9, 0.2, 0.6, 0.7],
}

// capability weights w_j in the objective max_x Σ w_j f_j(x). The paper optimizes mostly
// for coding and math; commonsense is deliberately down-weighted.
const WEIGHT: Record<string, number> = { coding: 1, math: 1, stem: 0.5, common: 0.3, general: 0.3 }

const score = (cap: string, mix: number[]) =>
  BETA[cap].reduce((s, b, i) => s + b * mix[i], 0)

const objective = (mix: number[]) =>
  CAPS.reduce((s, c) => s + WEIGHT[c.id] * score(c.id, mix), 0)

const PRIOR = GROUPS.map((g) => g.prior)
const OPT = GROUPS.map((g) => g.opt)

// prior baselines, computed once (module scope — pure, terminates)
const PRIOR_CAP = Object.fromEntries(CAPS.map((c) => [c.id, score(c.id, PRIOR)]))
const PRIOR_OBJ = objective(PRIOR)

export function AutoMixer() {
  const [w, setW] = useState<number[]>(PRIOR)

  const sum = w.reduce((s, v) => s + v, 0) || 1
  const mix = w.map((v) => (v / sum) * 100) // normalized to 100%

  const objNow = objective(mix)
  const objDelta = ((objNow - PRIOR_OBJ) / PRIOR_OBJ) * 100

  const atPreset =
    w.every((v, i) => v === PRIOR[i]) ? "prior" : w.every((v, i) => v === OPT[i]) ? "opt" : null

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5 font-mono text-xs">
        <span className="text-muted-foreground">AutoMixer · move the mixture, read the surrogate</span>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => setW(PRIOR)}
            aria-pressed={atPreset === "prior"}
            className={cn(
              "cursor-pointer rounded px-2 py-1 font-mono transition-colors",
              atPreset === "prior" ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground",
            )}
          >
            hand-designed prior
          </button>
          <button
            type="button"
            onClick={() => setW(OPT)}
            aria-pressed={atPreset === "opt"}
            className={cn(
              "cursor-pointer rounded px-2 py-1 font-mono transition-colors",
              atPreset === "opt" ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground",
            )}
          >
            AutoMixer-optimized (XS.2)
          </button>
        </div>
      </div>

      <div className="grid gap-4 p-3 sm:grid-cols-2 sm:p-4">
        {/* mixture sliders */}
        <div>
          <div className="mb-2 font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
            data mixture x ∈ Δ<sup>8</sup> · normalized to 100%
          </div>
          <div className="space-y-1.5">
            {GROUPS.map((g, i) => (
              <div key={g.id} className="grid grid-cols-[104px_1fr_38px] items-center gap-2">
                <label htmlFor={`am-${g.id}`} className="truncate font-mono text-[11px] text-foreground" title={g.label}>
                  {g.label}
                </label>
                <Range
                  id={`am-${g.id}`}
                  min={0}
                  max={50}
                  step={0.5}
                  value={w[i]}
                  onChange={(e) => {
                    const next = w.slice()
                    next[i] = Number(e.target.value)
                    setW(next)
                  }}
                  className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-muted "
                  style={{ color: ACCENT }}
                  aria-label={`${g.label} share`} accent="currentColor" />
                <span className="text-right font-mono text-[11px] tabular-nums text-muted-foreground">
                  {mix[i].toFixed(1)}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* predicted capabilities */}
        <div>
          <div className="mb-2 font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
            surrogate f<sub>j</sub>(x) · Δ vs prior (toy)
          </div>
          <div className="space-y-2">
            {CAPS.map((c) => {
              const s = score(c.id, mix)
              const d = ((s - PRIOR_CAP[c.id]) / PRIOR_CAP[c.id]) * 100
              const col = `oklch(0.7 0.15 ${c.hue})`
              const width = Math.min(100, Math.abs(d) * 2.2) // visual only
              return (
                <div key={c.id}>
                  <div className="flex items-center justify-between font-mono text-[11px]">
                    <span className="text-foreground">{c.label}</span>
                    <span className="tabular-nums" style={{ color: d >= 0 ? col : "var(--muted-foreground)" }}>
                      {d >= 0 ? "+" : ""}
                      {d.toFixed(1)}%
                    </span>
                  </div>
                  <div className="mt-1 flex">
                    {/* center-zero bar: left half = negative, right half = positive */}
                    <div className="flex h-2 w-1/2 justify-end overflow-hidden rounded-l-full bg-muted/60">
                      {d < 0 && <div className="h-full rounded-l-full" style={{ width: `${width}%`, background: "var(--muted-foreground)" }} />}
                    </div>
                    <div className="flex h-2 w-1/2 overflow-hidden rounded-r-full bg-muted/60">
                      {d >= 0 && <div className="h-full rounded-r-full" style={{ width: `${width}%`, background: col }} />}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          <div className="mt-3 rounded-md border bg-background px-3 py-2 font-mono text-xs">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">objective Σ w<sub>j</sub> f<sub>j</sub>(x)</span>
              <span className="tabular-nums font-medium" style={{ color: objDelta >= 0 ? ACCENT : "var(--muted-foreground)" }}>
                {objDelta >= 0 ? "+" : ""}
                {objDelta.toFixed(1)}% vs prior
              </span>
            </div>
            <div className="mt-1 text-[10px] leading-4 text-muted-foreground">
              weights favor coding + math (the paper's optimization targets); commonsense is down-weighted.
            </div>
          </div>
        </div>
      </div>

      <p className="border-t px-4 py-3 text-sm leading-6 text-muted-foreground">
        A <span className="text-foreground">toy linear surrogate</span> — the coefficients are illustrative, picked so the
        directions track the paper. Load <span className="text-foreground">AutoMixer-optimized</span> and coding and math
        rise while commonsense slips a little, exactly the trade the report measures (Table 3). The real AutoMixer fits{" "}
        <span className="text-foreground">non-linear</span> surrogates over 50+ dataset groups from a swarm of ~60 proxy
        models, then optimizes the mixture under a KL leash to the prior.
      </p>
    </figure>
  )
}
