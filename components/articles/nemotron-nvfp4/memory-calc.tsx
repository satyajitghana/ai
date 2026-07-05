"use client"

import { useState } from "react"

// Honest weight-storage calculator. NVFP4 is NOT free 4× compression: each element
// is 4 bits, but it also carries an FP8 (E4M3) block scale shared over 16 elements
// — 8 bits / 16 = 0.5 extra bits per element — plus a negligible FP32 per-tensor
// scale. So the honest cost is 4.5 bits/element, a 3.56× shrink over BF16's 16,
// not 4×. Slide the parameter count and watch the two bars (and the scale overhead
// sliver inside the NVFP4 bar). Weight storage only — mixed-precision training
// keeps many tensors at higher precision, so live training memory is larger.

const ELT = "oklch(0.60 0.15 255)" // 4-bit elements
const OVER = "oklch(0.72 0.16 60)" // scale overhead

// bits per parameter
const BF16 = 16
const NVFP4_ELT = 4
const NVFP4_SCALE = 8 / 16 // 0.5

const W = 720
const H = 168
const BX = 150
const BW = 540
const bar = (bits: number) => (bits / BF16) * BW

export function MemoryCalc() {
  const [p, setP] = useState(55) // billions of params (active-param default)

  const gb = (bits: number) => (p * 1e9 * bits) / 8 / 1e9
  const nvBits = NVFP4_ELT + NVFP4_SCALE
  const ratio = BF16 / nvBits

  const rows = [
    { name: "BF16", gb: gb(BF16), eltW: bar(BF16), overW: 0 },
    { name: "NVFP4", gb: gb(nvBits), eltW: bar(NVFP4_ELT), overW: bar(NVFP4_SCALE) },
  ]

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex items-center justify-between border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>weight storage · BF16 vs NVFP4</span>
        <span className="text-muted-foreground/50">4.5 bits/param, not 4</span>
      </div>

      <div className="p-3 sm:p-4">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`At ${p} billion parameters, weights take ${gb(BF16).toFixed(0)} GB in BF16 and ${gb(nvBits).toFixed(0)} GB in NVFP4, a ${ratio.toFixed(2)}× reduction.`}>
          <defs>
            <filter id="mc-soft" x="-40%" y="-40%" width="180%" height="180%">
              <feDropShadow dx="0" dy="1" stdDeviation="1.2" floodOpacity="0.12" />
            </filter>
          </defs>

          {rows.map((r, i) => {
            const y = 34 + i * 58
            return (
              <g key={r.name}>
                <text x={BX - 14} y={y + 20} textAnchor="end" className="fill-foreground font-mono" fontSize={12} fontWeight={600}>
                  {r.name}
                </text>
                {/* track */}
                <rect x={BX} y={y} width={BW} height={30} rx={7} fill="var(--muted)" opacity={0.3} />
                {/* element bits */}
                <rect x={BX} y={y} width={r.eltW} height={30} rx={r.overW ? 0 : 7} fill={ELT} filter="url(#mc-soft)" className="transition-all" />
                {r.overW ? (
                  <>
                    {/* round only the left of the element block */}
                    <rect x={BX} y={y} width={8} height={30} fill={ELT} />
                    {/* scale overhead sliver */}
                    <rect x={BX + r.eltW} y={y} width={r.overW} height={30} fill={OVER} className="transition-all" />
                    <rect x={BX + r.eltW + r.overW - 8} y={y} width={8} height={30} rx={7} fill={OVER} />
                  </>
                ) : null}
                {/* value label — rides just past the bar end, but flips INSIDE the
                    bar (right-aligned, light on fill) when it would spill past the
                    figure edge (the BF16 bar is always full width) */}
                {(() => {
                  const label = `${r.gb >= 100 ? r.gb.toFixed(0) : r.gb.toFixed(1)} GB`
                  const barEnd = BX + r.eltW + r.overW
                  const est = label.length * 7.2
                  const inside = barEnd + 10 + est > W - 8
                  return (
                    <text
                      x={inside ? barEnd - 10 : barEnd + 10}
                      y={y + 20}
                      textAnchor={inside ? "end" : "start"}
                      className="font-mono"
                      fontSize={12}
                      fontWeight={600}
                      fill={inside ? "var(--background)" : "var(--foreground)"}
                    >
                      {label}
                    </text>
                  )
                })()}
                {r.overW ? (
                  <text x={BX + r.eltW + r.overW / 2} y={y + 45} textAnchor="middle" className="font-mono" fontSize={9} style={{ fill: OVER }}>
                    +0.5b scale
                  </text>
                ) : null}
              </g>
            )
          })}
        </svg>

        {/* control */}
        <div className="mt-1">
          <div className="mb-1 flex items-center justify-between font-mono text-[10px] text-muted-foreground">
            <span>parameters (drag)</span>
            <span>
              <span className="text-foreground">{p}B</span> params · <span style={{ color: ELT }}>{ratio.toFixed(2)}×</span> smaller
            </span>
          </div>
          <input
            type="range"
            min={1}
            max={550}
            value={p}
            onChange={(e) => setP(Number(e.target.value))}
            className="w-full cursor-pointer accent-[oklch(0.60_0.15_255)]"
          />
          <div className="mt-1 flex justify-between font-mono text-[9px] text-muted-foreground/60">
            <span>1B</span>
            <span>55B active</span>
            <span>550B total</span>
          </div>
        </div>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Storing weights as 4-bit <span style={{ color: ELT }}>elements</span> is not a clean 4× win: NVFP4 also carries
          an <span style={{ color: OVER }}>FP8 block scale</span> shared over 16 elements — 0.5 extra bits each — for a
          real cost of <span className="text-foreground">4.5 bits/param</span> and a{" "}
          <span style={{ color: ELT }}>{ratio.toFixed(2)}×</span> shrink over BF16. And this is weight storage only:
          mixed-precision training keeps embeddings, projections, the final layers and the MTP head at higher precision,
          plus optimizer state and activations — so live training memory is larger than either bar.
        </p>
      </div>
    </figure>
  )
}
