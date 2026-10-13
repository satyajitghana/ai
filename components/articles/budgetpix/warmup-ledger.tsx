"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

import { blockFlopRatio } from "./quadtree-core"

// Where the layout comes from at sampling time, and what it costs.
//
// BudgetPix runs the first n_w sampling steps on the dense grid, takes the
// model's clean-image estimate x_hat, and builds the entropy quadtree from it
// (arXiv 2610.12307, Sec. 3.4). Data: JiT-B/32 at 512^2, 50 Heun steps with
// classifier-free guidance, FID-10k from the paper's Table 27 (reported).
// Forward counts follow Table 21: 2 Heun stages x cond/uncond per step, the
// last step Euler, so 199 network calls, of which 4*n_w + 1 run dense (the +1
// is the x_hat estimate the first layout is built from; "21 of 199" at
// n_w = 5). The compute fraction is my arithmetic: dense calls at full cost,
// the rest at the per-block FLOP ratio for N = 256 tokens, D = 768 (reasoned).
// The wall-clock speed-ups are Table 11's, at the default n_w = 5 (reported).

const TOTAL = 199
const N = 256
const D = 768

type Row = { nw: number; fid: Record<number, number> }
const ROWS: Row[] = [
  { nw: 0, fid: { 50: 12.44, 25: 20.41 } },
  { nw: 2, fid: { 50: 11.2, 25: 20.33 } },
  { nw: 5, fid: { 50: 10.99, 25: 19.79 } },
  { nw: 10, fid: { 50: 10.36, 25: 18.09 } },
  { nw: 20, fid: { 50: 9.68, 25: 15.73 } },
]
const WALL: Record<number, string> = { 50: "1.14×", 25: "1.36×" }

const DENSE_COL = "oklch(0.55 0.14 300)"
const BUD_COL = "oklch(0.78 0.1 75)"
const ACC = "oklch(0.62 0.17 30)"

const denseCalls = (nw: number) => 4 * nw + 1
const computeFrac = (nw: number, b: number) => {
  const d = denseCalls(nw)
  return (d + (TOTAL - d) * blockFlopRatio(b / 100, N, D)) / TOTAL
}

// chart geometry
const W = 340
const H = 190
const X0 = 40
const X1 = 325
const Y0 = 160
const Y1 = 14
const sx = (c: number) => X0 + ((c - 0.2) / (0.75 - 0.2)) * (X1 - X0)
const sy = (fid: number) => Y0 - ((fid - 8) / (22 - 8)) * (Y0 - Y1)

