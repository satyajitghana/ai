"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { cn } from "@/lib/utils"

// Every constant below comes from a file, a run or the model card:
//   - parameter groups: summed from the safetensors header of
//     nvidia/NVIDIA-Nemotron-Labs-Dory1.0-4B-BF16 (measured)
//   - layer layout (8 input / 20 recurrent / 8 output attention+MLP pairs,
//     2 / 5 / 2 of the attention layers full, the rest a 1,024-token window):
//     config.json `layer_types` (measured)
//   - KV bytes per token per attention layer: 2 (K and V) x 4 KV heads x 256
//     dims x 2 bytes = 4,096 (reasoned from config.json)
//   - tok/s and peak RSS: my own CPU run, 2 threads, BF16 (measured)
//   - SWE-bench Verified and output-token factors: model card (reported)
// FLOPs, weight bytes per token, KV size and compute per task are arithmetic
// on those (reasoned).

const IN = 734_224_384
const REC = 1_835_560_960
const OUT = 734_224_384
const HEAD = 335_544_320
const TOTAL = 3_975_229_440
const KV_PER_LAYER_TOKEN = 4096
const WINDOW = 1024

// measured on a shared 4-core cloud VM, CPU only, torch 2.14, int8 weight-only,
// 2 threads: the fastest single-prompt decode rate I saw at each loop count.
// Loops 3 and 4 only ran while the machine was heavily loaded, so they are
// floors, not a scaling curve (see the article's run table).
const MEASURED: Record<number, string> = { 1: "2.70", 2: "1.43", 3: "0.17", 4: "0.10" }

// model card, reported (loops 1, 2 and 4 only)
const SWE: Record<number, number> = { 1: 50.3, 2: 59.5, 4: 61.8 }
const TOKEN_FACTOR: Record<number, { tb: number; gdp: number; swe: number; tau: number }> = {
  1: { tb: 1, gdp: 1, swe: 1, tau: 1 },
  2: { tb: 0.72, gdp: 0.66, swe: 0.79, tau: 0.8 },
  4: { tb: 0.5, gdp: 0.4, swe: 0.74, tau: 0.77 },
}

const CONTEXTS = [
  { label: "4K", n: 4096 },
  { label: "32K", n: 32768 },
  { label: "256K", n: 262144 },
]

const C_IN = "oklch(0.75 0.14 70)"
const C_REC = "oklch(0.66 0.13 245)"
const C_OUT = "oklch(0.64 0.17 20)"
const ACCENT = "oklch(0.68 0.15 245)"

function matmulParams(loops: number) {
  return IN + OUT + HEAD + REC * loops
}

function kvBytes(loops: number, perLoop: boolean, n: number) {
  const copies = perLoop ? loops : 1
  const full = 2 + 2 + 5 * copies
  const swa = 6 + 6 + 15 * copies
  return KV_PER_LAYER_TOKEN * (full * n + swa * Math.min(n, WINDOW))
}

function fmtBytes(b: number) {
  const gib = b / 1073741824
  if (gib >= 1) return `${gib.toFixed(2)} GiB`
  return `${(b / 1048576).toFixed(0)} MiB`
}

