"use client"

import { useState } from "react"

import { mexp } from "@/lib/dmath"
import { Range } from "@/components/articles/ui/range"
import { cn } from "@/lib/utils"

// The trust-region ascent/descent step, as scripts/train_opsd_ri_sd3.py
// implements it in `_opa_tr_step` (lines ~265-303), and the ablation the paper
// runs over its `dir_mode` argument (fig4_ablation_dynamics.pdf, panel a).
//
//   dir_mode="grad"     the reward gradient at y0 (the method)
//   dir_mode="rand"     a fixed random unit direction, same trust region
//   dir_mode="residual" the rollout's own denoising residual (x_end - y0)
//   dir_mode="noop"     no displacement — y+ = y- = y0
//
// Each step normalises the direction, moves by rho * ||y0|| / n_ascent, then
// clamps back onto the radius-rho ball if the accumulated step overshot it:
//
//   x = x0.detach() + direction * step_len * (g / ||g||)
//   d = x - x0; x = x0 + d * clamp(budget / ||d||, max=1.0)
//
// This component reproduces that update on a 2D toy reward landscape (a
// single Gaussian bump standing in for the paper's local reward R~(y,c)) so
// the four dir_mode arms can be compared visually. The panel below anchors it
// to the paper's own measured numbers after 50 real optimizer updates.

const GOOD = "oklch(0.55 0.16 155)"
const BAD = "oklch(0.58 0.19 27)"
const MUTED = "oklch(0.62 0.03 250)"
const ACCENT = "oklch(0.60 0.15 255)"

type DirMode = "grad" | "rand" | "residual" | "noop"

const MODES: { k: DirMode; label: string; colour: string }[] = [
  { k: "grad", label: "grad — the method", colour: ACCENT },
  { k: "rand", label: "rand — fixed random direction", colour: MUTED },
  { k: "residual", label: "residual — rollout endpoint direction", colour: BAD },
  { k: "noop", label: "noop — no displacement", colour: MUTED },
]

// held-out CLIPScore after 50 real optimizer updates, single low-noise query,
// 512 held-out prompts (paper, Sec. "Target Construction", the two sentences
// beginning "The construction advantage persists after training.")
const MEASURED: Record<DirMode, number> = { grad: 0.3122, rand: 0.2303, residual: 0.1256, noop: 0.2363 }

// toy landscape: a single Gaussian bump at (bx, by), standing in for R~(y, c)
const BX = 0.62
const BY = 0.34
const SCALE = 0.09

function reward(x: number, y: number) {
  const dx = x - BX
  const dy = y - BY
  return mexp(-(dx * dx + dy * dy) / SCALE)
}

function grad(x: number, y: number) {
  const r = reward(x, y)
  const gx = (-2 * (x - BX) / SCALE) * r
  const gy = (-2 * (y - BY) / SCALE) * r
  return [gx, gy] as const
}

// a fixed "rollout residual" direction and a fixed "random" direction — chosen
// once, not resampled, so the widget is deterministic on every render
const RESIDUAL_DIR = normalise(0.38, -0.86)
const RAND_DIR = normalise(-0.71, 0.4)

function normalise(x: number, y: number) {
  const n = Math.hypot(x, y) || 1e-9
  return [x / n, y / n] as const
}

function trStep(x0: number, y0: number, dirMode: DirMode, rho: number, nAscent: number, direction: 1 | -1) {
  const budget = rho // ||y0|| folded into the toy's unit square
  const stepLen = budget / Math.max(nAscent, 1)
  let x = x0
  let y = y0
  const path: [number, number][] = [[x0, y0]]
  for (let i = 0; i < nAscent; i++) {
    if (dirMode === "noop") break
    let gx: number, gy: number
    if (dirMode === "grad") {
      ;[gx, gy] = grad(x, y)
    } else if (dirMode === "rand") {
      ;[gx, gy] = RAND_DIR
    } else {
      ;[gx, gy] = RESIDUAL_DIR
    }
    const gn = Math.hypot(gx, gy) + 1e-12
    x = x + direction * stepLen * (gx / gn)
    y = y + direction * stepLen * (gy / gn)
    const dx = x - x0
    const dy = y - y0
    const dn = Math.hypot(dx, dy)
    const clamp = Math.min(budget / (dn + 1e-12), 1.0)
    x = x0 + dx * clamp
    y = y0 + dy * clamp
    path.push([x, y])
  }
  return { x, y, path }
}

