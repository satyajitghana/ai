"use client"

import { useMemo, useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { mcos, mlog } from "@/lib/dmath"

// The verdict rule from pmndrs/labs (src/stats.ts, commit b65ac37), ported
// line for line where it decides anything:
//   - each fresh-process block contributes ONE number, its median
//   - mannWhitneyNullDistribution: the exact tie-free null of U, built by the
//     same recurrence labs uses (largest value comes from group one with
//     probability m/(m+n))
//   - p = two-sided exact tail of that distribution
//   - hodgesLehmannDelta: median of all candidate/baseline ratios, minus one,
//     with the interval read at the exact critical rank
//   - relativeSpread = 1.4826 * MAD / median, minDetectableEffect =
//     2.8 * spread * sqrt(2 / blocks), the worse of the two sides shown
//   - verdict: faster/slower only when p <= 0.05 AND |HL| >= 0.05
// The block medians themselves are simulated: baseline 1.0 and candidate
// (1 + effect), each with gaussian noise of the chosen relative spread, from a
// seeded generator so the server and the browser draw the same numbers.

const ALPHA = 0.05
const MIN_DELTA = 0.05

function rng(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function gauss(next: () => number) {
  const u = Math.max(next(), 1e-12)
  const v = next()
  return Math.sqrt(-2 * mlog(u)) * mcos(2 * Math.PI * v)
}

const median = (a: number[]) => {
  const s = a.slice().sort((x, y) => x - y)
  const m = s.length >> 1
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

const relSpread = (a: number[]) => {
  if (a.length < 2) return 0
  const m = median(a)
  return (1.4826 * median(a.map((v) => Math.abs(v - m)))) / m
}

function nullDist(n1: number, n2: number) {
  const width = n1 * n2 + 1
  let table: Float64Array[] = Array.from({ length: n1 + 1 }, () => {
    const r = new Float64Array(width)
    r[0] = 1
    return r
  })
  for (let n = 1; n <= n2; n++) {
    const next: Float64Array[] = []
    for (let m = 0; m <= n1; m++) {
      const row = new Float64Array(width)
      if (m === 0) row[0] = 1
      else {
        const pm = m / (m + n)
        const one = next[m - 1]
        const two = table[m]
        for (let u = 0; u < width; u++) row[u] = pm * (u >= n ? one[u - n] : 0) + (1 - pm) * two[u]
      }
      next.push(row)
    }
    table = next
  }
  return table[n1]
}

function analyse(base: number[], cand: number[]) {
  const n1 = base.length
  const n2 = cand.length
  // U for the baseline group: how many (baseline, candidate) pairs have baseline > candidate
  let U = 0
  for (const b of base) for (const c of cand) U += b > c ? 1 : b === c ? 0.5 : 0
  const dist = nullDist(n1, n2)
  let lower = 0
  let upper = 0
  for (let u = 0; u < dist.length; u++) {
    if (u <= U) lower += dist[u]
    if (u >= U) upper += dist[u]
  }
  const p = Math.min(1, 2 * Math.min(lower, upper))
  let cum = 0
  let critical = -1
  for (let u = 0; u < dist.length; u++) {
    cum += dist[u]
    if (cum <= ALPHA / 2 + 1e-12) critical = u
    else break
  }
  const ratios: number[] = []
  for (const c of cand) for (const b of base) ratios.push(c / b)
  ratios.sort((x, y) => x - y)
  const lo = Math.max(0, critical)
  const hi = Math.min(ratios.length - 1, ratios.length - 1 - Math.max(0, critical))
  const hl = median(ratios) - 1
  const ciLow = ratios[Math.min(lo, hi)] - 1
  const ciHigh = ratios[Math.max(lo, hi)] - 1
  // the smallest p this many blocks can ever produce: one extreme ordering out of C(n1+n2, n1)
  const minP = 2 * dist[0]
  const resolution = Math.max(
    2.8 * relSpread(base) * Math.sqrt(2 / n1),
    2.8 * relSpread(cand) * Math.sqrt(2 / n2),
  )
  const significant = p <= ALPHA
  const large = Math.abs(hl) >= MIN_DELTA
  const verdict = significant && large ? (hl < 0 ? "faster" : "slower") : "neutral"
  return { p, minP, hl, ciLow, ciHigh, resolution, significant, large, verdict }
}

const W = 640
const H = 190
const BASE = "oklch(0.68 0.12 220)"
const CAND = "oklch(0.62 0.18 340)"

export function VerdictGate() {
  const [blocks, setBlocks] = useState(8)
  const [spread, setSpread] = useState(3)
  const [effect, setEffect] = useState(-6)
  const [seed, setSeed] = useState(7)

  const run = useMemo(() => {
    const next = rng(seed * 7919 + blocks * 31)
    const base: number[] = []
    const cand: number[] = []
    for (let i = 0; i < blocks; i++) base.push(1 + (spread / 100) * gauss(next))
    for (let i = 0; i < blocks; i++) cand.push((1 + effect / 100) * (1 + (spread / 100) * gauss(next)))
    return { base, cand, ...analyse(base, cand) }
  }, [blocks, spread, effect, seed])

  // timing axis: 0.6x to 1.4x of the baseline's true median
  const tx = (v: number) => Math.round((40 + ((v - 0.6) / 0.8) * (W - 80)) * 100) / 100
  // effect axis: -40% to +40%
  const ex = (d: number) => Math.round((40 + ((Math.max(-0.4, Math.min(0.4, d)) + 0.4) / 0.8) * (W - 80)) * 100) / 100

  const verdictText =
    run.verdict === "faster" ? "▲ faster" : run.verdict === "slower" ? "▼ slower" : "■ neutral"

  return (
    <figure
      className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent"
      aria-label="The pmndrs labs two-gate verdict on simulated block medians"
    >
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        role="img"
        aria-label={`${blocks} blocks a side, ${spread}% spread, true change ${effect}%: p ${run.p.toPrecision(2)}, Hodges-Lehmann ${(run.hl * 100).toFixed(1)}%, verdict ${run.verdict}`}
      >
        <text x={12} y={18} fontSize={11} className="font-mono" fill="var(--muted-foreground)">
          block medians, one dot per fresh process (time relative to the baseline)
        </text>
        <line x1={tx(1)} x2={tx(1)} y1={28} y2={92} stroke="var(--foreground)" strokeOpacity={0.2} strokeDasharray="3 3" />
        {run.base.map((v, i) => (
          <circle key={`b${i}`} cx={tx(v)} cy={46} r={5} fill={BASE} fillOpacity={0.85} />
        ))}
        {run.cand.map((v, i) => (
          <circle key={`c${i}`} cx={tx(v)} cy={74} r={5} fill={CAND} fillOpacity={0.85} />
        ))}
        <text x={12} y={50} fontSize={11} className="font-mono" fill={BASE}>base</text>
        <text x={12} y={78} fontSize={11} className="font-mono" fill={CAND}>cand</text>
        <text x={tx(0.6)} y={104} fontSize={10} className="font-mono" fill="var(--muted-foreground)">0.6x</text>
        <text x={tx(1) - 8} y={104} fontSize={10} className="font-mono" fill="var(--muted-foreground)">1.0x</text>
        <text x={tx(1.4) - 22} y={104} fontSize={10} className="font-mono" fill="var(--muted-foreground)">1.4x</text>

        <text x={12} y={128} fontSize={11} className="font-mono" fill="var(--muted-foreground)">
          Hodges-Lehmann change and its 95% interval; shaded band = the ±5% minDelta
        </text>
        <rect x={ex(-MIN_DELTA)} y={138} width={ex(MIN_DELTA) - ex(-MIN_DELTA)} height={26} fill="var(--foreground)" fillOpacity={0.07} />
        <line x1={ex(-0.4)} x2={ex(0.4)} y1={151} y2={151} stroke="var(--foreground)" strokeOpacity={0.25} />
        <line x1={ex(0)} x2={ex(0)} y1={140} y2={162} stroke="var(--foreground)" strokeOpacity={0.5} />
        <line x1={ex(run.ciLow)} x2={ex(run.ciHigh)} y1={151} y2={151} stroke={CAND} strokeWidth={3} />
        <line x1={ex(run.ciLow)} x2={ex(run.ciLow)} y1={145} y2={157} stroke={CAND} strokeWidth={2} />
        <line x1={ex(run.ciHigh)} x2={ex(run.ciHigh)} y1={145} y2={157} stroke={CAND} strokeWidth={2} />
        <circle cx={ex(run.hl)} cy={151} r={5} fill={CAND} />
        <text x={ex(-0.4)} y={180} fontSize={10} className="font-mono" fill="var(--muted-foreground)">−40% faster</text>
        <text x={ex(0.4) - 70} y={180} fontSize={10} className="font-mono" fill="var(--muted-foreground)">+40% slower</text>
      </svg>

      <div className="space-y-2 border-t px-4 py-3 font-mono text-xs text-muted-foreground">
        <label className="flex items-center gap-3">
          <span className="w-44 shrink-0">blocks per side {blocks}</span>
          <Range min={2} max={12} step={1} value={blocks} onChange={(e) => setBlocks(Number(e.currentTarget.value))} aria-label="fresh-process blocks per side" className="w-full" />
        </label>
        <label className="flex items-center gap-3">
          <span className="w-44 shrink-0">block-to-block noise {spread}%</span>
          <Range min={1} max={20} step={1} value={spread} onChange={(e) => setSpread(Number(e.currentTarget.value))} aria-label="relative noise between blocks" className="w-full" />
        </label>
        <label className="flex items-center gap-3">
          <span className="w-44 shrink-0">true change {effect > 0 ? "+" : ""}{effect}%</span>
          <Range min={-30} max={30} step={1} value={effect} onChange={(e) => setEffect(Number(e.currentTarget.value))} aria-label="true change in the candidate" accent={CAND} className="w-full" />
        </label>
        <div className="flex flex-wrap items-center gap-3 pt-1">
          <button
            type="button"
            onClick={() => setSeed((s) => s + 1)}
            className="rounded-md border px-2 py-1 text-foreground hover:bg-muted"
          >
            run it again
          </button>
          <span>same settings, fresh noise (run {seed - 6})</span>
        </div>
        <div className="grid grid-cols-[15rem_1fr] gap-x-4 gap-y-1 pt-1 text-[11px] tabular-nums">
          <span>gate 1: exact Mann-Whitney p ≤ 0.05</span>
          <span className={run.significant ? "text-foreground" : ""}>
            p = {run.p < 0.001 ? run.p.toExponential(1) : run.p.toFixed(3)} {run.significant ? "pass" : "fail"}
          </span>
          <span>gate 2: |Hodges-Lehmann| ≥ 5%</span>
          <span className={run.large ? "text-foreground" : ""}>
            {(run.hl * 100).toFixed(1)}% [{(run.ciLow * 100).toFixed(1)}, {(run.ciHigh * 100).toFixed(1)}] {run.large ? "pass" : "fail"}
          </span>
          <span>smallest p {blocks} vs {blocks} blocks can give</span>
          <span className={run.minP > ALPHA ? "text-foreground" : ""}>
            {run.minP < 0.001 ? run.minP.toExponential(1) : run.minP.toFixed(3)}
            {run.minP > ALPHA ? " (can never pass gate 1)" : ""}
          </span>
          <span>resolution, 2.8·spread·√(2/blocks)</span>
          <span className={run.resolution > MIN_DELTA ? "text-foreground" : ""}>
            ~±{(run.resolution * 100).toFixed(1)}%{run.resolution > MIN_DELTA ? " (coarser than 5%: flagged)" : ""}
          </span>
          <span>verdict</span>
          <span className="text-foreground">{verdictText}</span>
        </div>
      </div>
    </figure>
  )
}
