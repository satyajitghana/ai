// The whole application policy, drawn.
//
// cli/beacon/internal/learning/evaluator.go:
//   func evaluationScore(results) float64 { sum / float64(len(results)) }
// cli/beacon/internal/learning/candidate.go:
//   const CandidateScoreThreshold = 0.60
//   if eval.Score < CandidateScoreThreshold { return ..., false }
//
// An unweighted mean of three probabilities against one constant. mean >= 0.60
// is the same test as sum >= 1.80, so the three answers can be drawn as one
// stacked bar against a single line, and the trades between them are visible.
//
// The trade that matters: reusable_correction is the only question about reuse,
// and it has no floor of its own. A run the model is certain carries no reusable
// lesson still clears the gate if the other two are high enough — row D below is
// 0.00 on reuse and becomes a candidate. That is not a tuning mistake, it is
// what an unweighted mean of a conjunction does.
//
// The probabilities are illustrative: nothing in the repository publishes a
// scored trace, so these are worked cases against the real gate, not measured
// outputs. The arithmetic is exact.
//
// Server-rendered, zero JS.

const TINTS = ["oklch(0.55 0.14 250)", "oklch(0.62 0.15 85)", "oklch(0.58 0.15 152)"]
const FAIL = "oklch(0.58 0.19 27)"

const W = 760
const LABEL_W = 176
const BAR_X = LABEL_W
const BAR_W = W - LABEL_W - 150
const ROW_H = 44
const TOP = 30
const GATE = 1.8
const MAX = 3

type Case = {
  label: string
  q: [number, number, number]
  note: string
}

const CASES: Case[] = [
  {
    label: "the intended case",
    q: [0.95, 0.88, 0.82],
    note: "succeeded, reusable, evidenced",
  },
  {
    label: "a failed run with a lesson",
    q: [0.12, 0.93, 0.88],
    note: "task failed — promoted, correctly",
  },
  {
    label: "a routine green run",
    q: [0.97, 0.22, 0.79],
    note: "little to reuse — promoted anyway",
  },
  {
    label: "certain there is nothing to learn",
    q: [1.0, 0.0, 0.81],
    note: "reuse 0.00 — still a candidate",
  },
  {
    label: "uncertain about everything",
    q: [0.58, 0.59, 0.58],
    note: "nothing decided — discarded",
  },
]

const x = (v: number) => (v / MAX) * BAR_W

export function MeanGate() {
  const H = TOP + CASES.length * ROW_H + 26

  return (
    <figure className="my-8 overflow-hidden rounded-md border">
      <div className="border-b px-3 py-2 font-mono text-xs text-muted-foreground">
        candidate.go — <span className="text-foreground">mean(3 answers) &gt;= 0.60</span>, which
        is sum &gt;= 1.80
      </div>

      <div className="px-3 pt-3 pb-2">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full"
          role="img"
          aria-label="Five stacked bars, one per worked case, each the sum of three probabilities: task success, reusable correction and evidence supported. A vertical line marks the 1.80 promotion threshold, which is the same test as a mean of 0.60. The intended case sums to 2.65 and passes. A failed run with a strong lesson sums to 1.93 and passes. A routine green run with little to reuse sums to 1.98 and passes. A run the model scores 0.00 on reusable correction still sums to 1.81 and passes. A run that is uncertain on all three sums to 1.75 and is discarded."
        >
          <text
            x={BAR_X + x(GATE)}
            y={16}
            textAnchor="middle"
            fontSize={10}
            fill="var(--muted-foreground)"
          >
            promote at 1.80
          </text>
          <line
            x1={BAR_X + x(GATE)}
            x2={BAR_X + x(GATE)}
            y1={TOP - 8}
            y2={TOP + CASES.length * ROW_H - 6}
            stroke="var(--foreground)"
            strokeOpacity={0.5}
            strokeDasharray="3 3"
          />

          {CASES.map((c, i) => {
            const y = TOP + i * ROW_H
            const sum = c.q[0] + c.q[1] + c.q[2]
            const pass = sum >= GATE
            let cursor = 0
            return (
              <g key={c.label}>
                <text
                  x={BAR_X - 10}
                  y={y + 12}
                  textAnchor="end"
                  fontSize={11}
                  fill="var(--foreground)"
                >
                  {c.label}
                </text>
                <text
                  x={BAR_X - 10}
                  y={y + 26}
                  textAnchor="end"
                  fontSize={10}
                  fill={pass ? "var(--muted-foreground)" : FAIL}
                >
                  {c.note}
                </text>

                {c.q.map((v, j) => {
                  const bx = BAR_X + x(cursor)
                  cursor += v
                  return (
                    <g key={j}>
                      <rect
                        x={bx}
                        y={y}
                        width={Math.max(x(v), 0.5)}
                        height={20}
                        fill={TINTS[j]}
                        fillOpacity={pass ? 0.45 : 0.18}
                      />
                      {v >= 0.3 ? (
                        <text
                          x={bx + x(v) / 2}
                          y={y + 14}
                          textAnchor="middle"
                          fontSize={9}
                          fill="var(--foreground)"
                          fillOpacity={0.85}
                        >
                          {v.toFixed(2)}
                        </text>
                      ) : null}
                    </g>
                  )
                })}
                <rect
                  x={BAR_X}
                  y={y}
                  width={Math.max(x(sum), 1)}
                  height={20}
                  fill="none"
                  stroke={pass ? "var(--foreground)" : FAIL}
                  strokeOpacity={0.5}
                  strokeWidth={1}
                />

                <text
                  x={BAR_X + x(sum) + 8}
                  y={y + 14}
                  fontSize={10}
                  fill={pass ? "var(--foreground)" : FAIL}
                >
                  {sum.toFixed(2)} · {pass ? "candidate" : "discarded"}
                </text>
              </g>
            )
          })}

          <g transform={`translate(${BAR_X}, ${TOP + CASES.length * ROW_H + 12})`}>
            {["task_success", "reusable_correction", "evidence_supported"].map((name, j) => (
              <g key={name} transform={`translate(${j * 170}, 0)`}>
                <rect width={9} height={9} y={-8} fill={TINTS[j]} fillOpacity={0.45} />
                <text x={14} y={0} fontSize={10} fill="var(--muted-foreground)">
                  {name}
                </text>
              </g>
            ))}
          </g>
        </svg>
      </div>

      <p className="my-0 border-t px-4 py-3 text-xs text-muted-foreground">
        Row four is the one to look at. The model has answered{" "}
        <span className="font-mono">reusable_correction: 0.00</span> — there is nothing here worth
        keeping — and the trace becomes a review candidate anyway, because a successful,
        well-evidenced run carries 1.81 on its own. The three questions read as a conjunction and
        are scored as an average, and an average has no veto in it. A one-line fix exists:
        require <span className="font-mono">reusable_correction</span> to clear its own floor
        before the mean is consulted. Probabilities here are illustrative — no scored trace is
        published anywhere in the repository — but the threshold and the arithmetic are the
        shipped ones.
      </p>
    </figure>
  )
}
