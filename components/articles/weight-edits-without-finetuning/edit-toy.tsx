"use client"

import { useMemo, useState } from "react"

import { Range } from "@/components/articles/ui/range"

import {
  applyMask,
  bestMasks,
  BASE_SIGNS,
  changed,
  closedForm,
  forward,
  GRID,
  H,
  LAMBDAS,
  LORA_STEPS,
  loraTrajectory,
  popcount,
  score,
} from "./toy"
import { BASE, NEW_POINTS, type Unit } from "./toy-weights"

const unitSign = (u: Unit, x: number, y: number) => (forward(u, x, y) >= 0 ? 1 : -1)

// One SwiGLU unit, three ways to change it. The map is the unit's sign over
// [-1, 1]^2 on a 21 x 21 grid (441 cells); a cell outlined in orange has a
// different sign from the base unit, which is what "forgetting" means here.
// The markers are the new task's seven labelled points. Every edit is computed
// in toy.ts from the frozen weights in toy-weights.ts: the mask by exhaustive
// search or by your clicks, LoRA by gradient descent, the closed-form write by
// one 6 x 6 linear solve.

const ACCENT = "oklch(0.64 0.17 40)"
const BLUE = "oklch(0.60 0.14 250)"
const MONO = "ui-monospace, monospace"

type Mode = "mask" | "lora" | "closed"

const MAP = 300
const CELL = MAP / GRID
const PAD = 10

const sx = (x: number) => PAD + ((x + 1) / 2) * MAP
const sy = (y: number) => PAD + ((1 - y) / 2) * MAP

