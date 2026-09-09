"use client"

import { useMemo, useState } from "react"

import { cn } from "@/lib/utils"

// Every arm's own numbers, from board.json (mean-of-4, pass@4, 200 held-out
// tasks, 800 episodes per arm) -- HuggingFace's own published data, not a
// redraw of their chart. `kind` matches the source: "reference" is one of the
// nine off-the-shelf models nobody here trained; "base" is the untrained
// Qwen3.5-4B measured on the same board; "ours" is run 1's ckpt1000.
//
// r is computed live, in this component, from these arrays -- not hardcoded --
// over whichever subset is toggled on. Over the 9 reference rows it comes out
// to -0.7501 (article states -0.75); folding in the untrained base moves it to
// -0.723, which is why the toggle exists: the subset the correlation is
// computed over changes the number, and the article does not say which nine
// rows it used. These are them.
type Kind = "reference" | "base" | "ours"
type Arm = { name: string; turns: number; mean: number; zeroPct: number; kind: Kind }

const ARMS: Arm[] = [
  { name: "claude-sonnet-5", turns: 5.1, mean: 0.6952, zeroPct: 14.2, kind: "reference" },
  { name: "run 1 · ckpt1000 (ours)", turns: 1.1, mean: 0.6445, zeroPct: 0.5, kind: "ours" },
  { name: "gpt-5.4-mini", turns: 5.0, mean: 0.5732, zeroPct: 24.6, kind: "reference" },
  { name: "claude-haiku-4.5", turns: 6.7, mean: 0.5374, zeroPct: 22.6, kind: "reference" },
  { name: "Qwen3.5-122B-A10B", turns: 8.4, mean: 0.5338, zeroPct: 24.5, kind: "reference" },
  { name: "Qwen3.5-4B (untrained)", turns: 6.7, mean: 0.4825, zeroPct: 29.5, kind: "base" },
  { name: "Qwen3.5-9B", turns: 8.4, mean: 0.4776, zeroPct: 31.0, kind: "reference" },
  { name: "Qwen3.5-35B-A3B", turns: 6.6, mean: 0.4483, zeroPct: 36.0, kind: "reference" },
  { name: "Qwen3.5-27B", turns: 10.1, mean: 0.4478, zeroPct: 36.3, kind: "reference" },
  { name: "Qwen3.5-397B-A17B", turns: 10.5, mean: 0.4466, zeroPct: 38.0, kind: "reference" },
  { name: "gpt-5.4-nano", turns: 9.2, mean: 0.3748, zeroPct: 45.8, kind: "reference" },
]

function pearson(xs: number[], ys: number[]) {
  const n = xs.length
  const mx = xs.reduce((a, b) => a + b, 0) / n
  const my = ys.reduce((a, b) => a + b, 0) / n
  let cov = 0
  let sx = 0
  let sy = 0
  for (let i = 0; i < n; i++) {
    cov += (xs[i] - mx) * (ys[i] - my)
    sx += (xs[i] - mx) ** 2
    sy += (ys[i] - my) ** 2
  }
  return cov / Math.sqrt(sx * sy)
}

// Ordinary least squares over the same subset the correlation is computed on,
// for the faint trend line -- plain arithmetic (+ - * / and one sqrt), exact
// per IEEE-754 on every engine, so it needs no lib/dmath wrapper.
function ols(xs: number[], ys: number[]) {
  const n = xs.length
  const mx = xs.reduce((a, b) => a + b, 0) / n
  const my = ys.reduce((a, b) => a + b, 0) / n
  let num = 0
  let den = 0
  for (let i = 0; i < n; i++) {
    num += (xs[i] - mx) * (ys[i] - my)
    den += (xs[i] - mx) ** 2
  }
  const slope = num / den
  return { slope, intercept: my - slope * mx }
}

const ACCENT = "oklch(0.6 0.15 200)"
const OURS = "oklch(0.65 0.18 25)"
const BASE = "oklch(0.7 0.13 85)"

const W = 640
const H = 380
const padL = 40
const padR = 16
const padT = 20
const padB = 40
const r2 = (n: number) => Math.round(n * 100) / 100

