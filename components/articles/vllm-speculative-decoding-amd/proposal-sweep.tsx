"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { cn } from "@/lib/utils"

// The post's own proposal-length sweep, reproduced exactly — one target model
// (Qwen3.5-122B-A10B), all four of its benchmarked workloads, both a
// sequential method (native MTP, N = 1..7) and a parallel one (DFlash,
// N = 3, 7, 11, 15 — DFlash proposes a whole block, so only block-sized N are
// meaningful). Every value below is a throughput ratio read directly from the
// appendix's per-model tables; nothing is interpolated or invented, which is
// why the marker only ever snaps to a tested N.
type Workload = "gsm8k" | "math500" | "humaneval" | "mbpp"

const NATIVE_N = [1, 2, 3, 4, 5, 6, 7]
const NATIVE: Record<Workload, number[]> = {
  gsm8k: [1.02, 1.47, 1.64, 1.81, 1.98, 1.98, 2.08],
  math500: [1.06, 1.58, 1.82, 1.97, 2.14, 2.13, 2.2],
  humaneval: [1.02, 1.46, 1.69, 1.69, 1.83, 1.83, 1.85],
  mbpp: [0.99, 1.43, 1.6, 1.66, 1.75, 1.84, 1.88],
}

const DFLASH_N = [3, 7, 11, 15]
const DFLASH: Record<Workload, number[]> = {
  gsm8k: [1.41, 1.58, 1.38, 1.01],
  math500: [1.62, 1.78, 1.64, 1.25],
  humaneval: [1.4, 1.66, 1.2, 0.94],
  mbpp: [1.38, 1.05, 1.34, 0.95],
}

const WORKLOADS: { key: Workload; label: string }[] = [
  { key: "gsm8k", label: "GSM8K" },
  { key: "math500", label: "MATH500" },
  { key: "humaneval", label: "HumanEval" },
  { key: "mbpp", label: "MBPP" },
]

const NATIVE_C = "oklch(0.6 0.15 255)"
const DFLASH_C = "oklch(0.65 0.17 25)"
const WARN = "oklch(0.62 0.19 25)"

