"use client"

import { useMemo, useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { cn } from "@/lib/utils"

import { B, DC, QUANT_BITS, SNAPSHOTS, trainToy, type Snapshot } from "./gram-toy"

// A toy latent bridge trained in the page. Encoder latent x (12 numbers) goes
// through a forward map W to a 10-number code z, then a reverse map V to a
// 12-number "generator latent". Both maps are trained by gradient descent on
// latent MSE alone, or on latent MSE plus the Gram term written exactly as
// Squeeze3D's squeeze3d/launch_training.py:81-100 computes it (rows of z
// normalised, G = Zn Zn^T over the batch, mean((G - I)^2), weighted). See
// ./gram-toy.ts for the training loop. The numbers are the toy's, not the
// paper's: what carries over is the shape of the effect and the identity
// between the sample Gram and the dimension Gram.

const LAMBDA = 5

function cellColor(v: number) {
  // -1 .. 1 diverging: blue for negative, orange for positive, paper for 0.
  const a = Math.min(1, Math.abs(v))
  if (v >= 0) return `oklch(${(0.97 - 0.32 * a).toFixed(3)} ${(0.16 * a).toFixed(3)} 50)`
  return `oklch(${(0.97 - 0.32 * a).toFixed(3)} ${(0.14 * a).toFixed(3)} 250)`
}

function Heatmap({ m, label, sub }: { m: number[][]; label: string; sub: string }) {
  const n = m.length
  const s = 100 / n
  return (
    <div className="min-w-0">
      <div className="mb-1 font-mono text-[11px] text-foreground">{label}</div>
      <svg viewBox="0 0 100 100" className="block aspect-square w-full rounded border" role="img" aria-label={label}>
        {m.map((row, i) =>
          row.map((v, j) => (
            <rect
              key={`${i}-${j}`}
              x={(j * s).toFixed(3)}
              y={(i * s).toFixed(3)}
              width={s.toFixed(3)}
              height={s.toFixed(3)}
              fill={cellColor(v)}
            />
          ))
        )}
      </svg>
      <div className="mt-1 text-[11px] leading-4 text-muted-foreground">{sub}</div>
    </div>
  )
}

function Eigen({ eig }: { eig: number[] }) {
  const max = 4.5
  return (
    <div>
      <div className="mb-1 font-mono text-[11px] text-foreground">eigenvalues of Zn&#7488;Zn</div>
      <div className="flex h-24 items-end gap-1 rounded border px-1.5 pb-1">
        {eig.map((l, i) => (
          <div key={i} className="flex flex-1 flex-col items-center justify-end">
            <div
              className="w-full rounded-t bg-[oklch(0.62_0.15_50)]"
              style={{ height: `${Math.max(1, Math.min(100, (l / max) * 100)).toFixed(1)}%` }}
            />
          </div>
        ))}
      </div>
      <div className="mt-1 text-[11px] leading-4 text-muted-foreground">
        all {DC} directions of the code; they always sum to {B}
      </div>
    </div>
  )
}

export function GramBridge() {
  const runs = useMemo(() => ({ mse: trainToy(0), gram: trainToy(LAMBDA) }), [])
  const [mode, setMode] = useState<"mse" | "gram">("mse")
  const [idx, setIdx] = useState(SNAPSHOTS.length - 1)
  const snap: Snapshot = runs[mode][idx]
  const other: Snapshot = runs[mode === "mse" ? "gram" : "mse"][idx]

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          toy bridge: 12 &rarr; 10-number code &rarr; 12, batch of {B}, trained in your browser
        </span>
        <div className="flex gap-1 font-mono text-[11px]">
          {(["mse", "gram"] as const).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setMode(k)}
              aria-pressed={mode === k}
              className={cn(
                "rounded border px-2 py-1 transition-colors",
                mode === k ? "border-foreground bg-foreground text-background" : "hover:bg-muted/40"
              )}
            >
              {k === "mse" ? "latent MSE only" : `MSE + Gram (weight ${LAMBDA})`}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-4 p-3 sm:p-4">
        <label className="block">
          <span className="font-mono text-[11px] text-muted-foreground">
            training step: <span className="tabular-nums text-foreground">{snap.step}</span>
          </span>
          <Range
            min={0}
            max={SNAPSHOTS.length - 1}
            step={1}
            value={idx}
            onChange={(e) => setIdx(Number(e.target.value))}
            className="mt-1 w-full"
            aria-label="training step"
          />
        </label>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Heatmap
            m={snap.gram}
            label={`sample Gram ZnZnᵀ (${B}×${B})`}
            sub="what the code penalises: every pair of objects in the batch"
          />
          <Heatmap
            m={snap.dimCorr}
            label={`dimension Gram ZnᵀZn (${DC}×${DC})`}
            sub="what the paper's motivation talks about: every pair of code dimensions"
          />
          <Eigen eig={snap.eig} />
        </div>

        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border bg-border font-mono text-[11px] sm:grid-cols-3">
          {[
            ["effective dims", snap.deff.toFixed(2), `of ${B} possible`],
            ["sample loss", snap.sampleLoss.toFixed(3), "‖ZnZnᵀ − I‖²"],
            ["dimension loss", snap.dimLoss.toFixed(3), "‖ZnᵀZn − I‖²"],
            ["difference", (snap.dimLoss - snap.sampleLoss).toFixed(3), `always ${DC} − ${B}`],
            ["latent MSE", snap.mse.toExponential(2), `other run: ${other.mse.toExponential(2)}`],
            [
              `MSE, code at ${QUANT_BITS[2]} bits`,
              snap.quantMse[2].toExponential(2),
              `other run: ${other.quantMse[2].toExponential(2)}`,
            ],
          ].map(([k, v, s]) => (
            <div key={k} className="bg-background px-2.5 py-2">
              <div className="text-muted-foreground">{k}</div>
              <div className="tabular-nums text-foreground">{v}</div>
              <div className="text-[10px] text-muted-foreground">{s}</div>
            </div>
          ))}
        </div>

        <p className="text-sm leading-6 text-muted-foreground">
          Orange is a positive cosine, blue a negative one. With latent MSE alone the code drifts into two
          or three strong directions and the off-diagonal of both matrices fills in. Add the Gram term and
          the batch&rsquo;s codes turn mutually orthogonal, the eigenvalues flatten toward 1, and the
          effective dimension climbs to the batch size. The two losses always differ by exactly the same
          constant, so penalising the {B}&times;{B} matrix is penalising the {DC}&times;{DC} one.
        </p>
      </div>
    </figure>
  )
}
