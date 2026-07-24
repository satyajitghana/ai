"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"
import { Range } from "@/components/articles/ui/range"

// One output neuron, computed two ways. A ternary weight vector w ∈ {−1, 0, +1}
// dotted with an activation vector x. In full precision every pair is a multiply;
// in ternary the inner loop collapses to add (+1), subtract (−1), or skip (0),
// with a single per-channel scale multiply at the very end. Scrub to reveal the
// accumulation term by term and watch the running sum. All numbers are fixed
// (SSR-safe, illustrative) — this is the arithmetic of a BitLinear layer.

const ACCENT = "oklch(0.62 0.17 152)"

const X = [0.8, -0.5, 1.2, 0.3, -0.9, 0.6] // activations
const WFP = [0.42, -0.28, 0.05, 0.51, -0.33, 0.21] // full-precision weights
const WT = [1, -1, 0, 1, -1, 1] // ternary weights = round(clamp(w/absmean, −1, 1))
const SCALE = 0.3 // absmean(|WFP|) = 1.80 / 6
const N = X.length

// scene geometry (viewBox units) — coords ≤ 2dp, deterministic
const W = 760
const H = 372
const MX = 70
const GAP = (W - 2 * MX) / (N - 1) // 124
const cx = (j: number) => MX + j * GAP
const IW = 58
const IH = 34
const IY = 40
const WW = 54
const WH = 30
const WY = 132
const AW = 320
const AX0 = (W - AW) / 2 // 220
const AH = 58
const AY = 286
const ACX = W / 2 // 380
const land = (j: number) => Number((AX0 + ((j + 0.5) / N) * AW).toFixed(2))

const fmt = (n: number, d = 2) => (n < 0 ? "−" : "") + Math.abs(n).toFixed(d)
const wtLabel = (v: number) => (v > 0 ? "+1" : v < 0 ? "−1" : "0")

const curve = (x2: number, y2: number) => {
  const x1 = ACX
  const y1 = AY
  const my = Number(((y1 + y2) / 2).toFixed(2))
  return `M ${x1} ${y1} C ${x1} ${my}, ${x2} ${my}, ${x2} ${y2}`
}

