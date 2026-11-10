"use client"

import { useState } from "react"

// The staging rule in exploded-view/assets/explode.js, Exploder.set():
//   n stages, window w = 2 / (n + 1), stage i starts at i * w / 2,
//   k = smoothstep(clamp((t - start) / w)), position = home + offset * k.
// Part extents (side view, metres) and offsets are read from the repo's
// assets/demo/motor.js at 53beb89, and from the gearbox I built by following
// the skill. Offsets are the userData.explode values; the planet has none, so
// its offset is the computed 1.2 x its distance from the centre.

type Part = { name: string; stage: number; x0: number; x1: number; y0: number; y1: number; dx: number; dy: number; tone: string }
type Model = { id: string; label: string; parts: Part[]; xr: [number, number]; yr: [number, number] }

const BLUE = "oklch(0.5 0.07 240)"
const STEEL = "oklch(0.72 0.01 250)"
const COPPER = "oklch(0.62 0.13 50)"
const DARK = "oklch(0.35 0.01 250)"

const MOTOR: Model = {
  id: "motor",
  label: "repo demo: motor",
  xr: [-0.95, 1.08],
  yr: [-0.2, 0.52],
  parts: [
    { name: "housing", stage: 0, x0: -0.15, x1: 0.15, y0: -0.163, y1: 0.177, dx: 0, dy: 0.32, tone: BLUE },
    { name: "front shield", stage: 0, x0: 0.15, x1: 0.18, y0: -0.12, y1: 0.12, dx: 0.84, dy: 0, tone: BLUE },
    { name: "rear shield", stage: 0, x0: -0.18, x1: -0.15, y0: -0.12, y1: 0.12, dx: -0.32, dy: 0, tone: BLUE },
    { name: "fan cover", stage: 0, x0: -0.255, x1: -0.16, y0: -0.12, y1: 0.12, dx: -0.62, dy: 0, tone: BLUE },
    { name: "stator", stage: 1, x0: -0.125, x1: 0.125, y0: -0.103, y1: 0.103, dx: 0, dy: 0, tone: COPPER },
    { name: "front bearing", stage: 1, x0: 0.152, x1: 0.168, y0: -0.032, y1: 0.032, dx: 0.6, dy: 0, tone: STEEL },
    { name: "rear bearing", stage: 1, x0: -0.168, x1: -0.152, y0: -0.032, y1: 0.032, dx: -0.22, dy: 0, tone: STEEL },
    { name: "fan", stage: 1, x0: -0.215, x1: -0.195, y0: -0.1, y1: 0.1, dx: -0.46, dy: 0, tone: DARK },
    { name: "rotor core", stage: 2, x0: -0.095, x1: 0.095, y0: -0.068, y1: 0.068, dx: 0.42, dy: 0, tone: STEEL },
    { name: "shaft", stage: 2, x0: -0.24, x1: 0.34, y0: -0.014, y1: 0.014, dx: 0.42, dy: 0, tone: STEEL },
  ],
}

const GEARBOX: Model = {
  id: "gearbox",
  label: "my build: planetary",
  xr: [-0.62, 0.55],
  yr: [-0.2, 0.56],
  parts: [
    { name: "ring + housing", stage: 0, x0: -0.04, x1: 0.04, y0: -0.174, y1: 0.174, dx: 0, dy: 0.36, tone: BLUE },
    { name: "cover", stage: 0, x0: 0.04, x1: 0.052, y0: -0.174, y1: 0.174, dx: 0.42, dy: 0, tone: BLUE },
    { name: "carrier", stage: 1, x0: 0.03, x1: 0.19, y0: -0.128, y1: 0.128, dx: 0.28, dy: 0, tone: STEEL },
    { name: "planet", stage: 2, x0: -0.025, x1: 0.025, y0: 0.036, y1: 0.144, dx: 0, dy: 0.108, tone: COPPER },
    { name: "sun + input", stage: 3, x0: -0.2, x1: 0.025, y0: -0.036, y1: 0.036, dx: -0.36, dy: 0, tone: STEEL },
  ],
}

const MODELS = [MOTOR, GEARBOX]
const W = 720
const H = 250
const smooth = (t: number) => t * t * (3 - 2 * t)
const clamp = (t: number) => Math.min(1, Math.max(0, t))

