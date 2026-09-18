// The one place in Qwen's launch material where the sound-localisation claim
// carries checkable numbers: the "Locate the Sound Source" segment of the
// official Qwen3.8-Omni-Flash spatial-audio demo
// (qianwen-res.oss-cn-beijing.aliyuncs.com/Qwen3.8-Omni-Flash/demo-13-robot-navigation.en.mp4,
// ~55s in). The model's own Reasoning panel says it hears the phone
// "from my front-right at a medium distance of 1.2 meters", and the Trajectory
// Output panel beside it prints eight waypoints in the robot's body frame.
//
// Transcribed verbatim from the frame; the plan view, the path length and the
// terminal displacement are computed from them here. This is an internal
// consistency check — it shows the planner agrees with the model's own stated
// bearing and distance. It is not an independent measurement of how far the
// phone actually was.
//
// SSR, zero JS. Every transcendental goes through lib/dmath so the SVG
// serialises identically on the server and in the browser.

import { matan2, mcos, mhypot, msin } from "@/lib/dmath"

// waypoint, x (m, forward), y (m, left-positive), yaw (rad, left-positive)
const WAYPOINTS: { n: number; x: number; y: number; yaw: number }[] = [
  { n: 1, x: 0.25, y: -0.0, yaw: 0.0 },
  { n: 2, x: 0.25, y: -0.0, yaw: -0.262 },
  { n: 3, x: 0.491, y: -0.065, yaw: -0.262 },
  { n: 4, x: 0.491, y: -0.065, yaw: -0.524 },
  { n: 5, x: 0.708, y: -0.19, yaw: -0.524 },
  { n: 6, x: 0.925, y: -0.315, yaw: -0.524 },
  { n: 7, x: 0.925, y: -0.315, yaw: -0.785 },
  { n: 8, x: 1.101, y: -0.492, yaw: -0.785 },
]

const STATED_M = 1.2 // "a medium distance of 1.2 meters"

// Distinct positions (the duplicated rows are turns taken in place).
type Pt = { x: number; y: number }
const POSITIONS: Pt[] = [{ x: 0, y: 0 }, ...WAYPOINTS.map((w) => ({ x: w.x, y: w.y }))].filter(
  (p, i, all) => i === 0 || p.x !== all[i - 1].x || p.y !== all[i - 1].y
)

// Headings, taken at the point each one becomes current.
const HEADINGS = [
  { x: 0, y: 0, yaw: 0 },
  { x: 0.25, y: -0.0, yaw: -0.262 },
  { x: 0.491, y: -0.065, yaw: -0.524 },
  { x: 0.925, y: -0.315, yaw: -0.785 },
]

const end = WAYPOINTS[WAYPOINTS.length - 1]
const endDist = mhypot(end.x, end.y)
const endBearing = matan2(end.y, end.x)
const pathLen = POSITIONS.slice(1).reduce(
  (acc, p, i) => acc + mhypot(p.x - POSITIONS[i].x, p.y - POSITIONS[i].y),
  0
)

const W = 260
const H = 350
const OX = 60
const OY = 320
const S = 240 // px per metre

const sx = (p: Pt) => OX - p.y * S
const sy = (p: Pt) => OY - p.x * S

// A point at radius r and bearing phi (phi < 0 is to the robot's right).
const polar = (r: number, phi: number) => ({
  x: OX - r * msin(phi) * S,
  y: OY - r * mcos(phi) * S,
})

const ACCENT = "oklch(0.68 0.16 205)" // cyan — the acoustic claim
const PATH = "oklch(0.55 0.18 265)" // indigo — the emitted trajectory

const arcA = polar(STATED_M, -0.2)
const arcB = polar(STATED_M, -0.62)
const arcR = STATED_M * S

const line = POSITIONS.map((p) => `${sx(p).toFixed(2)},${sy(p).toFixed(2)}`).join(" ")

