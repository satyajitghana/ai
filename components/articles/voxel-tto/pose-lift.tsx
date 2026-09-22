// What the LoRA steps are actually buying: camera poses.
//
// TTO has one loss and it is not photometric. It compares the backbone's
// decoded camera parameters against the poses you supplied, and backpropagates
// into the LoRA modules only. So the thing to measure is pose error, and Table 3
// of arXiv:2609.21498v1 is where the mechanism either works or does not.
//
// Log scale, because the span is 7.32 degrees to 0.22 and a linear axis would
// show four bars and five slivers. mlog10 comes from lib/dmath so the SVG
// coordinates serialize identically on the server and in the browser.
// Server-rendered, zero JS.

import { mlog10 } from "@/lib/dmath"

const OURS = "oklch(0.60 0.15 255)"
const PRIOR = "oklch(0.62 0.03 250)"
const BEST_PRIOR = "oklch(0.68 0.13 85)"

type Row = { m: string; replica: number; tat: number; kind: "prior" | "best" | "ours" }

// mean rotation error, degrees
const ROWS: Row[] = [
  { m: "AnySplat", replica: 7.32, tat: 3.516, kind: "prior" },
  { m: "YoNoSplat", replica: 4.769, tat: 5.318, kind: "prior" },
  { m: "MapAnything", replica: 4.438, tat: 3.232, kind: "prior" },
  { m: "DepthAnything3", replica: 0.324, tat: 0.682, kind: "best" },
  { m: "VoxelTTO, no TTO", replica: 0.301, tat: 1.636, kind: "ours" },
  { m: "VoxelTTO", replica: 0.22, tat: 0.262, kind: "ours" },
]

const W = 700
const TOP = 58
const ROW_H = 30
const LAB_W = 122
const PLOT_L = 132
const PLOT_R = 604
const LO = mlog10(0.2)
const HI = mlog10(8)
const UNIT = (PLOT_R - PLOT_L) / (HI - LO)
const X = (v: number) => PLOT_L + (mlog10(v) - LO) * UNIT
const TICKS = [0.2, 0.5, 1, 2, 5]

export function PoseLift() {
  const H = TOP + ROWS.length * ROW_H + 52

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/20 to-transparent">
      <div className="flex items-center justify-between border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>mean camera rotation error</span>
        <span className="text-muted-foreground/60">degrees · log scale</span>
      </div>

      <div className="overflow-x-auto p-4 sm:p-5">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full min-w-[560px]"
          role="img"
          aria-label="Mean camera rotation error in degrees on a log axis, for six methods on Replica and on Tanks and Temples. AnySplat, YoNoSplat and MapAnything sit between 3.2 and 7.3 degrees. DepthAnything3 is at 0.324 and 0.682. VoxelTTO without test-time optimisation is at 0.301 and 1.636; with it, 0.220 and 0.262 — a 6.2-fold reduction on Tanks and Temples."
        >
          {TICKS.map((t) => (
            <g key={t}>
              <line
                x1={X(t)}
                x2={X(t)}
                y1={TOP - 16}
                y2={TOP + ROWS.length * ROW_H - 10}
                stroke="currentColor"
                className="text-border"
                strokeWidth={1}
              />
              <text
                x={X(t)}
                y={TOP - 22}
                textAnchor="middle"
                className="fill-muted-foreground font-mono"
                fontSize={8.5}
              >
                {t}°
              </text>
            </g>
          ))}

          <text x={20} y={28} className="fill-foreground font-mono" fontSize={10.5}>
            the only thing TTO&apos;s loss is looking at
          </text>

          {ROWS.map((r, i) => {
            const y = TOP + i * ROW_H
            const c =
              r.kind === "ours" ? OURS : r.kind === "best" ? BEST_PRIOR : PRIOR
            return (
              <g key={r.m}>
                <text
                  x={LAB_W}
                  y={y + 12}
                  textAnchor="end"
                  className={
                    r.kind === "ours"
                      ? "fill-foreground font-mono"
                      : "fill-muted-foreground font-mono"
                  }
                  fontSize={9.5}
                >
                  {r.m}
                </text>

                <rect
                  x={PLOT_L}
                  y={y}
                  width={X(r.replica) - PLOT_L}
                  height={8}
                  rx={1.5}
                  fill={c}
                  fillOpacity={0.85}
                />
                <text
                  x={X(r.replica) + 6}
                  y={y + 7}
                  className="fill-muted-foreground font-mono"
                  fontSize={8.5}
                >
                  {r.replica.toFixed(3)} Replica
                </text>

                <rect
                  x={PLOT_L}
                  y={y + 11}
                  width={X(r.tat) - PLOT_L}
                  height={8}
                  rx={1.5}
                  fill={c}
                  fillOpacity={0.42}
                />
                <text
                  x={X(r.tat) + 6}
                  y={y + 18}
                  className="fill-muted-foreground font-mono"
                  fontSize={8.5}
                >
                  {r.tat.toFixed(3)} TAT
                </text>
              </g>
            )
          })}

          <line
            x1={20}
            x2={W - 20}
            y1={H - 38}
            y2={H - 38}
            stroke="currentColor"
            className="text-border"
            strokeWidth={1}
          />
          <text
            x={20}
            y={H - 20}
            className="fill-muted-foreground font-mono"
            fontSize={9.5}
          >
            On Tanks and Temples the 20 LoRA steps take 1.636° to 0.262° —
            6.2× — and the test-view gap falls from 9.03 dB to 1.66 dB with it.
          </text>
        </svg>
      </div>
    </figure>
  )
}
