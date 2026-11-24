"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

import { ROUTES, type Route } from "./routes-data"

// Eight NoPeBench Task 2 routes on LingBot-World 2.0, as the benchmark's evaluator saw them:
// the camera path each generated video depicts (reconstructed by VGGT-Omega, scaled on the
// true history), the Unreal Engine reference execution, and the verdict the evaluator gave.
// Data: tests/fixtures/task2_lingbot_metrics.json in the NoPeWorld repository. The wall is
// drawn as the fixture's local wall plane at the contact point. The evaluator itself judges
// against Unreal's occupancy map, so the line is a guide and the verdict comes from the file.

type Method = "raw" | "coll" | "pred"
const METHODS: [Method, string, string][] = [
  ["raw", "raw model", "#dc2626"],
  ["coll", "+ collision mode", "#2563eb"],
  ["pred", "+ prediction mode", "#16a34a"],
]

const VERDICT: Record<string, string> = {
  violation_through: "violation: through",
  violation_past: "violation: walked on past contact",
  violation_vanished: "violation: obstacle vanished",
  stopped: "stopped at the obstacle",
  slid: "slid along it",
  stopped_not_slid: "stopped, slide fell short",
  early_stop: "stopped early",
  wrong_direction: "wrong direction",
  retreated: "retreated",
  reversed: "reversed",
  no_response: "no response",
  still_moving: "still moving",
}

const W = 520
const H = 360
const PAD = 24

function frame(r: Route) {
  // fit the reference and both NoPeWorld tracks plus the first stretch of the raw one
  const pts = [...r.ref, ...r.coll.xz, ...r.pred.xz, ...r.raw.xz.slice(0, 20), [0, 0] as [number, number]]
  let x0 = Math.min(...pts.map((p) => p[0]))
  let x1 = Math.max(...pts.map((p) => p[0]))
  let z0 = Math.min(...pts.map((p) => p[1]))
  let z1 = Math.max(...pts.map((p) => p[1]))
  const pad = 0.6
  x0 -= pad; x1 += pad; z0 -= pad; z1 += pad
  const s = Math.min((W - 2 * PAD) / (x1 - x0), (H - 2 * PAD) / (z1 - z0))
  const cx = (x0 + x1) / 2
  const cz = (z0 + z1) / 2
  return { s, X: (x: number) => W / 2 + (x - cx) * s, Y: (z: number) => H / 2 - (z - cz) * s, x0, x1, z0, z1 }
}

const path = (pts: [number, number][], X: (x: number) => number, Y: (z: number) => number) =>
  pts.map((p, i) => `${i ? "L" : "M"}${X(p[0]).toFixed(1)},${Y(p[1]).toFixed(1)}`).join(" ")

export function RouteTracks() {
  const [ri, setRi] = useState(0)
  const [on, setOn] = useState<Record<Method, boolean>>({ raw: true, coll: true, pred: true })
  const r = ROUTES[ri]
  const f = frame(r)
  // wall line: n . (x, z) + off = 0, drawn across the frame
  const [nx, nz] = r.n
  const tx = -nz
  const tz = nx
  const px = -nx * r.off
  const pz = -nz * r.off
  const L = 40
  const kind = r.speed >= 4 ? (r.speed >= 5 ? "car speed" : "drone speed") : "walking"

  return (
    <figure className="my-8 overflow-hidden rounded-md border">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-3 py-2 font-mono text-xs">
        <span className="text-muted-foreground">NoPeBench Task 2, LingBot-World 2.0, from above</span>
        <select
          value={ri}
          onChange={(e) => setRi(Number(e.target.value))}
          className="rounded border bg-background px-1 py-0.5"
          aria-label="Route"
        >
          {ROUTES.map((x, i) => (
            <option key={x.id} value={i}>
              {x.id.replace(/__/, " / ")}
            </option>
          ))}
        </select>
      </div>
      <div className="p-4">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full rounded-md border bg-muted/20" role="img" aria-label="Top view of camera paths: the Unreal reference, the raw model and NoPeWorld's two modes, against the wall">
          <defs>
            <clipPath id="rt-clip">
              <rect x="0" y="0" width={W} height={H} />
            </clipPath>
          </defs>
          <g clipPath="url(#rt-clip)">
            <line
              x1={f.X(px + tx * L)}
              y1={f.Y(pz + tz * L)}
              x2={f.X(px - tx * L)}
              y2={f.Y(pz - tz * L)}
              stroke="currentColor"
              strokeWidth="5"
              opacity="0.45"
            />
            <path d={path(r.ref, f.X, f.Y)} fill="none" stroke="#d97706" strokeWidth="5" opacity="0.35" />
            {METHODS.map(([m, , col]) =>
              on[m] ? (
                <g key={m}>
                  <path d={path([[0, 0], ...r[m].xz], f.X, f.Y)} fill="none" stroke={col} strokeWidth="2" />
                  <circle cx={f.X(r[m].xz[r[m].xz.length - 1][0])} cy={f.Y(r[m].xz[r[m].xz.length - 1][1])} r="4" fill={col} />
                </g>
              ) : null,
            )}
            <circle cx={f.X(0)} cy={f.Y(0)} r="5" fill="currentColor" />
          </g>
          <text x={10} y={16} fontSize="11" className="fill-muted-foreground font-mono">
            grey: wall plane at contact · orange: Unreal Engine reference
          </text>
          <text x={f.X(0) + 8} y={Math.min(H - 6, f.Y(0) + 14)} fontSize="11" className="fill-foreground font-mono">hand-off</text>
        </svg>

        <div className="mt-3 flex flex-wrap gap-2 font-mono text-xs">
          {METHODS.map(([m, label, col]) => (
            <button
              key={m}
              type="button"
              onClick={() => setOn((o) => ({ ...o, [m]: !o[m] }))}
              className={cn("rounded border px-2 py-1", on[m] ? "text-foreground" : "text-muted-foreground opacity-60")}
            >
              <span style={{ color: col }}>■</span> {label}: {VERDICT[r[m].cat] ?? r[m].cat}
            </button>
          ))}
        </div>
        <div className="mt-2 font-mono text-xs text-muted-foreground">
          {kind} at {r.speed} m/s · the engine slides {r.slide.toFixed(2)} m along the wall after contact
        </div>
        <figcaption className="mt-3 text-xs text-muted-foreground">
          Each line is the camera path a generated 5 s video depicts after the hand-off, reconstructed by VGGT-Ω and placed on the true map. The verdicts are the benchmark&apos;s own, stored in the NoPeWorld repository&apos;s test fixture for LingBot-World 2.0. I picked these eight because the wall plane stored for each one agrees with its verdicts, so the drawing reads cleanly. On about half the routes a single plane does not fit the verdicts, so they are left out. The eight are not a representative sample: they hold more slides than the full 100, where most of NoPeWorld&apos;s safe outcomes are stops. A path that ends past the grey line can still be a slide past the end of a wall. The verdict comes from the occupancy map, not from this line.
        </figcaption>
      </div>
    </figure>
  )
}
