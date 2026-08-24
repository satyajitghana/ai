"use client"

import { useState } from "react"

import { mlog10 } from "@/lib/dmath"
import { cn } from "@/lib/utils"

// The whole project in one chart: verifier accuracy against verifier size,
// across five orders of magnitude, on three tasks that get progressively harder
// to check.
//
// Every point is from the project's appendix tables — full fine-tune at each
// rung, plain accuracy over the same frozen 1,200-example balanced test set, so
// chance is exactly 0.50. The shaded band is the published Wilson 95% CI. The
// AUROC toggle reads the model's P(Yes) confidence instead of its written
// verdict, which keeps registering signal below the size where the verdict text
// stops parsing at all.
//
// Two rungs at 1M are the same model trained two ways: under a chain-of-thought
// target it collapses to chance (0.500, and not one of 1,200 outputs parses),
// and under a verdict-only target it recovers to 0.826 on Countdown and 0.934 on
// Maze. The chart plots the verdict-only value, as the project does, and the
// collapsed one is available as a toggle because it is the more interesting
// number.
//
// mlog10 for the x positions — Math.log10 is only an implementation-dependent
// approximation and these coordinates are serialized into SVG.

const ACCENT = "oklch(0.60 0.15 255)"
const WARM = "oklch(0.68 0.13 85)"
const GOOD = "oklch(0.55 0.16 155)"

type Pt = { p: number; label: string; acc: number; lo?: number; hi?: number; auroc: number }

// params in millions
const COUNTDOWN: Pt[] = [
  { p: 0.07, label: "Nano-70K", acc: 0.5, auroc: 0.513 },
  { p: 0.15, label: "Nano-150K", acc: 0.5, auroc: 0.74 },
  { p: 0.23, label: "Nano-230K", acc: 0.5, auroc: 0.842 },
  { p: 0.34, label: "Nano-340K", acc: 0.501, auroc: 0.852 },
  { p: 0.63, label: "Nano-630K", acc: 0.848, auroc: 0.863 },
  { p: 1, label: "Tiny-1M", acc: 0.826, auroc: 0.891 },
  { p: 2, label: "Tiny-2M", acc: 0.828, lo: 0.805, hi: 0.848, auroc: 0.851 },
  { p: 3, label: "Tiny-3M", acc: 0.814, lo: 0.791, hi: 0.835, auroc: 0.847 },
  { p: 5, label: "Tiny-5M", acc: 0.833, lo: 0.811, hi: 0.853, auroc: 0.85 },
  { p: 7, label: "Tiny-7M", acc: 0.814, lo: 0.791, hi: 0.835, auroc: 0.857 },
  { p: 10, label: "Tiny-10M", acc: 0.828, lo: 0.806, hi: 0.849, auroc: 0.841 },
  { p: 56, label: "Monad-56M", acc: 0.775, lo: 0.751, hi: 0.798, auroc: 0.813 },
  { p: 135, label: "SmolLM2-135M", acc: 0.826, lo: 0.803, hi: 0.846, auroc: 0.834 },
  { p: 360, label: "SmolLM2-360M", acc: 0.863, lo: 0.842, hi: 0.881, auroc: 0.846 },
  { p: 500, label: "Qwen2.5-0.5B", acc: 0.898, lo: 0.88, hi: 0.914, auroc: 0.883 },
  { p: 1540, label: "Qwen2.5-1.5B", acc: 0.91, lo: 0.892, hi: 0.925, auroc: 0.93 },
  { p: 1710, label: "SmolLM2-1.7B", acc: 0.904, lo: 0.886, hi: 0.92, auroc: 0.909 },
  { p: 3000, label: "Qwen2.5-3B", acc: 0.934, lo: 0.919, hi: 0.947, auroc: 0.927 },
  { p: 7000, label: "Qwen2.5-7B", acc: 0.917, lo: 0.9, hi: 0.931, auroc: 0.93 },
]

