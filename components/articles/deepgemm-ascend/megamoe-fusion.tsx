"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// MegaMoE is one op that fuses the whole expert layer: EP dispatch, the two
// grouped GEMMs (up/gate then down), the SwiGLU between them, and the combine,
// plus a shared expert run locally. In the kernel these are not five launches;
// the two grouped GEMMs "share the same epilogue credits" (mega_moe.hpp), the
// SwiGLU and the combine reduction run in that epilogue, and the cross-rank
// dispatch/combine comm overlaps the compute. The win is that the activations
// never round-trip through HBM between stages, and the all-to-all hides behind
// the matmuls instead of serialising with them.
//
// The toggle contrasts that with the naive path: one kernel per stage, each
// writing its output to HBM and the next reading it back, with the comm on the
// critical path. Same math; the fused version is why 846 of 865 FP8 TFLOPS
// survive once you add communication to a matrix multiply.

const COMM = "oklch(0.60 0.13 165)"
const GEMM = "oklch(0.60 0.15 255)"
const ACT = "oklch(0.70 0.15 70)"
const NEUT = "oklch(0.55 0.02 260)"

type Stage = { id: string; label: string; sub: string; x: number; color: string }

const W = 128
const H = 58
const GAP = 14
const Y = 54
const stageX = (i: number) => 10 + i * (W + GAP)

const STAGES: Stage[] = [
  { id: "disp", label: "Dispatch", sub: "route to experts", x: stageX(0), color: COMM },
  { id: "g1", label: "Grouped GEMM 1", sub: "up / gate proj", x: stageX(1), color: GEMM },
  { id: "swiglu", label: "SwiGLU", sub: "silu(gate) x up", x: stageX(2), color: ACT },
  { id: "g2", label: "Grouped GEMM 2", sub: "down proj", x: stageX(3), color: GEMM },
  { id: "comb", label: "Combine", sub: "weighted sum", x: stageX(4), color: COMM },
]

const VIEW_W = stageX(5) - GAP + 10