export function TrustRegionStep() {
  const [mode, setMode] = useState<DirMode>("grad")
  const [rho, setRho] = useState(18) // hundredths
  const [nAscent, setNAscent] = useState(2)

  const rhoF = rho / 100
  const x0 = 0.28
  const y0 = 0.58

  const pos = trStep(x0, y0, mode, rhoF, nAscent, 1)
  const neg = trStep(x0, y0, mode, rhoF, nAscent, -1)

  const W = 700
  const H = 360
  const PAD = 36
  const px = (v: number) => PAD + v * (W - 2 * PAD)
  const py = (v: number) => H - PAD - v * (H - 2 * PAD)

  // background reward field, sampled on a coarse grid — a diagnostic, not a photo
  const CELLS = 26
  const cells: { x: number; y: number; v: number }[] = []
  for (let i = 0; i < CELLS; i++) {
    for (let j = 0; j < CELLS; j++) {
      const cx = (i + 0.5) / CELLS
      const cy = (j + 0.5) / CELLS
      cells.push({ x: cx, y: cy, v: reward(cx, cy) })
    }
  }

  const pathD = (path: [number, number][]) =>
    path.map(([x, y], i) => `${i === 0 ? "M" : "L"} ${px(x).toFixed(1)} ${py(y).toFixed(1)}`).join(" ")

  const colour = MODES.find((m) => m.k === mode)!.colour

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          the trust-region step, on a toy reward landscape · dir_mode={mode}
        </span>
        <span className="font-mono text-[10px]" style={{ color: colour }}>
          held-out CLIPScore after 50 updates: {MEASURED[mode].toFixed(4)}
        </span>
      </div>

      <div className="p-3 sm:p-4">
        <div className="flex flex-wrap gap-1.5">
          {MODES.map((m) => (
            <button
              key={m.k}
              type="button"
              onClick={() => setMode(m.k)}
              aria-pressed={mode === m.k}
              className={cn(
                "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
                mode === m.k
                  ? "border-foreground/30 bg-muted/50 text-foreground"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {m.label}
            </button>
          ))}
        </div>

        <div className="mt-3 overflow-x-auto">
          <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" className="min-w-[560px] max-w-full">
            <title>
              {`A trust-region step from the behaviour anchor y0, direction mode ${mode}, radius ${rhoF.toFixed(2)}, ${nAscent} ascent step${nAscent === 1 ? "" : "s"}. The positive target moves toward higher toy reward and the negative target away from it, both clamped to the same ball around y0.`}
            </title>
            {cells.map((c, i) => (
              <rect
                key={i}
                x={px(c.x - 0.5 / CELLS)}
                y={py(c.y + 0.5 / CELLS)}
                width={(W - 2 * PAD) / CELLS}
                height={(H - 2 * PAD) / CELLS}
                fill={GOOD}
                fillOpacity={Math.min(0.5, c.v * 0.55)}
              />
            ))}

            {/* the bounded neighbourhood ||y - y0|| <= rho */}
            <circle
              cx={px(x0)}
              cy={py(y0)}
              r={rhoF * (W - 2 * PAD)}
              fill="none"
              stroke="currentColor"
              strokeOpacity={0.35}
              strokeDasharray="4 3"
            />

            <path d={pathD(pos.path)} fill="none" stroke={GOOD} strokeWidth={2.4} />
            <path d={pathD(neg.path)} fill="none" stroke={BAD} strokeWidth={2.4} strokeDasharray={mode === "noop" ? "3 3" : undefined} />

            <circle cx={px(x0)} cy={py(y0)} r={6} fill="currentColor" />
            <text x={px(x0)} y={py(y0) + 20} fontSize={9} textAnchor="middle" fill="currentColor" fillOpacity={0.7} fontFamily="ui-monospace, monospace">
              y0
            </text>

            <circle cx={px(pos.x)} cy={py(pos.y)} r={6} fill={GOOD} />
            <text x={px(pos.x) + 10} y={py(pos.y) - 8} fontSize={9} fill={GOOD} fontFamily="ui-monospace, monospace">
              y+
            </text>
            <circle cx={px(neg.x)} cy={py(neg.y)} r={6} fill={BAD} />
            <text x={px(neg.x) + 10} y={py(neg.y) + 16} fontSize={9} fill={BAD} fontFamily="ui-monospace, monospace">
              y-
            </text>
          </svg>
        </div>

        <div className="mt-2 grid gap-x-5 gap-y-2 sm:grid-cols-2">
          <div className="flex items-center gap-2">
            <span className="w-24 shrink-0 font-mono text-[10px] text-muted-foreground">radius ρ</span>
            <Range
              min={4}
              max={40}
              step={1}
              value={rho}
              onChange={(e) => setRho(Number(e.target.value))}
              className="flex-1"
              aria-label="trust-region radius rho"
              accent={colour}
            />
            <span className="w-10 shrink-0 text-right font-mono text-[10px] tabular-nums text-foreground">
              {rhoF.toFixed(2)}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-24 shrink-0 font-mono text-[10px] text-muted-foreground">ascent steps</span>
            <Range
              min={1}
              max={4}
              step={1}
              value={nAscent}
              onChange={(e) => setNAscent(Number(e.target.value))}
              className="flex-1"
              aria-label="number of ascent/descent steps"
              accent={colour}
            />
            <span className="w-10 shrink-0 text-right font-mono text-[10px] tabular-nums text-foreground">
              {nAscent}
            </span>
          </div>
        </div>

        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          Green shading is the toy reward field; the dashed circle is the bounded neighbourhood{" "}
          <code className="font-mono text-[11px] text-foreground">‖y − y₀‖ ≤ ρ‖y₀‖</code>. The{" "}
          <span style={{ color: GOOD }}>positive target y+</span> climbs it, the{" "}
          <span style={{ color: BAD }}>negative target y−</span> descends it, both re-clamped onto the
          same ball after every step — exactly the arithmetic in{" "}
          <code className="font-mono text-[11px] text-foreground">_opa_tr_step</code>.
          <br />
          <br />
          Switch to <span style={{ color: MUTED }}>rand</span> or{" "}
          <span style={{ color: BAD }}>residual</span> and the direction stops depending on the reward
          entirely — same radius, same step count, no gradient. The number on the right is not simulated:
          it is the paper&rsquo;s own measured held-out CLIPScore after 50 real optimizer updates run
          under each control, on 512 held-out prompts at the same low-noise query.{" "}
          <span style={{ color: GOOD }}>grad</span> reaches 0.3122;{" "}
          <span style={{ color: BAD }}>residual</span> — the direction closest to a plain rollout
          endpoint — collapses to 0.1256, worse than doing nothing at all (
          <span style={{ color: MUTED }}>noop</span>, 0.2363). The win is the direction, not the trust
          region.
        </p>
      </div>
    </figure>
  )
}