export function EditToy() {
  const [mode, setMode] = useState<Mode>("mask")
  const [mask, setMask] = useState(0)
  const [loraIdx, setLoraIdx] = useState(2)
  const [lamIdx, setLamIdx] = useState(0)

  const unit = mode === "mask" ? applyMask(mask) : mode === "lora" ? loraTrajectory[loraIdx] : closedForm[lamIdx]
  const s = useMemo(() => score(unit), [unit])
  const nChanged = changed(unit)

  const toggle = (k: number) => setMask((m) => m ^ (1 << k))

  const modes: { id: Mode; label: string }[] = [
    { id: "mask", label: "delete gate weights" },
    { id: "lora", label: "LoRA rank 1 on the gate" },
    { id: "closed", label: "closed-form write to down" },
  ]

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center gap-1 border-b px-4 py-2.5">
        <span className="mr-2 font-mono text-xs text-muted-foreground">one SwiGLU unit · edit it</span>
        {modes.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => setMode(m.id)}
            aria-pressed={mode === m.id}
            className={`rounded-md border px-2 py-0.5 font-mono text-xs ${mode === m.id ? "bg-foreground text-background" : "text-muted-foreground"}`}
          >
            {m.label}
          </button>
        ))}
      </div>

      <div className="grid gap-4 p-3 sm:grid-cols-[minmax(0,320px)_1fr] sm:p-4">
        <svg viewBox={`0 0 ${MAP + 2 * PAD} ${MAP + 2 * PAD}`} role="img" className="h-auto w-full max-w-[320px]">
          <title>
            {`Sign map of the edited unit over a 21 by 21 grid. ${s.kept} of 441 cells keep the base unit's sign; ${441 - s.kept} changed, outlined. ${s.right} of ${NEW_POINTS.length} new-task points are classified correctly.`}
          </title>
          {s.signs.map((v, i) => {
            const r = Math.floor(i / GRID)
            const q = i % GRID
            const diff = v !== BASE_SIGNS[i]
            return (
              <rect
                key={i}
                x={PAD + q * CELL}
                y={PAD + r * CELL}
                width={CELL}
                height={CELL}
                fill={v > 0 ? BLUE : "currentColor"}
                fillOpacity={v > 0 ? 0.42 : 0.06}
                stroke={diff ? ACCENT : "none"}
                strokeWidth={diff ? 1.6 : 0}
              />
            )
          })}
          {NEW_POINTS.map((p, i) => {
            const ok = unitSign(unit, p.x, p.y) === p.label
            return (
              <g key={i}>
                <circle
                  cx={sx(p.x)}
                  cy={sy(p.y)}
                  r={6}
                  fill={p.label > 0 ? BLUE : "var(--background, white)"}
                  stroke={ok ? "currentColor" : ACCENT}
                  strokeWidth={ok ? 1.5 : 3}
                />
                {!ok && (
                  <text x={sx(p.x) + 8} y={sy(p.y) - 6} fontSize={11} fontFamily={MONO} fill={ACCENT}>
                    ✗
                  </text>
                )}
              </g>
            )
          })}
        </svg>

        <div className="flex min-w-0 flex-col gap-3 font-mono text-xs">
          <div className="grid grid-cols-3 gap-2">
            <Stat label="new task" value={`${s.right}/${NEW_POINTS.length}`} good={s.right === NEW_POINTS.length} />
            <Stat label="old cells kept" value={`${s.kept}/441`} good={s.kept >= 420} />
            <Stat label="params changed" value={`${nChanged}/43`} good={nChanged <= 2} />
          </div>

          {mode === "mask" && (
            <div className="flex flex-col gap-2">
              <span className="text-muted-foreground">
                gate matrix W<sub>g</sub> (6 neurons x 2 inputs) · click a weight to delete it
              </span>
              <div className="grid w-fit grid-cols-2 gap-1">
                {Array.from({ length: 2 * H }, (_, k) => {
                  const del = (mask & (1 << k)) !== 0
                  const w = BASE.wg[k >> 1][k & 1]
                  return (
                    <button
                      key={k}
                      type="button"
                      onClick={() => toggle(k)}
                      aria-pressed={del}
                      aria-label={`gate weight neuron ${(k >> 1) + 1} input ${(k & 1) + 1}, value ${w}${del ? ", deleted" : ""}`}
                      className={`w-20 rounded border px-1.5 py-0.5 text-right tabular-nums ${del ? "line-through" : ""}`}
                      style={del ? { borderColor: ACCENT, color: ACCENT } : undefined}
                    >
                      {del ? "0" : w.toFixed(2)}
                    </button>
                  )
                })}
              </div>
              <div className="flex flex-wrap items-center gap-1">
                <span className="text-muted-foreground">best mask with at most</span>
                {[1, 2, 3].map((k) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setMask(bestMasks[k].mask)}
                    className="rounded-md border px-2 py-0.5 text-muted-foreground hover:text-foreground"
                  >
                    {k}
                  </button>
                ))}
                <span className="text-muted-foreground">deletions ·</span>
                <button type="button" onClick={() => setMask(0)} className="rounded-md border px-2 py-0.5 text-muted-foreground hover:text-foreground">
                  reset
                </button>
              </div>
              <p className="text-muted-foreground">
                {popcount(mask)} deleted. Exhaustive search over all 4,096 masks finds that one deletion is enough here.
              </p>
            </div>
          )}

          {mode === "lora" && (
            <div className="flex flex-col gap-2">
              <span className="text-muted-foreground">
                W<sub>g</sub> + a b<sup>T</sup>, trained on the seven new points only · steps: {LORA_STEPS[loraIdx]}
              </span>
              <Range
                min={0}
                max={LORA_STEPS.length - 1}
                step={1}
                value={loraIdx}
                onChange={(e) => setLoraIdx(Number(e.target.value))}
                aria-label="LoRA training steps"
              />
              <p className="text-muted-foreground">
                The rank-1 update changes all 12 gate weights. Once the new points are right, training keeps going and the map keeps drifting.
              </p>
            </div>
          )}

          {mode === "closed" && (
            <div className="flex flex-col gap-2">
              <span className="text-muted-foreground">
                Δd = (KᵀK + λ n C)⁻¹ Kᵀ r · protection λ = {LAMBDAS[lamIdx]}
              </span>
              <Range
                min={0}
                max={LAMBDAS.length - 1}
                step={1}
                value={lamIdx}
                onChange={(e) => setLamIdx(Number(e.target.value))}
                aria-label="Protection strength lambda"
              />
              <p className="text-muted-foreground">
                One solve, no steps. C is what the six neurons see over the whole grid; raising λ trades nothing on the new points here and keeps more of the old map.
              </p>
            </div>
          )}
        </div>
      </div>
      <figcaption className="border-t px-4 py-2.5 text-xs text-muted-foreground">
        A toy chosen by a seeded search for a unit where deleting gate weights can fix the new task, so it shows how each edit
        works, not which one wins on a real model. Filled markers want a positive sign, hollow ones negative; orange
        outlines are cells whose sign changed.
      </figcaption>
    </figure>
  )
}

function Stat({ label, value, good }: { label: string; value: string; good: boolean }) {
  return (
    <div className="rounded-md border px-2 py-1.5">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-base tabular-nums" style={{ color: good ? undefined : ACCENT }}>
        {value}
      </div>
    </div>
  )
}
