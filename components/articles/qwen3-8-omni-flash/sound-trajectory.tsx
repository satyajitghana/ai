// The one place in Qwen's launch material where the sound-localisation claim
// carries checkable numbers: the official Qwen3.8-Omni-Flash spatial-audio demo
// (qianwen-res.oss-cn-beijing.aliyuncs.com/Qwen3.8-Omni-Flash/demo-13-robot-navigation.en.mp4).
// It leaves a "Reasoning" panel and a "Trajectory Output" table on screen at the
// same time, twice, with different numbers in each — and never relates them.
//
//   t = 45.5s  "I hear the sound coming from my front-right at a medium
//               distance of 2.2 meters" + an 8-row waypoint table
//   t = 55.5s  "...at a medium distance of 1.2 meters, which aligns with the
//               phone on the floor." + a different 8-row waypoint table
//
// Both tables are transcribed verbatim from those frames. Everything else —
// the plan view, the path lengths, the terminal displacements, the slot
// accounting — is computed from them here. This is an internal consistency
// check between what the model says it hears and what it then plans. It is not
// an independent measurement of where the phone actually was.
//
// SSR, zero JS. Every transcendental goes through lib/dmath so the SVG
// serialises identically on the server and in the browser.

import { matan2, mcos, mhypot, msin } from "@/lib/dmath"

// waypoint, x (m, forward), y (m, left-positive), yaw (rad, left-positive)
type Wp = { x: number; y: number; yaw: number }

// t = 45.5s — stated distance 2.2 m. Four advances, four turns.
const PLAN_FAR: Wp[] = [
  { x: 0.25, y: -0.0, yaw: 0.0 },
  { x: 0.25, y: -0.0, yaw: -0.262 },
  { x: 0.491, y: -0.065, yaw: -0.262 },
  { x: 0.491, y: -0.065, yaw: -0.524 },
  { x: 0.708, y: -0.19, yaw: -0.524 },
  { x: 0.708, y: -0.19, yaw: -0.785 },
  { x: 0.885, y: -0.367, yaw: -0.785 },
  { x: 0.885, y: -0.367, yaw: -1.047 },
]

// t = 55.5s — stated distance 1.2 m. Five advances, three turns.
const PLAN_NEAR: Wp[] = [
  { x: 0.25, y: -0.0, yaw: 0.0 },
  { x: 0.25, y: -0.0, yaw: -0.262 },
  { x: 0.491, y: -0.065, yaw: -0.262 },
  { x: 0.491, y: -0.065, yaw: -0.524 },
  { x: 0.708, y: -0.19, yaw: -0.524 },
  { x: 0.925, y: -0.315, yaw: -0.524 },
  { x: 0.925, y: -0.315, yaw: -0.785 },
  { x: 1.101, y: -0.492, yaw: -0.785 },
]

type Pt = { x: number; y: number }

function positions(plan: Wp[]): Pt[] {
  return [{ x: 0, y: 0 }, ...plan.map((w) => ({ x: w.x, y: w.y }))].filter(
    (p, i, all) => i === 0 || p.x !== all[i - 1].x || p.y !== all[i - 1].y
  )
}

function summarise(plan: Wp[], statedM: number) {
  const pts = positions(plan)
  const end = pts[pts.length - 1]
  const steps = pts.length - 1
  return {
    pts,
    end,
    statedM,
    steps,
    turns: plan.length - steps,
    reach: mhypot(end.x, end.y),
    bearingDeg: (Math.abs(matan2(end.y, end.x)) * 180) / Math.PI,
    walked: steps * 0.25,
  }
}

const FAR = summarise(PLAN_FAR, 2.2)
const NEAR = summarise(PLAN_NEAR, 1.2)

const W = 260
const H = 350
const OX = 60
const OY = 320
const S = 240 // px per metre

const sx = (p: Pt) => OX - p.y * S
const sy = (p: Pt) => OY - p.x * S
const poly = (pts: Pt[]) => pts.map((p) => `${sx(p).toFixed(2)},${sy(p).toFixed(2)}`).join(" ")

// A point at radius r and bearing phi (phi < 0 is to the robot's right).
const polar = (r: number, phi: number) => ({
  x: OX - r * msin(phi) * S,
  y: OY - r * mcos(phi) * S,
})

const ACCENT = "oklch(0.68 0.16 205)" // cyan — the acoustic claim, and the plan that lands on it
const MUTED = "oklch(0.62 0.02 260)" // grey — the earlier plan, which does not

const arcA = polar(NEAR.statedM, -0.2)
const arcB = polar(NEAR.statedM, -0.62)
const arcR = NEAR.statedM * S

