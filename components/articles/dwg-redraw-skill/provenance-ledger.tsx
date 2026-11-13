"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { cn } from "@/lib/utils"

// The evidence ledger of autocad-image-redraw (references/image-redraw-spec.md), on a small plan.
// Every dimension carries one of the spec's four evidence levels:
//   known       readable on the sketch (6000 overall, 2400 right bay, the column's 400 diameter)
//   scaled      measured in pixels and converted by one calibration anchor (depth, wall position)
//   inferred    judgement, not measured (a 900 door leaf, the usual size)
//   unreadable  visible but illegible (the window's smudged label); its scaled estimate goes on
//               an ASSUMPTION layer, the text stays [UNREADABLE]
// The anchor is a known length whose two endpoints the agent picks in the image. An endpoint
// error of e pixels changes the scale to anchorMM / (anchorPx + e) mm per pixel, and every scaled
// value moves with it; known and inferred values do not. The chain check is the validator's
// "sum" constraint with a 1 mm tolerance, the example file's own: wall position + right bay = overall.
// The "as drawn" view is what draw_image_spec.py writes: it never reads evidence_level, so every
// dimension becomes the same rotated dimension on layer DIM.
// The true sketch is 0.15 px per mm, so the 6000 mm wall spans 900 px and the column 60 px.
// Arithmetic is + - * / only.

type Ev = "known" | "scaled" | "inferred" | "unreadable"

const EV: Record<Ev, { label: string; tone: string; rule: string }> = {
  known: { label: "known", tone: "oklch(0.55 0.15 255)", rule: "read off the sketch" },
  scaled: { label: "scaled", tone: "oklch(0.58 0.14 150)", rule: "pixels times the anchor's scale" },
  inferred: { label: "inferred", tone: "oklch(0.66 0.15 65)", rule: "judgement: a standard door" },
  unreadable: { label: "unreadable", tone: "oklch(0.58 0.18 25)", rule: "estimate kept on ASSUMPTION" },
}

const PX_PER_MM = 0.15
const ANCHORS = [
  { id: "overall", label: "overall width, 6000 mm", mm: 6000, px: 900 },
  { id: "column", label: "column, 400 mm", mm: 400, px: 60 },
]

type Dim = { id: string; label: string; ev: Ev; truth: number }
const DIMS: Dim[] = [
  { id: "W", label: "overall width", ev: "known", truth: 6000 },
  { id: "R", label: "right bay", ev: "known", truth: 2400 },
  { id: "C", label: "column diameter", ev: "known", truth: 400 },
  { id: "D", label: "depth", ev: "scaled", truth: 4200 },
  { id: "X", label: "wall position", ev: "scaled", truth: 3600 },
  { id: "G", label: "door leaf", ev: "inferred", truth: 900 },
  { id: "N", label: "window", ev: "unreadable", truth: 1500 },
]

const fmt = (v: number) => v.toLocaleString("en-US", { maximumFractionDigits: 0 })
const sgn = (v: number) => (v > 0.5 ? "+" : v < -0.5 ? "−" : "±") + fmt(Math.abs(v))

