"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { mexp } from "@/lib/dmath"

// The headwise attention gate and the ablation that showed it was load-bearing (#8818).
//
// model.py: gate = 2 * sigmoid(x @ attn_gate), one scalar per head, multiplied into that
// head's output. attn_gate starts at zero, so every gate starts at exactly 1.
// At step 42k the layer-0 gate logits averaged about -6, which puts the gate near 0.005.
// The team then multiplied every gate logit by a scale before the sigmoid, on the step-48000
// checkpoint, and scored dropless macro loss. Those six losses are their measurements;
// the gate value shown is 2 * sigmoid(scale * -6) for that typical layer-0 logit.

const ROWS = [
  { scale: 0.0, loss: 9.3836 },
  { scale: 0.2, loss: 9.8986 },
  { scale: 0.4, loss: 8.4599 },
  { scale: 0.6, loss: 2.7852 },
  { scale: 0.8, loss: 2.0973 },
  { scale: 1.0, loss: 2.0875 },
]

const LOGIT = -6
const gateAt = (s: number) => 2 / (1 + mexp(-s * LOGIT))

export function GateDial() {
  const [k, setK] = useState(5)
  const row = ROWS[k]
  const g = gateAt(row.scale)
  const maxLoss = 10

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5 font-mono text-xs">
        <span className="text-muted-foreground">gate = 2·sigmoid(scale · logit) · step-48000 checkpoint</span>
      </div>

      <div className="grid gap-6 px-4 py-4 sm:grid-cols-2">
        <div className="space-y-3 font-mono text-xs">
          <label className="flex items-center gap-3">
            <span className="text-muted-foreground">logit scale</span>
            <Range min={0} max={5} step={1} value={k} onChange={(e) => setK(Number(e.target.value))} className="flex-1" />
            <span className="w-8 tabular-nums">{row.scale.toFixed(1)}</span>
          </label>

          <div>
            <div className="mb-1 text-muted-foreground">gate on a typical layer-0 token (logit −6)</div>
            <div className="relative h-4 rounded-sm bg-muted">
              <div
                className="absolute inset-y-0 left-0 rounded-sm"
                style={{ width: `${(g / 2) * 100}%`, background: "oklch(0.62 0.17 30)" }}
              />
              <div className="absolute inset-y-[-3px] left-1/2 border-l border-dashed border-foreground/50" />
            </div>
            <div className="mt-1 flex justify-between text-muted-foreground">
              <span>0 (head off)</span>
              <span>1 (untouched)</span>
              <span>2</span>
            </div>
            <div className="mt-2">
              gate = <b className="tabular-nums">{g < 0.01 ? g.toFixed(4) : g.toFixed(3)}</b>
            </div>
          </div>

          <div>
            dropless macro loss = <b className="tabular-nums">{row.loss.toFixed(4)}</b>
            <span className="text-muted-foreground"> (baseline 2.0875)</span>
          </div>
        </div>

        <div className="flex h-40 items-end gap-2" aria-label="Measured loss for each logit scale">
          {ROWS.map((r, i) => (
            <button
              key={r.scale}
              type="button"
              onClick={() => setK(i)}
              aria-label={`scale ${r.scale.toFixed(1)}: loss ${r.loss.toFixed(4)}`}
              className="flex h-full flex-1 flex-col items-center justify-end gap-1 font-mono text-[10px]"
            >
              <span className="tabular-nums text-muted-foreground">{r.loss.toFixed(2)}</span>
              <span
                className="w-full rounded-t-sm transition-colors"
                style={{
                  height: `${(r.loss / maxLoss) * 100}%`,
                  background: i === k ? "oklch(0.6 0.15 250)" : "oklch(0.6 0.03 260 / 0.45)",
                }}
              />
              <span>{r.scale.toFixed(1)}</span>
            </button>
          ))}
        </div>
      </div>

      <figcaption className="border-t px-4 py-2.5 text-xs text-muted-foreground">
        Shrinking every gate logit relaxes the gates toward 1, which is what weight decay on the gate does slowly.
        The bars are the team&apos;s measured dropless macro loss for each scale (#8818); the gate value is computed for a
        layer-0 logit of −6, the mean they reported at step 42k. A 20% cut is nearly free; 40% breaks the model.
      </figcaption>
    </figure>
  )
}
