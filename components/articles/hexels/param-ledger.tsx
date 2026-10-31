"use client"

// What one primitive stores, in FP32 scalars, and what a memory budget buys.
// Counts: Hexel V1/V2/V3 = 20/29/65 and "the evaluated 2DGS primitive" = 58 come from the paper (Section 3,
// Appendix A, Appendix E.4: 80/116/260 bytes per Hexel). 3DGS = 59 is the standard parameterisation
// (3 position + 3 scale + 4 rotation + 1 opacity + 48 SH), not a number the paper states. 2D rows: the paper
// says constant-colour Hexels with a fixed shared beta match Image-GS's eight stored scalars per primitive;
// linear-colour 2D Hexels add beta (1) and two RGB gradients (6) to centre (2), rotation (1), scales (2),
// colour (3) = 15, which is arithmetic from Appendix D, not a figure the paper prints.

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"

type Seg = { label: string; n: number; color: string }
type Row = { name: string; segs: Seg[]; note?: string }

const POS = "#5b8def"
const SCALE = "#43b97f"
const ROT = "#e0a02f"
const OPA = "#c36ad6"
const SHARP = "#e2605a"
const COL = "#4cc3d9"
const GRAD = "#8a8f98"
const SH = "#a5b0c4"

const ROWS: Row[] = [
  { name: "3DGS", segs: [{ label: "position", n: 3, color: POS }, { label: "scale", n: 3, color: SCALE }, { label: "rotation", n: 4, color: ROT }, { label: "opacity", n: 1, color: OPA }, { label: "SH colour", n: 48, color: SH }] },
  { name: "2DGS (evaluated)", segs: [{ label: "position", n: 3, color: POS }, { label: "scale", n: 2, color: SCALE }, { label: "rotation", n: 4, color: ROT }, { label: "opacity", n: 1, color: OPA }, { label: "SH colour", n: 48, color: SH }] },
  { name: "Hexel V1", segs: [{ label: "position", n: 3, color: POS }, { label: "scale", n: 2, color: SCALE }, { label: "rotation", n: 4, color: ROT }, { label: "opacity", n: 1, color: OPA }, { label: "sharpness β", n: 1, color: SHARP }, { label: "base colour", n: 3, color: COL }, { label: "colour ramp", n: 6, color: GRAD }] },
  { name: "Hexel V2", segs: [{ label: "position", n: 3, color: POS }, { label: "scale", n: 2, color: SCALE }, { label: "rotation", n: 4, color: ROT }, { label: "opacity", n: 1, color: OPA }, { label: "sharpness β", n: 1, color: SHARP }, { label: "base colour", n: 3, color: COL }, { label: "colour ramp", n: 6, color: GRAD }, { label: "view residual", n: 9, color: SH }] },
  { name: "Hexel V3", segs: [{ label: "position", n: 3, color: POS }, { label: "scale", n: 2, color: SCALE }, { label: "rotation", n: 4, color: ROT }, { label: "opacity", n: 1, color: OPA }, { label: "sharpness β", n: 1, color: SHARP }, { label: "base colour", n: 3, color: COL }, { label: "colour ramp", n: 6, color: GRAD }, { label: "SH degree 1-3", n: 45, color: SH }] },
]

const sum = (r: Row) => r.segs.reduce((a, s) => a + s.n, 0)

export function ParamLedger() {
  const [mb, setMb] = useState(60)
  const base = sum(ROWS[1])
  const maxN = Math.max(...ROWS.map(sum))
  const prims = (r: Row) => (mb * 1e6) / (sum(r) * 4)

  return (
    <figure className="not-prose my-8 rounded-xl border border-border bg-card p-4" role="group" aria-label="Scalars stored per primitive and primitives per memory budget">
      <div className="flex flex-col gap-3">
        {ROWS.map((r) => (
          <div key={r.name} className="grid grid-cols-[7.5rem_minmax(0,1fr)_9.5rem] items-center gap-2 text-sm">
            <span className="font-medium">{r.name}</span>
            <div className="flex h-6 overflow-hidden rounded" role="img" aria-label={`${r.name}: ${r.segs.map((s) => `${s.n} ${s.label}`).join(", ")}`}>
              {r.segs.map((s) => (
                <div key={s.label} title={`${s.label}: ${s.n}`} style={{ width: `${(s.n / maxN) * 100}%`, background: s.color }} />
              ))}
            </div>
            <span className="text-right font-mono text-xs">
              {sum(r)} floats · {sum(r) * 4} B
            </span>
          </div>
        ))}
      </div>
      <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        {[["position", POS], ["scale", SCALE], ["rotation", ROT], ["opacity", OPA], ["sharpness β", SHARP], ["base colour", COL], ["colour ramp", GRAD], ["SH / view terms", SH]].map(([l, c]) => (
          <span key={l} className="inline-flex items-center gap-1">
            <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: c }} />
            {l}
          </span>
        ))}
      </div>
      <label className="mt-5 flex flex-col gap-1 text-sm">
        <span>
          Model memory budget = <span className="font-mono">{mb} MB</span> (FP32, no optimizer state)
        </span>
        <Range min={5} max={300} step={5} value={mb} onChange={(e) => setMb(Number(e.target.value))} aria-label="Model memory budget in megabytes" />
      </label>
      <table className="mt-3 w-full text-left text-sm">
        <thead className="text-muted-foreground">
          <tr>
            <th className="py-1 font-normal">at {mb} MB</th>
            <th className="py-1 text-right font-normal">primitives</th>
            <th className="py-1 text-right font-normal">vs 2DGS</th>
          </tr>
        </thead>
        <tbody>
          {ROWS.map((r) => (
            <tr key={r.name} className="border-t border-border">
              <td className="py-1">{r.name}</td>
              <td className="py-1 text-right font-mono">{Math.round(prims(r)).toLocaleString("en-US")}</td>
              <td className="py-1 text-right font-mono">{(base / sum(r)).toFixed(2)}×</td>
            </tr>
          ))}
        </tbody>
      </table>
      <figcaption className="mt-3 text-xs text-muted-foreground">
        Read from the paper: Hexel V1/V2/V3 = 20/29/65 floats (80/116/260 B) and 58 for the evaluated 2DGS primitive. 3DGS = 59 is the standard parameterisation. Primitives per budget is plain division, so the multiplier
        is 58 / 20 = 2.9× for V1 at any budget.
      </figcaption>
    </figure>
  )
}
