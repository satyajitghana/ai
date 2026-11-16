"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { mpow } from "@/lib/dmath"
import { cn } from "@/lib/utils"

// One deepseek-ultrafast decode step as bytes over bandwidth plus a fixed cost.
//
// MEASURED (site article deepseek-v4-1-flash-1017, safetensors headers):
//   attention + shared experts + routers + mHC + norms, all 40 layers: 7.20 GB
//   routed experts: 6 of 384 a layer, 4.51 GB for 240 of them -> 18.79 MB each
//   LM head, BF16: 1.32 GB (0.66 GB as the engine's FP8 copy)
//   DSpark draft layers: 7.93 GB, 3 x 128 experts the same size as the main ones
//   -> 0.71 GB of the drafter is not experts
// READ FROM THE CODE (basetenlabs/deepseek-ultrafast @ 76766a9):
//   block 6 drafts on GB300/B300 (profile.rs), verify 2-7 rows, draft head is
//   an FP8 copy of the LM head, verify head FP8 on TP4, Markov head 256 x vocab
//   BF16 (66 MB), experts tensor-parallel so each GPU reads 1/N of each one.
// REPORTED (README): TP4 GB300 3.30 ms, TP8 B300 2.71 ms, 5.6 tokens a step.
// REASONED: distinct experts for r independently routed rows
//   = 384 (1 - (378/384)^r); the drafter's 3 of 128 the same way.
//   Fixed cost default 2.12 ms is the two-point fit t = a + b/N to the README.
// Ignores KV-cache reads (the Tetris context is a few thousand tokens), Engram
// rows (about 12.7 KB a token) and the small projections every GPU replicates.

const DENSE = 7.2
const EXPERT = 4.51 / 240
const HEAD_BF16 = 1.32
const HEAD_FP8 = 0.66
const DRAFT_DENSE = 7.93 - 3 * 128 * EXPERT
const MARKOV = 0.066
const HBM = 8 // TB/s per GPU

type Preset = { key: string; label: string; gpus: 4 | 8; rows: number; accept: number; fixed: number; overlap: number }

const PRESETS: Preset[] = [
  { key: "tp4", label: "README, 4 x GB300", gpus: 4, rows: 7, accept: 5.6, fixed: 2.12, overlap: 0 },
  { key: "tp8", label: "README, 8 x B300", gpus: 8, rows: 7, accept: 5.6, fixed: 2.12, overlap: 0 },
  { key: "nospec", label: "no speculation", gpus: 4, rows: 1, accept: 1, fixed: 2.12, overlap: 0 },
]

const REPORTED: Record<4 | 8, { tps: number; step: number }> = {
  4: { tps: 1740, step: 3.3 },
  8: { tps: 2060, step: 2.71 },
}

const distinct = (n: number, k: number, r: number) => n * (1 - mpow((n - k) / n, r))

