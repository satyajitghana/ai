"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"

// How OpenTakeoff turns a traced ring into square feet, and square feet into
// an order quantity. Every formula below is the repository's own, read at
// commit 9624be8 (2026-10-10):
//
//   web/src/lib/sheets.ts        RENDER_SCALE = 2, so one paper inch is
//                                72 x 2 = 144 image px; a standard scale
//                                1/N" = 1'-0" has upp = N / 144 feet per px
//   mcp/src/session.ts setScale  calibrate: upp = feet / hypot(p2 - p1)
//   web/src/lib/geometry.js      closedMetrics: shoelace area and perimeter
//                                in px; shapeMetrics.js scales them by
//                                upp^2 and upp
//   web/src/lib/totals.js        conditionTotals: multiplier first, then
//                                waste (w = 1 + waste/100) on the ordered
//                                figure, SY = ordered / 9, and a materials
//                                row = ceil(basis / coverage) on the
//                                multiplied but UN-wasted total
//
// The sheet is a made-up L-shaped room drawn at 1/8" = 1'-0". Its corners
// sit on whole feet, so the walls are axis-aligned and every length is a sum
// of absolute differences: no Math.hypot or trig reaches the DOM, and server
// and client render the same numbers.

const PX_PER_IN = 144 // 72 pt per paper inch x RENDER_SCALE 2
const TRUE_IN_PER_FT = 1 / 8

// Room corners in real feet, clockwise from the top-left.
const ROOM_FT: [number, number][] = [
  [0, 0],
  [24, 0],
  [24, 10],
  [16, 10],
  [16, 16],
  [0, 16],
]
// Drawn on the sheet at the true scale: 1/8 inch per foot = 18 px per foot.
const PX_PER_FT = PX_PER_IN * TRUE_IN_PER_FT
const RING_PX: [number, number][] = ROOM_FT.map(([x, y]) => [x * PX_PER_FT, y * PX_PER_FT])

// closedMetrics, verbatim in arithmetic (abs of the shoelace sum / 2).
function shoelace(pts: [number, number][]): number {
  let a = 0
  for (let i = 0; i < pts.length; i++) {
    const [x1, y1] = pts[i]
    const [x2, y2] = pts[(i + 1) % pts.length]
    a += x1 * y2 - x2 * y1
  }
  return Math.abs(a) / 2
}
function perimeterAxis(pts: [number, number][]): number {
  let p = 0
  for (let i = 0; i < pts.length; i++) {
    const [x1, y1] = pts[i]
    const [x2, y2] = pts[(i + 1) % pts.length]
    p += Math.abs(x2 - x1) + Math.abs(y2 - y1)
  }
  return p
}

const AREA_PX = shoelace(RING_PX) // 108,864 px^2
const PERIM_PX = perimeterAxis(RING_PX) // 1,440 px
const TRUE_SF = shoelace(ROOM_FT) // 336 SF

// A slice of STANDARD_SCALES (sheets.ts), labels exactly as the engine prints them.
const SCALES: { label: string; inPerFt: number }[] = [
  { label: '1/16" = 1\'-0"', inPerFt: 1 / 16 },
  { label: '3/32" = 1\'-0"', inPerFt: 3 / 32 },
  { label: '1/8" = 1\'-0"', inPerFt: 1 / 8 },
  { label: '3/16" = 1\'-0"', inPerFt: 3 / 16 },
  { label: '1/4" = 1\'-0"', inPerFt: 1 / 4 },
]
const uppOf = (inPerFt: number) => 1 / inPerFt / PX_PER_IN

// The 24'-0" dimension string along the top wall: 432 px on the sheet.
const DIM_PX = 24 * PX_PER_FT
const COVERAGE_SF_PER_GAL = 150 // illustrative adhesive coverage, not a product figure

type Mode = { kind: "none" } | { kind: "label"; i: number } | { kind: "calibrate" }

function fmt(n: number, d = 2): string {
  return n.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d })
}

function feetInches(ft: number): string {
  const whole = Math.floor(ft)
  const inch = Math.round((ft - whole) * 12)
  return `${whole}'-${inch}"`
}

