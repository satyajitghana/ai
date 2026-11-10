"use client"

import { useState } from "react"

// The Artificial Analysis Intelligence Index v5.0.1, rebuilt from its parts.
//
// Weights: artificialanalysis.ai/methodology/intelligence-benchmarking (fetched
// 2026-11-09). Nine evaluations in four categories of 25% each; AA-Omniscience is
// split into accuracy (10%) and 1 - hallucination rate (5%). AA-Briefcase is an
// Elo and enters as clamp((Elo - 500) / 2000), as in v4. AutomationBench-AA enters
// as its partial score (automationBenchPartialScore), not the strict pass@1 Meta's
// table prints.
//
// Per-model scores: the model objects embedded in artificialanalysis.ai/models/*
// pages, fetched 2026-11-09. The rebuild gives 36.02 for Muse Ember (max) against
// AA's 36.02, and lands within 0.08 of AA's figure for every other point here
// (AA freezes an Elo when a model is added; the page carries today's Elo).

type Key = "briefcase" | "automation" | "gdppdf" | "frontier" | "tb4" | "tbsci" | "critpt" | "omniAcc" | "omniHall" | "hle"

type Comp = { key: Key; name: string; w: number; unit: "Elo" | "%"; pts: (v: number) => number; note: string }

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x)

const COMPS: Comp[] = [
  { key: "briefcase", name: "AA-Briefcase", w: 15, unit: "Elo", pts: (v) => 15 * clamp01((v - 500) / 2000), note: "91 knowledge-work projects, judged pairwise" },
  { key: "automation", name: "AutomationBench-AA", w: 5, unit: "%", pts: (v) => 0.05 * v, note: "657 SaaS workflows, partial score" },
  { key: "gdppdf", name: "GDP.pdf", w: 5, unit: "%", pts: (v) => 0.05 * v, note: "100 tasks over long PDFs, all-pass" },
  { key: "frontier", name: "FrontierCode 2.0", w: 15, unit: "%", pts: (v) => 0.15 * v, note: "132 repo changes judged on mergeability" },
  { key: "tb4", name: "Terminal-Bench 4.0", w: 10, unit: "%", pts: (v) => 0.1 * v, note: "66 terminal tasks x 3 repeats" },
  { key: "tbsci", name: "Terminal-Bench-Science", w: 15, unit: "%", pts: (v) => 0.15 * v, note: "70 science tasks x 3 repeats" },
  { key: "critpt", name: "CritPt v2 hard", w: 10, unit: "%", pts: (v) => 0.1 * v, note: "40 physics research problems x 5" },
  { key: "omniAcc", name: "Omniscience accuracy", w: 10, unit: "%", pts: (v) => 0.1 * v, note: "3,000 closed-book fact questions" },
  { key: "omniHall", name: "Omniscience hallucination", w: 5, unit: "%", pts: (v) => 0.05 * (100 - v), note: "lower is better: enters as 1 minus the rate" },
  { key: "hle", name: "HLE-Diamond", w: 10, unit: "%", pts: (v) => 0.1 * v, note: "1,000 exam questions, no tools" },
]

type Model = { id: string; name: string; aa: number; s: Record<Key, number> }

const MODELS: Model[] = [
  { id: "muse-ember", name: "Muse Ember (max)", aa: 36.02, s: { briefcase: 1521.15, automation: 68.08, gdppdf: 22.8, frontier: 27.17, tb4: 40.91, tbsci: 20.0, critpt: 39.0, omniAcc: 21.07, omniHall: 17.36, hle: 25.1 } },
  { id: "muse-ember-xhigh", name: "Muse Ember (xhigh)", aa: 34.11, s: { briefcase: 1526.95, automation: 66.71, gdppdf: 22.4, frontier: 21.97, tb4: 35.35, tbsci: 17.62, critpt: 38.5, omniAcc: 21.37, omniHall: 17.34, hle: 23.6 } },
  { id: "claude-haiku-5-5", name: "Claude Haiku 5.5 (max)", aa: 36.48, s: { briefcase: 1574.12, automation: 35.41, gdppdf: 20.8, frontier: 34.93, tb4: 32.83, tbsci: 20.0, critpt: 43.5, omniAcc: 34.67, omniHall: 34.23, hle: 29.6 } },
  { id: "claude-haiku-5-5-xhigh", name: "Claude Haiku 5.5 (xhigh)", aa: 34.64, s: { briefcase: 1523.33, automation: 35.95, gdppdf: 18.2, frontier: 29.93, tb4: 29.29, tbsci: 18.1, critpt: 47.5, omniAcc: 33.77, omniHall: 39.15, hle: 28.8 } },
  { id: "gpt-6-luna", name: "GPT-6 Luna (max)", aa: 27.86, s: { briefcase: 1337.06, automation: 53.17, gdppdf: 22.8, frontier: 25.17, tb4: 12.63, tbsci: 8.57, critpt: 42.5, omniAcc: 39.63, omniHall: 79.35, hle: 22.2 } },
]

const A_COL = "oklch(0.58 0.17 255)"
const B_COL = "oklch(0.62 0.15 40)"

const f2 = (n: number) => n.toFixed(2)
const sgn = (n: number) => (n > 0.005 ? "+" : n < -0.005 ? "−" : "±") + Math.abs(n).toFixed(2)
const raw = (c: Comp, v: number) => (c.unit === "Elo" ? `${Math.round(v)}` : `${v.toFixed(1)}%`)
const total = (s: Record<Key, number>) => COMPS.reduce((acc, c) => acc + c.pts(s[c.key]), 0)

