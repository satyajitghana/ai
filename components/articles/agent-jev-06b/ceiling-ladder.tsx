// Typed Decisions, with the two lines the README leaves out.
//
// The dataset card publishes a saturation point as well as a floor: a fresh
// teacher sample scored against gold built from the other samples agrees 73.5%
// of the time, and a model that recovers the latent factors each case was
// generated from exactly scores 70.4%. The card states the reading in its own
// words — "a score much above 0.75 means a model has learned the teacher's
// quirks rather than the task". Two specialists are now above the first line.
//
// Server-rendered SVG, zero JS. Coordinates are +, -, * and / on published
// percentages.

type Entry = { label: string; value: number; kind: "reference" | "model" | "ceiling" }

const ROWS: Entry[] = [
  { label: "Uniform", value: 30.8, kind: "reference" },
  { label: "Prior — label frequency, reads nothing", value: 47.0, kind: "reference" },
  { label: "MiniLM-L6 22M — specialist", value: 58.7, kind: "model" },
  { label: "ModernBERT-base 149M — specialist", value: 64.6, kind: "model" },
  { label: "Perfect scenario understanding", value: 70.4, kind: "ceiling" },
  { label: "TypeSafe Jev 1.13.0 — zero-shot", value: 72.7, kind: "model" },
  { label: "Teacher self-agreement", value: 73.5, kind: "ceiling" },
  { label: "Laya — specialist, fitted here", value: 77.0, kind: "model" },
  { label: "AgentJev-0.6B — specialist, fitted here", value: 79.25, kind: "model" },
]

const LEFT = 232
const PLOT = 300
const ROW_H = 26
const TOP = 26
const AXIS_MIN = 25
const AXIS_MAX = 85
const W = LEFT + PLOT + 46
const H = TOP + ROWS.length * ROW_H + 40

const x = (v: number) => LEFT + ((v - AXIS_MIN) / (AXIS_MAX - AXIS_MIN)) * PLOT
const TICKS = [30, 40, 50, 60, 70, 80]

export function CeilingLadder() {
  return (
    <figure className="my-8 overflow-x-auto rounded-md border">
      <div className="border-b px-3 py-2 font-mono text-xs text-muted-foreground">
        Typed Decisions test split · 400 cases, 2,000 questions · top-1 agreement with the
        teacher
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full min-w-[620px]"
        role="img"
        aria-label="A horizontal ladder of nine scores on the Typed Decisions test split, from Uniform at 30.8 percent to AgentJev at 79.25 percent. Two of the nine are dashed reference lines rather than models: perfect scenario understanding at 70.4 percent and teacher self-agreement at 73.5 percent. Jev sits at 72.7 percent, between them. Laya at 77.0 and AgentJev at 79.25 are both above the teacher self-agreement line, which the dataset card describes as the noise floor of its own labelling process."
      >
        {TICKS.map((t) => (
          <g key={t}>
            <line
              x1={x(t)}
              y1={TOP - 10}
              x2={x(t)}
              y2={TOP + ROWS.length * ROW_H - 6}
              className="stroke-border"
              strokeWidth={0.75}
              strokeDasharray="2 5"
            />
            <text
              x={x(t)}
              y={TOP + ROWS.length * ROW_H + 12}
              textAnchor="middle"
              className="fill-muted-foreground font-mono"
              style={{ fontSize: 10 }}
            >
              {t}%
            </text>
          </g>
        ))}

        {ROWS.map((r, i) => {
          const y = TOP + i * ROW_H
          const ceiling = r.kind === "ceiling"
          return (
            <g key={r.label}>
              <text
                x={LEFT - 12}
                y={y + 11}
                textAnchor="end"
                className={
                  ceiling
                    ? "fill-muted-foreground font-mono italic"
                    : "fill-foreground font-mono"
                }
                style={{ fontSize: 10.5 }}
              >
                {r.label}
              </text>
              {ceiling ? (
                <line
                  x1={x(AXIS_MIN)}
                  y1={y + 7}
                  x2={x(r.value)}
                  y2={y + 7}
                  className="stroke-foreground/40"
                  strokeWidth={1}
                  strokeDasharray="5 4"
                />
              ) : (
                <rect
                  x={x(AXIS_MIN)}
                  y={y + 2}
                  width={x(r.value) - x(AXIS_MIN)}
                  height={11}
                  rx={2}
                  className={
                    r.kind === "reference" ? "fill-foreground/15" : "fill-foreground/55"
                  }
                />
              )}
              <text
                x={x(r.value) + 6}
                y={y + 11}
                className="fill-muted-foreground font-mono"
                style={{ fontSize: 10 }}
              >
                {r.value.toFixed(r.value === 79.25 ? 2 : 1)}
              </text>
            </g>
          )
        })}

        {/* the saturation rule */}
        <line
          x1={x(73.5)}
          y1={TOP - 14}
          x2={x(73.5)}
          y2={TOP + ROWS.length * ROW_H - 6}
          className="stroke-foreground/60"
          strokeWidth={1.25}
        />
        <text
          x={x(73.5) + 5}
          y={TOP - 16}
          className="fill-foreground font-mono"
          style={{ fontSize: 10 }}
        >
          teacher self-agreement
        </text>
      </svg>
      <figcaption className="border-t px-3 py-2 font-mono text-xs leading-5 text-muted-foreground">
        Every number here is the dataset card&apos;s except the last two, which AgentJev
        measured in its own repository on the same split. The card&apos;s own instruction for
        reading the right-hand end: &ldquo;Read 0.52 as the floor. Around 0.70 is strong.
        Around 0.75 is saturation.&rdquo;
      </figcaption>
    </figure>
  )
}
