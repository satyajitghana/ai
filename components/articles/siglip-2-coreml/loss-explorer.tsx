"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { mexp, mlog, mlog1p } from "@/lib/dmath"
import { cn } from "@/lib/utils"

// CLIP's softmax loss against SigLIP's sigmoid loss, on one 4 x 4 batch.
//
// Rows are images, columns are captions; the diagonal holds the matching pairs.
// The cosines below are illustrative, chosen to look like a trained model's
// (matches near 0.3, the cat-cat and dog-dog pairs a little above the rest).
// They are not measured from SigLIP 2.
//
// Everything on screen is computed from the two losses as the SigLIP paper
// writes them (arXiv 2303.15343, eqs. 1 and 2), differentiated with respect to
// each logit:
//
//   softmax: dL/dl_ij = ((p_row_ij - [i=j]) + (p_col_ij - [i=j])) / 2N
//   sigmoid: dL/dl_ij = (sigmoid(l_ij) - [i=j]) / N,   l_ij = t * cos_ij + b
//
// Pick a pair, move its cosine, and the cells whose gradient changed are
// outlined. Under softmax that is the pair's whole row and column; under
// sigmoid it is the pair alone. That is the coupling the sigmoid loss removes.

const LABELS = ["abyssinian", "beagle", "pug", "sphynx"]
const N = LABELS.length

const BASE: number[][] = [
  [0.31, 0.04, 0.02, 0.12],
  [0.05, 0.28, 0.14, 0.01],
  [0.03, 0.11, 0.33, 0.02],
  [0.13, 0.02, 0.04, 0.29],
]

// The trained constants shipped in FluidInference's config.json for
// google/siglip2-base-patch16-256: exp(t') and b, read from the checkpoint.
const TRAINED = { t: 112.9, b: -16.77 }
const INIT = { t: 10, b: -10 }

type Mode = "softmax" | "sigmoid"

type Result = {
  prob: number[][]
  grad: number[][]
  loss: number
  rowSums: number[]
}

const sigmoid = (x: number) => (x >= 0 ? 1 / (1 + mexp(-x)) : mexp(x) / (1 + mexp(x)))
const softplus = (x: number) => (x > 0 ? x + mlog1p(mexp(-x)) : mlog1p(mexp(x)))

function lse(xs: number[]): number {
  const m = Math.max(...xs)
  let s = 0
  for (const x of xs) s += mexp(x - m)
  return m + mlog(s)
}

function compute(sim: number[][], mode: Mode, t: number, b: number): Result {
  const prob = sim.map((r) => r.map(() => 0))
  const grad = sim.map((r) => r.map(() => 0))
  let loss = 0
  if (mode === "sigmoid") {
    for (let i = 0; i < N; i++) {
      for (let j = 0; j < N; j++) {
        const l = t * sim[i][j] + b
        const y = i === j ? 1 : 0
        const z = i === j ? 1 : -1
        const p = sigmoid(l)
        prob[i][j] = p
        grad[i][j] = (p - y) / N
        loss += softplus(-z * l) / N
      }
    }
  } else {
    const logit = sim.map((r) => r.map((s) => t * s))
    const rowL = logit.map((r) => lse(r))
    const colL = logit[0].map((_, j) => lse(logit.map((r) => r[j])))
    for (let i = 0; i < N; i++) {
      loss += (rowL[i] - logit[i][i] + (colL[i] - logit[i][i])) / (2 * N)
      for (let j = 0; j < N; j++) {
        const pr = mexp(logit[i][j] - rowL[i])
        const pc = mexp(logit[i][j] - colL[j])
        const d = i === j ? 1 : 0
        prob[i][j] = pr
        grad[i][j] = (pr - d + (pc - d)) / (2 * N)
      }
    }
  }
  const rowSums = prob.map((r) => r.reduce((a, x) => a + x, 0))
  return { prob, grad, loss, rowSums }
}

