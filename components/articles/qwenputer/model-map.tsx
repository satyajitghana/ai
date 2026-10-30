"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// The Qwenputer checkpoint as a stack of layers. Every shape and count is read from the safetensors headers of
// divagr1925/Qwen3.5-4B-Qwenputer and Qwen/Qwen3.5-4B (range requests, nothing downloaded in full). The density
// figures come from sampling rows of the real tensors (48 rows per tensor for the layers, 64 rows per region for
// the embedding table), so they are estimates. Layers 0-10 are the compiled CPU, layers 11-42 are Qwen's 32.

const CHIP = 11
const TOTAL = 43
const LIN = 175_013_824
const FULL = 166_600_960
const EMBED = 1_899_307_008
const CHIP_PARAMS = 1_925_152_064
const QWEN_PARAMS = 5_533_139_456

type Kind = "chip" | "gdn" | "full"
function kindOf(i: number): Kind {
  if (i < CHIP) return "chip"
  return (i - CHIP) % 4 === 3 ? "full" : "gdn"
}

const COLOR: Record<Kind, string> = {
  chip: "oklch(0.62 0.16 300)",
  gdn: "oklch(0.64 0.12 190)",
  full: "oklch(0.72 0.14 75)",
}

const X0 = 24
const W = 190
const DX = 40
const DY = 20
const STEP = 9
const Y0 = 420

function fmt(n: number) {
  return n.toLocaleString("en-US")
}
const pct = (a: number, b: number) => ((a / b) * 100).toFixed(1)