export function SignedAccumulate() {
  const [ternary, setTernary] = useState(true)
  const [step, setStep] = useState(N) // how many terms are revealed (0..N)

  const term = (j: number) => (ternary ? WT[j] * X[j] : WFP[j] * X[j])
  const running = Array.from({ length: N }, (_, j) => j).reduce(
    (s, j) => (j < step ? s + term(j) : s),
    0
  )
  const total = Array.from({ length: N }, (_, j) => j).reduce((s, j) => s + term(j), 0)
  const output = ternary ? SCALE * total : total

  const muls = ternary ? 1 : N // ternary: only the final scale multiply
  const addsub = ternary ? WT.filter((v) => v !== 0).length : N - 1
  const skips = ternary ? WT.filter((v) => v === 0).length : 0

  // current-step description
  const k = step
  const j = k - 1
  let stepText: string
  if (k === 0) {
    stepText = "sum starts at 0"
  } else if (ternary) {
    const op = WT[j] > 0 ? "add" : WT[j] < 0 ? "subtract" : "skip"
    stepText =
      WT[j] === 0
        ? `step ${k}: skip x${j} · sum ${fmt(running)}`
        : `step ${k}: ${op} x${j} (${fmt(X[j])}) → sum ${fmt(running)}`
  } else {
    stepText = `step ${k}: ${fmt(WFP[j])} × ${fmt(X[j])} = ${fmt(term(j))} → sum ${fmt(running)}`
  }

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex items-center justify-between border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>one output neuron · w·x</span>
        <span className="text-muted-foreground/50">illustrative</span>
      </div>

      <div className="p-3 sm:p-4">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full"
          role="img"
          aria-label={`A ${N}-element dot product of an activation vector with a ${
            ternary ? "ternary" : "full-precision"
          } weight vector, revealed to step ${step}, running sum ${fmt(running)}.`}
        >
          <defs>
            <marker id="tern-arrow" viewBox="0 -5 10 10" markerWidth="7" markerHeight="7" orient="auto" refX="7" refY="0">
              <path d="M0,-4L6,0L0,4" fill="none" stroke={ACCENT} strokeWidth={1.5} />
            </marker>
            <filter id="tern-soft" x="-40%" y="-40%" width="180%" height="180%">
              <feDropShadow dx="0" dy="1" stdDeviation="1.4" floodOpacity="0.14" />
            </filter>
          </defs>

          {/* row labels */}
          <text x={MX - 34} y={IY + 22} className="fill-muted-foreground font-mono" fontSize={10}>
            x
          </text>
          <text x={MX - 34} y={WY + 20} className="fill-muted-foreground font-mono" fontSize={10}>
            w
          </text>

          {/* connectors: each weight pours into the accumulator */}
          {Array.from({ length: N }, (_, i) => {
            const revealed = i < step
            const isSkip = ternary && WT[i] === 0
            return (
              <path
                key={`e${i}`}
                d={curve(cx(i), WY + WH)}
                fill="none"
                stroke={isSkip ? "var(--muted-foreground)" : ACCENT}
                strokeWidth={1.5}
                strokeDasharray={isSkip ? "3 4" : undefined}
                markerEnd={isSkip ? undefined : "url(#tern-arrow)"}
                opacity={revealed ? (isSkip ? 0.28 : 0.85) : 0.1}
                className="transition-all duration-300"
              />
            )
          })}

          {/* input → weight ticks */}
          {Array.from({ length: N }, (_, i) => (
            <line
              key={`t${i}`}
              x1={cx(i)}
              y1={IY + IH}
              x2={cx(i)}
              y2={WY}
              stroke="var(--border)"
              strokeWidth={1.5}
            />
          ))}

          {/* activation nodes */}
          {Array.from({ length: N }, (_, i) => (
            <g key={`x${i}`}>
              <rect
                x={cx(i) - IW / 2}
                y={IY}
                width={IW}
                height={IH}
                rx={8}
                fill="var(--background)"
                stroke="var(--border)"
                strokeWidth={1.5}
                filter="url(#tern-soft)"
              />
              <text x={cx(i)} y={IY + 22} textAnchor="middle" className="fill-foreground font-mono" fontSize={12}>
                {fmt(X[i])}
              </text>
            </g>
          ))}

          {/* weight pills */}
          {Array.from({ length: N }, (_, i) => {
            const isSkip = ternary && WT[i] === 0
            const filled = ternary && WT[i] > 0
            return (
              <g key={`w${i}`}>
                <rect
                  x={cx(i) - WW / 2}
                  y={WY}
                  width={WW}
                  height={WH}
                  rx={7}
                  fill={filled ? ACCENT : "var(--background)"}
                  stroke={isSkip ? "var(--border)" : ACCENT}
                  strokeWidth={1.5}
                  opacity={isSkip ? 0.5 : 1}
                  className="transition-all duration-300"
                />
                <text
                  x={cx(i)}
                  y={WY + 20}
                  textAnchor="middle"
                  className="font-mono"
                  fontSize={ternary ? 13 : 11}
                  fontWeight={ternary ? 600 : 400}
                  fill={filled ? "var(--background)" : isSkip ? "var(--muted-foreground)" : "var(--foreground)"}
                >
                  {ternary ? wtLabel(WT[i]) : fmt(WFP[i])}
                </text>
              </g>
            )
          })}

          {/* accumulator */}
          <g>
            <rect
              x={AX0}
              y={AY}
              width={AW}
              height={AH}
              rx={10}
              fill="var(--background)"
              stroke={ACCENT}
              strokeWidth={1.5}
              filter="url(#tern-soft)"
            />
            <text x={ACX} y={AY + 23} textAnchor="middle" className="fill-muted-foreground font-mono" fontSize={11}>
              {ternary ? "Σ signed accumulation" : "Σ multiply–accumulate"}
            </text>
            <text x={ACX} y={AY + 44} textAnchor="middle" className="fill-foreground font-mono" fontSize={17} fontWeight={600}>
              {fmt(running)}
            </text>
          </g>
        </svg>

        {/* controls */}
        <div className="mt-1 flex flex-wrap items-center gap-x-5 gap-y-2">
          <div className="flex items-center gap-1.5">
            <span className="font-mono text-[10px] text-muted-foreground">mode</span>
            {[
              { on: true, label: "ternary" },
              { on: false, label: "full precision" },
            ].map((m) => (
              <button
                key={m.label}
                type="button"
                onClick={() => setTernary(m.on)}
                aria-pressed={ternary === m.on}
                className={cn(
                  "cursor-pointer rounded-md px-2 py-1 font-mono text-[10px] transition-colors",
                  ternary === m.on ? "text-background" : "bg-muted text-muted-foreground hover:text-foreground"
                )}
                style={ternary === m.on ? { background: ACCENT } : undefined}
              >
                {m.label}
              </button>
            ))}
          </div>
          <div className="ml-auto font-mono text-[10px] text-muted-foreground">
            <span style={{ color: ACCENT }}>{muls}</span> multiply{muls === 1 ? "" : "s"} · {addsub} add/sub
            {skips ? ` · ${skips} skip` : ""}
          </div>
        </div>

        <div className="mt-3">
          <div className="mb-1 flex items-center justify-between font-mono text-[10px] text-muted-foreground">
            <span>reveal terms (drag)</span>
            <span>{stepText}</span>
          </div>
          <Range
            min={0}
            max={N}
            value={step}
            onChange={(e) => setStep(Number(e.target.value))}
            className="w-full cursor-pointer"
            accent={ACCENT}
          />
        </div>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Same dot product, two costs. In{" "}
          <span className="text-foreground">full precision</span> every element is a{" "}
          <span className="text-foreground">multiply</span> then an add — {N} multiplies here. In{" "}
          <span style={{ color: ACCENT }}>ternary</span> the weight is only a sign, so each term is{" "}
          <span className="text-foreground">add</span> (+1), <span className="text-foreground">subtract</span> (−1), or{" "}
          <span className="text-foreground">skip</span> (0). The inner loop has{" "}
          <span style={{ color: ACCENT }}>zero</span> multiplies; a single per-channel scale
          (×{SCALE}) is applied once at the end → output {fmt(output)}.
        </p>
      </div>
    </figure>
  )
}
