// "50x faster than Jev" is not a measurement, it is a choice of denominator.
//
// Every bar here is a real ratio built from published numbers. They span 1.07x
// to 68x, and the only thing that changes between the bottom and the top is what
// you agree to divide by: the same task on the same machine, or an HTTPS round
// trip to somebody else's datacentre.
//
// Log axis because the spread is two orders of magnitude. Positions go through
// lib/dmath's mlog10 so the SVG coordinate serializes identically on server and
// client; everything downstream is +, -, * and /, which are exact.

import { mlog10 } from "@/lib/dmath"

// Third-party published Jev p50, remote, as collected in /articles/jev-scores-zero:
// 236 ms and 276 ms from two independent benchmark repos, 338.6 ms from a third.
const JEV_LO = 236
const JEV_HI = 338.6

type Entry = {
  name: string
  over: string
  lo: number
  hi?: number
  local?: boolean
}

const ENTRIES: Entry[] = [
  {
    name: "MLX compiled + prefix cache",
    over: "÷ MLX eager · same paired Snake run, 2,400 moves",
    lo: 1.065,
    local: true,
  },
  {
    name: "Core ML ANE FP16",
    over: "÷ compiled MLX FP16 · same M3 Max, same question, alternating blocks",
    lo: 1.394,
    local: true,
  },
  {
    name: "Core ML ANE W8 palette",
    over: "÷ compiled MLX FP16 · same M3 Max, same question",
    lo: 1.423,
    local: true,
  },
  {
    name: "Laya's own comparison sheet",
    over: "Jev p50 ÷ Laya 32.8 ms on a Tesla T4",
    lo: JEV_LO / 32.8,
    hi: JEV_HI / 32.8,
  },
  {
    name: "laya-mlx English 421M",
    over: "Jev p50 ÷ 13.42 ms local warm p50",
    lo: JEV_LO / 13.42,
    hi: JEV_HI / 13.42,
  },
  {
    name: "laya-mlx multilingual 322M",
    over: "Jev p50 ÷ 7.39 ms local warm p50",
    lo: JEV_LO / 7.39,
    hi: JEV_HI / 7.39,
  },
  {
    name: "Core ML ANE multilingual",
    over: "Jev p50 ÷ 4.976 ms local warm p50",
    lo: JEV_LO / 4.976,
    hi: JEV_HI / 4.976,
  },
]

const TICKS = [1, 2, 5, 10, 20, 50, 100]

export function RatioLadder() {
  const W = 840
  const left = 330
  const right = 812
  const span = right - left
  const axisY = 64
  const rowTop = 84
  const rowH = 38
  const H = rowTop + ENTRIES.length * rowH + 16

  // x = left + log10(v) / log10(100) * span, with log10(100) = 2 exactly.
  const x = (v: number) => left + (mlog10(v) * span) / 2

  // The three same-machine ratios are published to three decimals; keep them.
  const fmt = (v: number) => (v < 2 ? v.toFixed(3) : v.toFixed(1))

  return (
    <figure className="my-8 overflow-x-auto rounded-md border">
      <div className="border-b px-3 py-2 font-mono text-xs text-muted-foreground">
        seven real ratios from published numbers · log scale · the denominator is the whole story
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full min-w-[760px]"
        role="img"
        aria-label="A logarithmic chart of seven speed ratios from one times to one hundred times. The three ratios measured on the same machine against the same task cluster between 1.07 and 1.42 times. The four ratios that divide a hosted Jev API latency by a local warm latency span from 7.2 times up to 68 times, and a marked line at fifty times falls inside the widest of them."
      >
        {/* axis */}
        {TICKS.map((t) => (
          <g key={t}>
            <line
              x1={x(t)}
              y1={axisY}
              x2={x(t)}
              y2={H - 14}
              className="stroke-border"
              strokeWidth={1}
              strokeOpacity={0.55}
            />
            <text
              x={x(t)}
              y={axisY - 8}
              textAnchor="middle"
              className="fill-muted-foreground font-mono"
              style={{ fontSize: 10 }}
            >
              {t}×
            </text>
          </g>
        ))}

        {/* the circulating claim */}
        <line
          x1={x(50)}
          y1={axisY - 2}
          x2={x(50)}
          y2={H - 14}
          className="stroke-foreground/60"
          strokeWidth={1.5}
          strokeDasharray="5 4"
        />
        <text
          x={x(50) - 6}
          y={axisY - 22}
          textAnchor="end"
          className="fill-foreground font-mono"
          style={{ fontSize: 11 }}
        >
          the circulating claim
        </text>

        <g className="fill-muted-foreground font-mono" style={{ fontSize: 10 }}>
          <text x={16} y={axisY - 22}>
            measured on one machine, same task
          </text>
          <text x={16} y={axisY - 8}>
            local compute ÷ a hosted round trip
          </text>
        </g>

        {ENTRIES.map((e, i) => {
          const y = rowTop + i * rowH
          const cy = y + 13
          const x0 = x(e.lo)
          const x1 = e.hi === undefined ? x0 : x(e.hi)
          return (
            <g key={e.name}>
              <text
                x={16}
                y={y + 11}
                className="fill-foreground font-mono"
                style={{ fontSize: 11 }}
              >
                {e.name}
              </text>
              <text
                x={16}
                y={y + 24}
                className="fill-muted-foreground font-mono"
                style={{ fontSize: 9 }}
              >
                {e.over}
              </text>

              {e.hi === undefined ? (
                <circle
                  cx={x0}
                  cy={cy}
                  r={5}
                  className="fill-foreground stroke-background"
                  strokeWidth={1.5}
                />
              ) : (
                <rect
                  x={x0}
                  y={cy - 7}
                  width={Math.max(4, x1 - x0)}
                  height={14}
                  rx={3}
                  className="fill-foreground/25 stroke-foreground/60"
                  strokeWidth={1.25}
                />
              )}

              <text
                x={x1 + 10}
                y={cy + 4}
                className={
                  e.local
                    ? "fill-foreground font-mono"
                    : "fill-muted-foreground font-mono"
                }
                style={{ fontSize: 11 }}
              >
                {e.hi === undefined
                  ? `${fmt(e.lo)}×`
                  : `${fmt(e.lo)}–${fmt(e.hi)}×`}
              </text>
            </g>
          )
        })}
      </svg>
      <figcaption className="border-t px-3 py-2 text-xs leading-relaxed text-muted-foreground">
        The three filled dots are the only ratios either repository publishes about
        itself, and all three compare the same workload on the same M3 Max. The four
        bars divide a hosted API p50 — 236 ms and 276 ms from two independent benchmark
        repos, 338.6 ms from a third — by a warm local single-question p50 on hardware
        the API never touched. Both kinds of number are real. Only one of them is a
        comparison.
      </figcaption>
    </figure>
  )
}
