"use client"

// Three ways to turn 200 overlapping multi-view mask proposals into one
// panoptic labelling, run on a toy small enough to check by hand.
//
// The algorithms are transcribed from naver/panst3r@0253909,
// src/panst3r/engine/postprocess.py:
//
//   standard v1  = panoptic_inference_v1: mask_threshold 0.5, overlap 0.8, 1 pass
//   standard v2  = panoptic_inference_v2: mask_threshold 0.25, overlap 0.5, 2 passes
//                  (the default the v2 checkpoint ships with)
//   QUBO         = panoptic_inference_qubo: choose u in {0,1}^m maximising
//                  sum u_i A_i - lambda * sum_{i<j} u_i u_j O_ij
//                  with A_i = sum of mask i, O_ij = sum of min(mask_i, mask_j),
//                  lambda = 1 + penalty (penalty = 1 in weight_from_masks).
//                  The repo solves it by simulated annealing (20 restarts x
//                  10,000 flips); six proposals have 64 subsets, so here it is
//                  solved exactly. Class scores do not enter the selection.
//
// The six proposals, their mask values and their scores are a WORKED EXAMPLE
// chosen to show the failure mode the paper describes, not model output.

import { useMemo, useState } from "react"

import { Range } from "@/components/articles/ui/range"

const N = 16 // pixels per view in the toy
const VIEWS = 2

type Proposal = {
  id: string
  name: string
  score: number
  color: string
  // mask value per pixel, view-major: [view][pixel]
  m: number[][]
}

function strip(spans: [number, number, number][], base: number): number[] {
  const row = Array.from({ length: N }, () => base)
  for (const [a, b, v] of spans) for (let i = a; i <= b; i++) row[i] = v
  return row
}

const PROPOSALS: Proposal[] = [
  {
    id: "q1",
    name: "chair, both views",
    score: 0.9,
    color: "oklch(0.62 0.17 255)",
    m: [strip([[3, 8, 0.8]], 0), strip([[2, 7, 0.9]], 0)],
  },
  {
    id: "q2",
    name: "chair, view 1 only",
    score: 0.85,
    color: "oklch(0.70 0.15 300)",
    m: [strip([[3, 8, 0.95]], 0), strip([], 0)],
  },
  {
    id: "q3",
    name: "table, both views",
    score: 0.8,
    color: "oklch(0.70 0.14 150)",
    m: [strip([[10, 14, 0.9]], 0), strip([[9, 13, 0.9]], 0)],
  },
  {
    id: "q4",
    name: "wall",
    score: 0.7,
    color: "oklch(0.80 0.10 85)",
    m: [
      strip([[3, 8, 0.15], [10, 14, 0.15]], 0.7),
      strip([[2, 7, 0.15], [9, 13, 0.15]], 0.7),
    ],
  },
  {
    id: "q5",
    name: "chair + table blob",
    score: 0.5,
    color: "oklch(0.66 0.14 30)",
    m: [strip([[3, 14, 0.55]], 0), strip([[2, 13, 0.55]], 0)],
  },
  {
    id: "q6",
    name: "lamp fragment",
    score: 0.15,
    color: "oklch(0.72 0.13 200)",
    m: [strip([], 0), strip([[14, 15, 0.7]], 0)],
  },
]

type Method = "v1" | "v2" | "qubo"

const METHOD_LABEL: Record<Method, string> = {
  v1: "standard v1",
  v2: "standard v2 (repo default)",
  qubo: "QUBO (paper)",
}

// Returns, per view and pixel, the index of the winning proposal or -1 (void).
function standardMerge(
  maskThr: number,
  overlapThr: number,
  iters: number,
  clsThr = 0.1,
): { label: number[][]; kept: number[] } {
  let cand = PROPOSALS.map((_, i) => i).filter((i) => PROPOSALS[i].score > clsThr)
  let label: number[][] = []
  for (let it = 0; it < iters; it++) {
    label = Array.from({ length: VIEWS }, () => Array.from({ length: N }, () => -1))
    // per-pixel argmax of score * mask over the current candidates
    const arg = Array.from({ length: VIEWS }, (_, v) =>
      Array.from({ length: N }, (_, p) => {
        let best = -1
        let bv = -1
        for (const i of cand) {
          const s = PROPOSALS[i].score * PROPOSALS[i].m[v][p]
          if (s > bv) {
            bv = s
            best = i
          }
        }
        return best
      }),
    )
    const selected: number[] = []
    for (const i of cand) {
      let orig = 0
      let won = 0
      for (let v = 0; v < VIEWS; v++)
        for (let p = 0; p < N; p++) {
          const mv = PROPOSALS[i].m[v][p]
          if (mv >= 0.5) orig++
          if (arg[v][p] === i && mv >= maskThr) won++
        }
      if (won > 0 && orig > 0 && won / orig >= overlapThr) {
        selected.push(i)
        for (let v = 0; v < VIEWS; v++)
          for (let p = 0; p < N; p++)
            if (arg[v][p] === i && PROPOSALS[i].m[v][p] >= maskThr) label[v][p] = i
      }
    }
    cand = selected
  }
  return { label, kept: cand }
}

