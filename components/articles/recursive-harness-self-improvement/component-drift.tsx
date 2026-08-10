"use client"

import { useEffect, useRef, useState } from "react"

import { cn } from "@/lib/utils"
import { mpow } from "@/lib/dmath"

// The information-theoretic hypothesis, in its own real numbers. RHI's
// optimizer prompt tells the harness optimizer to prioritize updating
// CONTRACTS and HOPS (the workflow) over ROLES and INSTRUCTIONS (the agent
// design). Sec 6.3 formalizes this as raising task mutual information I(z;X)
// in the emphasized components while lowering task-conditional total
// correlation (redundancy) across all of them. Table 2 + Table 3 report the
// measured endpoints (debiased text-embedding-3-large, iteration 1 -> 4):
// role 0.47->0.33, instruction 0.99->1.00 (flat), contract 0.99->1.34,
// hop 1.96->2.54; redundancy (total correlation | task) 4.84->3.63 nats.
// These two iterations are the paper's own measured points; the animated
// transition between them is a presentation choice, not new data.

const UP = "oklch(0.64 0.16 200)" // contract, hop — rising
const DOWN = "oklch(0.68 0.16 55)" // role — falling
const FLAT = "oklch(0.60 0.02 260)" // instruction — flat

type Iter = "i1" | "i4"

const COMPONENTS = [
  { key: "hop", label: "hop", i1: 1.96, i4: 2.54, color: UP },
  { key: "contract", label: "contract", i1: 0.99, i4: 1.34, color: UP },
  { key: "instruction", label: "instruction", i1: 0.99, i4: 1.0, color: FLAT },
  { key: "role", label: "role", i1: 0.47, i4: 0.33, color: DOWN },
]
const REDUNDANCY = { i1: 4.84, i4: 3.63 }
const MAX_MI = 2.7

function useAnimatedNumber(target: number, ms = 480) {
  const [val, setVal] = useState(target)
  const fromRef = useRef(target)
  useEffect(() => {
    const from = fromRef.current
    if (from === target) return
    let raf = 0
    let startTs = 0
    const step = (ts: number) => {
      if (!startTs) startTs = ts
      const p = Math.min(1, (ts - startTs) / ms)
      const e = 1 - mpow(1 - p, 3)
      setVal(from + (target - from) * e)
      if (p < 1) raf = requestAnimationFrame(step)
      else fromRef.current = target
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [target, ms])
  return val
}

const W = 720
const H = 260
const BX = 108
const BW = 480
const ROW_H = 42
const ROW_GAP = 12
const TOP = 16
const rowY = (i: number) => TOP + i * (ROW_H + ROW_GAP)

export function ComponentDrift() {
  const [iter, setIter] = useState<Iter>("i1")
  const on4 = iter === "i4"

  // Hooks called unconditionally, once per fixed component (not inside the
  // .map below) to keep hook order stable across renders.
  const vHop = useAnimatedNumber(on4 ? COMPONENTS[0].i4 : COMPONENTS[0].i1)
  const vContract = useAnimatedNumber(on4 ? COMPONENTS[1].i4 : COMPONENTS[1].i1)
  const vInstruction = useAnimatedNumber(on4 ? COMPONENTS[2].i4 : COMPONENTS[2].i1)
  const vRole = useAnimatedNumber(on4 ? COMPONENTS[3].i4 : COMPONENTS[3].i1)
  const vals = [vHop, vContract, vInstruction, vRole]
  const redundancy = useAnimatedNumber(on4 ? REDUNDANCY.i4 : REDUNDANCY.i1)

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex items-center justify-between border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>component drift · task mutual information I(z; task)</span>
        <span className="text-muted-foreground/50">debiased text-embedding-3-large</span>
      </div>

      <div className="p-3 sm:p-4">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`At iteration ${on4 ? 4 : 1}, task mutual information is hop ${vals[0].toFixed(2)}, contract ${vals[1].toFixed(2)}, instruction ${vals[2].toFixed(2)}, role ${vals[3].toFixed(2)} nats; redundancy across components is ${redundancy.toFixed(2)} nats.`}>
          {COMPONENTS.map((c, i) => {
            const y = rowY(i)
            const w = Math.max(2, (vals[i] / MAX_MI) * BW)
            return (
              <g key={c.key}>
                <text x={BX - 12} y={y + ROW_H / 2 + 4} textAnchor="end" className="fill-foreground font-mono" fontSize={12} fontWeight={600}>
                  {c.label}
                </text>
                <rect x={BX} y={y + 6} width={BW} height={ROW_H - 12} rx={7} fill="var(--muted)" opacity={0.35} />
                <rect x={BX} y={y + 6} width={w} height={ROW_H - 12} rx={7} fill={c.color} opacity={0.85} className="transition-all duration-150" />
                <text x={BX + w + 10} y={y + ROW_H / 2 + 4} className="font-mono" fontSize={12} fontWeight={600} fill={c.color}>
                  {vals[i].toFixed(2)}
                </text>
              </g>
            )
          })}
        </svg>

        <div className="mt-1 flex flex-wrap items-center gap-x-5 gap-y-2">
          <div className="flex items-center gap-1.5">
            <span className="font-mono text-[10px] text-muted-foreground">RHI iteration</span>
            {(["i1", "i4"] as Iter[]).map((it) => (
              <button
                key={it}
                type="button"
                onClick={() => setIter(it)}
                aria-pressed={iter === it}
                className={cn(
                  "cursor-pointer rounded-md px-2.5 py-1 font-mono text-[10px] transition-colors",
                  iter === it ? "text-background" : "bg-muted text-muted-foreground hover:text-foreground"
                )}
                style={iter === it ? { background: UP } : undefined}
              >
                {it === "i1" ? "H[1]" : "H[4]"}
              </button>
            ))}
          </div>
          <div className="ml-auto rounded-lg border bg-muted/20 px-3 py-1.5 font-mono text-[11px]">
            <span className="text-muted-foreground">redundancy (total correlation | task) </span>
            <span className="font-semibold" style={{ color: on4 ? UP : "var(--foreground)" }}>{redundancy.toFixed(2)} nats</span>
          </div>
        </div>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          RHI&apos;s optimizer prompt tells it to prioritize editing <span style={{ color: UP }}>contracts and hops</span>{" "}—
          the workflow — over <span style={{ color: DOWN }}>roles</span>{" "}and instructions. Toggle
          H[1] → H[4] and that priority shows up as measurement: <span style={{ color: UP }}>hop</span>{" "}and{" "}
          <span style={{ color: UP }}>contract</span>{" "}mutual information with the task rise, role
          falls, instruction stays flat — while redundancy across all four components drops from 4.84
          to 3.63 nats. Read together, that is the paper&apos;s hypothesis for what RHI is implicitly
          optimizing: more task information in the components it is told to touch, less duplicated
          information everywhere. The paper is explicit that this is a correlational reading of an
          embedding proxy, not a proof of the optimizer&apos;s true objective.
        </p>
      </div>
    </figure>
  )
}