export function LoopUnroller() {
  const [loops, setLoops] = useState(2)
  const [perLoop, setPerLoop] = useState(true)
  const [ctx, setCtx] = useState(2)

  const n = CONTEXTS[ctx].n
  const p = matmulParams(loops)
  const gflop = (2 * p) / 1e9
  const p1 = matmulParams(1)
  const ratio = p / p1
  const kv = kvBytes(loops, perLoop, n)
  const kv1 = kvBytes(1, true, n)
  const depth = 16 + 20 * loops
  const tf = TOKEN_FACTOR[loops]

  // unrolled stack: one column per attention+MLP pair
  const cols: { c: string; shared: boolean; k: string }[] = []
  for (let i = 0; i < 8; i++) cols.push({ c: C_IN, shared: false, k: `i${i}` })
  for (let l = 0; l < loops; l++) for (let i = 0; i < 20; i++) cols.push({ c: C_REC, shared: l > 0, k: `r${l}-${i}` })
  for (let i = 0; i < 8; i++) cols.push({ c: C_OUT, shared: false, k: `o${i}` })
  const SW = 640
  const SH = 92
  const pad = 8
  const cw = (SW - 2 * pad) / 96
  const x0 = pad + ((96 - cols.length) * cw) / 2

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">loop unroller · Dory1.0-4B</span>
        <div className="flex flex-wrap gap-1">
          {[true, false].map((v) => (
            <button
              key={String(v)}
              type="button"
              onClick={() => setPerLoop(v)}
              aria-pressed={perLoop === v}
              className={cn(
                "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
                perLoop === v
                  ? "border-foreground/30 bg-muted/50 text-foreground"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {v ? "per_loop KV" : "last_loop KV"}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-4 px-4 py-4">
        <label className="block">
          <span className="flex items-baseline justify-between font-mono text-xs">
            <span>n_recurrent_loops</span>
            <span className="text-base font-semibold" style={{ color: ACCENT }}>
              {loops}
            </span>
          </span>
          <Range
            min={1}
            max={4}
            step={1}
            value={loops}
            accent={ACCENT}
            onChange={(e) => setLoops(Number(e.target.value))}
            aria-label="Number of recurrent loops"
            className="mt-1 w-full"
          />
          <span className="flex justify-between font-mono text-[10px] text-muted-foreground">
            {[1, 2, 3, 4].map((l) => (
              <span key={l}>{l}</span>
            ))}
          </span>
        </label>

        <svg viewBox={`0 0 ${SW} ${SH}`} className="h-auto w-full" role="img" aria-label={`Unrolled stack: ${depth} attention-plus-MLP pairs, ${loops} passes of the shared recurrent block`}>
          {cols.map((col, i) => (
            <rect
              key={col.k}
              x={x0 + i * cw + 0.5}
              y={18}
              width={cw - 1}
              height={40}
              rx={1.5}
              fill={col.c}
              fillOpacity={col.shared ? 0.45 : 0.95}
            />
          ))}
          <text x={x0} y={12} fontSize={10} fill="currentColor" className="font-mono">
            input x8
          </text>
          <text x={x0 + 8 * cw + 2} y={12} fontSize={10} fill="currentColor" className="font-mono">
            recurrent x20, run {loops} {loops === 1 ? "time" : "times"}
          </text>
          <text x={x0 + cols.length * cw} y={12} fontSize={10} fill="currentColor" textAnchor="end" className="font-mono">
            output x8
          </text>
          {Array.from({ length: loops }, (_, l) => (
            <text
              key={l}
              x={x0 + (8 + 20 * l + 10) * cw}
              y={74}
              fontSize={9}
              textAnchor="middle"
              fill="currentColor"
              fillOpacity={0.7}
              className="font-mono"
            >
              {l === 0 ? "pass 1" : `pass ${l + 1} · same weights`}
            </text>
          ))}
          <text x={SW / 2} y={88} fontSize={9} textAnchor="middle" fill="currentColor" fillOpacity={0.55} className="font-mono">
            each column = one attention layer + one MLP layer
          </text>
        </svg>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <Stat k="stored parameters" v={`${(TOTAL / 1e9).toFixed(3)}B (constant)`} tag="measured" />
          <Stat k="effective depth" v={`16 + 20 x ${loops} = ${depth} pairs`} tag="config" />
          <Stat k="matmul FLOPs / token" v={`${gflop.toFixed(2)} GFLOP (${ratio.toFixed(2)}x)`} tag="reasoned" />
          <Stat k="BF16 weight reads / token" v={`${gflop.toFixed(2)} GB`} tag="reasoned" />
          <Stat
            k={`KV cache at ${CONTEXTS[ctx].label}`}
            v={`${fmtBytes(kv)} (${(kv / kv1).toFixed(2)}x)`}
            tag="reasoned"
            hl={!perLoop && loops > 1}
          />
          <Stat k="fastest decode, my CPU run" v={`${MEASURED[loops]} tok/s`} tag="measured" />
        </div>

        <div className="flex flex-wrap items-center gap-1 font-mono text-[10px] text-muted-foreground">
          <span className="mr-1">context</span>
          {CONTEXTS.map((c, i) => (
            <button
              key={c.label}
              type="button"
              onClick={() => setCtx(i)}
              aria-pressed={ctx === i}
              className={cn(
                "cursor-pointer rounded-full border px-2 py-0.5 transition-colors",
                ctx === i ? "border-foreground/30 bg-muted/50 text-foreground" : "border-border hover:text-foreground",
              )}
            >
              {c.label}
            </button>
          ))}
        </div>

        <div className="rounded-lg border px-3 py-2">
          <div className="flex items-center justify-between gap-2 font-mono text-[10px] text-muted-foreground">
            <span>what the card reports at this loop count</span>
            <span className="rounded border px-1 text-[9px] uppercase tracking-wide">reported · reasoned</span>
          </div>
          {tf ? (
            <div className="mt-1 space-y-1 font-mono text-xs">
              <div>SWE-bench Verified: {SWE[loops].toFixed(1)}</div>
              <div>
                output tokens vs 1 loop: Terminal-Bench {tf.tb.toFixed(2)}x · GDPval {tf.gdp.toFixed(2)}x · SWE-bench{" "}
                {tf.swe.toFixed(2)}x · τ³ {tf.tau.toFixed(2)}x
              </div>
              <div style={{ color: ACCENT }}>
                compute per task vs 1 loop: {(ratio * tf.gdp).toFixed(2)}x to {(ratio * tf.tau).toFixed(2)}x
              </div>
            </div>
          ) : (
            <p className="mt-1 text-xs text-muted-foreground">
              The card reports 1, 2 and 4 loops only. Three loops runs (llama.cpp accepts it), but there is no
              published accuracy for it.
            </p>
          )}
        </div>

        <p className="text-[11px] leading-relaxed text-muted-foreground">
          Parameters never move. FLOPs and weight reads grow by 1.84B parameters per extra pass. In per_loop
          mode every pass of the recurrent block keeps its own keys and values, so the cache grows with the
          loop count; last_loop keeps one cache per recurrent attention layer and stays at the 1-loop size.
          The CPU rates come from a contended shared VM; at 3 and 4 loops they are floors, not a curve.
          Compute per task multiplies the per-token cost by the card&apos;s output-token factor, which assumes
          cost is linear in generated tokens and ignores the prompt.
        </p>
      </div>
    </figure>
  )
}

function Stat({ k, v, tag, hl }: { k: string; v: string; tag: string; hl?: boolean }) {
  return (
    <div className={cn("rounded-lg border px-3 py-2", hl ? "border-foreground/40 bg-muted/40" : "")}>
      <div className="flex items-center justify-between gap-2 font-mono text-[10px] text-muted-foreground">
        <span>{k}</span>
        <span className="rounded border px-1 text-[9px] uppercase tracking-wide">{tag}</span>
      </div>
      <div className="mt-0.5 font-mono text-sm">{v}</div>
    </div>
  )
}
