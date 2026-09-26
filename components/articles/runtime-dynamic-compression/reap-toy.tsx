"use client"

import { useMemo, useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { mcos, mpow } from "@/lib/dmath"
import { cn } from "@/lib/utils"

// Static REAP vs dynamic REAP on one toy MoE layer.
//
// The swap rule is the paper's (Section 3.2), implemented as written:
//   - every expert's UNMASKED routing probability p_e(t) is tracked, resident
//     or not, with two exponential averages m_h = beta_h m_h + (1 - beta_h) p,
//     beta_h = 2^(-1/h), half-lives h = 100 and 1000 tokens          (Eq. 8)
//   - rank = 0.5 m_100 + 0.5 m_1000                                    (Eq. 9)
//   - every 256 routed tokens, pair non-residents in descending rank with
//     residents in ascending rank; if at least four pairs have an incoming
//     rank more than 5% above the outgoing one, exchange the first four;
//     otherwise leave the set alone
//   - residency K never changes; only membership does
// Swaps land at the checkpoint here. In the real system the transfer is
// prepared asynchronously and swapped in at a token boundary when ready.
//
// Everything else is synthetic, and the numbers it prints are not the paper's:
// 32 experts, a stream of four 2,048-token "domains" A-D, each with its own
// Zipf-shaped routing preference over a shuffled expert order, a slow drift
// inside each domain, and per-token noise from a seeded PRNG. Static REAP keeps
// the K experts with the most routing mass on one calibration domain. The
// metric is the paper's "hit rate": the share of routing probability that lands
// on resident experts.
//
// Deterministic: mulberry32 is integer arithmetic, and the only transcendental
// calls go through lib/dmath, so SSR and hydration agree.

const E = 32
const SEG = 2048
const DOMS = 4
const T = SEG * DOMS
const CHECK = 256
const ZIPF = 1.6
const DOMAIN_NAMES = ["A", "B", "C", "D"]

function mulberry32(seed: number) {
  let a = seed | 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

let STREAM: Float64Array | null = null

// Routing probabilities for every token, row-major [T][E]. Built once.
function stream(): Float64Array {
  if (STREAM) return STREAM
  const rnd = mulberry32(7)
  const zipf = Array.from({ length: E }, (_, r) => 1 / mpow(r + 1, ZIPF))
  const shuffled = () => {
    const p = Array.from({ length: E }, (_, i) => i)
    for (let i = E - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1))
      const t = p[i]
      p[i] = p[j]
      p[j] = t
    }
    const w = new Array<number>(E)
    p.forEach((e, r) => (w[e] = zipf[r]))
    const z = w.reduce((a, b) => a + b, 0)
    return w.map((x) => x / z)
  }
  const main = Array.from({ length: DOMS }, shuffled)
  const drift = Array.from({ length: DOMS }, shuffled)
  const out = new Float64Array(T * E)
  for (let t = 0; t < T; t++) {
    const d = Math.floor(t / SEG)
    const u = (t % SEG) / SEG
    const m = 0.35 * (0.5 - 0.5 * mcos(4 * Math.PI * u))
    let z = 0
    for (let e = 0; e < E; e++) {
      const v = ((1 - m) * main[d][e] + m * drift[d][e]) * (0.5 + rnd())
      out[t * E + e] = v
      z += v
    }
    for (let e = 0; e < E; e++) out[t * E + e] /= z
  }
  STREAM = out
  return out
}

type Result = { cover: Float64Array; swaps: number[] }