const MAZE: Pt[] = [
  { p: 0.07, label: "Nano-70K", acc: 0.5, auroc: 0.5 },
  { p: 0.15, label: "Nano-150K", acc: 0.5, auroc: 0.5 },
  { p: 0.23, label: "Nano-230K", acc: 0.5, auroc: 0.5 },
  { p: 0.34, label: "Nano-340K", acc: 0.5, auroc: 0.5 },
  { p: 0.63, label: "Nano-630K", acc: 0.5, auroc: 0.5 },
  { p: 1, label: "Tiny-1M", acc: 0.934, auroc: 0.96 },
  { p: 2, label: "Tiny-2M", acc: 0.928, lo: 0.912, hi: 0.942, auroc: 0.935 },
  { p: 3, label: "Tiny-3M", acc: 0.928, lo: 0.912, hi: 0.942, auroc: 0.929 },
  { p: 5, label: "Tiny-5M", acc: 0.928, lo: 0.912, hi: 0.942, auroc: 0.933 },
  { p: 7, label: "Tiny-7M", acc: 0.928, lo: 0.912, hi: 0.942, auroc: 0.933 },
  { p: 10, label: "Tiny-10M", acc: 0.928, lo: 0.912, hi: 0.942, auroc: 0.941 },
  { p: 56, label: "Monad-56M", acc: 0.878, lo: 0.859, hi: 0.896, auroc: 0.902 },
  { p: 135, label: "SmolLM2-135M", acc: 0.933, lo: 0.918, hi: 0.946, auroc: 0.945 },
  { p: 360, label: "SmolLM2-360M", acc: 0.927, lo: 0.911, hi: 0.941, auroc: 0.946 },
  { p: 500, label: "Qwen2.5-0.5B", acc: 0.932, lo: 0.917, hi: 0.945, auroc: 0.931 },
  { p: 1540, label: "Qwen2.5-1.5B", acc: 0.932, lo: 0.916, hi: 0.945, auroc: 0.926 },
  { p: 1710, label: "SmolLM2-1.7B", acc: 0.934, lo: 0.919, hi: 0.947, auroc: 0.937 },
  { p: 3000, label: "Qwen2.5-3B", acc: 0.931, lo: 0.915, hi: 0.944, auroc: 0.929 },
  { p: 7000, label: "Qwen2.5-7B", acc: 0.932, lo: 0.916, hi: 0.945, auroc: 0.932 },
]

const FAITHFUL: Pt[] = [
  { p: 0.07, label: "Nano-70K", acc: 0.509, auroc: 0.502 },
  { p: 0.15, label: "Nano-150K", acc: 0.509, auroc: 0.524 },
  { p: 0.23, label: "Nano-230K", acc: 0.509, auroc: 0.5 },
  { p: 0.34, label: "Nano-340K", acc: 0.509, auroc: 0.513 },
  { p: 0.63, label: "Nano-630K", acc: 0.509, auroc: 0.701 },
  { p: 1, label: "Tiny-1M", acc: 0.609, lo: 0.581, hi: 0.636, auroc: 0.64 },
  { p: 2, label: "Tiny-2M", acc: 0.825, lo: 0.802, hi: 0.845, auroc: 0.921 },
  { p: 3, label: "Tiny-3M", acc: 0.854, lo: 0.833, hi: 0.873, auroc: 0.937 },
  { p: 5, label: "Tiny-5M", acc: 0.864, lo: 0.844, hi: 0.882, auroc: 0.944 },
  { p: 7, label: "Tiny-7M", acc: 0.876, lo: 0.856, hi: 0.893, auroc: 0.951 },
  { p: 10, label: "Tiny-10M", acc: 0.873, lo: 0.852, hi: 0.89, auroc: 0.955 },
  { p: 56, label: "Monad-56M", acc: 0.818, lo: 0.795, hi: 0.838, auroc: 0.912 },
  { p: 135, label: "SmolLM2-135M", acc: 0.876, lo: 0.856, hi: 0.893, auroc: 0.962 },
  { p: 360, label: "SmolLM2-360M", acc: 0.908, lo: 0.891, hi: 0.923, auroc: 0.979 },
  { p: 500, label: "Qwen2.5-0.5B", acc: 0.943, lo: 0.929, hi: 0.955, auroc: 0.987 },
  { p: 1540, label: "Qwen2.5-1.5B", acc: 0.951, lo: 0.937, hi: 0.962, auroc: 0.991 },
  { p: 1710, label: "SmolLM2-1.7B", acc: 0.943, lo: 0.929, hi: 0.955, auroc: 0.991 },
  { p: 3000, label: "Qwen2.5-3B", acc: 0.95, lo: 0.936, hi: 0.961, auroc: 0.992 },
  { p: 7000, label: "Qwen2.5-7B", acc: 0.876, lo: 0.856, hi: 0.893, auroc: 0.951 },
]

