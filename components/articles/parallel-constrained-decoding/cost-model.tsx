"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { cn } from "@/lib/utils"

// Sequential (autoregressive) vs. parallel (PCD) cost, as a function of field
// count M, average value length L (tokens), and the collision rate — the
// share of fields whose first-token-after-commonprefix ties with another
// candidate and needs the bounded autoregressive fallback (verified: up to
// 4 extra sequential steps per colliding field, engine_mlx.py's
// `for _ in range(4)`). All arithmetic here is +, -, *, / — exact, no
// transcendental functions, so no lib/dmath wrapper is needed.
//
// Constants are anchored to numbers the two repos actually reported, not
// invented: ~8ms/token comes from the RLCD repo's own naive throughput
// (116-131 tok/s across its 4 presets); the ~50ms prefill and ~18ms base
// suffix-eval come from its own worked response-structure example
// (prefill_ms: 52.1, suffix_eval_ms: 18.2). Batched-suffix growth with M and
// per-field JSON overhead are illustrative, not measured.

const MS_PER_TOKEN = 8
const JSON_OVERHEAD_TOKENS = 4 // `"field": ` + `",` per naive-generated value
const PREFILL_MS = 50
const BASE_SUFFIX_MS = 18
const PER_FIELD_SUFFIX_MS = 0.4 // batching isn't free — cost grows a little with M
const COLLISION_STEPS = 4

const ACCENT = "oklch(0.72 0.15 195)"
const MUTED = "oklch(0.62 0.02 260)"

function fmt(n: number) {
  return n.toLocaleString(undefined, { maximumFractionDigits: 0 })
}

export function CostModel() {
  const [fields, setFields] = useState(28)
  const [valueLen, setValueLen] = useState(2)
  const [collisionPct, setCollisionPct] = useState(13)

  const collidingFields = Math.round((collisionPct / 100) * fields)

  const naivePasses = fields * (JSON_OVERHEAD_TOKENS + valueLen)
  const naiveMs = PREFILL_MS + naivePasses * MS_PER_TOKEN

  const pcdCriticalPasses = 2 + collidingFields * COLLISION_STEPS
  const suffixMs = BASE_SUFFIX_MS + fields * PER_FIELD_SUFFIX_MS
  const collisionMs = collidingFields * COLLISION_STEPS * MS_PER_TOKEN
  const pcdMs = PREFILL_MS + suffixMs + collisionMs

  const speedup = naiveMs / Math.max(pcdMs, 1)
  const maxMs = Math.max(naiveMs, pcdMs)

  return (
    <div className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        sequential vs. parallel — forward passes and modeled latency
      </div>
      <div className="p-3 sm:p-4">
        <div className="grid gap-4 sm:grid-cols-2">
          {/* controls */}
          <div className="space-y-3">
            <div>
              <div className="mb-1 flex items-center justify-between font-mono text-[11px] text-muted-foreground">
                <span>fields M</span>
                <span className="tabular-nums text-foreground">{fields}</span>
              </div>
              <Range min={1} max={32} step={1} value={fields} onChange={(e) => setFields(+e.target.value)} className="w-full" aria-label="field count" accent={ACCENT} />
            </div>
            <div>
              <div className="mb-1 flex items-center justify-between font-mono text-[11px] text-muted-foreground">
                <span>avg value length (tokens)</span>
                <span className="tabular-nums text-foreground">{valueLen}</span>
              </div>
              <Range min={1} max={6} step={1} value={valueLen} onChange={(e) => setValueLen(+e.target.value)} className="w-full" aria-label="value length" accent={ACCENT} />
            </div>
            <div>
              <div className="mb-1 flex items-center justify-between font-mono text-[11px] text-muted-foreground">
                <span>collision rate</span>
                <span className="tabular-nums text-foreground">{collisionPct}% ({collidingFields} field{collidingFields === 1 ? "" : "s"})</span>
              </div>
              <Range min={0} max={100} step={1} value={collisionPct} onChange={(e) => setCollisionPct(+e.target.value)} className="w-full" aria-label="collision rate" accent={ACCENT} />
            </div>
            <p className="font-mono text-[10px] leading-4 text-muted-foreground">
              default 28 / 2 / 13% ≈ the repo{"’"}s own 28-field support-triage preset, at
              the collision rate measured across its four shipped presets. Push collision to
              100% and it matches the 255-choice tariff preset — one field, wall-to-wall ties.
            </p>
          </div>

          {/* readouts */}
          <div className="space-y-3">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 font-mono text-[11px]">
                <span className="w-24 shrink-0 text-muted-foreground">autoregressive</span>
                <div className="relative h-4 flex-1 rounded-sm bg-muted/40">
                  <div className="absolute inset-y-0 left-0 rounded-sm" style={{ width: `${(naiveMs / maxMs) * 100}%`, background: MUTED }} />
                </div>
                <span className="w-16 shrink-0 text-right tabular-nums text-muted-foreground">{fmt(naiveMs)} ms</span>
              </div>
              <div className="flex items-center gap-2 font-mono text-[11px]">
                <span className="w-24 shrink-0 text-foreground">parallel (PCD)</span>
                <div className="relative h-4 flex-1 rounded-sm bg-muted/40">
                  <div className="absolute inset-y-0 left-0 rounded-sm" style={{ width: `${(pcdMs / maxMs) * 100}%`, background: ACCENT }} />
                </div>
                <span className="w-16 shrink-0 text-right tabular-nums text-foreground">{fmt(pcdMs)} ms</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 font-mono">
              <div className="rounded-lg border bg-muted/20 px-3 py-2">
                <div className="text-[10px] text-muted-foreground">sequential passes</div>
                <div className="mt-0.5 text-sm tabular-nums">
                  <span className="text-muted-foreground">{fmt(naivePasses)}</span>
                  <span className="px-1 text-muted-foreground">vs</span>
                  <span className={cn(pcdCriticalPasses > 6 ? "text-foreground" : "")} style={{ color: pcdCriticalPasses > 6 ? undefined : ACCENT }}>
                    {fmt(pcdCriticalPasses)}
                  </span>
                </div>
              </div>
              <div className="rounded-lg border bg-muted/20 px-3 py-2">
                <div className="text-[10px] text-muted-foreground">modeled speedup</div>
                <div className="mt-0.5 text-sm tabular-nums text-foreground">{speedup.toFixed(1)}×</div>
              </div>
            </div>

            <p className="text-[11px] leading-5 text-muted-foreground">
              With no collisions, PCD{"’"}s critical path is flat at 2 passes (one prefill,
              one batched suffix) no matter how many fields you add — that{"’"}s the whole
              trick. Every colliding field taxes that flat line with up to {COLLISION_STEPS} more
              sequential steps, which is exactly the autoregressive cost the design exists to
              avoid. Drag collision rate to 100% to see it erode almost all the way back toward
              the autoregressive line.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
