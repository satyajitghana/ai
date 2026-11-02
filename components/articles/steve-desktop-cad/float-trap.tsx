"use client"

// Why vendor/blender/blender_run.py converts Blender's float32 vertices to
// float64 before it measures anything (line 377 of the file at commit b9709ca).
// MEASURED: numpy 2.5.3, Python 3.13.16. A 32-longitude, 16-ring UV sphere of
// radius 10 mm is moved along (1, 1, 1) by the offset, its coordinates are
// stored as float32 (as Blender stores them), and its volume is summed with the
// origin-tetrahedra formula two ways: after casting back to float64 (what the
// repository does) and with the whole formula left in float32 (what it avoids).
// The centred float64 volume is 4121.9417 mm3.

import { useState } from "react"

import { mlog10 } from "@/lib/dmath"
import { cn } from "@/lib/utils"

const ROWS = [
  { offset: 0, f64: 4121.9418, f32: 4121.9 },
  { offset: 10, f64: 4121.9418, f32: 4121.9 },
  { offset: 100, f64: 4121.9415, f32: 4121.7 },
  { offset: 1000, f64: 4121.9383, f32: 4198.1 },
  { offset: 10000, f64: 4122.033, f32: -413535.2 },
  { offset: 100000, f64: 4121.8579, f32: 121965872 },
]
const REF = 4121.9417

const rel = (v: number) => Math.abs(v / REF - 1)
const bar = (e: number) => Math.min(100, Math.max(1, ((mlog10(Math.max(e, 1e-7)) + 7) / 12) * 100))

export function FloatTrap() {
  const [i, setI] = useState(3)
  const r = ROWS[i]
  const e64 = rel(r.f64)
  const e32 = rel(r.f32)

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/20 to-transparent">
      <div className="flex items-center justify-between border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>a mesh far from the origin</span>
        <span className="text-muted-foreground/60">measured, numpy 2.5.3</span>
      </div>
      <div className="p-4 sm:p-5">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="font-mono text-[11px] text-muted-foreground">offset from origin (mm)</span>
          {ROWS.map((x, k) => (
            <button
              key={x.offset}
              type="button"
              aria-pressed={i === k}
              onClick={() => setI(k)}
              className={cn(
                "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
                i === k ? "border-foreground/30 bg-muted/50 text-foreground" : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {x.offset.toLocaleString("en-US")}
            </button>
          ))}
        </div>

        <div className="mt-4 space-y-3 font-mono text-[11px]">
          {[
            { label: "cast to float64, then sum (the repository)", v: r.f64, e: e64 },
            { label: "whole formula in float32", v: r.f32, e: e32 },
          ].map((row) => (
            <div key={row.label}>
              <div className="flex justify-between text-muted-foreground">
                <span>{row.label}</span>
                <span className="text-foreground">{`${row.v.toLocaleString("en-US", { maximumFractionDigits: 1 })} mm3`}</span>
              </div>
              <div className="mt-1 h-3 rounded bg-muted/40">
                <div className="h-3 rounded bg-foreground/70" style={{ width: `${bar(row.e)}%` }} />
              </div>
              <div className="mt-0.5 text-muted-foreground/70">{`relative error ${row.e < 0.00005 ? "under 0.005%" : `${(row.e * 100).toLocaleString("en-US", { maximumSignificantDigits: 3 })}%`}`}</div>
            </div>
          ))}
        </div>
        <p className="mt-3 font-mono text-[11px] leading-relaxed text-muted-foreground">
          Bar length is log10 of the relative error, from 1e-7 to 1e5. The float32 sum fails because each tetrahedron is a large number minus a nearly equal one;
          casting the stored vertices to float64 keeps the stored rounding (about 0.002% at 10,000 mm) and nothing more.
        </p>
      </div>
    </figure>
  )
}