export function BoardScatter() {
  const [includeBase, setIncludeBase] = useState(false)
  const [hover, setHover] = useState<number | null>(null)

  const fitArms = ARMS.filter((a) => a.kind === "reference" || (includeBase && a.kind === "base"))
  const r = useMemo(
    () => pearson(fitArms.map((a) => a.turns), fitArms.map((a) => a.mean)),
    [fitArms]
  )
  const fit = useMemo(() => ols(fitArms.map((a) => a.turns), fitArms.map((a) => a.mean)), [fitArms])

  const xlo = 0
  const xhi = 11.5
  const ylo = 0.3
  const yhi = 0.75

  const sx = (v: number) => r2(padL + ((v - xlo) / (xhi - xlo)) * (W - padL - padR))
  const sy = (v: number) => r2(padT + (1 - (v - ylo) / (yhi - ylo)) * (H - padT - padB))

  const chip = (active: boolean) =>
    cn(
      "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-xs transition-colors",
      active
        ? "border-foreground/30 bg-muted/50 text-foreground"
        : "border-transparent text-muted-foreground hover:text-foreground"
    )

  const hp = hover != null ? ARMS[hover] : null

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          turns per episode vs mean-of-4 score, all eleven arms
        </span>
        <button type="button" onClick={() => setIncludeBase((v) => !v)} className={chip(includeBase)}>
          include untrained base in fit
        </button>
      </div>

      <div className="p-3 sm:p-4">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full"
          role="img"
          aria-label={`Scatter of mean-of-4 score against turns per episode for eleven GeoGuesser arms. Over the nine reference models never touched by training, the correlation is ${r2(r).toFixed(4)}. Marker size encodes the share of episodes scoring exactly zero.`}
        >
          {/* trend line */}
          <line
            x1={sx(xlo)}
            y1={sy(fit.intercept + fit.slope * xlo)}
            x2={sx(xhi)}
            y2={sy(fit.intercept + fit.slope * xhi)}
            stroke={ACCENT}
            strokeOpacity={0.5}
            strokeDasharray="4 3"
          />

          {/* y gridlines */}
          {[0.3, 0.4, 0.5, 0.6, 0.7].map((gy) => (
            <g key={gy}>
              <line x1={padL} y1={sy(gy)} x2={W - padR} y2={sy(gy)} stroke="currentColor" strokeOpacity={0.07} />
              <text x={padL - 5} y={sy(gy) + 3} textAnchor="end" className="fill-muted-foreground/60 font-mono" fontSize="9">
                {gy.toFixed(1)}
              </text>
            </g>
          ))}
          {[0, 2, 4, 6, 8, 10].map((gx) => (
            <text key={gx} x={sx(gx)} y={H - 26} textAnchor="middle" className="fill-muted-foreground/60 font-mono" fontSize="9">
              {gx}
            </text>
          ))}
          <text x={(W + padL) / 2} y={H - 6} textAnchor="middle" className="fill-muted-foreground/50 font-mono" fontSize="9">
            turns per episode
          </text>
          <text x={14} y={padT - 6} className="fill-muted-foreground/50 font-mono" fontSize="9">
            score
          </text>

          {ARMS.map((a, i) => {
            const x = sx(a.turns)
            const y = sy(a.mean)
            const on = hover === i
            const dim = a.kind === "reference" ? ACCENT : a.kind === "ours" ? OURS : BASE
            const radius = 3 + (a.zeroPct / 46) * 7
            const excluded = a.kind === "base" && !includeBase
            return (
              <g key={a.name} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} className="cursor-pointer">
                <circle
                  cx={x}
                  cy={y}
                  r={on ? radius + 1.5 : radius}
                  fill={dim}
                  opacity={excluded ? 0.35 : on ? 1 : 0.85}
                  stroke={a.kind !== "reference" ? "var(--background)" : "none"}
                  strokeWidth={1.5}
                />
              </g>
            )
          })}

          {hp ? (
            <g
              transform={`translate(${Math.min(sx(hp.turns) + 8, W - 190)}, ${Math.max(sy(hp.mean) - 30, padT)})`}
            >
              <rect width="184" height="34" rx="5" fill="var(--background)" stroke="var(--border)" />
              <text x="7" y="12" className="fill-foreground font-mono" fontSize="9">
                {hp.name}
              </text>
              <text x="7" y="24" className="fill-muted-foreground font-mono" fontSize="8">
                turns {hp.turns} · score {hp.mean} · zero {hp.zeroPct}%
              </text>
            </g>
          ) : null}
        </svg>

        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: ACCENT }} /> 9 reference models
            (never trained)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: BASE }} /> untrained base
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: OURS }} /> run 1 · ckpt1000
          </span>
          <span className="ml-auto">marker size = share scoring zero</span>
        </div>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Fit over the nine reference dots only, r = <span className="text-foreground">{r2(r).toFixed(4)}</span>.
          The models that deliberate longest score worst, and it holds without either of the two
          arms anyone trained. Toggle in the untrained base and the fit softens to{" "}
          {(() => {
            const withBase = pearson(
              ARMS.filter((a) => a.kind !== "ours").map((a) => a.turns),
              ARMS.filter((a) => a.kind !== "ours").map((a) => a.mean)
            )
            return <span className="text-foreground">{r2(withBase).toFixed(3)}</span>
          })()}{" "}
          &mdash; still strongly negative, just not quite as clean once a tenth point with 6.7
          turns and 2.1 pins joins in.
        </p>
      </div>
    </figure>
  )
}
