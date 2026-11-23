"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// The paper's Table 2 (four public datasets with a laser scan) and Table 3 (the phone rig), map
// F-score at 5 cm, each map placed by its own system's trajectory. null: failed on every sequence
// (the paper's ×); undefined: not run / no map of its own (the paper's –).

type Row = { sys: string; note?: string; v: (number | null | undefined)[] }

const SETS = ["EuRoC", "ORI", "Hilti-Oxford", "Oxford Spires", "Note 9", "iPhone"]
const WHERE = ["drone, rooms", "hand-held, buildings", "survey rig", "carried outdoors", "phone rig", "phone rig"]

const ROWS: Row[] = [
  { sys: "MASt3R-Fusion", v: [0.41, 0.53, 0.13, null, 0.04, null] },
  { sys: "VGGT-SLAM 2.0", note: "given the reference's scale", v: [0.49, 0.18, 0.04, 0.05, 0.07, 0.09] },
  { sys: "ScaRF-SLAM's mapper", note: "on Accord's poses", v: [0.2, 0.74, 0.09, 0.05, 0.14, 0.1] },
  { sys: "FoundationVIO", v: [null, 0.56, 0.06, 0.12, 0.15, 0.13] },
  { sys: "DAVIO", note: "the base system", v: [0.38, 0.5, undefined, null, 0.12, 0.11] },
  { sys: "Accord", v: [0.57, 0.78, 0.16, 0.2, 0.21, 0.12] },
]

export function MapScores() {
  const [set, setSet] = useState(0)
  const vals = ROWS.map((r) => r.v[set])
  const best = Math.max(...vals.map((v) => (typeof v === "number" ? v : -1)))
  const scaleMax = 0.8

  return (
    <figure className="my-8 overflow-hidden rounded-md border">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-3 py-2 font-mono text-xs">
        <span className="text-muted-foreground">map F-score at 5 cm, placed by each system&apos;s own trajectory</span>
      </div>
      <div className="p-4">
        <div className="mb-4 flex flex-wrap gap-1 font-mono text-xs">
          {SETS.map((s, i) => (
            <button
              key={s}
              type="button"
              onClick={() => setSet(i)}
              aria-pressed={set === i}
              className={cn(
                "cursor-pointer rounded border px-2 py-1 transition-colors",
                set === i ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {s}
            </button>
          ))}
        </div>
        <div className="mb-3 font-mono text-xs text-muted-foreground">{WHERE[set]}</div>
        <div className="grid gap-2">
          {ROWS.map((r) => {
            const v = r.v[set]
            const isNum = typeof v === "number"
            return (
              <div key={r.sys} className="grid grid-cols-[9.5rem_1fr_3rem] items-center gap-3 font-mono text-xs sm:grid-cols-[13rem_1fr_3rem]">
                <span className={cn(r.sys === "Accord" ? "text-foreground" : "text-muted-foreground")}>
                  {r.sys}
                  {r.note && <span className="hidden text-[10px] opacity-70 sm:inline"> · {r.note}</span>}
                </span>
                <div className="h-4 rounded-sm bg-muted/40">
                  {isNum && (
                    <div
                      className="h-4 rounded-sm"
                      style={{
                        width: `${Math.min(100, (v / scaleMax) * 100).toFixed(1)}%`,
                        background: r.sys === "Accord" ? "#c8501e" : "var(--muted-foreground)",
                        opacity: v === best ? 1 : 0.55,
                      }}
                    />
                  )}
                </div>
                <span className="text-right">{isNum ? v.toFixed(2) : v === null ? "failed" : "not run"}</span>
              </div>
            )
          })}
        </div>
        <figcaption className="mt-4 text-xs text-muted-foreground">
          Means over each set&apos;s sequences, from the paper&apos;s Tables 2 and 3. &quot;failed&quot;: no output on any
          sequence, or a trajectory more than 10 m off. Hilti-Oxford: the three building sequences its scan covers. The
          phone scores are against a LiDAR iPhone&apos;s RTAB-Map map, not a survey scan.
        </figcaption>
      </div>
    </figure>
  )
}
