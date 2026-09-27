"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { mcos, mexp, mlog } from "@/lib/dmath"

// One query row of differential attention, with a needle in it.
//
// Two logit rows over the same n keys:
//   z1[j] = sigma * c[j]                                  + GAP at the needle
//   z2[j] = sigma * (rho * c[j] + sqrt(1 - rho^2) * e[j])
// so map 2's noise has correlation rho with map 1's, and moving rho changes only
// map 2. rho is the knob the analogy hides: a differential amplifier gets
// rho = 1 from the symmetry of its wiring; an attention head gets whatever its
// Q1K1 and Q2K2 projections happen to learn.
//
// A1 = softmax(z1), A2 = softmax(z2), D = A1 - lambda * A2 (the DIFF V1 row).
// The same arithmetic, in numpy, is in the article (diff_toy.py).
//
// Noise comes from a seeded mulberry32 + Box-Muller, so the server and the
// client draw the same numbers. Every transcendental goes through lib/dmath;
// everything after that is + - * / and sqrt, which are exact.

const MAX_N = 64
const GAP = 3 // needle logit advantage in map 1, in nats
const POS = "oklch(0.64 0.15 250)" // positive weight
const NEG = "oklch(0.70 0.17 45)" // negative weight

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

function gaussians(seed: number, count: number): number[] {
  const rnd = mulberry32(seed)
  const out: number[] = []
  while (out.length < count) {
    const u1 = 1 - rnd() // (0, 1]
    const u2 = rnd()
    const r = Math.sqrt(-2 * mlog(u1))
    out.push(r * mcos(2 * Math.PI * u2))
  }
  return out
}

function draws(seed: number) {
  const g = gaussians(seed * 7919 + 17, 2 * MAX_N)
  return { c: g.slice(0, MAX_N), e: g.slice(MAX_N) }
}

function softmax(z: number[]): number[] {
  const m = Math.max(...z)
  const ex = z.map((v) => mexp(v - m))
  const s = ex.reduce((a, b) => a + b, 0)
  return ex.map((v) => v / s)
}

function compute(n: number, sigma: number, rho: number, lam: number, seed: number) {
  const { c, e } = draws(seed)
  const needle = Math.min(n - 1, Math.round(n * 0.62))
  const b = Math.sqrt(1 - rho * rho)
  const z1: number[] = []
  const z2: number[] = []
  for (let j = 0; j < n; j++) {
    z1.push(sigma * c[j] + (j === needle ? GAP : 0))
    z2.push(sigma * (rho * c[j] + b * e[j]))
  }
  const a1 = softmax(z1)
  const a2 = softmax(z2)
  const d = a1.map((v, j) => v - lam * a2[j])

  let net = 0
  let abs = 0
  let negs = 0
  for (let j = 0; j < n; j++) {
    if (j === needle) continue
    net += d[j]
    abs += Math.abs(d[j])
    if (d[j] < 0) negs++
  }
  const dNeedle = d[needle]
  return {
    needle,
    a1,
    a2,
    d,
    single: { w: a1[needle], bg: 1 - a1[needle], share: a1[needle] },
    diff: {
      w: dNeedle,
      net,
      abs,
      negs,
      share: Math.abs(dNeedle) / (Math.abs(dNeedle) + abs),
    },
    lamStar: (1 - a1[needle]) / (1 - a2[needle]),
  }
}

// geometry (viewBox units)
const W = 720
const LX = 132 // cells start here
const RX = 708
const ROW_H = 30
const ROWS = [
  { key: "a1", y: 40, name: "A1 = softmax(z1)", sub: "row sums to 1" },
  { key: "a2", y: 92, name: "A2 = softmax(z2)", sub: "row sums to 1" },
  { key: "d", y: 144, name: "A1 − λ·A2", sub: "row sums to 1 − λ" },
] as const
const H = 196

const f3 = (v: number) => (Math.abs(v) < 0.0005 ? "0.000" : v.toFixed(3))
const signed = (v: number) => `${v >= 0 ? "+" : "−"}${f3(Math.abs(v))}`
const pct = (v: number) => `${(v * 100).toFixed(1)}%`

