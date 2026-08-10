"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"
import { mpow } from "@/lib/dmath"

// D-cut: verification depth as a SHARED batch resource. Each request i has a
// per-position confidence product s(i,k) = Pr(first k drafted tokens all
// accepted) — the paper's own A-hat(n_i) = sum_k s(i,k). D-cut ranks every
// (request, position) cell in the WHOLE batch by that score and keeps only
// the global top-K, where K = max(B, ceil(rho * B * (D+1))) for rho in the
// paper's real discrete set {0.25, 0.5, 0.75, 1.0}. A fixed per-request budget
// instead cuts every request at the same depth regardless of confidence.
// Both spend the identical K — the question is which K spends better.
//
// Confidence traces are illustrative, shaped to match the paper's own
// cross-benchmark pattern (Table 3): code/math drafts stay confident much
// longer than chat, which is exactly why DFly targets code/math. The specific
// per-position values are not individually published — the ranking mechanism,
// the rho set, and the K(B, rho) formula are.

const ACC = "oklch(0.64 0.16 200)"
const CUT = "oklch(0.68 0.16 55)"

const REQS = [
  { name: "GSM8K", domain: "math", base: 0.95, rate: 0.9 },
  { name: "HumanEval", domain: "code", base: 0.93, rate: 0.89 },
  { name: "MBPP", domain: "code", base: 0.88, rate: 0.85 },
  { name: "Math500", domain: "math", base: 0.92, rate: 0.87 },
  { name: "MT-Bench", domain: "chat", base: 0.75, rate: 0.65 },
  { name: "AlpacaEval", domain: "chat", base: 0.7, rate: 0.62 },
]
const B = REQS.length
const D1 = 8 // draft positions per request (block size 8)
const RATIOS = [0.25, 0.5, 0.75, 1.0]

function conf(reqIdx: number, k: number) {
  const r = REQS[reqIdx]
  return r.base * mpow(r.rate, k) // k = 0..D1-1
}

type Mode = "global" | "fixed"

function keepSet(ratio: number, mode: Mode): Set<string> {
  const K = Math.max(B, Math.ceil(ratio * B * D1))
  const cells: { key: string; s: number }[] = []
  for (let i = 0; i < B; i++) {
    for (let k = 0; k < D1; k++) cells.push({ key: `${i}-${k}`, s: conf(i, k) })
  }
  if (mode === "global") {
    cells.sort((a, b) => b.s - a.s)
    return new Set(cells.slice(0, K).map((c) => c.key))
  }
  // fixed: uniform depth per request, remainder to the first requests
  const base = Math.floor(K / B)
  const rem = K - base * B
  const kept = new Set<string>()
  for (let i = 0; i < B; i++) {
    const depth = base + (i < rem ? 1 : 0)
    for (let k = 0; k < depth; k++) kept.add(`${i}-${k}`)
  }
  return kept
}

function retainedPct(ratio: number, mode: Mode): number {
  const kept = keepSet(ratio, mode)
  let num = 0
  let den = 0
  for (let i = 0; i < B; i++) {
    for (let k = 0; k < D1; k++) {
      const s = conf(i, k)
      den += s
      if (kept.has(`${i}-${k}`)) num += s
    }
  }
  return (num / den) * 100
}

// scene geometry
const W = 720
const H = 300
const GX = 130
const GY = 26
const CW = 62
const CH = 30
const CGAP = 3
const RGAP = 4
const cellX = (k: number) => GX + k * (CW + CGAP)
const cellY = (i: number) => GY + i * (CH + RGAP)

