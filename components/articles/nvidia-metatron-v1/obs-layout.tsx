"use client"

import { useState } from "react"

import { INPUTS, type Group } from "./data"

// The 39 inputs of demo/model.onnx, sized by element count (read from the graph)
// and tagged with the output change measured when that input alone is perturbed
// (probe.py, synthetic states, no simulator).

const GROUPS: { id: Group; label: string; note: string; color: string }[] = [
  { id: "state", label: "State now", note: "joint angles and speeds, body rotation, angular velocity", color: "oklch(0.62 0.16 35)" },
  { id: "history", label: "History", note: "eight past states and nine past raw actions", color: "oklch(0.60 0.15 255)" },
  { id: "velocity", label: "Velocity command", note: "a planar speed and its mask", color: "oklch(0.62 0.15 150)" },
  { id: "goals", label: "Pose goals", note: "five future frames of 33 bodies, plus masks", color: "oklch(0.60 0.16 310)" },
  { id: "style", label: "Style samples", note: "225 pose and 150 velocity numbers, plus masks", color: "oklch(0.65 0.13 85)" },
  { id: "scene", label: "Scene boxes", note: "up to two boxes: centres, extents, validity", color: "oklch(0.58 0.05 240)" },
]

export function ObsLayout() {
  const [g, setG] = useState<Group>("state")
  const total = INPUTS.reduce((s, i) => s + i.count, 0)
  const info = GROUPS.find((x) => x.id === g)!
  const rows = INPUTS.filter((i) => i.group === g)
  const gcount = rows.reduce((s, i) => s + i.count, 0)

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        the 39 input tensors · {total.toLocaleString("en-US")} numbers per control step (read from the graph)
      </div>
      <div className="space-y-4 p-4">
        <div className="flex h-8 w-full overflow-hidden rounded-md border" role="img" aria-label="Share of the 4,002 input numbers by group">
          {GROUPS.map((x) => {
            const c = INPUTS.filter((i) => i.group === x.id).reduce((s, i) => s + i.count, 0)
            return (
              <button
                key={x.id}
                type="button"
                onClick={() => setG(x.id)}
                aria-pressed={g === x.id}
                title={`${x.label}: ${c}`}
                style={{ width: `${(c / total) * 100}%`, minWidth: 4, background: x.color, opacity: g === x.id ? 1 : 0.4 }}
              />
            )
          })}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {GROUPS.map((x) => (
            <button
              key={x.id}
              type="button"
              onClick={() => setG(x.id)}
              aria-pressed={g === x.id}
              className={`rounded-md border px-2 py-1 text-xs ${g === x.id ? "bg-foreground text-background" : "text-muted-foreground"}`}
            >
              {x.label}
            </button>
          ))}
        </div>
        <p className="text-sm">
          <strong>{info.label}</strong>: {info.note}. {gcount.toLocaleString("en-US")} numbers ({((gcount / total) * 100).toFixed(1)}% of the input).
        </p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[460px] text-left font-mono text-xs">
            <thead className="text-muted-foreground">
              <tr>
                <th className="py-1 pr-2 font-normal">tensor</th>
                <th className="py-1 pr-2 font-normal">shape</th>
                <th className="py-1 text-right font-normal">output change per unit input</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.name} className="border-t">
                  <td className="py-1 pr-2">{r.name.replace("masked_mimic_", "mm_")}</td>
                  <td className="py-1 pr-2">{r.shape.join("x")}</td>
                  <td className="py-1 text-right">{r.mask ? "mask" : r.gain === null ? "n/a" : r.gain === 0 ? "0 (masked off or unused)" : r.gain.toFixed(3)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-muted-foreground">
          Gain is the L2 change of the 29 raw actions for a random-direction perturbation of norm 0.05 in that tensor, divided by 0.05, mean of 4 synthetic states with goals and scene masked off. Zero here means that mask was off, not that the tensor is useless.
        </p>
      </div>
    </figure>
  )
}
