"use client"

import { useState } from "react"
import type { ReactNode } from "react"

import { Range } from "@/components/articles/ui/range"
import { cn } from "@/lib/utils"

// LiFT's training targets, drawn in a 2-D stand-in for velocity space.
// Everything here is the paper's own construction (arXiv 2610.05538, Eq. 4-6
// and Figure 2c-d); the two points b and u* are placed by hand, because the
// real space has 4x32x32 = 4,096 coordinates.
//   - anchor  b = sg(u0), the readout of the prelude state, gradient stopped
//   - target  u* = x1 - x0, the flow-matching velocity
//   - loop k is supervised at  (1 - s_k) b + s_k u*
//   - training: K_train - 1 interior s drawn from U(0,1), sorted, s_K = 1
//   - inference: uniform grid s_k = k / K_inf
// "Every loop -> u*" is the deep-supervision scheme LiFT argues against
// (ELT, and the Deep Supervision of Looped-DiT): every readout regresses the
// full target, so no loop has a distinct job.
// Only + - * / are used on coordinates, so server and client agree exactly.

const W = 560
const H = 250
const B = { x: 70, y: 196 }
const U = { x: 488, y: 70 }
const ACCENT = "oklch(0.62 0.17 300)"
const TEAL = "oklch(0.66 0.12 195)"

type Phase = "train" | "infer"
type Scheme = "lift" | "deep"

// Small deterministic LCG so the "random" grid is identical on server and
// client and changes only when the reader asks for a new draw.
function draws(seed: number, n: number): number[] {
  let s = (seed * 2654435761) % 4294967296
  const out: number[] = []
  for (let i = 0; i < n; i++) {
    s = (s * 1664525 + 1013904223) % 4294967296
    out.push(s / 4294967296)
  }
  return out.sort((a, b) => a - b)
}

function lerp(s: number) {
  return { x: B.x + s * (U.x - B.x), y: B.y + s * (U.y - B.y) }
}

