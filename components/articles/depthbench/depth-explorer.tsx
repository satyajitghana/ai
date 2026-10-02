"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { cn } from "@/lib/utils"

// Validation loss vs width-depth aspect ratio, from DepthBench's Figure 1(a), for
// five residual designs on the 400M benchmark (fixed ~400M params, 8B FineWeb-Edu
// tokens, best learning rate per architecture). The slider moves a cursor across the
// seven shapes; the readout ranks the designs at that shape and shows the systems
// cost the paper charges for depth.
//
// Loss values are read off Figure 1(a). The endpoints match the numbers stated in
// the paper's text exactly: Pre-LN 2.759 -> 2.782 (L16 -> L32), Full AttnRes
// 2.751 -> 2.718, HC 2.729 -> 2.699, Block AttnRes best 2.715 at L20, mHC best at
// L24. Intermediate points are plot reads (+-0.002). Pre-LN and Block AttnRes were
// not run at the two extreme deep shapes in Figure 1(a), so they are blank there.
//
// Prefill FLOPs (transformer body, T=4096) and KV-cache size reproduce the paper's
// Figure 11 claim (3.0 -> 4.4 TFLOP/seq, >2x KV) from Appendix D's own formula
// F = L(8Td^2 + 6T d d_ff + 2 T^2 d), KV = 2 . 2 . T . L . d bytes in BF16.

type Shape = { ar: number; L: number; d: number; dff: number; tflop: number; kv: number }

// index 0 = deepest-narrowest (aspect 9.1), index 6 = shallowest-widest (aspect 76)
const SHAPES: Shape[] = [
  { ar: 9.1, L: 70, d: 640, dff: 1712, tflop: 4.33, kv: 734 },
  { ar: 19.0, L: 42, d: 800, dff: 2144, tflop: 3.78, kv: 551 },
  { ar: 28.0, L: 32, d: 896, dff: 2400, tflop: 3.5, kv: 470 },
  { ar: 42.7, L: 24, d: 1024, dff: 2736, tflop: 3.3, kv: 403 },
  { ar: 56.0, L: 20, d: 1120, dff: 2992, tflop: 3.22, kv: 367 },
  { ar: 76.0, L: 16, d: 1216, dff: 3248, tflop: 2.98, kv: 319 },
]

type Design = { name: string; color: string; loss: (number | null)[]; note: string }

const DESIGNS: Design[] = [
  {
    name: "HC",
    color: "oklch(0.55 0.21 292)",
    loss: [2.681, 2.691, 2.7, 2.702, 2.716, 2.729],
    note: "keeps improving into the deep end",
  },
  {
    name: "Full AttnRes",
    color: "oklch(0.62 0.21 27)",
    loss: [2.701, 2.708, 2.718, 2.726, 2.729, 2.751],
    note: "keeps improving into the deep end",
  },
  {
    name: "mHC",
    color: "oklch(0.72 0.12 300)",
    loss: [2.751, 2.723, 2.722, 2.71, 2.72, 2.72],
    note: "best at L=24, then rises",
  },
  {
    name: "Block AttnRes",
    color: "oklch(0.68 0.13 52)",
    loss: [null, null, 2.73, 2.719, 2.715, 2.734],
    note: "best at L=20, then rises",
  },
  {
    name: "Pre-LN",
    color: "oklch(0.52 0.02 260)",
    loss: [null, null, 2.782, 2.767, 2.759, 2.759],
    note: "worse the deeper it gets",
  },
]

const COST = "oklch(0.6 0.02 230)"

const W = 720
const H = 352
const PL = 52
const PR = 690
const PT = 30
const PB = 276
const LMIN = 2.674
const LMAX = 2.79
const TFMIN = 2.8
const TFMAX = 4.5

const xPix = (i: number) => PL + (i / (SHAPES.length - 1)) * (PR - PL)
const yPix = (loss: number) => PB - ((loss - LMIN) / (LMAX - LMIN)) * (PB - PT)
const yCost = (t: number) => PB - ((t - TFMIN) / (TFMAX - TFMIN)) * (PB - PT)

function path(loss: (number | null)[]): string {
  let d = ""
  let pen = false
  loss.forEach((v, i) => {
    if (v == null) {
      pen = false
      return
    }
    d += (pen ? "L " : "M ") + xPix(i).toFixed(1) + " " + yPix(v).toFixed(1) + " "
    pen = true
  })
  return d
}

function costPath(): string {
  let d = ""
  SHAPES.forEach((s, i) => {
    d += (i === 0 ? "M " : "L ") + xPix(i).toFixed(1) + " " + yCost(s.tflop).toFixed(1) + " "
  })
  return d
}

