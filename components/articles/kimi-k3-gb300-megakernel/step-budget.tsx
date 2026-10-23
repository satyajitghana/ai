"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { mpow } from "@/lib/dmath"
import { cn } from "@/lib/utils"

// Where a Kimi K3 decode step's time goes on GB300, stock vLLM against the
// specialized CuTe DSL decode, split into the part HBM bandwidth forces and
// everything else.
//
// REPORTED (vLLM blog, 16 Oct 2026, "Decode performance without speculation"):
// aggregate decode tok/s and speedup over stock per batch, TP8 and TP16, ISL 1,
// no speculation. Step time = batch / tok/s; stock step = that x speedup.
// REPORTED (same post, DSpark figure): TP16, batch 1, DSpark with 7 draft
// tokens and a synthetic acceptance length of 6: 842 tok/s specialized, 488
// stock. Step = 6 / tok/s. Away from 6 the step is held constant, which is an
// assumption: a forced acceptance length changes how many tokens a step
// emits, not what it reads.
//
// REASONED floor: bytes the step must read / aggregate HBM bandwidth.
//   bytes = 108.81 GB bf16 trunk (read once a step)
//         + 92 MoE layers x E[distinct experts] x 17,547,264 B (MXFP4 expert)
//   E[distinct experts] for r independently routed rows = 896 (1 - (880/896)^r)
//   bandwidth = 8,000 GB/s per GB300 x TP. A DSpark verify step is r = 8 rows.
// It ignores KV-cache reads (ISL 1 keeps them tiny), the embedding gather and
// the drafter's own weights, and assumes perfect sharding; the experts are
// tensor-parallel, so every rank reads an equal slice of each one.

const TRUNK = 108.81e9
const EXPERT = 17_547_264
const MOE_LAYERS = 92
const HBM = 8000e9

type Row = { b: number; tps: number; x: number }
const TABLE: Record<8 | 16, Row[]> = {
  8: [
    { b: 1, tps: 193.3, x: 1.58 },
    { b: 2, tps: 317.8, x: 1.5 },
    { b: 4, tps: 540.6, x: 1.55 },
    { b: 8, tps: 820.1, x: 1.45 },
    { b: 16, tps: 1274.8, x: 1.43 },
    { b: 32, tps: 1702.6, x: 1.33 },
    { b: 64, tps: 2375.9, x: 1.31 },
  ],
  16: [
    { b: 1, tps: 256.4, x: 1.88 },
    { b: 2, tps: 436.7, x: 1.92 },
    { b: 4, tps: 702.5, x: 1.81 },
    { b: 8, tps: 1157.9, x: 1.79 },
    { b: 16, tps: 1758.3, x: 1.71 },
    { b: 32, tps: 2550.9, x: 1.64 },
    { b: 64, tps: 3606.1, x: 1.62 },
  ],
}

const distinct = (rows: number) => 896 * (1 - mpow(880 / 896, rows))
const floorMs = (rows: number, tp: number) =>
  ((TRUNK + MOE_LAYERS * distinct(rows) * EXPERT) / (HBM * tp)) * 1000

type Mode = "plain" | "dspark"

