"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"
import { Range } from "@/components/articles/ui/range"

// The Jacobian lens is a *derivative*. A Jacobian is the local linear map that
// turns a small change in an activation into the resulting change in the output.
// This widget makes that concrete with one scalar coordinate:
//   - the true stack from h_l to a token's final logit is a nonlinear curve f(x)
//   - the lens replaces it with a straight line: the tangent, slope = f'(x0) = J
// Two honest modes:
//   local   — re-linearize at the probe (J = f'(x), tangent always touches): the
//             textbook Jacobian, exact at the point, good nearby, wrong far away.
//   average — one fixed tangent taken at x0 = 0, used everywhere. This is what the
//             real J-lens does: a single Jacobian averaged over the corpus, so it
//             is systematically off for any individual activation.
// Everything here is a pure function of (probe, mode). No randomness, no timers,
// no unbounded loops — the sampling loop is a fixed 121 points. Safe under SSR.

const TRUE_C = "oklch(0.60 0.14 245)" // blue — the true nonlinear stack
const LENS_C = "oklch(0.70 0.15 65)" // amber — the lens (linear approximation)

const W = 720
const H = 344
const PL = 40
const PR = 18
const PT = 20
const PB = 34
const XMIN = -3
const XMAX = 3
const YMIN = -2.8
const YMAX = 2.8
const N = 121 // fixed sample count for the curve — bounded

// The "true" model: a token's final-layer logit as a function of one activation
// coordinate. Nonlinear on purpose — that is why a single linear lens can only
// approximate it.
function f(x: number): number {
  const u = 1.05 * (x - 0.35)
  return 1.9 * Math.tanh(u) + 0.14 * x
}
// derivative — the scalar Jacobian at x
function fp(x: number): number {
  const u = 1.05 * (x - 0.35)
  const t = Math.tanh(u)
  return 1.9 * 1.05 * (1 - t * t) + 0.14
}

const px = (x: number) => PL + ((x - XMIN) / (XMAX - XMIN)) * (W - PL - PR)
const py = (y: number) => PT + ((YMAX - y) / (YMAX - YMIN)) * (H - PT - PB)

// true-curve polyline, computed once (module scope) — deterministic
const CURVE = Array.from({ length: N }, (_, i) => {
  const x = XMIN + (i / (N - 1)) * (XMAX - XMIN)
  return `${px(x).toFixed(1)},${py(f(x)).toFixed(1)}`
}).join(" ")

