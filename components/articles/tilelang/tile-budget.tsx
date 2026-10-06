"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { cn } from "@/lib/utils"

// The one piece of arithmetic a tile program does not do for you: deciding
// whether the tile you asked for fits on the chip you are compiling for.
//
// `T.Kernel` + `T.alloc_shared` + `T.Pipelined(num_stages=N)` says "stage N
// copies of an A-tile and a B-tile in shared memory". The compiler will infer
// layouts, bind threads and build the pipeline, but it cannot shrink the tile:
// num_stages multiplies the shared-memory footprint directly, because
// InjectSoftwarePipeline versions each staged buffer (ComputeBufferVersions in
// src/transform/inject_pipeline.cc). So the budget is:
//
//   per stage  = (block_M * block_K + block_K * block_N) * bytes_per_element
//   shared     = per stage * num_stages
//   accumulator= block_M * block_N * 4            (FP32 C_local, per BLOCK)
//
// All of it is integer arithmetic — no Math.exp/pow anywhere, so server and
// client serialize the same strings and nothing hydrates twice.
//
// The limits are the vendors' published per-thread-block maxima, not round
// numbers: H100 227 KB and A100 163 KB (NVIDIA Hopper / Ampere tuning guides,
// which note CUDA reserves 1 KB per block out of 228 / 164 KB per SM), RTX 4090
// 99 KB of 100 KB (Ada tuning guide), MI300X 64 KB of LDS per compute unit
// (AMD CDNA3 ISA guide). Registers: 64K 32-bit registers per SM and 255 per
// thread (CUDA programming guide, compute capability table).

const KB = 1024

type Gpu = { key: string; name: string; smemKb: number; note: string }

const GPUS: Gpu[] = [
  { key: "h100", name: "H100", smemKb: 227, note: "SM90, 228 KB/SM" },
  { key: "a100", name: "A100", smemKb: 163, note: "SM80, 164 KB/SM" },
  { key: "4090", name: "RTX 4090", smemKb: 99, note: "SM89, 100 KB/SM" },
  { key: "mi300x", name: "MI300X", smemKb: 64, note: "CDNA3, 64 KB LDS/CU" },
]

const BLOCKS = [32, 64, 128, 256]
const KS = [16, 32, 64, 128]
const STAGES = [1, 2, 3, 4, 5]
const THREADS = [128, 256]

function kb(bytes: number) {
  // Exact: every value here is a multiple of 1024 for the tile sizes offered.
  const v = bytes / KB
  return Number.isInteger(v) ? String(v) : v.toFixed(1)
}

