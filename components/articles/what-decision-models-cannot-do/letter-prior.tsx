// The letter prior, measured.
//
// openjev ships an `option_reversal` perturbation: the same evidence, the same
// question, the same three options, listed backwards. Every reversed row carries
// the `base_id` of the row it came from, and both sets of raw logits are
// committed. All 36 pairs are three-option questions, so reversing swaps slots
// A and C and leaves B where it was.
//
// That makes B a control. For each pair we take the change in B's logit as the
// global drift of the last-position logits, subtract it, and read off how much
// an option's score moved purely because its text changed slot. Averaging the
// A→C and C→A directions gives one number per question: how many logits slot A
// is worth, independent of what is written in it.
//
// Server-rendered SVG, zero JS. Every coordinate is +, -, * or / on committed
// values — no Math.* that could disagree between Node and the browser.

// value = per-question advantage of slot A over slot C, in logits, B-centred.
// flip  = the model's argmax answer changed when the list was reversed.
const PAIRS: { v: number; flip: boolean }[] = [
  { v: -1.0625, flip: true },
  { v: -0.6875, flip: false },
  { v: -0.625, flip: true },
  { v: -0.1875, flip: false },
  { v: 0.0625, flip: false },
  { v: 0.25, flip: true },
  { v: 0.875, flip: false },
  { v: 0.9375, flip: true },
  { v: 0.9375, flip: true },
  { v: 0.9375, flip: false },
  { v: 1.0625, flip: false },
  { v: 1.1875, flip: false },
  { v: 1.3125, flip: false },
  { v: 1.3125, flip: false },
  { v: 1.4375, flip: false },
  { v: 1.5, flip: false },
  { v: 1.5, flip: false },
  { v: 1.5, flip: false },
  { v: 1.625, flip: false },
  { v: 1.6875, flip: false },
  { v: 1.75, flip: false },
  { v: 1.8125, flip: true },
  { v: 1.875, flip: false },
  { v: 1.9375, flip: false },
  { v: 2.0, flip: true },
  { v: 2.0625, flip: false },
  { v: 2.125, flip: false },
  { v: 2.125, flip: false },
  { v: 2.25, flip: false },
  { v: 2.375, flip: false },
  { v: 3.125, flip: true },
  { v: 3.6875, flip: true },
  { v: 4.0, flip: false },
  { v: 4.5625, flip: false },
  { v: 4.6875, flip: false },
  { v: 5.625, flip: true },
]

const MEDIAN = 1.5625
const TOP = 6 // top of the axis, in logits
const PX = 32 // pixels per logit
const AXIS_X = 52
const BAR = 15
const GAP = 4
const PLOT_TOP = 26
const ZERO_Y = PLOT_TOP + TOP * PX // y of the 0-logit line
const BOTTOM = PLOT_TOP + 8 * PX // axis runs +6 down to -2
const W = AXIS_X + PAIRS.length * (BAR + GAP) + 18

const TICKS = [6, 4, 2, 0, -2]

export function LetterPrior() {
  const flips = PAIRS.filter((p) => p.flip).length
  return (
    <figure className="my-8 overflow-x-auto rounded-md border">
      <div className="border-b px-3 py-2 font-mono text-xs text-muted-foreground">
        openjev · option_reversal, 36 pairs · what slot A is worth, in logits
      </div>
      <svg
        viewBox={`0 0 ${W} ${BOTTOM + 52}`}
        className="w-full min-w-[720px]"
        role="img"
        aria-label={`Thirty-six vertical bars, one per reversed question, sorted from lowest to highest. Each bar is how many logits an option gains purely by sitting in slot A rather than slot C, after subtracting the drift measured on the unmoved middle option. Thirty-two of the thirty-six bars are positive. The median is 1.56 logits and the mean is 1.71. Ten bars, drawn solid, are the questions where the model's answer changed when the list was reversed; they are scattered across the range rather than concentrated at the large values.`}
      >
        {/* gridlines + axis labels */}
        {TICKS.map((t) => {
          const y = PLOT_TOP + (TOP - t) * PX
          return (
            <g key={t}>
              <line
                x1={AXIS_X - 6}
                y1={y}
                x2={W - 12}
                y2={y}
                className={t === 0 ? "stroke-foreground/45" : "stroke-border"}
                strokeWidth={t === 0 ? 1.25 : 0.75}
                strokeDasharray={t === 0 ? undefined : "2 5"}
              />
              <text
                x={AXIS_X - 12}
                y={y + 4}
                textAnchor="end"
                className="fill-muted-foreground font-mono"
                style={{ fontSize: 10.5 }}
              >
                {t > 0 ? `+${t}` : t}
              </text>
            </g>
          )
        })}

        {/* median rule */}
        <line
          x1={AXIS_X - 6}
          y1={PLOT_TOP + (TOP - MEDIAN) * PX}
          x2={W - 12}
          y2={PLOT_TOP + (TOP - MEDIAN) * PX}
          className="stroke-foreground/35"
          strokeWidth={1}
          strokeDasharray="6 4"
        />
        <text
          x={W - 14}
          y={PLOT_TOP + (TOP - MEDIAN) * PX - 6}
          textAnchor="end"
          className="fill-muted-foreground font-mono"
          style={{ fontSize: 10.5 }}
        >
          median +1.56
        </text>

        {/* bars */}
        {PAIRS.map((p, i) => {
          const x = AXIS_X + i * (BAR + GAP)
          const y = PLOT_TOP + (TOP - p.v) * PX
          const top = p.v >= 0 ? y : ZERO_Y
          const h = p.v >= 0 ? ZERO_Y - y : y - ZERO_Y
          return (
            <rect
              key={i}
              x={x}
              y={top}
              width={BAR}
              height={h < 1 ? 1 : h}
              rx={2}
              className={
                p.flip
                  ? "fill-foreground/75 stroke-foreground/75"
                  : "fill-foreground/15 stroke-foreground/40"
              }
              strokeWidth={1}
            />
          )
        })}

        {/* axis title */}
        <text
          x={AXIS_X}
          y={BOTTOM + 24}
          className="fill-muted-foreground font-mono"
          style={{ fontSize: 10.5 }}
        >
          one bar per question, sorted · solid = the answer flipped when the list was
          reversed ({flips} of {PAIRS.length})
        </text>
        <text
          x={AXIS_X}
          y={BOTTOM + 40}
          className="fill-muted-foreground font-mono"
          style={{ fontSize: 10.5 }}
        >
          flipped questions had a median winning margin of 1.81 logits; the questions that
          held had 4.50
        </text>
      </svg>
      <figcaption className="border-t px-3 py-2 font-mono text-xs leading-5 text-muted-foreground">
        Measured from openjev&apos;s committed fixtures and raw predictions at commit
        b9cb325 — an unadapted Qwen3.5-4B, so this is the prior a base model brings, not
        one a trained decision model is stuck with. The prior does not flip an answer on
        its own; it flips the ones whose content margin was the same size as the prior.
      </figcaption>
    </figure>
  )
}