export function LensTangent() {
  const [probe, setProbe] = useState(1.6)
  const [mode, setMode] = useState<"local" | "average">("average")

  const x0 = mode === "local" ? probe : 0 // where the tangent is taken
  const J = fp(x0) // the scalar Jacobian
  const L = (x: number) => f(x0) + J * (x - x0) // the lens (tangent line)

  const trueVal = f(probe)
  const lensVal = L(probe)
  const err = Math.abs(trueVal - lensVal)

  // tangent endpoints across the full x-range (clipped to the plot rect)
  const tx1 = XMIN
  const tx2 = XMAX

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex items-center justify-between border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>the lens is a tangent · logit vs one activation coordinate</span>
        <span className="text-muted-foreground/50">illustrative</span>
      </div>

      <div className="p-3 sm:p-4">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full"
          role="img"
          aria-label="A nonlinear curve for a token's true final logit versus one activation coordinate, with the Jacobian lens drawn as a straight tangent line. The tangent matches the curve near where it is taken and drifts away from it far off."
        >
          <defs>
            <clipPath id="lt-plot">
              <rect x={PL} y={PT} width={W - PL - PR} height={H - PT - PB} />
            </clipPath>
          </defs>

          {/* axes */}
          <line x1={PL} y1={py(0)} x2={W - PR} y2={py(0)} stroke="var(--border)" />
          <line x1={px(0)} y1={PT} x2={px(0)} y2={H - PB} stroke="var(--border)" strokeDasharray="2 4" />
          <text x={W - PR} y={py(0) - 6} textAnchor="end" className="fill-muted-foreground font-mono" fontSize={9}>
            activation coordinate →
          </text>
          <text x={PL + 3} y={PT + 9} className="fill-muted-foreground font-mono" fontSize={9}>
            token logit
          </text>

          <g clipPath="url(#lt-plot)">
            {/* true nonlinear model */}
            <polyline points={CURVE} fill="none" stroke={TRUE_C} strokeWidth={2.2} />
            {/* the lens = tangent line */}
            <line
              x1={px(tx1)}
              y1={py(L(tx1))}
              x2={px(tx2)}
              y2={py(L(tx2))}
              stroke={LENS_C}
              strokeWidth={2}
              strokeDasharray="6 4"
            />
            {/* operating point where the Jacobian is taken */}
            <circle cx={px(x0)} cy={py(f(x0))} r={4.5} fill={LENS_C} stroke="var(--background)" strokeWidth={1.5} />

            {/* probe: where we compare true vs lens */}
            <line x1={px(probe)} y1={PT} x2={px(probe)} y2={H - PB} stroke="var(--muted-foreground)" strokeOpacity={0.35} />
            {/* error segment between true and lens at the probe */}
            <line
              x1={px(probe)}
              y1={py(trueVal)}
              x2={px(probe)}
              y2={py(lensVal)}
              stroke="var(--muted-foreground)"
              strokeWidth={5}
              strokeOpacity={0.28}
            />
            <circle cx={px(probe)} cy={py(trueVal)} r={4} fill={TRUE_C} />
            <circle cx={px(probe)} cy={py(lensVal)} r={4} fill="none" stroke={LENS_C} strokeWidth={2} />
          </g>
        </svg>

        {/* controls */}
        <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-3">
          <div className="flex items-center gap-1.5">
            {(["average", "local"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                aria-pressed={mode === m}
                className={cn(
                  "cursor-pointer rounded-md px-2.5 py-1 font-mono text-[10px] transition-colors",
                  mode === m ? "text-background" : "bg-muted text-muted-foreground hover:text-foreground"
                )}
                style={mode === m ? { background: LENS_C } : undefined}
              >
                {m === "average" ? "corpus-average J (real lens)" : "local Jacobian f′(x)"}
              </button>
            ))}
          </div>
          <label className="flex flex-1 items-center gap-2 font-mono text-[10px] text-muted-foreground">
            <span className="shrink-0">probe</span>
            <Range
              min={XMIN}
              max={XMAX}
              step={0.05}
              value={probe}
              onChange={(e) => setProbe(parseFloat(e.target.value))}
              className="h-1 flex-1 cursor-pointer "
              style={{ color: LENS_C }}
              aria-label="Move the probe along the activation coordinate" accent="currentColor" />
          </label>
        </div>

        {/* numeric readout */}
        <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1 font-mono text-[11px] sm:grid-cols-4">
          <div>
            <span className="text-muted-foreground">J = f′(x0)</span>{" "}
            <span style={{ color: LENS_C }}>{J.toFixed(2)}</span>
          </div>
          <div>
            <span className="text-muted-foreground">true</span>{" "}
            <span style={{ color: TRUE_C }}>{trueVal.toFixed(2)}</span>
          </div>
          <div>
            <span className="text-muted-foreground">lens</span>{" "}
            <span style={{ color: LENS_C }}>{lensVal.toFixed(2)}</span>
          </div>
          <div>
            <span className="text-muted-foreground">|error|</span>{" "}
            <span className={cn(err > 0.6 ? "text-destructive" : "text-foreground")}>{err.toFixed(2)}</span>
          </div>
        </div>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          The <span style={{ color: TRUE_C }}>blue curve</span> is the true, nonlinear map from one activation
          coordinate to a token&rsquo;s final logit. The <span style={{ color: LENS_C }}>amber line</span> is the lens:
          a single derivative, drawn as a tangent. In{" "}
          <span style={{ color: LENS_C }}>corpus-average</span> mode the tangent is fixed at one operating point (what
          the real J-lens does — one Jacobian averaged over the corpus), so the error grows as the probe moves away.
          Switch to <span style={{ color: LENS_C }}>local</span> mode and the tangent re-touches the curve at the
          probe: exact at the point, still only a local picture. A Jacobian is a good lens near where it is taken and a
          worse one far from it.
        </p>
      </div>
    </figure>
  )
}
