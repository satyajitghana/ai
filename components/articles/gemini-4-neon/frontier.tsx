"use client"

import { useState } from "react"

import { mlog10 } from "@/lib/dmath"

import { COLOR, ROWS, type Fam, type Row } from "./data"

// Where Neon sits: AA Intelligence Index v5.0.1 against one of three costs of
// getting it, one point per thinking level, a family's levels joined. All values
// are AA's (see data.ts). Cost uses a log axis; the other two are linear.

type Axis = "cost" | "time" | "speed"

const AXES: Record<Axis, { label: string; get: (r: Row) => number; ticks: number[]; fmt: (v: number) => string; log: boolean; better: string }> = {
  cost: { label: "cost per index task (USD, log)", get: (r) => r.total, ticks: [0.5, 1, 2, 5, 10, 20], fmt: (v) => `$${v}`, log: true, better: "left is cheaper" },
  time: { label: "time per index task (s)", get: (r) => r.secs, ticks: [0, 500, 1000, 1500, 2000, 2500], fmt: (v) => `${v}`, log: false, better: "left is faster end to end" },
  speed: { label: "output speed (tokens/s)", get: (r) => r.tps, ticks: [0, 40, 80, 120, 160], fmt: (v) => `${v}`, log: false, better: "right streams faster" },
}

const W = 640
const H = 360
const L = 48
const R = 18
const T = 16
const B = 44
const YMIN = 42
const YMAX = 66

const FAMS: Fam[] = ["neon", "carbon", "argon", "hydrogen", "opus", "fable", "astra", "sol"]

export function Frontier() {
  const [axis, setAxis] = useState<Axis>("cost")
  const [sel, setSel] = useState("Neon xhigh")
  const a = AXES[axis]
  const lo = a.ticks[0]
  const hi = a.ticks[a.ticks.length - 1] * (a.log ? 1.4 : 1.04)
  const sx = (v: number) =>
    a.log
      ? L + ((mlog10(v) - mlog10(lo)) / (mlog10(hi) - mlog10(lo))) * (W - L - R)
      : L + ((v - lo) / (hi - lo)) * (W - L - R)
  const sy = (v: number) => T + ((YMAX - v) / (YMAX - YMIN)) * (H - T - B)
  const cur = ROWS.find((r) => `${r.name} ${r.effort}` === sel) ?? ROWS[3]

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>Index against cost, time and speed, per thinking level</span>
        <span className="text-muted-foreground/60">artificialanalysis.ai, 2026-11-20</span>
      </div>
      <div className="p-3 sm:p-4">
        <div className="mb-3 flex flex-wrap items-center gap-2 font-mono text-xs">
          <span className="text-muted-foreground">x axis:</span>
          {(Object.keys(AXES) as Axis[]).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setAxis(k)}
              aria-pressed={axis === k}
              className={`rounded-md border px-2.5 py-1 ${axis === k ? "bg-muted" : "bg-background"}`}
            >
              {k === "cost" ? "cost per task" : k === "time" ? "time per task" : "output speed"}
            </button>
          ))}
          <span className="text-muted-foreground/70">{a.better}, up is smarter</span>
        </div>

        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full"
          role="img"
          aria-label={`Index against ${a.label}: ${ROWS.map((r) => `${r.name} ${r.effort} ${r.idx} at ${a.fmt(a.get(r))}`).join("; ")}.`}
        >
          {[45, 50, 55, 60, 65].map((v) => (
            <g key={v}>
              <line x1={L} y1={sy(v)} x2={W - R} y2={sy(v)} stroke="var(--border)" strokeWidth={1} />
              <text x={L - 8} y={sy(v) + 4} textAnchor="end" fontSize={12} className="fill-muted-foreground font-mono">
                {v}
              </text>
            </g>
          ))}
          {a.ticks.map((t) => (
            <text key={t} x={sx(t)} y={H - B + 18} textAnchor="middle" fontSize={12} className="fill-muted-foreground font-mono">
              {a.fmt(t)}
            </text>
          ))}
          <text x={(L + W - R) / 2} y={H - 6} textAnchor="middle" fontSize={12} className="fill-muted-foreground font-mono">
            {a.label}
          </text>
          {FAMS.map((f) => {
            const pts = ROWS.filter((r) => r.fam === f).sort((p, q) => a.get(p) - a.get(q))
            return (
              <g key={f}>
                {pts.length > 1 && (
                  <polyline
                    points={pts.map((p) => `${sx(a.get(p)).toFixed(1)},${sy(p.idx).toFixed(1)}`).join(" ")}
                    fill="none"
                    stroke={COLOR[f]}
                    strokeWidth={f === "neon" ? 2.5 : 1.5}
                    opacity={0.6}
                  />
                )}
                {pts.map((p) => {
                  const key = `${p.name} ${p.effort}`
                  const hot = key === sel
                  const x = sx(a.get(p))
                  const y = sy(p.idx)
                  return (
                    <g key={key} onClick={() => setSel(key)} style={{ cursor: "pointer" }}>
                      <circle cx={x} cy={y} r={hot ? 8 : f === "neon" ? 6 : 5} fill={COLOR[f]} stroke="var(--background)" strokeWidth={2} />
                      {(hot || p.effort === "xhigh" || p.effort === "max" || (f === "carbon" && p.effort === "high") || (f === "argon")) && (
                        <text x={x + 9} y={y - 7} fontSize={11} fill={COLOR[f]} className="font-mono">
                          {`${p.name}${hot ? ` ${p.effort}` : ""}`}
                        </text>
                      )}
                    </g>
                  )
                })}
              </g>
            )
          })}
        </svg>

        <div className="mt-2 rounded-lg border px-3 py-2 font-mono text-xs">
          <span style={{ color: COLOR[cur.fam] }}>{`${cur.name} (${cur.effort})`}</span>
          <span className="text-muted-foreground">
            {` index ${cur.idx.toFixed(2)}; $${cur.total.toFixed(2)} and ${cur.secs.toLocaleString("en-US")} s per task; ${cur.tps.toFixed(1)} tokens/s; first token after ${cur.ttft.toFixed(1)} s`}
          </span>
        </div>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Each line is one model across its thinking levels; click a point. On cost, Neon&apos;s line runs above
          Carbon&apos;s and left of it everywhere, and GPT-6.2 Astra&apos;s two points sit above Neon at xhigh and to its
          left. On time per task, Neon at xhigh finishes in a bit over half Carbon&apos;s time at high. On raw output
          speed, Neon streams about twice as fast as Carbon and about two thirds as fast as Hydrogen.
        </p>
      </div>
    </figure>
  )
}
