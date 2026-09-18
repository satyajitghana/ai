"use client"

import { useState } from "react"

import { mlog10 } from "@/lib/dmath"
import { cn } from "@/lib/utils"

// What Figure 5 of arXiv:2603.06397 actually plots, batch size by batch size,
// against the "consistent 12x-20x speedup" its own prose claims.
//
// Every number here is read out of the figure's SVG, not off a screenshot.
// arxiv.org/html/2603.06397v1/query_fanout_efficiency.svg is a matplotlib
// export: each marker is a <path transform="matrix(1,0,0,-1,tx,ty)"> whose ty
// is the data point, and each gridline is a horizontal <path> at a labelled
// tick, so calibrating ty against the six main-axes gridlines (0 through 50 s)
// recovers the plotted value to three decimals. The calibration is checked
// twice: it reproduces the paper's own two stated autoregressive numbers
// ("approximately 1.46 seconds" at batch 8, "nearly 50 seconds" at batch 1024),
// and the figure's zoom inset -- a separate set of axes with its own gridlines
// -- returns the identical four values for batches 8 through 64.
//
// The dataset is published at /articles/retrieve-for-train/data/fig5-latency.json.

type Row = { batch: number; ar: number; diff: number }

const ROWS: Row[] = [
  { batch: 8, ar: 1.456, diff: 0.09 },
  { batch: 16, ar: 1.518, diff: 0.098 },
  { batch: 32, ar: 1.652, diff: 0.157 },
  { batch: 64, ar: 1.852, diff: 0.23 },
  { batch: 128, ar: 5.632, diff: 0.527 },
  { batch: 256, ar: 11.448, diff: 1.091 },
  { batch: 512, ar: 24.531, diff: 2.141 },
  { batch: 1024, ar: 49.766, diff: 3.93 },
]

// The prose's two diffusion numbers, which the figure does not support.
const PROSE_DIFF: Record<number, number> = { 8: 0.07, 1024: 4.21 }

const CLAIM_LO = 12
const CLAIM_HI = 20

const AR_C = "oklch(0.68 0.17 55)"
const DIFF_C = "oklch(0.58 0.16 260)"
const BAD = "oklch(0.60 0.18 25)"

const W = 720
const TOP_H = 210
const PL = 56
const PR = 700
const PT = 14
const PB = 168

// log-decade y axis for latency: 0.05 s to 60 s
const LO = mlog10(0.05)
const HI = mlog10(60)
const yPix = (v: number) => PB - ((mlog10(v) - LO) / (HI - LO)) * (PB - PT)
const xPix = (i: number) => PL + (i / (ROWS.length - 1)) * (PR - PL)

const path = (key: "ar" | "diff") =>
  ROWS.map((r, i) => `${i === 0 ? "M" : "L"} ${xPix(i)} ${yPix(r[key])}`).join(" ")

const BAR_W = 720
const BAR_H = 150
const BPL = 56
const BPR = 700
const BPT = 12
const BPB = 118
const rPix = (v: number) => BPB - (v / 22) * (BPB - BPT)

const ratio = (r: Row) => r.ar / r.diff

