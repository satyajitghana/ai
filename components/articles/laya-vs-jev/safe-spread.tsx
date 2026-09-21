// How hard the exam is, per latency regime.
//
// 122 snapshots — the sample set scripts/benchmark_trex_planner.py builds (seed
// 17, a jump every 39 frames, a snapshot every 31 while obstacles are on
// screen) — put through Planner.plan() four times with four timing tuples, and
// bucketed by how many of the three actions come back labelled Safe. Fewer safe
// actions means more of the three option lines read "Collision", which means
// the option marked "Best" is easier to find.
//
// `best_effort` is the plan's own `robust=False` flag: the planner could not
// prove any action safe across the whole landing range and fell back to
// whichever one survives the most landing times.
//
// Integer arithmetic and division only, so no lib/dmath wrappers are needed;
// +, -, * and / are exact per IEEE-754 and serialize identically on server
// and client.

type Row = {
  name: string
  sub: string
  // share of the 122 snapshots with 0, 1, 2, 3 safe actions
  safe: [number, number, number, number]
  bestEffort: number
}

const ROWS: Row[] = [
  {
    name: "Laya, real time",
    sub: "(1,3) frames, 2 in flight",
    safe: [11.5, 4.9, 12.3, 71.3],
    bestEffort: 16.4,
  },
  {
    name: "Both, --lockstep 6",
    sub: "(0,0) frames, 6 per decision",
    safe: [14.8, 4.9, 13.9, 66.4],
    bestEffort: 14.8,
  },
  {
    name: "Jev, real time",
    sub: "(18,24) frames, 6 in flight",
    safe: [24.6, 35.2, 20.5, 19.7],
    bestEffort: 36.9,
  },
  {
    name: "Jev, one at a time",
    sub: "(18,24) frames, 1 in flight",
    safe: [27.9, 27.0, 25.4, 19.7],
    bestEffort: 60.7,
  },
]

const FILL = [
  "fill-foreground",
  "fill-foreground/70",
  "fill-foreground/40",
  "fill-foreground/15",
]
const LEGEND = ["0 safe", "1 safe", "2 safe", "3 safe"]

export function SafeSpread() {
  const W = 840
  const left = 186
  const right = 684
  const span = right - left
  const top = 56
  const rowH = 46
  const barH = 20
  const H = top + ROWS.length * rowH + 16

  return (
    <figure className="my-8 overflow-x-auto rounded-md border">
      <div className="border-b px-3 py-2 font-mono text-xs text-muted-foreground">
        122 snapshots · seed 17 · the same frames, four timing tuples
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full min-w-[760px]"
        role="img"
        aria-label="Four stacked bars showing how many of the three actions the planner labels safe. For Laya in real time, 71.3 percent of snapshots have all three safe and 11.5 percent have none. In lockstep six, 66.4 percent have all three. For Jev in real time with six requests in flight, only 19.7 percent have all three safe, 35.2 percent have exactly one, and 24.6 percent have none. For Jev asking one question at a time, 19.7 percent have all three, 27 percent have exactly one and 27.9 percent have none. The best-effort rate rises from 16.4 percent for Laya to 60.7 percent for Jev asking one at a time."
      >
        {/* legend */}
        {LEGEND.map((label, i) => (
          <g key={label}>
            <rect
              x={left + i * 118}
              y={top - 34}
              width={11}
              height={11}
              rx={2}
              className={FILL[i]}
            />
            <text
              x={left + i * 118 + 17}
              y={top - 24}
              className="fill-muted-foreground font-mono"
              style={{ fontSize: 10 }}
            >
              {label}
            </text>
          </g>
        ))}
        <text
          x={right + 14}
          y={top - 24}
          className="fill-muted-foreground font-mono"
          style={{ fontSize: 10 }}
        >
          best effort
        </text>

        {ROWS.map((r, i) => {
          const y = top + i * rowH
          let cursor = left
          return (
            <g key={r.name}>
              <text
                x={16}
                y={y + 10}
                className="fill-foreground font-mono"
                style={{ fontSize: 11 }}
              >
                {r.name}
              </text>
              <text
                x={16}
                y={y + 23}
                className="fill-muted-foreground font-mono"
                style={{ fontSize: 9 }}
              >
                {r.sub}
              </text>

              {r.safe.map((pct, k) => {
                const w = (pct * span) / 100
                const x0 = cursor
                cursor = cursor + w
                return (
                  <g key={k}>
                    <rect
                      x={x0}
                      y={y}
                      width={w}
                      height={barH}
                      className={FILL[k]}
                    />
                    {pct >= 13 ? (
                      <text
                        x={x0 + w / 2}
                        y={y + 14}
                        textAnchor="middle"
                        className={
                          k <= 1
                            ? "fill-background font-mono"
                            : "fill-foreground font-mono"
                        }
                        style={{ fontSize: 10 }}
                      >
                        {pct}%
                      </text>
                    ) : null}
                  </g>
                )
              })}
              <rect
                x={left}
                y={y}
                width={span}
                height={barH}
                className="fill-none stroke-border"
                strokeWidth={1}
              />

              <text
                x={right + 14}
                y={y + 14}
                className="fill-foreground font-mono"
                style={{ fontSize: 11 }}
              >
                {r.bestEffort}%
              </text>
            </g>
          )
        })}
      </svg>
      <figcaption className="border-t px-3 py-2 text-xs leading-relaxed text-muted-foreground">
        Same 122 frames, four latency tuples. Laya is usually told every action is
        safe and asked to pick the one line that also says <em>Best</em>; Jev is
        usually told two of the three collide. A slower player gets a more forced
        question, and a more forced question is easier to answer correctly. The
        right-hand column is the planner&rsquo;s own <code>robust=False</code>{" "}
        rate — how often it could prove nothing at all and guessed — which is
        where the slow player&rsquo;s deaths come from.
      </figcaption>
    </figure>
  )
}
