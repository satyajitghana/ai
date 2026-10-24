"use client"

// The sam3-segmentation skill's crop plan, live. Pick a photo size and the
// pass settings; the widget tiles the image exactly as the skill's planner
// does (port in ./plan.ts, checked against `segment.py plan`), counts the
// model requests, the grid-point prompts and the upper bound on raw candidates,
// and runs the same budget check the skill runs before it loads weights.
//
// It also applies the skill's own rule of thumb from references/direct-sam.md:
// a typical object should be about a sixth of the view's width or more, or
// SAM 3's text prompt finds nothing. That rule is the publisher's, from one
// corn photo; it is shown as a guide, not a law.

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"

import { DEFAULT_BUDGET, HERO_BUDGET, plan, type Pass, type Tile } from "./plan"

const COARSE = "oklch(0.62 0.15 45)"
const FINE = "oklch(0.55 0.14 250)"
const BAD = "oklch(0.58 0.2 25)"
const GOOD = "oklch(0.56 0.13 150)"

type Preset = { id: string; label: string; w: number; h: number; note: string }

const PRESETS: Preset[] = [
  { id: "orig", label: "original corn, 480×500", w: 480, h: 500, note: "the photo the skill was built from" },
  { id: "cc0", label: "CC0 corn, 960×640", w: 960, h: 640, note: "the README's hero photo" },
  { id: "phone", label: "phone photo, 1600×1200", w: 1600, h: 1200, note: "a downscaled phone shot" },
]

const fmt = (n: number) => n.toLocaleString("en-US")

const SVG_W = 360

