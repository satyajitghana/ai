"use client"

import { useMemo, useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { mexp, mpow } from "@/lib/dmath"
import { cn } from "@/lib/utils"

// One GRPO group, scored twice: with the terminal reward 1[pass] and with the
// Tev paper's PPRS reward 1[pass] + lambda * Phi(s_T) (its Eq. 4). Advantages are
// the paper's Eq. 2, (R_i - mean) / (std + eps), population std.
//
// What is real and what is a toy:
//   - The plateau values a failing rollout can stop on are the ones the paper
//     measured on its warehouse environment (Appendix B): 0.05, 0.26, 0.69, 0.78,
//     0.90, and 1 for a complete workspace that was never submitted. 0 is the
//     untouched tree.
//   - Which plateau a failing rollout reaches is a toy: a bell over the plateau
//     index whose centre moves deeper as the solve rate p rises. The paper gives
//     no such distribution. The point is the shape of the advantages, not the
//     exact numbers.
//   - (1 - p)^G, the chance that a terminal-reward group is all fails, is exact.

const PLATEAUS: { phi: number; label: string }[] = [
  { phi: 0, label: "nothing usable" },
  { phi: 0.05, label: "readable, schema partly there" },
  { phi: 0.26, label: "every table partly loaded" },
  { phi: 0.69, label: "schema and facts complete" },
  { phi: 0.78, label: "deeper plateau" },
  { phi: 0.9, label: "nearly complete" },
  { phi: 1, label: "complete, never submitted" },
]

const GS = [4, 8, 16, 24] as const
const EPS = 1e-6
const SIMS = 4000

function mulberry32(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function plateauWeights(p: number): number[] {
  const mu = 1 + 10 * p
  const w = PLATEAUS.map((_, k) => mexp(-((k - mu) * (k - mu)) / (2 * 1.5 * 1.5)))
  const s = w.reduce((a, b) => a + b, 0)
  return w.map((x) => x / s)
}

type Rollout = { pass: boolean; k: number; phi: number }

function drawGroup(rand: () => number, p: number, g: number, w: number[]): Rollout[] {
  const out: Rollout[] = []
  for (let i = 0; i < g; i++) {
    if (rand() < p) {
      out.push({ pass: true, k: PLATEAUS.length - 1, phi: 1 })
      continue
    }
    const u = rand()
    let acc = 0
    let k = 0
    for (; k < w.length - 1; k++) {
      acc += w[k]
      if (u < acc) break
    }
    out.push({ pass: false, k, phi: PLATEAUS[k].phi })
  }
  return out
}

function advantages(r: number[]): { adv: number[]; std: number } {
  const n = r.length
  const mean = r.reduce((a, b) => a + b, 0) / n
  const v = r.reduce((a, b) => a + (b - mean) * (b - mean), 0) / n
  const std = Math.sqrt(v)
  return { adv: r.map((x) => (x - mean) / (std + EPS)), std }
}

const pill = (on: boolean) =>
  cn(
    "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
    on ? "border-foreground/30 bg-muted/50 text-foreground" : "border-border text-muted-foreground hover:text-foreground",
  )

const C_TERM = "oklch(0.58 0.17 25)"
const C_PPRS = "oklch(0.6 0.13 160)"

function Bar({ a, color }: { a: number; color: string }) {
  const clamped = Math.max(-3, Math.min(3, a))
  const pct = (Math.abs(clamped) / 3) * 50
  const zero = Math.abs(a) < 1e-9
  return (
    <div className="relative h-3 w-full rounded-sm bg-muted/40">
      <div className="absolute inset-y-0 left-1/2 w-px bg-border" />
      {zero ? null : (
        <div
          className="absolute inset-y-0 rounded-sm"
          style={{
            background: color,
            left: clamped >= 0 ? "50%" : `${(50 - pct).toFixed(2)}%`,
            width: `${pct.toFixed(2)}%`,
          }}
        />
      )}
    </div>
  )
}

const fmt = (x: number) => {
  const v = Math.abs(x) < 0.005 ? 0 : x
  return (v >= 0 ? "+" : "−") + Math.abs(v).toFixed(2)
}

export function GroupAdvantage() {
  const [pPct, setPPct] = useState(5)
  const [g, setG] = useState<number>(8)
  const [lamPct, setLamPct] = useState(25)
  const [seed, setSeed] = useState(7)

  const p = pPct / 100
  const lam = lamPct / 100
  const w = useMemo(() => plateauWeights(p), [p])

  const group = useMemo(() => drawGroup(mulberry32(seed * 977 + g * 31 + pPct), p, g, w), [seed, g, pPct, p, w])
  const rTerm = group.map((r) => (r.pass ? 1 : 0))
  const rPprs = group.map((r) => (r.pass ? 1 : 0) + lam * r.phi)
  const term = advantages(rTerm)
  const pprs = advantages(rPprs)

  const sim = useMemo(() => {
    const rand = mulberry32(12345 + g * 101 + pPct)
    let deadT = 0
    let deadP = 0
    for (let s = 0; s < SIMS; s++) {
      const grp = drawGroup(rand, p, g, w)
      const allSamePass = grp.every((r) => r.pass === grp[0].pass)
      if (allSamePass) deadT++
      const allSameState = grp.every((r) => r.pass === grp[0].pass && r.k === grp[0].k)
      if (allSameState) deadP++
    }
    return { t: deadT / SIMS, p: deadP / SIMS }
  }, [g, pPct, p, w])

  const exact = mpow(1 - p, g)
  const passes = group.filter((r) => r.pass).length

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-foreground">One GRPO group, two rewards</span>
        <span className="font-mono text-[10px] text-muted-foreground">plateaus from the paper · their odds are a toy</span>
      </div>

      <div className="grid gap-3 border-b px-4 py-3 sm:grid-cols-2">
        <label className="block">
          <span className="flex justify-between font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
            <span>solve rate p</span>
            <span className="text-foreground">{pPct}%</span>
          </span>
          <Range min={0} max={50} step={1} value={pPct} onChange={(e) => setPPct(Number(e.target.value))} aria-label="Solve rate p in percent" />
        </label>
        <label className="block">
          <span className="flex justify-between font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
            <span>shaping weight λ</span>
            <span className="text-foreground">{lam.toFixed(2)}</span>
          </span>
          <Range min={0} max={100} step={5} value={lamPct} onChange={(e) => setLamPct(Number(e.target.value))} aria-label="Shaping weight lambda" />
        </label>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 font-mono text-[10px] uppercase tracking-wide text-muted-foreground">group size G</span>
          {GS.map((x) => (
            <button key={x} type="button" aria-pressed={g === x} className={pill(g === x)} onClick={() => setG(x)}>
              {x}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <button type="button" className={pill(false)} onClick={() => setSeed((s) => s + 1)}>
            draw another group
          </button>
          <span className="font-mono text-[10px] text-muted-foreground">
            {passes} of {g} passed
          </span>
        </div>
      </div>

      <div className="overflow-x-auto px-4 py-3">
        <table className="my-0 w-full min-w-[520px] border-collapse text-[11px]">
          <thead>
            <tr className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
              <th className="py-1 pr-2 text-left font-normal">#</th>
              <th className="py-1 pr-2 text-left font-normal">where it stopped</th>
              <th className="py-1 pr-2 text-right font-normal">Φ(s_T)</th>
              <th className="w-[22%] py-1 pr-2 text-left font-normal" style={{ color: C_TERM }}>
                terminal Â
              </th>
              <th className="w-[22%] py-1 text-left font-normal" style={{ color: C_PPRS }}>
                PPRS Â
              </th>
            </tr>
          </thead>
          <tbody>
            {group.map((r, i) => (
              <tr key={i} className="border-b border-border/40 last:border-0">
                <td className="py-0.5 pr-2 font-mono text-muted-foreground">{i + 1}</td>
                <td className="py-0.5 pr-2">{r.pass ? <span className="font-medium">passed and submitted</span> : PLATEAUS[r.k].label}</td>
                <td className="py-0.5 pr-2 text-right font-mono">{r.phi.toFixed(2)}</td>
                <td className="py-0.5 pr-2">
                  <div className="flex items-center gap-1.5">
                    <Bar a={term.adv[i]} color={C_TERM} />
                    <span className="w-10 shrink-0 text-right font-mono text-[10px]">{fmt(term.adv[i])}</span>
                  </div>
                </td>
                <td className="py-0.5">
                  <div className="flex items-center gap-1.5">
                    <Bar a={pprs.adv[i]} color={C_PPRS} />
                    <span className="w-10 shrink-0 text-right font-mono text-[10px]">{fmt(pprs.adv[i])}</span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid gap-px border-t bg-border sm:grid-cols-2">
        <div className="bg-background px-4 py-3 text-xs">
          <div className="mb-1 font-mono text-[10px] uppercase tracking-wide" style={{ color: C_TERM }}>
            terminal reward 1[pass]
          </div>
          {term.std < 1e-9 ? (
            <p className="my-0">Every reward is the same, so the group std is 0 and every advantage is 0. This task adds nothing to the gradient.</p>
          ) : (
            <p className="my-0">
              Passes get a positive advantage; every failure gets the same negative one, whether it stopped at 0 or at 0.90.
            </p>
          )}
          <p className="my-0 mt-2 font-mono text-[10px] text-muted-foreground">
            all-fail chance (1−p)^G = {(exact * 100).toFixed(1)}% · zero-signal groups in {SIMS.toLocaleString("en-US")} draws: {(sim.t * 100).toFixed(1)}%
          </p>
        </div>
        <div className="bg-background px-4 py-3 text-xs">
          <div className="mb-1 font-mono text-[10px] uppercase tracking-wide" style={{ color: C_PPRS }}>
            PPRS 1[pass] + λ·Φ(s_T)
          </div>
          {pprs.std < 1e-9 ? (
            <p className="my-0">
              {lam === 0
                ? "With λ = 0 this is the terminal reward again."
                : "Every rollout stopped in the same place, so even the shaped rewards tie. This is the only way a PPRS group goes silent."}
            </p>
          ) : (
            <p className="my-0">Failures are ranked by how far they got. A pass still outscores any failure: it earns 1 + λ, a failure at most λ.</p>
          )}
          <p className="my-0 mt-2 font-mono text-[10px] text-muted-foreground">
            zero-signal groups in {SIMS.toLocaleString("en-US")} draws: {(sim.p * 100).toFixed(1)}%
          </p>
        </div>
      </div>
    </figure>
  )
}