function area(i: number): number {
  let s = 0
  for (let v = 0; v < VIEWS; v++) for (let p = 0; p < N; p++) s += PROPOSALS[i].m[v][p]
  return s
}

function overlap(i: number, j: number): number {
  let s = 0
  for (let v = 0; v < VIEWS; v++)
    for (let p = 0; p < N; p++) s += Math.min(PROPOSALS[i].m[v][p], PROPOSALS[j].m[v][p])
  return s
}

const AREA = PROPOSALS.map((_, i) => area(i))
const OVER = PROPOSALS.map((_, i) => PROPOSALS.map((__, j) => (i === j ? 0 : overlap(i, j))))

function objective(sel: boolean[], lambda: number): number {
  let s = 0
  for (let i = 0; i < sel.length; i++) {
    if (!sel[i]) continue
    s += AREA[i]
    for (let j = i + 1; j < sel.length; j++) if (sel[j]) s -= lambda * OVER[i][j]
  }
  return s
}

function bestSubset(lambda: number): boolean[] {
  let best: boolean[] = PROPOSALS.map(() => false)
  let bv = -Infinity
  for (let mask = 0; mask < 1 << PROPOSALS.length; mask++) {
    const sel = PROPOSALS.map((_, i) => ((mask >> i) & 1) === 1)
    const v = objective(sel, lambda)
    if (v > bv + 1e-9) {
      bv = v
      best = sel
    }
  }
  return best
}

// QUBO labelling: per-pixel argmax of the raw mask over the selected set.
function quboLabel(sel: boolean[]): number[][] {
  return Array.from({ length: VIEWS }, (_, v) =>
    Array.from({ length: N }, (_, p) => {
      let best = -1
      let bv = 0
      sel.forEach((on, i) => {
        if (on && PROPOSALS[i].m[v][p] > bv) {
          bv = PROPOSALS[i].m[v][p]
          best = i
        }
      })
      return best
    }),
  )
}

const CELL = 34
const GX = 70
const SVG_W = GX + N * CELL + 10
const ROW_Y = [26, 26 + CELL + 22]
const SVG_H = ROW_Y[1] + CELL + 12

