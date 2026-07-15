"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// How much depth reasoning needs. Loop depth R is LOTUS's compute knob: the same
// weights are applied R times, and accuracy climbs steeply with it. Two real curves on
// Llama-3B / GSM8K: TRAIN — models trained at each R (Table 5), where too-shallow loops
// simply cannot fit the task (R=2 → 14.6%, R=6 → 70.0%); and INFER — a single model
// trained at R=6 then run with a different R at test time (Table 6), which peaks at its
// trained depth and cannot be pushed past it (R=7 → 69.3%). Drag to read either curve.

const ACCENT = "oklch(0.58 0.16 300)" // train
const INFER = "oklch(0.70 0.13 200)" // infer (teal)

type Series = "train" | "infer"
const DATA: Record<Series, { r: number; acc: number }[]> = {
  train: [
    { r: 2, acc: 14.6 },
    { r: 3, acc: 23.2 },
    { r: 4, acc: 52.6 },
    { r: 5, acc: 68.1 },
    { r: 6, acc: 70.0 },
  ],
  infer: [
    { r: 1, acc: 22.7 },
    { r: 2, acc: 40.0 },
    { r: 3, acc: 55.0 },
    { r: 4, acc: 63.5 },
    { r: 5, acc: 68.7 },
    { r: 6, acc: 70.0 },
    { r: 7, acc: 69.3 },
  ],
}

const W = 760
const H = 300
const ML = 46
const MR = 24
const MT = 24
const MB = 44
const PW = W - ML - MR
const PH = H - MT - MB
const RMIN = 1
const RMAX = 7
const YMIN = 0
const YMAX = 80

const xOf = (r: number) => ML + ((r - RMIN) / (RMAX - RMIN)) * PW
const yOf = (a: number) => MT + (1 - (a - YMIN) / (YMAX - YMIN)) * PH

function pathOf(pts: { r: number; acc: number }[]) {
  return pts.map((p, i) => `${i === 0 ? "M" : "L"} ${xOf(p.r).toFixed(1)} ${yOf(p.acc).toFixed(1)}`).join(" ")
}

