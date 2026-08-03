"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// The paper's whole argument, in one picture. For two distinct prompts s != s', the
// parameters that make them collide are the zero set of a real-analytic function h(theta)
// -- and a real-analytic function is either zero everywhere, or zero on a set of Lebesgue
// measure zero (here: a thin curve inside the parameter-space rectangle, not a region).
// Any continuous-density initializer -- and, by Theorem 2.3, any finite number of gradient
// steps -- places zero probability mass on that curve. Landing on it exactly takes
// deliberate construction (e.g. hand-setting two vocabulary embeddings bit-identical), not
// chance. Toggle the parameter regime and watch what happens to four prompts' hidden states.

type Mode = "init" | "trained" | "engineered"

const ACCENT = "oklch(0.60 0.15 255)"
const BAD = "oklch(0.65 0.19 25)"

const W = 740
const H = 260

// left panel: parameter space theta
const LX = 20
const LY = 30
const LW = 300
const LH = 200

// a quadratic bezier fully inside the left panel; the "engineered" marker sits at its
// t=0.5 point, so it is exactly on the drawn curve rather than merely near it.
const CURVE_P0 = { x: 50, y: 210 }
const CURVE_C = { x: 190, y: 45 }
const CURVE_P1 = { x: 330, y: 210 }
const CURVE_MID = { x: 190, y: 127.5 } // 0.25*P0 + 0.5*C + 0.25*P1

const THETA: Record<Mode, { x: number; y: number }> = {
  init: { x: 90, y: 185 },
  trained: { x: 260, y: 185 },
  engineered: CURVE_MID,
}

// right panel: hidden-state space, one dot per prompt
const RX = 420

const STATES: Record<Mode, { x: number; y: number; label: string }[]> = {
  init: [
    { x: 460, y: 70, label: "s1" },
    { x: 560, y: 60, label: "s2" },
    { x: 500, y: 170, label: "s3" },
    { x: 650, y: 190, label: "s4" },
  ],
  trained: [
    { x: 470, y: 85, label: "s1" },
    { x: 575, y: 55, label: "s2" },
    { x: 515, y: 180, label: "s3" },
    { x: 640, y: 175, label: "s4" },
  ],
  engineered: [
    { x: 470, y: 85, label: "s1" },
    { x: 575, y: 55, label: "s2" },
    { x: 560, y: 150, label: "s3" },
    { x: 560, y: 150, label: "s4" },
  ],
}

const LABEL: Record<Mode, string> = {
  init: "random init",
  trained: "after training",
  engineered: "hand-engineered",
}

const RESULT: Record<Mode, string> = {
  init: "4 distinct hidden states (probability 1)",
  trained: "still 4 distinct hidden states (probability 1)",
  engineered: "s3 = s4 (probability 0 — built by hand)",
}

