// The "6 of 7" claim, drawn so the seventh is visible.
//
// A diverging bar around a zero line: seven video-object-segmentation
// benchmarks, each in its own metric, SAM 3 → SAM 3.1. Six go right. One goes
// left, and a release that prints the one going left has earned something.
// Server-rendered, zero JS — the numbers are fixed and the point is the shape.

const UP = "oklch(0.58 0.16 250)"
const DOWN = "oklch(0.58 0.17 30)"

type Row = { label: string; metric: string; from: number; to: number }

const ROWS: Row[] = [
  { label: "MOSEv2 val", metric: "J&Ḟ", from: 60.3, to: 62.3 },
  { label: "MOSEv1 val", metric: "J&F", from: 78.4, to: 79.6 },
  { label: "LVOSv2 val", metric: "J&F", from: 88.5, to: 89.2 },
  { label: "SA-V test", metric: "J&F", from: 84.4, to: 85.1 },
  { label: "DAVIS17 val", metric: "J&F", from: 92.2, to: 92.7 },
  { label: "SA-V val", metric: "J&F", from: 83.5, to: 83.8 },
  { label: "YTVOS19 val", metric: "G", from: 89.7, to: 89.3 },
]

const W = 700
const ROW_H = 30
const PT = 26
const LABEL_W = 132
const PLOT_L = 162
const PLOT_R = 576 // leaves room for the "60.3 → 62.3" column on the right
const DOM_LO = -0.6 // the one regression is −0.4; give it a margin
const DOM_HI = 2.2
const UNIT = (PLOT_R - PLOT_L) / (DOM_HI - DOM_LO)
const ZERO = PLOT_L - DOM_LO * UNIT
const TICKS = [-0.5, 0, 0.5, 1, 1.5, 2]

export function VosDeltas() {
  const H = PT + ROWS.length * ROW_H + 26

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/20 to-transparent">
      <div className="flex items-center justify-between border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>video object segmentation · SAM 3 → SAM 3.1</span>
        <span className="text-muted-foreground/60">
          each in its own metric
        </span>
      </div>

      <div className="p-4 sm:p-5">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full"
          role="img"
          aria-label="Seven video object segmentation benchmarks. MOSEv2 gains 2.0, MOSEv1 gains 1.2, LVOSv2 gains 0.7, SA-V test gains 0.7, DAVIS17 gains 0.5, SA-V val gains 0.3, and YouTube-VOS 2019 loses 0.4."
        >
          {TICKS.map((t) => (
            <g key={t}>
              <line
                x1={ZERO + t * UNIT}
                x2={ZERO + t * UNIT}
                y1={PT - 8}
                y2={PT + ROWS.length * ROW_H - 4}
                stroke="currentColor"
                className={t === 0 ? "text-foreground/40" : "text-border"}
                strokeWidth={1}
              />
              <text
                x={ZERO + t * UNIT}
                y={PT - 14}
                textAnchor="middle"
                className="fill-muted-foreground font-mono"
                fontSize={9}
              >
                {t > 0 ? `+${t}` : `${t}`}
              </text>
            </g>
          ))}

          {ROWS.map((r, i) => {
            const d = Number((r.to - r.from).toFixed(1))
            const y = PT + i * ROW_H
            const cy = y + ROW_H / 2 - 4
            const up = d >= 0
            const w = Math.abs(d) * UNIT
            return (
              <g key={r.label}>
                <text
                  x={LABEL_W}
                  y={cy + 4}
                  textAnchor="end"
                  className="fill-foreground font-mono"
                  fontSize={11}
                >
                  {r.label}
                </text>
                <text
                  x={LABEL_W + 8}
                  y={cy + 4}
                  className="fill-muted-foreground font-mono"
                  fontSize={9}
                >
                  {r.metric}
                </text>
                <rect
                  x={up ? ZERO : ZERO - w}
                  y={cy - 7}
                  width={Math.max(w, 1.5)}
                  height={14}
                  rx={3}
                  fill={up ? UP : DOWN}
                  opacity={0.85}
                />
                <text
                  x={up ? ZERO + w + 7 : ZERO - w - 7}
                  y={cy + 4}
                  textAnchor={up ? "start" : "end"}
                  className="font-mono"
                  fill={up ? UP : DOWN}
                  fontSize={10}
                >
                  {up ? `+${d.toFixed(1)}` : d.toFixed(1)}
                </text>
                <text
                  x={W - 4}
                  y={cy + 4}
                  textAnchor="end"
                  className="fill-muted-foreground font-mono"
                  fontSize={10}
                >
                  {r.from.toFixed(1)} → {r.to.toFixed(1)}
                </text>
              </g>
            )
          })}

          <text
            x={ZERO}
            y={H - 6}
            textAnchor="middle"
            className="fill-muted-foreground font-mono"
            fontSize={9}
          >
            change in score
          </text>
        </svg>
      </div>
    </figure>
  )
}