function simulate(K: number, calib: number, dynamic: boolean): Result {
  const P = stream()
  const mass = new Array<number>(E).fill(0)
  for (let t = calib * SEG; t < (calib + 1) * SEG; t++) for (let e = 0; e < E; e++) mass[e] += P[t * E + e]
  const order = Array.from({ length: E }, (_, e) => e).sort((a, b) => mass[b] - mass[a] || a - b)
  const resident = new Uint8Array(E)
  for (let k = 0; k < K; k++) resident[order[k]] = 1

  const b100 = mpow(2, -1 / 100)
  const b1000 = mpow(2, -1 / 1000)
  const m1 = new Array<number>(E).fill(1 / E)
  const m2 = new Array<number>(E).fill(1 / E)
  const cover = new Float64Array(T)
  const swaps: number[] = []

  for (let t = 0; t < T; t++) {
    let c = 0
    for (let e = 0; e < E; e++) {
      const p = P[t * E + e]
      if (resident[e]) c += p
      m1[e] = b100 * m1[e] + (1 - b100) * p
      m2[e] = b1000 * m2[e] + (1 - b1000) * p
    }
    cover[t] = c
    if (dynamic && (t + 1) % CHECK === 0) {
      const rank = m1.map((v, e) => 0.5 * v + 0.5 * m2[e])
      const ins = Array.from({ length: E }, (_, e) => e)
        .filter((e) => !resident[e])
        .sort((a, b) => rank[b] - rank[a] || a - b)
      const outs = Array.from({ length: E }, (_, e) => e)
        .filter((e) => resident[e])
        .sort((a, b) => rank[a] - rank[b] || a - b)
      const n = Math.min(ins.length, outs.length)
      let qualifying = 0
      for (let k = 0; k < n; k++) if (rank[ins[k]] > 1.05 * rank[outs[k]]) qualifying++
      if (qualifying >= 4) {
        for (let k = 0; k < 4; k++) {
          resident[outs[k]] = 0
          resident[ins[k]] = 1
        }
        swaps.push(t + 1)
      }
    }
  }
  return { cover, swaps }
}

const mean = (a: Float64Array, lo: number, hi: number) => {
  let s = 0
  for (let t = lo; t < hi; t++) s += a[t]
  return s / (hi - lo)
}

const STATIC = "oklch(0.66 0.16 45)"
const DYN = "oklch(0.6 0.16 250)"

const W = 720
const H = 230
const PL = 40
const PR = 10
const PT = 22
const PB = 30
const WIN = 128
const STEP = 32

