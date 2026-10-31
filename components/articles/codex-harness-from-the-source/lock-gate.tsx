"use client"

import { useMemo, useState } from "react"

import { cn } from "@/lib/utils"

import { SCHED } from "./data"
import { Chip, Panel } from "./ui"

// Data from toy 2 (our simulation of the rule read at core/src/tools/parallel.rs:54,92,284-300).
const NAMES = Array.from(new Set(SCHED.scenarios.map((s) => s.name)))

export function LockGate() {
  const [name, setName] = useState(NAMES[2])
  const [gap, setGap] = useState(0)
  const sc = SCHED.scenarios.find((s) => s.name === name && s.gap_s === gap) ?? SCHED.scenarios[0]
  const serial = useMemo(() => {
    return sc.pattern.split("").reduce<number[]>((acc, _, i) => {
      const prev = i === 0 ? 0 : acc[i - 1] + 1
      acc.push(Math.max(prev, i * sc.gap_s))
      return acc
    }, [])
  }, [sc])
  const max = Math.max(sc.gate_makespan, sc.serial_makespan, 1)
  const x = (t: number) => 70 + (t / max) * 630
  const row = (starts: readonly number[], y: number, label: string) => (
    <g>
      <text x={4} y={y + 14} className="fill-muted-foreground text-[11px]">{label}</text>
      {sc.pattern.split("").map((ch, i) => (
        <g key={i}>
          <rect x={x(starts[i])} y={y + (i % 2) * 0} width={Math.max(2, x(starts[i] + 1) - x(starts[i]) - 2)} height={20} rx={3} className={ch === "W" ? "fill-rose-500/70" : "fill-sky-500/60"} />
          <text x={x(starts[i]) + 4} y={y + 14} className="fill-foreground text-[10px] font-medium">{ch}{i + 1}</text>
        </g>
      ))}
    </g>
  )
  return (
    <Panel title="The tool gate: many readers, one writer, first come first served" sub="our simulation of the rule in parallel.rs; eight one-second calls">
      <div className="mb-3 flex flex-wrap items-center gap-1.5">
        {NAMES.map((n) => (
          <Chip key={n} active={name === n} onClick={() => setName(n)}>{n}</Chip>
        ))}
      </div>
      <div className="mb-3 flex flex-wrap items-center gap-2 text-[12px] text-muted-foreground">
        calls emitted
        <Chip active={gap === 0} onClick={() => setGap(0)}>all at once</Chip>
        <Chip active={gap === 0.5} onClick={() => setGap(0.5)}>0.5 s apart</Chip>
        <span className="ml-auto"><span className="mr-2 inline-block h-2.5 w-2.5 rounded-sm bg-sky-500/60" /> parallel-capable (R) <span className="mx-2 inline-block h-2.5 w-2.5 rounded-sm bg-rose-500/70" /> exclusive (W)</span>
      </div>
      <svg viewBox="0 0 720 96" className="w-full" role="img" aria-label="Schedule of eight calls under the gate and under a serial queue">
        {row(sc.starts, 6, "gate")}
        {row(serial, 52, "serial")}
        <text x={x(sc.gate_makespan)} y={42} textAnchor="end" className="fill-emerald-500 text-[10px]">{sc.gate_makespan} s</text>
        <text x={x(sc.serial_makespan)} y={88} textAnchor="end" className="fill-muted-foreground text-[10px]">{sc.serial_makespan} s</text>
      </svg>
      <p className="mt-1 text-[12.5px] text-muted-foreground">
        Pattern <code className="font-mono">{sc.pattern}</code>: the gate finishes in <span className="font-medium text-foreground">{sc.gate_makespan} s</span>, a serial queue in {sc.serial_makespan} s. A writer in the middle also holds up the readers queued behind it, because the lock is first-in-first-out (tokio&apos;s documented behaviour; not re-tested here).
      </p>
      <div className="mt-4 border-t border-border pt-3">
        <div className="mb-1 text-sm font-medium">How many exclusive calls does it take to lose the benefit?</div>
        <p className="mb-2 text-xs text-muted-foreground">Eight one-second calls emitted together, 400 random placements each.</p>
        <ul className="space-y-1">
          {SCHED.sweep.map((r) => (
            <li key={r.exclusive_of_8} className="flex items-center gap-2 text-[12px]">
              <span className="w-28 shrink-0 text-muted-foreground">{r.exclusive_of_8} of 8 exclusive</span>
              <span className="h-3 rounded-sm bg-emerald-500/70" style={{ width: `${(r.speedup / 8) * 100}%`, minWidth: 4 }} />
              <span className={cn("tabular-nums", r.speedup < 1.5 && "text-muted-foreground")}>{r.speedup.toFixed(2)}x</span>
              <span className="text-muted-foreground">({r.gate_mean.toFixed(2)} s against {r.serial.toFixed(0)} s)</span>
            </li>
          ))}
        </ul>
      </div>
    </Panel>
  )
}
