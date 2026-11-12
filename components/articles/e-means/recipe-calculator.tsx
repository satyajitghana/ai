"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { mcos, mpow } from "@/lib/dmath"
import { cn } from "@/lib/utils"

import { recipe, scheduledAlpha } from "./sim"

// The e-means recipe as FAISS 1.16.0 ships it (contrib/e_means/base.py): the batch
// law picks B from (n, k, T), rounded to a power of two and capped near n/2; the step
// law picks the peak EMA step alpha0 from (n, k, T, B), clamped to [1e-4, 1]; the step
// then follows a cosine down to 0.1 alpha0 over the run's M = T * ceil(n / B) updates.
// Lloyd is the corner of the same space: B = n and alpha = 1 at every update.

const EM = "oklch(0.62 0.16 250)"
const LL = "oklch(0.62 0.17 25)"

const groupDigits = (v: number) => String(Math.round(v)).replace(/\B(?=(\d{3})+(?!\d))/g, ",")
function short(v: number): string {
  if (v >= 1e9) return `${(v / 1e9).toFixed(v >= 1e10 ? 0 : 1)}B`
  if (v >= 1e6) return `${(v / 1e6).toFixed(v >= 1e7 ? 0 : 1)}M`
  if (v >= 1e3) return `${(v / 1e3).toFixed(v >= 1e4 ? 0 : 1)}k`
  return String(Math.round(v))
}

const W = 600
const H = 150
const X0 = 46
const X1 = 588
const Y0 = 12
const Y1 = 120