export function ReapToy() {
  const [K, setK] = useState(16)
  const [calib, setCalib] = useState(0)

  const { st, dy } = useMemo(
    () => ({ st: simulate(K, calib, false), dy: simulate(K, calib, true) }),
    [K, calib]
  )

  const sx = (t: number) => PL + (t / T) * (W - PL - PR)
  const sy = (v: number) => PT + (1 - v) * (H - PT - PB)

  const line = (cover: Float64Array) => {
    const pts: string[] = []
    for (let t = WIN; t <= T; t += STEP) {
      const v = mean(cover, t - WIN, t)
      pts.push(`${pts.length === 0 ? "M" : "L"}${sx(t).toFixed(1)},${sy(v).toFixed(1)}`)
    }
    return pts.join(" ")
  }

  const perDomain = DOMAIN_NAMES.map((_, d) => ({
    s: mean(st.cover, d * SEG, (d + 1) * SEG),
    y: mean(dy.cover, d * SEG, (d + 1) * SEG),
  }))
  const allS = mean(st.cover, 0, T)
  const allD = mean(dy.cover, 0, T)
  const pc = (v: number) => `${(v * 100).toFixed(1)}%`

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          static vs dynamic REAP · one toy layer, the paper&apos;s swap rule
        </span>
        <div className="flex items-center gap-1">
          <span className="font-mono text-xs text-muted-foreground">calibrate on</span>
          {DOMAIN_NAMES.map((n, d) => (
            <button
              key={n}
              type="button"
              onClick={() => setCalib(d)}
              aria-pressed={calib === d}
              className={cn(
                "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-xs transition-colors",
                calib === d
                  ? "border-foreground/30 bg-muted/50 text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              {n}
            </button>
          ))}
        </div>
      </div>

      <div className="p-3 sm:p-4">
        <label className="flex flex-wrap items-center gap-3 font-mono text-xs text-muted-foreground">
          <span>resident experts</span>
          <Range
            min={8}
            max={24}
            step={4}
            value={K}
            onChange={(e) => setK(Number(e.target.value))}
            aria-label="Resident experts out of 32"
            className="w-44"
          />
          <span className="text-foreground tabular-nums">
            {K} of {E} ({Math.round((K / E) * 100)}% residency)
          </span>
        </label>

        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="mt-3 w-full"
          role="img"
          aria-label={`Share of routing probability on resident experts over an 8,192-token toy stream with four domains, ${K} of 32 experts resident, static set calibrated on domain ${DOMAIN_NAMES[calib]}. Static averages ${pc(allS)}, dynamic ${pc(allD)}.`}
        >
          {DOMAIN_NAMES.map((n, d) => (
            <g key={n}>
              <rect
                x={sx(d * SEG)}
                y={PT}
                width={sx(SEG) - sx(0)}
                height={H - PT - PB}
                fill="currentColor"
                fillOpacity={d === calib ? 0.07 : d % 2 === 0 ? 0.025 : 0}
              />
              <text x={sx(d * SEG + SEG / 2)} y={PT - 8} textAnchor="middle" fontSize="10" className="fill-muted-foreground font-mono">
                domain {n}
                {d === calib ? " · calibration" : ""}
              </text>
            </g>
          ))}
          {[0, 0.25, 0.5, 0.75, 1].map((v) => (
            <g key={v}>
              <line x1={PL} y1={sy(v)} x2={W - PR} y2={sy(v)} stroke="currentColor" strokeOpacity="0.07" />
              <text x={PL - 6} y={sy(v) + 3} textAnchor="end" fontSize="10" className="fill-muted-foreground font-mono">
                {v * 100}%
              </text>
            </g>
          ))}
          {dy.swaps.map((t) => (
            <line key={t} x1={sx(t)} y1={H - PB} x2={sx(t)} y2={H - PB + 6} stroke={DYN} strokeWidth="1.5" />
          ))}
          <text x={PL} y={H - 6} fontSize="10" className="fill-muted-foreground font-mono">
            ticks: checkpoints that swapped four experts ({dy.swaps.length} of {T / CHECK} checkpoints)
          </text>
          <path d={line(st.cover)} fill="none" stroke={STATIC} strokeWidth="2" />
          <path d={line(dy.cover)} fill="none" stroke={DYN} strokeWidth="2.25" />
        </svg>

        <div className="mt-2 overflow-x-auto">
          <table className="my-0 w-full min-w-[420px] border-collapse font-mono text-xs">
            <thead>
              <tr className="border-b text-muted-foreground">
                <th className="px-2 py-1 text-left font-medium">hit rate</th>
                {DOMAIN_NAMES.map((n) => (
                  <th key={n} className="px-2 py-1 text-right font-medium">
                    {n}
                  </th>
                ))}
                <th className="px-2 py-1 text-right font-medium">all</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b">
                <td className="px-2 py-1" style={{ color: STATIC }}>
                  static
                </td>
                {perDomain.map((r, d) => (
                  <td key={d} className="px-2 py-1 text-right tabular-nums">
                    {pc(r.s)}
                  </td>
                ))}
                <td className="px-2 py-1 text-right tabular-nums">{pc(allS)}</td>
              </tr>
              <tr>
                <td className="px-2 py-1" style={{ color: DYN }}>
                  dynamic
                </td>
                {perDomain.map((r, d) => (
                  <td key={d} className="px-2 py-1 text-right tabular-nums">
                    {pc(r.y)}
                  </td>
                ))}
                <td className="px-2 py-1 text-right font-semibold tabular-nums">{pc(allD)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          The static set is right only on its own domain. The dynamic set starts from the same experts, and
          after each shift it climbs back in steps of four swaps per checkpoint, lagging by the time the
          running averages need to notice. More residency helps both; it helps static REAP only where its
          calibration domain overlaps the traffic.
        </p>
        <p className="mt-1 text-xs leading-5 text-muted-foreground/80">
          Illustrative: synthetic routing, 32 experts, one layer. The swap rule is the paper&apos;s; the
          percentages are not.
        </p>
      </div>
    </figure>
  )
}