export function StageTimeline() {
  const [m, setM] = useState(0)
  const [t, setT] = useState(0.5)
  const model = MODELS[m]
  const stages = [...new Set(model.parts.map((p) => p.stage))].sort((a, b) => a - b)
  const n = stages.length
  const w = n > 1 ? 2 / (n + 1) : 1
  const kOf = (stage: number) => {
    const i = stages.indexOf(stage)
    return smooth(clamp((t - (i * w) / 2) / w))
  }
  const [xa, xb] = model.xr
  const [ya, yb] = model.yr
  const sx = (x: number) => 16 + ((x - xa) / (xb - xa)) * (W - 32)
  const sy = (y: number) => 150 - ((y - ya) / (yb - ya)) * 140 + 4
  const tl = (v: number) => 120 + v * (W - 140)

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>staged explode · Exploder.set(t)</span>
        <span className="text-muted-foreground/50">offsets from motor.js and my gearbox</span>
      </div>
      <div className="space-y-3 p-3 sm:p-4">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 font-mono text-xs">
          <div className="flex flex-wrap items-center gap-1">
            {MODELS.map((md, i) => (
              <button
                key={md.id}
                type="button"
                onClick={() => setM(i)}
                className={`rounded-md border px-2 py-1 ${m === i ? "border-foreground/50 bg-foreground/10" : "text-muted-foreground"}`}
              >
                {md.label}
              </button>
            ))}
          </div>
          <label className="flex items-center gap-2">
            <span className="text-muted-foreground">t</span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.005}
              value={t}
              onChange={(e) => setT(Number(e.target.value))}
              className="w-48"
              aria-label="explode amount t, 0 assembled to 1 exploded"
            />
            <span className="w-12">{t.toFixed(3)}</span>
          </label>
        </div>

        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`Side view of the ${model.id} coming apart at t = ${t.toFixed(2)}, with one timeline bar per stage below it.`}>
          <line x1={sx(xa)} x2={sx(xb)} y1={sy(0)} y2={sy(0)} stroke="var(--muted-foreground)" strokeOpacity={0.25} strokeDasharray="4 4" />
          {model.parts.map((p) => {
            const k = kOf(p.stage)
            const ox = p.dx * k
            const oy = p.dy * k
            return (
              <rect
                key={p.name}
                x={sx(p.x0 + ox)}
                y={sy(p.y1 + oy)}
                width={Math.max(2, sx(p.x1) - sx(p.x0))}
                height={sy(p.y0) - sy(p.y1)}
                fill={p.tone}
                fillOpacity={p.stage === 0 ? 0.55 : 0.85}
                stroke="currentColor"
                strokeOpacity={0.35}
                rx={1.5}
              >
                <title>{`${p.name}: stage ${p.stage}, k = ${k.toFixed(2)}`}</title>
              </rect>
            )
          })}
          {stages.map((s, i) => {
            const start = (i * w) / 2
            const y = 172 + i * 18
            const k = kOf(s)
            return (
              <g key={s} className="font-mono">
                <text x={8} y={y + 9} fontSize={10} fill="var(--muted-foreground)">
                  stage {s} · k {k.toFixed(2)}
                </text>
                <rect x={tl(0)} y={y} width={tl(1) - tl(0)} height={10} fill="var(--muted-foreground)" fillOpacity={0.1} rx={2} />
                <rect x={tl(start)} y={y} width={tl(start + w) - tl(start)} height={10} fill={k > 0 && k < 1 ? "oklch(0.65 0.17 45)" : "var(--muted-foreground)"} fillOpacity={0.55} rx={2} />
              </g>
            )
          })}
          <line x1={tl(t)} x2={tl(t)} y1={166} y2={172 + n * 18} stroke="currentColor" strokeWidth={1.5} />
        </svg>

        <div className="grid grid-cols-2 gap-2 font-mono text-xs sm:grid-cols-4">
          <Cell k="stages n" v={String(n)} />
          <Cell k="window w = 2/(n+1)" v={w.toFixed(3)} />
          <Cell k="last stage starts" v={(((n - 1) * w) / 2).toFixed(3)} />
          <Cell k="parts" v={String(model.parts.length)} />
        </div>
        <p className="font-mono text-xs leading-relaxed text-muted-foreground" aria-live="polite">
          Each stage gets a window of width 2/(n+1) and starts when the stage before it is half way through its own, so the last window ends exactly at t = 1 for any n. Shells (stage 0, pale) leave first. In the motor, the rotor and shaft only begin to slide out at t = 0.5.
        </p>
      </div>
    </figure>
  )
}

function Cell({ k, v }: { k: string; v: string }) {
  return (
    <div className="rounded-md border px-3 py-2">
      <div className="text-muted-foreground">{k}</div>
      <div className="mt-0.5 text-base">{v}</div>
    </div>
  )
}