const TASKS = [
  { key: "countdown", label: "Countdown", data: COUNTDOWN, color: ACCENT, on: 0.63, note: "a number puzzle — checkable exactly, so labels are free" },
  { key: "maze", label: "Maze", data: MAZE, color: GOOD, on: 1, note: "judge a proposed shortest-path length — also checkable exactly" },
  { key: "faithful", label: "Faithfulness", data: FAITHFUL, color: WARM, on: 2, note: "is the answer supported by its source? — human labels, no checker" },
] as const

const GEMINI = 0.7

export function FrontierChart() {
  const [metric, setMetric] = useState<"acc" | "auroc">("acc")
  const [on, setOn] = useState<string[]>(["countdown", "maze", "faithful"])
  const toggle = (k: string) => setOn((s) => (s.includes(k) ? s.filter((x) => x !== k) : [...s, k]))

  const W = 720
  const H = 236
  const PAD = { l: 42, r: 108, t: 14, b: 34 }
  const iw = W - PAD.l - PAD.r
  const ih = H - PAD.t - PAD.b
  const LOGLO = mlog10(0.06)
  const LOGHI = mlog10(9000)
  const X = (p: number) => PAD.l + ((mlog10(p) - LOGLO) / (LOGHI - LOGLO)) * iw
  const Y = (v: number) => PAD.t + ih - ((v - 0.45) / 0.55) * ih

  const line = (d: Pt[], k: "acc" | "auroc") =>
    d.map((pt, i) => `${i === 0 ? "M" : "L"}${X(pt.p).toFixed(1)},${Y(pt[k]).toFixed(1)}`).join(" ")

  const band = (d: Pt[]) => {
    const up = d.filter((p) => p.hi != null)
    if (up.length === 0) return ""
    const top = up.map((p, i) => `${i === 0 ? "M" : "L"}${X(p.p).toFixed(1)},${Y(p.hi as number).toFixed(1)}`).join(" ")
    const bot = up
      .slice()
      .reverse()
      .map((p) => `L${X(p.p).toFixed(1)},${Y(p.lo as number).toFixed(1)}`)
      .join(" ")
    return `${top} ${bot} Z`
  }

  const TICKS = [0.1, 1, 10, 100, 1000, 7000]
  const tickLabel = (p: number) => (p >= 1000 ? `${p / 1000}B` : `${p}M`)

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          19 verifiers · 0.07M to 7B · frozen 1,200-example balanced test set, chance = 0.50
        </span>
        <span className="font-mono text-[10px]" style={{ color: GOOD }}>
          flat, then on
        </span>
      </div>

      <div className="p-3 sm:p-4">
        <div className="flex flex-wrap gap-1.5">
          {TASKS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => toggle(t.key)}
              aria-pressed={on.includes(t.key)}
              className={cn(
                "flex cursor-pointer items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
                on.includes(t.key)
                  ? "border-foreground/30 bg-muted/50 text-foreground"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              <span className="inline-block h-[2px] w-3" style={{ background: t.color }} />
              {t.label}
            </button>
          ))}
          <span className="mx-1 self-center text-muted-foreground">·</span>
          {(
            [
              ["acc", "accuracy"],
              ["auroc", "AUROC"],
            ] as const
          ).map(([k, l]) => (
            <button
              key={k}
              type="button"
              onClick={() => setMetric(k)}
              aria-pressed={metric === k}
              className={cn(
                "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
                metric === k
                  ? "border-foreground/30 bg-muted/50 text-foreground"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {l}
            </button>
          ))}
        </div>

        <div className="mt-3 overflow-x-auto">
          <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" className="min-w-[640px] max-w-full">
            <title>
              Verifier accuracy against parameter count on a log scale for three tasks. Each curve sits at chance
              below a task-specific size, switches on abruptly, and then stays nearly flat across three further
              orders of magnitude.
            </title>
            {[0.5, 0.6, 0.7, 0.8, 0.9, 1.0].map((g) => (
              <g key={g}>
                <line x1={PAD.l} x2={PAD.l + iw} y1={Y(g)} y2={Y(g)} stroke="currentColor" strokeOpacity={g === 0.5 ? 0.28 : 0.09} strokeDasharray={g === 0.5 ? "3 3" : undefined} />
                <text x={4} y={Y(g) + 3} fontSize={9} fill="currentColor" fillOpacity={0.45} fontFamily="ui-monospace, monospace">
                  {g.toFixed(2)}
                </text>
              </g>
            ))}
            <text x={PAD.l + 4} y={Y(0.5) - 4} fontSize={8.5} fill="currentColor" fillOpacity={0.45} fontFamily="ui-monospace, monospace">
              chance
            </text>

            {metric === "acc" && on.includes("faithful") ? (
              <>
                <line x1={PAD.l} x2={PAD.l + iw} y1={Y(GEMINI)} y2={Y(GEMINI)} stroke={WARM} strokeDasharray="5 3" strokeOpacity={0.75} />
                <text x={PAD.l + iw + 6} y={Y(GEMINI) + 3} fontSize={9} fill={WARM} fontFamily="ui-monospace, monospace">
                  Gemini 2.5 Flash
                </text>
              </>
            ) : null}

            {TASKS.filter((t) => on.includes(t.key)).map((t) => (
              <g key={t.key}>
                {metric === "acc" ? <path d={band(t.data)} fill={t.color} fillOpacity={0.13} /> : null}
                <path d={line(t.data, metric)} fill="none" stroke={t.color} strokeWidth={2} />
                {t.data.map((pt) => (
                  <circle key={pt.label} cx={X(pt.p)} cy={Y(pt[metric])} r={2.4} fill={t.color}>
                    <title>{`${t.label} · ${pt.label} · ${metric} ${pt[metric].toFixed(3)}`}</title>
                  </circle>
                ))}
                <text
                  x={PAD.l + iw + 6}
                  y={Y(t.data[t.data.length - 1][metric]) + 3}
                  fontSize={9}
                  fill={t.color}
                  fontFamily="ui-monospace, monospace"
                >
                  {t.label}
                </text>
              </g>
            ))}

            {TICKS.map((p) => (
              <g key={p}>
                <line x1={X(p)} y1={PAD.t + ih} x2={X(p)} y2={PAD.t + ih + 3} stroke="currentColor" strokeOpacity={0.3} />
                <text
                  x={X(p)}
                  y={PAD.t + ih + 14}
                  fontSize={9}
                  fill="currentColor"
                  fillOpacity={0.45}
                  textAnchor="middle"
                  fontFamily="ui-monospace, monospace"
                >
                  {tickLabel(p)}
                </text>
              </g>
            ))}
            <text x={PAD.l + iw / 2} y={H - 3} fontSize={9} fill="currentColor" fillOpacity={0.5} textAnchor="middle" fontFamily="ui-monospace, monospace">
              verifier parameters (log scale)
            </text>
          </svg>
        </div>

        <div className="mt-2 space-y-1">
          {TASKS.filter((t) => on.includes(t.key)).map((t) => (
            <div key={t.key} className="flex flex-wrap items-baseline gap-2 font-mono text-[10px]">
              <span className="w-24 shrink-0 text-right" style={{ color: t.color }}>
                {t.label}
              </span>
              <span className="w-36 shrink-0 whitespace-nowrap tabular-nums text-foreground">switches on at {t.on}M</span>
              <span className="text-muted-foreground">{t.note}</span>
            </div>
          ))}
        </div>

        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          Verification is <span className="text-foreground">flat, then on</span>. Below a task-specific size the
          verifier sits at chance; above it, the curve jumps and then barely moves for three more orders of
          magnitude. Maze is the purest case — 0.928 at two million parameters, 0.932 at seven billion, a
          difference of four tenths of a point across a 3,500× size increase.
          <br />
          <br />
          And flip to accuracy with Faithfulness on. The task with no exact checker, the one that supposedly needs
          judgement, produces the <em>highest</em>{" "}curve of the three — and every trained verifier from two
          million parameters up beats zero-shot Gemini 2.5 Flash on the same test set.{" "}
          <span className="text-foreground">Harder to solve is not the same as harder to check</span>, though that
          particular result has a large asterisk that the project is admirably clear about.
        </p>
      </div>
    </figure>
  )
}