export function DecodeRoofline() {
  const [gpus, setGpus] = useState<4 | 8>(4)
  const [rows, setRows] = useState(7)
  const [accept, setAccept] = useState(5.6)
  const [fixed, setFixed] = useState(2.12)
  const [overlap, setOverlap] = useState(0)
  const [preset, setPreset] = useState("tp4")

  const spec = rows > 1
  const acc = Math.min(accept, rows)
  const indep = distinct(384, 6, rows)
  const eMain = indep + (6 - indep) * overlap
  const dIndep = spec ? distinct(128, 3, rows - 1) : 0
  const eDraft = spec ? dIndep + (3 - dIndep) * overlap : 0

  const parts = [
    { key: "dense", label: "attention, shared experts, mHC", gb: DENSE, cls: "bg-sky-500/80 dark:bg-sky-400/75" },
    { key: "experts", label: `routed experts, ${eMain.toFixed(1)} a layer x 40`, gb: 40 * eMain * EXPERT, cls: "bg-amber-500/85 dark:bg-amber-400/80" },
    {
      key: "heads",
      label: spec ? "verify head + draft head (FP8) + Markov head" : "LM head (BF16)",
      gb: spec ? HEAD_FP8 * 2 + MARKOV : HEAD_BF16,
      cls: "bg-violet-500/80 dark:bg-violet-400/75",
    },
    {
      key: "draft",
      label: spec ? `drafter, ${eDraft.toFixed(1)} experts a layer x 3` : "drafter (off)",
      gb: spec ? DRAFT_DENSE + 3 * eDraft * EXPERT : 0,
      cls: "bg-emerald-600/80 dark:bg-emerald-500/75",
    },
  ]
  const total = parts.reduce((s, p) => s + p.gb, 0)
  const streamMs = total / (gpus * HBM) // GB / (TB/s) = ms
  const stepMs = fixed + streamMs
  const tps = (acc / stepMs) * 1000
  const ceiling = (acc / streamMs) * 1000
  const rep = REPORTED[gpus]
  const scaleGb = 45

  const apply = (p: Preset) => {
    setPreset(p.key)
    setGpus(p.gpus)
    setRows(p.rows)
    setAccept(p.accept)
    setFixed(p.fixed)
    setOverlap(p.overlap)
  }

  const showRep = spec && preset !== "nospec"

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">one decode step = fixed cost + bytes / (GPUs x 8 TB/s)</span>
        <div className="flex flex-wrap gap-1.5">
          {PRESETS.map((p) => (
            <button
              key={p.key}
              type="button"
              onClick={() => apply(p)}
              aria-pressed={preset === p.key}
              className={cn(
                "rounded-sm border px-2 py-0.5 font-mono text-[10px]",
                preset === p.key ? "bg-foreground/[0.08]" : "hover:bg-foreground/[0.04]"
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-x-6 gap-y-3 p-3 sm:grid-cols-2 sm:p-4">
        <div className="flex items-center gap-1.5">
          <span className="font-mono text-[11px] text-muted-foreground">GPUs</span>
          {([4, 8] as const).map((g) => (
            <button
              key={g}
              type="button"
              onClick={() => {
                setGpus(g)
                setPreset("")
              }}
              aria-pressed={gpus === g}
              className={cn(
                "rounded-sm border px-2 py-0.5 font-mono text-[10px]",
                gpus === g ? "bg-foreground/[0.08]" : "hover:bg-foreground/[0.04]"
              )}
            >
              TP{g}
            </button>
          ))}
        </div>
        <label className="block">
          <span className="mb-1 block font-mono text-[11px] text-muted-foreground">
            rows verified a step: {rows}
            {rows === 1 ? " (no speculation)" : ` (anchor + ${rows - 1} drafts)`}
          </span>
          <Range
            min={1}
            max={7}
            step={1}
            value={rows}
            onChange={(e) => {
              setRows(Number(e.target.value))
              setPreset("")
            }}
            aria-label="Rows verified per step"
          />
        </label>
        <label className="block">
          <span className="mb-1 block font-mono text-[11px] text-muted-foreground">
            tokens emitted a step: {acc.toFixed(1)}
            {accept > rows ? " (capped at the rows verified)" : ""}
          </span>
          <Range
            min={1}
            max={7}
            step={0.1}
            value={accept}
            onChange={(e) => {
              setAccept(Number(e.target.value))
              setPreset("")
            }}
            aria-label="Tokens emitted per step"
          />
        </label>
        <label className="block">
          <span className="mb-1 block font-mono text-[11px] text-muted-foreground">
            expert sharing between rows: {(overlap * 100).toFixed(0)}%
            {overlap === 0 ? " (rows route independently)" : overlap === 1 ? " (every row picks the same 6)" : ""}
          </span>
          <Range
            min={0}
            max={1}
            step={0.05}
            value={overlap}
            onChange={(e) => {
              setOverlap(Number(e.target.value))
              setPreset("")
            }}
            aria-label="Expert sharing between rows"
          />
        </label>
        <label className="block sm:col-span-2">
          <span className="mb-1 block font-mono text-[11px] text-muted-foreground">
            fixed cost a step (launch gaps, dependent stages, all-reduces): {fixed.toFixed(2)} ms
            {fixed === 2.12 ? " · the two-point fit to the README" : ""}
          </span>
          <Range
            min={0}
            max={3}
            step={0.02}
            value={fixed}
            onChange={(e) => {
              setFixed(Number(e.target.value))
              setPreset("")
            }}
            aria-label="Fixed cost per step in milliseconds"
          />
        </label>
      </div>

      <div className="space-y-1.5 border-t px-3 py-3 sm:px-4">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 font-mono text-[11px]">
          <span>bytes read a step, all GPUs</span>
          <span className="tabular-nums">{total.toFixed(1)} GB</span>
        </div>
        <div className="flex h-6 overflow-hidden rounded-sm bg-foreground/[0.04]">
          {parts.map((p) => (
            <div
              key={p.key}
              className={cn("h-6", p.cls)}
              style={{ width: `${((p.gb / scaleGb) * 100).toFixed(2)}%` }}
              title={`${p.label}: ${p.gb.toFixed(2)} GB`}
            />
          ))}
        </div>
        <ul className="grid gap-x-4 gap-y-0.5 font-mono text-[10px] text-muted-foreground sm:grid-cols-2">
          {parts.map((p) => (
            <li key={p.key} className="flex items-center gap-1.5">
              <span className={cn("inline-block size-2 rounded-[2px]", p.cls)} />
              <span className="tabular-nums">{p.gb.toFixed(2)} GB</span>
              <span>{p.label}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="space-y-2 border-t px-3 py-3 sm:px-4">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 font-mono text-[11px]">
          <span>step time</span>
          <span className="tabular-nums">
            {stepMs.toFixed(2)} ms <span className="text-muted-foreground">= {fixed.toFixed(2)} fixed + {streamMs.toFixed(2)} streaming</span>
          </span>
        </div>
        <div className="relative flex h-6 overflow-hidden rounded-sm bg-foreground/[0.04]">
          <div className="h-6 bg-zinc-400/80 dark:bg-zinc-500/80" style={{ width: `${((fixed / 4) * 100).toFixed(2)}%` }} title="fixed cost" />
          <div className="h-6 bg-sky-500/80 dark:bg-sky-400/75" style={{ width: `${((streamMs / 4) * 100).toFixed(2)}%` }} title="streaming weights" />
          {showRep && (
            <div
              className="absolute inset-y-0 w-0.5 bg-red-500"
              style={{ left: `${((rep.step / 4) * 100).toFixed(2)}%` }}
              title={`README step: ${rep.step} ms`}
            />
          )}
        </div>
        <div className="grid gap-2 pt-1 font-mono text-[11px] sm:grid-cols-3">
          <div className="rounded-md border px-2.5 py-1.5">
            <div className="text-[10px] text-muted-foreground">this model</div>
            <div className="text-base tabular-nums">{tps.toFixed(0)} tok/s</div>
          </div>
          <div className="rounded-md border px-2.5 py-1.5">
            <div className="text-[10px] text-muted-foreground">bandwidth only (fixed cost 0)</div>
            <div className="text-base tabular-nums">{ceiling.toFixed(0)} tok/s</div>
          </div>
          <div className="rounded-md border px-2.5 py-1.5">
            <div className="text-[10px] text-muted-foreground">HBM busy</div>
            <div className="text-base tabular-nums">{((streamMs / stepMs) * 100).toFixed(0)}%</div>
          </div>
        </div>
        {showRep && (
          <p className="font-mono text-[10px] text-muted-foreground">
            README, TP{gpus}: {rep.tps.toLocaleString("en-US")} tok/s at {rep.step} ms a step (red line). One request, the Tetris
            prompt, thinking off.
          </p>
        )}
      </div>

      <figcaption className="border-t px-4 py-2.5 text-xs text-muted-foreground">
        Byte sizes are from the checkpoint&apos;s safetensors headers; the block of six drafts, the FP8 heads and the
        tensor-parallel experts are from the engine&apos;s source. Expert sharing between neighbouring rows is not published, so
        it is a slider. The fixed cost is my fit to two README rows taken on different machines; treat it as a rough number.
      </figcaption>
    </figure>
  )
}
