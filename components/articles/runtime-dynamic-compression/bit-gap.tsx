"use client"

import { useState, type ReactNode } from "react"

import { cn } from "@/lib/utils"

// "0.4 to 1 bit per weight below Unsloth", checked against the paper's own plot.
//
// Every point below is Figure 4 of Dettmers, "Runtime Dynamic Compression of
// Mixture of Experts" (timdettmers.com/papers/runtime-dynamic-compression.pdf),
// digitized from the PDF's vector paths rather than eyeballed off a raster:
// PyMuPDF's get_drawings() returns each matplotlib marker as a filled path, its
// centre is the data point, and the axes are calibrated from the gridlines
// (x: 1.0 bit at 152.92 pt, 49.01 pt per half bit; y: perplexity 3 at 420.89 pt,
// 33.10 pt per unit). The Unsloth footprints come back as round numbers (2.13,
// 2.32, 2.54 ...), which is how I know the calibration is right.
//
// Two readings per Unsloth checkpoint:
//   same footprint  — the bnb2 point the paper evaluated at Unsloth's own bits
//   equal quality   — where the bnb2 curve crosses Unsloth's perplexity, by
//                     linear interpolation between plotted bnb2 points (the
//                     first crossing from the low-bit end: the fewest bits)
// The interpolation is mine; the paper only plots the points.
//
// Everything is + - * /, so server and client render identical strings.

type Pt = readonly [number, number] // [bits per weight, WikiText-2 perplexity]

type Model = {
  id: string
  label: string
  bnb2: Pt[]
  unsloth: Pt[]
  ref?: Pt // DeepSeek-V4.1's uncompressed point, the only reference plotted
  yLo: number
  yHi: number
}

const MODELS: Model[] = [
  {
    id: "qwen36",
    label: "Qwen3.6-35B-A3B",
    bnb2: [
      [1.0, 8.665], [1.25, 8.041], [1.5, 7.788], [2.0, 7.32], [2.13, 7.371],
      [2.32, 7.234], [2.54, 7.166], [2.95, 7.026], [3.15, 6.941], [3.89, 6.87],
    ],
    unsloth: [[2.13, 7.692], [2.32, 7.437], [2.54, 7.335], [2.95, 7.203], [3.15, 7.149], [3.89, 6.936]],
    yLo: 6.5,
    yHi: 9,
  },
  {
    id: "qwen38",
    label: "Qwen3.8-Flash-Next",
    bnb2: [
      [1.246, 6.419], [1.485, 6.086], [1.724, 5.732], [2.203, 5.245],
      [2.717, 4.98], [2.841, 4.943], [3.109, 4.91], [3.301, 4.881],
    ],
    unsloth: [[2.717, 5.618], [2.841, 5.34], [3.109, 5.128], [3.301, 4.898]],
    yLo: 4.5,
    yHi: 6.75,
  },
  {
    id: "glm53",
    label: "GLM-5.3-Flash",
    bnb2: [
      [1.25, 7.236], [1.5, 6.364], [1.75, 5.758], [2.0, 5.291],
      [2.387, 4.901], [2.502, 4.819], [2.612, 4.604], [2.788, 4.318],
    ],
    unsloth: [[2.387, 6.344], [2.502, 5.771], [2.612, 5.107], [2.788, 4.79]],
    yLo: 4,
    yHi: 7.5,
  },
  {
    id: "ds41",
    label: "DeepSeek-V4.1",
    bnb2: [
      [0.999, 3.637], [1.249, 3.44], [1.5, 3.329], [1.75, 3.209], [1.999, 3.147],
      [2.247, 3.105], [2.497, 3.07], [2.748, 3.071], [2.997, 3.003],
    ],
    unsloth: [],
    ref: [4.332, 2.879],
    yLo: 2.75,
    yHi: 3.75,
  },
]

// First crossing of perplexity y along the bnb2 curve, scanning from low bits.
function bitsAt(curve: Pt[], y: number): number | null {
  for (let i = 0; i + 1 < curve.length; i++) {
    const [x0, y0] = curve[i]
    const [x1, y1] = curve[i + 1]
    if ((y0 >= y && y >= y1) || (y0 <= y && y <= y1)) {
      if (y0 === y1) return x0
      return x0 + ((y0 - y) / (y0 - y1)) * (x1 - x0)
    }
  }
  return null
}

const W = 720
const H = 300
const PL = 44
const PR = 16
const PT = 16
const PB = 36
const XLO = 0.9
const XHI = 4.5

const BNB = "oklch(0.6 0.16 250)"
const UNS = "oklch(0.66 0.16 45)"
const REF = "oklch(0.62 0.02 260)"

