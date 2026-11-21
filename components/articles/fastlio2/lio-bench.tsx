"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"
import { BENCH, SYSTEMS, type SeqKey } from "@/components/articles/fastlio2/bench-data"

// The benchmark, explorable. Every trajectory here is a system's output after the
// same scoring step: moved into the reference's frame, interpolated against the
// reference at the system's own timestamps, and aligned with one SE(3) Umeyama fit
// (no scale). Top-down view, one sample per second; below it, the position error of
// each system over time, and the numbers from the same run.

const W = 640
const H = 360

export function LioBench() {
  const [seq, setSeq] = useState<SeqKey>(Object.keys(BENCH)[0] as SeqKey)
  const [hidden, setHidden] = useState<Record<string, boolean>>({})
  const d = BENCH[seq]
  const runs = SYSTEMS.filter((s) => d.results[s.key])

  // bounds over the reference and every shown trajectory
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
  for (const s of runs) {
    const r = d.results[s.key]
    if (!r || hidden[s.key] || r.status !== "ok") continue
    for (const p of r.traj) grow(p[1], p[2])
  }
  const pad = 24
  const span = Math.max(x1 - x0, (y1 - y0) * (W / H), 1)
  const scale = (W - 2 * pad) / span
  const cx = (x0 + x1) / 2
  const cy = (y0 + y1) / 2
  const X = (x: number) => W / 2 + (x - cx) * scale
  const Y = (y: number) => H / 2 - (y - cy) * scale
  const path = (pts: number[][]) => pts.map((p, i) => `${i ? "L" : "M"}${X(p[1]).toFixed(1)},${Y(p[2]).toFixed(1)}`).join("")

  // error over time
  const EH = 120
  const tMax = d.duration
  let eMax = 0.05
  for (const s of runs) {
    const r = d.results[s.key]
    if (!r || hidden[s.key] || r.status !== "ok") continue
    for (const p of r.traj) eMax = Math.max(eMax, p[4])
  }
  const ex = (t: number) => 40 + (t / tMax) * (W - 56)
  const ey = (e: number) => EH - 18 - (e / eMax) * (EH - 30)
  let barM = 1000
  while (barM > span / 4 && barM > 0.01) barM /= 10
  const bar = span / 4 >= 5 * barM ? 5 * barM : span / 4 >= 2 * barM ? 2 * barM : barM

  return (
    <figure className="my-8 overflow-hidden rounded-md border">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-3 py-2 font-mono text-xs">
        <span className="text-muted-foreground">four LIO systems against ground truth</span>
        <div className="flex gap-1">
          {(Object.keys(BENCH) as SeqKey[]).map((k) => (
            <button key={k} type="button" onClick={() => setSeq(k)} aria-pressed={seq === k}
              className={cn("cursor-pointer rounded px-2 py-1 transition-colors", seq === k ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground")}>
              {BENCH[k].short}
            </button>
          ))}
        </div>
      </div>

      <div className="p-4">
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Top-down trajectories on ${d.label}: the reference in grey and each system's aligned estimate in colour.`} className="w-full rounded-md border bg-muted/20">
          <path d={path(d.ref)} fill="none" stroke="var(--muted-foreground)" strokeWidth="5" opacity="0.25" strokeLinejoin="round" />
          {runs.map((s) => {
            const r = d.results[s.key]
            if (!r || hidden[s.key] || r.status !== "ok" || r.traj.length < 2) return null
            return <path key={s.key} d={path(r.traj)} fill="none" stroke={s.color} strokeWidth="1.4" strokeLinejoin="round" />
          })}
          <line x1={pad} y1={H - 12} x2={pad + bar * scale} y2={H - 12} stroke="var(--foreground)" strokeWidth="1.5" />
          <text x={pad} y={H - 17} className="font-mono" fontSize="9" fill="var(--foreground)">{bar} m</text>
          <text x={W - pad} y={H - 12} textAnchor="end" className="font-mono" fontSize="9" fill="var(--muted-foreground)">reference: {d.refName}</text>
        </svg>

        <svg viewBox={`0 0 ${W} ${EH}`} role="img" aria-label="Position error after alignment, per system, over the sequence." className="mt-2 w-full">
          <line x1={40} y1={ey(0)} x2={W - 16} y2={ey(0)} stroke="var(--border)" />
          <text x={36} y={ey(eMax) + 3} textAnchor="end" className="font-mono" fontSize="8" fill="var(--muted-foreground)">{eMax.toFixed(2)} m</text>
          <text x={36} y={ey(0) + 3} textAnchor="end" className="font-mono" fontSize="8" fill="var(--muted-foreground)">0</text>
          <text x={W - 16} y={EH - 4} textAnchor="end" className="font-mono" fontSize="8" fill="var(--muted-foreground)">{tMax.toFixed(0)} s</text>
          <text x={40} y={EH - 4} className="font-mono" fontSize="8" fill="var(--muted-foreground)">error after alignment</text>
          {runs.map((s) => {
            const r = d.results[s.key]
            if (!r || hidden[s.key] || r.status !== "ok" || r.traj.length < 2) return null
            return <path key={s.key} d={r.traj.map((p, i) => `${i ? "L" : "M"}${ex(p[0]).toFixed(1)},${ey(p[4]).toFixed(1)}`).join("")} fill="none" stroke={s.color} strokeWidth="1.2" />
          })}
        </svg>

        <div className="mt-3 overflow-x-auto">
          <table className="w-full border-collapse font-mono text-xs">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="py-1 pr-2 font-normal">system</th>
                <th className="py-1 pr-2 text-right font-normal">ATE RMSE</th>
                <th className="py-1 pr-2 text-right font-normal">RPE / 1 m</th>
                <th className="py-1 pr-2 text-right font-normal">ms / scan</th>
                <th className="py-1 pr-2 text-right font-normal">p95</th>
                <th className="py-1 pr-2 text-right font-normal">peak RSS</th>
                <th className="py-1 text-right font-normal">covered</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((s) => {
                const r = d.results[s.key]
                if (!r) return null
                const ok = r.status === "ok"
                return (
                  <tr key={s.key} className={cn("border-b", hidden[s.key] && "opacity-40")}>
                    <td className="py-1 pr-2">
                      <button type="button" onClick={() => setHidden((h) => ({ ...h, [s.key]: !h[s.key] }))} className="flex cursor-pointer items-center gap-2 text-left" aria-pressed={!hidden[s.key]}>
                        <span className="inline-block h-2 w-3 rounded-sm" style={{ background: s.color }} />
                        {s.label}
                      </button>
                    </td>
                    {ok ? (
                      <>
                        <td className="py-1 pr-2 text-right tabular-nums">{fmtM(r.ate)}</td>
                        <td className="py-1 pr-2 text-right tabular-nums">{fmtM(r.rpeT)} · {r.rpeR.toFixed(2)}°</td>
                        <td className="py-1 pr-2 text-right tabular-nums">{r.msMean === null ? "–" : r.msMean.toFixed(1)}</td>
                        <td className="py-1 pr-2 text-right tabular-nums">{r.msP95 === null ? "–" : r.msP95.toFixed(1)}</td>
                        <td className="py-1 pr-2 text-right tabular-nums">{r.rssMb === null ? "–" : `${r.rssMb} MB`}</td>
                        <td className="py-1 text-right tabular-nums">{(r.coverage * 100).toFixed(0)}%</td>
                      </>
                    ) : (
                      <td colSpan={6} className="py-1 text-muted-foreground">{r.note}</td>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs leading-5 text-muted-foreground">{d.note}</p>
      </div>
    </figure>
  )
}

function fmtM(v: number) {
  return v < 1 ? `${(v * 100).toFixed(1)} cm` : `${v.toFixed(2)} m`
}
