"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { cn } from "@/lib/utils"

// What one stream's recurrent state costs, in bytes held and bytes moved per
// decode step, for two hybrid models, stored four ways. Shapes come from each
// model's config (layers x value heads x 128 x 128). LeapQuant's layout is the
// released code's: an INT8 residual, FP32 smoothing scales per key and value
// channel, four FP16 Compensator Tokens, plus a 16-token BF16 window buffer
// (and, for KDA, an FP16 per-channel gate per buffered token) that an active
// request carries and a cached checkpoint does not. Traffic per step is my
// estimate from that layout: read the checkpoint and the average half-full
// buffer, append one record, and write the checkpoint once every 16 steps.

const MIB = 1024 * 1024
const GIB = 1024 * MIB
const ELEMS_PER_HEAD = 128 * 128

const MODELS = {
  qwen: { label: "Qwen3.8-27B (48 GDN layers x 48 heads)", heads: 48 * 48, kda: false },
  glm: { label: "GLM-5.3-Flash (34 KDA layers x 64 heads)", heads: 34 * 64, kda: true },
} as const
type ModelKey = keyof typeof MODELS

// bytes per head
const CHECKPOINT = 16384 + 256 * 4 + 4 * 256 * 2 // INT8 + Sk/Sv FP32 + 4 x (k~, u~) FP16 = 19,456
const record = (kda: boolean) => 256 * 2 + (kda ? 128 * 2 : 0) // BF16 k and u (+ FP16 gate row for KDA)

function rows(kda: boolean) {
  const rec = record(kda)
  const buffer = 16 * rec
  return [
    { key: "fp32", label: "FP32, every step", held: 4 * ELEMS_PER_HEAD, moved: 8 * ELEMS_PER_HEAD, note: "vLLM default" },
    { key: "bf16", label: "BF16, every step", held: 2 * ELEMS_PER_HEAD, moved: 4 * ELEMS_PER_HEAD, note: "loses accuracy" },
    {
      key: "lq-active",
      label: "LeapQuant, active stream",
      held: CHECKPOINT + buffer,
      moved: CHECKPOINT + 7.5 * rec + rec + CHECKPOINT / 16,
      note: "checkpoint + window buffer",
    },
    { key: "lq-cached", label: "LeapQuant, cached checkpoint", held: CHECKPOINT, moved: 0, note: "prefix cache entry" },
  ]
}

const chip = (on: boolean) =>
  cn(
    "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
    on ? "border-foreground/30 bg-muted/50 text-foreground" : "border-border text-muted-foreground hover:text-foreground",
  )

const fmtMiB = (b: number) => {
  const v = b / MIB
  return Number.isInteger(v) || v >= 100 ? v.toFixed(0) : v.toFixed(2)
}

export function StateBudget() {
  const [model, setModel] = useState<ModelKey>("qwen")
  const [pool, setPool] = useState(11) // half-GiB steps -> 5.5 GiB
  const m = MODELS[model]
  const poolBytes = (pool / 2) * GIB
  const rs = rows(m.kda)
  const maxHeld = rs[0].held * m.heads

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/20 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>one stream&apos;s recurrent state</span>
        <span className="text-muted-foreground/60">held, moved per decode step, and streams per pool</span>
      </div>

      <div className="flex flex-wrap items-center gap-2 px-4 pt-3 font-mono text-[11px] text-muted-foreground">
        {(Object.keys(MODELS) as ModelKey[]).map((k) => (
          <button key={k} type="button" aria-pressed={model === k} onClick={() => setModel(k)} className={chip(model === k)}>
            {MODELS[k].label}
          </button>
        ))}
      </div>
      <label className="flex items-center gap-3 px-4 pt-3 font-mono text-[11px] text-muted-foreground">
        <span className="w-44 shrink-0">pool left for state: {(pool / 2).toFixed(1)} GiB</span>
        <Range min={2} max={48} step={1} value={pool} onChange={(e) => setPool(Number(e.target.value))} aria-label="Memory pool for recurrent state, GiB" className="flex-1" />
      </label>

      <div className="overflow-x-auto px-4 py-3">
        <table className="w-full min-w-[520px] border-collapse font-mono text-[11px]">
          <thead>
            <tr className="text-left text-muted-foreground">
              <th className="py-1 pr-2 font-normal">stored as</th>
              <th className="py-1 pr-2 text-right font-normal">B / value</th>
              <th className="py-1 pr-2 text-right font-normal">MiB held</th>
              <th className="py-1 pr-2 font-normal" aria-hidden="true" />
              <th className="py-1 pr-2 text-right font-normal">MiB moved / step</th>
              <th className="py-1 text-right font-normal">streams</th>
            </tr>
          </thead>
          <tbody>
            {rs.map((r) => {
              const held = r.held * m.heads
              const moved = r.moved * m.heads
              const lq = r.key.startsWith("lq")
              return (
                <tr key={r.key} className="border-t border-border/60">
                  <td className="py-1.5 pr-2">
                    <span className={lq ? "text-foreground" : "text-muted-foreground"}>{r.label}</span>
                    <span className="block text-[9.5px] text-muted-foreground/70">{r.note}</span>
                  </td>
                  <td className="py-1.5 pr-2 text-right tabular-nums">{(r.held / ELEMS_PER_HEAD).toFixed(r.held % ELEMS_PER_HEAD ? 4 : 0)}</td>
                  <td className="py-1.5 pr-2 text-right tabular-nums">{fmtMiB(held)}</td>
                  <td className="w-[22%] py-1.5 pr-2">
                    <div className="h-2 rounded-sm bg-muted/40">
                      <div
                        className={cn("h-2 rounded-sm", lq ? "bg-orange-600/80 dark:bg-orange-400/80" : "bg-muted-foreground/50")}
                        style={{ width: `${((held / maxHeld) * 100).toFixed(1)}%` }}
                      />
                    </div>
                  </td>
                  <td className="py-1.5 pr-2 text-right tabular-nums">{r.moved ? fmtMiB(moved) : "none"}</td>
                  <td className="py-1.5 text-right tabular-nums text-foreground">{Math.floor(poolBytes / held)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
        <p className="mb-0 mt-2 font-mono text-[10px] text-muted-foreground">
          Held: per stream, all linear-attention layers. Moved: my estimate from the code&apos;s layout, not a measurement. The released
          plugin writes the 8-bit checkpoint inside vLLM&apos;s FP32 slot, so today it cuts the bytes moved, not the bytes allocated.
        </p>
      </div>
    </figure>
  )
}
