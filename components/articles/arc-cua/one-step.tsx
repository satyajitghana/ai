// One agent step, drawn as the round trips it costs with each driver. Widths are to
// scale at 100 px per second, with a 3 s model turn (an assumption, labelled in the
// article) and the drivers' own reported medians: 0.22 s for arc's click with settle,
// 1.11 s for cua-driver's click and 0.14 s for its follow-up observation.
// Server-rendered SVG, integer coordinates only, no client JS.

const PX = 100 // px per second
const X0 = 120
const MODEL = 3 * PX

type Seg = { w: number; label: string; sub: string; kind: "model" | "driver" | "obs" }

const LANES: { name: string; y: number; segs: Seg[]; tail: string }[] = [
  {
    name: "arc-driver",
    y: 46,
    segs: [
      { w: MODEL, label: "model turn", sub: "decide on snapshot s4", kind: "model" },
      { w: 22, label: "", sub: "", kind: "driver" },
    ],
    tail: "act(s4, CLICK, ax_14, settle) → done + fresh s5",
  },
  {
    name: "cua-driver",
    y: 136,
    segs: [
      { w: MODEL, label: "model turn", sub: "decide, call click", kind: "model" },
      { w: 111, label: "click", sub: "polls ≤1 s", kind: "driver" },
      { w: MODEL, label: "model turn", sub: "call get_window_state", kind: "model" },
      { w: 14, label: "", sub: "", kind: "obs" },
    ],
    tail: "tree + PNG",
  },
]

export function OneStep() {
  return (
    <figure className="my-8 overflow-x-auto rounded-md border">
      <div className="border-b px-3 py-2 font-mono text-xs text-muted-foreground">
        one step, to scale · 1 s = 100 px · model turn assumed 3 s
      </div>
      <svg
        viewBox="0 0 1000 200"
        className="w-full min-w-[680px]"
        role="img"
        aria-label="Two timelines. arc-driver: one 3 second model turn, then 0.22 seconds in the driver for a click with settle, whose result already carries the fresh snapshot. cua-driver: a 3 second model turn to call click, 1.11 seconds in the driver while the click polls up to one second for new windows, a second 3 second model turn to call get_window_state, and 0.14 seconds to return the tree and a screenshot."
      >
        {LANES.map((lane) => {
          let x = X0
          return (
            <g key={lane.name}>
              <text x={12} y={lane.y + 22} className="fill-foreground font-mono" style={{ fontSize: 12 }}>
                {lane.name}
              </text>
              {lane.segs.map((s, i) => {
                const sx = x
                x += s.w
                const cls =
                  s.kind === "model"
                    ? "fill-muted/50 stroke-border"
                    : s.kind === "driver"
                      ? "fill-foreground/70 stroke-foreground/70"
                      : "fill-foreground/40 stroke-foreground/40"
                return (
                  <g key={i}>
                    <rect x={sx} y={lane.y} width={Math.max(s.w - 2, 2)} height={34} rx={4} className={cls} strokeWidth={1} />
                    {s.label && s.w > 60 ? (
                      <>
                        <text x={sx + 10} y={lane.y + 15} className={s.kind === "model" ? "fill-foreground font-mono" : "fill-background font-mono"} style={{ fontSize: 11 }}>
                          {s.label}
                        </text>
                        <text x={sx + 10} y={lane.y + 28} className={s.kind === "model" ? "fill-muted-foreground font-mono" : "fill-background/80 font-mono"} style={{ fontSize: 10 }}>
                          {s.sub}
                        </text>
                      </>
                    ) : null}
                  </g>
                )
              })}
              <text x={x + 8} y={lane.y + 22} className="fill-muted-foreground font-mono" style={{ fontSize: 11 }}>
                {lane.tail}
              </text>
            </g>
          )
        })}
        <g className="fill-muted-foreground font-mono" style={{ fontSize: 10 }}>
          <text x={X0} y={192}>0 s</text>
          <text x={X0 + 300} y={192}>3 s</text>
          <text x={X0 + 600} y={192}>6 s</text>
        </g>
        <line x1={X0} y1={180} x2={X0 + 750} y2={180} className="stroke-border" strokeWidth={1} />
      </svg>
      <figcaption className="border-t px-3 py-2 text-sm text-muted-foreground">
        The driver&rsquo;s own time (dark) is the 5x in the benchmark table. The model turns
        (light) are what a real agent mostly waits on, and cua-driver&rsquo;s step has two of
        them because its click result carries no window state.
      </figcaption>
    </figure>
  )
}
