"use client"

import { useState } from "react"

import { mlog10 } from "@/lib/dmath"
import { cn } from "@/lib/utils"

// Four compiled machines (plus Qwenputer, which three of them build on) side by side. Layer counts: qwenGPU and qwenLab
// are the READMEs' (reported); qwenFS is the LAYERS list in qfs/circuit.py (read); Qwenx86 is the compact checkpoint's
// config and tensor headers (measured: 13 compute layers, 16 state-only layers with no output projection, Qwen's 32).

type Src = "measured" | "read in code" | "reported"
type M = {
  id: string
  name: string
  base: string
  qwen: number
  added: number
  stateOnly?: number
  where: string
  state: string
  token: string
  cost: string
  src: Record<"layers" | "token" | "cost", Src>
  weights: string
}

const MACHINES: M[] = [
  {
    id: "qwenputer",
    name: "Qwenputer (RISC-V)",
    base: "Qwen3.5-4B",
    qwen: 32,
    added: 11,
    where: "in front",
    state: "registers, 32 KB RAM, ROM in DeltaNet rows",
    token: "about one RISC-V instruction",
    cost: "1.0 to 1.3 tokens per instruction on C programs",
    src: { layers: "measured", token: "measured", cost: "measured" },
    weights: "published, 9.36B wide",
  },
  {
    id: "qwengpu",
    name: "qwenGPU (SIMT)",
    base: "Qwen3.5-2B",
    qwen: 24,
    added: 45,
    where: "in front",
    state: "ROM, 15 registers per lane, 126 words in DeltaNet rows",
    token: "one machine block (up to 4 instructions) for one 4-lane warp",
    cost: "plus 8 tokens per register a later block reads",
    src: { layers: "reported", token: "read in code", cost: "read in code" },
    weights: "built locally by qgpu.merge; none published",
  },
  {
    id: "qwenfs",
    name: "qwenFS (filesystem)",
    base: "Qwen3.5-2B",
    qwen: 24,
    added: 8,
    where: "in front",
    state: "file text in an attention log; tables in DeltaNet rows",
    token: "one copied token of a read, or one parsed token of a call",
    cost: "1 token per token of file text",
    src: { layers: "read in code", token: "read in code", cost: "read in code" },
    weights: "built locally by qfs.merge; none published",
  },
  {
    id: "qwenx86",
    name: "Qwenx86 (x86-64)",
    base: "Qwen3.5-4B",
    qwen: 32,
    added: 13,
    stateOnly: 16,
    where: "in front",
    state: "64 KB RAM, ROM, registers in DeltaNet rows",
    token: "one step of the forked RV32 core running translated x86",
    cost: "56,667 machine tokens for (1200 - 350) / 5",
    src: { layers: "measured", token: "reported", cost: "reported" },
    weights: "published, compact 8.75 GB",
  },
  {
    id: "qwenlab",
    name: "qwenLab (6 learners)",
    base: "Qwen3.5-9B",
    qwen: 32,
    added: 2382,
    where: "appended, own residual",
    state: "learner weights in 11,892 fp32 bank heads (790 MB)",
    token: "one lab tick; Qwen's layers are skipped",
    cost: "193 ticks per training update",
    src: { layers: "reported", token: "reported", cost: "reported" },
    weights: "built at load from the 9B; none published",
  },
]

const BAR = 300

export function MachineLedger() {
  const [log, setLog] = useState(true)
  const [sel, setSel] = useState("qwenx86")
  const max = 2382 + 32
  const len = (n: number) => (log ? (mlog10(1 + n) / mlog10(1 + max)) * BAR : (n / max) * BAR)
  const m = MACHINES.find((x) => x.id === sel) ?? MACHINES[0]

  return (
    <figure className="my-8 overflow-hidden rounded-md border">
      <div className="flex flex-wrap items-center gap-2 border-b px-3 py-2 font-mono text-xs text-muted-foreground">
        <span>compiled machines in Qwen3.5 · layers added against Qwen&apos;s own</span>
        <div className="ml-auto flex gap-1">
          {[true, false].map((v) => (
            <button key={String(v)} type="button" onClick={() => setLog(v)} aria-pressed={log === v} className={cn("rounded border px-2 py-0.5", log === v ? "bg-muted text-foreground" : "hover:bg-muted")}>
              {v ? "log scale" : "linear"}
            </button>
          ))}
        </div>
      </div>
      <div className="space-y-1.5 p-4">
        {MACHINES.map((x) => {
          const on = x.id === sel
          const a = len(x.added)
          const s = x.stateOnly ? len(x.added + x.stateOnly) - a : 0
          const q = len(x.added + (x.stateOnly ?? 0) + x.qwen) - a - s
          return (
            <button
              key={x.id}
              type="button"
              onClick={() => setSel(x.id)}
              aria-pressed={on}
              className={cn("flex w-full items-center gap-3 rounded px-2 py-1 text-left font-mono text-[11px]", on ? "bg-muted" : "hover:bg-muted/60")}
            >
              <span className="w-40 shrink-0 truncate">{x.name}</span>
              <svg viewBox={`0 0 ${BAR} 14`} className="h-3.5 min-w-0 flex-1" aria-hidden="true" preserveAspectRatio="none">
                <rect x={0} y={1} width={a} height={12} fill="oklch(0.62 0.16 300)" />
                {s > 0 && <rect x={a} y={1} width={s} height={12} fill="oklch(0.62 0.16 300 / 0.35)" />}
                <rect x={a + s} y={1} width={q} height={12} fill="oklch(0.64 0.12 190)" />
              </svg>
              <span className="w-24 shrink-0 text-right tabular-nums">
                +{x.added.toLocaleString("en-US")}
                {x.stateOnly ? ` (+${x.stateOnly})` : ""} / {x.qwen}
              </span>
            </button>
          )
        })}
        <div className="flex gap-4 px-2 pt-1 font-mono text-[10px] text-muted-foreground">
          <span>
            <span className="mr-1 inline-block h-2 w-2 bg-[oklch(0.62_0.16_300)]" />
            compiled layers
          </span>
          <span>
            <span className="mr-1 inline-block h-2 w-2 bg-[oklch(0.62_0.16_300/0.35)]" />
            state-only layers
          </span>
          <span>
            <span className="mr-1 inline-block h-2 w-2 bg-[oklch(0.64_0.12_190)]" />
            Qwen&apos;s layers
          </span>
        </div>
      </div>
      <dl className="grid gap-x-6 gap-y-2 border-t p-4 text-xs sm:grid-cols-2">
        <div>
          <dt className="font-mono text-[11px] text-muted-foreground">base · placement</dt>
          <dd>
            {m.base} · {m.where} <span className="text-muted-foreground">({m.src.layers})</span>
          </dd>
        </div>
        <div>
          <dt className="font-mono text-[11px] text-muted-foreground">machine state lives in</dt>
          <dd>{m.state}</dd>
        </div>
        <div>
          <dt className="font-mono text-[11px] text-muted-foreground">one generated token is</dt>
          <dd>
            {m.token} <span className="text-muted-foreground">({m.src.token})</span>
          </dd>
        </div>
        <div>
          <dt className="font-mono text-[11px] text-muted-foreground">cost</dt>
          <dd>
            {m.cost} <span className="text-muted-foreground">({m.src.cost})</span>
          </dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="font-mono text-[11px] text-muted-foreground">weights</dt>
          <dd>{m.weights}</dd>
        </div>
      </dl>
    </figure>
  )
}