function fmt(x: number): string {
  const a = Math.abs(x)
  if (a === 0) return "0"
  if (a < 0.001) return x.toExponential(1)
  return x.toFixed(3)
}

const PULL = "oklch(0.62 0.13 160)"
const PUSH = "oklch(0.66 0.16 45)"
const MARK = "oklch(0.60 0.15 255)"

export function LossExplorer() {
  const [mode, setMode] = useState<Mode>("sigmoid")
  const [t, setT] = useState(TRAINED.t)
  const [b, setB] = useState(TRAINED.b)
  const [cell, setCell] = useState<[number, number]>([1, 2])
  const [value, setValue] = useState(BASE[1][2])

  const [ei, ej] = cell
  const sim = BASE.map((r, i) => r.map((s, j) => (i === ei && j === ej ? value : s)))
  const cur = compute(sim, mode, t, b)
  const ref = compute(BASE, mode, t, b)

  // Exact comparison on purpose: a cell outside the picked row and column is
  // computed from bit-identical inputs, so it compares equal; any real
  // dependence, however small, shows up as a difference.
  const moved = cur.grad.map((r, i) => r.map((g, j) => g !== ref.grad[i][j]))
  const movedCount = moved.flat().filter(Boolean).length
  const edited = value !== BASE[ei][ej]
  const maxG = Math.max(1e-12, ...cur.grad.flat().map((g) => Math.abs(g)))

  const pill = (active: boolean) =>
    cn(
      "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
      active
        ? "border-foreground/30 bg-muted/50 text-foreground"
        : "border-border text-muted-foreground hover:text-foreground",
    )

  const pick = (i: number, j: number) => {
    setCell([i, j])
    setValue(BASE[i][j])
  }

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          one batch, two losses · illustrative cosines
        </span>
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            aria-pressed={mode === "softmax"}
            onClick={() => setMode("softmax")}
            className={pill(mode === "softmax")}
          >
            softmax (CLIP)
          </button>
          <button
            type="button"
            aria-pressed={mode === "sigmoid"}
            onClick={() => setMode("sigmoid")}
            className={pill(mode === "sigmoid")}
          >
            sigmoid (SigLIP)
          </button>
        </div>
      </div>

      <div className="p-3 sm:p-4">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[300px] border-separate border-spacing-1 font-mono text-[10px]">
            <thead>
              <tr>
                <th className="text-left font-normal text-muted-foreground">image ↓ caption →</th>
                {LABELS.map((l) => (
                  <th key={l} className="font-normal text-muted-foreground">
                    {l}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sim.map((row, i) => (
                <tr key={LABELS[i]}>
                  <th className="pr-1 text-left font-normal text-muted-foreground">{LABELS[i]}</th>
                  {row.map((s, j) => {
                    const g = cur.grad[i][j]
                    const k = Math.sqrt(Math.abs(g) / maxG)
                    const isSel = i === ei && j === ej
                    return (
                      <td key={j} className="p-0">
                        <button
                          type="button"
                          onClick={() => pick(i, j)}
                          aria-label={`${LABELS[i]} image with ${LABELS[j]} caption, cosine ${s.toFixed(2)}`}
                          aria-pressed={isSel}
                          className="flex w-full cursor-pointer flex-col items-center rounded-md px-1 py-1.5 leading-tight"
                          style={{
                            background: `color-mix(in oklch, ${g < 0 ? PULL : PUSH} ${Math.round(k * 55)}%, transparent)`,
                            outline: isSel
                              ? `2px solid ${MARK}`
                              : moved[i][j]
                                ? `1.5px dashed ${MARK}`
                                : "1px solid var(--border)",
                            outlineOffset: "-1px",
                          }}
                        >
                          <span className="text-muted-foreground">cos {s.toFixed(2)}</span>
                          <span className="text-[12px] tabular-nums text-foreground">
                            {fmt(cur.prob[i][j])}
                          </span>
                          <span className="tabular-nums text-muted-foreground">
                            {g < 0 ? "↑" : "↓"} {fmt(Math.abs(g))}
                          </span>
                        </button>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="flex justify-between font-mono text-[10px] text-muted-foreground">
              <span>
                cosine of the picked pair ({LABELS[ei]} image, {LABELS[ej]} caption)
              </span>
              <span className="tabular-nums text-foreground">{value.toFixed(2)}</span>
            </span>
            <Range
              min={-0.2}
              max={0.6}
              step={0.01}
              value={value}
              onChange={(e) => setValue(Number(e.target.value))}
              accent={MARK}
              className="mt-1 w-full"
            />
          </label>
          <label className="block">
            <span className="flex justify-between font-mono text-[10px] text-muted-foreground">
              <span>temperature t</span>
              <span className="tabular-nums text-foreground">{t.toFixed(1)}</span>
            </span>
            <Range
              min={1}
              max={120}
              step={0.1}
              value={t}
              onChange={(e) => setT(Number(e.target.value))}
              className="mt-1 w-full"
            />
          </label>
          <label className={cn("block", mode === "softmax" && "opacity-50")}>
            <span className="flex justify-between font-mono text-[10px] text-muted-foreground">
              <span>bias b {mode === "softmax" ? "(cancels in a softmax)" : ""}</span>
              <span className="tabular-nums text-foreground">{b.toFixed(2)}</span>
            </span>
            <Range
              min={-20}
              max={5}
              step={0.01}
              value={b}
              disabled={mode === "softmax"}
              onChange={(e) => setB(Number(e.target.value))}
              className="mt-1 w-full"
            />
          </label>
          <div className="flex flex-wrap items-end gap-1.5">
            <button
              type="button"
              onClick={() => {
                setT(INIT.t)
                setB(INIT.b)
              }}
              className={pill(t === INIT.t && b === INIT.b)}
            >
              SigLIP init: t 10, b −10
            </button>
            <button
              type="button"
              onClick={() => {
                setT(TRAINED.t)
                setB(TRAINED.b)
              }}
              className={pill(t === TRAINED.t && b === TRAINED.b)}
            >
              trained B/16: t 112.9, b −16.77
            </button>
          </div>
        </div>

        <div className="mt-3 space-y-1 font-mono text-[11px] leading-relaxed">
          <p>
            <span className="text-muted-foreground">loss </span>
            <span className="tabular-nums">{cur.loss.toFixed(4)}</span>
            <span className="text-muted-foreground"> · row sums of p </span>
            <span className="tabular-nums">{cur.rowSums.map((x) => x.toFixed(3)).join(" / ")}</span>
          </p>
          <p style={{ color: MARK }}>
            {edited
              ? `moving one cosine changed the gradient of ${movedCount} of ${N * N} cells`
              : "pick a pair and move its cosine to see which gradients change"}
          </p>
          <p className="text-muted-foreground">
            {mode === "softmax"
              ? "p is the image-to-caption softmax: every row sums to 1, so a pair's probability depends on every other caption in the batch."
              : `p = sigmoid(t · cos + b) for each pair alone; it crosses 0.5 at cos = −b/t = ${(-b / t).toFixed(3)}.`}
          </p>
        </div>
      </div>

      <figcaption className="border-t px-4 py-2.5 text-xs leading-relaxed text-muted-foreground">
        Each cell shows the pair&apos;s cosine, its probability p and the size of the gradient
        on its logit; ↑ means the update raises that logit (green), ↓ lowers it (orange). Under
        softmax, changing one cosine moves the gradient on its whole row and column, 7 of 16
        cells here. Under sigmoid it moves one. The cosines are illustrative; the trained t and b
        are the ones shipped for <code>google/siglip2-base-patch16-256</code>.
      </figcaption>
    </figure>
  )
}
