"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"

// Alpie Seed's reported score minus the base model's reported score, benchmark by benchmark.
// Both columns are REPORTED: Alpie's by 169Pi (FP16 checkpoint, thinking on, temperature 0, 65,536 max tokens),
// the base's by the Qwen team on the Qwen/Qwen3.5-9B model card. Neither was rerun here, and the two were
// produced by different harnesses. SWE-Bench Verified and AIME 2026 are left out: Alpie's card gives Qwen3.5-9B
// 60.0 and 69.4, but neither number is on the Qwen3.5-9B card, and 169Pi's own report lists Qwen's SWE-Bench as
// "Not reported".
const ROWS = [
  { b: "MMLU-Pro", base: 82.5, alpie: 82.54, vis: false },
  { b: "GPQA Diamond", base: 81.7, alpie: 84.32, vis: false },
  { b: "LiveCodeBench v6", base: 65.6, alpie: 72.99, vis: false },
  { b: "MMMU-Pro", base: 70.1, alpie: 68.7, vis: true },
  { b: "MathVision", base: 78.9, alpie: 76.76, vis: true },
  { b: "RealWorldQA", base: 80.3, alpie: 80.39, vis: true },
  { b: "MMStar", base: 79.7, alpie: 78.87, vis: true },
  { b: "HallusionBench", base: 69.3, alpie: 79.88, vis: true },
  { b: "OCRBench", base: 89.2, alpie: 90.3, vis: true },
]

const C_UP = "oklch(0.62 0.15 150)"
const C_DN = "oklch(0.63 0.17 35)"
const C_BAND = "oklch(0.70 0.02 260 / 0.25)"

export function BaseDelta() {
  const [band, setBand] = useState(2)
  const span = 12
  const x = (d: number) => 50 + (Math.max(-span, Math.min(span, d)) / span) * 46
  const outside = ROWS.filter((r) => Math.abs(r.alpie - r.base) > band).length

  return (
    <figure className="my-8 overflow-hidden rounded-md border">
      <div className="border-b px-3 py-2 font-mono text-xs text-muted-foreground">
        Alpie Seed minus Qwen3.5-9B, in points · both reported, by different teams and harnesses
      </div>
      <div className="px-4 pt-3">
        <svg viewBox={`0 0 100 ${ROWS.length * 6 + 6}`} className="w-full" role="img" aria-label="Score differences between Alpie Seed and its base model on nine benchmarks">
          <rect x={x(-band)} y={0} width={x(band) - x(-band)} height={ROWS.length * 6 + 1} fill={C_BAND} />
          <line x1={50} x2={50} y1={0} y2={ROWS.length * 6 + 1} stroke="currentColor" strokeOpacity={0.4} strokeWidth={0.2} />
          {ROWS.map((r, i) => {
            const d = r.alpie - r.base
            const y = i * 6 + 1
            return (
              <g key={r.b}>
                <text x={1} y={y + 3.4} fontSize={2.2} className="fill-foreground font-mono">
                  {r.b}
                  {r.vis ? " (vision)" : ""}
                </text>
                <rect x={Math.min(50, x(d))} y={y + 1} width={Math.abs(x(d) - 50)} height={3.4} rx={0.4} fill={d >= 0 ? C_UP : C_DN} opacity={Math.abs(d) > band ? 1 : 0.4} />
                <text x={d >= 0 ? x(d) + 0.8 : x(d) - 0.8} y={y + 3.4} fontSize={2} textAnchor={d >= 0 ? "start" : "end"} className="fill-muted-foreground font-mono">
                  {d >= 0 ? "+" : ""}
                  {d.toFixed(2)}
                </text>
              </g>
            )
          })}
          {[-10, -5, 0, 5, 10].map((t) => (
            <text key={t} x={x(t)} y={ROWS.length * 6 + 5} fontSize={1.9} textAnchor="middle" className="fill-muted-foreground font-mono">
              {t > 0 ? `+${t}` : t}
            </text>
          ))}
        </svg>
      </div>
      <div className="space-y-2 border-t px-4 py-3">
        <label className="flex items-center gap-3 text-xs">
          <span className="w-44 shrink-0 font-mono text-muted-foreground">harness gap you allow</span>
          <Range min={0} max={6} step={0.25} value={band} onChange={(e) => setBand(Number(e.target.value))} aria-label="harness gap in points" className="w-full" />
          <span className="w-20 shrink-0 text-right font-mono tabular-nums">±{band.toFixed(2)}</span>
        </label>
        <p className="font-mono text-[11px] text-muted-foreground">
          {outside} of {ROWS.length} differences fall outside ±{band.toFixed(2)} points. The grey band is your assumption, not a measurement: the two
          columns come from different evaluation setups, and the vision tower is bit-identical in both models.
        </p>
      </div>
    </figure>
  )
}