export function MeasureZeroMap() {
  const [mode, setMode] = useState<Mode>("init")
  const theta = THETA[mode]
  const states = STATES[mode]
  const collided = mode === "engineered"
  const midY = H / 2

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex items-center justify-between border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>parameters θ → hidden states, one prompt each</span>
        <span className="text-muted-foreground/50">illustrative</span>
      </div>

      <div className="p-3 sm:p-4">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full"
          role="img"
          aria-label={`Parameter regime: ${LABEL[mode]}. Result: ${RESULT[mode]}.`}
        >
          <defs>
            <filter id="mz-soft" x="-40%" y="-40%" width="180%" height="180%">
              <feDropShadow dx="0" dy="1" stdDeviation="1.4" floodOpacity="0.14" />
            </filter>
            <marker id="mz-arrow" viewBox="0 -5 10 10" markerWidth="7" markerHeight="7" orient="auto" refX="7" refY="0">
              <path d="M0,-4L6,0L0,4" fill="none" stroke="var(--muted-foreground)" strokeWidth={1.5} />
            </marker>
          </defs>

          {/* left panel: parameter space */}
          <rect x={LX} y={LY} width={LW} height={LH} rx={8} fill={ACCENT} opacity={0.05} stroke="var(--border)" strokeWidth={1} />
          <text x={LX + 8} y={LY + 16} className="fill-muted-foreground font-mono" fontSize={9.5}>
            parameters θ — measure 1, reachable by init/training
          </text>
          <path
            d={`M ${CURVE_P0.x} ${CURVE_P0.y} Q ${CURVE_C.x} ${CURVE_C.y} ${CURVE_P1.x} ${CURVE_P1.y}`}
            fill="none"
            stroke={BAD}
            strokeWidth={1.5}
            strokeDasharray="4 3"
            opacity={0.85}
          />
          <text x={CURVE_C.x} y={CURVE_C.y - 8} textAnchor="middle" fill={BAD} className="font-mono" fontSize={8.5}>
            collision set — measure zero
          </text>

          <circle
            cx={theta.x}
            cy={theta.y}
            r={7}
            fill={collided ? BAD : ACCENT}
            stroke="var(--background)"
            strokeWidth={2}
            filter="url(#mz-soft)"
            className="transition-all duration-500"
          />
          <text x={theta.x} y={theta.y + 22} textAnchor="middle" className="fill-foreground font-mono" fontSize={10}>
            θ
          </text>

          {/* connecting arrow */}
          <path
            d={`M ${LX + LW + 8} ${midY} L ${RX - 10} ${midY}`}
            stroke="var(--muted-foreground)"
            strokeWidth={1.5}
            markerEnd="url(#mz-arrow)"
            opacity={0.7}
          />
          <text x={(LX + LW + RX) / 2} y={midY - 8} textAnchor="middle" className="fill-muted-foreground font-mono" fontSize={10}>
            r(·; θ)
          </text>

          {/* right panel: hidden states */}
          <rect x={RX} y={LY} width={LW} height={LH} rx={8} fill="var(--muted)" opacity={0.18} stroke="var(--border)" strokeWidth={1} />
          <text x={RX + 8} y={LY + 16} className="fill-muted-foreground font-mono" fontSize={9.5}>
            hidden states r(s; θ), one per prompt
          </text>

          {states.map((s, i) => {
            const isCollision = collided && (s.label === "s3" || s.label === "s4")
            return (
              <g key={s.label + i}>
                {isCollision && i === 2 ? (
                  <circle cx={s.x} cy={s.y} r={13} fill="none" stroke={BAD} strokeWidth={1.5} opacity={0.75} />
                ) : null}
                <circle
                  cx={s.x}
                  cy={s.y}
                  r={6}
                  fill={isCollision ? BAD : ACCENT}
                  opacity={0.92}
                  filter="url(#mz-soft)"
                  className="transition-all duration-500"
                />
                <text x={s.x} y={s.y - 11} textAnchor="middle" className="fill-foreground font-mono" fontSize={9.5}>
                  {s.label}
                </text>
              </g>
            )
          })}
        </svg>

        <div className="mt-1 flex flex-wrap items-center gap-x-5 gap-y-2">
          <div className="flex items-center gap-1.5">
            <span className="font-mono text-[10px] text-muted-foreground">θ regime</span>
            {(["init", "trained", "engineered"] as Mode[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                aria-pressed={mode === m}
                className={cn(
                  "cursor-pointer rounded-md px-2 py-1 font-mono text-[10px] transition-colors",
                  mode === m ? "text-background" : "bg-muted text-muted-foreground hover:text-foreground"
                )}
                style={mode === m ? { background: m === "engineered" ? BAD : ACCENT } : undefined}
              >
                {LABEL[m]}
              </button>
            ))}
          </div>
          <div className="ml-auto font-mono text-[10px]" style={{ color: collided ? BAD : ACCENT }}>
            {RESULT[mode]}
          </div>
        </div>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          The shaded rectangle is parameter space; the dashed curve is the full set of
          parameters where two fixed prompts would collide — a lower-dimensional set, measure
          zero inside it. Random init and every finite number of gradient steps place θ
          somewhere in the shaded area outside that curve, so the four prompts keep four
          distinct hidden states — watch <strong>s1</strong>–<strong>s4</strong>{" "}stay apart
          across <strong>random init</strong>{" "}and <strong>after training</strong>. Only{" "}
          <strong>hand-engineered</strong>{" "}moves θ exactly onto the curve — built by hand, not
          reached by chance — and <strong>s3</strong>{" "}and <strong>s4</strong>{" "}land on the same
          point.
        </p>
      </div>
    </figure>
  )
}
