// Every named confidence threshold in three of these codebases, on one axis.
//
// Nineteen numbers, read out of actions.py, search.go/qualify.go and config.py.
// They were chosen independently, by three sets of authors, for three unrelated
// jobs — and they land on the same four values: 0.30, 0.50, 0.70, 0.90.
//
// djev is absent on purpose. Its gate is an entropy in nats over the first
// read, not a probability, and it decides whether to look again rather than
// whether to act. Putting it on this axis would be a category error, which is
// itself the finding.
//
// Server-rendered SVG, zero JS. Only + - * / here.

const ACCENT = "oklch(0.60 0.15 255)"

type Mark = { v: number; name: string; up?: boolean } // up: label above the lane

type Lane = {
  project: string
  file: string
  note: string
  marks: Mark[]
}

const LANES: Lane[] = [
  {
    project: "SystemOneHarness",
    file: "systemone_harness/actions.py · DEFAULT_GATE",
    note: "one threshold per risk class, compared against the weakest judgment the action depends on",
    marks: [
      { v: 0.5, name: "read / finish" },
      { v: 0.7, name: "write", up: true },
      { v: 0.9, name: "destructive" },
    ],
  },
  {
    project: "webctl",
    file: "internal/jev/qualify.go · DefaultCut",
    note: "one cut, derived from the rubric's size: 1.2 levels below the top, so a 4-level rubric gives 6.0 of 10. The last mark is a Jaccard estimate, not a confidence",
    marks: [
      { v: 0.33, name: "backfill floor" },
      { v: 0.5, name: "--noul default", up: true },
      { v: 0.6, name: "keep" },
      { v: 0.7, name: "dedupe, no model", up: true },
    ],
  },
  {
    project: "fastbrowse",
    file: "src/fastbrowse/config.py · Thresholds",
    note: "eleven, each with the run that calibrated it in the docstring beside it",
    marks: [
      { v: 0.3, name: "requirement / rewrite" },
      { v: 0.5, name: "irreversible / value stated", up: true },
      { v: 0.55, name: "recover" },
      { v: 0.7, name: "login / bot / claim", up: true },
      { v: 0.85, name: "done accept" },
      { v: 0.9, name: "sensitive act", up: true },
    ],
  },
]

export function ThresholdLine() {
  const W = 820
  const left = 176
  const right = W - 40
  const span = right - left
  const laneH = 96
  const top = 58
  const H = top + LANES.length * laneH + 54
  const x = (v: number) => left + span * v

  return (
    <figure className="my-8 overflow-x-auto rounded-md border">
      <div className="border-b px-3 py-2 font-mono text-[10px] tracking-wide text-muted-foreground uppercase">
        19 named thresholds · 3 codebases · one axis
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full min-w-[760px]"
        role="img"
        aria-label="Three horizontal lanes, one per project, sharing a probability axis from zero to one. System One Harness places three thresholds: read and finish at 0.50, write at 0.70, destructive at 0.90. webctl places four: a backfill floor at 0.33, a yes-or-no default at 0.50, its keep cut at 0.60 and a model-free duplicate confirmation at 0.70. fastbrowse places eleven, clustered at 0.30, 0.50, 0.55, 0.70, 0.85 and 0.90. Vertical guides at 0.30, 0.50, 0.70 and 0.90 show that almost every threshold in all three codebases lands on one of those four values, although the three projects chose them independently for unrelated jobs."
      >
        {/* guides at the four values everybody converged on */}
        {[0.3, 0.5, 0.7, 0.9].map((g) => (
          <g key={g}>
            <line
              x1={x(g)}
              y1={top - 22}
              x2={x(g)}
              y2={H - 46}
              stroke={ACCENT}
              strokeWidth={1}
              strokeDasharray="2 4"
              opacity={0.45}
            />
            <text
              x={x(g)}
              y={top - 28}
              textAnchor="middle"
              fill={ACCENT}
              className="font-mono"
              style={{ fontSize: 9.5 }}
            >
              {g.toFixed(2)}
            </text>
          </g>
        ))}

        {LANES.map((lane, li) => {
          const y = top + li * laneH + 34
          return (
            <g key={lane.project}>
              <text x={14} y={y - 8} className="fill-foreground font-mono" style={{ fontSize: 11 }}>
                {lane.project}
              </text>
              <text
                x={14}
                y={y + 6}
                className="fill-muted-foreground font-mono"
                style={{ fontSize: 8.5 }}
              >
                {lane.file.length > 30 ? lane.file.slice(0, 30) : lane.file}
              </text>
              {lane.file.length > 30 ? (
                <text
                  x={14}
                  y={y + 17}
                  className="fill-muted-foreground font-mono"
                  style={{ fontSize: 8.5 }}
                >
                  {lane.file.slice(30)}
                </text>
              ) : null}

              <line
                x1={left}
                y1={y}
                x2={right}
                y2={y}
                className="stroke-border"
                strokeWidth={1.5}
              />
              {lane.marks.map((m) => (
                <g key={m.name}>
                  <line
                    x1={x(m.v)}
                    y1={y - 9}
                    x2={x(m.v)}
                    y2={y + 9}
                    fill="none"
                    stroke={ACCENT}
                    strokeWidth={2.5}
                  />
                  <text
                    x={x(m.v)}
                    y={m.up ? y - 15 : y + 21}
                    textAnchor="middle"
                    className="fill-foreground font-mono"
                    style={{ fontSize: 9.5 }}
                  >
                    {m.name}
                  </text>
                  <text
                    x={x(m.v)}
                    y={m.up ? y - 26 : y + 32}
                    textAnchor="middle"
                    className="fill-muted-foreground font-mono"
                    style={{ fontSize: 8.5 }}
                  >
                    {m.v.toFixed(2)}
                  </text>
                </g>
              ))}

              <text
                x={left}
                y={y + 46}
                className="fill-muted-foreground font-mono"
                style={{ fontSize: 9 }}
              >
                {lane.note}
              </text>
            </g>
          )
        })}

        <text x={14} y={H - 26} className="fill-muted-foreground font-mono" style={{ fontSize: 9.5 }}>
          djev is not on this axis. Its gate is an entropy in nats over the first read, and clearing it
        </text>
        <text x={14} y={H - 12} className="fill-muted-foreground font-mono" style={{ fontSize: 9.5 }}>
          buys three more noise draws rather than permission to act.
        </text>
      </svg>
    </figure>
  )
}
