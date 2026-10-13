"use client"

import { useState, type ReactNode } from "react"

import { cn } from "@/lib/utils"

// FIDs copied from arXiv 2610.12102v1: Table 2(c) (flow-renoise and flow-map
// under three shifted discretizations, with and without CFG) and Table 3
// (data-space, which has no discretization). ImageNet 256x256, SiT-XL/2
// teacher, 50k samples, lower is better. CFG means scale 1.1 over teacher
// timesteps [0.0, 0.6]. Flow-map is trained for exactly four steps, so it has
// no 1-3 NFE numbers. Nothing is interpolated.

type Row = { gamma: string; ts: string; renoise: [number, number, number, number]; map: number }

const ROWS: Record<"no" | "yes", Row[]> = {
  no: [
    { gamma: "0.5", ts: "1.00, 0.60, 0.33, 0.14", renoise: [4.47, 2.84, 2.67, 2.84], map: 2.52 },
    { gamma: "1.0", ts: "1.00, 0.75, 0.50, 0.25", renoise: [4.45, 3.22, 2.67, 2.75], map: 2.55 },
    { gamma: "2.0", ts: "1.00, 0.86, 0.67, 0.40", renoise: [4.2, 3.44, 2.88, 2.72], map: 2.48 },
  ],
  yes: [
    { gamma: "0.5", ts: "1.00, 0.60, 0.33, 0.14", renoise: [3.74, 2.78, 2.54, 2.71], map: 2.52 },
    { gamma: "1.0", ts: "1.00, 0.75, 0.50, 0.25", renoise: [4.02, 2.89, 2.51, 2.61], map: 2.86 },
    { gamma: "2.0", ts: "1.00, 0.86, 0.67, 0.40", renoise: [3.71, 2.8, 2.56, 2.69], map: 2.37 },
  ],
}
const DATA: Record<"no" | "yes", [number, number, number, number]> = {
  no: [3.85, 2.68, 2.47, 2.46],
  yes: [3.31, 2.47, 2.33, 2.29],
}

const C = { data: "oklch(0.62 0.15 160)", renoise: "oklch(0.64 0.17 35)", map: "oklch(0.6 0.14 265)" }

export function ScheduleBoard() {
  const [cfg, setCfg] = useState<"no" | "yes">("no")
  const [g, setG] = useState(1)
  const row = ROWS[cfg][g]
  const data = DATA[cfg]
  const lo = 2
  const hi = 4.8
  const w = (v: number) => `${Math.max(4, Math.min(100, ((v - lo) / (hi - lo)) * 100)).toFixed(1)}%`

  const best4Flow = Math.min(...ROWS[cfg].map((r) => r.map))
  const bestGamma = ROWS[cfg].find((r) => r.map === best4Flow)!.gamma

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">schedule search · paper Tables 2(c) and 3</span>
        <span className="font-mono text-[10px] text-muted-foreground">ImageNet 256 FID-50k, lower is better</span>
      </div>
      <div className="space-y-4 px-4 py-4">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 font-mono text-[10px] text-muted-foreground">guidance</span>
          <Pill on={cfg === "no"} onClick={() => setCfg("no")}>
            off
          </Pill>
          <Pill on={cfg === "yes"} onClick={() => setCfg("yes")}>
            1.1 on [0, 0.6]
          </Pill>
          <span className="ml-3 mr-1 font-mono text-[10px] text-muted-foreground">shift γ (flow methods only)</span>
          {ROWS[cfg].map((r, i) => (
            <Pill key={r.gamma} on={g === i} onClick={() => setG(i)}>
              {r.gamma}
              {r.gamma === "1.0" ? " (uniform)" : ""}
            </Pill>
          ))}
        </div>
        <div className="font-mono text-[10px] text-muted-foreground">
          flow times the generator is trained and sampled at: [{row.ts}] · data-space uses none
        </div>

        <div className="space-y-3">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="grid grid-cols-[3.2rem_minmax(0,1fr)] items-center gap-2">
              <span className="font-mono text-[11px]">{i + 1} NFE</span>
              <div className="space-y-1">
                <Bar color={C.data} width={w(data[i])} label={`data-space ${data[i].toFixed(2)}`} />
                <Bar color={C.renoise} width={w(row.renoise[i])} label={`flow-renoise ${row.renoise[i].toFixed(2)}`} />
                {i === 3 ? <Bar color={C.map} width={w(row.map)} label={`flow-map ${row.map.toFixed(2)}`} /> : null}
              </div>
            </div>
          ))}
        </div>

        <p className="text-[11px] leading-relaxed text-muted-foreground">
          Each flow-method bar is a separately trained generator: self-rollout fixes the schedule at training time.
          {` Best flow-map here: γ = ${bestGamma}, FID ${best4Flow.toFixed(2)}, against ${data[3].toFixed(2)} for the one data-space model. `}
          The paper reports means of three runs for these two methods with a standard deviation below 0.05.
        </p>
      </div>
    </figure>
  )
}

// A label like "flow-renoise 2.84" is ~102 px at 10 px mono; the narrowest
// track (390 px phone) is ~267 px. Over half the track, the fill is at least
// ~133 px and the label sits inside it; at or under half, it sits just past
// the fill's end and still ends inside the track (≤ ~241 px).
function Bar({ color, width, label }: { color: string; width: string; label: string }) {
  const inside = parseFloat(width) > 50
  return (
    <div className="relative h-5 rounded bg-muted/30">
      <div className="absolute inset-y-0 left-0 rounded" style={{ width, background: color, opacity: 0.75 }} />
      <span
        className="absolute inset-y-0 flex items-center whitespace-nowrap font-mono text-[10px] text-foreground"
        style={{ left: inside ? "0.5rem" : `calc(${width} + 0.375rem)` }}
      >
        {label}
      </span>
    </div>
  )
}

function Pill({ on, onClick, children }: { on: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={cn(
        "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
        on ? "border-foreground/30 bg-muted/50 text-foreground" : "border-border text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  )
}