export function SpeedupCurve() {
  const [sel, setSel] = useState(3) // batch 64 -- the worst case
  const row = ROWS[sel]
  const sp = ratio(row)
  const below = ROWS.filter((r) => ratio(r) < CLAIM_LO).length

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          read off Figure 5&rsquo;s own SVG, batch by batch
        </span>
        <span className="font-mono text-[10px] text-muted-foreground">
          {below} of {ROWS.length} batch sizes fall below the claimed floor
        </span>
      </div>

      <div className="flex flex-wrap gap-1 border-b px-4 py-2">
        {ROWS.map((r, i) => (
          <button
            key={r.batch}
            type="button"
            onClick={() => setSel(i)}
            aria-pressed={sel === i}
            className={cn(
              "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
              sel === i
                ? "border-foreground/30 bg-muted/60 text-foreground"
                : "border-border text-muted-foreground hover:text-foreground",
            )}
          >
            {r.batch}
          </button>
        ))}
      </div>

      <div className="p-3 sm:p-4">
        <div className="mb-1 font-mono text-[11px] text-muted-foreground">
          wall-clock fan-out latency, k = 10 · log scale · hardware not stated in the paper
        </div>
        <svg
          viewBox={`0 0 ${W} ${TOP_H}`}
          className="w-full"
          role="img"
          aria-label={`Latency against batch size on a log scale. The autoregressive fan-out rises from 1.456 seconds at batch 8 to 49.766 seconds at batch 1024. The diffusion retriever rises from 0.090 seconds to 3.930 seconds over the same range. The two curves stay roughly one decade apart throughout.`}
        >
          {[0.1, 1, 10].map((t) => (
            <g key={`g${t}`}>
              <line
                x1={PL}
                y1={yPix(t)}
                x2={PR}
                y2={yPix(t)}
                stroke="var(--border)"
                strokeWidth={1}
                strokeOpacity={0.4}
              />
              <text
                x={PL - 8}
                y={yPix(t) + 3.5}
                textAnchor="end"
                className="fill-muted-foreground font-mono"
                fontSize={10}
              >
                {t < 1 ? "0.1s" : `${t}s`}
              </text>
            </g>
          ))}

          <path d={path("ar")} fill="none" stroke={AR_C} strokeWidth={2.5} strokeLinejoin="round" />
          <path d={path("diff")} fill="none" stroke={DIFF_C} strokeWidth={2.5} strokeLinejoin="round" />

          {ROWS.map((r, i) => (
            <g key={r.batch}>
              <circle cx={xPix(i)} cy={yPix(r.ar)} r={sel === i ? 5 : 3.2} fill={AR_C} />
              <circle cx={xPix(i)} cy={yPix(r.diff)} r={sel === i ? 5 : 3.2} fill={DIFF_C} />
              <text
                x={xPix(i)}
                y={PB + 16}
                textAnchor="middle"
                className={cn("font-mono", sel === i ? "fill-foreground" : "fill-muted-foreground")}
                fontSize={10}
              >
                {r.batch}
              </text>
            </g>
          ))}

          {/* the two points the prose states but the figure does not plot */}
          {ROWS.map((r, i) =>
            PROSE_DIFF[r.batch] !== undefined ? (
              <g key={`p${r.batch}`}>
                <circle
                  cx={xPix(i)}
                  cy={yPix(PROSE_DIFF[r.batch])}
                  r={4}
                  fill="none"
                  stroke={BAD}
                  strokeWidth={1.6}
                  strokeDasharray="2.5 2"
                />
                <line
                  x1={xPix(i)}
                  y1={yPix(PROSE_DIFF[r.batch])}
                  x2={xPix(i)}
                  y2={yPix(r.diff)}
                  stroke={BAD}
                  strokeWidth={1}
                  strokeOpacity={0.6}
                />
              </g>
            ) : null,
          )}

          <line x1={xPix(sel)} y1={PT} x2={xPix(sel)} y2={PB} stroke="var(--border)" strokeWidth={1} />
          <text x={PL} y={PB + 34} className="fill-muted-foreground font-mono" fontSize={10}>
            batch size
          </text>
        </svg>

        <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 font-mono text-[10px] text-muted-foreground">
          <span>
            <span style={{ color: AR_C }}>&#9679;</span> autoregressive LLM fan-out
          </span>
          <span>
            <span style={{ color: DIFF_C }}>&#9679;</span> 53.9M diffusion retriever
          </span>
          <span>
            <span style={{ color: BAD }}>&#9675;</span> number stated in the prose, not plotted in the figure
          </span>
        </div>

        <div className="mt-4 mb-1 font-mono text-[11px] text-muted-foreground">
          speedup = autoregressive / diffusion, against the claimed band
        </div>
        <svg
          viewBox={`0 0 ${BAR_W} ${BAR_H}`}
          className="w-full"
          role="img"
          aria-label={`Speedup by batch size: 16.18x at batch 8, 15.49x at 16, 10.52x at 32, 8.05x at 64, 10.69x at 128, 10.49x at 256, 11.46x at 512 and 12.66x at 1024. The paper's claimed band of 12x to 20x is shaded; five of the eight bars fall below it and none reach 20x.`}
        >
          <rect
            x={BPL}
            y={rPix(CLAIM_HI)}
            width={BPR - BPL}
            height={rPix(CLAIM_LO) - rPix(CLAIM_HI)}
            fill="var(--foreground)"
            fillOpacity={0.06}
          />
          {[CLAIM_LO, CLAIM_HI].map((t) => (
            <g key={`c${t}`}>
              <line
                x1={BPL}
                y1={rPix(t)}
                x2={BPR}
                y2={rPix(t)}
                stroke="var(--foreground)"
                strokeOpacity={0.35}
                strokeWidth={1}
                strokeDasharray="4 3"
              />
              <text
                x={BPL - 8}
                y={rPix(t) + 3.5}
                textAnchor="end"
                className="fill-muted-foreground font-mono"
                fontSize={10}
              >
                {t}x
              </text>
            </g>
          ))}

          {ROWS.map((r, i) => {
            const v = ratio(r)
            const bw = (BPR - BPL) / ROWS.length
            const x = BPL + i * bw + bw * 0.22
            const inBand = v >= CLAIM_LO
            return (
              <g key={r.batch}>
                <rect
                  x={x}
                  y={rPix(v)}
                  width={bw * 0.56}
                  height={BPB - rPix(v)}
                  fill={inBand ? DIFF_C : BAD}
                  fillOpacity={sel === i ? 0.95 : 0.45}
                />
                <text
                  x={x + bw * 0.28}
                  y={rPix(v) - 5}
                  textAnchor="middle"
                  className={cn("font-mono", sel === i ? "fill-foreground" : "fill-muted-foreground")}
                  fontSize={10}
                >
                  {v.toFixed(1)}x
                </text>
                <text
                  x={x + bw * 0.28}
                  y={BPB + 15}
                  textAnchor="middle"
                  className="fill-muted-foreground font-mono"
                  fontSize={10}
                >
                  {r.batch}
                </text>
              </g>
            )
          })}
          <line x1={BPL} y1={BPB} x2={BPR} y2={BPB} stroke="var(--border)" strokeWidth={1} />
        </svg>

        <div className="mt-3 grid gap-3 rounded-lg border bg-background/60 p-3 sm:grid-cols-3">
          <div>
            <div className="font-mono text-[10px] tracking-wide text-muted-foreground uppercase">
              batch {row.batch}
            </div>
            <div className="mt-1 font-mono text-sm">
              {row.ar.toFixed(3)}s &rarr; {row.diff.toFixed(3)}s
            </div>
          </div>
          <div>
            <div className="font-mono text-[10px] tracking-wide text-muted-foreground uppercase">
              plotted speedup
            </div>
            <div
              className="mt-1 font-mono text-sm"
              style={{ color: sp >= CLAIM_LO ? undefined : BAD }}
            >
              {sp.toFixed(2)}x {sp >= CLAIM_LO ? "" : `(claim floor ${CLAIM_LO}x)`}
            </div>
          </div>
          <div>
            <div className="font-mono text-[10px] tracking-wide text-muted-foreground uppercase">
              prose says
            </div>
            <div className="mt-1 font-mono text-sm">
              {PROSE_DIFF[row.batch] !== undefined
                ? `${PROSE_DIFF[row.batch].toFixed(2)}s → ${(row.ar / PROSE_DIFF[row.batch]).toFixed(2)}x`
                : "— (only batch 8 and 1024 are stated)"}
            </div>
          </div>
        </div>
      </div>

      <figcaption className="border-t px-4 py-2 font-mono text-[11px] leading-5 text-muted-foreground">
        Values extracted from <code>query_fanout_efficiency.svg</code> (arXiv:2603.06397v1, Figure 5)
        by calibrating each marker&rsquo;s transform against the axis gridlines. The extraction
        reproduces both autoregressive anchors the paper states in prose; neither diffusion anchor it
        states matches the figure.
      </figcaption>
    </figure>
  )
}
