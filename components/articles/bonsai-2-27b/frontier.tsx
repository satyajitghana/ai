"use client"

import { useMemo, useState } from "react"

import { cn } from "@/lib/utils"
import { mlog2 } from "@/lib/dmath"

// The memory-vs-quality frontier. Five points, all read off PrismML's OWN
// like-for-like comparison table (the Ternary-Bonsai-2-27B-gguf model card,
// "Thinking avg" table) — a single 14-benchmark, thinking-mode suite where the
// previous Bonsai 27B release was deliberately re-scored so every point is
// comparable. This is deliberately NOT the 20-benchmark suite from the launch
// post/whitepaper (that suite has no non-Bonsai low-bit baseline to plot
// against) — see the prose for why the two suites disagree on Bonsai 2's own
// absolute score (83.9 vs 84.78) while both round to "98.2%".
//
// Quality mode: log-x size vs score, with the Pareto frontier (max score
// achievic at or below a given size) drawn as a dashed staircase — IQ2_XXS
// sits visibly inside it, strictly dominated by Bonsai 2 27B.
// Density mode: intelligence density computed live via PrismML's own formula,
// D = -log2(1 - score/100) / size_GB, as a sorted bar list.

type Pt = {
  id: string
  label: string
  gb: number
  score: number
  bpw: number
  color: string
  highlight?: boolean
}

const GREY = "oklch(0.62 0.02 260)" // FP16 baseline
const AMBER = "oklch(0.72 0.15 75)" // decent conventional quant
const RED = "oklch(0.62 0.19 25)" // dominated conventional quant
const VIOLET = "oklch(0.6 0.17 300)" // Bonsai gen 1
const GREEN = "oklch(0.64 0.15 150)" // Bonsai 2 27B — the highlight

const POINTS: Pt[] = [
  { id: "fp16", label: "Qwen3.8-27B FP16", gb: 54, score: 86.32, bpw: 16.0, color: GREY },
  { id: "q4kxl", label: "Qwen3.8-27B UD-Q4_K_XL", gb: 17.6, score: 85.18, bpw: 5.2, color: AMBER },
  { id: "iq2xxs", label: "Qwen3.8-27B IQ2_XXS", gb: 9.4, score: 72.59, bpw: 2.8, color: RED },
  { id: "bonsai1", label: "Ternary Bonsai 27B (gen 1)", gb: 5.75, score: 80.98, bpw: 1.72, color: VIOLET },
  { id: "bonsai2", label: "Bonsai 2 27B (ternary)", gb: 5.9, score: 84.78, bpw: 1.72, color: GREEN, highlight: true },
]

// Intelligence density, PrismML's own metric: error probability Pe = 1 - score/100,
// density = -log2(Pe) / size_GB. Computed live so the reader can see it isn't magic.
function density(p: Pt): number {
  const pe = 1 - p.score / 100
  return -mlog2(pe) / p.gb
}

// Pareto frontier over (size↓, score↑): sort by size ascending, keep points
// where the running-max score increases. A point that doesn't increase the
// running max is dominated — smaller-or-equal size exists with a better score.
function frontier(pts: Pt[]): Pt[] {
  const sorted = [...pts].sort((a, b) => a.gb - b.gb)
  const out: Pt[] = []
  let best = -Infinity
  for (const p of sorted) {
    if (p.score > best) {
      out.push(p)
      best = p.score
    }
  }
  return out
}

const W = 760
const H = 300
const padL = 46
const padR = 20
const padT = 20
const padB = 40

