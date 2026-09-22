// Two quantities on one frame ruler: how wide the window is in which a takeoff
// clears the next obstacle, and how often each player gets a turn.
//
// The window numbers are mine, measured with the repository's own engine and
// planner primitives (Search/World over laya_mlx/trex/planner.py) on 616
// jump-or-duck obstacles across five course seeds. For each obstacle I sweep the
// takeoff delay and keep the longest contiguous run of delays that survives the
// 160-frame horizon. High birds are excluded: the dino runs under them, so their
// "window" is 31-50 frames and would flatter the distribution.
//
// The cadence numbers come from the harness: 2 frames is Laya at ~33 ms, 22 is a
// 370 ms Jev round trip at one request in flight, 6 is Pilot.stagger with the
// default --jev-inflight 6 (which caps at four questions per round trip).
//
// No transcendental math here: every coordinate is +, -, * or / on integers,
// which IEEE-754 makes exact, so lib/dmath's wrappers are not needed. Anything
// involving exp/log/pow/trig would have to go through them.

type Marker = { frames: number; label: string; sub: string; strong?: boolean }

// Takeoff window, 616 obstacles, seeds 3/7/11/17/23, staged courses.
const WIN = { min: 13, p10: 15, median: 18, p90: 23, max: 26 }
const NARROW_SHARE = 88.5 // % of those obstacles whose window is <= 22 frames

const MARKERS: Marker[] = [
  { frames: 2, label: "Laya", sub: "~33 ms local answer", strong: false },
  { frames: 6, label: "Jev, 6 in flight", sub: "Pilot.stagger", strong: true },
  { frames: 22, label: "Jev, 1 in flight", sub: "one turn per round trip", strong: true },
]

const MS = (f: number) => Math.round((f * 1000) / 60)

export function CadenceWindow() {
  const W = 840
  const left = 176
  const right = 792
  const span = right - left
  const MAXF = 30
  const x = (f: number) => left + (f * span) / MAXF

  const axisY = 40
  const winY = 92
  const markTop = 150
  const markH = 40
  const H = markTop + MARKERS.length * markH + 30

  const ticks = [0, 5, 10, 15, 20, 25, 30]

  return (
    <figure className="my-8 overflow-x-auto rounded-md border">
      <div className="border-b px-3 py-2 font-mono text-xs text-muted-foreground">
        60 fps · one frame = 16.67 ms · window measured on 616 obstacles, cadence
        read off the harness
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full min-w-[760px]"
        role="img"
        aria-label="A frame ruler from zero to thirty frames. The window in which a takeoff clears the next obstacle runs from thirteen to twenty-six frames, with a median of eighteen and a middle band from fifteen to twenty-three. Below it, three turn cadences: Laya gets a turn every two frames, Jev with six requests in flight every six frames, and Jev with one request in flight every twenty-two frames. The twenty-two frame marker sits past the median window and past the upper edge of the middle band."
      >
        {ticks.map((t) => (
          <g key={t}>
            <line
              x1={x(t)}
              y1={axisY}
              x2={x(t)}
              y2={H - 24}
              className="stroke-border"
              strokeWidth={1}
              strokeOpacity={0.5}
            />
            <text
              x={x(t)}
              y={axisY - 16}
              textAnchor="middle"
              className="fill-foreground font-mono"
              style={{ fontSize: 11 }}
            >
              {t}
            </text>
            <text
              x={x(t)}
              y={axisY - 4}
              textAnchor="middle"
              className="fill-muted-foreground font-mono"
              style={{ fontSize: 9 }}
            >
              {MS(t)} ms
            </text>
          </g>
        ))}

        <text
          x={16}
          y={axisY - 10}
          className="fill-muted-foreground font-mono"
          style={{ fontSize: 10 }}
        >
          frames
        </text>

        {/* the takeoff window */}
        <text
          x={16}
          y={winY - 4}
          className="fill-foreground font-mono"
          style={{ fontSize: 11 }}
        >
          takeoff window
        </text>
        <text
          x={16}
          y={winY + 9}
          className="fill-muted-foreground font-mono"
          style={{ fontSize: 9 }}
        >
          616 obstacles, 5 seeds
        </text>

        <line
          x1={x(WIN.min)}
          y1={winY + 2}
          x2={x(WIN.max)}
          y2={winY + 2}
          className="stroke-foreground/50"
          strokeWidth={1.25}
        />
        {[WIN.min, WIN.max].map((f) => (
          <line
            key={f}
            x1={x(f)}
            y1={winY - 8}
            x2={x(f)}
            y2={winY + 12}
            className="stroke-foreground/50"
            strokeWidth={1.25}
          />
        ))}
        <rect
          x={x(WIN.p10)}
          y={winY - 11}
          width={x(WIN.p90) - x(WIN.p10)}
          height={26}
          rx={3}
          className="fill-foreground/15 stroke-foreground/55"
          strokeWidth={1.25}
        />
        <line
          x1={x(WIN.median)}
          y1={winY - 11}
          x2={x(WIN.median)}
          y2={winY + 15}
          className="stroke-foreground"
          strokeWidth={2}
        />
        <text
          x={x(WIN.median)}
          y={winY - 18}
          textAnchor="middle"
          className="fill-foreground font-mono"
          style={{ fontSize: 10 }}
        >
          median {WIN.median}
        </text>
        <text
          x={x(WIN.max) + 10}
          y={winY + 6}
          className="fill-muted-foreground font-mono"
          style={{ fontSize: 10 }}
        >
          {WIN.min}–{WIN.max}
        </text>

        {/* turn cadence */}
        <text
          x={16}
          y={markTop + 6}
          className="fill-foreground font-mono"
          style={{ fontSize: 11 }}
        >
          frames per turn
        </text>

        {MARKERS.map((m, i) => {
          const y = markTop + 24 + i * markH
          return (
            <g key={m.label}>
              <line
                x1={left}
                y1={y}
                x2={x(m.frames)}
                y2={y}
                className={m.strong ? "stroke-foreground" : "stroke-foreground/45"}
                strokeWidth={m.strong ? 2 : 1.5}
              />
              <circle
                cx={x(m.frames)}
                cy={y}
                r={5}
                className="fill-foreground stroke-background"
                strokeWidth={1.5}
              />
              <text
                x={16}
                y={y - 2}
                className="fill-foreground font-mono"
                style={{ fontSize: 11 }}
              >
                {m.label}
              </text>
              <text
                x={16}
                y={y + 10}
                className="fill-muted-foreground font-mono"
                style={{ fontSize: 9 }}
              >
                {m.sub}
              </text>
              <text
                x={x(m.frames) + 11}
                y={y + 4}
                className="fill-foreground font-mono"
                style={{ fontSize: 11 }}
              >
                {m.frames} ({MS(m.frames)} ms)
              </text>
            </g>
          )
        })}
      </svg>
      <figcaption className="border-t px-3 py-2 text-xs leading-relaxed text-muted-foreground">
        The bar is the window in which pressing jump clears the obstacle ahead,
        measured with the repository&rsquo;s own planner over 616 jump-or-duck
        obstacles on five seeds: 13 to 26 frames, median 18. One Jev round trip at
        370 ms is 22 frames, which is wider than the window on{" "}
        <strong className="font-medium text-foreground">
          {NARROW_SHARE}%
        </strong>{" "}
        of them — one chance per obstacle, and often not even that. Six requests in
        flight move the turn to every 6 frames, narrower than every window in the
        sample. That is the fix: not a faster model, a denser schedule.
      </figcaption>
    </figure>
  )
}
