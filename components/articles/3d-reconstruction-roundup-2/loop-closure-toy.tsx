"use client"

import { useMemo, useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { cn } from "@/lib/utils"

import { STEPS, STEP_M, runToy, type Pose } from "./pose-graph"

// Drift, and what one loop edge does to it. The maths lives in pose-graph.ts:
// a 96 m loop of 48 steps, odometry with a heading bias you set (and
// optionally a growing scale error), dead reckoning, and Gauss-Newton pose
// graph optimisation on SE(2) with one loop-closure edge from the last pose
// back to the first. Every number on screen is computed by that file.

const W = 640
const H = 330
const MAP = { x0: 12, y0: 34, w: 300, h: 280 }
const CH = { x0: 362, y0: 50, w: 262, h: 200 }
// World bounds in metres, fixed so the loop does not jump as you drag.
const WX0 = -9
const WX1 = 29
const WY0 = -7
const WY1 = 32

const GT_C = "currentColor"
const ODO_C = "oklch(0.64 0.19 30)"
const PGO_C = "oklch(0.58 0.14 250)"

function mx(x: number): number {
  const s = Math.min(MAP.w / (WX1 - WX0), MAP.h / (WY1 - WY0))
  return MAP.x0 + (x - WX0) * s
}
function my(y: number): number {
  const s = Math.min(MAP.w / (WX1 - WX0), MAP.h / (WY1 - WY0))
  return MAP.y0 + MAP.h - (y - WY0) * s
}
function path(ps: Pose[]): string {
  return ps.map((p, k) => `${k === 0 ? "M" : "L"}${mx(p[0]).toFixed(1)},${my(p[1]).toFixed(1)}`).join(" ")
}

export function LoopClosureToy() {
  const [bias, setBias] = useState(1)
  const [scaleOn, setScaleOn] = useState(false)
  const [loopOn, setLoopOn] = useState(true)

  const r = useMemo(() => runToy(bias, scaleOn ? 0.25 : 0), [bias, scaleOn])

  const yMax = Math.max(4, Math.ceil(Math.max(...r.odoErr, ...r.pgoErr) / 4) * 4)
  const cx = (k: number) => CH.x0 + (k / STEPS) * CH.w
  const cy = (e: number) => CH.y0 + CH.h - (e / yMax) * CH.h
  const line = (errs: number[]) =>
    errs.map((e, k) => `${k === 0 ? "M" : "L"}${cx(k).toFixed(1)},${cy(e).toFixed(1)}`).join(" ")

  const pgoMax = Math.max(...r.pgoErr)
  const pgoMaxAt = r.pgoErr.indexOf(pgoMax)
  const end = r.odo[STEPS]
  const desc = `A ${STEPS * STEP_M} metre loop. With a heading bias of ${bias.toFixed(1)} degrees per step${
    scaleOn ? " and a 25 percent scale drift" : ""
  }, dead reckoning ends ${r.gap.toFixed(1)} metres from where it started, with a trajectory error of ${r.odoRmse.toFixed(
    2,
  )} metres RMSE.${
    loopOn
      ? ` With one loop-closure edge and pose graph optimisation the RMSE is ${r.pgoRmse.toFixed(2)} metres, worst ${pgoMax.toFixed(
          2,
        )} metres at pose ${pgoMaxAt}.`
      : ""
  }`

  const ticks = [0, yMax / 2, yMax]

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/20 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>drift, and one loop edge</span>
        <span className="text-muted-foreground/60">SE(2) toy · all numbers computed here</span>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 pt-3">
        <label className="flex min-w-[220px] flex-1 items-center gap-3 font-mono text-[11px] text-muted-foreground">
          <span className="w-[112px] shrink-0">heading bias {bias.toFixed(1)}°/step</span>
          <Range
            min={0}
            max={1.5}
            step={0.1}
            value={bias}
            onChange={(e) => setBias(Number(e.target.value))}
            accent={ODO_C}
            aria-label="Heading bias per step in degrees"
            className="flex-1"
          />
        </label>
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => setLoopOn((v) => !v)}
            aria-pressed={loopOn}
            className={cn(
              "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
              loopOn
                ? "border-foreground/30 bg-muted/50 text-foreground"
                : "border-border text-muted-foreground hover:text-foreground",
            )}
          >
            loop closure {loopOn ? "on" : "off"}
          </button>
          <button
            type="button"
            onClick={() => setScaleOn((v) => !v)}
            aria-pressed={scaleOn}
            className={cn(
              "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
              scaleOn
                ? "border-foreground/30 bg-muted/50 text-foreground"
                : "border-border text-muted-foreground hover:text-foreground",
            )}
          >
            scale drift {scaleOn ? "25%" : "off"}
          </button>
        </div>
      </div>

      <div className="overflow-x-auto p-4 sm:p-5">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full min-w-[600px]" role="img" aria-label={desc}>
          <defs>
            <clipPath id="lct-map">
              <rect x={MAP.x0} y={MAP.y0} width={MAP.w} height={MAP.h} />
            </clipPath>
          </defs>

          {/* ---- map ------------------------------------------------------ */}
          <text x={MAP.x0} y={22} className="fill-foreground font-mono" fontSize={10.5}>
            top view · {STEPS} steps of {STEP_M} m
          </text>
          <rect
            x={MAP.x0}
            y={MAP.y0}
            width={MAP.w}
            height={MAP.h}
            fill="none"
            stroke="currentColor"
            className="text-muted-foreground"
            strokeOpacity={0.2}
          />
          <g clipPath="url(#lct-map)">
            <path
              d={path(r.gt)}
              fill="none"
              stroke={GT_C}
              className="text-muted-foreground"
              strokeOpacity={0.55}
              strokeWidth={1.2}
              strokeDasharray="4 3"
            />
            <path d={path(r.odo)} fill="none" stroke={ODO_C} strokeWidth={1.6} strokeOpacity={loopOn ? 0.45 : 1} />
            {loopOn ? (
              <>
                <line
                  x1={mx(end[0])}
                  y1={my(end[1])}
                  x2={mx(0)}
                  y2={my(0)}
                  stroke={PGO_C}
                  strokeWidth={1}
                  strokeDasharray="2 3"
                />
                <path d={path(r.pgo)} fill="none" stroke={PGO_C} strokeWidth={2} />
                {r.pgo.map((p, k) =>
                  k % 4 === 0 ? <circle key={k} cx={mx(p[0])} cy={my(p[1])} r={1.8} fill={PGO_C} /> : null,
                )}
              </>
            ) : null}
            <circle cx={mx(0)} cy={my(0)} r={4} fill="none" stroke="currentColor" className="text-foreground" />
            <circle cx={mx(end[0])} cy={my(end[1])} r={3} fill={ODO_C} />
          </g>
          <text x={mx(0) + 7} y={my(0) + 12} className="fill-muted-foreground font-mono" fontSize={8.5}>
            start
          </text>
          <text
            x={Math.min(MAP.x0 + MAP.w - 4, Math.max(MAP.x0 + 4, mx(end[0]) + 6))}
            y={Math.min(MAP.y0 + MAP.h - 4, Math.max(MAP.y0 + 10, my(end[1]) - 6))}
            fill={ODO_C}
            className="font-mono"
            fontSize={8.5}
          >
            dead-reckoned end
          </text>

          {/* legend */}
          <g className="font-mono" fontSize={8.5}>
            <line x1={MAP.x0 + 8} x2={MAP.x0 + 24} y1={MAP.y0 + 12} y2={MAP.y0 + 12} stroke="currentColor" className="text-muted-foreground" strokeDasharray="4 3" />
            <text x={MAP.x0 + 28} y={MAP.y0 + 15} className="fill-muted-foreground">
              truth
            </text>
            <line x1={MAP.x0 + 8} x2={MAP.x0 + 24} y1={MAP.y0 + 24} y2={MAP.y0 + 24} stroke={ODO_C} strokeWidth={1.6} />
            <text x={MAP.x0 + 28} y={MAP.y0 + 27} fill={ODO_C}>
              odometry only
            </text>
            {loopOn ? (
              <>
                <line x1={MAP.x0 + 8} x2={MAP.x0 + 24} y1={MAP.y0 + 36} y2={MAP.y0 + 36} stroke={PGO_C} strokeWidth={2} />
                <text x={MAP.x0 + 28} y={MAP.y0 + 39} fill={PGO_C}>
                  after pose graph
                </text>
              </>
            ) : null}
          </g>

          {/* ---- error along the loop -------------------------------------- */}
          <text x={CH.x0} y={22} className="fill-foreground font-mono" fontSize={10.5}>
            position error at each pose (m)
          </text>
          {ticks.map((t) => (
            <g key={t}>
              <line
                x1={CH.x0}
                x2={CH.x0 + CH.w}
                y1={cy(t)}
                y2={cy(t)}
                stroke="currentColor"
                className="text-muted-foreground"
                strokeOpacity={0.15}
              />
              <text x={CH.x0 - 5} y={cy(t) + 3} textAnchor="end" className="fill-muted-foreground font-mono" fontSize={8}>
                {t}
              </text>
            </g>
          ))}
          {[0, 12, 24, 36, 48].map((k) => (
            <text key={k} x={cx(k)} y={CH.y0 + CH.h + 13} textAnchor="middle" className="fill-muted-foreground font-mono" fontSize={8}>
              {k}
            </text>
          ))}
          <text x={CH.x0 + CH.w / 2} y={CH.y0 + CH.h + 26} textAnchor="middle" className="fill-muted-foreground font-mono" fontSize={8.5}>
            pose index along the loop
          </text>
          <path d={line(r.odoErr)} fill="none" stroke={ODO_C} strokeWidth={1.6} strokeOpacity={loopOn ? 0.5 : 1} />
          {loopOn ? (
            <>
              <path d={line(r.pgoErr)} fill="none" stroke={PGO_C} strokeWidth={2} />
              <circle cx={cx(pgoMaxAt)} cy={cy(pgoMax)} r={3} fill={PGO_C} />
            </>
          ) : null}

          {/* readout */}
          <g className="font-mono" fontSize={8.5}>
            <text x={CH.x0} y={CH.y0 + CH.h + 46} fill={ODO_C}>
              odometry: gap {r.gap.toFixed(2)} m · RMSE {r.odoRmse.toFixed(2)} m
            </text>
            {loopOn ? (
              <text x={CH.x0} y={CH.y0 + CH.h + 60} fill={PGO_C}>
                + loop: RMSE {r.pgoRmse.toFixed(2)} m · max {pgoMax.toFixed(2)} m @ {pgoMaxAt}
              </text>
            ) : null}
          </g>
        </svg>
      </div>

      <figcaption className="border-t px-4 py-3 text-xs leading-relaxed text-muted-foreground">
        A toy, not CLoSeR: {STEPS} odometry edges with a heading bias, plus one loop edge from the last pose to the
        first, solved by Gauss-Newton on SE(2) with the first pose held fixed. A heading bias is the error SE(2) can
        absorb: one loop edge pulls the whole loop back and spreads what is left, so the worst pose ends up far from both
        ends. Turn on scale drift and the same graph closes the gap but cannot fix the lengths, because it has no scale
        variable. That is why CLoSeR needs a front end whose scale is already consistent.
      </figcaption>
    </figure>
  )
}