export function DCutBudget() {
  const [ratio, setRatio] = useState(0.5)
  const [mode, setMode] = useState<Mode>("global")

  const kept = keepSet(ratio, mode)
  const K = Math.max(B, Math.ceil(ratio * B * D1))
  const globalRetained = retainedPct(ratio, "global")
  const fixedRetained = retainedPct(ratio, "fixed")

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex items-center justify-between border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>D-cut · verification budget across a batch</span>
        <span className="text-muted-foreground/50">{B} requests × {D1} draft positions</span>
      </div>

      <div className="p-3 sm:p-4">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full"
          role="img"
          aria-label={`At ratio ${ratio}, ${mode === "global" ? "D-cut's global top-K" : "a fixed per-request depth"} keeps ${K} of ${B * D1} draft positions, retaining ${(mode === "global" ? globalRetained : fixedRetained).toFixed(1)} percent of total confidence-weighted utility.`}
        >
          <text x={GX} y={16} className="fill-muted-foreground font-mono" fontSize={10}>
            draft position →
          </text>
          {Array.from({ length: D1 }, (_, k) => (
            <text key={k} x={cellX(k) + CW / 2} y={GY - 6} textAnchor="middle" className="fill-muted-foreground font-mono" fontSize={9}>
              {k + 1}
            </text>
          ))}

          {REQS.map((r, i) => (
            <g key={r.name}>
              <text x={GX - 10} y={cellY(i) + CH / 2 - 3} textAnchor="end" className="fill-foreground font-mono" fontSize={10} fontWeight={600}>
                {r.name}
              </text>
              <text x={GX - 10} y={cellY(i) + CH / 2 + 9} textAnchor="end" className="fill-muted-foreground font-mono" fontSize={8}>
                {r.domain}
              </text>
              {Array.from({ length: D1 }, (_, k) => {
                const s = conf(i, k)
                const isKept = kept.has(`${i}-${k}`)
                return (
                  <rect
                    key={k}
                    x={cellX(k)}
                    y={cellY(i)}
                    width={CW}
                    height={CH}
                    rx={5}
                    fill={isKept ? ACC : "var(--muted-foreground)"}
                    opacity={isKept ? 0.22 + 0.72 * s : 0.1}
                    stroke={isKept ? "transparent" : "var(--border)"}
                    strokeDasharray={isKept ? undefined : "3 2"}
                    strokeWidth={1}
                    className="transition-all duration-300"
                  />
                )
              })}
              <text x={cellX(D1 - 1) + CW + 12} y={cellY(i) + CH / 2 + 4} className="font-mono" fontSize={9} fill="var(--muted-foreground)">
                kept {Array.from({ length: D1 }, (_, k) => kept.has(`${i}-${k}`)).filter(Boolean).length}/{D1}
              </text>
            </g>
          ))}
        </svg>

        <div className="mt-1 flex flex-wrap items-center gap-x-5 gap-y-2">
          <div className="flex items-center gap-1.5">
            <span className="font-mono text-[10px] text-muted-foreground">ratio ρ</span>
            {RATIOS.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRatio(r)}
                aria-pressed={ratio === r}
                className={cn(
                  "cursor-pointer rounded-md px-2 py-1 font-mono text-[10px] transition-colors",
                  ratio === r ? "text-background" : "bg-muted text-muted-foreground hover:text-foreground"
                )}
                style={ratio === r ? { background: ACC } : undefined}
              >
                {r.toFixed(2)}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1.5">
            <span className="font-mono text-[10px] text-muted-foreground">allocation</span>
            {(["global", "fixed"] as Mode[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                aria-pressed={mode === m}
                className={cn(
                  "cursor-pointer rounded-md border px-2 py-1 font-mono text-[10px] transition-colors",
                  mode === m ? "border-foreground/40 text-foreground" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {m === "global" ? "D-cut (global top-K)" : "fixed per-request"}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-3 grid grid-cols-3 gap-2 font-mono text-[11px]">
          <div className="rounded-lg border bg-muted/20 px-3 py-2">
            <div className="text-[10px] text-muted-foreground">verified positions K</div>
            <div className="mt-0.5 text-foreground tabular-nums">{K} / {B * D1}</div>
          </div>
          <div className="rounded-lg border bg-muted/20 px-3 py-2">
            <div className="text-[10px] text-muted-foreground">utility retained · global</div>
            <div className="mt-0.5 tabular-nums" style={{ color: ACC }}>{globalRetained.toFixed(1)}%</div>
          </div>
          <div className="rounded-lg border bg-muted/20 px-3 py-2">
            <div className="text-[10px] text-muted-foreground">utility retained · fixed</div>
            <div className="mt-0.5 tabular-nums" style={{ color: CUT }}>{fixedRetained.toFixed(1)}%</div>
          </div>
        </div>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Both allocations spend the exact same budget K. A{" "}
          <span className="text-foreground">fixed</span>{" "}depth cuts every request at the same
          position, wasting slots on a chat request that was already unlikely to accept and starving
          a math request that was still confident. <span style={{ color: ACC }}>D-cut</span>{" "}ranks
          every position in the batch by its own confidence and keeps the top K regardless of which
          request it belongs to — so confident code and math prefixes keep more depth, low-confidence
          chat prefixes get cut sooner, and the same K buys more accepted length. That reallocation,
          replayed on live Hunyuan traffic, is what turns DFly&apos;s +11.8% over DFlash into D-cut&apos;s
          +15.7% at concurrency 64.
        </p>
      </div>
    </figure>
  )
}
