// How big is "different", when the API only tells you two decimals.
//
// Every probability the hosted model returns lands exactly on the 0.01 grid —
// 69,300 of 69,300 values in this suite. That quantiser is what makes the
// complaint hard to read: noise far below 0.01 still shows up as a visible
// 0.01 change whenever the underlying value happens to sit near a rounding
// boundary. So "the number was different" is not evidence of anything on its
// own. The size of the difference is.
//
// The chart is the answer. Buckets 0 and 1 are the ones a boundary crossing can
// produce; everything at 2 steps or more needs real movement underneath. Both
// distributions put most of their mass past that line, and only the order
// distribution has a tail past 20 steps.
//
// Server-rendered SVG, zero JS, integer coordinates, no Math.* but round().
const W = 920
const H = 356

const PLOT_X = 330
const PLOT_TOP = 62
const BASE_Y = 262
const PLOT_H = 200
const Y_MAX = 30
const GROUP_W = 80
const BAR_W = 30

type Bucket = { label: string; noise: number; order: number }

const BUCKETS: Bucket[] = [
  { label: "0", noise: 29, order: 23 },
  { label: "1", noise: 11, order: 8 },
  { label: "2", noise: 11, order: 7 },
  { label: "3–4", noise: 13, order: 14 },
  { label: "5–9", noise: 28, order: 11 },
  { label: "10–19", noise: 8, order: 22 },
  { label: "20+", noise: 0, order: 15 },
]

const GRID = [0, 10, 20, 30]

function h(count: number): number {
  return Math.round((count * PLOT_H) / Y_MAX)
}