export function CropPlanner() {
  const [preset, setPreset] = useState("cc0")
  const [coarseSize, setCoarseSize] = useState(200)
  const [coarseOverlap, setCoarseOverlap] = useState(60)
  const [gridStep, setGridStep] = useState(6)
  const [fineSize, setFineSize] = useState(120)
  const [fineOverlap, setFineOverlap] = useState(30)
  const [objectPx, setObjectPx] = useState(20)
  const [bigBudget, setBigBudget] = useState(false)
  const [show, setShow] = useState<"coarse" | "fine">("fine")

  const p = PRESETS.find((x) => x.id === preset) ?? PRESETS[1]
  const cOv = Math.min(coarseOverlap, coarseSize - 1)
  const fOv = Math.min(fineOverlap, fineSize - 1)
  const passes: Pass[] = [
    { name: "whole", size: null, overlap: 0, gridStep: null },
    { name: "coarse", size: coarseSize, overlap: cOv, gridStep: gridStep > 0 ? gridStep : null },
    { name: "fine", size: fineSize, overlap: fOv, gridStep: null },
  ]
  const r = plan(p.w, p.h, passes, 2, 1)
  const budget = bigBudget ? HERO_BUDGET : DEFAULT_BUDGET
  const checks = [
    { key: "requests", used: r.jobs, cap: budget.maxJobs },
    { key: "grid points", used: r.pointPrompts, cap: budget.maxGridPoints },
    { key: "candidates", used: r.candidates, cap: budget.maxCandidates },
  ]
  const refused = checks.some((c) => c.used > c.cap)

  const scale = SVG_W / p.w
  const svgH = Math.round(p.h * scale)
  const shown: Tile[] = (show === "coarse" ? r.passes[1] : r.passes[2]).tiles
  const colour = show === "coarse" ? COARSE : FINE

  // Object width as a fraction of each view's width.
  const views = [
    { name: "whole", width: p.w },
    { name: "coarse", width: Math.min(coarseSize, p.w) },
    { name: "fine", width: Math.min(fineSize, p.w) },
  ]

  return (
    <figure className="my-8 rounded-md border">
      <div className="border-b px-3 py-2 font-mono text-xs text-muted-foreground">
        sam3-segmentation · <code>segment.py plan</code>, before any weights load
      </div>

      <div className="flex flex-wrap gap-2 px-3 pt-3">
        {PRESETS.map((x) => (
          <button
            key={x.id}
            type="button"
            onClick={() => setPreset(x.id)}
            aria-pressed={preset === x.id}
            className={
              "rounded border px-2 py-1 font-mono text-xs " +
              (preset === x.id ? "bg-foreground text-background" : "text-muted-foreground")
            }
          >
            {x.label}
          </button>
        ))}
      </div>
      <p className="px-3 pt-1 font-mono text-[11px] text-muted-foreground">{p.note}</p>

      <div className="grid gap-4 p-3 md:grid-cols-[minmax(0,360px)_1fr]">
        <div>
          <div className="mb-1 flex gap-2 font-mono text-xs">
            {(["coarse", "fine"] as const).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setShow(k)}
                aria-pressed={show === k}
                className={"rounded border px-2 py-0.5 " + (show === k ? "font-semibold" : "text-muted-foreground")}
                style={{ borderColor: k === "coarse" ? COARSE : FINE }}
              >
                {k} tiles
              </button>
            ))}
          </div>
          <svg
            viewBox={`0 0 ${SVG_W} ${svgH}`}
            className="w-full"
            role="img"
            aria-label={`A ${p.w} by ${p.h} pixel image covered by ${shown.length} overlapping ${show} tiles.`}
          >
            <rect x={0} y={0} width={SVG_W} height={svgH} className="fill-muted" />
            {shown.map((t, i) => (
              <rect
                key={i}
                x={t[0] * scale}
                y={t[1] * scale}
                width={t[2] * scale}
                height={t[3] * scale}
                fill={colour}
                fillOpacity={0.07}
                stroke={colour}
                strokeWidth={1}
              />
            ))}
            {/* one typical object, to scale, in the top-left tile */}
            <circle
              cx={(objectPx / 2 + 4) * scale}
              cy={(objectPx / 2 + 4) * scale}
              r={(objectPx / 2) * scale}
              className="fill-foreground"
              fillOpacity={0.8}
            />
          </svg>
          <p className="mt-1 font-mono text-[11px] text-muted-foreground">
            {shown.length} {show} tiles · the dot at top left is one {objectPx}px object, to scale
          </p>
        </div>

        <div className="space-y-2 font-mono text-xs">
          <Slider label="coarse tile" value={coarseSize} min={80} max={400} step={10} unit="px" onChange={setCoarseSize} accent={COARSE} />
          <Slider label="coarse overlap" value={cOv} min={0} max={150} step={5} unit="px" onChange={setCoarseOverlap} accent={COARSE} />
          <Slider label="grid step" value={gridStep} min={0} max={48} step={1} unit={gridStep > 0 ? "px" : " (off)"} onChange={setGridStep} accent={COARSE} />
          <Slider label="fine tile" value={fineSize} min={60} max={300} step={10} unit="px" onChange={setFineSize} accent={FINE} />
          <Slider label="fine overlap" value={fOv} min={0} max={120} step={5} unit="px" onChange={setFineOverlap} accent={FINE} />
          <Slider label="object size" value={objectPx} min={5} max={120} step={1} unit="px" onChange={setObjectPx} />
          <label className="flex items-center gap-2 pt-1">
            <input type="checkbox" checked={bigBudget} onChange={(e) => setBigBudget(e.target.checked)} />
            use the hero config&apos;s raised budget (300 / 40,000 / 170,000)
          </label>
        </div>
      </div>

      <div className="overflow-x-auto px-3 pb-2">
        <table className="w-full min-w-[520px] font-mono text-xs">
          <thead>
            <tr className="text-muted-foreground">
              <th className="py-1 text-left font-normal">pass</th>
              <th className="text-right font-normal">tiles</th>
              <th className="text-right font-normal">text req.</th>
              <th className="text-right font-normal">point req.</th>
              <th className="text-right font-normal">grid points</th>
              <th className="text-right font-normal">object / view</th>
            </tr>
          </thead>
          <tbody>
            {r.passes.map((x, i) => {
              const frac = objectPx / views[i].width
              const ok = frac * 6 >= 1
              return (
                <tr key={x.name} className="border-t">
                  <td className="py-1">{x.name}</td>
                  <td className="text-right">{fmt(x.tiles.length)}</td>
                  <td className="text-right">{fmt(x.textJobs)}</td>
                  <td className="text-right">{fmt(x.pointJobs)}</td>
                  <td className="text-right">{fmt(x.pointPrompts)}</td>
                  <td className="text-right" style={{ color: ok ? GOOD : BAD }}>
                    1/{fmt(Math.round(views[i].width / objectPx))} {ok ? "ok" : "too small"}
                  </td>
                </tr>
              )
            })}
            <tr className="border-t">
              <td className="py-1">ear of corn</td>
              <td className="text-right">1</td>
              <td className="text-right">1</td>
              <td className="text-right">0</td>
              <td className="text-right">0</td>
              <td className="text-right text-muted-foreground">whole image</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="grid gap-2 border-t px-3 py-3 font-mono text-xs sm:grid-cols-3">
        {checks.map((c) => (
          <div key={c.key}>
            <div className="text-muted-foreground">{c.key}</div>
            <div style={{ color: c.used > c.cap ? BAD : undefined }}>
              {fmt(c.used)} <span className="text-muted-foreground">/ {fmt(c.cap)}</span>
            </div>
          </div>
        ))}
      </div>
      <figcaption className="border-t px-3 py-2 text-xs text-muted-foreground">
        {refused ? (
          <span style={{ color: BAD }}>
            plan refuses: the skill stops here and asks the user to approve a bigger budget.
          </span>
        ) : (
          <span>plan passes: inference may start.</span>
        )}{" "}
        Candidates are an upper bound: 200 detector slots per text request plus three hypotheses per grid
        point, counted before any filter. The object-size column applies the skill&apos;s one-sixth rule of
        thumb from its own corn tests.
      </figcaption>
    </figure>
  )
}

function Slider({
  label,
  value,
  min,
  max,
  step,
  unit,
  onChange,
  accent,
}: {
  label: string
  value: number
  min: number
  max: number
  step: number
  unit: string
  onChange: (v: number) => void
  accent?: string
}) {
  return (
    <label className="grid grid-cols-[96px_1fr_72px] items-center gap-2">
      <span className="text-muted-foreground">{label}</span>
      <Range
        min={min}
        max={max}
        step={step}
        value={value}
        accent={accent}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label={label}
      />
      <span className="text-right">
        {value}
        {unit}
      </span>
    </label>
  )
}
