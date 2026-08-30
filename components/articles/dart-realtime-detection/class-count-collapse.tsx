"use client"

import { useMemo, useState } from "react"

import { cn } from "@/lib/utils"

// DART paper (arXiv 2603.11441), Table 2 "Latency breakdown by class count"
// and Figure 2 "FPS vs. class count" (1008px, RTX 4080, TRT FP16) -- the four
// N=1/2/4/8 rows below are transcribed verbatim, "Gain" column included.
// Backbone latency is constant across N (the paper's own point: the ViT-H/14
// backbone only sees the image, never the text prompt); encoder-decoder scales
// with N because it batches one query set per class.
//
// The paper's abstract headline -- "DART achieves 55.8 AP at 15.8 FPS (4
// classes, 1008x1008)" -- pairs an 80-class AP with a 4-class FPS. Table 2
// stops at N=8; there is no measured 80-class *video* FPS anywhere in the
// paper or the GitHub repo. Two ways to get there anyway:
//
//  1. Extrapolate the paper's own scaling law. E-D(N) is linear in N (Table 2:
//     7.9, 11.4, 19.2, 34.7 ms at N=1,2,4,8) -- fit the line through the two
//     endpoints (N=1 -> 7.9ms, N=8 -> 34.7ms) and it reproduces N=2 and N=4 to
//     within 0.3ms, so it's a real fit, not a guess. Pipelining's absolute gain
//     (seqMs - pipeMs) is close to flat across the four rows -- 7.6, 7.8, 9.1,
//     7.9ms -- averaging ~8ms; that offset is applied as a fixed ms, not a
//     ratio, because the paper's own "Gain" column (+15%,+14%,+14%,+9%) is
//     shrinking as a *percentage* precisely because a roughly fixed ms saving
//     is being divided by a growing total.
//  2. Read the number that already exists. The GitHub README's COCO-eval
//     table (scripts/eval_coco_official.py) reports 225 ms/img for the exact
//     "Full TRT FP16, 1008px" row that produces 55.8 AP on all 80 classes --
//     a genuine wall-clock, GPU-synced average over the 5,000-image val2017
//     set, chunked internally into 5 passes of 16 classes (the enc-dec engine
//     is built with --max-classes 16). That row appears in the README table
//     but was dropped from the paper's own Table 3, which keeps only the AP
//     columns. It is not extrapolated; it is sitting in the repository.
//
// Both routes land in the same neighborhood -- a few frames per second, not
// fifteen point eight.

type Row = {
  n: number
  bb: number
  ed: number
  seqMs: number
  seqFps: number
  pipeMs: number
  pipeFps: number
  gainPct: number | null
  measured: boolean
}

const MEASURED: Row[] = [
  { n: 1, bb: 53.2, ed: 7.9, seqMs: 61.1, seqFps: 16.3, pipeMs: 1000 / 18.7, pipeFps: 18.7, gainPct: 15, measured: true },
  { n: 2, bb: 53.2, ed: 11.4, seqMs: 64.6, seqFps: 15.5, pipeMs: 1000 / 17.6, pipeFps: 17.6, gainPct: 14, measured: true },
  { n: 4, bb: 53.2, ed: 19.2, seqMs: 72.4, seqFps: 13.8, pipeMs: 1000 / 15.8, pipeFps: 15.8, gainPct: 14, measured: true },
  { n: 8, bb: 53.2, ed: 34.7, seqMs: 87.9, seqFps: 11.5, pipeMs: 1000 / 12.5, pipeFps: 12.5, gainPct: 9, measured: true },
]

const ED_SLOPE = (34.7 - 7.9) / (8 - 1)
const ED_INTERCEPT = 7.9 - ED_SLOPE * 1
const HIDDEN_MS = MEASURED.reduce((sum, r) => sum + (r.seqMs - r.pipeMs), 0) / MEASURED.length