export function DepthExplorer() {
  const [idx, setIdx] = useState(0)
  const [showCost, setShowCost] = useState(false)
  const s = SHAPES[idx]

  const ranked = DESIGNS.map((dz) => ({ name: dz.name, color: dz.color, v: dz.loss[idx] }))
    .filter((r): r is { name: string; color: string; v: number } => r.v != null)
    .sort((a, b) => a.v - b.v)

  const gridLoss = [2.68, 2.7, 2.72, 2.74, 2.76, 2.78]

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          validation loss vs aspect ratio &middot; 400M, 8B tokens
        </span>
        <button
          type="button"
          onClick={() => setShowCost((c) => !c)}
          aria-pressed={showCost}
          className={cn(
            "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
            showCost
              ? "border-foreground/30 bg-muted/50 text-foreground"
              : "border-border text-muted-foreground hover:text-foreground"
          )}
        >
          overlay prefill FLOPs
        </button>
      </div>

      <div className="space-y-3 p-3 sm:p-4">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full"
          role="img"
          aria-label="Validation loss against width-depth aspect ratio for five residual designs"
        >
          {gridLoss.map((g) => (
            <g key={g}>
              <line
                x1={PL}
                x2={PR}
                y1={yPix(g)}
                y2={yPix(g)}
                stroke="var(--border)"
                strokeWidth={1}
                strokeDasharray="2 3"
              />
              <text x={PL - 7} y={yPix(g) + 3} textAnchor="end" className="fill-muted-foreground font-mono text-[10px]">
                {g.toFixed(2)}
              </text>
            </g>
          ))}

          {/* selected-shape cursor */}
          <line x1={xPix(idx)} x2={xPix(idx)} y1={PT - 6} y2={PB} stroke="var(--foreground)" strokeWidth={1} opacity={0.28} />

          {/* cost overlay */}
          {showCost ? (
            <>
              <path d={costPath()} fill="none" stroke={COST} strokeWidth={1.5} strokeDasharray="5 3" opacity={0.85} />
              {SHAPES.map((sh, i) => (
                <circle key={`c${i}`} cx={xPix(i)} cy={yCost(sh.tflop)} r={2.4} fill={COST} opacity={0.85} />
              ))}
              <text x={xPix(0) + 6} y={yCost(SHAPES[0].tflop) - 7} className="fill-muted-foreground font-mono text-[10px]">
                {SHAPES[0].tflop} TFLOP
              </text>
              <text x={PR} y={yCost(SHAPES[SHAPES.length - 1].tflop) + 13} textAnchor="end" className="fill-muted-foreground font-mono text-[10px]">
                prefill FLOPs/seq
              </text>
            </>
          ) : null}

          {/* loss lines */}
          {DESIGNS.map((dz) => (
            <g key={dz.name}>
              <path d={path(dz.loss)} fill="none" stroke={dz.color} strokeWidth={dz.name === "Pre-LN" ? 2 : 2.2} />
              {dz.loss.map((v, i) =>
                v == null ? null : (
                  <circle
                    key={i}
                    cx={xPix(i)}
                    cy={yPix(v)}
                    r={i === idx ? 4 : 2.4}
                    fill={dz.color}
                    stroke="var(--background)"
                    strokeWidth={i === idx ? 1.5 : 0}
                  />
                )
              )}
            </g>
          ))}

          {/* x ticks */}
          {SHAPES.map((sh, i) => (
            <text key={i} x={xPix(i)} y={PB + 16} textAnchor="middle" className={cn("font-mono text-[10px]", i === idx ? "fill-foreground" : "fill-muted-foreground")}>
              {sh.ar}
            </text>
          ))}
          <text x={(PL + PR) / 2} y={PB + 34} textAnchor="middle" className="fill-muted-foreground font-mono text-[10px]">
            aspect ratio d / L &nbsp;&larr; deeper-narrower &nbsp;&middot;&nbsp; shallower-wider &rarr;
          </text>
        </svg>

        <div className="flex items-center gap-3">
          <span className="shrink-0 font-mono text-[11px] text-muted-foreground">shape</span>
          <Range
            min={0}
            max={SHAPES.length - 1}
            step={1}
            value={idx}
            onChange={(e) => setIdx(Number((e.target as HTMLInputElement).value))}
            aria-label="aspect ratio shape"
            className="grow"
          />
          <span className="shrink-0 font-mono text-[11px] tabular-nums text-foreground">
            d/L = {s.ar} &middot; L={s.L}, d={s.d}
          </span>
        </div>

        <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
          <div className="space-y-1.5" role="list" aria-label="ranking at this shape">
            {ranked.map((r, i) => (
              <div key={r.name} className="flex items-center gap-2 font-mono text-[11px]" role="listitem">
                <span className="w-3 shrink-0 text-muted-foreground tabular-nums">{i + 1}</span>
                <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: r.color }} />
                <span className="w-28 shrink-0 text-foreground">{r.name}</span>
                <div className="h-1.5 grow overflow-hidden rounded-sm bg-muted/40">
                  <div
                    className="h-full rounded-sm"
                    style={{ width: `${(((LMAX - r.v) / (LMAX - LMIN)) * 100).toFixed(2)}%`, background: r.color }}
                  />
                </div>
                <span className="w-12 shrink-0 text-right tabular-nums text-foreground">{r.v.toFixed(3)}</span>
              </div>
            ))}
          </div>
          <div className="flex flex-col justify-center gap-1 rounded-lg border bg-muted/20 px-3 py-2 font-mono text-[11px] tabular-nums">
            <div className="text-muted-foreground">systems cost at d/L = {s.ar}</div>
            <div className="text-foreground">prefill {s.tflop} TFLOP/seq</div>
            <div className="text-foreground">KV cache {s.kv} MB</div>
            <div className="text-[10px] text-muted-foreground">T = 4096, BF16</div>
          </div>
        </div>

        <p className="text-[12px] leading-snug text-muted-foreground">
          Loss read from DepthBench Figure 1(a); endpoints match the paper&apos;s stated numbers. HC and Full AttnRes
          fall as capacity moves from width into depth (right to left); Pre-LN rises; mHC bottoms out at d/L&nbsp;=&nbsp;42.7
          (L&nbsp;=&nbsp;24) and Block AttnRes at 56.0 (L&nbsp;=&nbsp;20), then both turn back up. The cost overlay and the
          panel are computed from Appendix D&apos;s FLOP formula and the KV-cache size: the same depth that buys HC and
          AttnRes their gains raises prefill FLOPs and more than doubles the KV cache.
        </p>
      </div>
    </figure>
  )
}
