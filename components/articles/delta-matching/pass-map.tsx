"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// The FP8 attention kernel as the paper (Appendix B.6) and the repository's README describe it: a forward and a three-pass
// backward. The only difference between the two modes of the repository's dm_attn_func is whether pass 0 runs and where the
// delta comes from. Read from the paper and the README (REPORTED); we did not run the kernel (it needs a Hopper GPU).

type Mode = "stale" | "matched"

const STAGES = [
  {
    id: "fwd",
    title: "forward",
    lines: ["Q, K, V → E4M3 blocks", "S = Q̂ K̂ᵀ, P in E4M3", "O = P̂ V̂ → stored BF16", "LSE stored FP32"],
    mats: "2 matmuls in FP8",
  },
  {
    id: "p0",
    title: "pass 0",
    lines: ["recompute P from LSE (FP32)", "dP̂ = dÔ V̂ᵀ  (FP8 operands)", "δᵢ = Σⱼ Pᵢⱼ · dP̂ᵢⱼ", "stored FP32"],
    mats: "1 matmul in FP8, matched only",
  },
  {
    id: "p1",
    title: "pass 1",
    lines: ["dS = P · (dP̂ − δ)", "cast dS to E4M3 tiles", "dK = dŜᵀ Q̂,  dV = P̂ᵀ dÔ"],
    mats: "2 matmuls in FP8 (+ dP̂ for stale)",
  },
  {
    id: "p2",
    title: "pass 2",
    lines: ["dQ = dŜ K̂", "from the stored E4M3 dS tiles"],
    mats: "1 matmul in FP8",
  },
]

const NOTE: Record<Mode, string[]> = {
  stale: [
    "stale: pass 0 is skipped. δ = rowsum(dO · O) uses BF16 dO and the saved BF16 output, so the rounding of P̂, dO and the stored O",
    "all enter the row sum of dS, and nothing forces it to zero.",
  ],
  matched: [
    "matched: pass 0 recomputes P and dP̂ and forms δ from them, so the row sum of dS is zero up to FP32 round-off",
    "before the dS cast. The cost is one more pass over the keys.",
  ],
}

export function PassMap() {
  const [mode, setMode] = useState<Mode>("matched")
  const W = 760
  const colW = 170
  const gap = 20
  const H = 246

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">the FP8 attention kernel, pass by pass · from the paper&apos;s Appendix B.6 and the repository README</span>
        <span className="font-mono text-[10px] text-muted-foreground">read, not run: it needs a Hopper GPU</span>
      </div>
      <div className="space-y-3 p-3 sm:p-4">
        <div className="flex flex-wrap gap-1.5">
          {(["stale", "matched"] as Mode[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              aria-pressed={mode === m}
              className={cn(
                "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
                mode === m ? "border-foreground/30 bg-muted/50 text-foreground" : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {m === "stale" ? 'mode="stale"  δ = rowsum(dO · O)' : 'mode="matched"  δ from pass 0'}
            </button>
          ))}
        </div>
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Forward pass and three backward passes of the FP8 attention kernel, with the matched-delta pass shown or skipped">
          {STAGES.map((s, i) => {
            const x = i * (colW + gap)
            const off = s.id === "p0" && mode === "stale"
            return (
              <g key={s.id} opacity={off ? 0.35 : 1}>
                <rect x={x} y={10} width={colW} height={170} rx={8} className="fill-muted/40 stroke-border" />
                <text x={x + 10} y={30} fontSize={12} fontWeight={600} className="fill-foreground">
                  {s.title}
                </text>
                {s.lines.map((l, j) => (
                  <text key={j} x={x + 10} y={52 + j * 18} fontSize={9.5} className="fill-muted-foreground">
                    {l}
                  </text>
                ))}
                <text x={x + 10} y={168} fontSize={9} className="fill-foreground/70">
                  {s.mats}
                </text>
                {i < STAGES.length - 1 && <path d={`M ${x + colW + 3} 95 L ${x + colW + gap - 3} 95`} className="stroke-border" strokeWidth={1.5} />}
              </g>
            )
          })}
          {NOTE[mode].map((l, j) => (
            <text key={j} x={0} y={204 + j * 14} fontSize={9.5} className="fill-muted-foreground">
              {l}
            </text>
          ))}
        </svg>
      </div>
    </figure>
  )
}
