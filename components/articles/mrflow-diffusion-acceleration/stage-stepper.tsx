"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// MrFlow's staged sampling pipeline, drawn as a real diagram. The insight: spend the
// expensive diffusion steps at LOW resolution, do the resolution climb in *pixel* space
// with a cheap SR network, then a single HR touch-up — instead of running every step at
// full resolution. Four stages, left→right, with the canvas growing from LR to HR and a
// compute strip showing where the FLOPs actually go. Walk the stages. Illustrative; the
// compute units are a schematic (an HR step ≈ 4× an LR step at 2× linear resolution).

const LATENT = "oklch(0.66 0.14 155)" // latent-space stages (diffusion)
const PIXEL = "oklch(0.70 0.15 55)" // pixel-space stage (SR GAN)

type Key = "generate" | "sr" | "reinject" | "refine"

const STAGES: {
  key: Key
  label: string
  chip: string
  space: "latent" | "pixel"
  res: string
  cost: number
  detail: string
}[] = [
  {
    key: "generate",
    label: "LR generate",
    chip: "12-step",
    space: "latent",
    res: "512²",
    cost: 12,
    detail:
      "Run the flow model for ~12 of its 20 steps at LOW resolution. Each step is cheap at 512², and this is where the image's structure and composition are decided.",
  },
  {
    key: "sr",
    label: "pixel SR",
    chip: "Real-ESRGAN",
    space: "pixel",
    res: "512²→1024²",
    cost: 1,
    detail:
      "Climb to full resolution with a pixel-space SR network (Real-ESRGAN) — one cheap forward pass, not more latent diffusion steps. This is the resolution jump.",
  },
  {
    key: "reinject",
    label: "noise re-inject",
    chip: "+ σₜ ε",
    space: "latent",
    res: "1024²",
    cost: 0,
    detail:
      "Encode the upscaled image back to latent and add a small, closed-form amount of noise (σₜ ∈ [0.1, 0.15]) so the model has something to refine. No training, no extra network.",
  },
  {
    key: "refine",
    label: "HR refine",
    chip: "1 step",
    space: "latent",
    res: "1024²",
    cost: 4,
    detail:
      "A single high-resolution diffusion step cleans up the SR network's artifacts and blends the upscaled detail back into the model's own distribution.",
  },
]

const TOTAL = STAGES.reduce((a, s) => a + s.cost, 0) // 17 units
const NATIVE = 80 // 20 HR steps × 4 units each
const SPEEDUP = NATIVE / TOTAL // ≈ 4.7×

// ── scene geometry (viewBox units) ──
const W = 760
const H = 300
const CY = 120 // canvas vertical center
const CENTERS = [80, 300, 490, 660] as const
const LR = 46 // LR canvas side
const HR = 84 // HR canvas side
const side = (i: number) => (i === 0 ? LR : HR)
const half = (i: number) => side(i) / 2

// pixel grid inside a canvas: coarse for LR, fine for HR
function grid(cx: number, s: number, divs: number, color: string) {
  const x0 = cx - s / 2
  const y0 = CY - s / 2
  const step = s / divs
  const lines: React.ReactNode[] = []
  for (let k = 1; k < divs; k++) {
    lines.push(<line key={`v${k}`} x1={x0 + k * step} y1={y0} x2={x0 + k * step} y2={y0 + s} stroke={color} strokeWidth={0.6} opacity={0.35} />)
    lines.push(<line key={`h${k}`} x1={x0} y1={y0 + k * step} x2={x0 + s} y2={y0 + k * step} stroke={color} strokeWidth={0.6} opacity={0.35} />)
  }
  return lines
}

// gentle upward arc between two stage canvases
function conn(x1: number, x2: number) {
  const dx = x2 - x1
  return `M ${x1} ${CY} C ${x1 + dx * 0.35} ${CY - 24}, ${x2 - dx * 0.35} ${CY - 24}, ${x2} ${CY}`
}