export function WarmupLedger() {
  const [nw, setNw] = useState(5)
  const [b, setB] = useState<50 | 25>(50)
  const row = ROWS.find((r) => r.nw === nw) as Row
  const dense = denseCalls(nw)
  const frac = computeFrac(nw, b)

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">sampling-time layout · JiT-B/32, 512²</span>
        <div className="flex gap-1.5">
          {([50, 25] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setB(v)}
              aria-pressed={b === v}
              className={cn(
                "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
                b === v
                  ? "border-foreground/30 bg-muted/50 text-foreground"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              budget {v}%
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-4 p-3 sm:p-4">
        <div className="flex flex-wrap items-center gap-1.5 font-mono text-xs">
          <span className="mr-1 text-muted-foreground">dense warm-up steps n_w</span>
          {ROWS.map((r) => (
            <button
              key={r.nw}
              type="button"
              onClick={() => setNw(r.nw)}
              aria-pressed={nw === r.nw}
              className={cn(
                "min-w-8 cursor-pointer rounded-md border px-2 py-1 transition-colors",
                nw === r.nw
                  ? "border-foreground/40 bg-muted/60 text-foreground"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {r.nw}
              {r.nw === 5 ? "*" : ""}
            </button>
          ))}
        </div>

        <div>
          <div className="mb-1 flex justify-between font-mono text-[11px] text-muted-foreground">
            <span>199 network calls, in sampling order</span>
            <span>
              <span style={{ color: DENSE_COL }}>■</span> dense {dense} · <span style={{ color: BUD_COL }}>■</span> at{" "}
              {b}% {TOTAL - dense}
            </span>
          </div>
          <svg viewBox="0 0 400 22" className="h-auto w-full" role="img" aria-label={`${dense} of 199 calls run on the dense grid, ${TOTAL - dense} on the ${b}% layout.`}>
            {Array.from({ length: TOTAL }, (_, i) => (
              <rect
                key={i}
                x={(i % 100) * 4}
                y={i < 100 ? 0 : 12}
                width={3.2}
                height={9}
                rx={0.8}
                fill={i < dense ? DENSE_COL : BUD_COL}
              />
            ))}
          </svg>
        </div>

        <div className="grid gap-4 sm:grid-cols-[1fr_minmax(0,340px)]">
          <div className="space-y-2 font-mono text-xs leading-relaxed">
            <div className="rounded-md border px-3 py-2">
              <div>
                FID-10k <span className="text-base text-foreground">{row.fid[b].toFixed(2)}</span>{" "}
                <span className="text-muted-foreground">(reported)</span>
              </div>
              <div>
                compute vs dense <span className="text-base text-foreground">{(frac * 100).toFixed(1)}%</span>{" "}
                <span className="text-muted-foreground">(reasoned, FLOPs)</span>
              </div>
              <div className="text-muted-foreground">
                wall-clock at n_w = 5: {WALL[b]} faster than dense (reported)
              </div>
            </div>
            <div className="rounded-md border px-3 py-2 text-muted-foreground">
              Same sampler, other layout sources at {b}%: random placement {b === 50 ? "19.51" : "23.41"}; quadtree of a
              finished 50-step dense draft {b === 50 ? "11.30" : "19.58"}; layout built once and frozen{" "}
              {b === 50 ? "10.96" : "19.76"}.
            </div>
          </div>

          <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="FID-10k against reasoned compute for every warm-up length at 50% and 25% budgets.">
            <line x1={X0} y1={Y0} x2={X1} y2={Y0} stroke="currentColor" opacity={0.25} />
            <line x1={X0} y1={Y0} x2={X0} y2={Y1} stroke="currentColor" opacity={0.25} />
            {[0.3, 0.4, 0.5, 0.6, 0.7].map((c) => (
              <text key={c} x={sx(c)} y={Y0 + 13} textAnchor="middle" fontSize={9} fill="currentColor" opacity={0.6}>
                {(c * 100).toFixed(0)}%
              </text>
            ))}
            {[10, 15, 20].map((v) => (
              <g key={v}>
                <line x1={X0} y1={sy(v)} x2={X1} y2={sy(v)} stroke="currentColor" opacity={0.08} />
                <text x={X0 - 6} y={sy(v) + 3} textAnchor="end" fontSize={9} fill="currentColor" opacity={0.6}>
                  {v}
                </text>
              </g>
            ))}
            <text x={X1} y={Y0 + 26} textAnchor="end" fontSize={9} fill="currentColor" opacity={0.6}>
              compute vs dense (reasoned)
            </text>
            <text x={X0 + 4} y={Y1 + 2} fontSize={9} fill="currentColor" opacity={0.6}>
              FID-10k
            </text>
            {([50, 25] as const).map((bb) => (
              <polyline
                key={bb}
                points={ROWS.map((r) => `${sx(computeFrac(r.nw, bb)).toFixed(1)},${sy(r.fid[bb]).toFixed(1)}`).join(" ")}
                fill="none"
                stroke={bb === 50 ? DENSE_COL : BUD_COL}
                strokeWidth={1.5}
                opacity={0.7}
              />
            ))}
            {([50, 25] as const).flatMap((bb) =>
              ROWS.map((r) => {
                const on = r.nw === nw && bb === b
                return (
                  <g key={`${bb}-${r.nw}`}>
                    <circle
                      cx={sx(computeFrac(r.nw, bb))}
                      cy={sy(r.fid[bb])}
                      r={on ? 5.5 : 3}
                      fill={on ? ACC : bb === 50 ? DENSE_COL : BUD_COL}
                      stroke={on ? "white" : "none"}
                      strokeWidth={1.2}
                    />
                    <text
                      x={sx(computeFrac(r.nw, bb))}
                      y={sy(r.fid[bb]) - 7}
                      textAnchor="middle"
                      fontSize={8}
                      fill="currentColor"
                      opacity={on ? 0.95 : 0.5}
                    >
                      {r.nw}
                    </text>
                  </g>
                )
              }),
            )}
            <text x={sx(0.27)} y={sy(21.5)} fontSize={9} fill={BUD_COL}>
              25% budget
            </text>
            <text x={sx(0.6)} y={sy(8.4)} fontSize={9} fill={DENSE_COL}>
              50% budget
            </text>
          </svg>
        </div>
      </div>

      <figcaption className="border-t px-4 py-2.5 text-xs text-muted-foreground">
        FID-10k from the paper&apos;s Table 27 (final JiT-B/32, 50 Heun steps, guidance 3.0, layout rebuilt every 5 steps;
        * marks the default). Call counts follow Table 21. The compute axis is my arithmetic: warm-up calls at full cost,
        the rest at one block&apos;s FLOP ratio for 256 tokens of width 768. JiT-B&apos;s measured wall-clock gains are
        much smaller than its FLOP savings.
      </figcaption>
    </figure>
  )
}
