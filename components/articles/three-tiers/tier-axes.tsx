// The argument of the piece, drawn. Six properties that people say distinguish
// deterministic code, a decision model and a reasoning model. Each is a row; the
// three tiers are three fixed columns; the line through them is that property's
// profile across the stack.
//
// If the tiers formed a spectrum, every line would rise left to right. Three do.
// Three do not: two dip to their MINIMUM in the middle column, and one peaks at
// its MAXIMUM there. A quantity that is lowest in the middle is not "in between".
//
// Server-rendered SVG, zero JS. Every coordinate is integer arithmetic (+ - * /),
// so nothing here can disagree between Node and the browser.
const ACCENT = "oklch(0.60 0.15 255)"

type Shape = "rising" | "dip" | "peak"

const ROWS: {
  axis: string
  shape: Shape
  pts: [number, number, number] // 0 = bottom of the row band, 100 = top
  read: [string, string, string]
}[] = [
  {
    axis: "output cardinality",
    shape: "rising",
    pts: [4, 50, 100],
    read: ["exactly 1", "k, fixed (≤255)", "unbounded"],
  },
  {
    axis: "cost per call",
    shape: "rising",
    pts: [0, 34, 100],
    read: ["0", "$0.000083", "$0.028"],
  },
  {
    axis: "latency per call",
    shape: "rising",
    pts: [0, 40, 100],
    read: ["µs", "0.71 s", "3.23 s"],
  },
  {
    axis: "relational reach",
    shape: "dip",
    pts: [100, 0, 100],
    read: ["sees everything", "0 / 100", "sees everything"],
  },
  {
    axis: "explanation offered",
    shape: "dip",
    pts: [100, 6, 78],
    read: ["the code itself", "one scalar", "prose (unverified)"],
  },
  {
    axis: "probability attached",
    shape: "peak",
    pts: [0, 100, 30],
    read: ["none — it is certain", "native, trained", "self-reported"],
  },
]

const COLS = ["deterministic code", "decision model", "reasoning model"]

export function TierAxes() {
  const W = 800
  const labelW = 150
  const colX = [labelW + 80, labelW + 270, labelW + 460] // 230, 420, 610
  const top = 62
  const rowH = 74
  const band = 40 // drawable height inside a row
  const H = top + ROWS.length * rowH + 52

  // y for a point: 0 -> bottom of band, 100 -> top of band
  const yAt = (rowTop: number, v: number) => rowTop + band - (band * v) / 100

  return (
    <figure className="my-8 overflow-x-auto rounded-md border">
      <div className="border-b px-3 py-2 font-mono text-xs text-muted-foreground">
        six properties, three tiers — three lines rise, three do not
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full min-w-[700px]"
        role="img"
        aria-label="Six properties plotted across three tiers: deterministic code, decision model, reasoning model. Output cardinality, cost per call and latency per call all rise from left to right. Relational reach falls to zero at the decision model and returns to full at the reasoning model. Explanation offered falls to a single scalar at the decision model. Probability attached peaks at the decision model, which is the only tier with a native trained probability. Three of six properties are not monotonic across the three tiers."
      >
        <defs>
          <filter id="ta-soft" x="-40%" y="-40%" width="180%" height="180%">
            <feDropShadow dx="0" dy="1" stdDeviation="1.4" floodOpacity="0.14" />
          </filter>
        </defs>

        {/* column headers */}
        {COLS.map((c, i) => (
          <g key={c}>
            <rect
              x={colX[i]! - 88}
              y={16}
              width={176}
              height={26}
              rx={6}
              className="fill-background stroke-border"
              strokeWidth={1.5}
              filter="url(#ta-soft)"
            />
            <text
              x={colX[i]}
              y={33}
              textAnchor="middle"
              className="fill-foreground font-mono"
              style={{ fontSize: 11 }}
            >
              {c}
            </text>
            {/* column guide */}
            <line
              x1={colX[i]}
              y1={46}
              x2={colX[i]}
              y2={H - 40}
              className="stroke-border"
              strokeWidth={1}
              strokeDasharray="2 5"
            />
          </g>
        ))}

        {ROWS.map((r, ri) => {
          const rowTop = top + ri * rowH + 12
          const flat = r.shape === "rising"
          const stroke = flat ? "var(--muted-foreground)" : ACCENT
          const pts = r.pts.map((v, i) => [colX[i]!, yAt(rowTop, v)] as const)
          // smooth cubic through the three points, drawn as two S-curves
          const seg = (a: readonly [number, number], b: readonly [number, number]) => {
            const mx = (a[0] + b[0]) / 2
            return `C ${mx} ${a[1]}, ${mx} ${b[1]}, ${b[0]} ${b[1]}`
          }
          const d = `M ${pts[0]![0]} ${pts[0]![1]} ${seg(pts[0]!, pts[1]!)} ${seg(pts[1]!, pts[2]!)}`
          return (
            <g key={r.axis}>
              {/* row separator */}
              <line
                x1={16}
                y1={rowTop - 14}
                x2={W - 16}
                y2={rowTop - 14}
                className="stroke-border"
                strokeWidth={1}
                opacity={ri === 0 ? 0 : 0.6}
              />
              {/* axis label */}
              <text
                x={16}
                y={rowTop + 18}
                className={flat ? "fill-muted-foreground font-mono" : "fill-foreground font-mono"}
                style={{ fontSize: 11 }}
              >
                {r.axis}
              </text>
              <text
                x={16}
                y={rowTop + 33}
                className="fill-muted-foreground font-mono"
                style={{ fontSize: 9 }}
              >
                {flat ? "monotonic" : r.shape === "dip" ? "LOWEST in the middle" : "HIGHEST in the middle"}
              </text>

              <path d={d} fill="none" stroke={stroke} strokeWidth={flat ? 1.5 : 2.5} opacity={flat ? 0.55 : 1} />

              {pts.map(([px, py], i) => (
                <g key={i}>
                  <circle
                    cx={px}
                    cy={py}
                    r={flat ? 3.5 : 4.5}
                    fill="var(--background)"
                    stroke={stroke}
                    strokeWidth={flat ? 1.5 : 2}
                  />
                  <text
                    x={px}
                    y={py - 11}
                    textAnchor="middle"
                    className={flat ? "fill-muted-foreground font-mono" : "fill-foreground font-mono"}
                    style={{ fontSize: 9.5 }}
                  >
                    {r.read[i]}
                  </text>
                </g>
              ))}
            </g>
          )
        })}

        <text x={16} y={H - 26} className="fill-muted-foreground font-mono" style={{ fontSize: 9.5 }}>
          Cost and latency are measured per-call figures from the xArm7 run (Jev 1.13 vs GPT-6 Astra, low
        </text>
        <text x={16} y={H - 13} className="fill-muted-foreground font-mono" style={{ fontSize: 9.5 }}>
          reasoning effort). The other four rows are categorical; the heights order them, they do not scale.
        </text>
      </svg>
    </figure>
  )
}