export function ReferencePath() {
  const [phase, setPhase] = useState<Phase>("train")
  const [scheme, setScheme] = useState<Scheme>("lift")
  const [kTrain, setKTrain] = useState(3)
  const [kInf, setKInf] = useState(8)
  const [seed, setSeed] = useState(7)

  const K = phase === "train" ? kTrain : kInf
  const grid: number[] =
    phase === "train"
      ? [...draws(seed, kTrain - 1), 1]
      : Array.from({ length: kInf }, (_, i) => (i + 1) / kInf)

  const targets = grid.map((s) => (scheme === "lift" ? s : 1))
  const first = grid[0]

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">reference path · LiFT Eq. 4-6</span>
        <div className="flex flex-wrap gap-1">
          <Pill on={phase === "train"} onClick={() => setPhase("train")}>
            training grid
          </Pill>
          <Pill on={phase === "infer"} onClick={() => setPhase("infer")}>
            inference grid
          </Pill>
          <span className="mx-1 w-px bg-border" aria-hidden />
          <Pill on={scheme === "lift"} onClick={() => setScheme("lift")}>
            LiFT targets
          </Pill>
          <Pill on={scheme === "deep"} onClick={() => setScheme("deep")}>
            every loop → u*
          </Pill>
        </div>
      </div>

      <div className="space-y-4 px-4 py-4">
        <label className="block">
          <span className="flex items-baseline justify-between font-mono text-xs">
            <span>{phase === "train" ? "K_train (loops unrolled in training)" : "K_inf (loops at sampling time)"}</span>
            <span className="text-base font-semibold" style={{ color: ACCENT }}>
              {K}
            </span>
          </span>
          <Range
            min={1}
            max={phase === "train" ? 8 : 32}
            step={1}
            value={K}
            accent={ACCENT}
            onChange={(e) => (phase === "train" ? setKTrain(Number(e.target.value)) : setKInf(Number(e.target.value)))}
            aria-label={phase === "train" ? "Training loop count" : "Inference loop count"}
            className="mt-1 w-full"
          />
        </label>

        <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Targets for each loop on the path from the anchor b to the target u*">
          <line x1={B.x} y1={B.y} x2={U.x} y2={U.y} stroke="currentColor" strokeOpacity={0.35} strokeWidth={2} />
          <circle cx={B.x} cy={B.y} r={8} fill="none" stroke="currentColor" strokeDasharray="3 3" />
          <text x={B.x - 6} y={B.y + 26} fontSize={12} fill="currentColor" className="font-mono">
            b = sg(u₀), s = 0
          </text>
          <circle cx={U.x} cy={U.y} r={9} fill="currentColor" />
          <text x={U.x - 40} y={U.y - 18} fontSize={12} fill="currentColor" className="font-mono">
            u* = x₁ − x₀, s = 1
          </text>
          {targets.map((s, i) => {
            const p = lerp(s)
            const off = scheme === "deep" ? i * 7 : 0
            return (
              <g key={`${phase}-${i}`}>
                <circle cx={p.x} cy={p.y + off} r={i === targets.length - 1 ? 6 : 5} fill={i === targets.length - 1 ? ACCENT : TEAL} fillOpacity={0.9} />
                {targets.length <= 10 ? (
                  <text x={p.x + 8} y={p.y + off + 16} fontSize={10} fill="currentColor" fillOpacity={0.7} className="font-mono">
                    {`k=${i + 1}`}
                  </text>
                ) : null}
              </g>
            )
          })}
          {/* depth-coordinate number line, as in the paper's Figure 2d */}
          <line x1={70} x2={490} y1={236} y2={236} stroke="currentColor" strokeOpacity={0.3} />
          <text x={40} y={240} fontSize={10} fill="currentColor" fillOpacity={0.6} className="font-mono">
            s
          </text>
          {grid.map((s, i) => (
            <line key={`t${i}`} x1={70 + 420 * s} x2={70 + 420 * s} y1={230} y2={242} stroke={i === grid.length - 1 ? ACCENT : TEAL} strokeWidth={2} />
          ))}
        </svg>

        <div className="grid gap-2 sm:grid-cols-3">
          <Stat k="loop 1 target" v={scheme === "lift" ? `s = ${first.toFixed(3)}` : "u* (all of it)"} />
          <Stat
            k="left for loop 1 to fix"
            v={scheme === "lift" ? `${((1 - first) * 100).toFixed(0)}% of u* − b` : "0%: it must finish"}
          />
          <Stat k="average share per loop" v={scheme === "lift" ? `1/${K} = ${(100 / K).toFixed(1)}% of the correction` : "0 (same point)"} />
        </div>

        {phase === "train" ? (
          <button
            type="button"
            onClick={() => setSeed((s) => s + 1)}
            className="cursor-pointer rounded-full border px-3 py-1 font-mono text-[11px] text-muted-foreground hover:text-foreground"
          >
            draw a new training grid
          </button>
        ) : null}

        <p className="text-[11px] leading-relaxed text-muted-foreground">
          {scheme === "lift"
            ? phase === "train"
              ? "Training: K_train − 1 interior coordinates are drawn uniformly and sorted; the last is always s = 1, the plain flow-matching target. Each draw gives the same loops a different set of jobs."
              : "Sampling: s_k = k / K_inf. More loops only make the grid finer; every coordinate is one the model was trained on, and the last readout still lands on s = 1."
            : "Deep supervision: every readout regresses the full target, so the dots stack on u*. Once a loop has reached it, a further loop has nothing defined to do, which is where extrapolation stalls."}
        </p>
      </div>
    </figure>
  )
}

function Pill({ on, onClick, children }: { on: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={cn(
        "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
        on ? "border-foreground/30 bg-muted/50 text-foreground" : "border-border text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  )
}

function Stat({ k, v }: { k: string; v: string }) {
  return (
    <div className="rounded-lg border px-3 py-2">
      <div className="font-mono text-[10px] text-muted-foreground">{k}</div>
      <div className="mt-0.5 font-mono text-sm">{v}</div>
    </div>
  )
}