export function ScaleTakeoff() {
  const [mode, setMode] = useState<Mode>({ kind: "none" })
  const [calFeet, setCalFeet] = useState(24.5)
  const [waste, setWaste] = useState(10)
  const [mult, setMult] = useState(1)

  const upp =
    mode.kind === "label"
      ? uppOf(SCALES[mode.i].inPerFt)
      : mode.kind === "calibrate"
        ? calFeet / DIM_PX
        : null

  const areaSf = upp == null ? null : +(AREA_PX * upp * upp).toFixed(2)
  const perimLf = upp == null ? null : +(PERIM_PX * upp).toFixed(2)
  const err = areaSf == null ? null : ((areaSf - TRUE_SF) / TRUE_SF) * 100

  const base = areaSf == null ? 0 : areaSf * mult
  const w = 1 + waste / 100
  const ordered = base * w
  const sy = ordered / 9
  const gal = Math.ceil(base / COVERAGE_SF_PER_GAL - 1e-9)

  // Sheet geometry (image px, plus a margin for the dimension string).
  const M = 40
  const VW = 24 * PX_PER_FT + 2 * M
  const VH = 16 * PX_PER_FT + 2 * M + 10
  const ringPath = RING_PX.map(([x, y], i) => `${i ? "L" : "M"}${x + M},${y + M + 10}`).join(" ") + " Z"
  const scaled = upp != null
  const off = err != null && Math.abs(err) > 0.5

  return (
    <figure className="my-8 rounded-md border bg-muted/20 p-4">
      <div className="flex flex-wrap items-center gap-1.5 font-mono text-[11px]">
        <span className="text-muted-foreground">set_scale</span>
        <button
          type="button"
          onClick={() => setMode({ kind: "none" })}
          aria-pressed={mode.kind === "none"}
          className={
            "rounded border px-2 py-0.5 transition-colors " +
            (mode.kind === "none" ? "border-foreground bg-foreground text-background" : "border-border hover:bg-muted")
          }
        >
          not set
        </button>
        {SCALES.map((s, i) => {
          const on = mode.kind === "label" && mode.i === i
          return (
            <button
              key={s.label}
              type="button"
              onClick={() => setMode({ kind: "label", i })}
              aria-pressed={on}
              className={
                "rounded border px-2 py-0.5 transition-colors " +
                (on ? "border-foreground bg-foreground text-background" : "border-border hover:bg-muted")
              }
            >
              {s.label}
            </button>
          )
        })}
        <button
          type="button"
          onClick={() => setMode({ kind: "calibrate" })}
          aria-pressed={mode.kind === "calibrate"}
          className={
            "rounded border px-2 py-0.5 transition-colors " +
            (mode.kind === "calibrate" ? "border-foreground bg-foreground text-background" : "border-border hover:bg-muted")
          }
        >
          calibrate
        </button>
      </div>

      <svg
        viewBox={`0 0 ${VW} ${VH}`}
        className="mt-3 w-full max-w-[560px]"
        role="img"
        aria-label="An L-shaped room traced on a plan sheet drawn at one eighth inch to the foot, with a twenty-four foot dimension string along its top wall."
      >
        <rect x={0} y={0} width={VW} height={VH} className="fill-background" />
        {/* dimension string along the top wall */}
        <line x1={M} x2={M + DIM_PX} y1={M - 8} y2={M - 8} className="stroke-muted-foreground" strokeWidth={1.5} />
        <line x1={M} x2={M} y1={M - 16} y2={M} className="stroke-muted-foreground" strokeWidth={1.5} />
        <line x1={M + DIM_PX} x2={M + DIM_PX} y1={M - 16} y2={M} className="stroke-muted-foreground" strokeWidth={1.5} />
        <text x={M + DIM_PX / 2} y={M - 14} textAnchor="middle" fontSize={16} fontFamily="monospace" className="fill-muted-foreground">
          24&apos;-0&quot;
        </text>
        {mode.kind === "calibrate" && (
          <g>
            <circle cx={M} cy={M - 8} r={6} fill="#ef4444" />
            <circle cx={M + DIM_PX} cy={M - 8} r={6} fill="#ef4444" />
          </g>
        )}
        <path
          d={ringPath}
          fill={scaled ? (off ? "#f59e0b" : "#3b82f6") : "none"}
          fillOpacity={0.18}
          stroke={scaled ? (off ? "#f59e0b" : "#3b82f6") : "currentColor"}
          strokeWidth={3}
          strokeDasharray={scaled ? undefined : "10 8"}
          className={scaled ? undefined : "text-muted-foreground"}
        />
        {RING_PX.map(([x, y], i) => (
          <circle key={i} cx={x + M} cy={y + M + 10} r={5} className="fill-foreground" />
        ))}
        <text x={M + 8 * PX_PER_FT} y={M + 10 + 8 * PX_PER_FT} textAnchor="middle" fontSize={20} fontFamily="monospace" className="fill-foreground">
          {areaSf == null ? "px only" : `${fmt(areaSf, 1)} SF`}
        </text>
      </svg>

      {mode.kind === "calibrate" && (
        <label className="mt-2 block font-mono text-[11px]">
          <span className="text-muted-foreground">two clicks on the dimension ends, {DIM_PX} px apart; you type</span>{" "}
          {feetInches(calFeet)} ({fmt(calFeet, 2)} ft)
          <Range
            min={22}
            max={26}
            step={0.25}
            value={calFeet}
            onChange={(ev) => setCalFeet(Number(ev.target.value))}
            aria-label="Feet typed for the calibration dimension"
            className="mt-1 w-full"
            accent="#ef4444"
          />
        </label>
      )}

      <div className="mt-3 grid gap-3 font-mono text-[11px] sm:grid-cols-2">
        <div className="rounded border bg-background/60 p-2">
          <div className="text-muted-foreground">measure_polygon</div>
          {upp == null ? (
            <div className="mt-1 text-amber-600 dark:text-amber-400">
              refused: Set the scale for plan.pdf first — use set_scale (detected: 1/8&quot; = 1&apos;-0&quot;).
            </div>
          ) : (
            <div className="mt-1 space-y-0.5">
              <div>shoelace area = {AREA_PX.toLocaleString("en-US")} px²</div>
              <div>perimeter = {PERIM_PX.toLocaleString("en-US")} px</div>
              <div>upp = {upp.toFixed(5)} ft/px</div>
              <div>
                area_sf = px² × upp² = <b>{fmt(areaSf ?? 0, 2)}</b>
              </div>
              <div>perimeter_lf = px × upp = {fmt(perimLf ?? 0, 2)}</div>
              <div className={off ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground"}>
                vs the room as drawn ({TRUE_SF} SF): {err != null && err >= 0 ? "+" : ""}
                {fmt(err ?? 0, 1)}%
              </div>
            </div>
          )}
        </div>

        <div className="rounded border bg-background/60 p-2">
          <div className="text-muted-foreground">conditionTotals (one condition, this room)</div>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <span className="text-muted-foreground">×N</span>
            {[1, 2, 3, 4].map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMult(m)}
                aria-pressed={m === mult}
                className={
                  "rounded border px-1.5 py-0.5 transition-colors " +
                  (m === mult ? "border-foreground bg-foreground text-background" : "border-border hover:bg-muted")
                }
              >
                {m}
              </button>
            ))}
          </div>
          <label className="mt-1 block">
            <span className="text-muted-foreground">waste_pct</span> {waste}%
            <Range
              min={0}
              max={15}
              step={1}
              value={waste}
              onChange={(ev) => setWaste(Number(ev.target.value))}
              aria-label="Waste percent"
              className="mt-1 w-full"
            />
          </label>
          {upp == null ? (
            <div className="mt-1 text-muted-foreground">nothing to total until the sheet has a scale</div>
          ) : (
            <div className="mt-1 space-y-0.5">
              <div>floor_sf (× N) = {fmt(base, 2)}</div>
              <div>
                floor_sf_net = × {w.toFixed(2)} = <b>{fmt(ordered, 2)}</b>
              </div>
              <div>sy_net = ÷ 9 = {fmt(sy, 2)}</div>
              <div>
                adhesive @ {COVERAGE_SF_PER_GAL} SF/gal = ceil({fmt(base, 2)} ÷ {COVERAGE_SF_PER_GAL}) = {gal} gal
              </div>
              <div className="text-muted-foreground">the materials row divides the un-wasted SF</div>
            </div>
          )}
        </div>
      </div>

      <figcaption className="mt-3 text-xs text-muted-foreground">
        A made-up L-shaped room drawn at 1/8&quot; = 1&apos;-0&quot;, measured the way OpenTakeoff measures: a ring
        in image px (PDF points × 2), a scale in feet per px, area as the shoelace sum times the scale squared, then
        the condition&apos;s multiplier and waste. Pick the wrong standard scale and the area moves by the square of
        the ratio; calibrate on the 24&apos;-0&quot; dimension with a typo and a 2% length error becomes a 4% area
        error. The 150 SF/gal coverage is illustrative, not a product figure.
      </figcaption>
    </figure>
  )
}
