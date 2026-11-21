"use client"

import { useState } from "react"

import { BENCH, VARIANTS, type BenchSeq } from "@/components/articles/voxel-slam/data"
import { cn } from "@/lib/utils"

// Voxel-SLAM's three outputs against ground truth, per sequence. Every trajectory went through the
// shootout harness's one scoring step: moved into the reference's body frame, the reference
// interpolated at the estimate's own timestamps, one SE(3) Umeyama fit without scale. Top-down at
// 2 Hz; below, each variant's position error over time.

const W = 640
const H = 380

export function VsBench() {
  const keys = Object.keys(BENCH)
  const [seq, setSeq] = useState(keys[0] ?? "")
  const [hidden, setHidden] = useState<Record<string, boolean>>({})
  const d: BenchSeq | undefined = BENCH[seq]
  if (!d) return null
  const runs = VARIANTS.filter((v) => d.runs[v.key])

  let x0 = Infinity
  let x1 = -Infinity
  let y0 = Infinity
  let y1 = -Infinity
  const grow = (x: number, y: number) => {
    x0 = Math.min(x0, x)
    x1 = Math.max(x1, x)
    y0 = Math.min(y0, y)
    y1 = Math.max(y1, y)
  }
  for (const p of d.ref) grow(p[1], p[2])
  const pad = 22
  const span = Math.max(x1 - x0, (y1 - y0) * (W / H), 1)
  const scale = (W - 2 * pad) / span
  const cx = (x0 + x1) / 2
  const cy = (y0 + y1) / 2
  const X = (x: number) => W / 2 + (x - cx) * scale
  const Y = (y: number) => H / 2 - (y - cy) * scale
  const path = (pts: number[][]) => pts.map((p, i) => `${i ? "L" : "M"}${X(p[1]).toFixed(1)},${Y(p[2]).toFixed(1)}`).join("")

  const EH = 130
  let eMax = 0.05
  for (const v of runs) {
    const r = d.runs[v.key]
    if (!r || hidden[v.key]) continue
    for (const p of r.traj) eMax = Math.max(eMax, p[3])
  }
  const ex = (t: number) => 44 + (t / d.duration) * (W - 60)
  const ey = (e: number) => EH - 18 - (e / eMax) * (EH - 30)
  let barM = 1000
  while (barM > span / 4 && barM > 0.01) barM /= 10
  const bar = span / 4 >= 5 * barM ? 5 * barM : span / 4 >= 2 * barM ? 2 * barM : barM
  const cm = (m: number | null) => (m == null ? "n/a" : m >= 1 ? `${m.toFixed(2)} m` : `${(m * 100).toFixed(1)} cm`)

  return (
    <figure className="my-8 overflow-hidden rounded-md border">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-3 py-2 font-mono text-xs">
        <span className="text-muted-foreground">Voxel-SLAM against ground truth, three outputs</span>
        <div className="flex flex-wrap gap-1">
          {keys.map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setSeq(k)}
              aria-pressed={seq === k}
              className={cn(
                "cursor-pointer rounded px-2 py-1 transition-colors",
                seq === k ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {BENCH[k].short}
            </button>
          ))}
        </div>
      </div>
      <div className="p-4">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          role="img"
          aria-label={`Top-down trajectories on ${d.label}: the reference in grey and each Voxel-SLAM output, aligned, in colour.`}
          className="w-full rounded-md border bg-muted/20"
        >
          <path d={path(d.ref)} fill="none" stroke="var(--muted-foreground)" strokeWidth="5" opacity="0.25" strokeLinejoin="round" />
          {runs.map((v) => {
            const r = d.runs[v.key]
            if (!r || hidden[v.key]) return null
            return <path key={v.key} d={path(r.traj.map((p) => [p[0], p[1], p[2]]))} fill="none" stroke={v.color} strokeWidth="1.4" strokeLinejoin="round" />
          })}
          <line x1={pad} x2={pad + bar * scale} y1={H - 12} y2={H - 12} stroke="var(--foreground)" strokeWidth="1.5" />
          <text x={pad} y={H - 18} fontSize="10" className="fill-muted-foreground font-mono">
            {bar >= 1 ? `${bar} m` : `${bar * 100} cm`}
          </text>
        </svg>

        <svg viewBox={`0 0 ${W} ${EH}`} role="img" aria-label="Position error over time for each output." className="mt-3 w-full">
          <line x1={44} x2={W - 16} y1={EH - 18} y2={EH - 18} stroke="var(--border)" />
          <text x={40} y={14} textAnchor="end" fontSize="10" className="fill-muted-foreground font-mono">
            {cm(eMax)}
          </text>
          <text x={40} y={EH - 15} textAnchor="end" fontSize="10" className="fill-muted-foreground font-mono">
            0
          </text>
          <text x={W - 16} y={EH - 3} textAnchor="end" fontSize="10" className="fill-muted-foreground font-mono">
            {Math.round(d.duration)} s
          </text>
          {runs.map((v) => {
            const r = d.runs[v.key]
            if (!r || hidden[v.key]) return null
            const p = r.traj.map((q, i) => `${i ? "L" : "M"}${ex(q[0]).toFixed(1)},${ey(q[3]).toFixed(1)}`).join("")
            return <path key={v.key} d={p} fill="none" stroke={v.color} strokeWidth="1.3" />
          })}
        </svg>

        <div className="mt-3 overflow-x-auto">
          <table className="w-full font-mono text-xs">
            <thead>
              <tr className="text-left text-muted-foreground">
                <th className="py-1 pr-2 font-normal">output</th>
                <th className="py-1 pr-2 font-normal">ATE</th>
                <th className="py-1 pr-2 font-normal">RPE per metre</th>
                <th className="py-1 pr-2 font-normal">wall RMS</th>
                <th className="py-1 font-normal">status</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((v) => {
                const r = d.runs[v.key]
                if (!r) return null
                return (
                  <tr key={v.key} className="border-t">
                    <td className="py-1 pr-2">
                      <button
                        type="button"
                        onClick={() => setHidden((h) => ({ ...h, [v.key]: !h[v.key] }))}
                        aria-pressed={!hidden[v.key]}
                        className={cn("inline-flex cursor-pointer items-center gap-1.5", hidden[v.key] && "opacity-40")}
                      >
                        <span className="inline-block size-2.5 rounded-full" style={{ background: v.color }} />
                        {v.label}
                      </button>
                    </td>
                    <td className="py-1 pr-2">{cm(r.ate)}</td>
                    <td className="py-1 pr-2">{r.rpe}</td>
                    <td className="py-1 pr-2">{r.wall}</td>
                    <td className="py-1">{r.status}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
      <figcaption className="border-t px-3 py-2 font-mono text-xs leading-relaxed text-muted-foreground">{d.caption}</figcaption>
    </figure>
  )
}
