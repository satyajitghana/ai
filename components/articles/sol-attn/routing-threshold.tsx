"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"
import { Range } from "@/components/articles/ui/range"

// The routing question every block-sparse method answers differently: given one
// row of block-proxy logits, which key blocks survive? Top-k always keeps exactly
// k, no matter the shape of the distribution. Top-p keeps blocks until their
// softmax mass reaches p — dynamic, but the count it lands on swings with how
// peaked or flat the row is. Sol-Attn thresholds the RAW logits at mean + beta*sigma:
// dynamic like top-p, but calibrated like top-k, because a Gaussian's tail density
// at a standardized cutoff doesn't care about scale. Flip the row shape and watch
// top-p's budget swing while top-k stays frozen and ours stays close. Illustrative
// synthetic logits, not the paper's own row.

const N = 28
const SEL = "oklch(0.62 0.15 155)" // selected / kept
const MUTE_BAR = "oklch(0.55 0.02 260)"
const TAU_C = "oklch(0.58 0.19 25)"

// Deterministic synthetic block-proxy logits (two preset "shapes" — peaked vs
// diffuse), matching the paper's own observation that these rows are near-Gaussian.
function rawScore(preset: 0 | 1, i: number) {
  const t = i / (N - 1)
  if (preset === 0) {
    // peaked / spiky row
    return 0.5 + 0.95 * Math.sin(t * 12.4 + 0.7) * Math.cos(t * 3.3) + 0.35 * Math.sin(t * 21 + 1.1)
  }
  // diffuse / flat row
  return 0.95 + 0.22 * Math.sin(t * 6.8) + 0.12 * Math.cos(t * 14 + 0.5)
}

type Mode = "topk" | "topp" | "thresh"

function selectTopK(scores: number[], k: number) {
  const ranked = scores.map((s, i) => [s, i] as const).sort((a, b) => b[0] - a[0])
  return new Set(ranked.slice(0, k).map(([, i]) => i))
}

function selectTopP(scores: number[], p: number) {
  const exp = scores.map((s) => Math.exp(s))
  const sum = exp.reduce((a, b) => a + b, 0)
  const ranked = scores.map((_, i) => ({ i, prob: exp[i] / sum })).sort((a, b) => b.prob - a.prob)
  const sel = new Set<number>()
  let cum = 0
  for (const { i, prob } of ranked) {
    if (cum >= p) break
    sel.add(i)
    cum += prob
  }
  return sel
}

function stats(scores: number[]) {
  const mean = scores.reduce((a, b) => a + b, 0) / scores.length
  const variance = scores.reduce((a, b) => a + (b - mean) ** 2, 0) / scores.length
  return { mean, std: Math.sqrt(variance) }
}

function selectThreshold(scores: number[], beta: number) {
  const { mean, std } = stats(scores)
  const tau = mean + beta * std
  const sel = new Set<number>()
  scores.forEach((s, i) => { if (s > tau) sel.add(i) })
  return { sel, tau }
}

// ── geometry ──
const W = 720
const H = 210
const MX = 28
const BW = 16
const GAP = (W - 2 * MX - N * BW) / (N - 1)
const BASE = 168
const MAXH = 128
const bx = (i: number) => MX + i * (BW + GAP)
const cx = (i: number) => bx(i) + BW / 2

const MODE_CFG: Record<Mode, { label: string; min: number; max: number; step: number }> = {
  topk: { label: "k", min: 3, max: 18, step: 1 },
  topp: { label: "p", min: 0.5, max: 0.95, step: 0.01 },
  thresh: { label: "β", min: 0, max: 2, step: 0.05 },
}

