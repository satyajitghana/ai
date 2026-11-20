"use client"

import { useMemo, useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { mcos, msin } from "@/lib/dmath"
import { cn } from "@/lib/utils"

import { ROOM, simulate } from "./ba-math"

// Top-down: a 360 camera walked down a room, every frame seeing every wall
// point as a bearing. Headings are perturbed; points are triangulated with the
// noisy headings, then bundle adjustment re-solves headings and points together
// from the same bearings. Everything is computed live in ba-math.ts.

const W = 640
const H = 400
const SCALE = 70
const CX = W / 2
const CY = H / 2 - 4

const sx = (x: number) => CX + x * SCALE
const sy = (y: number) => CY - y * SCALE

type Show = "noisy" | "ba"

export function PoseNoiseBA() {
  const [nCams, setNCams] = useState(6)
  const [rot, setRot] = useState(2)
  const [pix, setPix] = useState(0.05)
  const [seed, setSeed] = useState(7)
  const [show, setShow] = useState<Show>("noisy")

  const sim = useMemo(() => simulate(nCams, rot, pix, seed), [nCams, rot, pix, seed])
  const pts = show === "noisy" ? sim.ptsNoisy : sim.ptsBA
  const heads = show === "noisy" ? sim.noisyHeads : sim.headsBA
  const color = show === "noisy" ? "oklch(0.62 0.19 30)" : "oklch(0.55 0.15 255)"
  const cm = (m: number) => (m * 100 >= 100 ? `${(m).toFixed(2)} m` : `${(m * 100).toFixed(1)} cm`)

  const desc = `Top view of a room 8 by 5 metres with ${nCams} camera positions along its middle. With ${rot} degrees of heading noise, points triangulated from the noisy headings are off by ${cm(
    sim.errNoisy,
  )} on average; after bundle adjustment, by ${cm(sim.errBA)}.`

  const hw = ROOM.w / 2
  const hh = ROOM.h / 2

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/20 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>pose noise, triangulation and bundle adjustment, top view</span>
        <span className="text-muted-foreground/60">a 2D toy, computed live</span>
      </div>
      <div className="flex flex-wrap gap-2 px-4 pt-3">
        {(
          [
            ["noisy", "triangulate with noisy poses"],
            ["ba", "after bundle adjustment"],
          ] as [Show, string][]
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setShow(id)}
            aria-pressed={show === id}
            className={cn(
              "rounded-full border px-3 py-1 font-mono text-[11px] transition-colors",
              show === id ? "border-foreground bg-foreground text-background" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {label}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setSeed((s) => s + 1)}
          className="rounded-full border px-3 py-1 font-mono text-[11px] text-muted-foreground hover:text-foreground"
        >
          new noise
        </button>
      </div>
      <div className="px-2 pt-2">
        <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={desc}>
          <rect x={sx(-hw)} y={sy(hh)} width={ROOM.w * SCALE} height={ROOM.h * SCALE} fill="none" className="stroke-muted-foreground" strokeWidth={1.5} />
          {sim.truePts.map((p, k) => (
            <line
              key={`e${k}`}
              x1={sx(p[0])}
              y1={sy(p[1])}
              x2={sx(Math.max(-hw - 0.6, Math.min(hw + 0.6, pts[k][0])))}
              y2={sy(Math.max(-hh - 0.6, Math.min(hh + 0.6, pts[k][1])))}
              stroke={color}
              strokeWidth={1}
              opacity={0.7}
            />
          ))}
          {sim.truePts.map((p, k) => (
            <circle key={`t${k}`} cx={sx(p[0])} cy={sy(p[1])} r={3.5} className="fill-foreground" />
          ))}
          {pts.map((p, k) => {
            const x = Math.max(-hw - 0.6, Math.min(hw + 0.6, p[0]))
            const y = Math.max(-hh - 0.6, Math.min(hh + 0.6, p[1]))
            return <circle key={`p${k}`} cx={sx(x)} cy={sy(y)} r={4.5} fill="none" stroke={color} strokeWidth={1.6} />
          })}
          {sim.cams.map((c, j) => {
            const tx = sx(c[0])
            const ty = sy(c[1])
            const ht = sim.trueHeads[j]
            const hn = heads[j]
            return (
              <g key={`c${j}`}>
                <line x1={tx} y1={ty} x2={tx + 26 * mcos(ht)} y2={ty - 26 * msin(ht)} className="stroke-foreground" strokeWidth={1} opacity={0.5} />
                <line x1={tx} y1={ty} x2={tx + 26 * mcos(hn)} y2={ty - 26 * msin(hn)} stroke={color} strokeWidth={2} />
                <circle cx={tx} cy={ty} r={4} className="fill-background stroke-foreground" strokeWidth={1.2} />
              </g>
            )
          })}
          <g className="font-mono" fontSize={10}>
            <circle cx={16} cy={H - 30} r={3.5} className="fill-foreground" />
            <text x={26} y={H - 27} className="fill-muted-foreground">
              true wall point
            </text>
            <circle cx={16} cy={H - 14} r={4.5} fill="none" stroke={color} strokeWidth={1.6} />
            <text x={26} y={H - 11} className="fill-muted-foreground">
              {show === "noisy" ? "triangulated with noisy headings" : "bundle-adjusted point"}
            </text>
            <text x={W - 12} y={H - 11} textAnchor="end" className="fill-muted-foreground">
              grey tick: true heading; coloured tick: {show === "noisy" ? "noisy" : "adjusted"} heading
            </text>
          </g>
        </svg>
      </div>
      <div className="grid gap-3 px-4 pb-2 pt-1 sm:grid-cols-3">
        <label className="block font-mono text-[11px] text-muted-foreground">
          cameras: {nCams}
          <Range min={3} max={12} step={1} value={nCams} onChange={(e) => setNCams(Number(e.target.value))} />
        </label>
        <label className="block font-mono text-[11px] text-muted-foreground">
          heading noise: {rot.toFixed(1)}°
          <Range min={0} max={5} step={0.1} value={rot} onChange={(e) => setRot(Number(e.target.value))} />
        </label>
        <label className="block font-mono text-[11px] text-muted-foreground">
          bearing (pixel) noise: {pix.toFixed(2)}°
          <Range min={0} max={0.5} step={0.01} value={pix} onChange={(e) => setPix(Number(e.target.value))} />
        </label>
      </div>
      <figcaption className="grid gap-1 border-t px-4 py-3 font-mono text-[11px] text-muted-foreground sm:grid-cols-2">
        <span>
          points from noisy headings: <span className="text-foreground">{cm(sim.errNoisy)}</span> RMS
        </span>
        <span>
          after bundle adjustment: <span className="text-foreground">{cm(sim.errBA)}</span> RMS
        </span>
        <span>
          heading error: {sim.headErrNoisy.toFixed(2)}° before, {sim.headErrBA.toFixed(3)}° after
        </span>
        <span>
          triangulated with the true headings: {cm(sim.errTruePose)} RMS
        </span>
      </figcaption>
    </figure>
  )
}