export function ProposalSweep() {
  const [wl, setWl] = useState<Workload>("math500")
  const [idx, setIdx] = useState(1) // index into DFLASH_N; drives the scrub marker

  const nativeSeries = NATIVE[wl]
  const dflashSeries = DFLASH[wl]

  const W = 700
  const H = 220
  const padL = 34
  const padR = 14
  const padT = 14
  const padB = 26
  const plotW = W - padL - padR
  const plotH = H - padT - padB

  const yMax = 2.4
  const yMin = 0.8
  const yFor = (r: number) => padT + plotH - ((r - yMin) / (yMax - yMin)) * plotH
  // Shared x-axis is "proposal length N", plotted on its own scale so the two
  // methods' differently-spaced N values (1..7 vs 3,7,11,15) both land correctly.
  const nMax = 15
  const xFor = (n: number) => padL + (n / nMax) * plotW

  const path = (ns: number[], series: number[]) =>
    ns.map((n, i) => `${i === 0 ? "M" : "L"} ${xFor(n).toFixed(1)} ${yFor(series[i]).toFixed(1)}`).join(" ")

  const dN = DFLASH_N[idx]
  const dRatio = dflashSeries[idx]
  const belowBaseline = dRatio < 1

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">Qwen3.5-122B-A10B · throughput ratio vs. proposal length N</span>
        <span className="flex items-center gap-3 font-mono text-[10px]">
          <span className="flex items-center gap-1" style={{ color: NATIVE_C }}>
            <span className="h-2 w-2 rounded-full" style={{ background: NATIVE_C }} /> native MTP
          </span>
          <span className="flex items-center gap-1" style={{ color: DFLASH_C }}>
            <span className="h-2 w-2 rounded-full" style={{ background: DFLASH_C }} /> DFlash
          </span>
        </span>
      </div>

      <div className="p-3 sm:p-4">
        <div className="flex flex-wrap gap-1.5">
          {WORKLOADS.map((w) => (
            <button
              key={w.key}
              type="button"
              onClick={() => setWl(w.key)}
              aria-pressed={wl === w.key}
              className={cn(
                "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
                wl === w.key
                  ? "border-foreground/30 bg-muted/50 text-foreground"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {w.label}
            </button>
          ))}
        </div>

        <div className="mt-3 overflow-x-auto">
          <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" className="min-w-[560px] max-w-full">
            <title>
              {`Throughput ratio versus proposal length N for native MTP and DFlash on Qwen3.5-122B-A10B, ${wl.toUpperCase()}. Native MTP rises through N=7 without crossing below baseline in this range; DFlash peaks near N=7 and falls back toward or below the 1.0x baseline by N=15.`}
            </title>

            {/* below-baseline shading */}
            <rect x={padL} y={yFor(1)} width={plotW} height={yFor(yMin) - yFor(1)} fill={WARN} fillOpacity={0.06} />
            <line x1={padL} y1={yFor(1)} x2={W - padR} y2={yFor(1)} stroke="currentColor" strokeOpacity={0.3} strokeDasharray="2,3" />
            <text x={padL} y={yFor(1) - 4} fontSize={9} fill="currentColor" fillOpacity={0.5} fontFamily="ui-monospace, monospace">
              1.0x — baseline
            </text>

            {/* y gridlines / ticks */}
            {[1, 1.5, 2].map((t) => (
              <g key={t}>
                <line x1={padL} y1={yFor(t)} x2={W - padR} y2={yFor(t)} stroke="currentColor" strokeOpacity={0.06} />
                <text x={4} y={yFor(t) + 3} fontSize={9} fill="currentColor" fillOpacity={0.45} fontFamily="ui-monospace, monospace">
                  {t}x
                </text>
              </g>
            ))}

            {/* x ticks at tested N values */}
            {[1, 3, 7, 11, 15].map((n) => (
              <text key={n} x={xFor(n)} y={H - 8} fontSize={9} textAnchor="middle" fill="currentColor" fillOpacity={0.45} fontFamily="ui-monospace, monospace">
                {n}
              </text>
            ))}
            <text x={W - padR} y={H - 8} fontSize={9} textAnchor="end" fill="currentColor" fillOpacity={0.35} fontFamily="ui-monospace, monospace">
              N →
            </text>

            {/* series */}
            <path d={path(NATIVE_N, nativeSeries)} fill="none" stroke={NATIVE_C} strokeWidth={2} />
            {NATIVE_N.map((n, i) => (
              <circle key={`nn${n}`} cx={xFor(n)} cy={yFor(nativeSeries[i])} r={2.5} fill={NATIVE_C} />
            ))}

            <path d={path(DFLASH_N, dflashSeries)} fill="none" stroke={DFLASH_C} strokeWidth={2} />
            {DFLASH_N.map((n, i) => (
              <circle key={`dn${n}`} cx={xFor(n)} cy={yFor(dflashSeries[i])} r={2.5} fill={DFLASH_C} />
            ))}

            {/* scrub marker on the DFlash curve */}
            <line x1={xFor(dN)} y1={padT} x2={xFor(dN)} y2={H - padB} stroke={DFLASH_C} strokeOpacity={0.35} strokeDasharray="2,2" />
            <circle cx={xFor(dN)} cy={yFor(dRatio)} r={5.5} fill="none" stroke={DFLASH_C} strokeWidth={2} />
          </svg>
        </div>

        <div className="mt-1">
          <div className="mb-1 flex items-center justify-between font-mono text-[10px] text-muted-foreground">
            <span>scrub DFlash&rsquo;s tested block lengths</span>
            <span style={{ color: belowBaseline ? WARN : DFLASH_C }}>
              N={dN}: {dRatio.toFixed(2)}x{belowBaseline ? " — slower than no speculation at all" : ""}
            </span>
          </div>
          <Range
            min={0}
            max={DFLASH_N.length - 1}
            step={1}
            value={idx}
            onChange={(e) => setIdx(Number(e.target.value))}
            className="w-full cursor-pointer"
            accent={DFLASH_C}
          />
        </div>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          The two methods fail differently. <span style={{ color: NATIVE_C }}>Native MTP</span>, sequential and
          cheap per step, keeps climbing through every tested N on all four workloads here — diminishing returns,
          never a crash. <span style={{ color: DFLASH_C }}>DFlash</span>, which drafts and verifies a whole block
          in one pass, peaks near N=7 and then gives it back: on HumanEval it falls to{" "}
          <span style={{ color: WARN }}>0.94x</span> at N=15, and on MBPP to{" "}
          <span style={{ color: WARN }}>0.95x</span> — both slower than not speculating. Verifying a longer block
          costs the same whether the tail is right or not, and per-position acceptance in the post&rsquo;s own
          heatmaps drops from roughly 90% at position 1 to under 20% by position 15.
        </p>
      </div>
    </figure>
  )
}
