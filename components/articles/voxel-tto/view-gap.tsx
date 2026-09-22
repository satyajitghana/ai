// The whole problem, in one shape: what happens between input views and test
// views.
//
// A feed-forward 3DGS model reconstructs a scene from N posed images. Render
// those same images back and you are mostly measuring whether the Gaussians fit
// the pixels they were regressed from. Render a view the model never saw, at a
// pose you supply, and you are measuring whether the scene sits where the poses
// say it does. Pose drift shows up as the gap between the two, and nowhere
// else.
//
// Every number is Table 1 of arXiv:2609.21498v1 (PSNR, dB). Each row is one
// dumbbell: input-view PSNR to test-view PSNR. Server-rendered, zero JS.

const DROP = "oklch(0.58 0.19 27)"
const GAIN = "oklch(0.55 0.16 155)"
const OURS = "oklch(0.60 0.15 255)"

type Row = { m: string; rIn: number; rTest: number; tIn: number; tTest: number; ours?: boolean }

const ROWS: Row[] = [
  { m: "VolSplat", rIn: 16.15, rTest: 15.44, tIn: 15.45, tTest: 16.33 },
  { m: "MVSplat", rIn: 19.97, rTest: 19.41, tIn: 16.48, tTest: 15.05 },
  { m: "AnySplat", rIn: 23.25, rTest: 17.78, tIn: 17.34, tTest: 12.71 },
  { m: "YoNoSplat", rIn: 24.52, rTest: 11.57, tIn: 13.61, tTest: 13.29 },
  { m: "DepthAnything3", rIn: 23.64, rTest: 22.82, tIn: 19.2, tTest: 17.68 },
  { m: "MapAnything", rIn: 14.35, rTest: 17.95, tIn: 12.66, tTest: 14.66 },
  { m: "VoxelTTO, no TTO", rIn: 29.28, rTest: 25.83, tIn: 23.74, tTest: 14.71, ours: true },
  { m: "VoxelTTO", rIn: 29.91, rTest: 28.54, tIn: 20.89, tTest: 19.23, ours: true },
]

const W = 700
const TOP = 62
const ROW_H = 26
const LAB_W = 116
const LO = 11
const HI = 31
const PANELS = [
  { title: "Replica", x0: 130, x1: 384, key: "r" as const },
  { title: "Tanks and Temples", x0: 424, x1: 678, key: "t" as const },
]

export function ViewGap() {
  const H = TOP + ROWS.length * ROW_H + 44

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/20 to-transparent">
      <div className="flex items-center justify-between border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>input view → test view</span>
        <span className="text-muted-foreground/60">PSNR, dB</span>
      </div>

      <div className="overflow-x-auto p-4 sm:p-5">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full min-w-[620px]"
          role="img"
          aria-label="Eight methods, each drawn as a line from its input-view PSNR to its test-view PSNR, on Replica and on Tanks and Temples. Most methods lose ground on test views; YoNoSplat falls 12.95 dB on Replica and VoxelTTO without test-time optimisation falls 9.03 dB on Tanks and Temples, which test-time optimisation reduces to 1.66 dB while lowering the input-view score."
        >
          {PANELS.map((p) => {
            const unit = (p.x1 - p.x0) / (HI - LO)
            const X = (v: number) => p.x0 + (v - LO) * unit
            return (
              <g key={p.title}>
                <text
                  x={(p.x0 + p.x1) / 2}
                  y={26}
                  textAnchor="middle"
                  className="fill-foreground font-mono"
                  fontSize={10.5}
                >
                  {p.title}
                </text>
                {[12, 16, 20, 24, 28].map((t) => (
                  <g key={t}>
                    <line
                      x1={X(t)}
                      x2={X(t)}
                      y1={TOP - 12}
                      y2={TOP + ROWS.length * ROW_H - 14}
                      stroke="currentColor"
                      className="text-border"
                      strokeWidth={1}
                    />
                    <text
                      x={X(t)}
                      y={TOP - 18}
                      textAnchor="middle"
                      className="fill-muted-foreground font-mono"
                      fontSize={8.5}
                    >
                      {t}
                    </text>
                  </g>
                ))}

                {ROWS.map((r, i) => {
                  const a = p.key === "r" ? r.rIn : r.tIn
                  const b = p.key === "r" ? r.rTest : r.tTest
                  const y = TOP + i * ROW_H
                  const c = r.ours ? OURS : b >= a ? GAIN : DROP
                  const d = b - a
                  return (
                    <g key={r.m + p.key}>
                      <line
                        x1={X(a)}
                        x2={X(b)}
                        y1={y}
                        y2={y}
                        stroke={c}
                        strokeWidth={2.5}
                        strokeOpacity={0.55}
                      />
                      <circle
                        cx={X(a)}
                        cy={y}
                        r={3.2}
                        fill="none"
                        stroke={c}
                        strokeWidth={1.6}
                      />
                      <circle cx={X(b)} cy={y} r={4} fill={c} />
                      <text
                        x={b >= a ? X(b) + 8 : X(b) - 8}
                        y={y + 3.5}
                        textAnchor={b >= a ? "start" : "end"}
                        fill={c}
                        className="font-mono"
                        fontSize={8.5}
                      >
                        {d > 0 ? `+${d.toFixed(2)}` : d.toFixed(2)}
                      </text>
                    </g>
                  )
                })}
              </g>
            )
          })}

          {ROWS.map((r, i) => (
            <text
              key={r.m}
              x={LAB_W}
              y={TOP + i * ROW_H + 3.5}
              textAnchor="end"
              className={
                r.ours
                  ? "fill-foreground font-mono"
                  : "fill-muted-foreground font-mono"
              }
              fontSize={9.5}
            >
              {r.m}
            </text>
          ))}

          <g>
            <circle
              cx={20}
              cy={H - 24}
              r={3.2}
              fill="none"
              stroke="currentColor"
              className="text-muted-foreground"
              strokeWidth={1.6}
            />
            <text
              x={30}
              y={H - 20}
              className="fill-muted-foreground font-mono"
              fontSize={9}
            >
              input views
            </text>
            <circle
              cx={126}
              cy={H - 24}
              r={4}
              className="fill-muted-foreground"
            />
            <text
              x={136}
              y={H - 20}
              className="fill-muted-foreground font-mono"
              fontSize={9}
            >
              test views (the number that matters)
            </text>
          </g>
        </svg>
      </div>
    </figure>
  )
}
