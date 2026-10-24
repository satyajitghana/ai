"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { cn } from "@/lib/utils"

// What happens to eight ATen ops and one .item() under each of TorchTPU's
// execution modes. The behaviour is the one the PyTorch blog ("Introducing
// TorchTPU", 20 Oct 2026) and the repository's csrc/eager describe:
//   Strict        one StableHLO module per op, launched async, CPU runs ahead
//   Debug         same, but the CPU waits for every op (TORCH_TPU_LAUNCH_BLOCKING=1)
//   DeferAndFuse  ops become Deferred Op nodes; at a materialization point the
//                 region is analysed for liveness, keyed, compiled once (cache
//                 miss) or fetched (cache hit), and launched as one executable
//   torch.compile Dynamo hands the backend an FX graph; it is traced as if every
//                 op were deferred, compiled to one program, and later calls skip
//                 per-op dispatch entirely
// The counts are a toy, not a measurement: a forward-only step whose only live
// output is the loss.

type Mode = "strict" | "debug" | "defer" | "compile"

const OPS = [
  { code: "h = x @ w1", op: "aten::mm" },
  { code: "h = h + b1", op: "aten::add" },
  { code: "h = gelu(h)", op: "aten::gelu" },
  { code: "y = h @ w2", op: "aten::mm" },
  { code: "d = y - t", op: "aten::sub" },
  { code: "d = d * d", op: "aten::mul" },
  { code: "loss = d.mean()", op: "aten::mean" },
  { code: "loss = loss * scale", op: "aten::mul" },
]
const N = OPS.length
// cursor N means ".item()" has been reached
const ITEM = N

const MODES: { key: Mode; label: string; sub: string }[] = [
  { key: "strict", label: "Strict", sub: "default eager" },
  { key: "debug", label: "Debug", sub: "TORCH_TPU_LAUNCH_BLOCKING=1" },
  { key: "defer", label: "DeferAndFuse", sub: "TORCH_TPU_DEFER_AND_FUSE=1" },
  { key: "compile", label: "torch.compile", sub: 'backend="tpu"' },
]

type OpState = "idle" | "deferred" | "queued" | "done" | "traced" | "fused"

function opState(mode: Mode, i: number, cursor: number, later: boolean): OpState {
  if (mode === "compile" && later) return cursor >= ITEM ? "fused" : "idle"
  if (i >= cursor) return "idle"
  if (mode === "strict") return cursor >= ITEM ? "done" : "queued"
  if (mode === "debug") return "done"
  if (mode === "compile") return cursor >= ITEM ? "fused" : "traced"
  return cursor >= ITEM ? "fused" : "deferred"
}

const STATE_STYLE: Record<OpState, string> = {
  idle: "text-muted-foreground/60",
  deferred: "bg-amber-500/15 text-foreground",
  traced: "bg-violet-500/15 text-foreground",
  queued: "bg-sky-500/15 text-foreground",
  done: "bg-emerald-500/15 text-foreground",
  fused: "bg-emerald-500/20 text-foreground",
}

const STATE_LABEL: Record<OpState, string> = {
  idle: "",
  deferred: "deferred op",
  traced: "traced, not run",
  queued: "launched, running",
  done: "finished",
  fused: "in one executable",
}