export function MegaMoeFusion() {
  const [fused, setFused] = useState(true)

  const cx = (s: Stage) => s.x + W / 2
  const frameL = STAGES[0].x - 6
  const frameR = STAGES[STAGES.length - 1].x + W + 6

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          the MegaMoE fused op
        </span>
        <div className="flex gap-1 rounded-lg border bg-background/60 p-0.5">
          <button
            type="button"
            onClick={() => setFused(true)}
            className={cn(
              "rounded-md px-2.5 py-1 font-mono text-[11px] transition-colors",
              fused ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground",
            )}
            aria-pressed={fused}
          >
            fused (MegaMoE)
          </button>
          <button
            type="button"
            onClick={() => setFused(false)}
            className={cn(
              "rounded-md px-2.5 py-1 font-mono text-[11px] transition-colors",
              !fused ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground",
            )}
            aria-pressed={!fused}
          >
            one kernel per stage
          </button>
        </div>
      </div>

      <div className="p-3 sm:p-5">
        <svg
          viewBox={`0 0 ${VIEW_W} 196`}
          className="w-full text-foreground"
          role="img"
          aria-label="Pipeline of the MegaMoE fused op: dispatch, grouped GEMM 1, SwiGLU, grouped GEMM 2, combine, with a shared expert run locally and reduced at combine."
        >
          <defs>
            <marker id="mm-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M0,0 L10,5 L0,10 z" fill="currentColor" />
            </marker>
          </defs>

          {/* fused frame */}
          {fused && (
            <g>
              <rect
                x={frameL}
                y={Y - 16}
                width={frameR - frameL}
                height={H + 32}
                rx={12}
                fill="oklch(0.6 0.13 165 / 0.06)"
                stroke={COMM}
                strokeWidth={1.5}
                strokeDasharray="6 5"
              />
              <text x={frameL + 10} y={Y - 22} className="fill-foreground" fontSize="12" fontWeight="600">
                one kernel &middot; activations stay on-chip (L0C / UB) &middot; comm overlaps compute
              </text>
            </g>
          )}

          {/* main flow arrows */}
          {STAGES.slice(0, -1).map((s, i) => {
            const next = STAGES[i + 1]
            return (
              <line
                key={`e-${s.id}`}
                x1={s.x + W}
                y1={Y + H / 2}
                x2={next.x}
                y2={Y + H / 2}
                stroke={NEUT}
                strokeWidth={1.75}
                markerEnd="url(#mm-arrow)"
              />
            )
          })}

          {/* unfused HBM round-trips */}
          {!fused &&
            STAGES.slice(0, -1).map((s, i) => {
              const midX = (s.x + W + STAGES[i + 1].x) / 2
              return (
                <g key={`hbm-${s.id}`} stroke={NEUT}>
                  <line x1={midX} y1={Y + H / 2} x2={midX} y2={Y + H + 28} strokeWidth={1.25} strokeDasharray="3 3" markerEnd="url(#mm-arrow)" />
                  <rect x={midX - 15} y={Y + H + 28} width={30} height={16} rx={3} fill="oklch(0.55 0.02 260 / 0.14)" strokeWidth={1} />
                  <text x={midX} y={Y + H + 40} textAnchor="middle" className="fill-muted-foreground" fontSize="9">HBM</text>
                </g>
              )
            })}

          {/* stage boxes */}
          {STAGES.map((s) => (
            <g key={s.id}>
              <rect
                x={s.x}
                y={Y}
                width={W}
                height={H}
                rx={9}
                fill={`${s.color.replace(")", " / 0.1)")}`}
                stroke={s.color}
                strokeWidth={1.5}
              />
              <text x={cx(s)} y={Y + 24} textAnchor="middle" className="fill-foreground" fontSize="12.5" fontWeight="600">
                {s.label}
              </text>
              <text x={cx(s)} y={Y + 41} textAnchor="middle" className="fill-muted-foreground" fontSize="10.5">
                {s.sub}
              </text>
            </g>
          ))}

          {/* shared expert branch */}
          <g>
            <rect
              x={STAGES[1].x}
              y={Y + H + 40}
              width={STAGES[3].x + W - STAGES[1].x}
              height={34}
              rx={8}
              fill="oklch(0.6 0.15 255 / 0.07)"
              stroke={GEMM}
              strokeWidth={1.25}
              strokeDasharray="5 4"
            />
            <text
              x={(STAGES[1].x + STAGES[3].x + W) / 2}
              y={Y + H + 61}
              textAnchor="middle"
              className="fill-foreground"
              fontSize="11.5"
            >
              Shared expert &middot; run locally, no dispatch
            </text>
            {/* shared feeds into combine */}
            <path
              d={`M ${STAGES[3].x + W} ${Y + H + 57} H ${cx(STAGES[4])} V ${Y + H}`}
              fill="none"
              stroke={GEMM}
              strokeWidth={1.25}
              strokeDasharray="5 4"
              markerEnd="url(#mm-arrow)"
            />
          </g>

          {/* in / out labels */}
          <text x={STAGES[0].x} y={Y - 6} className="fill-muted-foreground" fontSize="10">tokens, top-6 routing &rarr;</text>
          <text x={STAGES[4].x + W} y={Y - 6} textAnchor="end" className="fill-muted-foreground" fontSize="10">&rarr; back to origin rank</text>
        </svg>

        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          {fused ? (
            <>
              One launch. The two grouped GEMMs share one epilogue, so SwiGLU and
              the combine reduction run without materialising the intermediate to
              HBM, and the cross-rank dispatch and combine overlap the matmuls
              instead of blocking on them. The shared expert runs locally and is
              reduced in at combine.
            </>
          ) : (
            <>
              Five kernels, four HBM round-trips. Each stage writes its output to
              HBM and the next reads it back, and the all-to-all sits on the
              critical path. Same arithmetic; the memory traffic and the
              un-overlapped comm are what pull the achieved TFLOPS down.
            </>
          )}
        </p>
      </div>

      <figcaption className="border-t px-4 py-2.5 font-mono text-[11px] leading-5 text-muted-foreground">
        Redrawn from DeepGEMM-Ascend&rsquo;s README description and the
        mega_moe.hpp kernel. Benchmarked at EP8, top-6, one shared expert.
      </figcaption>
    </figure>
  )
}