export function SoundTrajectory() {
  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          Two Trajectory Output tables from the same demo, plotted
        </span>
        <span className="font-mono text-[10px] text-muted-foreground">plan view, robot starts at the origin</span>
      </div>

      <div className="flex flex-col gap-4 p-3 sm:flex-row sm:items-center sm:p-4">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="h-auto w-full max-w-[260px] shrink-0 self-center text-foreground"
          role="img"
          aria-label="Plan view of two paths the model planned in the same demo. Both start at the origin facing forward and turn right in fifteen-degree steps. The earlier plan, made when the model said it heard the sound 2.2 metres away, stops 0.96 metres out. The later plan, made when it said 1.2 metres, ends 1.206 metres out — on the dashed arc marking that stated distance."
        >
          {/* forward axis */}
          <line x1={OX} y1={OY} x2={OX} y2={OY - 1.28 * S} stroke="currentColor" strokeOpacity={0.14} strokeWidth={1} />
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
            x={arcB.x + 6}
            y={arcB.y + 13}
            fontSize={8.5}
            textAnchor="end"
            fill={ACCENT}
            fontFamily="ui-monospace, monospace"
          >
            heard: 1.2 m
          </text>

          {/* the earlier plan — same first legs, stops short */}
          <polyline points={poly(FAR.pts)} fill="none" stroke={MUTED} strokeWidth={3.4} strokeLinejoin="round" />
          <circle cx={sx(FAR.end)} cy={sy(FAR.end)} r={4} fill="var(--background)" stroke={MUTED} strokeWidth={2} />
          <text
            x={sx(FAR.end) + 8}
            y={sy(FAR.end) + 3}
            fontSize={8.5}
            fill="currentColor"
            fillOpacity={0.5}
            fontFamily="ui-monospace, monospace"
          >
            earlier plan
          </text>

          {/* the later plan — lands on the arc */}
          <polyline points={poly(NEAR.pts)} fill="none" stroke={ACCENT} strokeWidth={2} strokeLinejoin="round" />
          {NEAR.pts.map((p, i) => (
            <circle
              key={`${p.x}-${p.y}`}
              cx={sx(p)}
              cy={sy(p)}
              r={i === NEAR.pts.length - 1 ? 5 : 2.6}
              fill={ACCENT}
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
        </svg>

        <div className="min-w-0 sm:flex-1">
          <table className="w-full border-collapse font-mono text-[10px] sm:text-[11px]">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="py-1.5 pr-2 font-normal"> </th>
                <th className="py-1.5 pr-2 text-right font-normal">t = 45.5s</th>
                <th className="py-1.5 text-right font-normal">t = 55.5s</th>
              </tr>
            </thead>
            <tbody className="tabular-nums">
              <tr className="border-b border-border/50">
                <td className="py-1.5 pr-2 text-muted-foreground">model said it heard</td>
                <td className="py-1.5 pr-2 text-right">{FAR.statedM.toFixed(1)} m</td>
                <td className="py-1.5 text-right">{NEAR.statedM.toFixed(1)} m</td>
              </tr>
              <tr className="border-b border-border/50">
                <td className="py-1.5 pr-2 text-muted-foreground">plan ends at</td>
                <td className="py-1.5 pr-2 text-right">{FAR.reach.toFixed(3)} m</td>
                <td className="py-1.5 text-right" style={{ color: ACCENT }}>
                  {NEAR.reach.toFixed(3)} m
                </td>
              </tr>
              <tr className="border-b border-border/50">
                <td className="py-1.5 pr-2 text-muted-foreground">short of what it heard</td>
                <td className="py-1.5 pr-2 text-right">{(FAR.statedM - FAR.reach).toFixed(2)} m</td>
                <td className="py-1.5 text-right" style={{ color: ACCENT }}>
                  {Math.round((NEAR.reach - NEAR.statedM) * 1000)} mm over
                </td>
              </tr>
              <tr className="border-b border-border/50">
                <td className="py-1.5 pr-2 text-muted-foreground">bearing</td>
                <td className="py-1.5 pr-2 text-right">{FAR.bearingDeg.toFixed(1)}&deg; right</td>
                <td className="py-1.5 text-right">{NEAR.bearingDeg.toFixed(1)}&deg; right</td>
              </tr>
              <tr className="border-b border-border/50">
                <td className="py-1.5 pr-2 text-muted-foreground">8 slots spent</td>
                <td className="py-1.5 pr-2 text-right">
                  {FAR.steps} steps / {FAR.turns} turns
                </td>
                <td className="py-1.5 text-right">
                  {NEAR.steps} steps / {NEAR.turns} turns
                </td>
              </tr>
              <tr>
                <td className="py-1.5 pr-2 text-muted-foreground">distance walked</td>
                <td className="py-1.5 pr-2 text-right">{FAR.walked.toFixed(2)} m</td>
                <td className="py-1.5 text-right">{NEAR.walked.toFixed(2)} m</td>
              </tr>
            </tbody>
          </table>
          <p className="mt-2.5 font-mono text-[9px] leading-relaxed text-muted-foreground">
            Every waypoint is a 0.25 m step or a 15&deg; turn, eight slots per plan. Transcribed from the
            demo&rsquo;s own on-screen panels.
          </p>
        </div>
      </div>
    </figure>
  )
}
