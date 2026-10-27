"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// Which defences touch which channel class. Every cell is REASONED from what the mechanism shares and what the
// control isolates; none is measured here. The three "post" rows are what the cpu-chat post REPORTS it defeated.
// 0 = does not touch the class, 1 = narrows it (noisier, slower), 2 = closes it between the tenants it separates.

type Def = { id: string; label: string; cost: string; cells: [number, number, number]; reported?: boolean }

const CHANNELS = ["CPU contention", "cache eviction", "DRAM bandwidth"] as const

const DEFS: Def[] = [
  { id: "smt", label: "SMT off", cost: "half the hardware threads per host", cells: [1, 0, 0], reported: true },
  { id: "pin", label: "Pin tenants to different cores", cost: "less packing, idle cores", cells: [1, 0, 0], reported: true },
  { id: "ksm", label: "Page deduplication (KSM) off", cost: "more memory used", cells: [0, 1, 0], reported: true },
  { id: "cat", label: "Partition the last-level cache", cost: "a smaller cache per tenant", cells: [0, 2, 0] },
  { id: "mba", label: "Throttle memory bandwidth per tenant", cost: "a hard cap on bursty tenants", cells: [0, 0, 1] },
  { id: "clock", label: "Coarsen guest clocks and counters", cost: "breaks code that needs fine timing", cells: [1, 1, 1] },
  { id: "host", label: "One tenant per physical host", cost: "the price of the whole machine", cells: [2, 2, 2] },
]

const LABEL = ["open", "narrowed", "closed"] as const

export function DefenceMatrix() {
  const [on, setOn] = useState<Record<string, boolean>>({ smt: true, pin: true, ksm: true })
  const res = CHANNELS.map((_, k) => Math.max(0, ...DEFS.filter((d) => on[d.id]).map((d) => d.cells[k])))
  return (
    <figure className="my-8 overflow-hidden rounded-md border">
      <div className="border-b px-3 py-2 font-mono text-xs text-muted-foreground">
        stack the defences · cells reasoned from what each control isolates, not measured
      </div>
      <div className="divide-y">
        {DEFS.map((d) => (
          <label key={d.id} className="flex cursor-pointer flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2 text-sm">
            <input type="checkbox" checked={!!on[d.id]} onChange={() => setOn((o) => ({ ...o, [d.id]: !o[d.id] }))} />
            <span className="min-w-[14rem] flex-1">
              {d.label}
              {d.reported && <span className="ml-2 rounded border px-1 font-mono text-[10px] text-muted-foreground">post says: still worked</span>}
            </span>
            <span className="font-mono text-[11px] text-muted-foreground">{d.cost}</span>
          </label>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-2 border-t bg-muted/30 px-4 py-3">
        {CHANNELS.map((c, k) => (
          <div key={c} className="text-center">
            <div className="font-mono text-[11px] text-muted-foreground">{c}</div>
            <div
              className={cn(
                "mt-1 rounded border py-1 font-mono text-xs",
                res[k] === 0 && "border-foreground/50 font-semibold",
                res[k] === 2 && "text-muted-foreground"
              )}
            >
              {LABEL[res[k]]}
            </div>
          </div>
        ))}
      </div>
      <div className="border-t px-4 py-2.5 text-xs text-muted-foreground">
        &quot;Closed&quot; means closed between the tenants the control separates. None of this removes the monitoring job: a narrowed channel is still a channel.
      </div>
    </figure>
  )
}
