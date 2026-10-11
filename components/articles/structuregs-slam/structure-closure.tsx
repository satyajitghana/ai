"use client"

import { useMemo, useState } from "react"

import { Range } from "@/components/articles/ui/range"

import { simulate, walls, type Mode, type P2 } from "./sim"

// Plan view, metres to px. The floor spans x -2..26, y -2..16.
const W = 480
const H = 330
const S = 15
const X0 = 3.5
const Y0 = 17.5
const sx = (x: number) => (x + X0) * S
const sy = (y: number) => (Y0 - y) * S

const RED = "oklch(0.63 0.2 25)"
const GREEN = "oklch(0.6 0.15 150)"
const AMBER = "oklch(0.72 0.15 75)"

const MODES: Array<{ id: Mode; label: string }> = [
  { id: "off", label: "Odometry only" },
  { id: "pgi", label: "Structure closure" },
  { id: "manhattan", label: "+ Manhattan frame" },
]

const path = (pts: P2[]) => pts.map((p, k) => `${k ? "L" : "M"}${sx(p[0]).toFixed(1)},${sy(p[1]).toFixed(1)}`).join(" ")

export function StructureClosure() {
  const [drift, setDrift] = useState(0.5)
  const [mode, setMode] = useState<Mode>("pgi")
  const [skew, setSkew] = useState(false)
  const r = useMemo(() => simulate(drift, mode, skew), [drift, mode, skew])
  const ws = useMemo(() => walls(skew), [skew])
  const N = r.truth.length - 1
  const closure = r.closures[0]
  const corrected = mode !== "off"

  return (
    <figure className="my-8 overflow-hidden rounded-md border">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-3 py-2 font-mono text-xs text-muted-foreground">
        <span>Toy: 60 m around a block, never back to the start</span>
        <span className="tabular-nums">
          {mode === "off"
            ? "no closures"
            : `${r.closures.length} plane closure${r.closures.length === 1 ? "" : "s"}${
                mode === "manhattan" ? ` · heading pinned on ${r.manhattanSteps} of ${N + 1} steps` : ""
              }`}
        </span>
      </div>

      <div className="p-4">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          role="img"
          aria-label={`Plan view of a toy floor. The true path runs east, north and west around an inner block and ends 14 metres north of its start. With ${drift.toFixed(2)} degrees of yaw drift per metre, odometry ends ${r.finalErr[0].toFixed(2)} metres from the truth${
            corrected ? `; the corrected path ends ${r.finalErr[1].toFixed(2)} metres from it` : ""
          }.`}
          className="w-full"
        >
          <defs>
            <clipPath id="sgs-plan">
              <rect x="0" y="0" width={W} height={H} />
            </clipPath>
          </defs>
          <rect x={sx(2)} y={sy(12)} width={20 * S} height={10 * S} fill="var(--muted)" />
          <text x={sx(12)} y={sy(7) + 4} textAnchor="middle" fontFamily="monospace" fontSize="10" fill="var(--muted-foreground)">
            inner block
          </text>
          {ws.map((w) => (
            <line
              key={w.id}
              x1={sx(w.a[0])}
              y1={sy(w.a[1])}
              x2={sx(w.b[0])}
              y2={sy(w.b[1])}
              stroke={w.id === "west" ? AMBER : "var(--muted-foreground)"}
              strokeWidth={w.id === "west" ? 3 : 2}
              strokeLinecap="round"
            />
          ))}
          <text x={sx(-2) - 6} y={sy(10.5)} textAnchor="middle" fontFamily="monospace" fontSize="9" fill={AMBER} transform={`rotate(-90 ${sx(-2) - 6} ${sy(10.5)})`}>
            west wall · one persistent plane
          </text>

          <g clipPath="url(#sgs-plan)">
            {r.ghost && (
              <line
                x1={sx(r.ghost[0][0])}
                y1={sy(r.ghost[0][1])}
                x2={sx(r.ghost[1][0])}
                y2={sy(r.ghost[1][1])}
                stroke={RED}
                strokeWidth="1.5"
                strokeDasharray="5 4"
              />
            )}
            <path d={path(r.truth)} fill="none" stroke="var(--foreground)" strokeWidth="1.2" strokeDasharray="3 4" opacity="0.7" />
            <path d={path(r.odo)} fill="none" stroke={RED} strokeWidth="1.6" />
            {corrected && <path d={path(r.est)} fill="none" stroke={GREEN} strokeWidth="2" />}
            {corrected && closure && (
              <circle cx={sx(r.est[closure.step][0])} cy={sy(r.est[closure.step][1])} r="4.5" fill="none" stroke={GREEN} strokeWidth="1.5" />
            )}
            <circle cx={sx(r.odo[N][0])} cy={sy(r.odo[N][1])} r="3" fill={RED} />
          </g>
          <circle cx={sx(0)} cy={sy(0)} r="3.5" fill="var(--foreground)" />
          <text x={sx(0) + 6} y={sy(0) - 6} fontFamily="monospace" fontSize="10" fill="var(--foreground)">
            start
          </text>
          <circle cx={sx(0)} cy={sy(14)} r="3.5" fill="none" stroke="var(--foreground)" strokeWidth="1.5" />
          <text x={sx(0) + 6} y={sy(14) + 14} fontFamily="monospace" fontSize="10" fill="var(--foreground)">
            true end
          </text>
          <line x1={W - 90} y1={H - 10} x2={W - 90 + 5 * S} y2={H - 10} stroke="var(--foreground)" strokeWidth="1.2" />
          <text x={W - 90} y={H - 14} fontFamily="monospace" fontSize="9" fill="var(--muted-foreground)">
            5 m
          </text>
        </svg>

        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 font-mono text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-0 w-4 border-t border-dashed border-foreground" /> truth
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-0.5 w-4" style={{ background: RED }} /> odometry
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-0 w-4 border-t-2 border-dashed" style={{ borderColor: RED }} /> west wall as odometry places it at the end
          </span>
          {corrected && (
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-0.5 w-4" style={{ background: GREEN }} /> corrected
            </span>
          )}
        </div>
      </div>

      <div className="border-t px-4 py-3">
        <dl className="mb-3 grid grid-cols-2 gap-x-4 gap-y-1 font-mono text-xs tabular-nums sm:grid-cols-4">
          <div className="flex flex-col">
            <dt className="text-muted-foreground">end error, odometry</dt>
            <dd>{r.finalErr[0].toFixed(2)} m</dd>
          </div>
          <div className="flex flex-col">
            <dt className="text-muted-foreground">end error, corrected</dt>
            <dd>{corrected ? `${r.finalErr[1].toFixed(2)} m` : "–"}</dd>
          </div>
          <div className="flex flex-col">
            <dt className="text-muted-foreground">ATE RMSE odo / corr</dt>
            <dd>
              {r.ate[0].toFixed(2)} / {corrected ? r.ate[1].toFixed(2) : "–"} m
            </dd>
          </div>
          <div className="flex flex-col">
            <dt className="text-muted-foreground">heading error at end</dt>
            <dd>
              {r.headingErrDeg[0].toFixed(1)}° / {corrected ? `${r.headingErrDeg[1].toFixed(1)}°` : "–"}
            </dd>
          </div>
        </dl>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <div className="mb-1 flex items-center justify-between font-mono text-xs text-muted-foreground">
              <span>yaw drift</span>
              <span className="tabular-nums text-foreground">{drift.toFixed(2)}° per metre</span>
            </div>
            <Range
              min={0}
              max={1}
              step={0.05}
              value={drift}
              onChange={(e) => setDrift(parseFloat(e.target.value))}
              className="w-full cursor-pointer"
              aria-label="yaw drift in degrees per metre"
              accent="var(--foreground)"
            />
          </div>
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="correction mode">
              {MODES.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  aria-pressed={mode === m.id}
                  onClick={() => setMode(m.id)}
                  className={`rounded border px-2 py-1 font-mono text-xs ${
                    mode === m.id ? "border-foreground bg-foreground text-background" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
            <label className="flex cursor-pointer items-center gap-2 font-mono text-xs text-muted-foreground">
              <input type="checkbox" checked={skew} onChange={(e) => setSkew(e.target.checked)} />
              tilt the north wall 6° (the floor is no longer square)
            </label>
          </div>
        </div>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          {mode === "off" &&
            "Dead reckoning: a small constant yaw bias turns the U into a fan, and the error at the end is mostly sideways, because a heading error swings everything after it."}
          {mode === "pgi" &&
            (closure
              ? `About 58 m in, the robot sees the west wall again from 14 m north of where it first saw it. The stored plane and the re-observed one disagree by ${Math.abs(closure.dHeadingDeg).toFixed(1)}° in normal and ${Math.abs(closure.dOffset).toFixed(2)} m in offset. The heading residual is spread linearly over every pose since the start, the path is re-integrated, then the offset is spread the same way along the wall's normal. One plane fixes heading and the east-west position; the north-south error it cannot see is what is left.`
              : "No plane has been out of view long enough to count as a closure.")}
          {mode === "manhattan" &&
            (skew
              ? "With the north wall 6° off square, the Manhattan assumption snaps it to the nearest axis anyway, and the heading is dragged the wrong way for the whole last leg. The plane closure at the end then has to fight a constraint that was confidently wrong."
              : "Every visible wall now pins the heading to the axis directions of the first wall ever seen, on every step. Rotation drift never gets a chance to build, which is why structure-based SLAM targets rotation first.")}{" "}
          Toy model: all noise levels, ranges and gates are mine, not the paper&apos;s.
        </p>
      </div>
    </figure>
  )
}
