"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// Every model's ScanNet val mIoU as the input drifts away from what it was
// trained on, drawn as one line per model. Two tests from the Invaria paper
// (arXiv:2605.15923v1): Table 1 changes the grid size the cloud is sampled at
// (0.5x to 3x the 2 cm default); Table 5 rescales the scene and keeps the
// points. The right-hand callout is the abstract's headline, recomputed from
// the table: relative gain over the best baseline in that column, and the
// absolute gap in mIoU points.

type Series = { name: string; v: number[]; ours?: boolean; lp?: boolean }

const TESTS = {
  res: {
    label: "grid size (Table 1)",
    ticks: ["0.5τ*  1 cm", "τ*  2 cm", "2τ*  4 cm", "3τ*  6 cm"],
    rows: [
      { name: "Sonata", v: [59.9, 72.6, 62.3, 34.2], lp: true },
      { name: "Concerto-L", v: [67.9, 78.6, 72.5, 46.0], lp: true },
      { name: "Utonia", v: [73.0, 76.6, 71.7, 47.3], lp: true },
      { name: "Sp.Mink.", v: [36.6, 75.6, 47.8, 19.4] },
      { name: "PTv3", v: [50.5, 77.6, 60.4, 20.5] },
      { name: "Invaria", v: [75.5, 76.2, 75.7, 73.8], ours: true },
    ] as Series[],
  },
  scale: {
    label: "object scale (Table 5)",
    ticks: ["×2", "×1", "×1/2", "×1/3"],
    rows: [
      { name: "Sonata", v: [61.6, 72.6, 66.9, 44.8], lp: true },
      { name: "Concerto-L", v: [68.2, 78.6, 75.4, 61.4], lp: true },
      { name: "Utonia", v: [74.4, 76.6, 69.7, 42.2], lp: true },
      { name: "Sp.Mink.", v: [33.4, 75.6, 42.9, 14.7] },
      { name: "PTv3", v: [47.2, 77.6, 23.2, 9.4] },
      { name: "Invaria", v: [75.6, 76.2, 75.6, 73.8], ours: true },
    ] as Series[],
  },
}

const OURS = "oklch(0.62 0.17 32)"
const BASE = "oklch(0.58 0.12 250)"

const W = 680
const H = 300
const L = 44
const R = 180
const T = 22
const B = 40
const X = (i: number) => L + (i / 3) * (W - L - R)
const Y = (v: number) => T + (1 - v / 80) * (H - T - B)

export function ShiftCurves() {
  const [test, setTest] = useState<"res" | "scale">("res")
  const [hover, setHover] = useState<string | null>(null)
  const t = TESTS[test]
  const last = 3
  const ours = t.rows.find((r) => r.ours)!
  const best = t.rows.filter((r) => !r.ours).reduce((a, b) => (b.v[last] > a.v[last] ? b : a))
  const rel = ((ours.v[last] / best.v[last] - 1) * 100).toFixed(1)
  const abs = (ours.v[last] - best.v[last]).toFixed(1)

  // end labels: sorted top to bottom, pushed apart so close values don't collide
  const labelY = new Map<string, number>()
  let prev = -Infinity
  for (const r of [...t.rows].sort((a, b) => b.v[last] - a.v[last])) {
    const y = Math.max(Y(r.v[last]) + 3, prev + 12)
    labelY.set(r.name, y)
    prev = y
  }

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>ScanNet val mIoU as the input drifts · trained at 2 cm</span>
        <div className="flex gap-1.5">
          {(["res", "scale"] as const).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setTest(k)}
              aria-pressed={test === k}
              className={cn(
                "cursor-pointer rounded-md border px-2 py-0.5 text-[11px] transition-colors",
                test === k ? "border-foreground/40 bg-foreground/5 text-foreground" : "hover:text-foreground",
              )}
            >
              {TESTS[k].label}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto p-3 sm:p-4">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full min-w-[560px]"
          role="img"
          aria-label={`mIoU against ${t.label}. Invaria stays between ${Math.min(...ours.v)} and ${Math.max(...ours.v)}; at the far right it scores ${ours.v[last]} against ${best.name}'s ${best.v[last]}, ${rel}% higher in relative terms and ${abs} points in absolute terms.`}
        >
          {[0, 20, 40, 60, 80].map((g) => (
            <g key={g}>
              <line x1={L} x2={W - R} y1={Y(g)} y2={Y(g)} stroke="currentColor" className="text-border" strokeWidth={1} />
              <text x={L - 6} y={Y(g) + 3} textAnchor="end" className="fill-muted-foreground font-mono" fontSize={9}>
                {g}
              </text>
            </g>
          ))}
          {t.ticks.map((tk, i) => (
            <text key={tk} x={X(i)} y={H - B + 18} textAnchor="middle" className="fill-muted-foreground font-mono" fontSize={9.5}>
              {tk}
            </text>
          ))}

          {t.rows.map((r) => {
            const dim = hover !== null && hover !== r.name
            const c = r.ours ? OURS : BASE
            return (
              <g
                key={r.name}
                opacity={dim ? 0.18 : 1}
                onMouseEnter={() => setHover(r.name)}
                onMouseLeave={() => setHover(null)}
                className="transition-opacity"
              >
                <polyline
                  points={r.v.map((v, i) => `${X(i)},${Y(v)}`).join(" ")}
                  fill="none"
                  stroke={c}
                  strokeWidth={r.ours ? 2.6 : 1.4}
                  strokeDasharray={r.lp ? "5 3" : undefined}
                  strokeOpacity={r.ours ? 1 : 0.75}
                />
                {r.v.map((v, i) => (
                  <circle key={i} cx={X(i)} cy={Y(v)} r={r.ours ? 3.2 : 2.4} fill={c} />
                ))}
                <text
                  x={W - R + 10}
                  y={labelY.get(r.name)}
                  className={cn("font-mono", r.ours ? "fill-foreground" : "fill-muted-foreground")}
                  fontSize={9.5}
                >
                  {r.name} {r.v[last].toFixed(1)}
                </text>
              </g>
            )
          })}
        </svg>

        <div className="mt-2 grid gap-2 font-mono text-[11px] sm:grid-cols-2">
          <div className="rounded-md border px-2.5 py-1.5">
            <div className="text-muted-foreground">at the right edge, against {best.name}</div>
            <div className="text-foreground">
              {ours.v[last].toFixed(1)} vs {best.v[last].toFixed(1)}: +{rel}% relative, +{abs} points
            </div>
          </div>
          <div className="rounded-md border px-2.5 py-1.5">
            <div className="text-muted-foreground">at the training setting (middle-left)</div>
            <div className="text-foreground">
              Invaria {ours.v[1].toFixed(1)} · PTv3 77.6 · Concerto-L 78.6
            </div>
          </div>
        </div>
        <p className="mt-2 font-mono text-[10.5px] text-muted-foreground">
          Dashed: self-supervised models scored by linear probing on the authors&apos; released weights. Solid: trained
          on ScanNet at 2 cm. Hover a line to isolate it.
        </p>
      </div>
    </figure>
  )
}
