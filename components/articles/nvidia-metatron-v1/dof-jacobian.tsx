"use client"

import { useState } from "react"

import { EFFORT, JAC, JOINTS, RAW_MAX, RAW_MIN, SCALE } from "./data"

// 29 x 29 map of how one joint's measured angle moves another joint's raw
// action (synthetic states, central difference), with the per-joint action
// envelope beside it.

export function DofJacobian() {
  const [j, setJ] = useState(7)
  const col = JAC.map((r) => r[j])
  const maxAll = 0.65
  const others = col.map((v, i) => ({ v, i })).filter((o) => o.i !== j)
  const top = others.reduce((a, b) => (b.v > a.v ? b : a))
  const fmt = (n: string) => n.replace("left_", "L ").replace("right_", "R ").replace("_", " ").replace("_", " ")

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        how much each joint reading moves each raw action · synthetic probe, no simulator
      </div>
      <div className="space-y-4 p-4">
        <div className="overflow-x-auto">
          <svg viewBox="0 0 29 29" className="h-auto w-full min-w-[300px] max-w-md" role="img" aria-label="Heat map of absolute Jacobian of raw action against joint position">
            {JAC.map((row, i) =>
              row.map((v, k) => (
                <rect
                  key={`${i}-${k}`}
                  x={k}
                  y={i}
                  width="1"
                  height="1"
                  fill="oklch(0.62 0.16 35)"
                  opacity={Math.min(1, v / maxAll)}
                  stroke={k === j ? "currentColor" : "none"}
                  strokeWidth="0.05"
                  onClick={() => setJ(k)}
                />
              )),
            )}
          </svg>
        </div>
        <label className="flex items-center justify-between gap-3 text-sm">
          <span>input joint (column)</span>
          <select className="rounded-md border bg-background px-2 py-1 font-mono text-xs" value={j} onChange={(e) => setJ(Number(e.target.value))}>
            {JOINTS.map((n, i) => (
              <option key={n} value={i}>
                {i}: {fmt(n)}
              </option>
            ))}
          </select>
        </label>
        <p className="text-sm">
          Moving <strong>{fmt(JOINTS[j])}</strong> by 1 rad changes its own raw action by {col[j].toFixed(2)} and the largest other action by{" "}
          {top.v.toFixed(2)} ({fmt(JOINTS[top.i])}). The map is dense: the mean off-diagonal entry is 0.106 and the mean diagonal 0.242.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[420px] text-left font-mono text-xs">
            <thead className="text-muted-foreground">
              <tr>
                <th className="py-1 font-normal">joint</th>
                <th className="py-1 font-normal">raw range seen</th>
                <th className="py-1 font-normal">scale (rad)</th>
                <th className="py-1 text-right font-normal">effort limit</th>
              </tr>
            </thead>
            <tbody>
              {JOINTS.map((n, i) => (
                <tr key={n} className={`border-t ${i === j ? "bg-muted/40" : ""}`}>
                  <td className="py-0.5">{fmt(n)}</td>
                  <td className="py-0.5">
                    {RAW_MIN[i].toFixed(2)} to {RAW_MAX[i].toFixed(2)}
                  </td>
                  <td className="py-0.5">{SCALE[i].toFixed(3)}</td>
                  <td className="py-0.5 text-right">{EFFORT[i]} Nm</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </figure>
  )
}
