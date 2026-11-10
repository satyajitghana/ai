"use client"

import { useState } from "react"

import { mlog10 } from "@/lib/dmath"
import { cn } from "@/lib/utils"

import { DOMAIN_LABEL, FLOOR_ARMS, MATCHED, SETS, type Target } from "./deep-data"

// Second CPU run (measured): three ways of choosing 8 neurons, each retrained at three learning rates and read at
// the same held-out cross-entropy. Bars: F per domain (log), interpolated per domain along each arm's curve.

const X0 = -5
const X1 = 1

function fmt(v: number) {
  return v.toExponential(1).replace("e-", "e−")
}

export function LayerFloor() {
  const [t, setT] = useState<Target>("0.5")
  const [on, setOn] = useState<Record<string, boolean>>(Object.fromEntries(FLOOR_ARMS.map((a) => [a.arm, true])))
  const arms = FLOOR_ARMS.filter((a) => on[a.arm])
  const doms = Object.keys(DOMAIN_LABEL)
  const pct = (v: number) => Math.max(0, Math.min(100, ((mlog10(Math.max(v, 1e-5)) - X0) / (X1 - X0)) * 100))
  const rows = [{ id: "macro", label: "all 7 (macro mean)" }, ...doms.map((d) => ({ id: d, label: DOMAIN_LABEL[d] }))]
  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">measured · which 8 neurons · F per domain</span>
        <div className="flex gap-1" role="tablist" aria-label="Strength target">
          {(["0.5", "0.3"] as Target[]).map((v) => (
            <button
              key={v}
              type="button"
              role="tab"
              aria-selected={v === t}
              onClick={() => setT(v)}
              className={cn(
                "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
                v === t ? "border-foreground/40 bg-foreground/10 text-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              held-out CE {v}
            </button>
          ))}
        </div>
      </div>
      <div className="p-3 sm:p-4">
        <div className="mb-3 flex flex-wrap gap-1.5">
          {FLOOR_ARMS.map((a) => (
            <button
              key={a.arm}
              type="button"
              aria-pressed={on[a.arm]}
              onClick={() => setOn({ ...on, [a.arm]: !on[a.arm] })}
              className={cn(
                "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-opacity",
                on[a.arm] ? "opacity-100" : "opacity-40",
              )}
            >
              <span style={{ color: a.color }}>■</span> {a.label}
            </button>
          ))}
        </div>
        <div className="space-y-2">
          {rows.map((r) => (
            <div key={r.id} className="grid grid-cols-[7.5rem_1fr] items-center gap-2 sm:grid-cols-[10rem_1fr]">
              <span className={cn("truncate font-mono text-[10px] text-muted-foreground", r.id === "macro" && "font-semibold text-foreground")}>{r.label}</span>
              <div className="space-y-0.5">
                {arms.map((a) => {
                  const m = MATCHED[a.arm]?.[t]
                  const v = r.id === "macro" ? m?.F : m?.by?.[r.id]
                  return (
                    <div key={a.arm} className="flex items-center gap-1.5">
                      <div className="h-2.5 flex-1 rounded-sm bg-muted/40">
                        {v ? <div className="h-2.5 rounded-sm" style={{ width: `${pct(v)}%`, background: a.color }} /> : null}
                      </div>
                      <span className="w-14 shrink-0 text-right font-mono text-[9px] tabular-nums text-muted-foreground">{v ? fmt(v) : "n/c"}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
        <div className="mt-1 grid grid-cols-[7.5rem_1fr] gap-2 font-mono text-[9px] text-muted-foreground sm:grid-cols-[10rem_1fr]">
          <span />
          <div className="mr-16 flex justify-between">
            <span>1e−5</span>
            <span>1e−3</span>
            <span>1e−1</span>
            <span>10</span>
          </div>
        </div>
        <div className="mt-3 space-y-1 rounded-md border px-3 py-2 font-mono text-[10px] text-muted-foreground">
          {FLOOR_ARMS.map((a) => (
            <div key={a.arm}>
              <span style={{ color: a.color }}>■</span> {a.label}: layers{" "}
              {(SETS[a.arm] ?? []).map((n) => n.layer).join(", ")} · set g/c {a.sset.toFixed(2)}
            </div>
          ))}
          <div>n/c = that arm&apos;s learning rates do not reach this strength. Log scale: one tick is 10x.</div>
        </div>
      </div>
    </figure>
  )
}