export function ModelMap() {
  const [sel, setSel] = useState(14)
  const k = kindOf(sel)
  const params = k === "full" ? FULL : LIN
  const qwenIdx = sel - CHIP

  return (
    <figure className="my-8 overflow-hidden rounded-md border">
      <div className="border-b px-3 py-2 font-mono text-xs text-muted-foreground">
        the Qwenputer checkpoint, layer by layer · shapes from the safetensors headers · density from sampled rows
      </div>
      <div className="grid gap-4 p-4 md:grid-cols-[minmax(0,260px)_1fr]">
        <svg viewBox="0 0 280 450" className="mx-auto w-full max-w-[280px]" role="group" aria-label="43 layers, 11 compiled CPU layers below 32 Qwen layers">
          {Array.from({ length: TOTAL }, (_, i) => {
            const y = Y0 - i * STEP
            const kk = kindOf(i)
            const on = i === sel
            return (
              <g
                key={i}
                role="button"
                tabIndex={0}
                aria-label={`layer ${i}, ${kk === "chip" ? "compiled CPU" : kk === "full" ? "Qwen full attention" : "Qwen Gated DeltaNet"}`}
                aria-pressed={on}
                onClick={() => setSel(i)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault()
                    setSel(i)
                  }
                }}
                style={{ cursor: "pointer", outline: "none" }}
              >
                <polygon
                  points={`${X0},${y} ${X0 + W},${y} ${X0 + W + DX},${y - DY} ${X0 + DX},${y - DY}`}
                  fill={COLOR[kk]}
                  fillOpacity={on ? 0.95 : 0.55}
                  stroke={on ? "currentColor" : "oklch(0.3 0 0 / 0.35)"}
                  strokeWidth={on ? 1.6 : 0.6}
                />
                <rect x={X0} y={y} width={W} height={STEP - 2} fill={COLOR[kk]} fillOpacity={on ? 0.85 : 0.4} stroke="oklch(0.3 0 0 / 0.3)" strokeWidth={0.4} />
              </g>
            )
          })}
          <text x={X0 + W + DX + 6} y={Y0 - (CHIP / 2) * STEP} fontSize="9" fill="currentColor" className="font-mono">
            11 chip
          </text>
          <text x={X0 + W + DX + 6} y={Y0 - (CHIP + 16) * STEP} fontSize="9" fill="currentColor" className="font-mono">
            32 Qwen
          </text>
        </svg>

        <div className="space-y-4 text-xs">
          <div className="rounded border p-3">
            <div className="mb-1 font-mono text-[11px] text-muted-foreground">layer {sel}</div>
            {k === "chip" ? (
              <p>
                A <b>compiled CPU layer</b>. It has the shape of a Qwen3.5 Gated DeltaNet layer ({fmt(LIN)} weights, hidden width 3,968) and
                almost none of it is used: in the rows I sampled from layers 0, 5 and 10, at most 0.09% of the entries were nonzero (one tensor had
                none in the sampled rows), with constants up to 2<sup>47</sup>. The compiler sets every weight directly; nothing here was trained.
              </p>
            ) : (
              <p>
                {k === "full" ? (
                  <>
                    Qwen layer {qwenIdx} ({fmt(FULL)} weights): <b>full attention</b>, one in every four. It keeps a KV cache that grows with the chat.
                  </>
                ) : (
                  <>
                    Qwen layer {qwenIdx} ({fmt(LIN)} weights): <b>Gated DeltaNet</b>, three in every four. Its state is a fixed-size matrix per head.
                  </>
                )}{" "}
                The original weights sit in the first 2,560 input and output dimensions, bit-identical to base Qwen3.5-4B in every row I compared;
                the other 1,408 columns are zero ({pct(2560, 3968)}% of each matrix is nonzero).
              </p>
            )}
            <div className="mt-2 font-mono text-[11px] text-muted-foreground">
              {fmt(params)} parameters · {pct(params, EMBED + CHIP_PARAMS + QWEN_PARAMS)}% of the checkpoint
            </div>
          </div>

          <div>
            <div className="mb-1 font-mono text-[11px] text-muted-foreground">where the 9,357,602,496 parameters are</div>
            <div className="flex h-4 overflow-hidden rounded" role="img" aria-label="embedding table 20.3 percent, chip layers 20.6 percent, Qwen layers 59.1 percent">
              <div style={{ width: `${pct(EMBED, EMBED + CHIP_PARAMS + QWEN_PARAMS)}%`, background: "oklch(0.70 0.04 250)" }} />
              <div style={{ width: `${pct(CHIP_PARAMS, EMBED + CHIP_PARAMS + QWEN_PARAMS)}%`, background: COLOR.chip }} />
              <div style={{ width: `${pct(QWEN_PARAMS, EMBED + CHIP_PARAMS + QWEN_PARAMS)}%`, background: COLOR.gdn }} />
            </div>
            <ul className="mt-2 space-y-0.5 font-mono text-[11px] text-muted-foreground">
              <li>
                embedding table {pct(EMBED, EMBED + CHIP_PARAMS + QWEN_PARAMS)}% · 478,656 rows, 230,336 more than Qwen&apos;s 248,320 · sampled nonzero: Qwen rows 67%, added rows 2.4%
              </li>
              <li>chip layers {pct(CHIP_PARAMS, EMBED + CHIP_PARAMS + QWEN_PARAMS)}% · the author reports 1,040,595 nonzero weights, about 0.054%</li>
              <li>Qwen layers {pct(QWEN_PARAMS, EMBED + CHIP_PARAMS + QWEN_PARAMS)}% · 64.5% nonzero, the original weights plus zero padding</li>
            </ul>
          </div>
          <div className="flex flex-wrap gap-3 font-mono text-[11px]">
            {(
              [
                ["chip", "compiled CPU"],
                ["gdn", "Qwen Gated DeltaNet (24)"],
                ["full", "Qwen full attention (8)"],
              ] as [Kind, string][]
            ).map(([kk, t]) => (
              <span key={kk} className={cn("inline-flex items-center gap-1.5 text-muted-foreground")}>
                <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: COLOR[kk] }} />
                {t}
              </span>
            ))}
          </div>
        </div>
      </div>
    </figure>
  )
}
