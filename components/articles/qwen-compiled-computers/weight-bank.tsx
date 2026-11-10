"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { cn } from "@/lib/utils"

// A qwenLab-style weight bank, shrunk to 8 x 8 so it fits on screen. Ticks 1..8 write one column of W into one row
// of a DeltaNet head's state with a one-hot key and write strength 1 (gate open). Tick 9 reads the state with the
// activation x as the query: o = S^T q, which is W x when nothing normalises q. Qwen3.5's stock layer L2-normalises
// q and divides by sqrt(d), so it returns W x / (|x| sqrt(d)): the direction survives, the scale does not.
// The numbers in the footer are MEASURED at the real size (128 x 128, bank.py, transformers' reference recurrence).

const D = 8
// a fixed small block and activation (integers, so the arithmetic on the page is exact)
const WM = [
  [2, -1, 0, 3, 1, -2, 0, 1],
  [0, 1, -3, 1, 2, 0, -1, 2],
  [1, 0, 2, -1, 0, 3, 1, -2],
  [-2, 3, 1, 0, -1, 1, 2, 0],
  [1, 1, 0, 2, -3, 0, 1, 1],
  [0, -2, 1, 1, 1, 2, -1, 3],
  [3, 0, -1, -2, 0, 1, 2, 1],
  [-1, 2, 2, 0, 1, -1, 0, -3],
]
const X = [1, -2, 3, 0, 2, -1, 1, 2]
const WX = WM.map((row) => row.reduce((a, w, j) => a + w * X[j], 0))
const XN = Math.sqrt(X.reduce((a, v) => a + v * v, 0))

export function WeightBank() {
  const [t, setT] = useState(D + 1)
  const [stock, setStock] = useState(false)
  const written = Math.min(t, D)
  const reading = t > D
  // state rows: row i holds column i of W (S = W^T), once its tick has passed
  const S = Array.from({ length: D }, (_, i) => (i < written ? WM.map((row) => row[i]) : Array<number>(D).fill(0)))
  const raw = Array.from({ length: D }, (_, o) => S.reduce((a, row, i) => a + row[o] * X[i], 0))
  const out = stock ? raw.map((v) => v / (XN * Math.sqrt(D))) : raw
  const vmax = Math.max(...WX.map(Math.abs))

  return (
    <figure className="my-8 overflow-hidden rounded-md border">
      <div className="border-b px-3 py-2 font-mono text-xs text-muted-foreground">
        a weight block in a DeltaNet head · 8 x 8 here, 128 x 128 in qwenLab · reading with x as the query is a matmul
      </div>
      <div className="flex flex-wrap items-center gap-3 border-b px-4 py-2.5 text-xs">
        <span className="shrink-0 font-mono text-muted-foreground">tick</span>
        <Range min={0} max={D + 1} step={1} value={t} onChange={(e) => setT(Number(e.target.value))} aria-label="tick" className="w-48" />
        <span className="w-40 shrink-0 font-mono tabular-nums">
          {t === 0 ? "empty state" : reading ? `tick ${t}: read with x` : `tick ${t}: write row ${t - 1}`}
        </span>
        <div className="ml-auto flex gap-1">
          {[false, true].map((v) => (
            <button
              key={String(v)}
              type="button"
              onClick={() => setStock(v)}
              aria-pressed={stock === v}
              className={cn("rounded border px-2 py-0.5 font-mono", stock === v ? "bg-muted" : "text-muted-foreground hover:bg-muted")}
            >
              {v ? "stock q/k L2-norm" : "no norm (qwenLab)"}
            </button>
          ))}
        </div>
      </div>
      <div className="grid gap-5 p-4 md:grid-cols-[auto_1fr]">
        <div>
          <div className="mb-1.5 font-mono text-[11px] text-muted-foreground">state S, row i = column i of W</div>
          <div className="grid w-fit grid-cols-8 gap-0.5 font-mono text-[10px] tabular-nums">
            {S.flatMap((row, i) =>
              row.map((v, j) => (
                <div
                  key={`${i}-${j}`}
                  className={cn(
                    "flex h-6 w-6 items-center justify-center rounded-sm",
                    i === t - 1 && !reading ? "ring-1 ring-foreground" : "",
                    i < written ? "" : "text-muted-foreground/40",
                  )}
                  style={{ background: i < written && v !== 0 ? `oklch(0.65 0.13 ${v > 0 ? 250 : 30} / ${0.15 + 0.12 * Math.abs(v)})` : undefined }}
                >
                  {i < written ? v : "0"}
                </div>
              )),
            )}
          </div>
          <div className="mt-2 font-mono text-[11px] text-muted-foreground">
            key at tick {Math.max(1, Math.min(t, D))}: one-hot e<sub>{Math.max(0, Math.min(t, D) - 1)}</sub>, beta 1, gate 1
          </div>
        </div>
        <div>
          <div className="mb-1.5 font-mono text-[11px] text-muted-foreground">
            read: o = S<sup>T</sup> x, against W x {reading ? "" : "(read happens at tick 9)"}
          </div>
          <div className="space-y-1">
            {WX.map((ref, o) => {
              const v = reading ? out[o] : 0
              return (
                <div key={o} className="flex items-center gap-2 font-mono text-[11px] tabular-nums">
                  <span className="w-5 text-muted-foreground">y{o}</span>
                  <div className="relative h-3.5 flex-1 rounded-sm bg-muted/50">
                    <div className="absolute inset-y-0 left-1/2 w-px bg-foreground/20" />
                    <div
                      className="absolute inset-y-0.5 rounded-sm bg-[oklch(0.6_0.14_250)]"
                      style={{ left: `${50 + Math.min(0, v / vmax) * 50}%`, width: `${(Math.abs(v) / vmax) * 50}%` }}
                    />
                    <div className="absolute inset-y-0 w-0.5 bg-[oklch(0.62_0.18_25)]" style={{ left: `${50 + (ref / vmax) * 50}%` }} />
                  </div>
                  <span className="w-28 text-right">
                    {reading ? (stock ? v.toFixed(3) : v.toFixed(0)) : "·"} <span className="text-muted-foreground">/ {ref}</span>
                  </span>
                </div>
              )
            })}
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Blue: what the head returns. Red tick: W x. {stock ? `With the stock norm every output is divided by |x| sqrt(8) = ${(XN * Math.sqrt(8)).toFixed(2)}, which the layer cannot undo because |x| changes per token.` : "Without the norm the read is the matmul (up to the constant 1/sqrt(d), which folds into the output projection)."}
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            Measured at 128 x 128 (fp32, 5 random blocks): no-norm relative error 0.9 to 1.2 x 10<sup>-7</sup>, the same as a plain fp32 matmul;
            the stock path is off by 99.7% before rescaling. The backward pass, a transposed copy read with the gradient, came out at 1.2 x 10<sup>-7</sup>.
          </p>
        </div>
      </div>
    </figure>
  )
}
