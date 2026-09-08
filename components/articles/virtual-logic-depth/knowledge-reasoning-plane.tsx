"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// Redrawn from Figure 1 of arXiv 2506.18233 ("Beyond Parameters: Exploring Virtual
// Logic Depth for Scaling Laws"). The paper's own chart uses a compressed
// (piecewise, non-linear) y-axis to spread its top cluster out -- this redraw uses
// a plain linear y-axis instead, so the point coordinates below are NOT pixel-for-
// pixel identical to the source image, but the reasoning-axis (y) values are.
//
// Provenance: pixel-measured off the published SVG (arxiv.org/html/2506.18233v3/
// main.svg) by calibrating against its own gridlines. The chart labels each point
// with its own "Parameter / Layer / VLD" annotation (VLD = additional depth beyond
// the native layer count, per the paper's own Sec. 3 definition), which is legible
// at full resolution -- effDepth below is native layers + that annotated VLD, read
// directly off the chart, not inferred.
//   - 46.3 / 60.5  match Table 1's "GPT-2 Base" row exactly (4-layer / 8-layer, op15)
//   - 61.15        matches the paper's own prose in Sec. 4.3 exactly ("...the native
//                   150M-parameter model (12-layer) with only 61.15% accuracy")
//   - 62.05        matches the paper's own prose in Sec. 4.3 exactly, which also
//                   states this point's effective depth directly ("...the cycle
//                   pattern (factor 2, effective depth=12) achieves 62.05% accuracy")
//   - 54.9, 62.0, 63.3, 62.2  have no textual source and are pixel-read only. Note
//     that 54.9 and 62.0 happen to equal Table 1's Cycle x1 cells (54.9% at 4L,
//     62.0% at 8L) -- but those table rows are nominally effective depth 4 and 8,
//     while this figure's own annotation puts these two points at effective depth 8
//     and 16, so the match is very likely coincidental, not a confirmed identity;
//     reported here as approximate for that reason.
// Knowledge-axis (x) values are pixel-read only for all eight points -- the paper
// does not tabulate them. Its dedicated knowledge-capacity sweep (Fig. 4, Sec. 4.1)
// uses a separate, much smaller 5M-20M model family, not these 50M-200M models.

type Point = {
  vld: boolean
  params: string
  layers: number
  effDepth: number
  x: number // knowledge capacity, x1e7 bits -- pixel-read from Fig. 1
  y: number // iGSM op15 accuracy, %
  exact: boolean
  note: string
}

const POINTS: Point[] = [
  { vld: false, params: "50M", layers: 4, effDepth: 4, x: 1.05, y: 46.3, exact: true, note: "= Table 1, GPT-2 Base, 4L" },
  { vld: false, params: "100M", layers: 8, effDepth: 8, x: 1.99, y: 60.5, exact: true, note: "= Table 1, GPT-2 Base, 8L" },
  { vld: false, params: "150M", layers: 12, effDepth: 12, x: 2.93, y: 61.15, exact: true, note: "= paper's own prose, Sec. 4.3" },
  { vld: false, params: "200M", layers: 16, effDepth: 16, x: 3.88, y: 62.2, exact: false, note: "pixel-read, not stated in text" },
  { vld: true, params: "50M", layers: 4, effDepth: 8, x: 1.04, y: 54.9, exact: false, note: "pixel-read, not confirmed against Table 1" },
  { vld: true, params: "50M", layers: 4, effDepth: 12, x: 1.0, y: 62.05, exact: true, note: "= paper's own prose, Sec. 4.3" },
  { vld: true, params: "100M", layers: 8, effDepth: 16, x: 1.95, y: 62.0, exact: false, note: "pixel-read, not confirmed against Table 1" },
  { vld: true, params: "100M", layers: 8, effDepth: 24, x: 1.87, y: 63.3, exact: false, note: "pixel-read, not confirmed against Table 1" },
]

const BASE = "oklch(0.60 0.15 255)"
const VLD = "oklch(0.65 0.16 155)"

const W = 640
const H = 380
const padL = 44
const padR = 16
const padT = 20
const padB = 40
const xlo = 0.7
const xhi = 4.2
const ylo = 42
const yhi = 68
const r2 = (n: number) => Math.round(n * 100) / 100