function Slider({
  label,
  value,
  shown,
  min,
  max,
  step,
  onChange,
  marker,
}: {
  label: string
  value: number
  shown: string
  min: number
  max: number
  step: number
  onChange: (v: number) => void
  marker?: { at: number; title: string }
}) {
  const markerPct =
    marker && marker.at >= min && marker.at <= max ? ((marker.at - min) / (max - min)) * 100 : null
  return (
    <label className="block">
      <span className="mb-1 flex items-center justify-between font-mono text-[10px] text-muted-foreground">
        <span>{label}</span>
        <span className="text-foreground tabular-nums">{shown}</span>
      </span>
      <span className="relative block">
        <Range
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-full cursor-pointer"
        />
        {markerPct !== null ? (
          <span
            aria-hidden
            title={marker!.title}
            className="pointer-events-none absolute -top-1.5 h-2 w-px"
            style={{ left: `${markerPct.toFixed(2)}%`, background: NEG }}
          />
        ) : null}
      </span>
    </label>
  )
}

export function AttentionPlayground() {
  const [lam, setLam] = useState(0.8)
  const [n, setN] = useState(32)
  const [sigma, setSigma] = useState(1)
  const [rho, setRho] = useState(0.9)
  const [seed, setSeed] = useState(7)

  const r = compute(n, sigma, rho, lam, seed)
  const cw = (RX - LX) / n
  const scale = Math.max(...r.a1, ...r.a2, ...r.d.map(Math.abs), 1e-9)
  const rowVals = { a1: r.a1, a2: r.a2, d: r.d }
  const gain = r.single.share > 0 ? r.diff.share / r.single.share : 0
  const nx = LX + r.needle * cw

  return (
    <figure className="my-8 overflow-hidden rounded-md border">
      <div className="border-b px-3 py-2 font-mono text-xs text-muted-foreground">
        one query row · {n} keys · needle at key {r.needle} with a {GAP}-nat head start in map 1 only
      </div>

      <div className="p-3 sm:p-4">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full"
          role="img"
          aria-label={`Three heatmap rows over ${n} keys. Map one puts ${pct(r.single.w)} of its weight on the needle. Map two, which has no needle signal, spreads its weight over the noise. The differential row, map one minus ${lam.toFixed(2)} times map two, puts ${f3(r.diff.w)} on the needle, has ${r.diff.negs} negative keys, and its background nets to ${signed(r.diff.net)}. Share of total absolute weight on the needle: ${pct(r.single.share)} for the single map, ${pct(r.diff.share)} for the differential map.`}
        >
          {/* needle column marker */}
          <path
            d={`M ${nx + cw / 2 - 5} 14 L ${nx + cw / 2 + 5} 14 L ${nx + cw / 2} 22 Z`}
            fill="currentColor"
            className="text-foreground"
          />
          <text
            x={nx + cw / 2}
            y={10}
            textAnchor="middle"
            className="fill-foreground font-mono"
            fontSize={11}
          >
            needle
          </text>
          <rect
            x={nx - 1.5}
            y={ROWS[0].y - 3}
            width={cw + 3}
            height={ROWS[2].y + ROW_H - ROWS[0].y + 6}
            rx={3}
            fill="none"
            stroke="currentColor"
            className="text-foreground"
            strokeWidth={1.2}
            opacity={0.55}
          />

          {ROWS.map((row) => {
            const vals = rowVals[row.key]
            return (
              <g key={row.key}>
                <text x={8} y={row.y + 12} className="fill-foreground font-mono" fontSize={12}>
                  {row.name}
                </text>
                <text
                  x={8}
                  y={row.y + 26}
                  className="fill-muted-foreground font-mono"
                  fontSize={10}
                >
                  {row.sub}
                </text>
                {vals.map((v, j) => {
                  const op = Math.sqrt(Math.min(1, Math.abs(v) / scale))
                  return (
                    <rect
                      key={j}
                      x={LX + j * cw + 0.5}
                      y={row.y}
                      width={Math.max(cw - 1, 0.5)}
                      height={ROW_H}
                      rx={Math.min(2.5, cw / 4)}
                      fill={v < 0 ? NEG : POS}
                      fillOpacity={op}
                      stroke="var(--border)"
                      strokeWidth={0.6}
                    />
                  )
                })}
              </g>
            )
          })}

          {/* legend */}
          <g transform={`translate(${LX}, ${H - 10})`}>
            <rect x={0} y={-7} width={9} height={9} rx={2} fill={POS} />
            <text x={14} y={1} className="fill-muted-foreground font-mono" fontSize={10}>
              positive weight
            </text>
            <rect x={120} y={-7} width={9} height={9} rx={2} fill={NEG} />
            <text x={134} y={1} className="fill-muted-foreground font-mono" fontSize={10}>
              negative weight
            </text>
            <text x={256} y={1} className="fill-muted-foreground font-mono" fontSize={10}>
              shade ∝ √|weight|, one scale for all three rows
            </text>
          </g>
        </svg>

        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          <div className="rounded-md border bg-muted/20 px-3 py-2">
            <div className="font-mono text-[10px] text-muted-foreground">single map · A1</div>
            <div className="mt-1.5 space-y-0.5 font-mono text-[11px] tabular-nums">
              <div className="flex justify-between">
                <span className="text-muted-foreground">on the needle</span>
                <span>{f3(r.single.w)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">on everything else</span>
                <span>{f3(r.single.bg)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">needle share</span>
                <span style={{ color: POS }}>{pct(r.single.share)}</span>
              </div>
            </div>
          </div>

          <div className="rounded-md border bg-muted/20 px-3 py-2">
            <div className="font-mono text-[10px] text-muted-foreground">differential · A1 − λ·A2</div>
            <div className="mt-1.5 space-y-0.5 font-mono text-[11px] tabular-nums">
              <div className="flex justify-between">
                <span className="text-muted-foreground">on the needle</span>
                <span>{f3(r.diff.w)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">rest, signed sum</span>
                <span>{signed(r.diff.net)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">rest, sum of |w|</span>
                <span>{f3(r.diff.abs)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">needle share</span>
                <span style={{ color: POS }}>{pct(r.diff.share)}</span>
              </div>
            </div>
          </div>

          <div className="rounded-md border bg-muted/20 px-3 py-2">
            <div className="font-mono text-[10px] text-muted-foreground">the λ that nets the rest to zero</div>
            <div className="mt-1.5 space-y-0.5 font-mono text-[11px] tabular-nums">
              <div className="flex justify-between">
                <span className="text-muted-foreground">λ* = (1 − A1ₙ)/(1 − A2ₙ)</span>
                <span style={{ color: NEG }}>{r.lamStar.toFixed(3)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">negative keys</span>
                <span>
                  {r.diff.negs} of {n - 1}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">share, diff ÷ single</span>
                <span>{gain.toFixed(2)}×</span>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-4 grid gap-x-6 gap-y-3 sm:grid-cols-2">
          <Slider
            label="λ, how much of A2 to subtract"
            value={lam}
            shown={lam.toFixed(2)}
            min={0}
            max={1}
            step={0.01}
            onChange={setLam}
            marker={{ at: r.lamStar, title: "λ* for this row" }}
          />
          <Slider
            label="context length n (keys)"
            value={n}
            shown={String(n)}
            min={8}
            max={MAX_N}
            step={4}
            onChange={setN}
          />
          <Slider
            label="noise level σ (logit std, nats)"
            value={sigma}
            shown={sigma.toFixed(2)}
            min={0}
            max={2}
            step={0.05}
            onChange={setSigma}
          />
          <Slider
            label="noise correlation ρ between the maps"
            value={rho}
            shown={rho.toFixed(2)}
            min={0}
            max={1}
            step={0.01}
            onChange={setRho}
          />
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setSeed((s) => s + 1)}
            className="cursor-pointer rounded-md border px-2 py-1 font-mono text-[10px] text-muted-foreground transition-colors hover:text-foreground"
          >
            redraw the noise
          </button>
          <span className="font-mono text-[10px] text-muted-foreground">
            draw #{seed} · the orange tick on the λ rail is λ* for this row
          </span>
        </div>
      </div>

      <p className="border-t px-3 py-3 text-sm leading-6 text-muted-foreground sm:px-4">
        Map 1 knows where the needle is; map 2 does not. Both see the same noise to the degree set by{" "}
        <span className="font-mono">ρ</span>. At the defaults (λ = 0.8, ρ = 0.9) the subtraction removes most of
        the background and the needle&apos;s share of the row&apos;s total weight goes up, although the
        needle&apos;s own weight goes slightly <em>down</em>: subtraction never adds mass to anything. Slide{" "}
        <span className="font-mono">ρ</span>{" "}to zero and the same subtraction makes things worse, because two
        independent noise patterns do not cancel, they add. Slide{" "}
        <span className="font-mono">n</span>{" "}up and λ*
        drifts: a λ that nets the background to zero for one row does not for the next, which is the
        argument for the per-token λ in DIFF V2. This is a toy with hand-set logits, not a trained model; in a
        real head, how correlated the two maps&apos; noise is gets learned, not wired.
      </p>
    </figure>
  )
}
