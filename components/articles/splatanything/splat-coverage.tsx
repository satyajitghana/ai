"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { mexp } from "@/lib/dmath"
import { cn } from "@/lib/utils"

import { IDEAL_K, TOY } from "./data"

// One fixed scale predictor, many scenes. The predictor outputs the same
// Gaussian scale in normalized units everywhere (the worst case: it has no cue
// for scale at all), fitted in my numpy toy as the geometric mean of the ideal
// scale over six scenes. Here it lands on a patch of the chosen scene.
//
// ratio = predicted / ideal scale at the scene's median spacing, from the toy.
// Under RDNorm the ideal scale in normalized units is k * D / (f * s_r) and
// f grows with image width, so moving the resolution slider multiplies the
// ratio by W / W_scene. Under GSNorm the median spacing is pinned, so it does
// not move. Coverage is the alpha at the centre of a grid cell, between four
// Gaussians of peak opacity 1, sigma r (in spacings) at distance sqrt(0.5):
//   alpha = 1 - (1 - exp(-0.25 / r^2))^4
// which is the formula in gsnorm_toy.py.

const N = 7
const PITCH = 40
const PAD = 20
const SIZE = PAD * 2 + PITCH * (N - 1)

const alphaAt = (r: number) => {
  const q = 1 - mexp(-0.25 / (r * r))
  return 1 - q * q * q * q
}

export function SplatCoverage() {
  const [sceneId, setSceneId] = useState("cube")
  const [norm, setNorm] = useState<"RD" | "GS">("RD")
  const scene = TOY.find((s) => s.id === sceneId)!
  const [width, setWidth] = useState(scene.W)
  const ratio = norm === "GS" ? scene.ratio.GS : scene.ratio.RD * (width / scene.W)
  const r = IDEAL_K * ratio // sigma in units of the local Gaussian spacing
  const alpha = alphaAt(r)
  const verdict = alpha < 0.5 ? "holes" : ratio > 2 ? "over-smoothed" : "covered"
  const sigmaPx = r * PITCH
  const stops = [0, 0.25, 0.5, 0.75, 1].map((t) => ({ t, o: mexp(-(t * 3) * (t * 3) / 2) }))
  const desc = `${scene.label} under ${norm === "GS" ? "GSNorm" : "RDNorm"} at ${width} px: predicted scale is ${ratio.toFixed(2)} of ideal, alpha between Gaussians ${alpha.toFixed(2)}, ${verdict}.`

  const pick = (id: string) => {
    setSceneId(id)
    setWidth(TOY.find((s) => s.id === id)!.W)
  }

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/20 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>one scale predictor, six scenes</span>
        <span className="text-muted-foreground/60">numpy toy · worst case, no scale cue</span>
      </div>
      <div className="flex flex-wrap gap-1.5 px-4 pt-3">
        {TOY.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => pick(s.id)}
            className={cn(
              "rounded-md border px-2.5 py-1 font-mono text-[11px] transition-colors",
              sceneId === s.id ? "border-primary bg-primary/10 text-foreground" : "text-muted-foreground hover:bg-muted",
            )}
          >
            {s.label}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 pt-3">
        <div className="flex gap-1.5">
          {(["RD", "GS"] as const).map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setNorm(n)}
              className={cn(
                "rounded-md border px-2.5 py-1 font-mono text-[11px] transition-colors",
                norm === n ? "border-primary bg-primary/10 text-foreground" : "text-muted-foreground hover:bg-muted",
              )}
            >
              {n === "RD" ? "RDNorm" : "GSNorm"}
            </button>
          ))}
        </div>
        <label className="flex min-w-[240px] flex-1 items-center gap-3 font-mono text-[11px] text-muted-foreground">
          <span className="w-[112px] shrink-0">capture {width} px</span>
          <Range min={504} max={1022} step={2} value={width} onChange={(e) => setWidth(Number(e.target.value))} className="flex-1" />
        </label>
      </div>
      <div className="grid gap-4 p-4 sm:grid-cols-[auto_1fr] sm:p-5">
        <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="mx-auto w-full max-w-[280px]" role="img" aria-label={desc}>
          <defs>
            <radialGradient id="sa-splat">
              {stops.map((s) => (
                <stop key={s.t} offset={s.t} stopColor="currentColor" stopOpacity={s.o * 0.9} />
              ))}
            </radialGradient>
          </defs>
          <rect x={0} y={0} width={SIZE} height={SIZE} rx={10} fill="currentColor" className="text-muted/40" />
          <g className={verdict === "covered" ? "text-emerald-500" : verdict === "holes" ? "text-rose-500" : "text-amber-500"}>
            {Array.from({ length: N * N }, (_, k) => {
              const cx = PAD + (k % N) * PITCH
              const cy = PAD + Math.floor(k / N) * PITCH
              return <circle key={k} cx={cx} cy={cy} r={3 * sigmaPx} fill="url(#sa-splat)" />
            })}
          </g>
          {Array.from({ length: N * N }, (_, k) => (
            <circle key={`c${k}`} cx={PAD + (k % N) * PITCH} cy={PAD + Math.floor(k / N) * PITCH} r={1.5} className="fill-foreground/70" />
          ))}
        </svg>
        <div className="space-y-2 self-center font-mono text-xs">
          <div className="flex justify-between gap-4 border-b pb-1">
            <span className="text-muted-foreground">predicted / ideal scale</span>
            <span>{ratio.toFixed(2)}</span>
          </div>
          <div className="flex justify-between gap-4 border-b pb-1">
            <span className="text-muted-foreground">sigma / Gaussian spacing</span>
            <span>{r.toFixed(2)}</span>
          </div>
          <div className="flex justify-between gap-4 border-b pb-1">
            <span className="text-muted-foreground">alpha midway between centres</span>
            <span>{alpha.toFixed(2)}</span>
          </div>
          <div className="flex justify-between gap-4 border-b pb-1">
            <span className="text-muted-foreground">toy pixels with holes / blur</span>
            <span>
              {norm === "RD" && width !== scene.W ? "n/a" : `${Math.round(scene.holes[norm] * 100)}% / ${Math.round(scene.blur[norm] * 100)}%`}
            </span>
          </div>
          <div className={cn("pt-1 text-sm", verdict === "covered" ? "text-emerald-600 dark:text-emerald-400" : verdict === "holes" ? "text-rose-600 dark:text-rose-400" : "text-amber-600 dark:text-amber-400")}>
            {verdict === "holes" ? "Gaussians too small: gaps between centres" : verdict === "over-smoothed" ? "Gaussians twice too big: overlap, blur" : "Gaussians sized to the spacing"}
          </div>
        </div>
      </div>
      <figcaption className="border-t px-4 py-3 text-sm text-muted-foreground">
        Dots are Gaussian centres one spacing apart; discs are their footprints out to three sigma. Ideal sigma is{" "}
        {IDEAL_K} spacings. The predictor never changes: only the space it is read in does. Try the cubemap or the object at
        1022 px under RDNorm, then switch to GSNorm. The hole and blur shares count pixels whose local spacing puts them
        under half or over twice the ideal scale, so even GSNorm leaves the street&apos;s near ground and far walls
        mis-sized.
      </figcaption>
    </figure>
  )
}
