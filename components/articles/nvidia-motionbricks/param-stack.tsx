"use client"

import { useState } from "react"

import { COMPONENTS, FAMILY_LABEL, type Family } from "./data"

// Where the parameters of the released checkpoints sit. Counts are products of
// the tensor shapes in each safetensors header (measured); the fp16 column is
// the same count at two bytes, which is arithmetic, not a file I made.

const TONES = ["oklch(0.62 0.16 35)", "oklch(0.60 0.15 255)", "oklch(0.65 0.13 160)", "oklch(0.70 0.12 85)"]

const fmt = (n: number) => (n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(1)}k` : `${n}`)
const mb = (n: number) => `${(n / 1e6).toFixed(0)} MB`

export function ParamStack() {
  const [fam, setFam] = useState<Family>("g1")
  const [sel, setSel] = useState(1)
  const comps = COMPONENTS[fam]
  const total = comps.reduce((s, c) => s + c.params, 0)
  const bytes = comps.reduce((s, c) => s + c.bytes, 0)
  const c = comps[sel]

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">parameters by block · measured from safetensors headers</span>
        <div className="flex gap-1" role="group" aria-label="Model family">
          {(["g1", "soma"] as Family[]).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFam(f)}
              aria-pressed={fam === f}
              className={`rounded-md border px-2 py-1 font-mono text-xs ${fam === f ? "bg-foreground text-background" : "text-muted-foreground"}`}
            >
              {f === "g1" ? "G1" : "SOMA"}
            </button>
          ))}
        </div>
      </div>
      <div className="space-y-4 p-4">
        <p className="text-sm text-muted-foreground">
          {FAMILY_LABEL[fam]}: {(total / 1e6).toFixed(1)}M parameters in {(bytes / 1e6).toFixed(0)} MB of float32 files. Pick a component.
        </p>
        <div className="flex h-9 w-full overflow-hidden rounded-md border" role="img" aria-label="Share of parameters by component">
          {comps.map((k, i) => (
            <button
              key={k.id}
              type="button"
              onClick={() => setSel(i)}
              aria-pressed={sel === i}
              title={`${k.label}: ${fmt(k.params)}`}
              style={{ width: `${(k.params / total) * 100}%`, background: TONES[i], opacity: sel === i ? 1 : 0.45 }}
              className="h-full border-r border-background/60 text-[11px] font-medium text-white"
            >
              {(k.params / total) * 100 > 12 ? `${((k.params / total) * 100).toFixed(0)}%` : ""}
            </button>
          ))}
        </div>
        <div className="grid gap-2 sm:grid-cols-3">
          {comps.map((k, i) => (
            <button
              key={k.id}
              type="button"
              onClick={() => setSel(i)}
              className={`rounded-lg border px-3 py-2 text-left ${sel === i ? "border-foreground" : ""}`}
            >
              <span className="block text-xs text-muted-foreground">{k.label}</span>
              <span className="block font-mono text-sm">{fmt(k.params)}</span>
              <span className="block font-mono text-[11px] text-muted-foreground">{mb(k.bytes)} fp32 · {mb(k.params * 2)} at fp16</span>
            </button>
          ))}
        </div>
        <div>
          <p className="mb-2 font-mono text-xs text-muted-foreground">inside: {c.label}</p>
          <ul className="space-y-1.5">
            {c.groups.map((g, i) => (
              <li key={g.label} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 text-sm">
                <div>
                  <div className="flex justify-between gap-2">
                    <span>{g.label}</span>
                    <span className="font-mono text-xs text-muted-foreground">
                      {fmt(g.n)} · {((g.n / c.params) * 100).toFixed(1)}%
                    </span>
                  </div>
                  <div className="mt-1 h-2 rounded bg-muted">
                    <div className="h-2 rounded" style={{ width: `${Math.max(0.6, (g.n / c.params) * 100)}%`, background: TONES[i % 4] }} />
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </figure>
  )
}