export function RecipeCalculator() {
  const [logN, setLogN] = useState(6)
  const [logK, setLogK] = useState(14)
  const [T, setT] = useState(3)
  const [law, setLaw] = useState<"throughput" | "quality">("throughput")

  const n = Math.round(mpow(10, logN))
  const k = 2 ** logK
  const tooFew = n / k < 8
  const r = recipe(n, k, T, law)
  const outside = n < 1e5 || n > 1e8 || k < 256 || k > 65536

  // alpha over the run, as a polyline of 80 samples
  const pts: string[] = []
  for (let i = 0; i <= 80; i++) {
    const t = (i / 80) * r.steps
    const a = scheduledAlpha(r.alpha0, t, r.steps)
    pts.push(`${(X0 + (i / 80) * (X1 - X0)).toFixed(2)},${(Y1 - a * (Y1 - Y0)).toFixed(2)}`)
  }
  const half = 0.5 * (1 + mcos(Math.PI * 0.5)) // the cosine's value halfway, for the label

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex items-center justify-between border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>The e-means recipe · FAISS 1.16.0 scaling laws</span>
        <span className="text-muted-foreground/50">computed from base.py</span>
      </div>
      <div className="space-y-2.5 p-3 font-mono text-[10px] sm:p-4">
        <label className="flex items-center gap-3">
          <span className="w-28 shrink-0 text-muted-foreground">points n = {short(n)}</span>
          <Range min={5} max={10} step={0.5} value={logN} onChange={(e) => setLogN(Number(e.target.value))} className="flex-1" aria-label="dataset size, log10" />
        </label>
        <label className="flex items-center gap-3">
          <span className="w-28 shrink-0 text-muted-foreground">clusters k = {short(k)}</span>
          <Range min={8} max={24} step={1} value={logK} onChange={(e) => setLogK(Number(e.target.value))} className="flex-1" aria-label="clusters, log2" />
        </label>
        <label className="flex items-center gap-3">
          <span className="w-28 shrink-0 text-muted-foreground">epochs T = {T}</span>
          <Range min={1} max={25} step={1} value={T} onChange={(e) => setT(Number(e.target.value))} className="flex-1" aria-label="epochs" />
        </label>
        <div className="flex items-center gap-1.5">
          <span className="w-28 shrink-0 text-muted-foreground">batch law</span>
          {(["throughput", "quality"] as const).map((l) => (
            <button key={l} type="button" onClick={() => setLaw(l)} aria-pressed={law === l} className={cn("cursor-pointer rounded-md border px-2 py-1 transition-colors", law === l ? "border-foreground/40 text-foreground" : "text-muted-foreground hover:text-foreground")}>
              {l}
            </button>
          ))}
          <span className="text-muted-foreground/70">(auto: quality at d ≤ 16)</span>
        </div>

        <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 pt-1 sm:grid-cols-4">
          <div>
            <dt className="text-muted-foreground">batch B</dt>
            <dd className="text-[12px] text-foreground">{groupDigits(r.B)}</dd>
            <dd className="text-muted-foreground/70">law said {groupDigits(r.rawB)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">peak step α₀</dt>
            <dd className="text-[12px] text-foreground">{r.alpha0.toFixed(4)}</dd>
            <dd className="text-muted-foreground/70">{r.alphaRaw > 1 ? `clamped from ${r.alphaRaw.toFixed(2)}` : "floor 0.1 α₀"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">centroid updates</dt>
            <dd className="text-[12px]" style={{ color: EM }}>
              {groupDigits(r.steps)}
            </dd>
            <dd style={{ color: LL }}>Lloyd: 25 in 25 epochs</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">points per cluster per batch</dt>
            <dd className="text-[12px] text-foreground">{(r.B / k).toFixed(r.B / k < 10 ? 2 : 0)}</dd>
            <dd className="text-muted-foreground/70">Lloyd: {short(n / k)}</dd>
          </div>
        </dl>

        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Step size alpha over the run, cosine from alpha0 to a tenth of it">
          {[0, 0.25, 0.5, 0.75, 1].map((v) => (
            <g key={v}>
              <line x1={X0} x2={X1} y1={Y1 - v * (Y1 - Y0)} y2={Y1 - v * (Y1 - Y0)} stroke="currentColor" opacity={0.08} />
              <text x={X0 - 6} y={Y1 - v * (Y1 - Y0) + 3} textAnchor="end" fontSize={9} className="fill-muted-foreground font-mono">
                {v}
              </text>
            </g>
          ))}
          <line x1={X0} x2={X1} y1={Y0} y2={Y0} stroke={LL} strokeDasharray="4 3" />
          <text x={X1} y={Y0 + 11} textAnchor="end" fontSize={9} fill={LL} className="font-mono">
            Lloyd: α = 1, B = n, every update
          </text>
          <polyline points={pts.join(" ")} fill="none" stroke={EM} strokeWidth={2} />
          <text x={X0 + 0.5 * (X1 - X0)} y={Y1 - r.alpha0 * (0.1 + 0.9 * half) * (Y1 - Y0) - 6} textAnchor="middle" fontSize={9} fill={EM} className="font-mono">
            e-means α(t)
          </text>
          <text x={X0} y={H - 12} fontSize={9} className="fill-muted-foreground font-mono">
            update 0
          </text>
          <text x={X1} y={H - 12} textAnchor="end" fontSize={9} className="fill-muted-foreground font-mono">
            update {groupDigits(r.steps)}
          </text>
        </svg>

        {(tooFew || outside) && (
          <p className="text-[10px] text-amber-600 dark:text-amber-400">
            {tooFew ? "n/k is below 8: the laws were never fitted there. " : ""}
            {outside ? "Outside the fitted range (1e5 ≤ n ≤ 1e8, 256 ≤ k ≤ 65,536): this is extrapolation." : ""}
          </p>
        )}
      </div>
      <figcaption className="border-t px-4 py-2.5 text-[11px] leading-relaxed text-muted-foreground">
        The shipped laws: B = 0.035134 · k^0.1347 · n^0.8765 · T^0.8133 (quality: one eighth of the
        constant), rounded to a power of two; α₀ = 0.8244 · k^−0.4617 · B^0.9003 · n^−0.4498 ·
        T^−0.1057, clamped to [0.0001, 1]. The defaults are the paper&apos;s ablation setting, DEEP at
        n = 1M, k = 16,384, T = 3.
      </figcaption>
    </figure>
  )
}
