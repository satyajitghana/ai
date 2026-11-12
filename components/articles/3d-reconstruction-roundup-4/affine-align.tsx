"use client"

import { useMemo, useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { cn } from "@/lib/utils"

import { errors, REGION_EDGES, simulate } from "./affine-math"

// One image row through a wall, an object and the floor. The monocular
// prediction is affine in true depth within each surface, with a different
// affine per surface. Pick how the prediction is turned back into metric depth
// and see the residual against the truth. All of it is computed live in
// affine-math.ts.

type Method = "global" | "regions" | "affinegs"

const METHODS: { id: Method; label: string; color: string }[] = [
  { id: "global", label: "one scale + shift", color: "oklch(0.64 0.17 30)" },
  { id: "regions", label: "one per surface", color: "oklch(0.6 0.13 160)" },
  { id: "affinegs", label: "AffineGS estimator", color: "oklch(0.55 0.15 255)" },
]

const W = 640
const H = 250
const RES_H = 70
const PAD_L = 40
const PAD_R = 12
const D_MIN = 0.8
const D_MAX = 3.6

export function AffineAlign() {
  const [method, setMethod] = useState<Method>("global")
  const [disagree, setDisagree] = useState(1)
  const [noise, setNoise] = useState(0.05)
  const [radius, setRadius] = useState(15)

  const sim = useMemo(() => simulate(disagree, noise, radius), [disagree, noise, radius])
  const target = sim[method]
  const m = METHODS.find((x) => x.id === method) ?? METHODS[0]

  const px = (x: number) => PAD_L + x * (W - PAD_L - PAD_R)
  const py = (d: number) => 10 + ((D_MAX - d) / (D_MAX - D_MIN)) * (H - 20)
  const line = (v: number[]) => v.map((d, i) => `${i ? "L" : "M"}${px(sim.x[i]).toFixed(2)},${py(d).toFixed(2)}`).join(" ")
  const resY0 = H + 22 + RES_H / 2
  const resScale = RES_H / 2 / 0.3
  const residual = target
    .map((d, i) => {
      const r = Math.max(-0.3, Math.min(0.3, d - sim.truth[i]))
      return `${i ? "L" : "M"}${px(sim.x[i]).toFixed(2)},${(resY0 - r * resScale).toFixed(2)}`
    })
    .join(" ")

  const all = METHODS.map((x) => ({ ...x, e: errors(sim[x.id], sim.truth) }))
  const renderErr = errors(sim.render, sim.truth)
  const cur = all.find((x) => x.id === method)?.e ?? all[0].e

  const desc = `Depth along one image row. ${m.label}: mean error ${(cur.mae * 100).toFixed(1)} centimetres, ${cur.inlier.toFixed(
    0,
  )} percent of pixels within 5 centimetres. The current render itself: ${(renderErr.mae * 100).toFixed(1)} centimetres.`

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/20 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>aligning monocular depth, one image row</span>
        <span className="text-muted-foreground/60">a toy, computed live; not the paper&apos;s data</span>
      </div>
      <div className="flex flex-wrap gap-2 px-4 pt-3">
        {METHODS.map((x) => (
          <button
            key={x.id}
            type="button"
            onClick={() => setMethod(x.id)}
            aria-pressed={method === x.id}
            className={cn(
              "rounded-full border px-3 py-1 font-mono text-[11px] transition-colors",
              method === x.id ? "border-foreground bg-foreground text-background" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {x.label}
          </button>
        ))}
      </div>
      <div className="px-2 pt-2">
        <svg viewBox={`0 0 ${W} ${H + RES_H + 34}`} className="h-auto w-full" role="img" aria-label={desc}>
          {REGION_EDGES.map((e) => (
            <line key={e} x1={px(e)} x2={px(e)} y1={6} y2={H + RES_H + 26} className="stroke-muted-foreground" strokeWidth={0.6} strokeDasharray="2 3" />
          ))}
          {["wall", "object", "floor"].map((t, i) => (
            <text
              key={t}
              x={px([0.175, 0.5, 0.825][i])}
              y={H - 2}
              textAnchor="middle"
              className="fill-muted-foreground font-mono"
              fontSize={10}
            >
              {t}
            </text>
          ))}
          {[1, 2, 3].map((d) => (
            <g key={d}>
              <line x1={PAD_L} x2={W - PAD_R} y1={py(d)} y2={py(d)} className="stroke-muted-foreground" strokeWidth={0.3} />
              <text x={PAD_L - 6} y={py(d) + 3} textAnchor="end" className="fill-muted-foreground font-mono" fontSize={10}>
                {d} m
              </text>
            </g>
          ))}
          <path d={line(sim.render)} fill="none" className="stroke-muted-foreground" strokeWidth={1} opacity={0.6} />
          <path d={line(sim.truth)} fill="none" className="stroke-foreground" strokeWidth={2} />
          <path d={line(target)} fill="none" stroke={m.color} strokeWidth={2} strokeDasharray="6 3" />
          <text x={PAD_L} y={H + 16} className="fill-muted-foreground font-mono" fontSize={10}>
            residual against true depth (±30 cm)
          </text>
          <line x1={PAD_L} x2={W - PAD_R} y1={resY0} y2={resY0} className="stroke-muted-foreground" strokeWidth={0.5} />
          <path d={residual} fill="none" stroke={m.color} strokeWidth={1.4} />
          <g className="font-mono" fontSize={10}>
            <line x1={W - 210} x2={W - 190} y1={18} y2={18} className="stroke-foreground" strokeWidth={2} />
            <text x={W - 185} y={21} className="fill-muted-foreground">
              true depth
            </text>
            <line x1={W - 210} x2={W - 190} y1={32} y2={32} className="stroke-muted-foreground" strokeWidth={1} />
            <text x={W - 185} y={35} className="fill-muted-foreground">
              current 3DGS render
            </text>
            <line x1={W - 210} x2={W - 190} y1={46} y2={46} stroke={m.color} strokeWidth={2} strokeDasharray="6 3" />
            <text x={W - 185} y={49} className="fill-muted-foreground">
              aligned prior
            </text>
          </g>
        </svg>
      </div>
      <div className="grid gap-3 px-4 pb-2 pt-1 sm:grid-cols-3">
        <label className="block font-mono text-[11px] text-muted-foreground">
          surfaces disagree: {disagree.toFixed(2)}
          <Range min={0} max={1} step={0.05} value={disagree} onChange={(e) => setDisagree(Number(e.target.value))} />
        </label>
        <label className="block font-mono text-[11px] text-muted-foreground">
          render noise: {(noise * 100).toFixed(0)} cm
          <Range min={0} max={0.12} step={0.01} value={noise} onChange={(e) => setNoise(Number(e.target.value))} />
        </label>
        <label className="block font-mono text-[11px] text-muted-foreground">
          guided-filter radius: {radius} of 360 px
          <Range min={4} max={120} step={1} value={radius} onChange={(e) => setRadius(Number(e.target.value))} />
        </label>
      </div>
      <figcaption className="grid gap-1 border-t px-4 py-3 font-mono text-[11px] text-muted-foreground sm:grid-cols-2">
        {all.map((x) => (
          <span key={x.id}>
            {x.label}: <span className="text-foreground">{(x.e.mae * 100).toFixed(1)} cm</span>, {x.e.inlier.toFixed(0)}% within 5 cm
          </span>
        ))}
        <span>
          the render it starts from: <span className="text-foreground">{(renderErr.mae * 100).toFixed(1)} cm</span>,{" "}
          {renderErr.inlier.toFixed(0)}% within 5 cm
        </span>
      </figcaption>
    </figure>
  )
}
