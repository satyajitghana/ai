"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// How one consecutive-rank isomorphism collapses every free group factor.
// Family 287 proves L(F_n) ≅ L(F_{n+1}) for every n ≥ 3, so all L(F_n) with
// n ≥ 3 are one algebra. The amplification formula of Dykema and Rădulescu says
// that the corner of L(F_r) cut down by a projection of trace t (or, for t > 1,
// the t-amplification) is L(F_{1 + (r − 1)/t²}). Cutting the single algebra
// {L(F_n) : n ≥ 3} down by the same t therefore identifies every image rank.
// Only + − × ÷ and sqrt are used, all exactly rounded, so SSR and client agree.

const RANKS = [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17]
const X_MIN = 1
const X_MAX = 6
const W = 640
const H = 120
const PAD = 28

function xOf(r: number): number {
  return PAD + ((r - X_MIN) / (X_MAX - X_MIN)) * (W - 2 * PAD)
}

function fmt(v: number): string {
  const r = Math.round(v * 1000) / 1000
  return Number.isInteger(r) ? String(r) : r.toFixed(3).replace(/0+$/, "")
}

export function FreeGroupCompression() {
  const [t, setT] = useState(1.5)
  const images = RANKS.map((n) => ({ n, r: 1 + (n - 1) / (t * t) }))
  const visible = images.filter((p) => p.r <= X_MAX)
  const integerHits = visible.filter((p) => Math.abs(p.r - Math.round(p.r)) < 0.0005 && p.r >= 2)
  const presets: { label: string; value: number }[] = [
    { label: "t = 1", value: 1 },
    { label: "t = √2", value: Math.sqrt(2) },
    { label: "t = 2", value: 2 },
  ]

  return (
    <figure className="my-8 rounded-xl border border-border bg-card p-4 not-prose">
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <label htmlFor="fgc-t" className="text-muted-foreground">
          amplification t
        </label>
        <input
          id="fgc-t"
          type="range"
          min={0.6}
          max={2.4}
          step={0.005}
          value={t}
          onChange={(e) => setT(Number(e.target.value))}
          className="hg-range w-48"
          aria-valuetext={`t = ${fmt(t)}`}
        />
        <span className="font-mono tabular-nums">t = {fmt(t)}</span>
        <span className="flex gap-1.5">
          {presets.map((p) => (
            <button
              key={p.label}
              type="button"
              onClick={() => setT(p.value)}
              className={cn(
                "rounded-full border px-2.5 py-0.5 text-xs",
                Math.abs(t - p.value) < 0.0005 ? "border-foreground/60 bg-foreground/10" : "border-border text-muted-foreground",
              )}
            >
              {p.label}
            </button>
          ))}
        </span>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} className="mt-3 w-full" role="img" aria-label="Image ranks of the free group factors after compression">
        <line x1={PAD} x2={W - PAD} y1={70} y2={70} className="stroke-muted-foreground" strokeWidth={1} />
        {[1, 2, 3, 4, 5, 6].map((k) => (
          <g key={k}>
            <line x1={xOf(k)} x2={xOf(k)} y1={64} y2={76} className="stroke-muted-foreground" strokeWidth={1} />
            <text x={xOf(k)} y={96} textAnchor="middle" className="fill-muted-foreground text-[11px]">
              {k}
            </text>
          </g>
        ))}
        {visible.length > 1 ? (
          <line
            x1={xOf(visible[0].r)}
            x2={xOf(visible[visible.length - 1].r)}
            y1={70}
            y2={70}
            className="stroke-violet-500"
            strokeWidth={3}
            strokeOpacity={0.35}
          />
        ) : null}
        {visible.map((p) => {
          const hit = Math.abs(p.r - Math.round(p.r)) < 0.0005
          return (
            <g key={p.n}>
              <circle cx={xOf(p.r)} cy={70} r={hit ? 6 : 4} className={hit ? "fill-emerald-500" : "fill-violet-500"} />
              {p.n <= 6 || hit ? (
                <text x={xOf(p.r)} y={52} textAnchor="middle" className="fill-foreground text-[10px]">
                  {`F${p.n}`}
                </text>
              ) : null}
            </g>
          )
        })}
        <text x={PAD} y={20} className="fill-muted-foreground text-[11px]">
          image rank 1 + (n − 1)/t² of each L(F_n), n ≥ 3 (all one algebra by Theorem 1.1)
        </text>
      </svg>

      <p className="mt-2 text-sm">
        {integerHits.length >= 2 ? (
          <>
            Integer ranks identified at this t:{" "}
            <span className="font-medium">{integerHits.map((p) => `L(F${Math.round(p.r)})`).join(" ≅ ")}</span>.
          </>
        ) : (
          <>
            Every dot is the same algebra, so L(F<sub>r</sub>) ≅ L(F<sub>s</sub>) for each pair of dots shown, e.g.{" "}
            <span className="font-mono">
              {fmt(images[0].r)} and {fmt(images[1].r)}
            </span>
            .
          </>
        )}
      </p>
      <figcaption className="mt-3 text-xs text-muted-foreground">
        The deduction from Theorem 1.1 to the headline, computed exactly. The amplification formula is
        Dykema&apos;s and Rădulescu&apos;s (1994); the consecutive-rank isomorphism is the paper&apos;s new
        input. At t = √2 the image of L(F₃) is L(F₂) and the image of L(F₅) is L(F₃), so L(F₂) ≅ L(F₃).
      </figcaption>
    </figure>
  )
}