export function TileBudget() {
  const [mi, setMi] = useState(2) // block_M = 128
  const [ni, setNi] = useState(2) // block_N = 128
  const [ki, setKi] = useState(1) // block_K = 32
  const [si, setSi] = useState(2) // num_stages = 3
  const [ti, setTi] = useState(0) // threads = 128

  const blockM = BLOCKS[mi]
  const blockN = BLOCKS[ni]
  const blockK = KS[ki]
  const stages = STAGES[si]
  const threads = THREADS[ti]

  const perStage = (blockM * blockK + blockK * blockN) * 2 // FP16 inputs
  const shared = perStage * stages
  const accum = blockM * blockN * 4 // FP32 accumulator, block-level
  const regsPerThread = accum / 4 / threads // 32-bit registers per thread
  const regsOk = regsPerThread <= 255

  const widest = GPUS[0].smemKb * KB
  const scale = Math.max(widest, shared)

  return (
    <div className="my-8 rounded-xl border border-border bg-card/40 p-4 sm:p-5">
      <div className="mb-4 text-sm font-medium">
        Shared-memory budget for a TileLang FP16 GEMM tile
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Knob label="block_M" value={blockM} i={mi} n={BLOCKS.length} set={setMi} />
        <Knob label="block_N" value={blockN} i={ni} n={BLOCKS.length} set={setNi} />
        <Knob label="block_K" value={blockK} i={ki} n={KS.length} set={setKi} />
        <Knob label="num_stages" value={stages} i={si} n={STAGES.length} set={setSi} />
        <Knob label="threads" value={threads} i={ti} n={THREADS.length} set={setTi} />
      </div>

      <pre className="mt-4 overflow-x-auto rounded-lg bg-muted/60 p-3 text-[11px] leading-5 sm:text-xs">
        <code>{`A_shared = T.alloc_shared((${blockM}, ${blockK}), T.float16)   # ${kb(blockM * blockK * 2)} KB
B_shared = T.alloc_shared((${blockK}, ${blockN}), T.float16)   # ${kb(blockK * blockN * 2)} KB
C_local  = T.alloc_fragment((${blockM}, ${blockN}), T.float32) # ${kb(accum)} KB of registers
for k in T.Pipelined(T.ceildiv(K, ${blockK}), num_stages=${stages}):  # x ${stages} staged copies`}</code>
      </pre>

      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
        <Stat k="Per stage" v={`${kb(perStage)} KB`} />
        <Stat k={`x ${stages} stages`} v={`${kb(shared)} KB`} hl />
        <Stat k="Accumulator" v={`${kb(accum)} KB`} />
        <Stat
          k="Registers/thread"
          v={`${regsPerThread}`}
          warn={!regsOk}
        />
      </dl>

      <div className="mt-5 space-y-2">
        {GPUS.map((g) => {
          const limit = g.smemKb * KB
          const fits = shared <= limit
          const wShared = `${((shared / scale) * 100).toFixed(2)}%`
          const wLimit = `${((limit / scale) * 100).toFixed(2)}%`
          return (
            <div key={g.key} className="flex items-center gap-3">
              <div className="w-24 shrink-0 text-xs tabular-nums sm:w-28">
                <span className="font-medium">{g.name}</span>
                <span className="block text-[10px] text-muted-foreground">{g.note}</span>
              </div>
              <div className="relative h-5 flex-1 overflow-hidden rounded bg-muted/50">
                <div
                  className="absolute inset-y-0 left-0 border-r border-dashed border-foreground/40"
                  style={{ width: wLimit }}
                />
                <div
                  className={cn(
                    "absolute inset-y-0 left-0 rounded-r",
                    fits ? "bg-emerald-500/50" : "bg-rose-500/50"
                  )}
                  style={{ width: wShared }}
                />
              </div>
              <div
                className={cn(
                  "w-28 shrink-0 text-right text-xs tabular-nums",
                  fits ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
                )}
              >
                {fits ? "fits" : "over"} {g.smemKb} KB
              </div>
            </div>
          )
        })}
      </div>

      <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
        Dashed line: the per-thread-block shared-memory maximum each vendor
        documents. Bar: {kb(perStage)} KB per stage x {stages} stages ={" "}
        {kb(shared)} KB. The accumulator is separate — it lives in registers, and{" "}
        {kb(accum)} KB across {threads} threads is {regsPerThread} 32-bit
        registers per thread of the 255 a CUDA thread may hold.
        {!regsOk ? " Over that limit the compiler has to spill." : ""}
      </p>
    </div>
  )
}

function Knob({
  label,
  value,
  i,
  n,
  set,
}: {
  label: string
  value: number
  i: number
  n: number
  set: (v: number) => void
}) {
  return (
    <label className="flex items-center gap-3 text-xs">
      <span className="w-24 shrink-0 font-mono text-muted-foreground">{label}</span>
      <Range
        min={0}
        max={n - 1}
        step={1}
        value={i}
        onChange={(e) => set(Number(e.currentTarget.value))}
        className="flex-1"
        aria-label={label}
      />
      <span className="w-10 shrink-0 text-right font-mono tabular-nums">{value}</span>
    </label>
  )
}

function Stat({ k, v, hl, warn }: { k: string; v: string; hl?: boolean; warn?: boolean }) {
  return (
    <div>
      <dt className="text-[11px] text-muted-foreground">{k}</dt>
      <dd
        className={cn(
          "font-mono tabular-nums",
          hl && "font-semibold",
          warn && "text-rose-600 dark:text-rose-400"
        )}
      >
        {v}
      </dd>
    </div>
  )
}
