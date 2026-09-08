"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { mlog10, mpow } from "@/lib/dmath"

// Every number below is read straight off Extropic's own published table and
// its "Model details" footnotes (extropic.ai/writing/z1t, September 4 2026):
//
//   H100 energy/token @ 10% MFU  = 40.9  µJ   ->  H100/Z1T ~139x   H100/Z1-layers ~4,680x
//   H100 energy/token @ 50% MFU  = 8.17  µJ   ->  H100/Z1T ~28x    H100/Z1-layers ~935x
//   H100 energy/token @ 100% MFU = 4.09  µJ   ->  H100/Z1T ~14x    H100/Z1-layers ~468x
//   Z1T total  = 294.52 nJ (8.74 nJ Z1 sampling + 285.78 nJ FPGA), excludes the final logit layer
//
// The three published H100 points fall on a single curve: energy(MFU) = energy(100%) / MFU,
// exactly what "32-bit floating-point peak energy 0.177 pJ/FLOP, fixed FLOPs/token, MFU varied"
// implies (40.9 = 4.09/0.10, 8.17 ~ 4.09/0.50). That lets the slider interpolate anywhere on
// the curve Extropic itself defines, not just the three rows they chose to print.
//
// The post's own citation for real-world MFU: "In LLMs such as Llama 3, MFU is around 40%"
// (their ref [23], the Llama 3 Herd of Models paper) -- marked below as the realistic point,
// against the 10% row that produces the headline ratio.
//
// Both energy figures are analytical models, not a wall-socket measurement on either chip --
// see the article text. This widget only recomputes what the post already discloses.

const H100_AT_100_NJ = 4090 // 4.09 uJ, in nJ
const Z1T_SYSTEM_NJ = 294.52
const Z1T_LAYERS_NJ = 8.74
const Z1T_FPGA_NJ = 285.78

const COPPER = "oklch(0.62 0.14 45)"
const GOLD = "oklch(0.78 0.15 90)"
const GOLD_DIM = "oklch(0.62 0.1 90)"

type Denom = "system" | "layers"

const MARKS: { mfu: number; label: string; sub: string }[] = [
  { mfu: 10, label: "10%", sub: "the post's headline row" },
  { mfu: 40, label: "40%", sub: "Llama 3, real-world (their own citation)" },
  { mfu: 50, label: "50%", sub: "" },
  { mfu: 100, label: "100%", sub: "H100 at full utilization" },
]

function fmtNJ(nj: number): string {
  if (nj >= 1000) return `${(nj / 1000).toFixed(nj >= 10000 ? 1 : 2)} µJ`
  return `${nj.toFixed(nj >= 100 ? 0 : 1)} nJ`
}

