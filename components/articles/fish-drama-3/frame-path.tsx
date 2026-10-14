"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"

// One audio frame, layer pass by layer pass, for S2 and Drama 3 at batch size 1.
// Each bar is one layer pass in sequence; its height is the weight bytes that
// pass reads. Drama 3 sizes are from the fishaudio/drama-3 safetensors headers
// (range requests, Hub commit e0a9218): a Gated DeltaNet layer reads 74.79 MB
// of BF16 plus 8 routed FP8 experts (25.17 MB), a full-attention layer 61.88 MB
// plus the same experts; a shared decoder layer 146.82 MB and a per-codebook
// layer 163.60 MB (its code-embedding row lookups excluded, its head included).
// The semantic slice of the LM head (4,096 x 2,048 BF16, 16.78 MB) closes the
// backbone. S2 sizes are this site's earlier header count of fishaudio/s2-pro:
// 36 slow layers of 100,930,816 parameters, then ten passes of the four fast
// layers (100,930,560 each), a 4,096 x 2,560 head after the backbone and after
// every pass that emits a code. Totals: 15.55 GB and 5.95 GB; the report's
// Table 1 rounds them to 15.6 and 6.0.

type Pass = { mb: number; part: "backbone" | "decoder"; emits?: number }

const DELTA = 74.789248 + 25.165824
const FULL = 61.879296 + 25.165824
const D3_HEAD = 16.777216
const S2_SLOW = 201.861632
const S2_FAST = 201.86112
const S2_HEAD = 20.97152

function drama3(): Pass[] {
  const p: Pass[] = []
  for (let i = 0; i < 40; i++) p.push({ mb: i % 4 === 3 ? FULL : DELTA, part: "backbone" })
  p[39] = { mb: p[39].mb + D3_HEAD, part: "backbone", emits: 0 }
  for (let i = 0; i < 4; i++) p.push({ mb: 146.822144, part: "decoder" })
  for (let k = 1; k <= 9; k++) p.push({ mb: 163.59936, part: "decoder", emits: k })
  return p
}

function s2(): Pass[] {
  const p: Pass[] = []
  for (let i = 0; i < 36; i++) p.push({ mb: S2_SLOW, part: "backbone" })
  p[35] = { mb: S2_SLOW + S2_HEAD, part: "backbone", emits: 0 }
  for (let pass = 0; pass < 10; pass++) {
    for (let l = 0; l < 4; l++) {
      const last = l === 3 && pass > 0
      p.push({ mb: S2_FAST + (last ? S2_HEAD : 0), part: "decoder", emits: last ? pass : undefined })
    }
  }
  return p
}

const ROWS = [
  { name: "Fish Audio S2", sub: "dense 36-layer backbone, Fast AR looped 10 times", passes: s2() },
  { name: "Drama 3", sub: "40-layer MoE backbone, 13 decoder layers once", passes: drama3() },
]

const MAX_PASSES = 76
const BAR = 9
const GAP = 1
const LEFT = 8
const ROW_H = 96
const PEAK = 64
const MAX_MB = S2_SLOW + S2_HEAD

const BACK = "oklch(0.60 0.12 280)"
const DEC = "oklch(0.70 0.13 60)"

export function FramePath() {
  const [step, setStep] = useState(MAX_PASSES)
  const W = LEFT + MAX_PASSES * (BAR + GAP) + 8
  const H = ROWS.length * ROW_H + 10

  const stats = ROWS.map((r) => {
    const done = r.passes.slice(0, step)
    const gb = done.reduce((a, p) => a + p.mb, 0) / 1000
    const codes = done.filter((p) => p.emits !== undefined).length
    return { gb, codes, finished: step >= r.passes.length }
  })

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          one frame at batch size 1: layer passes in sequence, bar height = weights read
        </span>
      </div>
      <div className="space-y-3 p-3 sm:p-4">
        <div className="overflow-x-auto">
          <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" className="min-w-[640px] max-w-full">
            <title>
              S2 runs 76 layer passes per frame and reads 15.55 GB of weights; Drama 3 runs 53 and reads 5.95 GB.
            </title>
            {ROWS.map((r, ri) => {
              const y0 = ri * ROW_H + 10
              const base = y0 + PEAK + 14
              return (
                <g key={r.name}>
                  <text x={LEFT} y={y0 + 2} fontSize={11} fill="currentColor" fontFamily="ui-monospace, monospace">
                    {r.name}
                  </text>
                  <text x={LEFT + 110} y={y0 + 2} fontSize={9} fill="currentColor" fillOpacity={0.5} fontFamily="ui-monospace, monospace">
                    {r.sub}
                  </text>
                  {r.passes.map((p, i) => {
                    const h = Math.max(1.5, (PEAK * p.mb) / MAX_MB)
                    const x = LEFT + i * (BAR + GAP)
                    const on = i < step
                    return (
                      <g key={i}>
                        <rect
                          x={x}
                          y={base - h}
                          width={BAR}
                          height={h}
                          rx={1.5}
                          fill={p.part === "backbone" ? BACK : DEC}
                          fillOpacity={on ? 0.75 : 0.15}
                        />
                        {p.emits !== undefined && (
                          <text
                            x={x + BAR / 2}
                            y={base + 11}
                            fontSize={8}
                            textAnchor="middle"
                            fill="currentColor"
                            fillOpacity={on ? 0.9 : 0.25}
                            fontFamily="ui-monospace, monospace"
                          >
                            {p.emits}
                          </text>
                        )}
                      </g>
                    )
                  })}
                  <line x1={LEFT} x2={W - 8} y1={base} y2={base} stroke="currentColor" strokeOpacity={0.15} />
                </g>
              )
            })}
          </svg>
        </div>

        <label className="block">
          <span className="mb-1 block font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
            layer passes completed: {step}
          </span>
          <Range min={0} max={MAX_PASSES} step={1} value={step} onChange={(e) => setStep(Number(e.target.value))} aria-label="Layer passes completed" />
        </label>

        <div className="grid gap-2 sm:grid-cols-2">
          {ROWS.map((r, i) => (
            <div key={r.name} className="rounded-lg border bg-background/40 px-3 py-2 font-mono text-[11px] leading-5">
              <div className="text-muted-foreground">{r.name}</div>
              <div>
                weights read: <span className="text-foreground">{stats[i].gb.toFixed(2)} GB</span>
              </div>
              <div>
                codes emitted: {stats[i].codes} of 10{stats[i].finished ? ", frame done" : ""}
              </div>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap gap-x-4 gap-y-1 font-mono text-[10px] text-muted-foreground">
          <span>
            <span className="mr-1 inline-block h-2 w-2 rounded-sm" style={{ background: BACK }} />
            backbone layer
          </span>
          <span>
            <span className="mr-1 inline-block h-2 w-2 rounded-sm" style={{ background: DEC }} />
            Fast AR / codebook-MTP layer
          </span>
          <span>digits: the code a pass emits (0 is semantic)</span>
        </div>
      </div>
    </figure>
  )
}