export function StageStepper() {
  const [active, setActive] = useState<Key | "all">("all")
  const activeIdx = STAGES.findIndex((s) => s.key === active)
  const activeStage = activeIdx >= 0 ? STAGES[activeIdx] : null

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex items-center justify-between border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>staged sampling · the resolution climb</span>
        <span className="text-muted-foreground/50">training-free · illustrative</span>
      </div>

      <div className="p-3 sm:p-4">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="MrFlow pipeline: 12 low-resolution diffusion steps, then pixel-space super-resolution, a small closed-form noise re-injection, and one high-resolution refine step.">
          <defs>
            <marker id="mrf-arrow" viewBox="0 -5 10 10" markerWidth="7" markerHeight="7" orient="auto" refX="6" refY="0">
              <path d="M0,-4L6,0L0,4" fill="none" stroke="var(--muted-foreground)" strokeWidth={1.5} />
            </marker>
            <filter id="mrf-soft" x="-40%" y="-40%" width="180%" height="180%">
              <feDropShadow dx="0" dy="1" stdDeviation="1.4" floodOpacity="0.14" />
            </filter>
          </defs>

          {/* space band labels */}
          <text x={CENTERS[0]} y={22} textAnchor="middle" className="font-mono" fontSize={10} fontWeight={600} style={{ fill: LATENT }}>latent</text>
          <text x={CENTERS[1]} y={22} textAnchor="middle" className="font-mono" fontSize={10} fontWeight={600} style={{ fill: PIXEL }}>pixel</text>
          <text x={(CENTERS[2] + CENTERS[3]) / 2} y={22} textAnchor="middle" className="font-mono" fontSize={10} fontWeight={600} style={{ fill: LATENT }}>latent</text>

          {/* connectors (behind canvases) */}
          {[0, 1, 2].map((i) => (
            <path
              key={i}
              d={conn(CENTERS[i] + half(i), CENTERS[i + 1] - half(i + 1))}
              fill="none"
              stroke="var(--muted-foreground)"
              strokeWidth={1.5}
              markerEnd="url(#mrf-arrow)"
              opacity={active === "all" || activeIdx === i || activeIdx === i + 1 ? 0.7 : 0.25}
            />
          ))}

          {/* stage canvases */}
          {STAGES.map((s, i) => {
            const c = s.space === "pixel" ? PIXEL : LATENT
            const sd = side(i)
            const dim = active !== "all" && active !== s.key
            const on = active === s.key
            const divs = i === 0 ? 3 : 8
            return (
              <g key={s.key} opacity={dim ? 0.4 : 1} className="transition-opacity duration-300">
                <rect
                  x={CENTERS[i] - sd / 2}
                  y={CY - sd / 2}
                  width={sd}
                  height={sd}
                  rx={8}
                  fill="var(--background)"
                  stroke={c}
                  strokeWidth={on ? 2.2 : 1.5}
                  filter="url(#mrf-soft)"
                />
                <clipPath id={`clip-${s.key}`}>
                  <rect x={CENTERS[i] - sd / 2} y={CY - sd / 2} width={sd} height={sd} rx={8} />
                </clipPath>
                <g clipPath={`url(#clip-${s.key})`}>
                  <rect x={CENTERS[i] - sd / 2} y={CY - sd / 2} width={sd} height={sd} fill={c} opacity={0.08} />
                  {grid(CENTERS[i], sd, divs, c)}
                </g>
                {/* resolution tag inside, bottom */}
                <text x={CENTERS[i]} y={CY + sd / 2 - 6} textAnchor="middle" className="font-mono" fontSize={i === 0 ? 8 : 9} fontWeight={600} style={{ fill: c }}>{s.res}</text>

                {/* stage number + label above */}
                <text x={CENTERS[i]} y={CY - sd / 2 - 20} textAnchor="middle" className="fill-muted-foreground/60 font-mono" fontSize={9}>step {i + 1}</text>
                <text x={CENTERS[i]} y={CY - sd / 2 - 8} textAnchor="middle" className="fill-foreground font-mono" fontSize={11} fontWeight={600}>{s.label}</text>
              </g>
            )
          })}

          {/* compute strip */}
          <text x={CENTERS[0] - half(0)} y={CY + HR / 2 + 34} className="fill-muted-foreground font-mono" fontSize={10}>compute per stage (units)</text>
          {STAGES.map((s, i) => {
            const c = s.space === "pixel" ? PIXEL : LATENT
            const barW = 96
            const bx = CENTERS[i] - barW / 2
            const by = CY + HR / 2 + 44
            const full = 12 // max cost for scale
            const w = Math.max((s.cost / full) * barW, 3)
            const dim = active !== "all" && active !== s.key
            return (
              <g key={s.key} opacity={dim ? 0.45 : 1} className="transition-opacity duration-300">
                <rect x={bx} y={by} width={barW} height={10} rx={3} fill="var(--muted)" opacity={0.5} />
                <rect x={bx} y={by} width={w} height={10} rx={3} fill={c} />
                <text x={CENTERS[i]} y={by + 26} textAnchor="middle" className="fill-muted-foreground font-mono" fontSize={9}>{s.cost === 0 ? "≈0" : s.cost}u · {s.chip}</text>
              </g>
            )
          })}
        </svg>

        {/* controls */}
        <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="font-mono text-[10px] text-muted-foreground">stage</span>
            <button type="button" onClick={() => setActive("all")} aria-pressed={active === "all"}
              className={cn("cursor-pointer rounded-md border px-2 py-1 font-mono text-[10px] transition-colors", active === "all" ? "border-foreground/40 text-foreground" : "text-muted-foreground hover:text-foreground")}>
              all
            </button>
            {STAGES.map((s) => (
              <button key={s.key} type="button" onClick={() => setActive(s.key)} aria-pressed={active === s.key}
                className={cn("cursor-pointer rounded-md border px-2 py-1 font-mono text-[10px] transition-colors", active === s.key ? "border-foreground/40 text-foreground" : "text-muted-foreground hover:text-foreground")}>
                {s.label}
              </button>
            ))}
          </div>
          <div className="ml-auto font-mono text-[10px] text-muted-foreground">
            total <span className="text-foreground">{TOTAL}u</span> vs native <span className="text-foreground">{NATIVE}u</span> · ≈ {SPEEDUP.toFixed(1)}×
          </div>
        </div>

        <p className="mt-3 min-h-[3.5rem] text-sm leading-6 text-muted-foreground">
          {activeStage ? (
            <>
              <span className="text-foreground">Step {activeIdx + 1} · {activeStage.label}.</span> {activeStage.detail}
            </>
          ) : (
            <>
              Almost all of the diffusion FLOPs sit in <span style={{ color: LATENT }}>step 1</span>, run at low
              resolution. The resolution climb happens in <span style={{ color: PIXEL }}>pixel space</span> for the price
              of one SR forward pass, and only a <span className="text-foreground">single</span> high-resolution
              diffusion step touches the full-size image. Same 20-step budget, a fraction of the cost.
            </>
          )}
        </p>
      </div>
    </figure>
  )
}