export function EnergyPerToken() {
  const [mfu, setMfu] = useState(10)
  const [denom, setDenom] = useState<Denom>("system")

  const h100Nj = H100_AT_100_NJ / (mfu / 100)
  const z1Nj = denom === "system" ? Z1T_SYSTEM_NJ : Z1T_LAYERS_NJ
  const ratio = h100Nj / z1Nj

  // log scale, nJ, 10^0 to 10^5
  const W = 700
  const BAR_X0 = 150
  const BAR_X1 = 660
  const LO = 0
  const HI = 5
  const PX = (nj: number) => BAR_X0 + ((mlog10(Math.max(1, nj)) - LO) / (HI - LO)) * (BAR_X1 - BAR_X0)

  const barY = { h100: 24, z1: 64 }
  const barH = 22

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">energy per token, at adjustable H100 utilization</span>
        <div className="flex gap-1.5">
          {(
            [
              ["system", "vs. Z1T system (Z1 + FPGA)"],
              ["layers", "vs. Z1 layers only"],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              type="button"
              onClick={() => setDenom(k)}
              aria-pressed={denom === k}
              className={`cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors ${
                denom === k
                  ? "border-foreground/30 bg-muted/50 text-foreground"
                  : "border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="p-3 sm:p-4">
        <div className="overflow-x-auto">
          <svg viewBox={`0 0 ${W} 108`} width={W} height={108} role="img" className="min-w-[660px] max-w-full">
            <title>
              Two horizontal bars on a logarithmic energy-per-token axis from 1 nanojoule to 100 microjoules.
              The H100 bar moves with the utilization slider; the Z1T bar is fixed at 294.52 nanojoules
              (or 8.74 nanojoules for Z1 layers alone) and split into its FPGA and Z1 shares.
            </title>

            <text x={BAR_X0 - 10} y={barY.h100 + barH / 2 + 4} fontSize={10} textAnchor="end" fill={COPPER} fontFamily="ui-monospace, monospace">
              H100
            </text>
            <rect x={BAR_X0} y={barY.h100} width={Math.max(0, PX(h100Nj) - BAR_X0)} height={barH} rx={3} fill={COPPER} fillOpacity={0.85} />
            <text x={PX(h100Nj) + 8} y={barY.h100 + barH / 2 + 4} fontSize={10.5} fill={COPPER} fontFamily="ui-monospace, monospace">
              {fmtNJ(h100Nj)}
            </text>

            <text x={BAR_X0 - 10} y={barY.z1 + barH / 2 + 4} fontSize={10} textAnchor="end" fill={GOLD} fontFamily="ui-monospace, monospace">
              Z1T
            </text>
            {denom === "system" ? (
              <>
                <rect x={BAR_X0} y={barY.z1} width={Math.max(0, PX(Z1T_FPGA_NJ) - BAR_X0)} height={barH} rx={3} fill={GOLD_DIM} />
                <rect
                  x={PX(Z1T_FPGA_NJ)}
                  y={barY.z1}
                  width={Math.max(2, PX(Z1T_SYSTEM_NJ) - PX(Z1T_FPGA_NJ))}
                  height={barH}
                  fill={GOLD}
                />
              </>
            ) : (
              <rect x={BAR_X0} y={barY.z1} width={Math.max(2, PX(Z1T_LAYERS_NJ) - BAR_X0)} height={barH} fill={GOLD} />
            )}
            <text x={PX(z1Nj) + 8} y={barY.z1 + barH / 2 + 4} fontSize={10.5} fill={GOLD} fontFamily="ui-monospace, monospace">
              {fmtNJ(z1Nj)}
              {denom === "system" ? ` (${fmtNJ(Z1T_FPGA_NJ)} FPGA + ${fmtNJ(Z1T_LAYERS_NJ)} Z1)` : ""}
            </text>

            <line x1={BAR_X0} y1={94} x2={BAR_X1} y2={94} stroke="currentColor" strokeOpacity={0.25} />
            {[0, 1, 2, 3, 4, 5].map((e) => (
              <g key={e}>
                <line x1={PX(mpow(10, e))} y1={94} x2={PX(mpow(10, e))} y2={97} stroke="currentColor" strokeOpacity={0.25} />
                <text x={PX(mpow(10, e))} y={106} fontSize={8} textAnchor="middle" fill="currentColor" fillOpacity={0.42} fontFamily="ui-monospace, monospace">
                  10<tspan fontSize={6} dy={-3}>{e - 9}</tspan>
                </text>
              </g>
            ))}
          </svg>
        </div>

        <div className="mt-3 flex items-center gap-2">
          <span className="w-32 shrink-0 whitespace-nowrap font-mono text-[10px] text-muted-foreground">
            H100 utilization
          </span>
          <Range
            min={5}
            max={100}
            step={1}
            value={mfu}
            onChange={(e) => setMfu(Number(e.target.value))}
            className="flex-1"
            aria-label="H100 model FLOPs utilization, from 5% to 100%"
            accent={COPPER}
          />
          <span className="w-10 shrink-0 text-right font-mono text-[10px] tabular-nums text-foreground">{mfu}%</span>
        </div>

        <div className="mt-2 flex flex-wrap gap-1.5">
          {MARKS.map((m) => (
            <button
              key={m.label}
              type="button"
              onClick={() => setMfu(m.mfu)}
              className={`cursor-pointer rounded-full border px-2 py-0.5 font-mono text-[9.5px] transition-colors ${
                mfu === m.mfu
                  ? "border-foreground/30 bg-muted/50 text-foreground"
                  : "border-border text-muted-foreground hover:text-foreground"
              }`}
              title={m.sub}
            >
              {m.label}
            </button>
          ))}
        </div>

        <div className="mt-3 rounded-lg border bg-muted/20 px-3 py-2.5 text-center">
          <span className="font-mono text-lg tabular-nums" style={{ color: ratio >= 100 ? GOLD : COPPER }}>
            {ratio.toFixed(ratio >= 100 ? 0 : 1)}×
          </span>
          <span className="ml-2 font-mono text-[10.5px] text-muted-foreground">
            H100 energy per token, at {mfu}% utilization, {denom === "system" ? "vs. the full Z1T system" : "vs. Z1's own layers, FPGA excluded"}
          </span>
        </div>

        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          At <strong className="text-foreground">10% MFU</strong> — the row the post leads with — the system-wide ratio is{" "}
          <span style={{ color: GOLD }}>~139×</span>, which is where both the &ldquo;over 100x&rdquo; lede and the{" "}
          separately-circulated <span style={{ color: GOLD }}>~140x</span> figure come from. Slide down to{" "}
          <strong className="text-foreground">40% MFU</strong> — the utilization Extropic&rsquo;s own citation gives for
          real-world LLM serving (Llama 3) — and the same system-wide comparison drops to roughly{" "}
          <span style={{ color: COPPER }}>~35×</span>. At <strong className="text-foreground">100% MFU</strong>, the H100
          running as efficiently as it can in principle, it falls to <span style={{ color: COPPER }}>~14×</span>. Exactly
          one point on this curve clears 100x, and it is also the point furthest from how the post&rsquo;s own source
          describes real GPU utilization. Switch to &ldquo;Z1 layers only&rdquo; and the ratio jumps by roughly another 30×
          at any utilization, because that comparison quietly drops the FPGA — which the post&rsquo;s own numbers show is
          doing more than 95% of the system&rsquo;s work today.
        </p>
      </div>
    </figure>
  )
}
