"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { cn } from "@/lib/utils"

// Who sees whom, from the shipped configs and runtime: vllm-sr/d3's
// decision_config.json says attention_mode "noncausal_full_attention" (the 16
// full-attention layers see the whole prompt, state and question alike);
// d3-turbo's says "prefix_bidir" (d3_runtime.py, StateBlocks and
// block_attention: the state block attends only to itself, the question block
// to the state and to itself). In both, the 48 Gated DeltaNet layers stay
// causal. The grid is a toy, four state tokens and two question tokens. The
// counter is my arithmetic: positions pushed through the trunk for k questions.

type Mode = "d3" | "turbo"
type Layer = "full" | "delta"

const S = 4
const Q = 2
const N = S + Q
const STATES = [200, 500, 1000, 1600, 3000, 8000, 32768]
const KS = [1, 4, 16, 64, 128, 255]

function sees(r: number, c: number, mode: Mode, layer: Layer) {
  if (layer === "delta") return c <= r
  if (mode === "d3") return true
  if (r < S) return c < S
  return true
}

function fmt(n: number) {
  return Math.round(n).toLocaleString("en-US")
}

function Grid({ mode, layer, q }: { mode: Mode; layer: Layer; q: number }) {
  return (
    <div className="grid gap-1">
      <div className="font-mono text-[10px] text-muted-foreground">prompt for question {q}</div>
      <div className="grid w-fit gap-[2px]" style={{ gridTemplateColumns: `repeat(${N}, 14px)` }}>
        {Array.from({ length: N * N }, (_, i) => {
          const r = Math.floor(i / N)
          const c = i % N
          const on = sees(r, c, mode, layer)
          const qcell = c >= S
          return (
            <div
              key={i}
              className={cn(
                "h-[14px] w-[14px] rounded-[2px]",
                !on && "bg-muted",
                on && !qcell && "bg-sky-600",
                on && qcell && (q === 1 ? "bg-amber-500" : "bg-emerald-600"),
              )}
            />
          )
        })}
      </div>
    </div>
  )
}

export function StateOnceMask() {
  const [mode, setMode] = useState<Mode>("turbo")
  const [layer, setLayer] = useState<Layer>("full")
  const [si, setSi] = useState(3)
  const [ki, setKi] = useState(3)
  const [q, setQ] = useState(40)
  const s = STATES[si]
  const k = KS[ki]
  const perQuestion = k * (s + q)
  const once = s + k * q
  const stateDependsOnQuestion = mode === "d3" && layer === "full"

  return (
    <figure className="my-8 overflow-hidden rounded-md border">
      <div className="flex flex-wrap items-center gap-2 border-b px-3 py-2 font-mono text-xs">
        {(
          [
            ["d3", "d3: noncausal_full_attention"],
            ["turbo", "d3-turbo: prefix_bidir"],
          ] as [Mode, string][]
        ).map(([m, label]) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={cn(
              "rounded border px-2 py-0.5",
              mode === m ? "border-foreground bg-foreground text-background" : "text-muted-foreground",
            )}
          >
            {label}
          </button>
        ))}
        <span className="mx-1 text-muted-foreground">|</span>
        {(
          [
            ["full", "16 full-attention layers"],
            ["delta", "48 Gated DeltaNet layers"],
          ] as [Layer, string][]
        ).map(([l, label]) => (
          <button
            key={l}
            type="button"
            onClick={() => setLayer(l)}
            className={cn(
              "rounded border px-2 py-0.5",
              layer === l ? "border-foreground bg-foreground text-background" : "text-muted-foreground",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="grid gap-4 p-3 sm:grid-cols-2">
        <div className="grid content-start gap-3">
          <div className="flex flex-wrap gap-4">
            <Grid mode={mode} layer={layer} q={1} />
            <Grid mode={mode} layer={layer} q={2} />
          </div>
          <p className="font-mono text-[11px] text-muted-foreground">
            Rows are queries, columns are keys. The first four tokens are the state (blue), the last two the
            question. A filled cell means the row reads that column.
          </p>
          <p className="text-sm">
            {stateDependsOnQuestion
              ? "The state rows read the question columns, so the state's hidden states differ from question to question. Nothing can be reused: every question re-reads the state."
              : layer === "delta"
                ? "A Gated DeltaNet layer is a causal scan in both models. Its state after the last state token is the same for every question, so it can be kept and continued."
                : "The state rows read only the state. Their hidden states are the same for every question, so the runtime computes them once, keeps the keys and values, and runs each question block on top."}
          </p>
        </div>

        <div className="grid content-start gap-2 font-mono text-[11px]">
          <label className="flex items-center gap-2">
            <span className="w-40 shrink-0">state: {fmt(s)} tokens</span>
            <Range min={0} max={STATES.length - 1} step={1} value={si} onChange={(e) => setSi(Number(e.target.value))} />
          </label>
          <label className="flex items-center gap-2">
            <span className="w-40 shrink-0">questions: {k}</span>
            <Range min={0} max={KS.length - 1} step={1} value={ki} onChange={(e) => setKi(Number(e.target.value))} />
          </label>
          <label className="flex items-center gap-2">
            <span className="w-40 shrink-0">question block: {q} tokens</span>
            <Range min={10} max={200} step={10} value={q} onChange={(e) => setQ(Number(e.target.value))} />
          </label>
          <div className="mt-2 grid grid-cols-[1fr_auto] gap-x-3 gap-y-1">
            <span className={cn(mode === "d3" && "font-semibold")}>one row per question, k × (state + q)</span>
            <span className={cn(mode === "d3" && "font-semibold")}>{fmt(perQuestion)}</span>
            <span className={cn(mode === "turbo" && "font-semibold")}>state once, state + k × q</span>
            <span className={cn(mode === "turbo" && "font-semibold")}>{fmt(once)}</span>
            <span className="text-muted-foreground">ratio</span>
            <span>{(perQuestion / once).toFixed(1)}×</span>
          </div>
          <p className="mt-2 text-muted-foreground">
            Token positions through the 64-layer trunk. Position count is not latency: attention over a long state
            and the fixed cost of a pass do not scale with it.
          </p>
        </div>
      </div>
    </figure>
  )
}
