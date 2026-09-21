import { mexp, mlog, mlog10, mpow } from "@/lib/dmath"

// The claim the article rests on: 0/100 is not the bottom of the same
// distribution that produces a merely bad score. It is a different kind of event.
//
// Draw the sampling distribution a weak-but-capable model would produce on
// 100 independent three-way cases — Binomial(n=100, p=1/3), mean 33.33,
// sd 4.714 — and put the three measured relational-choice scores on the same
// axis. The 4-bit Qwen3-4B prototype's 53 sits just right of the hump. Laya's 8
// and Jev's 0 are both off it, and 0 is the exact floor of the scale.
//
// The tail probabilities are computed here, not asserted: log-factorials summed
// once, exponentiated through lib/dmath so every SVG coordinate serializes
// identically in Node and in the browser. Server-rendered, no JS.

const N = 100
const P = 1 / 3

// log k! for k = 0..N, built once. Summing 12-significant-digit logs keeps the
// ladder deterministic; +, - and * are exact per IEEE-754.
const LOG_FACT: number[] = [0]
for (let i = 1; i <= N; i++) LOG_FACT.push(LOG_FACT[i - 1] + mlog(i))

const LOG_P = mlog(P)
const LOG_Q = mlog(1 - P)

const PMF = Array.from({ length: N + 1 }, (_, k) =>
  mexp(LOG_FACT[N] - LOG_FACT[k] - LOG_FACT[N - k] + k * LOG_P + (N - k) * LOG_Q)
)
const PEAK = Math.max(...PMF)

const MEAN = N * P
const SD = Math.sqrt(N * P * (1 - P))
const LO = MEAN - 2 * SD
const HI = MEAN + 2 * SD

// A two-sided test is the wrong instrument here: each model has a direction we
// care about, so each gets the tail it actually fell into.
const cumUpTo = (k: number) => PMF.slice(0, k + 1).reduce((a, b) => a + b, 0)
const cumFrom = (k: number) => PMF.slice(k).reduce((a, b) => a + b, 0)

// 2.4596544e-18 -> { "2.5", -18 }
function sci(x: number): { mantissa: string; exponent: number } {
  const e = Math.floor(mlog10(x))
  return { mantissa: (x / mpow(10, e)).toFixed(1), exponent: e }
}

type Mark = {
  label: string
  score: number
  tail: "low" | "high"
  row: 0 | 1
  accent: boolean
}

const MARKS: Mark[] = [
  { label: "Jev 1.13", score: 0, tail: "low", row: 0, accent: true },
  { label: "Laya EN 421M", score: 8, tail: "low", row: 1, accent: false },
  { label: "Qwen3-4B 4-bit", score: 53, tail: "high", row: 0, accent: false },
]

const ACCENT = "oklch(0.72 0.15 195)"
const MUTED = "oklch(0.65 0.02 260)"

const W = 680
const H = 312
const padL = 44
const padR = 16
const padT = 34
const padB = 86

const sx = (k: number) => padL + (k / N) * (W - padL - padR)
const sy = (p: number) => padT + (1 - p / PEAK) * (H - padT - padB)

const axisY = sy(0)

const area =
  `M ${sx(0)} ${axisY} ` +
  PMF.map((p, k) => `L ${sx(k)} ${sy(p)}`).join(" ") +
  ` L ${sx(N)} ${axisY} Z`