export function ProvenanceLedger() {
  const [anchor, setAnchor] = useState(0)
  const [err, setErr] = useState(4)
  const [drawn, setDrawn] = useState(false)
  const a = ANCHORS[anchor]
  const mmPerPx = a.mm / (a.px + err)

  const value = (d: Dim) => (d.ev === "scaled" || d.ev === "unreadable" ? d.truth * PX_PER_MM * mmPerPx : d.truth)
  const V = Object.fromEntries(DIMS.map((d) => [d.id, value(d)])) as Record<string, number>
  const chain = V.X + V.R
  const chainOk = Math.abs(chain - V.W) <= 1

  // plan drawing, 0.08 svg units per mm
  const D = V.D
  const dTop = Math.max(4300, D + 150)
  const S = Math.min(0.08, 340 / dTop)
  const X0 = 70
  const Y0 = 62
  const px = (x: number) => X0 + x * S
  const py = (y: number) => Y0 + (dTop - y) * S
  const ink = (ev: Ev) => (drawn ? "currentColor" : EV[ev].tone)
  const XW = V.X
  const doorY0 = (1500 / 4200) * D
  const doorY1 = doorY0 + 900

  const dimH = (x0: number, x1: number, y: number, text: string, ev: Ev) => (
    <g style={{ color: ink(ev) }}>
      <line x1={px(x0)} x2={px(x1)} y1={y} y2={y} stroke="currentColor" strokeWidth={1.2} />
      <line x1={px(x0)} x2={px(x0)} y1={y - 5} y2={y + 5} stroke="currentColor" strokeWidth={1.2} />
      <line x1={px(x1)} x2={px(x1)} y1={y - 5} y2={y + 5} stroke="currentColor" strokeWidth={1.2} />
      <text x={(px(x0) + px(x1)) / 2} y={y - 6} textAnchor="middle" fontSize={12} fill="currentColor" className="font-mono">
        {text}
      </text>
    </g>
  )

  const shown = (d: Dim) => (d.ev === "unreadable" ? "[UNREADABLE]" : fmt(V[d.id]))

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/20 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>a dimension ledger, and one bad click on the anchor</span>
        <span className="text-muted-foreground/60">illustrative plan; rules from the spec</span>
      </div>
      <div className="p-4 sm:p-5">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 font-mono text-[11px] text-muted-foreground">calibrate on</span>
          {ANCHORS.map((x, k) => (
            <button
              key={x.id}
              type="button"
              aria-pressed={anchor === k}
              onClick={() => setAnchor(k)}
              className={cn(
                "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
                anchor === k ? "border-foreground/30 bg-muted/50 text-foreground" : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {`${x.label} (${x.px} px)`}
            </button>
          ))}
        </div>
        <label className="mt-3 block font-mono text-[11px] text-muted-foreground">
          <span className="flex justify-between">
            <span>anchor endpoint error</span>
            <span className="text-foreground">{`${err > 0 ? "+" : ""}${err} px on a ${a.px} px span`}</span>
          </span>
          <Range
            aria-label="Anchor endpoint error in pixels"
            min={-12}
            max={12}
            step={1}
            value={err}
            onChange={(e) => setErr(Number(e.target.value))}
            className="mt-1 w-full"
          />
        </label>
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <span className="mr-1 font-mono text-[11px] text-muted-foreground">view</span>
          {[
            { v: false, label: "the spec's ledger" },
            { v: true, label: "the DWG as drawn" },
          ].map((o) => (
            <button
              key={o.label}
              type="button"
              aria-pressed={drawn === o.v}
              onClick={() => setDrawn(o.v)}
              className={cn(
                "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
                drawn === o.v ? "border-foreground/30 bg-muted/50 text-foreground" : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {o.label}
            </button>
          ))}
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
          <svg viewBox="0 0 640 470" className="w-full text-foreground" role="img" aria-label="A floor plan with each dimension coloured by its evidence level">
            {/* the truth, dashed */}
            <g stroke="currentColor" strokeOpacity={0.25} strokeDasharray="4 4" fill="none" strokeWidth={1}>
              <rect x={px(0)} y={py(4200)} width={6000 * S} height={4200 * S} />
              <line x1={px(3600)} x2={px(3600)} y1={py(0)} y2={py(4200)} />
            </g>
            {/* the redraw */}
            <g stroke="currentColor" fill="none" strokeWidth={2.2}>
              <polyline points={`${px(0)},${py(0)} ${px(6000)},${py(0)} ${px(6000)},${py(D)} ${px(0)},${py(D)} ${px(0)},${py(0)}`} />
              <line x1={px(XW)} x2={px(XW)} y1={py(0)} y2={py(doorY0)} />
              <line x1={px(XW)} x2={px(XW)} y1={py(doorY1)} y2={py(D)} />
            </g>
            <g style={{ color: ink("inferred") }} fill="none" stroke="currentColor" strokeWidth={1.6}>
              <line x1={px(XW)} x2={px(XW - 900)} y1={py(doorY0)} y2={py(doorY0)} />
              <path d={`M ${px(XW - 900)} ${py(doorY0)} A ${900 * S} ${900 * S} 0 0 1 ${px(XW)} ${py(doorY1)}`} />
            </g>
            <g style={{ color: ink("unreadable") }} fill="none" stroke="currentColor" strokeWidth={1.6} strokeDasharray={drawn ? undefined : "5 3"}>
              <rect x={px(1200)} y={py(D + 100)} width={V.N * S} height={200 * S} />
            </g>
            <circle cx={px(5200)} cy={py(800)} r={200 * S} fill="none" stroke={ink("known")} strokeWidth={1.8} />

            {dimH(0, 6000, py(0) + 34, shown(DIMS[0]), "known")}
            {dimH(0, XW, 30, shown(DIMS[4]), "scaled")}
            {dimH(XW, 6000, 30, shown(DIMS[1]), "known")}
            <g style={{ color: ink("scaled") }}>
              <line x1={X0 - 30} x2={X0 - 30} y1={py(0)} y2={py(D)} stroke="currentColor" strokeWidth={1.2} />
              <text
                x={X0 - 36}
                y={(py(0) + py(D)) / 2}
                textAnchor="middle"
                fontSize={12}
                fill="currentColor"
                className="font-mono"
                transform={`rotate(-90 ${X0 - 36} ${(py(0) + py(D)) / 2})`}
              >
                {shown(DIMS[3])}
              </text>
            </g>
            <text x={px(1200) + 4} y={py(D + 100) + 30} fontSize={11} fill={ink("unreadable")} className="font-mono">
              window [UNREADABLE]
            </text>
            <text x={px(XW - 900)} y={py(doorY0) + 16} fontSize={11} fill={ink("inferred")} className="font-mono">
              {`door ${fmt(V.G)}`}
            </text>
            <text x={px(5200)} y={py(800) + 32} textAnchor="middle" fontSize={11} fill={ink("known")} className="font-mono">
              {`Ø${fmt(V.C)}`}
            </text>
          </svg>

          <div className="font-mono text-[11px]">
            <table className="w-full border-collapse">
              <thead>
                <tr className="text-left text-muted-foreground">
                  <th className="pb-1 font-normal">dimension</th>
                  <th className="pb-1 font-normal">evidence</th>
                  <th className="pb-1 text-right font-normal">spec, mm</th>
                  <th className="pb-1 text-right font-normal">off by</th>
                </tr>
              </thead>
              <tbody>
                {DIMS.map((d) => (
                  <tr key={d.id} className="border-t border-border/60">
                    <td className="py-1 pr-2">{d.label}</td>
                    <td className="py-1 pr-2" style={{ color: drawn ? undefined : EV[d.ev].tone }}>
                      {drawn ? "(dropped)" : EV[d.ev].label}
                    </td>
                    <td className="py-1 text-right">{d.ev === "unreadable" ? `≈${fmt(V[d.id])}` : fmt(V[d.id])}</td>
                    <td className="py-1 text-right text-muted-foreground">{sgn(V[d.id] - d.truth)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className={cn("mt-3 rounded-md border px-3 py-2", chainOk ? "border-border" : "border-red-500/50 bg-red-500/5")}>
              <div className="text-muted-foreground">{`chain check: wall position + right bay = overall, ±1 mm`}</div>
              <div className="mt-0.5 text-foreground">{`${fmt(V.X)} + ${fmt(V.R)} = ${fmt(chain)} vs ${fmt(V.W)}: ${chainOk ? "pass" : "fail"}`}</div>
              {!chainOk && (
                <div className="mt-1 text-muted-foreground">
                  A scaled value disagrees with two known ones. The spec&apos;s authority order puts a derived exact value (6,000 − 2,400) above a calibrated
                  measurement, so the wall goes at 3,600 and the conflict is reported, not hidden.
                </div>
              )}
            </div>
            <p className="mt-3 leading-relaxed text-muted-foreground">
              {drawn
                ? "draw_image_spec.py never reads evidence_level. In the DWG every dimension is the same object on layer DIM; the ledger lives only in the JSON beside it."
                : `${EV.scaled.rule} moves with the anchor; ${EV.known.rule} and ${EV.inferred.rule} do not. A short anchor turns the same click error into a bigger scale error.`}
            </p>
          </div>
        </div>
      </div>
    </figure>
  )
}
