// One checkpoint, six Elo ratings.
//
// TabArena's Elo is a bootstrapped fit to head-to-head win rates within a pool
// of entrants, anchored so that a default random forest sits at 1000. Change
// which datasets are in the pool, or which entrants, and every number moves —
// including for a model whose weights have not been touched. Google's chart
// quotes the pair from release day, 30 June 2026. The other four are the same
// checkpoint on the live board eleven weeks later.
//
// Server-rendered SVG, zero JS. Positions are linear interpolation on the axis:
// only + - * /, so server and client serialise identically.

type Mark = { elo: number; pool: string; live: boolean; lane: number }

const MARKS: Mark[] = [
  { elo: 1727, pool: "release-day figure · 38 classification datasets", live: false, lane: 0 },
  { elo: 1769, pool: "live board · 38 classification · models only", live: true, lane: 1 },
  { elo: 1777, pool: "live board · 38 classification · every entrant", live: true, lane: 2 },
  { elo: 1803, pool: "live board · all 51 tasks · every entrant", live: true, lane: 0 },
  { elo: 1940, pool: "release-day figure · 13 regression datasets", live: false, lane: 1 },
  { elo: 1989, pool: "live board · 13 regression · models only", live: true, lane: 2 },
]

const LO = 1700
const HI = 2020

export function EloDenominators() {
  const W = 820
  const H = 300
  const left = 48
  const right = W - 28
  const span = right - left
  const axisY = 92

  const px = (elo: number) => left + ((elo - LO) * span) / (HI - LO)
  const ticks = [1700, 1750, 1800, 1850, 1900, 1950, 2000]

  return (
    <figure className="my-8 overflow-x-auto rounded-md border">
      <div className="border-b px-3 py-2 font-mono text-xs text-muted-foreground">
        google/tabfm-1.0.0 · the same weights, six TabArena Elo ratings
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full min-w-[680px]"
        role="img"
        aria-label="An Elo axis from 1700 to 2020 carrying six markers, all for the same TabFM checkpoint. 1727 on Google's release-day classification figure over 38 datasets. 1769 on the live board's classification slice among models only. 1777 on the same slice with every entrant included. 1803 across all 51 tasks with every entrant. 1940 on Google's release-day regression figure over 13 datasets. 1989 on the live board's regression slice. The spread is 262 points and nothing about the model changed."
      >
        <g className="fill-muted-foreground font-mono" style={{ fontSize: 11 }}>
          <text x={24} y={22}>Elo (↑) — a rating of this model against whoever else happens to be in the pool</text>
        </g>

        {/* span bracket */}
        <line x1={px(1727)} y1={52} x2={px(1989)} y2={52} className="stroke-foreground/40" strokeWidth={1.5} />
        <line x1={px(1727)} y1={48} x2={px(1727)} y2={56} className="stroke-foreground/40" strokeWidth={1.5} />
        <line x1={px(1989)} y1={48} x2={px(1989)} y2={56} className="stroke-foreground/40" strokeWidth={1.5} />
        <text x={px(1727) + 10} y={44} className="fill-foreground font-mono" style={{ fontSize: 10 }}>
          262 points of spread · one checkpoint · no retraining
        </text>

        {/* axis */}
        <line x1={left} y1={axisY} x2={right} y2={axisY} className="stroke-border" strokeWidth={1.5} />
        {ticks.map((t) => (
          <g key={t}>
            <line x1={px(t)} y1={axisY - 5} x2={px(t)} y2={axisY + 5} className="stroke-border" strokeWidth={1} />
            <text x={px(t) - 13} y={axisY + 20} className="fill-muted-foreground font-mono" style={{ fontSize: 10 }}>
              {t}
            </text>
          </g>
        ))}

        {/* markers */}
        {MARKS.map((m) => {
          const x = px(m.elo)
          const y = 118 + m.lane * 26
          return (
            <g key={m.elo}>
              <line
                x1={x}
                y1={axisY + 2}
                x2={x}
                y2={y - 3}
                className="stroke-border"
                strokeWidth={1}
                strokeDasharray="3 3"
              />
              <circle
                cx={x}
                cy={axisY}
                r={4}
                className={
                  m.live ? "fill-background stroke-foreground" : "fill-muted-foreground stroke-muted-foreground"
                }
                strokeWidth={1.5}
              />
              <rect
                x={x - 23}
                y={y - 3}
                width={46}
                height={19}
                rx={3}
                className={m.live ? "fill-background stroke-foreground/40" : "fill-muted/60 stroke-border"}
                strokeWidth={1.2}
              />
              <text x={x - 16} y={y + 11} className="fill-foreground font-mono" style={{ fontSize: 11 }}>
                {m.elo}
              </text>
            </g>
          )
        })}

        <line x1={24} y1={210} x2={W - 24} y2={210} className="stroke-border" strokeWidth={1} />

        {/* legend */}
        {MARKS.map((m, i) => {
          const cx = 28 + (i % 2) * 396
          const cy = 230 + Math.floor(i / 2) * 20
          return (
            <g key={`l${m.elo}`}>
              <circle
                cx={cx + 5}
                cy={cy - 4}
                r={4}
                className={
                  m.live ? "fill-background stroke-foreground" : "fill-muted-foreground stroke-muted-foreground"
                }
                strokeWidth={1.5}
              />
              <text x={cx + 16} y={cy} className="fill-foreground font-mono" style={{ fontSize: 10 }}>
                {m.elo}
              </text>
              <text x={cx + 50} y={cy} className="fill-muted-foreground font-mono" style={{ fontSize: 10 }}>
                {m.pool}
              </text>
            </g>
          )
        })}

        <text x={28} y={294} className="fill-muted-foreground font-mono" style={{ fontSize: 9.5 }}>
          Hollow = TabArena live board, read 2026-09-19. Filled = read off the results figure in the Google Research post, 2026-06-30.
        </text>
      </svg>
    </figure>
  )
}
