"use client"

import { useEffect, useState } from "react"
import { cn } from "@/lib/utils"

// The VHA fold at toy size: 4 physical query heads, 2 K/V groups, 8 virtual heads,
// Postmix rank 2. Three stages:
//   0  training graph: W_Q (4 heads) -> Premix (one d x d per group) -> 8 virtual
//      queries -> grouped attention over 2 K/V heads -> Postmix (I + B A^T) -> W_O
//   1  Premix folded: each virtual head (i, g) gets W_Q^(i) W_g as its own query block
//   2  Postmix folded: W_O' = ((I + A B^T) kron I_d) W_O; what is left is plain GQA-2
// The 8 x 8 mixing matrix is built from small deterministic integers so the server and
// client render the same cells (only + - * / are used).

const G0 = "oklch(0.64 0.17 25)" // K/V group 0
const G1 = "oklch(0.62 0.14 245)" // K/V group 1
const PRE = "oklch(0.75 0.14 60)" // Premix
const POST = "oklch(0.58 0.15 300)" // Postmix

const HV = 8
const R = 2
// A, B in R^{8x2}: small fixed values (B is what training learns away from zero)
const A = [
  [0.6, 0.1], [0.5, -0.2], [0.4, 0.3], [0.7, 0.0],
  [0.1, 0.6], [-0.2, 0.5], [0.3, 0.4], [0.0, 0.7],
]
const Bm = [
  [0.5, 0.0], [0.4, 0.1], [0.6, -0.1], [0.3, 0.2],
  [0.1, 0.4], [0.0, 0.6], [-0.1, 0.5], [0.2, 0.3],
]
// M[i][j]: weight of source head j in output head i, M = I + B A^T
const M: number[][] = Array.from({ length: HV }, (_, i) =>
  Array.from({ length: HV }, (_, j) => {
    let s = i === j ? 1 : 0
    for (let k = 0; k < R; k++) s += Bm[i][k] * A[j][k]
    return s
  }),
)

const STAGES = [
  {
    k: "train",
    label: "1 · train",
    text: "Training graph. W_Q makes 4 physical query heads. Premix multiplies each by one d×d matrix per K/V group, giving 8 virtual heads. Each group of 4 virtual heads attends over its own K/V head. Postmix mixes the 8 head outputs with I + BAᵀ before W_O.",
  },
  {
    k: "q",
    label: "2 · fold Premix",
    text: "Premix folded. Matrix products associate, so X·W_Q⁽ⁱ⁾·W_g = X·(W_Q⁽ⁱ⁾W_g). Precompute that product for every pair (i, g) and you have 8 ordinary query blocks. The per-head norm and RoPE come after it in both graphs, so nothing changes.",
  },
  {
    k: "o",
    label: "3 · fold Postmix",
    text: "Postmix folded. Mixing heads and then projecting is one linear map: W_O′ = ((I + ABᵀ) ⊗ I_d)·W_O. What is left is a stock GQA layer with 8 query heads and 2 K/V heads. The cache was always 2 heads wide; only the weights changed.",
  },
] as const