function extrapolate(n: number): Row {
  const ed = ED_INTERCEPT + ED_SLOPE * n
  const seqMs = 53.2 + ed
  const pipeMs = Math.max(53.2, seqMs - HIDDEN_MS)
  return {
    n,
    bb: 53.2,
    ed,
    seqMs,
    seqFps: 1000 / seqMs,
    pipeMs,
    pipeFps: 1000 / pipeMs,
    gainPct: null,
    measured: false,
  }
}

const ROWS: Row[] = [...MEASURED, extrapolate(16), extrapolate(80)]

// The measured 80-class number that already exists in the repo, from a
// different harness (eval_coco_official.py's per-image wall clock, chunked
// 5x16) rather than the video benchmark's sequential/pipelined split.
const COCO_EVAL_80_MS = 225
const COCO_EVAL_80_FPS = 1000 / COCO_EVAL_80_MS

const BACKBONE = "oklch(0.62 0.15 255)"
const ENCDEC = "oklch(0.62 0.19 35)"
const REALTIME = "oklch(0.68 0.14 85)"

const SCALE_MAX = 400
const PLOT_W = 500

function px(ms: number): number {
  return (Math.min(ms, SCALE_MAX) / SCALE_MAX) * PLOT_W
}

export function ClassCountCollapse() {
  const [idx, setIdx] = useState(2) // default: N=4, the headline's own class count

  const row = ROWS[idx]
  const rtMs = 1000 / 15
  const belowRealtime = row.pipeFps < 15

  const seqBbW = useMemo(() => px(row.bb), [row.bb])
  const seqEdEnd = useMemo(() => px(row.bb + row.ed), [row.bb, row.ed])
  const pipeEnd = useMemo(() => px(row.pipeMs), [row.pipeMs])

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">DART paper, Table 2 &amp; Figure 2 (1008px, RTX 4080, TRT FP16)</span>
        <div className="flex flex-wrap gap-1.5">
          {ROWS.map((r, i) => (
            <button
              key={r.n}
              type="button"
              onClick={() => setIdx(i)}
              aria-pressed={idx === i}
              className={cn(
                "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
                idx === i
                  ? "border-foreground/30 bg-muted/50 text-foreground"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {r.n} cls
            </button>
          ))}
        </div>
      </div>

      <div className="p-3 sm:p-4">
        <div className="mb-3 flex items-center justify-between">
          <span className="font-mono text-[10.5px] text-muted-foreground">
            {row.measured ? "measured" : "extrapolated — no video benchmark exists at this N"}
          </span>
          {row.gainPct != null ? (
            <span className="font-mono text-[10.5px] text-muted-foreground">
              pipelining gain: <span className="text-foreground">+{row.gainPct}%</span>
            </span>
          ) : null}
        </div>

        <div className="overflow-x-auto">
          <svg viewBox={`0 0 ${PLOT_W + 140} 120`} width={PLOT_W + 140} height={120} role="img" className="min-w-[560px] max-w-full">
            <title>
              {`At ${row.n} classes: backbone ${row.bb.toFixed(1)}ms, encoder-decoder ${row.ed.toFixed(1)}ms, sequential total ${row.seqMs.toFixed(1)}ms (${row.seqFps.toFixed(1)} FPS), pipelined ${row.pipeMs.toFixed(1)}ms (${row.pipeFps.toFixed(1)} FPS). ${row.measured ? "Measured in the paper's own Table 2." : "Extrapolated from the paper's linear class-count scaling law, not directly measured."}`}
            </title>

            {/* axis */}
            {[0, 100, 200, 300, 400].map((t) => (
              <g key={t}>
                <line x1={px(t)} y1={16} x2={px(t)} y2={92} stroke="currentColor" strokeOpacity={0.08} />
                <text x={px(t)} y={104} fontSize={7.5} textAnchor="middle" fill="currentColor" fillOpacity={0.4} fontFamily="ui-monospace, monospace">
                  {t}ms
                </text>
              </g>
            ))}

            {/* 15 FPS reference line */}
            <line x1={px(rtMs)} y1={16} x2={px(rtMs)} y2={92} stroke={REALTIME} strokeDasharray="3 3" strokeWidth={1.2} />
            <text x={px(rtMs)} y={11} fontSize={7} textAnchor="middle" fill={REALTIME} fontFamily="ui-monospace, monospace">
              15 FPS (66.7ms)
            </text>

            {/* Sequential row: backbone + enc-dec stacked */}
            <text x={0} y={28} fontSize={8} fill="currentColor" fillOpacity={0.6} fontFamily="ui-monospace, monospace">
              Sequential
            </text>
            <rect x={0} y={32} width={seqBbW} height={16} fill={BACKBONE} fillOpacity={row.measured ? 0.85 : 0.4} rx={2} />
            <rect x={seqBbW} y={32} width={seqEdEnd - seqBbW} height={16} fill={ENCDEC} fillOpacity={row.measured ? 0.85 : 0.4} rx={2} />
            <text x={seqEdEnd + 8} y={44} fontSize={8.5} fill="currentColor" fontFamily="ui-monospace, monospace">
              {row.seqMs.toFixed(0)}ms &middot; {row.seqFps.toFixed(1)} FPS
            </text>

            {/* Pipelined row */}
            <text x={0} y={68} fontSize={8} fill="currentColor" fillOpacity={0.6} fontFamily="ui-monospace, monospace">
              Pipelined
            </text>
            <rect
              x={0}
              y={72}
              width={pipeEnd}
              height={16}
              fill={belowRealtime ? ENCDEC : BACKBONE}
              fillOpacity={row.measured ? 0.85 : 0.4}
              rx={2}
            />
            <text x={pipeEnd + 8} y={84} fontSize={8.5} fill={belowRealtime ? ENCDEC : "currentColor"} fontFamily="ui-monospace, monospace">
              {row.pipeMs.toFixed(0)}ms &middot; {row.pipeFps.toFixed(1)} FPS
            </text>
          </svg>
        </div>

        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 font-mono text-[10px] text-muted-foreground">
          <span>
            <span className="inline-block h-2 w-2 rounded-sm align-middle" style={{ background: BACKBONE }} /> backbone (flat, class-agnostic)
          </span>
          <span>
            <span className="inline-block h-2 w-2 rounded-sm align-middle" style={{ background: ENCDEC }} /> encoder-decoder (scales with N)
          </span>
        </div>

        {row.n === 80 ? (
          <div className="mt-4 rounded-lg border border-dashed border-foreground/20 bg-muted/20 p-3 font-mono text-[10.5px] leading-5 text-muted-foreground">
            A different, real measurement exists for exactly this point: the README&rsquo;s own COCO-eval
            table reports <span className="text-foreground">{COCO_EVAL_80_MS} ms/img</span> (
            <span className="text-foreground">{COCO_EVAL_80_FPS.toFixed(1)} FPS</span>) for the &ldquo;Full
            TRT FP16, 1008px&rdquo; row that produces the 55.8 AP headline on all 80 COCO classes &mdash; a
            GPU-synced wall-clock average over 5,000 val2017 images, chunked into 5 passes of 16 classes.
            It isn&rsquo;t in the paper&rsquo;s own Table 3, which drops the latency column entirely.
          </div>
        ) : null}

        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          At <span className="text-foreground">4 classes</span> &mdash; the class count the abstract&rsquo;s
          FPS number was measured at &mdash; DART clears 15 FPS pipelined with room to spare. Slide up to{" "}
          <span className="text-foreground">80</span> &mdash; the class count its AP number was measured
          at &mdash; and both routes to an answer land at 2.7&ndash;4.4 FPS. The backbone really is O(1)
          in class count, exactly as claimed; the encoder-decoder is not, and at 80 classes it is
          5&ndash;6&times; the backbone&rsquo;s own cost. Neither number in &ldquo;55.8 AP at 15.8
          FPS&rdquo; is wrong. They were never the same run.
        </p>
      </div>
    </figure>
  )
}