export function StepBudget() {
  const [mode, setMode] = useState<Mode>("plain")
  const [tp, setTp] = useState<8 | 16>(16)
  const [bi, setBi] = useState(0)
  const [al, setAl] = useState(6)

  const spec = mode === "dspark"
  const tpUsed: 8 | 16 = spec ? 16 : tp
  const row = TABLE[tpUsed][spec ? 0 : bi]
  const rows = spec ? 8 : row.b
  const floor = floorMs(rows, tpUsed)

  const fused = spec ? 6000 / 842 : (row.b / row.tps) * 1000
  const stock = spec ? 6000 / 488 : fused * row.x
  const perStep = spec ? al : row.b
  const scale = 36

  const lines = [
    { key: "stock", label: "stock vLLM", step: stock, bar: "bg-zinc-400/90 dark:bg-zinc-500/90" },
    { key: "fused", label: "specialized CuTe DSL", step: fused, bar: "bg-blue-500/85 dark:bg-blue-400/80" },
  ]

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">one decode step = bandwidth floor + everything else</span>
        <div className="flex gap-1.5">
          {(
            [
              ["plain", "no speculation"],
              ["dspark", "DSpark"],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              type="button"
              onClick={() => setMode(k)}
              aria-pressed={mode === k}
              className={cn(
                "rounded-sm border px-2 py-0.5 font-mono text-[10px]",
                mode === k ? "bg-foreground/[0.08]" : "hover:bg-foreground/[0.04]"
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="p-3 sm:p-4">
        {spec ? (
          <label className="block">
            <span className="mb-1 block font-mono text-[11px] text-muted-foreground">
              TP16, batch 1, 7 draft tokens · acceptance length (tokens emitted per step): {al.toFixed(1)}
              {al === 6 ? " · the published point" : " · step held at the published value"}
            </span>
            <Range
              min={1}
              max={8}
              step={0.1}
              value={al}
              onChange={(e) => setAl(Number(e.target.value))}
              aria-label="DSpark acceptance length"
            />
          </label>
        ) : (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <div className="flex items-center gap-1.5">
              <span className="font-mono text-[11px] text-muted-foreground">GPUs</span>
              {([8, 16] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTp(t)}
                  aria-pressed={tp === t}
                  className={cn(
                    "rounded-sm border px-2 py-0.5 font-mono text-[10px]",
                    tp === t ? "bg-foreground/[0.08]" : "hover:bg-foreground/[0.04]"
                  )}
                >
                  TP{t}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="font-mono text-[11px] text-muted-foreground">batch</span>
              {TABLE[16].map((r, i) => (
                <button
                  key={r.b}
                  type="button"
                  onClick={() => setBi(i)}
                  aria-pressed={bi === i}
                  className={cn(
                    "rounded-sm border px-2 py-0.5 font-mono text-[10px] tabular-nums",
                    bi === i ? "bg-foreground/[0.08]" : "hover:bg-foreground/[0.04]"
                  )}
                >
                  {r.b}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="mt-4 space-y-4">
          {lines.map((l) => {
            const rest = l.step - floor
            const rate = (perStep / l.step) * 1000
            return (
              <div key={l.key}>
                <div className="mb-1 flex flex-wrap items-baseline justify-between gap-x-3 font-mono text-[11px]">
                  <span>{l.label}</span>
                  <span className="tabular-nums">
                    {l.step.toFixed(2)} ms a step ·{" "}
                    <span className="text-muted-foreground">
                      {rate.toFixed(0)} tok/s{spec || row.b === 1 ? "" : ` · ${(rate / row.b).toFixed(0)} per user`}
                    </span>
                  </span>
                </div>
                <div className="relative flex h-7 overflow-hidden rounded-sm bg-foreground/[0.04]">
                  <div
                    className="h-7 bg-emerald-600/85 dark:bg-emerald-500/80"
                    style={{ width: `${((floor / scale) * 100).toFixed(2)}%` }}
                    title="HBM bandwidth floor (reasoned)"
                  />
                  <div
                    className={cn("h-7", l.bar)}
                    style={{ width: `${((rest / scale) * 100).toFixed(2)}%` }}
                    title="everything else"
                  />
                </div>
                <div className="mt-1 flex flex-wrap justify-between gap-x-3 font-mono text-[10px] text-muted-foreground tabular-nums">
                  <span>floor {floor.toFixed(2)} ms · everything else {rest.toFixed(2)} ms</span>
                  <span>{((floor / l.step) * 100).toFixed(0)}% of the step is the floor</span>
                </div>
              </div>
            )
          })}
        </div>

        <div className="mt-4 grid gap-x-6 gap-y-1 rounded-md border bg-background/60 p-3 font-mono text-[11px] tabular-nums sm:grid-cols-2">
          <div className="flex justify-between gap-2">
            <span className="text-muted-foreground">rows read per step</span>
            <span>{rows}</span>
          </div>
          <div className="flex justify-between gap-2">
            <span className="text-muted-foreground">distinct experts per layer, expected</span>
            <span>{distinct(rows).toFixed(1)}</span>
          </div>
          <div className="flex justify-between gap-2">
            <span className="text-muted-foreground">bytes read per step</span>
            <span>{((TRUNK + MOE_LAYERS * distinct(rows) * EXPERT) / 1e9).toFixed(1)} GB</span>
          </div>
          <div className="flex justify-between gap-2">
            <span className="text-muted-foreground">time removed by the fused path</span>
            <span>{(stock - fused).toFixed(2)} ms</span>
          </div>
        </div>

        <p className="mt-3 text-xs leading-5 text-muted-foreground">
          Bars run 0 to {scale} ms. Step times are reported: the post&rsquo;s no-speculation table (batch ÷ tok/s,
          times the speedup for stock) and its DSpark chart (6 ÷ 842 and 6 ÷ 488). The green floor is reasoned:
          108.81 GB of bf16 trunk plus the expected distinct MXFP4 experts, over 8,000 GB/s per GPU. Away from an
          acceptance length of 6 the step is held at its published value; only 6 is a measurement, and it was
          forced by a synthetic acceptance setting.
        </p>
      </div>
    </figure>
  )
}