export function IndexLedger() {
  const [aId, setA] = useState("muse-ember")
  const [bId, setB] = useState("claude-haiku-5-5")
  const a = MODELS.find((m) => m.id === aId) ?? MODELS[0]
  const b = MODELS.find((m) => m.id === bId) ?? MODELS[2]

  const rows = COMPS.map((c) => {
    const d = c.pts(a.s[c.key]) - c.pts(b.s[c.key])
    return { c, d }
  })
  const ta = total(a.s)
  const tb = total(b.s)
  const maxAbs = Math.max(1.8, ...rows.map((r) => Math.abs(r.d)))
  const wins = rows.filter((r) => r.d > 0.005).reduce((x, r) => x + r.d, 0)
  const losses = rows.filter((r) => r.d < -0.005).reduce((x, r) => x + r.d, 0)

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>AA Intelligence Index v5.0.1, rebuilt from its nine evaluations</span>
        <span className="text-muted-foreground/60">scores from artificialanalysis.ai, 2026-11-09</span>
      </div>

      <div className="p-3 sm:p-4">
        <div className="mb-3 flex flex-wrap items-center gap-2 font-mono text-xs">
          <select value={aId} onChange={(e) => setA(e.target.value)} className="rounded-md border bg-background px-2 py-1" style={{ color: A_COL }} aria-label="Model A">
            {MODELS.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
          <span className="text-muted-foreground">vs</span>
          <select value={bId} onChange={(e) => setB(e.target.value)} className="rounded-md border bg-background px-2 py-1" style={{ color: B_COL }} aria-label="Model B">
            {MODELS.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </div>

        <div className="mb-3 grid grid-cols-2 gap-2 font-mono text-xs sm:grid-cols-4">
          <div className="rounded-lg border px-3 py-2">
            <div className="text-muted-foreground">A rebuilt</div>
            <div className="text-lg" style={{ color: A_COL }}>{f2(ta)}</div>
            <div className="text-muted-foreground/70">AA shows {f2(a.aa)}</div>
          </div>
          <div className="rounded-lg border px-3 py-2">
            <div className="text-muted-foreground">B rebuilt</div>
            <div className="text-lg" style={{ color: B_COL }}>{f2(tb)}</div>
            <div className="text-muted-foreground/70">AA shows {f2(b.aa)}</div>
          </div>
          <div className="rounded-lg border px-3 py-2">
            <div className="text-muted-foreground">A wins / A loses</div>
            <div className="text-lg">
              {sgn(wins)} <span className="text-muted-foreground">/</span> {sgn(losses)}
            </div>
            <div className="text-muted-foreground/70">index points</div>
          </div>
          <div className="rounded-lg border px-3 py-2">
            <div className="text-muted-foreground">net, A minus B</div>
            <div className="text-lg">{sgn(ta - tb)}</div>
            <div className="text-muted-foreground/70">AA&apos;s own: {sgn(a.aa - b.aa)}</div>
          </div>
        </div>

        <ul className="space-y-1 font-mono text-[11px] sm:text-xs" aria-label={`Per-evaluation contribution difference between ${a.name} and ${b.name}`}>
          {rows.map((r) => {
            const pct = (Math.abs(r.d) / maxAbs) * 50
            const pos = r.d >= 0
            return (
              <li key={r.c.key} className="rounded-md px-1.5 py-1">
                <span className="flex items-baseline justify-between gap-2">
                  <span className="min-w-0 truncate text-foreground">
                    {r.c.name} <span className="text-muted-foreground">{`${r.c.w}%`}</span>
                  </span>
                  <span className="shrink-0 text-muted-foreground">
                    <span style={{ color: A_COL }}>{raw(r.c, a.s[r.c.key])}</span>
                    {" vs "}
                    <span style={{ color: B_COL }}>{raw(r.c, b.s[r.c.key])}</span>
                    <span className="ml-2 inline-block w-12 text-right text-foreground">{sgn(r.d)}</span>
                  </span>
                </span>
                <span className="relative mt-1 block h-2.5" title={r.c.note}>
                  <span className="absolute inset-y-0 left-1/2 w-px bg-border" />
                  <span
                    className="absolute inset-y-0 rounded-sm"
                    style={{ left: pos ? "50%" : `${50 - pct}%`, width: `max(1px, ${pct}%)`, background: pos ? A_COL : B_COL, opacity: 0.85 }}
                  />
                </span>
              </li>
            )
          })}
          <li className="flex justify-between gap-2 px-1.5 pt-1 text-[10px]">
            <span style={{ color: B_COL }}>{`← ${b.name} ahead`}</span>
            <span className="text-right" style={{ color: A_COL }}>{`${a.name} ahead →`}</span>
          </li>
        </ul>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Each bar is how many index points one evaluation hands one model over the other after weighting; the raw scores sit beside it.
          Ember against Haiku 5.5, both at max, is two large wins (AutomationBench and not guessing on Omniscience), one medium win
          (Terminal-Bench 4.0), and losses on recall, FrontierCode and the science and exam rows. The rounded table on Meta&apos;s page prints
          both as 36.
        </p>
      </div>
    </figure>
  )
}