export function FoldDiagram() {
  const [stage, setStage] = useState(0)
  const [auto, setAuto] = useState(false)

  useEffect(() => {
    if (!auto) return
    const t = setInterval(() => setStage((s) => (s + 1) % 3), 2600)
    return () => clearInterval(t)
  }, [auto])

  const qFolded = stage >= 1
  const oFolded = stage >= 2
  const ease = "transform 700ms cubic-bezier(.2,.8,.2,1), opacity 600ms ease"

  // geometry
  const qx = 70 // W_Q column
  const vx = 250 // virtual query column
  const ax = 330 // attention / K-V column
  const px = 430 // postmix matrix
  const ox = 580 // W_O
  const headY = (i: number) => 52 + i * 26 // 8 rows

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          Folding VHA into GQA-2 · toy size: 4 physical heads, 2 groups, 8 virtual heads
        </span>
        <div className="flex flex-wrap gap-1.5">
          {STAGES.map((s, i) => (
            <button
              key={s.k}
              type="button"
              aria-pressed={stage === i}
              onClick={() => {
                setAuto(false)
                setStage(i)
              }}
              className={cn(
                "rounded border px-2 py-0.5 font-mono text-[11px]",
                stage === i ? "border-foreground/40 bg-foreground/10 text-foreground" : "text-muted-foreground",
              )}
            >
              {s.label}
            </button>
          ))}
          <button
            type="button"
            aria-pressed={auto}
            onClick={() => setAuto((a) => !a)}
            className={cn(
              "rounded border px-2 py-0.5 font-mono text-[11px]",
              auto ? "border-foreground/40 bg-foreground/10 text-foreground" : "text-muted-foreground",
            )}
          >
            {auto ? "pause" : "play"}
          </button>
        </div>
      </div>

      <div className="p-3 sm:p-4">
        <svg
          viewBox="0 0 680 290"
          className="w-full"
          role="img"
          aria-label={STAGES[stage].text}
        >
          {/* X */}
          <rect x={6} y={128} width={34} height={34} rx={6} fill="none" stroke="currentColor" className="text-muted-foreground" />
          <text x={23} y={150} textAnchor="middle" fontSize={13} className="fill-foreground font-mono">X</text>
          <line x1={40} y1={145} x2={qx - 10} y2={145} stroke="currentColor" className="text-border" />

          {/* W_Q: 4 physical blocks (training) */}
          <g style={{ opacity: qFolded ? 0 : 1, transition: ease }}>
            {[0, 1, 2, 3].map((i) => (
              <rect key={i} x={qx} y={70 + i * 40} width={34} height={30} rx={4} fill="currentColor" className="text-muted-foreground/30" stroke="currentColor" />
            ))}
            <text x={qx + 17} y={60} textAnchor="middle" fontSize={10} className="fill-muted-foreground font-mono">W_Q · 4</text>
          </g>
          {/* W_Q after fold: 8 blocks tinted by group */}
          <g style={{ opacity: qFolded ? 1 : 0, transition: ease }}>
            {Array.from({ length: HV }, (_, i) => (
              <rect key={i} x={qx} y={headY(i) - 9} width={34} height={18} rx={3} fill={i < 4 ? G0 : G1} fillOpacity={0.55} stroke={i < 4 ? G0 : G1} />
            ))}
            <text x={qx + 17} y={30} textAnchor="middle" fontSize={10} className="fill-muted-foreground font-mono">W_Q′ · 8</text>
          </g>

          {/* Premix: two d x d matrices, slide into W_Q when folded */}
          {[0, 1].map((g) => (
            <g
              key={g}
              style={{
                transform: qFolded ? `translate(${qx + 17 - 160}px, ${g === 0 ? 0 : 0}px) scale(0.2)` : "translate(0px, 0px) scale(1)",
                transformOrigin: `${160}px ${g === 0 ? 100 : 190}px`,
                transformBox: "view-box",
                opacity: qFolded ? 0 : 1,
                transition: ease,
              }}
            >
              <rect x={140} y={g === 0 ? 78 : 168} width={44} height={44} rx={5} fill={PRE} fillOpacity={0.35} stroke={PRE} strokeDasharray="4 3" />
              <text x={162} y={g === 0 ? 104 : 194} textAnchor="middle" fontSize={10} className="fill-foreground font-mono">W_{g}</text>
            </g>
          ))}
          <text x={162} y={242} textAnchor="middle" fontSize={10} className="fill-muted-foreground font-mono" style={{ opacity: qFolded ? 0 : 1, transition: ease }}>
            Premix
          </text>

          {/* lines W_Q -> virtual heads */}
          {Array.from({ length: HV }, (_, i) => (
            <line key={i} x1={qx + 34} y1={qFolded ? headY(i) : 85 + (i % 4) * 40} x2={vx - 6} y2={headY(i)} stroke={i < 4 ? G0 : G1} strokeOpacity={0.45} style={{ transition: ease }} />
          ))}

          {/* virtual query heads */}
          {Array.from({ length: HV }, (_, i) => (
            <rect key={i} x={vx - 6} y={headY(i) - 7} width={22} height={14} rx={3} fill={i < 4 ? G0 : G1} />
          ))}
          <text x={vx + 5} y={30} textAnchor="middle" fontSize={10} className="fill-muted-foreground font-mono">8 queries</text>

          {/* K/V heads: 2, the cache */}
          {[0, 1].map((g) => (
            <g key={g}>
              <rect x={ax} y={g === 0 ? 68 : 172} width={30} height={64} rx={5} fill="none" stroke={g === 0 ? G0 : G1} strokeWidth={2} />
              <text x={ax + 15} y={g === 0 ? 104 : 208} textAnchor="middle" fontSize={10} className="fill-foreground font-mono">KV{g}</text>
              {[0, 1, 2, 3].map((j) => (
                <line key={j} x1={vx + 16} y1={headY(g * 4 + j)} x2={ax} y2={(g === 0 ? 100 : 204)} stroke={g === 0 ? G0 : G1} strokeOpacity={0.3} />
              ))}
            </g>
          ))}
          <text x={ax + 15} y={262} textAnchor="middle" fontSize={10} className="fill-muted-foreground font-mono">cache: 2 heads</text>

          {/* outputs -> postmix */}
          {Array.from({ length: HV }, (_, i) => (
            <line key={i} x1={ax + 30} y1={(i < 4 ? 100 : 204)} x2={oFolded ? ox : px - 4} y2={headY(i)} stroke="currentColor" className="text-border" style={{ transition: ease }} />
          ))}

          {/* Postmix matrix I + B A^T */}
          <g
            style={{
              transform: oFolded ? `translate(${ox - px + 4}px, 0px) scale(0.3)` : "translate(0px, 0px) scale(1)",
              transformOrigin: `${px + 52}px 145px`,
              transformBox: "view-box",
              opacity: oFolded ? 0 : 1,
              transition: ease,
            }}
          >
            {M.map((row, i) =>
              row.map((v, j) => (
                <rect
                  key={`${i}-${j}`}
                  x={px + j * 13}
                  y={headY(i) - 6}
                  width={12}
                  height={12}
                  fill={POST}
                  fillOpacity={Math.min(1, Math.abs(v)) * 0.85 + 0.05}
                />
              )),
            )}
            <text x={px + 52} y={30} textAnchor="middle" fontSize={10} className="fill-muted-foreground font-mono">Postmix I + BAᵀ</text>
          </g>

          {/* W_O */}
          <rect
            x={ox}
            y={50}
            width={40}
            height={190}
            rx={5}
            fill={oFolded ? POST : "currentColor"}
            fillOpacity={oFolded ? 0.3 : 0.12}
            stroke="currentColor"
            className="text-muted-foreground"
            style={{ transition: "fill 600ms ease, fill-opacity 600ms ease" }}
          />
          <text x={ox + 20} y={150} textAnchor="middle" fontSize={11} className="fill-foreground font-mono">{oFolded ? "W_O′" : "W_O"}</text>
          <line x1={ox + 40} y1={145} x2={672} y2={145} stroke="currentColor" className="text-border" />

          <text x={340} y={284} textAnchor="middle" fontSize={11} className="fill-foreground font-mono">
            {stage === 2 ? "= standard GQA, 8 query heads, 2 K/V heads" : stage === 1 ? "Q side is already plain GQA" : "VHA as trained"}
          </text>
        </svg>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{STAGES[stage].text}</p>
      </div>
    </figure>
  )
}
