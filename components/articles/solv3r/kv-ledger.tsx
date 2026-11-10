"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// The relocalization cache in the paper's Table 2, rebuilt from shapes. A held map view is cached as the keys and
// values of every global-attention layer that will read it: tokens x width x 2 (K and V) x 2 bytes (bf16) x layers.
// Solv3R has ONE global-attention layer, and because its update has no step index the same cache serves every call.
// DejaView's step-conditioned block computes different keys at each of its 16 steps, so a faithful cache keeps 16.
// VGGT has 24 global layers of width 1024 at its own 518-pixel input. The reported column is the paper's.
type Row = {
  id: string
  name: string
  side: number // long side the model resizes to
  width: number
  layers: number
  reported: number // MB per view, paper Table 2
}

const ROWS: Row[] = [
  { id: "solv3r", name: "Solv3R", side: 504, width: 768, layers: 1, reported: 2.86 },
  { id: "deja", name: "DéjàView (all steps)", side: 504, width: 768, layers: 16, reported: 45.8 },
  { id: "vggt", name: "VGGT", side: 518, width: 1024, layers: 24, reported: 97.6 },
]

const SPECIAL = 5 // one camera token + four register tokens per view
const PATCH = 14

const SHAPES = [
  { id: "4:3", label: "640 x 480 (7-Scenes)", ar: 480 / 640 },
  { id: "3:2", label: "3:2 photo", ar: 2 / 3 },
  { id: "1:1", label: "square", ar: 1 },
]

function tokens(side: number, ar: number) {
  const w = Math.round(side / PATCH)
  const h = Math.round((side * ar) / PATCH)
  return { w, h, n: w * h + SPECIAL }
}

export function KvLedger() {
  const [shape, setShape] = useState("4:3")
  const ar = SHAPES.find((s) => s.id === shape)!.ar
  const rows = ROWS.map((r) => {
    const t = tokens(r.side, ar)
    const bytes = t.n * r.width * 2 * 2 * r.layers
    return { ...r, t, mib: bytes / 1048576 }
  })
  const base = rows[0].mib

  return (
    <figure className="my-8 overflow-hidden rounded-xl border">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">cache per held map view · computed from shapes, checked against Table 2</span>
        <div className="flex gap-1">
          {SHAPES.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setShape(s.id)}
              className={cn(
                "rounded border px-2 py-1 font-mono text-[11px] hover:bg-muted",
                shape === s.id && "bg-foreground text-background hover:bg-foreground/90",
              )}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>
      <div className="overflow-x-auto p-4">
        <table className="w-full font-mono text-[11px] tabular-nums">
          <thead className="text-muted-foreground">
            <tr>
              <th className="pb-1 text-left font-normal">model</th>
              <th className="pb-1 text-right font-normal">tokens / view</th>
              <th className="pb-1 text-right font-normal">width</th>
              <th className="pb-1 text-right font-normal">cached layers</th>
              <th className="pb-1 text-right font-normal">MiB / view</th>
              <th className="pb-1 text-right font-normal">paper</th>
              <th className="pb-1 text-right font-normal">vs Solv3R</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t">
                <td className="py-1.5 pr-2">{r.name}</td>
                <td className="text-right">
                  {r.t.w}·{r.t.h}+{SPECIAL} = {r.t.n}
                </td>
                <td className="text-right">{r.width}</td>
                <td className="text-right">{r.layers}</td>
                <td className="text-right font-semibold">{r.mib.toFixed(2)}</td>
                <td className={cn("text-right", shape !== "4:3" && "opacity-40")}>{r.reported}</td>
                <td className="text-right">{(r.mib / base).toFixed(1)}x</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="mt-3 space-y-1">
          {rows.map((r) => (
            <div key={r.id} className="flex items-center gap-2 font-mono text-[11px]">
              <span className="w-40 shrink-0 truncate">{r.name}</span>
              <div className="h-2.5 flex-1 overflow-hidden rounded bg-muted">
                <div
                  className="h-full"
                  style={{
                    width: `${((r.mib / rows[2].mib) * 100).toFixed(1)}%`,
                    background: r.id === "solv3r" ? "oklch(0.60 0.15 255)" : "oklch(0.62 0.16 35)",
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
      <figcaption className="border-t px-4 py-2.5 text-xs leading-relaxed text-muted-foreground">
        Bytes per view = tokens x width x 2 (keys and values) x 2 (bf16) x global-attention layers that read the view.
        At 640 x 480 the three rows land on the paper&apos;s 2.86, 45.8 and 97.6 MB (the paper&apos;s MB are MiB).
        Solv3R&apos;s 16x saving over DéjàView is not compression: one shared block with no step index means one set of
        keys and values is valid at every call. The other Table 2 rows (π³, VGGT-Ω, DA3-L) depend on details I did not
        pin down, so they are left out.
      </figcaption>
    </figure>
  )
}