export function MergeLab() {
  const [method, setMethod] = useState<Method>("qubo")
  const [lambda10, setLambda10] = useState(20) // lambda x 10
  const lambda = lambda10 / 10
  const [manual, setManual] = useState<boolean[] | null>(null)

  const optimum = useMemo(() => bestSubset(lambda), [lambda])
  const quboSel = manual ?? optimum

  const { label, kept } = useMemo(() => {
    if (method === "v1") return standardMerge(0.5, 0.8, 1)
    if (method === "v2") return standardMerge(0.25, 0.5, 2)
    return {
      label: quboLabel(quboSel),
      kept: quboSel.flatMap((on, i) => (on ? [i] : [])),
    }
  }, [method, quboSel])

  const voids = label.flat().filter((x) => x < 0).length
  const chairIds = new Set(
    label.flatMap((row, v) =>
      row.filter((_, p) => (v === 0 ? p >= 3 && p <= 8 : p >= 2 && p <= 7)),
    ).filter((x) => x === 0 || x === 1),
  )
  const obj = objective(quboSel, lambda)
  const optObj = objective(optimum, lambda)

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/20 to-transparent">
      <div className="flex items-center justify-between border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>mask merging · six proposals, two views</span>
        <span className="text-muted-foreground/60">worked example</span>
      </div>

      <div className="space-y-4 p-4 sm:p-5">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Merging method">
          {(Object.keys(METHOD_LABEL) as Method[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMethod(m)}
              aria-pressed={method === m}
              className={
                "rounded-md border px-3 py-1.5 font-mono text-xs transition-colors " +
                (method === m
                  ? "border-foreground/40 bg-foreground/10 text-foreground"
                  : "text-muted-foreground hover:bg-muted/40")
              }
            >
              {METHOD_LABEL[m]}
            </button>
          ))}
        </div>

        <svg
          viewBox={`0 0 ${SVG_W} ${SVG_H}`}
          className="w-full"
          role="img"
          aria-label={`Final labelling of two views of sixteen pixels under ${METHOD_LABEL[method]}. ${voids} pixels are left void and the chair carries ${chairIds.size} different instance ids across the two views.`}
        >
          <text x={GX} y={14} className="fill-muted-foreground font-mono" fontSize={10}>
            pixel 0 → 15; colour = the proposal that owns the pixel, hatched = void
          </text>
          <defs>
            <pattern id="ml-void" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <line x1="0" y1="0" x2="0" y2="6" stroke="currentColor" strokeWidth="1.2" className="text-muted-foreground/50" />
            </pattern>
          </defs>
          {label.map((row, v) => (
            <g key={v}>
              <text x={8} y={ROW_Y[v] + CELL / 2 + 4} className="fill-foreground font-mono" fontSize={11}>
                view {v + 1}
              </text>
              {row.map((owner, p) => (
                <g key={p}>
                  <rect
                    x={GX + p * CELL + 1}
                    y={ROW_Y[v]}
                    width={CELL - 2}
                    height={CELL}
                    rx={3}
                    fill={owner < 0 ? "url(#ml-void)" : PROPOSALS[owner].color}
                    stroke="currentColor"
                    strokeOpacity={0.15}
                  />
                  {owner >= 0 && (
                    <text
                      x={GX + p * CELL + CELL / 2}
                      y={ROW_Y[v] + CELL / 2 + 4}
                      textAnchor="middle"
                      className="fill-black/70 font-mono"
                      fontSize={10}
                    >
                      {PROPOSALS[owner].id}
                    </text>
                  )}
                </g>
              ))}
            </g>
          ))}
        </svg>

        <p className="font-mono text-xs text-muted-foreground">
          kept: {kept.map((i) => PROPOSALS[i].id).join(", ") || "none"} · void pixels: {voids} of {VIEWS * N} ·
          chair ids across views: {chairIds.size}
          {chairIds.size > 1 ? " (one chair, two identities)" : ""}
        </p>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] font-mono text-xs">
            <thead>
              <tr className="text-left text-muted-foreground">
                <th className="py-1 pr-2 font-normal">select</th>
                <th className="py-1 pr-2 font-normal">proposal</th>
                <th className="py-1 pr-2 font-normal">class score</th>
                <th className="py-1 pr-2 font-normal">area A_i</th>
                <th className="py-1 font-normal">largest overlap O_ij</th>
              </tr>
            </thead>
            <tbody>
              {PROPOSALS.map((q, i) => {
                const j = OVER[i].indexOf(Math.max(...OVER[i]))
                return (
                  <tr key={q.id} className="border-t border-border/50">
                    <td className="py-1 pr-2">
                      <input
                        type="checkbox"
                        aria-label={`select ${q.id}`}
                        checked={quboSel[i]}
                        disabled={method !== "qubo"}
                        onChange={() => {
                          const next = [...quboSel]
                          next[i] = !next[i]
                          setManual(next)
                        }}
                      />
                    </td>
                    <td className="py-1 pr-2">
                      <span className="mr-1.5 inline-block h-2.5 w-2.5 rounded-sm align-middle" style={{ background: q.color }} />
                      {q.id} {q.name}
                    </td>
                    <td className="py-1 pr-2">{q.score.toFixed(2)}</td>
                    <td className="py-1 pr-2">{AREA[i].toFixed(1)}</td>
                    <td className="py-1">
                      {OVER[i][j].toFixed(1)} with {PROPOSALS[j].id}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-center">
          <label className="block font-mono text-xs text-muted-foreground">
            overlap penalty λ = {lambda.toFixed(1)} (repo: 1 + penalty = 2.0)
            <Range
              min={10}
              max={40}
              step={1}
              value={lambda10}
              onChange={(e) => {
                setLambda10(Number(e.target.value))
                setManual(null)
              }}
              className="mt-2 w-full"
              aria-label="overlap penalty lambda"
            />
          </label>
          <div className="font-mono text-xs">
            <div>
              objective: <span className="text-foreground">{obj.toFixed(2)}</span>
            </div>
            <div className="text-muted-foreground">
              optimum: {optObj.toFixed(2)} = {optimum.flatMap((on, i) => (on ? [PROPOSALS[i].id] : [])).join(" + ")}
            </div>
            {manual && (
              <button type="button" onClick={() => setManual(null)} className="mt-1 underline">
                reset to optimum
              </button>
            )}
          </div>
        </div>
      </div>

      <figcaption className="border-t px-4 py-3 text-xs text-muted-foreground">
        Standard merging votes per pixel on class score times mask, then keeps a proposal only if it still owns enough of
        its own area. Here the view-1-only duplicate q2 outbids q1 on view 1, so v1 drops q1 and leaves the chair in view
        2 as a hole, while v2 keeps both and gives one chair two ids. QUBO scores whole subsets on coverage minus λ times
        overlap and keeps q1, q3 and q4. Toy values, not model output; the rules are the repo&apos;s.
      </figcaption>
    </figure>
  )
}