export function Frontier() {
  const [mode, setMode] = useState<"quality" | "density">("quality")
  const [hover, setHover] = useState<string | null>(null)

  const front = useMemo(() => frontier(POINTS), [])
  const dominated = new Set(
    POINTS.filter((p) => !front.includes(p)).map((p) => p.id)
  )

  // log-x scale, 5..60 GB
  const xlo = 5
  const xhi = 60
  const tx = (gb: number) => (mlog2(gb) - mlog2(xlo)) / (mlog2(xhi) - mlog2(xlo))
  const sx = (gb: number) => padL + tx(gb) * (W - padL - padR)

  const ylo = 68
  const yhi = 90
  const sy = (score: number) =>
    padT + (1 - (score - ylo) / (yhi - ylo)) * (H - padT - padB)

  const gbTicks = [5, 10, 20, 40, 54]

  const dens = POINTS.map((p) => ({ ...p, d: density(p) })).sort(
    (a, b) => b.d - a.d
  )
  const maxD = Math.max(...dens.map((p) => p.d))

  const hp = hover ? POINTS.find((p) => p.id === hover) : null

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          memory vs quality · 14-benchmark thinking-mode suite
        </span>
        <div className="flex gap-1">
          {(
            [
              ["quality", "quality vs size"],
              ["density", "intelligence density"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setMode(id)}
              aria-pressed={mode === id}
              className={cn(
                "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-xs transition-colors",
                mode === id
                  ? "border-foreground/30 bg-muted/50 text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="p-3 sm:p-4">
        {mode === "quality" ? (
          <svg
            viewBox={`0 0 ${W} ${H}`}
            className="w-full"
            role="img"
            aria-label={`Benchmark score against model size in gigabytes, log scale, for ${POINTS.length} models. Bonsai 2 27B and the FP16, UD-Q4_K_XL, and previous-generation Bonsai points sit on the Pareto frontier; IQ2_XXS is dominated.`}
          >
            {/* y gridlines */}
            {[70, 75, 80, 85, 90].map((g) => (
              <g key={g}>
                <line x1={padL} y1={sy(g)} x2={W - padR} y2={sy(g)} stroke="currentColor" strokeOpacity="0.07" />
                <text x={padL - 8} y={sy(g) + 3} textAnchor="end" className="fill-muted-foreground/60 font-mono" fontSize="9">{g}</text>
              </g>
            ))}
            {/* x ticks (log) */}
            {gbTicks.map((g) => (
              <text key={g} x={sx(g)} y={H - padB + 16} textAnchor="middle" className="fill-muted-foreground/60 font-mono" fontSize="9">{g}GB</text>
            ))}
            <text x={(W + padL) / 2} y={H - 4} textAnchor="middle" className="fill-muted-foreground/50 font-mono" fontSize="9">model size, log scale →</text>
            <text x={14} y={(H - padB) / 2} textAnchor="middle" className="fill-muted-foreground/50 font-mono" fontSize="9" transform={`rotate(-90 14 ${(H - padB) / 2})`}>thinking-mode avg (14 bench)</text>

            {/* Pareto frontier, dashed staircase through non-dominated points */}
            <polyline
              points={front.map((p) => `${sx(p.gb)},${sy(p.score)}`).join(" ")}
              fill="none"
              stroke="var(--muted-foreground)"
              strokeWidth={1.3}
              strokeDasharray="4 4"
              opacity={0.55}
            />

            {POINTS.map((p) => {
              const on = hover === p.id
              const dom = dominated.has(p.id)
              return (
                <g
                  key={p.id}
                  onMouseEnter={() => setHover(p.id)}
                  onMouseLeave={() => setHover(null)}
                  className="cursor-pointer"
                >
                  <circle
                    cx={sx(p.gb)}
                    cy={sy(p.score)}
                    r={p.highlight ? 8 : on ? 7 : 5.5}
                    fill={p.color}
                    opacity={dom ? 0.55 : hover == null || on ? 1 : 0.45}
                    stroke={p.highlight ? "var(--background)" : "none"}
                    strokeWidth={p.highlight ? 1.5 : 0}
                  />
                  <text
                    x={sx(p.gb)}
                    y={sy(p.score) - 12}
                    textAnchor="middle"
                    className="fill-foreground font-mono"
                    fontSize={9.5}
                    fontWeight={p.highlight ? 700 : 500}
                    opacity={hover == null || on || p.highlight ? 1 : 0.5}
                  >
                    {p.label.replace("Qwen3.8-27B ", "").replace(" (ternary)", "").replace(" (gen 1)", " g1")}
                  </text>
                </g>
              )
            })}

            {hp ? (
              <g transform={`translate(${Math.min(sx(hp.gb) + 10, W - 190)}, ${Math.max(sy(hp.score) + 10, padT)})`}>
                <rect width="186" height="40" rx="5" fill="var(--background)" stroke="var(--border)" />
                <text x="8" y="14" className="fill-foreground font-mono" fontSize="10">{hp.label}</text>
                <text x="8" y="28" className="fill-muted-foreground font-mono" fontSize="9">{hp.gb} GB · {hp.bpw.toFixed(2)} bpw · score {hp.score}</text>
              </g>
            ) : null}
          </svg>
        ) : (
          <div className="space-y-2 py-1">
            {dens.map((p) => (
              <div key={p.id} className="flex items-center gap-3">
                <span
                  className={cn(
                    "w-44 shrink-0 truncate text-right font-mono text-xs sm:w-52",
                    p.highlight ? "font-semibold text-foreground" : "text-muted-foreground"
                  )}
                >
                  {p.label}
                </span>
                <div className="relative h-5 flex-1 rounded-sm bg-muted/30">
                  <div
                    className="absolute inset-y-0 left-0 rounded-sm"
                    style={{ width: `${(p.d / maxD) * 100}%`, background: p.color }}
                  />
                  {(() => {
                    const pct = (p.d / maxD) * 100
                    const inside = pct >= 82
                    return (
                      <span
                        className={cn(
                          "absolute top-1/2 -translate-y-1/2 font-mono text-[11px] tabular-nums",
                          inside ? "pr-1.5" : "pl-1.5"
                        )}
                        style={
                          inside
                            ? { right: `${100 - pct}%`, color: "oklch(0.22 0 0)" }
                            : { left: `${pct}%` }
                        }
                      >
                        {p.d.toFixed(3)}/GB
                      </span>
                    )
                  })()}
                </div>
              </div>
            ))}
          </div>
        )}

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          {mode === "quality" ? (
            <>
              All five points are PrismML&apos;s own numbers, on one suite. Qwen3.8-27B
              IQ2_XXS <span className="text-foreground">sits inside the frontier</span>{" "}—
              at 9.4 GB it is both bigger and worse than Bonsai 2 27B at 5.9 GB, a
              conventional low-bit build that a smaller, purpose-built one strictly beats.
              Bonsai 2 27B sits on the frontier next to UD-Q4_K_XL (0.4 points better, at a
              third of the size) and the FP16 baseline itself.
            </>
          ) : (
            <>
              Density is{" "}
              <code className="rounded bg-muted px-1 py-0.5">
                -log2(1 - score/100) / size_GB
              </code>{" "}
              — PrismML&apos;s own metric, computed live from the scores above. Bonsai 2 27B
              reaches <span className="text-foreground">{density(POINTS.find((p) => p.id === "bonsai2")!).toFixed(3)}/GB</span> here
              at the 5.9 GB this same comparison table uses elsewhere; PrismML&apos;s
              published density table instead plugs in 5.80 GB (the idealized, unpacked
              size) and reports 0.469 — a small but real reminder that a &quot;per GB&quot;
              metric depends on whose GB you use.
            </>
          )}
        </p>
      </div>
    </figure>
  )
}