export function KnowledgeReasoningPlane() {
  const [show, setShow] = useState<"both" | "base" | "vld">("both")
  const [hover, setHover] = useState<number | null>(null)

  const sx = (v: number) => r2(padL + ((v - xlo) / (xhi - xlo)) * (W - padL - padR))
  const sy = (v: number) => r2(padT + (1 - (v - ylo) / (yhi - ylo)) * (H - padT - padB))
  const sr = (effDepth: number) => 5 + Math.sqrt(effDepth) * 2.3

  const visible = POINTS.filter((p) => show === "both" || (show === "base" ? !p.vld : p.vld))
  const hp = hover != null ? POINTS[hover] : null

  const chip = (active: boolean) =>
    cn(
      "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-xs transition-colors",
      active ? "border-foreground/30 bg-muted/50 text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
    )

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">knowledge capacity vs. reasoning capability, redrawn from Fig. 1</span>
        <div className="flex gap-1">
          {(["both", "base", "vld"] as const).map((s) => (
            <button key={s} type="button" onClick={() => setShow(s)} className={chip(show === s)}>
              {s === "both" ? "both families" : s === "base" ? "without VLD" : "with VLD (cycle)"}
            </button>
          ))}
        </div>
      </div>

      <div className="p-3 sm:p-4">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full"
          role="img"
          aria-label="Scatter of iGSM reasoning accuracy against knowledge capacity. Without VLD, both axes rise together as parameter count grows. With VLD, knowledge capacity stays roughly where the base model of the same parameter count sits, while reasoning accuracy climbs well above it."
        >
          {/* y gridlines */}
          {[45, 50, 55, 60, 65].map((gy) => (
            <g key={gy}>
              <line x1={padL} y1={sy(gy)} x2={W - padR} y2={sy(gy)} stroke="currentColor" strokeOpacity="0.07" />
              <text x={padL - 6} y={sy(gy) + 3} textAnchor="end" className="fill-muted-foreground/60 font-mono" fontSize="9">
                {gy}
              </text>
            </g>
          ))}
          {/* x gridlines */}
          {[1, 2, 3, 4].map((gx) => (
            <line key={gx} x1={sx(gx)} y1={padT} x2={sx(gx)} y2={H - padB} stroke="currentColor" strokeOpacity="0.05" />
          ))}
          {[1, 2, 3, 4].map((gx) => (
            <text key={gx} x={sx(gx)} y={H - padB + 16} textAnchor="middle" className="fill-muted-foreground/60 font-mono" fontSize="9">
              {gx}
            </text>
          ))}
          <text x={(W + padL) / 2} y={H - 6} textAnchor="middle" className="fill-muted-foreground/50 font-mono" fontSize="9">
            knowledge capacity (information bits × 10⁷)
          </text>

          {/* connecting guides: same param count, base -> vld (shows the near-vertical move) */}
          {show === "both" && (
            <>
              <line x1={sx(1.05)} y1={sy(46.3)} x2={sx(1.0)} y2={sy(62.05)} stroke={VLD} strokeOpacity="0.35" strokeDasharray="3 3" />
              <line x1={sx(1.99)} y1={sy(60.5)} x2={sx(1.87)} y2={sy(63.3)} stroke={VLD} strokeOpacity="0.35" strokeDasharray="3 3" />
            </>
          )}

          {/* classical scaling reference line (base family, left-to-right) */}
          {show !== "vld" && (
            <line
              x1={sx(1.05)} y1={sy(46.3)} x2={sx(3.88)} y2={sy(62.2)}
              stroke={BASE} strokeOpacity="0.3" strokeDasharray="5 4"
            />
          )}

          {visible.map((p) => {
            const i = POINTS.indexOf(p)
            const on = hover === i
            return (
              <g key={i} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} className="cursor-pointer">
                <circle
                  cx={sx(p.x)}
                  cy={sy(p.y)}
                  r={on ? sr(p.effDepth) + 1.5 : sr(p.effDepth)}
                  fill={p.vld ? VLD : BASE}
                  opacity={hover == null || on ? 0.85 : 0.4}
                  stroke={on ? "var(--background)" : "none"}
                  strokeWidth="1.5"
                />
              </g>
            )
          })}
        </svg>

        <div className="mt-1 flex min-h-[34px] flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: BASE }} /> without VLD
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: VLD }} /> with VLD (cycle pattern)
          </span>
          <span className="text-muted-foreground/50">bubble size = effective depth</span>
          {hp ? (
            <span className="ml-auto text-foreground">
              {hp.params} · {hp.layers}L native · depth {hp.effDepth} · {hp.y}%{hp.exact ? "" : " (approx.)"} ·{" "}
              <span className="text-muted-foreground">{hp.note}</span>
            </span>
          ) : (
            <span className="ml-auto text-muted-foreground/50">hover a point</span>
          )}
        </div>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Follow the <span style={{ color: BASE }}>dashed diagonal</span>: without VLD, going from a 50M to a
          200M model buys both more knowledge capacity and more reasoning accuracy, together. Follow either{" "}
          <span style={{ color: VLD }}>dotted vertical guide</span> instead: applying VLD to a fixed 50M or 100M
          backbone barely moves the model right (knowledge capacity), but moves it sharply up (reasoning
          accuracy) &mdash; the two axes the paper is arguing apart. The two exact numbers the paper itself
          quotes, 61.15% (150M, no VLD) and 62.05% (50M, with VLD), are its own headline comparison: a
          three-times-smaller model, with zero added parameters, beating a native model further along the
          diagonal &mdash; on the one axis both families share.
        </p>
      </div>
    </figure>
  )
}
