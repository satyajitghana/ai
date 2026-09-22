// What "automatic recovery" does to side effects that already escaped, measured
// against the pre-restructure controller (commit b777313) with a harness whose
// every step performs one irreversible action. One interrupted turn plus one new
// user message produced three harness runs and fourteen effects, and the event
// log recorded all of them without ever marking a duplicate.
//
// Numbers are from the probe described in the article: 6-step harness,
// SQLite event log, client disconnect after 2 steps.
//
// Server-rendered SVG, zero JS, integer arithmetic only.
const ACCENT = "oklch(0.60 0.15 255)"
const BAD = "oklch(0.58 0.19 27)"
const AMBER = "oklch(0.68 0.13 85)"

type Run = {
  label: string
  note: [string, string]
  done: number
  total: number
  cut: boolean
  tone: string
}

const RUNS: Run[] = [
  {
    label: "run 1",
    note: ["client disconnects,", "ctx cancelled"],
    done: 2,
    total: 6,
    cut: true,
    tone: AMBER,
  },
  {
    label: "run 2",
    note: ["the resume branch —", "whole turn again"],
    done: 6,
    total: 6,
    cut: false,
    tone: BAD,
  },
  {
    label: "run 3",
    note: ["the new input —", "whole turn a third time"],
    done: 6,
    total: 6,
    cut: false,
    tone: BAD,
  },
]

export function ReplayLedger() {
  const W = 880
  const H = 372
  const cellW = 62
  const cellH = 26
  const x0 = 158
  const rowY = (i: number) => 74 + i * 62

  return (
    <figure className="my-8 overflow-x-auto rounded-md border">
      <div className="border-b px-3 py-2 font-mono text-xs text-muted-foreground">
        measured — one interruption, one follow-up message, three runs of the same
        turn, fourteen side effects
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full min-w-[780px]"
        role="img"
        aria-label="A ledger of three harness runs of the same conversation turn. Run one performs effect zero and effect one, then the client disconnects and the run is cut off; two effects have escaped. Run two is the controller's resume branch, which starts the turn over and performs all six effects, so effect zero and effect one happen a second time; the running total is eight. Run three is the branch that carries the user's new input, and it performs all six effects again; the running total is fourteen. Effect zero is performed three times. Below, the durable event log is shown as eighteen appended steps with no marker distinguishing a replay from a first execution, and with the interaction id field empty on every one of them."
      >
        <text x={16} y={28} className="fill-foreground font-mono" style={{ fontSize: 11 }}>
          one user request: &quot;do the thing&quot; · interrupted · &quot;carry on&quot;
        </text>
        <text
          x={16}
          y={44}
          className="fill-muted-foreground font-mono"
          style={{ fontSize: 9 }}
        >
          each cell is one irreversible action the harness has already taken
        </text>

        <text
          x={x0}
          y={62}
          className="fill-muted-foreground font-mono"
          style={{ fontSize: 8.5 }}
        >
          effect-0
        </text>
        <text
          x={x0 + cellW * 5}
          y={62}
          className="fill-muted-foreground font-mono"
          style={{ fontSize: 8.5 }}
        >
          effect-5
        </text>
        <text
          x={712}
          y={62}
          className="fill-muted-foreground font-mono"
          style={{ fontSize: 8.5 }}
        >
          effects escaped
        </text>

        {RUNS.map((run, i) => {
          const y = rowY(i)
          const cumulative = RUNS.slice(0, i + 1).reduce((a, r) => a + r.done, 0)
          return (
            <g key={run.label}>
              <text
                x={16}
                y={y + 17}
                className="fill-foreground font-mono"
                style={{ fontSize: 10 }}
              >
                {run.label}
              </text>
              <text
                x={16}
                y={y + 33}
                className="fill-muted-foreground font-mono"
                style={{ fontSize: 8 }}
              >
                {run.note[0]}
              </text>
              <text
                x={16}
                y={y + 44}
                className="fill-muted-foreground font-mono"
                style={{ fontSize: 8 }}
              >
                {run.note[1]}
              </text>

              {Array.from({ length: run.total }, (_, k) => {
                const done = k < run.done
                return (
                  <g key={k}>
                    <rect
                      x={x0 + k * cellW}
                      y={y}
                      width={cellW - 6}
                      height={cellH}
                      rx={4}
                      className={done ? "fill-background" : "fill-muted/30"}
                      stroke={done ? run.tone : "var(--border)"}
                      strokeWidth={done ? 1.6 : 1}
                      strokeDasharray={done ? undefined : "3 2"}
                    />
                    <text
                      x={x0 + k * cellW + 12}
                      y={y + 17}
                      className={done ? "fill-foreground font-mono" : "fill-muted-foreground font-mono"}
                      style={{ fontSize: 9 }}
                    >
                      {done ? `e${k}` : "—"}
                    </text>
                  </g>
                )
              })}

              {run.cut ? (
                <g>
                  <path
                    d={`M${x0 + 2 * cellW - 2} ${y - 4} l6 8 l-6 8 l6 8 l-6 8`}
                    fill="none"
                    stroke={AMBER}
                    strokeWidth={1.6}
                  />
                  <text
                    x={x0 + 6 * cellW + 4}
                    y={y + 17}
                    className="font-mono"
                    style={{ fontSize: 9 }}
                    fill={AMBER}
                  >
                    cut here
                  </text>
                </g>
              ) : null}

              <text
                x={760}
                y={y + 18}
                textAnchor="end"
                className="fill-foreground font-mono"
                style={{ fontSize: 15 }}
              >
                {cumulative}
              </text>
            </g>
          )
        })}

        <line
          x1={16}
          y1={266}
          x2={W - 16}
          y2={266}
          className="stroke-border"
          strokeWidth={1}
        />

        <text x={16} y={288} className="fill-foreground font-mono" style={{ fontSize: 10 }}>
          what the durable log holds afterwards
        </text>
        <text
          x={16}
          y={306}
          className="fill-muted-foreground font-mono"
          style={{ fontSize: 8.5 }}
        >
          18 appended steps · effect-0 appears at steps 2, 4 and 12 · nothing marks
          any of them as a replay
        </text>
        <text
          x={16}
          y={322}
          className="fill-muted-foreground font-mono"
          style={{ fontSize: 8.5 }}
        >
          interaction_id is empty on 20 of 20 events in the two-replica probe — the
          field the schema has for telling turns apart is never assigned
        </text>
        <text x={16} y={344} className="font-mono" style={{ fontSize: 9 }} fill={BAD}>
          effects: at-least-once, with no dedup key anywhere in the runtime
        </text>
        <text
          x={420}
          y={344}
          className="font-mono"
          style={{ fontSize: 9 }}
          fill={ACCENT}
        >
          HarnessStart carries no resume position, so the harness cannot tell
        </text>
      </svg>
    </figure>
  )
}
