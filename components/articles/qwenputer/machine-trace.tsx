"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { cn } from "@/lib/utils"

import { PROGRAM, TRACE } from "./data"

// Steps through a real trace: six instructions (sum 1..100) executed on our toy register machine whose eight
// registers are rows of the reference Qwen3.5 gated delta-rule recurrence. Every R or W below is one token through
// the recurrence (a read has beta 0, a write has beta 1). The ALU is plain Python, so this shows the memory half of a
// computer only. Qwenputer's real core also does the arithmetic and the instruction fetch inside the weights.

export function MachineTrace() {
  const [i, setI] = useState(5)
  const step = TRACE[i]
  const tokens = TRACE.slice(0, i + 1).reduce((a, s) => a + s.ops.length, 0)

  return (
    <figure className="my-8 overflow-hidden rounded-md border">
      <div className="border-b px-3 py-2 font-mono text-xs text-muted-foreground">
        a register machine in delta-rule rows · real trace of sum 1..100 · memory only, the ALU is Python
      </div>
      <div className="flex items-center gap-2 border-b px-4 py-2.5 text-xs">
        <button type="button" onClick={() => setI(Math.max(0, i - 1))} className="rounded border px-2 py-0.5 font-mono hover:bg-muted" aria-label="previous instruction">
          ◀
        </button>
        <Range min={0} max={TRACE.length - 1} step={1} value={i} onChange={(e) => setI(Number(e.target.value))} aria-label="instruction number" className="w-full" />
        <button type="button" onClick={() => setI(Math.min(TRACE.length - 1, i + 1))} className="rounded border px-2 py-0.5 font-mono hover:bg-muted" aria-label="next instruction">
          ▶
        </button>
        <span className="w-44 shrink-0 text-right font-mono tabular-nums text-muted-foreground">
          instruction {i + 1} of {TRACE.length}
        </span>
      </div>
      <div className="grid gap-4 p-4 md:grid-cols-3">
        <div>
          <div className="mb-1.5 font-mono text-[11px] text-muted-foreground">program</div>
          <ol className="space-y-0.5 font-mono text-[11px]">
            {PROGRAM.map((a, n) => (
              <li key={n} className={cn("rounded px-1.5 py-0.5", n === step.pc ? "bg-muted text-foreground" : "text-muted-foreground")}>
                <span className="mr-2 tabular-nums">{n}</span>
                {a}
              </li>
            ))}
          </ol>
        </div>
        <div>
          <div className="mb-1.5 font-mono text-[11px] text-muted-foreground">tokens through the recurrence</div>
          <ul className="space-y-0.5 font-mono text-[11px]">
            {step.ops.map(([k, row, v], n) => (
              <li key={n} className="flex gap-2">
                <span className={cn("w-5 rounded text-center", k === "W" ? "bg-[oklch(0.70_0.15_80/0.25)]" : "bg-[oklch(0.62_0.15_190/0.2)]")}>{k}</span>
                <span>
                  row {row} {k === "W" ? "←" : "→"} {v}
                </span>
              </li>
            ))}
          </ul>
          <div className="mt-2 font-mono text-[11px] text-muted-foreground">
            {step.ops.length} tokens now · {tokens} so far · {(tokens / (i + 1)).toFixed(2)} per instruction
          </div>
        </div>
        <div>
          <div className="mb-1.5 font-mono text-[11px] text-muted-foreground">registers after it</div>
          <div className="grid grid-cols-4 gap-1 font-mono text-[11px]">
            {step.regs.map((r, n) => (
              <div key={n} className="rounded border px-1.5 py-1">
                <div className="text-muted-foreground">x{n}</div>
                <div className="tabular-nums">{r}</div>
              </div>
            ))}
          </div>
          <div className="mt-2 font-mono text-[11px] text-muted-foreground">next instruction: {step.next}</div>
        </div>
      </div>
    </figure>
  )
}