export function ZeroVsChance() {
  return (
    <figure className="my-8 overflow-hidden rounded-md border">
      <div className="border-b px-3 py-2 font-mono text-xs text-muted-foreground">
        relational choice, 100 cases · measured scores against the chance distribution
      </div>
      <div className="p-4">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full"
          role="img"
          aria-label="The sampling distribution for a model guessing on 100 three-way questions is a narrow hump centred on 33 correct, with a two-sigma band from 24 to 43. The 4-bit Qwen3-4B prototype's score of 53 sits just right of the hump. Laya's 8 and Jev's 0 sit far to the left of it, outside the drawn distribution entirely; 0 is also the floor of the scale."
        >
          <defs>
            <marker
              id="zvc-arrow"
              viewBox="0 -5 10 10"
              markerWidth="7"
              markerHeight="7"
              refX="7"
              refY="0"
              orient="auto"
            >
              <path d="M0,-4L6,0L0,4" fill="none" stroke={ACCENT} strokeWidth={1.5} />
            </marker>
          </defs>

          {/* two-sigma chance band */}
          <rect
            x={sx(LO)}
            y={padT}
            width={sx(HI) - sx(LO)}
            height={axisY - padT}
            fill={MUTED}
            fillOpacity="0.1"
          />
          <text
            x={sx(MEAN)}
            y={12}
            textAnchor="middle"
            className="font-mono"
            fontSize="9"
            fill="currentColor"
            fillOpacity="0.5"
          >
            chance ±2σ · 24–43
          </text>

          {/* the distribution a weak-but-capable model draws from */}
          <path d={area} fill={MUTED} fillOpacity="0.28" stroke={MUTED} strokeWidth="1.5" />

          {/* baseline + ticks */}
          <line
            x1={padL}
            y1={axisY}
            x2={W - padR}
            y2={axisY}
            stroke="currentColor"
            strokeOpacity="0.2"
          />
          {[0, 20, 33, 40, 60, 80, 100].map((k) => (
            <g key={k}>
              <line
                x1={sx(k)}
                y1={axisY}
                x2={sx(k)}
                y2={axisY + 4}
                stroke="currentColor"
                strokeOpacity="0.25"
              />
              <text
                x={sx(k)}
                y={axisY + 15}
                textAnchor="middle"
                className="font-mono"
                fontSize="9"
                fill="currentColor"
                fillOpacity={k === 33 ? 0.75 : 0.45}
              >
                {k}
              </text>
            </g>
          ))}

          {/* the three measured scores */}
          {MARKS.map((m) => {
            const x = sx(m.score)
            const colour = m.accent ? ACCENT : "currentColor"
            const p = m.tail === "low" ? cumUpTo(m.score) : cumFrom(m.score)
            const { mantissa, exponent } = sci(p)
            const top = padT + 22 + m.row * 30
            return (
              <g key={m.label}>
                <line
                  x1={x}
                  y1={top + 18}
                  x2={x}
                  y2={axisY}
                  stroke={colour}
                  strokeOpacity={m.accent ? 1 : 0.5}
                  strokeWidth={m.accent ? 1.8 : 1.2}
                  strokeDasharray={m.accent ? undefined : "3 3"}
                />
                <circle
                  cx={x}
                  cy={axisY}
                  r={m.accent ? 4.5 : 3.5}
                  fill={colour}
                  fillOpacity={m.accent ? 1 : 0.6}
                />
                <text
                  x={x + 6}
                  y={top}
                  className="font-mono"
                  fontSize={m.accent ? "10.5" : "9.5"}
                  fontWeight={m.accent ? 700 : 400}
                  fill={colour}
                  fillOpacity={m.accent ? 1 : 0.75}
                >
                  {m.label} · {m.score}
                </text>
                <text
                  x={x + 6}
                  y={top + 12}
                  className="font-mono"
                  fontSize="9"
                  fill="currentColor"
                  fillOpacity="0.55"
                >
                  {m.tail === "low" ? "P(X≤" : "P(X≥"}
                  {m.score}
                  {") = "}
                  {mantissa}
                  {"×10"}
                  <tspan dy="-3" fontSize="7">
                    {exponent}
                  </tspan>
                </text>
              </g>
            )
          })}

          {/* the distance that matters */}
          <line
            x1={sx(LO) - 2}
            y1={axisY + 32}
            x2={sx(0) + 4}
            y2={axisY + 32}
            stroke={ACCENT}
            strokeWidth="1.4"
            strokeDasharray="3 3"
            markerEnd="url(#zvc-arrow)"
          />
          <text x={sx(LO) + 6} y={axisY + 36} className="font-mono" fontSize="9" fill={ACCENT}>
            7.07σ below chance — and the floor of the scale
          </text>

          <text
            x={(padL + W - padR) / 2}
            y={H - 8}
            textAnchor="middle"
            className="font-mono"
            fontSize="9"
            fill="currentColor"
            fillOpacity="0.45"
          >
            cases answered correctly, out of 100
          </text>
        </svg>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          A model that finds the task <em>hard</em>{" "}still samples from the grey hump. Getting
          nothing at all across a hundred independent tries is not the left edge of that hump — it
          is{" "}
          <span className="text-foreground">
            2.5×10<sup>-18</sup>
          </span>{" "}
          of it, about one draw in 4×10<sup>17</sup>. Laya&apos;s 8 is 2.1×10<sup>-9</sup>, also
          far outside. Both numbers say the same thing, and it is not &ldquo;bad at this&rdquo;:
          these models are following a rule that is <em>anti</em>-correlated with the key, which is
          what happens when the property the question turns on never reaches the scorer.
        </p>
      </div>
      <figcaption className="border-t px-3 py-2 text-center font-mono text-xs leading-5 text-muted-foreground">
        Chance distribution is Binomial(n=100, p=1/3) — mean 33.33, sd 4.714 — drawn rather than
        assumed: the grey curve is the exact pmf, computed in the component. Options per case are
        not published, so p=1/3 is an assumption, and it barely matters: P(X=0) is (1−p)
        <sup>100</sup>, which is 3.2×10<sup>-13</sup>{" "}at four options and 2.0×10<sup>-10</sup>
        {" "}at five. Scores are the relational-choice row of Chopra&apos;s 15-task comparison,
        measured 2026-09-19.
      </figcaption>
    </figure>
  )
}
