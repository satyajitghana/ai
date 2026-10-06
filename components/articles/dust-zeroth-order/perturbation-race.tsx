"use client"

import { useMemo, useState } from "react"

import { Range } from "@/components/articles/ui/range"
import {
  K_POINTS,
  SIGMA,
  T,
  WIDTHS,
  simulate,
  type MethodId,
} from "@/components/articles/dust-zeroth-order/probe-sim"
import { cn } from "@/lib/utils"

// Cosine between each zeroth-order estimate and the true weight gradient of one
// d x d linear layer, against the number of forward passes. One seeded run per
// width, computed on load by probe-sim.ts; the slider only moves the cursor.

const WEIGHT = "oklch(0.62 0.02 260)"
const SCALAR = "oklch(0.72 0.14 65)"
const TOKEN = "oklch(0.55 0.2 295)"

const METHODS: { id: MethodId; label: string; color: string; dims: (d: number) => number; dimsLabel: string }[] = [
  { id: "weight", label: "weight-space ES (antithetic)", color: WEIGHT, dims: (d) => d * d, dimsLabel: "d × d weights" },
  { id: "scalar", label: "activation noise, one reward per pass", color: SCALAR, dims: (d) => T * d, dimsLabel: "T × d activations" },
  { id: "token", label: "activation noise, one reward per token (Dust)", color: TOKEN, dims: (d) => d, dimsLabel: "d per token" },
]

const W = 640
const H = 300
const X0 = 48
const X1 = W - 16
const Y0 = 20
const Y1 = H - 44
const N = K_POINTS.length

const r2 = (n: number) => Math.round(n * 100) / 100
const sx = (i: number) => r2(X0 + (i / (N - 1)) * (X1 - X0))
const sy = (c: number) => r2(Y1 - Math.min(1, Math.max(0, c)) * (Y1 - Y0))

function fmtK(k: number) {
  return k >= 1024 ? `${k / 1024}k` : String(k)
}

export function PerturbationRace() {
  const [d, setD] = useState<number>(16)
  const [ki, setKi] = useState(7)
  const curves = useMemo(() => simulate(d), [d])
  const k = K_POINTS[ki]

  const summary = METHODS.map((m) => `${m.label}: cosine ${curves[m.id][ki].toFixed(2)}`).join("; ")

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          one linear layer · {T} tokens · same forward passes for all three
        </span>
        <span className="font-mono text-[11px] text-muted-foreground/60">runs in your browser</span>
      </div>

      <div className="p-3 sm:p-4">
        <div className="mb-3 flex flex-wrap items-center gap-1.5" role="group" aria-label="layer width d">
          <span className="mr-1 font-mono text-[11px] text-muted-foreground">width d</span>
          {WIDTHS.map((w) => (
            <button
              key={w}
              type="button"
              aria-pressed={d === w}
              onClick={() => setD(w)}
              className={cn(
                "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[11px] transition-colors",
                d === w
                  ? "border-foreground/30 bg-muted/40 text-foreground"
                  : "border-transparent text-muted-foreground hover:border-foreground/20 hover:text-foreground",
              )}
            >
              {w}
            </button>
          ))}
        </div>

        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`Width ${d}, ${k} forward passes. ${summary}.`}>
          <rect x={X0} y={Y0} width={X1 - X0} height={Y1 - Y0} fill="none" stroke="currentColor" strokeOpacity={0.12} />
          {[0, 0.25, 0.5, 0.75, 1].map((c) => (
            <g key={c}>
              <line x1={X0} y1={sy(c)} x2={X1} y2={sy(c)} stroke="currentColor" strokeOpacity={0.08} />
              <text x={X0 - 6} y={sy(c) + 4} textAnchor="end" className="fill-muted-foreground/70 font-mono" fontSize={11}>
                {c.toFixed(2)}
              </text>
            </g>
          ))}
          {K_POINTS.map((kk, i) => (
            <text key={kk} x={sx(i)} y={Y1 + 16} textAnchor="middle" className="fill-muted-foreground/70 font-mono" fontSize={11}>
              {fmtK(kk)}
            </text>
          ))}
          <text x={(X0 + X1) / 2} y={H - 8} textAnchor="middle" className="fill-muted-foreground font-mono" fontSize={12}>
            forward passes K (log scale)
          </text>
          <text x={X0 + 6} y={Y0 + 14} className="fill-muted-foreground font-mono" fontSize={12}>
            cosine to the true gradient
          </text>

          <line x1={sx(ki)} y1={Y0} x2={sx(ki)} y2={Y1} stroke="currentColor" strokeOpacity={0.35} strokeDasharray="3 3" />

          {METHODS.map((m) => {
            const ys = curves[m.id]
            const path = ys.map((c, i) => `${i === 0 ? "M" : "L"} ${sx(i)} ${sy(c)}`).join(" ")
            return (
              <g key={m.id}>
                <path d={path} fill="none" stroke={m.color} strokeWidth={2} strokeLinejoin="round" />
                {ys.map((c, i) => (
                  <circle key={i} cx={sx(i)} cy={sy(c)} r={i === ki ? 4.5 : 2.5} fill={m.color} />
                ))}
              </g>
            )
          })}
        </svg>

        <div className="mt-2 flex items-center gap-3">
          <span className="w-28 shrink-0 font-mono text-[11px] text-muted-foreground">K = {k}</span>
          <Range
            min={0}
            max={N - 1}
            step={1}
            value={ki}
            onChange={(ev) => setKi(Number(ev.target.value))}
            aria-label="forward passes"
            className="w-full"
          />
        </div>

        <table className="mt-3 w-full font-mono text-[11px]">
          <thead>
            <tr className="text-left text-muted-foreground">
              <th className="py-1 font-normal">estimator</th>
              <th className="py-1 font-normal">searched per reward</th>
              <th className="py-1 text-right font-normal">cosine at K = {k}</th>
            </tr>
          </thead>
          <tbody>
            {METHODS.map((m) => (
              <tr key={m.id} className="border-t border-foreground/10">
                <td className="py-1.5 pr-2">
                  <span className="mr-1.5 inline-block size-2 rounded-full" style={{ background: m.color }} />
                  {m.label}
                </td>
                <td className="py-1.5 pr-2 text-muted-foreground">
                  {m.dims(d).toLocaleString("en-US")} ({m.dimsLabel})
                </td>
                <td className="py-1.5 text-right tabular-nums">{curves[m.id][ki].toFixed(3)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <figcaption className="border-t px-4 py-2.5 text-xs text-muted-foreground">
        A toy, not the paper&apos;s model: one d × d linear layer with a quadratic loss at each of {T} tokens, noise scale σ = {SIGMA}, one seeded run per width.
        Weight-space ES gets antithetic pairs (K/2 of them), which is the kindest version of it. Token losses here do not interact, so the per-token
        estimator has none of the cross-token interference a real transformer adds through attention.
      </figcaption>
    </figure>
  )
}