export function MovementHistogram() {
  return (
    <figure className="my-8 overflow-x-auto rounded-md border">
      <div className="border-b px-3 py-2 font-mono text-xs text-muted-foreground">
        100 Banking77 decisions · how far the worst option moved, in units of the API’s own
        rounding step
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full min-w-[780px]"
        role="img"
        aria-label="A paired histogram of how far the most-moved option's probability travelled on each of 100 hosted-Jev decisions, measured in units of 0.01, the API's rounding step. Two series: repeating the identical request three times, and permuting the option list three ways. For repetition the counts are 29 items at zero steps, 11 at one step, 11 at two, 13 at three to four, 28 at five to nine, 8 at ten to nineteen, and none at twenty or more. For permutation they are 23, 8, 7, 14, 11, 22 and 15. A left panel notes that all 69,300 returned probability values sit exactly on the 0.01 grid, that movement of zero or one step is what an arbitrarily small numerical wobble near a rounding boundary would produce, and that everything from two steps up needs real movement underneath: 60 of 100 decisions on repetition and 69 on permutation are past that line, and only permutation reaches past twenty steps."
      >
        {/* ---------- left panel ---------- */}
        <rect
          x={20}
          y={22}
          width={282}
          height={296}
          rx={5}
          className="fill-muted/40 stroke-border"
          strokeWidth={1}
        />
        <text x={34} y={44} className="fill-foreground font-mono" style={{ fontSize: 11 }}>
          THE API ROUNDS TO TWO DECIMALS
        </text>
        <g className="fill-muted-foreground font-mono" style={{ fontSize: 10.5 }}>
          <text x={34} y={66}>69,300 of 69,300 returned values</text>
          <text x={34} y={80}>in this suite sit exactly on the</text>
          <text x={34} y={94}>0.01 grid. Nothing finer is visible</text>
          <text x={34} y={108}>to any caller.</text>
        </g>

        <line x1={34} y1={126} x2={288} y2={126} className="stroke-border" strokeWidth={1} />

        <text x={34} y={148} className="fill-foreground font-mono" style={{ fontSize: 10.5 }}>
          0–1 steps · explainable by rounding
        </text>
        <g className="fill-muted-foreground font-mono" style={{ fontSize: 10 }}>
          <text x={34} y={164}>a value sitting near a boundary flips</text>
          <text x={34} y={177}>its last digit for a wobble of any</text>
          <text x={34} y={190}>size, however small</text>
        </g>

        <text x={34} y={216} className="fill-foreground font-mono" style={{ fontSize: 10.5 }}>
          2+ steps · not a rounding artefact
        </text>
        <g className="fill-muted-foreground font-mono" style={{ fontSize: 10 }}>
          <text x={34} y={232}>the underlying number moved by at</text>
          <text x={34} y={245}>least one whole step</text>
        </g>

        <line x1={34} y1={262} x2={288} y2={262} className="stroke-border" strokeWidth={1} />
        <g className="font-mono" style={{ fontSize: 10.5 }}>
          <text x={34} y={282} className="fill-foreground">
            past that line:
          </text>
          <text x={34} y={298} className="fill-muted-foreground">
            60 / 100 on repetition
          </text>
          <text x={168} y={298} className="fill-foreground">
            69 / 100 on order
          </text>
        </g>

        {/* ---------- grid ---------- */}
        <g className="stroke-border" strokeWidth={1}>
          {GRID.map((g) => (
            <line
              key={g}
              x1={PLOT_X}
              y1={BASE_Y - h(g)}
              x2={900}
              y2={BASE_Y - h(g)}
              strokeDasharray={g === 0 ? undefined : "3 4"}
            />
          ))}
        </g>
        <g className="fill-muted-foreground font-mono" style={{ fontSize: 9.5 }}>
          {GRID.map((g) => (
            <text key={g} x={PLOT_X - 8} y={BASE_Y - h(g) + 4} textAnchor="end">
              {g}
            </text>
          ))}
        </g>
        <text
          x={PLOT_X - 8}
          y={44}
          textAnchor="end"
          className="fill-muted-foreground font-mono"
          style={{ fontSize: 9.5 }}
        >
          items
        </text>

        {/* the rounding-explainable boundary, between bucket "1" and bucket "2" */}
        <line
          x1={PLOT_X + 2 * GROUP_W}
          y1={PLOT_TOP - 30}
          x2={PLOT_X + 2 * GROUP_W}
          y2={BASE_Y}
          className="stroke-foreground/50"
          strokeWidth={1.25}
          strokeDasharray="4 3"
        />
        <text
          x={PLOT_X + 2 * GROUP_W + 8}
          y={PLOT_TOP - 36}
          className="fill-foreground font-mono"
          style={{ fontSize: 10 }}
        >
          → real movement past here
        </text>

        {/* ---------- bars ---------- */}
        {BUCKETS.map((b, i) => {
          const gx = PLOT_X + i * GROUP_W
          const nx = gx + 8
          const ox = gx + 8 + BAR_W + 4
          return (
            <g key={b.label}>
              <rect
                x={nx}
                y={BASE_Y - h(b.noise)}
                width={BAR_W}
                height={h(b.noise)}
                className="fill-muted-foreground/30 stroke-muted-foreground/60"
                strokeWidth={1}
              />
              <rect
                x={ox}
                y={BASE_Y - h(b.order)}
                width={BAR_W}
                height={h(b.order)}
                className="fill-foreground/70 stroke-foreground/70"
                strokeWidth={1}
              />
              <text
                x={nx + BAR_W / 2}
                y={BASE_Y - h(b.noise) - 5}
                textAnchor="middle"
                className="fill-muted-foreground font-mono"
                style={{ fontSize: 9.5 }}
              >
                {b.noise}
              </text>
              <text
                x={ox + BAR_W / 2}
                y={BASE_Y - h(b.order) - 5}
                textAnchor="middle"
                className="fill-foreground font-mono"
                style={{ fontSize: 9.5 }}
              >
                {b.order}
              </text>
              <text
                x={gx + GROUP_W / 2}
                y={BASE_Y + 16}
                textAnchor="middle"
                className="fill-muted-foreground font-mono"
                style={{ fontSize: 10 }}
              >
                {b.label}
              </text>
            </g>
          )
        })}
        <text
          x={PLOT_X + 280}
          y={BASE_Y + 34}
          textAnchor="middle"
          className="fill-muted-foreground font-mono"
          style={{ fontSize: 10 }}
        >
          max |Δp| for the decision, in steps of 0.01
        </text>

        {/* ---------- legend ---------- */}
        <g>
          <rect
            x={PLOT_X + 4}
            y={302}
            width={13}
            height={13}
            className="fill-muted-foreground/30 stroke-muted-foreground/60"
            strokeWidth={1}
          />
          <text
            x={PLOT_X + 24}
            y={313}
            className="fill-muted-foreground font-mono"
            style={{ fontSize: 10.5 }}
          >
            same request, three times
          </text>
          <rect
            x={PLOT_X + 220}
            y={302}
            width={13}
            height={13}
            className="fill-foreground/70 stroke-foreground/70"
            strokeWidth={1}
          />
          <text
            x={PLOT_X + 240}
            y={313}
            className="fill-foreground font-mono"
            style={{ fontSize: 10.5 }}
          >
            option list permuted, three ways
          </text>
        </g>
      </svg>
      <figcaption className="border-t px-3 py-2 font-mono text-xs leading-5 text-muted-foreground">
        One caveat on the leftmost buckets: each value is a maximum over 77 options, so a
        single-step change is much likelier here than it would be for one option watched alone.
        That makes the left of the chart generous to the rounding explanation and the right of
        it harder to explain away — and the right is where both distributions live.
      </figcaption>
    </figure>
  )
}