export function LoopDepth() {
  const [series, setSeries] = useState<Series>("train")
  const [sel, setSel] = useState(6)

  const pts = DATA[series]
  const point = pts.find((p) => p.r === sel) ?? pts[pts.length - 1]
  const minR = pts[0].r
  const maxR = pts[pts.length - 1].r
  const clampedSel = Math.min(Math.max(sel, minR), maxR)
  const activePoint = pts.find((p) => p.r === clampedSel) ?? point

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex items-center justify-between border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>accuracy vs loop depth R · Llama-3B, GSM8K</span>
        <span className="text-muted-foreground/50">paper, Table 5 &amp; 6</span>
      </div>

      <div className="p-3 sm:p-4">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`Accuracy rises with loop depth R; ${series} curve at R=${clampedSel} reaches ${activePoint.acc}%`}>
          <defs>
            <filter id="ld-soft" x="-40%" y="-40%" width="180%" height="180%">
              <feDropShadow dx="0" dy="1" stdDeviation="1.4" floodOpacity="0.16" />
            </filter>
          </defs>

          {/* y gridlines + labels */}
          {[0, 20, 40, 60, 80].map((a) => (
            <g key={a}>
              <line x1={ML} y1={yOf(a)} x2={W - MR} y2={yOf(a)} stroke="var(--border)" strokeWidth={1} opacity={a === 0 ? 0.9 : 0.4} />
              <text x={ML - 8} y={yOf(a) + 3} textAnchor="end" className="fill-muted-foreground font-mono" fontSize={9}>
                {a}
              </text>
            </g>
          ))}
          {/* x labels */}
          {Array.from({ length: RMAX - RMIN + 1 }, (_, i) => RMIN + i).map((r) => (
            <text key={r} x={xOf(r)} y={H - MB + 18} textAnchor="middle" className="fill-muted-foreground font-mono" fontSize={9}>
              {r}
            </text>
          ))}
          <text x={ML + PW / 2} y={H - 8} textAnchor="middle" className="fill-muted-foreground font-mono" fontSize={10}>
            loop depth R
          </text>
          <text x={16} y={MT + PH / 2} textAnchor="middle" className="fill-muted-foreground font-mono" fontSize={10} transform={`rotate(-90 16 ${MT + PH / 2})`}>
            GSM8K accuracy (%)
          </text>

          {/* both curves, faint for the inactive one */}
          {(["infer", "train"] as Series[]).map((s) => (
            <g key={s} opacity={s === series ? 1 : 0.22}>
              <path d={pathOf(DATA[s])} fill="none" stroke={s === "train" ? ACCENT : INFER} strokeWidth={s === series ? 2.4 : 1.6} />
              {DATA[s].map((p) => (
                <circle key={p.r} cx={xOf(p.r)} cy={yOf(p.acc)} r={s === series ? 3 : 2.2} fill={s === "train" ? ACCENT : INFER} />
              ))}
            </g>
          ))}

          {/* selected marker */}
          <line x1={xOf(activePoint.r)} y1={MT} x2={xOf(activePoint.r)} y2={MT + PH} stroke="var(--foreground)" strokeWidth={1} opacity={0.3} />
          <circle cx={xOf(activePoint.r)} cy={yOf(activePoint.acc)} r={6} fill="var(--background)" stroke={series === "train" ? ACCENT : INFER} strokeWidth={2} filter="url(#ld-soft)" />
          <g>
            <rect x={Math.min(xOf(activePoint.r) + 10, W - MR - 92)} y={Math.max(yOf(activePoint.acc) - 30, MT + 2)} width={92} height={24} rx={6} fill="var(--background)" stroke="var(--border)" strokeWidth={1} filter="url(#ld-soft)" />
            <text x={Math.min(xOf(activePoint.r) + 10, W - MR - 92) + 46} y={Math.max(yOf(activePoint.acc) - 30, MT + 2) + 16} textAnchor="middle" className="fill-foreground font-mono" fontSize={11} fontWeight={600}>
              R={activePoint.r} · {activePoint.acc}%
            </text>
          </g>
        </svg>

        {/* controls */}
        <div className="mt-1 flex flex-wrap items-center gap-x-5 gap-y-2">
          <div className="flex items-center gap-1.5">
            <span className="font-mono text-[10px] text-muted-foreground">curve</span>
            {(["train", "infer"] as Series[]).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => {
                  setSeries(s)
                  setSel((prev) => Math.min(Math.max(prev, DATA[s][0].r), DATA[s][DATA[s].length - 1].r))
                }}
                aria-pressed={series === s}
                className={cn("cursor-pointer rounded-md px-2 py-1 font-mono text-[10px] transition-colors", series === s ? "text-background" : "bg-muted text-muted-foreground hover:text-foreground")}
                style={series === s ? { background: s === "train" ? ACCENT : INFER } : undefined}
              >
                {s === "train" ? "trained at R" : "trained R=6, infer at R"}
              </button>
            ))}
          </div>
          <div className="ml-auto font-mono text-[10px] text-muted-foreground">
            {series === "train" ? "each point is a separately trained model" : "one model, R varied only at test time"}
          </div>
        </div>

        <div className="mt-3">
          <div className="mb-1 font-mono text-[10px] text-muted-foreground">loop depth R (drag)</div>
          <input type="range" min={minR} max={maxR} value={clampedSel} onChange={(e) => setSel(Number(e.target.value))} className="w-full cursor-pointer accent-[oklch(0.58_0.16_300)]" />
        </div>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Depth is the knob. Trained too shallow, the loop simply <span className="text-foreground">cannot fit</span> multi-step
          arithmetic — R = 2 lands at 14.6%. Give it R = 6 and accuracy reaches{" "}
          <span style={{ color: ACCENT }}>70.0%</span>. But depth is not free test-time compute: take the R = 6 model and run
          it deeper and accuracy <span className="text-foreground">dips</span> (R = 7 → 69.3%) — LOTUS reasons best at the depth
          it was trained for, not beyond.
        </p>
      </div>
    </figure>
  )
}