const f2 = (v: number) => v.toFixed(2)
const pct = (v: number) => `${v >= 0 ? "+" : "−"}${Math.abs(v).toFixed(1)}%`

export function BitGap() {
  const [mid, setMid] = useState("qwen38")
  const [sel, setSel] = useState(0)
  const m = MODELS.find((x) => x.id === mid) ?? MODELS[0]
  const isRef = m.unsloth.length === 0
  const picks = isRef ? m.bnb2 : m.unsloth
  const i = Math.min(sel, picks.length - 1)

  const sx = (b: number) => PL + ((b - XLO) / (XHI - XLO)) * (W - PL - PR)
  const sy = (p: number) => PT + (1 - (p - m.yLo) / (m.yHi - m.yLo)) * (H - PT - PB)
  const path = (pts: Pt[]) =>
    pts.map(([b, p], k) => `${k === 0 ? "M" : "L"}${sx(b).toFixed(1)},${sy(p).toFixed(1)}`).join(" ")

  const yTicks: number[] = []
  const step = m.yHi - m.yLo > 2 ? 0.5 : 0.25
  for (let v = Math.ceil(m.yLo / step) * step; v <= m.yHi + 1e-9; v += step) yTicks.push(Number(v.toFixed(2)))
  const xTicks = [1, 1.5, 2, 2.5, 3, 3.5, 4]

  // Readout for the selected point.
  let readout: ReactNode
  let guide: ReactNode = null
  if (!isRef) {
    const [ub, up] = picks[i]
    const same = m.bnb2.find(([b]) => Math.abs(b - ub) < 1e-6)
    const eq = bitsAt(m.bnb2, up)
    readout = (
      <>
        Unsloth at <span className="text-foreground">{f2(ub)}</span> bits scores{" "}
        <span className="text-foreground">{f2(up)}</span>.{" "}
        {same ? (
          <>
            At the same footprint bnb2 scores <span className="text-foreground">{f2(same[1])}</span> (
            {pct((same[1] / up - 1) * 100)}).{" "}
          </>
        ) : null}
        {eq !== null ? (
          <>
            bnb2 reaches {f2(up)} at <span className="text-foreground">{f2(eq)}</span> bits:{" "}
            <span className="font-semibold text-foreground">{f2(ub - eq)} bits</span> fewer per weight.
          </>
        ) : null}
      </>
    )
    if (eq !== null) {
      guide = (
        <g>
          <line x1={sx(eq)} y1={sy(up)} x2={sx(ub)} y2={sy(up)} stroke="currentColor" strokeOpacity="0.55" strokeDasharray="3 3" />
          <line x1={sx(eq)} y1={sy(up)} x2={sx(eq)} y2={H - PB} stroke="currentColor" strokeOpacity="0.25" strokeDasharray="2 3" />
          <circle cx={sx(eq)} cy={sy(up)} r="4.5" fill="none" stroke={BNB} strokeWidth="2" />
          <text x={(sx(eq) + sx(ub)) / 2} y={sy(up) - 6} textAnchor="middle" fontSize="11" className="fill-foreground font-mono">
            {f2(ub - eq)} bits
          </text>
        </g>
      )
    }
  } else {
    const [bb, bp] = picks[i]
    const [rb, rp] = m.ref as Pt
    readout = (
      <>
        No Unsloth curve is plotted for this model. Against its own uncompressed point ({f2(rb)} bits,
        perplexity {f2(rp)}), bnb2 at <span className="text-foreground">{f2(bb)}</span> bits scores{" "}
        <span className="text-foreground">{f2(bp)}</span>, which is{" "}
        <span className="font-semibold text-foreground">{pct((bp / rp - 1) * 100)}</span> perplexity.
      </>
    )
    guide = (
      <g>
        <line x1={sx(bb)} y1={sy(rp)} x2={sx(rb)} y2={sy(rp)} stroke="currentColor" strokeOpacity="0.3" strokeDasharray="3 3" />
        <line x1={sx(bb)} y1={sy(bp)} x2={sx(bb)} y2={sy(rp)} stroke="currentColor" strokeOpacity="0.55" strokeDasharray="3 3" />
        <circle cx={sx(bb)} cy={sy(bp)} r="5" fill="none" stroke={BNB} strokeWidth="2" />
      </g>
    )
  }

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          equal-perplexity gap · digitized from the paper&apos;s Figure 4
        </span>
        <div className="flex flex-wrap gap-1">
          {MODELS.map((x) => (
            <button
              key={x.id}
              type="button"
              onClick={() => {
                setMid(x.id)
                setSel(0)
              }}
              aria-pressed={mid === x.id}
              className={cn(
                "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-xs transition-colors",
                mid === x.id
                  ? "border-foreground/30 bg-muted/50 text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              {x.label}
            </button>
          ))}
        </div>
      </div>

      <div className="p-3 sm:p-4">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full"
          role="img"
          aria-label={`WikiText-2 perplexity against bits per weight for ${m.label}: bnb2${isRef ? " and the uncompressed checkpoint" : " and Unsloth dynamic GGUF"}. Lower is better.`}
        >
          {yTicks.map((v) => (
            <g key={`y${v}`}>
              <line x1={PL} y1={sy(v)} x2={W - PR} y2={sy(v)} stroke="currentColor" strokeOpacity="0.07" />
              <text x={PL - 6} y={sy(v) + 3} textAnchor="end" fontSize="10" className="fill-muted-foreground font-mono">
                {v.toFixed(step < 0.5 ? 2 : 1)}
              </text>
            </g>
          ))}
          {xTicks.map((v) => (
            <g key={`x${v}`}>
              <line x1={sx(v)} y1={PT} x2={sx(v)} y2={H - PB} stroke="currentColor" strokeOpacity="0.07" />
              <text x={sx(v)} y={H - PB + 14} textAnchor="middle" fontSize="10" className="fill-muted-foreground font-mono">
                {v.toFixed(1)}
              </text>
            </g>
          ))}
          <text x={(PL + W - PR) / 2} y={H - 4} textAnchor="middle" fontSize="10" className="fill-muted-foreground font-mono">
            bits per weight
          </text>

          {m.unsloth.length > 0 ? (
            <g>
              <path d={path(m.unsloth)} fill="none" stroke={UNS} strokeWidth="2" strokeDasharray="4 3" />
              {m.unsloth.map(([b, p], k) => (
                <rect
                  key={`u${k}`}
                  x={sx(b) - 4}
                  y={sy(p) - 4}
                  width="8"
                  height="8"
                  fill={UNS}
                  stroke={k === i ? "currentColor" : "none"}
                  strokeWidth="1.5"
                />
              ))}
            </g>
          ) : null}

          <path d={path(m.bnb2)} fill="none" stroke={BNB} strokeWidth="2.25" />
          {m.bnb2.map(([b, p], k) => (
            <circle
              key={`b${k}`}
              cx={sx(b)}
              cy={sy(p)}
              r="3.5"
              fill={BNB}
            />
          ))}

          {m.ref ? (
            <g>
              <circle cx={sx(m.ref[0])} cy={sy(m.ref[1])} r="5" fill={REF} />
              <text x={sx(m.ref[0])} y={sy(m.ref[1]) - 9} textAnchor="middle" fontSize="10" className="fill-muted-foreground font-mono">
                uncompressed
              </text>
            </g>
          ) : null}

          {guide}

          <g fontSize="10" className="font-mono">
            <line x1={W - PR - 150} y1={PT + 8} x2={W - PR - 130} y2={PT + 8} stroke={BNB} strokeWidth="2.25" />
            <text x={W - PR - 125} y={PT + 11} className="fill-muted-foreground">bnb2</text>
            {isRef ? null : (
              <>
                <line x1={W - PR - 150} y1={PT + 24} x2={W - PR - 130} y2={PT + 24} stroke={UNS} strokeWidth="2" strokeDasharray="4 3" />
                <text x={W - PR - 125} y={PT + 27} className="fill-muted-foreground">Unsloth GGUF</text>
              </>
            )}
          </g>
        </svg>

        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <span className="font-mono text-xs text-muted-foreground">
            {isRef ? "bnb2 point:" : "Unsloth checkpoint:"}
          </span>
          {picks.map(([b], k) => (
            <button
              key={`p${k}`}
              type="button"
              onClick={() => setSel(k)}
              aria-pressed={i === k}
              className={cn(
                "cursor-pointer rounded border px-2 py-0.5 font-mono text-xs tabular-nums transition-colors",
                i === k
                  ? "border-foreground/30 bg-muted/50 text-foreground"
                  : "border-border text-muted-foreground hover:text-foreground"
              )}
            >
              {f2(b)}
            </button>
          ))}
        </div>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">{readout}</p>
        <p className="mt-1 text-xs leading-5 text-muted-foreground/80">
          Reported perplexities, digitized from the PDF&apos;s vector plot; the equal-quality crossing is my linear
          interpolation between plotted points. bnb2 bits count resident weights only.
        </p>
      </div>
    </figure>
  )
}