export function RoutingThreshold() {
  const [preset, setPreset] = useState<0 | 1>(0)
  const [mode, setMode] = useState<Mode>("thresh")
  const [k, setK] = useState(8)
  const [p, setP] = useState(0.8)
  const [beta, setBeta] = useState(1)

  const scores = Array.from({ length: N }, (_, i) => rawScore(preset, i))
  const lo = Math.min(...scores)
  const hi = Math.max(...scores)
  const h = (s: number) => ((s - lo) / (hi - lo)) * MAXH

  let sel: Set<number>
  let tau: number | null = null
  if (mode === "topk") sel = selectTopK(scores, k)
  else if (mode === "topp") sel = selectTopP(scores, p)
  else {
    const r = selectThreshold(scores, beta)
    sel = r.sel
    tau = r.tau
  }

  const budgetNote =
    mode === "topk"
      ? "fixed budget — always k, whatever the row looks like"
      : mode === "topp"
        ? "dynamic budget — swings with how peaked the row is"
        : "dynamic budget — calibrated by mean + σ, stays close across rows"

  const cfg = MODE_CFG[mode]
  const val = mode === "topk" ? k : mode === "topp" ? p : beta
  const setVal = mode === "topk" ? setK : mode === "topp" ? setP : setBeta

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex items-center justify-between border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>routing a block-proxy row · top-k vs top-p vs threshold</span>
        <span className="text-muted-foreground/50">synthetic, illustrative</span>
      </div>

      <div className="p-3 sm:p-4">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`${sel.size} of ${N} blocks selected under ${mode}, ${budgetNote}`}>
          <defs>
            <filter id="rt-soft" x="-40%" y="-40%" width="180%" height="180%">
              <feDropShadow dx="0" dy="1" stdDeviation="1.2" floodOpacity="0.14" />
            </filter>
          </defs>

          <line x1={MX - 6} y1={BASE} x2={W - MX + 6} y2={BASE} stroke="var(--border)" strokeWidth={1} />

          {mode === "thresh" && tau !== null && (
            <>
              <line x1={MX - 6} y1={BASE - h(tau)} x2={W - MX + 6} y2={BASE - h(tau)} stroke={TAU_C} strokeWidth={1.3} strokeDasharray="4 3" opacity={0.75} />
              {/* centred over the low-scoring middle blocks, where nothing collides */}
              <rect x={W / 2 - 52} y={BASE - h(tau) - 17} width={104} height={15} rx={3} fill="var(--background)" opacity={0.94} />
              <text x={W / 2} y={BASE - h(tau) - 6} textAnchor="middle" className="font-mono" fontSize={10} fill={TAU_C}>
                τ = μ + {beta.toFixed(2)}σ
              </text>
            </>
          )}

          {scores.map((s, i) => {
            const isSel = sel.has(i)
            const bh = Math.max(h(s), 3)
            return (
              <rect
                key={i}
                x={bx(i)}
                y={BASE - bh}
                width={BW}
                height={bh}
                rx={3}
                fill={isSel ? SEL : MUTE_BAR}
                opacity={isSel ? 0.92 : 0.28}
                filter={isSel ? "url(#rt-soft)" : undefined}
                className="transition-all duration-300"
              />
            )
          })}

          <text x={cx(0)} y={H - 6} className="fill-muted-foreground/70 font-mono" fontSize={9}>0</text>
          <text x={cx(N - 1)} y={H - 6} textAnchor="end" className="fill-muted-foreground/70 font-mono" fontSize={9}>{N - 1}</text>
          <text x={(cx(0) + cx(N - 1)) / 2} y={H - 6} textAnchor="middle" className="fill-muted-foreground/70 font-mono" fontSize={9}>block index</text>
        </svg>

        <div className="mt-1 flex flex-wrap items-center gap-x-5 gap-y-2">
          <div className="flex items-center gap-1.5">
            <span className="font-mono text-[10px] text-muted-foreground">row shape</span>
            {(["peaked", "diffuse"] as const).map((label, i) => (
              <button key={label} type="button" onClick={() => setPreset(i as 0 | 1)} aria-pressed={preset === i}
                className={cn("cursor-pointer rounded-md border px-2 py-1 font-mono text-[10px] transition-colors", preset === i ? "border-foreground/40 text-foreground" : "text-muted-foreground hover:text-foreground")}>
                {label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1.5">
            <span className="font-mono text-[10px] text-muted-foreground">routing</span>
            {([["topk", "top-k"], ["topp", "top-p"], ["thresh", "threshold (ours)"]] as const).map(([m, label]) => (
              <button key={m} type="button" onClick={() => setMode(m)} aria-pressed={mode === m}
                className={cn("cursor-pointer rounded-md px-2 py-1 font-mono text-[10px] transition-colors", mode === m ? "text-background" : "bg-muted text-muted-foreground hover:text-foreground")}
                style={mode === m ? { background: SEL } : undefined}>
                {label}
              </button>
            ))}
          </div>
          <div className="ml-auto font-mono text-[10px] text-muted-foreground">
            selects <span style={{ color: SEL }}>{sel.size}</span>{" "}of {N} · sparsity {(100 * (1 - sel.size / N)).toFixed(1)}%
          </div>
        </div>

        <div className="mt-3">
          <div className="mb-1 flex items-center justify-between font-mono text-[10px] text-muted-foreground">
            <span>{cfg.label}</span>
            <span className="text-foreground">{mode === "topp" ? val.toFixed(2) : val}</span>
          </div>
          <Range min={cfg.min} max={cfg.max} step={cfg.step} value={val} onChange={(e) => setVal(Number(e.target.value))} className="w-full cursor-pointer" accent={SEL} />
        </div>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          {budgetNote}.{" "}
          Switch the row from <span className="text-foreground">peaked</span>{" "}to{" "}
          <span className="text-foreground">diffuse</span>{" "}at a fixed <code>{cfg.label}</code>: top-k&apos;s count
          never moves (it is defined to be k); top-p&apos;s count can swing by an order of magnitude, because the
          same cumulative-mass target lands on very different numbers of blocks depending on how concentrated the
          row is. Sol-Attn&apos;s threshold, calibrated to a shared standardized cutoff β, is the one that stays
          roughly put across both shapes — and it never needs the full sorted row to get there.
        </p>
      </div>
    </figure>
  )
}