export function SoundTrajectory() {
  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          &ldquo;Locate the Sound Source&rdquo; &mdash; the demo&rsquo;s own eight waypoints, plotted
        </span>
        <span className="font-mono text-[10px] text-muted-foreground">plan view, robot starts at the origin</span>
      </div>

      <div className="flex flex-col gap-4 p-3 sm:flex-row sm:items-center sm:p-4">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="h-auto w-full max-w-[260px] shrink-0 self-center text-foreground"
          role="img"
          aria-label="Plan view of the robot's path: it starts at the origin facing forward, turns right in three steps of fifteen degrees and advances five times by a quarter metre, ending 1.206 metres from the start at 24.1 degrees to the right — on the 1.2-metre arc the model said it heard the phone on."
        >
          {/* forward axis */}
          <line
            x1={OX}
            y1={OY}
            x2={OX}
            y2={OY - 1.28 * S}
            stroke="currentColor"
            strokeOpacity={0.14}
            strokeWidth={1}
          />
          <text
            x={OX - 6}
            y={OY - 1.28 * S + 10}
            fontSize={8.5}
            textAnchor="end"
            fill="currentColor"
            fillOpacity={0.45}
            fontFamily="ui-monospace, monospace"
          >
            forward
          </text>

          {/* the locus of "1.2 m away" */}
          <path
            d={`M ${arcA.x.toFixed(2)} ${arcA.y.toFixed(2)} A ${arcR.toFixed(2)} ${arcR.toFixed(2)} 0 0 1 ${arcB.x.toFixed(2)} ${arcB.y.toFixed(2)}`}
            fill="none"
            stroke={ACCENT}
            strokeWidth={1.4}
            strokeDasharray="4 3"
          />
          <text
            x={arcB.x + 4}
            y={arcB.y + 12}
            fontSize={8.5}
            textAnchor="end"
            fill={ACCENT}
            fontFamily="ui-monospace, monospace"
          >
            heard: 1.2 m
          </text>

          {/* the emitted trajectory */}
          <polyline points={line} fill="none" stroke={PATH} strokeWidth={2.2} strokeLinejoin="round" />

          {/* headings at each turn */}
          {HEADINGS.map((h) => {
            const tipX = sx(h) - 26 * msin(h.yaw)
            const tipY = sy(h) - 26 * mcos(h.yaw)
            return (
              <line
                key={h.yaw}
                x1={sx(h)}
                y1={sy(h)}
                x2={tipX}
                y2={tipY}
                stroke="currentColor"
                strokeOpacity={0.35}
                strokeWidth={1.2}
              />
            )
          })}

          {POSITIONS.map((p, i) => (
            <circle
              key={`${p.x}-${p.y}`}
              cx={sx(p)}
              cy={sy(p)}
              r={i === POSITIONS.length - 1 ? 5 : 3}
              fill={i === POSITIONS.length - 1 ? ACCENT : PATH}
              stroke="var(--background)"
              strokeWidth={1}
            />
          ))}

          <text
            x={OX + 6}
            y={OY - 4}
            fontSize={8.5}
            fill="currentColor"
            fillOpacity={0.45}
            fontFamily="ui-monospace, monospace"
          >
            start
          </text>
          <text
            x={sx(end) + 8}
            y={sy(end) + 3}
            fontSize={8.5}
            fill={ACCENT}
            fontFamily="ui-monospace, monospace"
          >
            wp 8
          </text>
        </svg>

        <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5 font-mono text-[10px] sm:flex-1 sm:text-[11px]">
          <div>
            <dt className="text-muted-foreground">model said it heard</dt>
            <dd className="tabular-nums text-foreground">front-right, {STATED_M.toFixed(1)} m</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">waypoint 8 lands at</dt>
            <dd className="tabular-nums" style={{ color: ACCENT }}>
              {endDist.toFixed(3)} m
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">its bearing</dt>
            <dd className="tabular-nums text-foreground">
              {Math.abs((endBearing * 180) / Math.PI).toFixed(1)}&deg; right
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">disagreement</dt>
            <dd className="tabular-nums" style={{ color: ACCENT }}>
              {Math.round((endDist - STATED_M) * 1000)} mm
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">path walked</dt>
            <dd className="tabular-nums text-foreground">{pathLen.toFixed(2)} m</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">shape</dt>
            <dd className="tabular-nums text-foreground">5 &times; 0.25 m, turns &minus;15&deg;</dd>
          </div>
        </dl>
      </div>
    </figure>
  )
}