export function DispatchModes() {
  const [mode, setMode] = useState<Mode>("defer")
  const [cursor, setCursor] = useState(ITEM)
  const [later, setLater] = useState(false)

  const reached = Math.min(cursor, N)
  const atItem = cursor >= ITEM
  const perOp = mode === "strict" || mode === "debug"

  const launches = perOp ? reached : atItem ? 1 : 0
  const compiles = later ? 0 : perOp ? reached : atItem ? 1 : 0
  // intermediate tensors written to HBM: per-op modes write every result
  // except the last; a fused region keeps them inside one program
  const hbmTemps = perOp ? Math.max(0, reached - (atItem ? 1 : 0)) : 0
  const cpuWaits = mode === "debug" ? reached + (atItem ? 1 : 0) : atItem ? 1 : 0
  const callbacks = mode === "compile" && later ? 0 : reached

  const status = (() => {
    if (mode === "compile" && later)
      return "Dynamo's guards pass, so the cached executable is called directly. No op reaches the dispatcher until .item() reads the result."
    if (!atItem) {
      if (mode === "strict")
        return "Each op is lowered to its own StableHLO module and launched without waiting. The CPU runs ahead of the TPU."
      if (mode === "debug") return "Each op is launched and the CPU blocks until it finishes. Slow, and bounds-checked."
      if (mode === "compile")
        return "Dynamo is tracing the FX graph. The backend replays it with every op deferred; nothing runs on the TPU yet."
      return "Nothing has run. Each op returned a tensor whose storage points at a Deferred Op holding a StableHLO builder."
    }
    if (perOp)
      return mode === "debug"
        ? "Every op already finished, so .item() only copies one scalar back."
        : ".item() waits for the last queued op, then copies the scalar from HBM."
    return later
      ? ".item() is a materialization point. Liveness keeps only loss; the graph key hits the cache, and one executable runs."
      : ".item() is a materialization point. Liveness keeps only loss; the graph key misses, a thread compiles the region once, and one executable runs."
  })()

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">eight ATen ops, then loss.item()</span>
        <span className="font-mono text-[10px] text-muted-foreground">toy step · counts are illustrative</span>
      </div>

      <div className="p-3 sm:p-4">
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Execution mode">
          {MODES.map((m) => (
            <button
              key={m.key}
              type="button"
              onClick={() => setMode(m.key)}
              aria-pressed={mode === m.key}
              className={cn(
                "rounded-sm border px-2 py-1 text-left font-mono text-[11px] leading-tight",
                mode === m.key ? "bg-foreground/[0.08]" : "hover:bg-foreground/[0.04]"
              )}
            >
              {m.label}
              <span className="block text-[9px] text-muted-foreground">{m.sub}</span>
            </button>
          ))}
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-3">
          <label className="min-w-[12rem] flex-1">
            <span className="mb-1 block font-mono text-[11px] text-muted-foreground">
              Python has reached: {atItem ? "loss.item()" : `line ${cursor + 1} of ${N + 1}`}
            </span>
            <Range
              min={0}
              max={ITEM}
              step={1}
              value={cursor}
              onChange={(e) => setCursor(Number(e.target.value))}
              aria-label="Program position"
            />
          </label>
          <div className="flex gap-1.5" role="group" aria-label="Which training step">
            {[false, true].map((v) => (
              <button
                key={String(v)}
                type="button"
                onClick={() => setLater(v)}
                aria-pressed={later === v}
                className={cn(
                  "rounded-sm border px-2 py-0.5 font-mono text-[10px]",
                  later === v ? "bg-foreground/[0.08]" : "hover:bg-foreground/[0.04]"
                )}
              >
                {v ? "step 2 onward" : "first step"}
              </button>
            ))}
          </div>
        </div>

        <ol className="mt-3 space-y-1 font-mono text-[11px]">
          {OPS.map((o, i) => {
            const s = opState(mode, i, cursor, later)
            return (
              <li
                key={i}
                className={cn("flex flex-wrap items-baseline justify-between gap-x-3 rounded-sm px-2 py-0.5", STATE_STYLE[s])}
              >
                <span>
                  {o.code} <span className="text-muted-foreground">· {o.op}</span>
                </span>
                <span className="text-[10px] text-muted-foreground">{STATE_LABEL[s]}</span>
              </li>
            )
          })}
          <li
            className={cn(
              "flex justify-between rounded-sm px-2 py-0.5",
              atItem ? "bg-rose-500/15" : "text-muted-foreground/60"
            )}
          >
            <span>loss.item()</span>
            <span className="text-[10px] text-muted-foreground">{atItem ? "materialization point" : ""}</span>
          </li>
        </ol>

        <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-1 rounded-md border bg-background/60 p-3 font-mono text-[11px] tabular-nums sm:grid-cols-3">
          <div className="flex justify-between gap-2">
            <span className="text-muted-foreground">TPU launches</span>
            <span>{launches}</span>
          </div>
          <div className="flex justify-between gap-2">
            <span className="text-muted-foreground">XLA compiles</span>
            <span>{compiles}</span>
          </div>
          <div className="flex justify-between gap-2">
            <span className="text-muted-foreground">temporaries in HBM</span>
            <span>{hbmTemps}</span>
          </div>
          <div className="flex justify-between gap-2">
            <span className="text-muted-foreground">CPU waits</span>
            <span>{cpuWaits}</span>
          </div>
          <div className="flex justify-between gap-2">
            <span className="text-muted-foreground">dispatcher callbacks</span>
            <span>{callbacks}</span>
          </div>
        </div>

        <p className="mt-3 min-h-[3rem] text-xs leading-5 text-muted-foreground">{status}</p>
      </div>
    </figure>
  )
}
