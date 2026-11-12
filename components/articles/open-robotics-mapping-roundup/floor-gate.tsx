"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { cn } from "@/lib/utils"

// Two identical floors, one unknown: the height h of floor 1 above floor 0.
// Every floor is a rigid submap here, so the whole estimate is a weighted mean
// of the measurements that speak about h:
//
//   the stair transition says h = 3.0 m, sigma 0.15 m (StrataSLAM's stair/ramp
//     record sigma, ADR-0015),
//   an optional barometer says h = 3.0 m, sigma 0.05 m (the figure ADR-0015
//     gives for a barometer),
//   each accepted cross-floor loop closure says h = 0, with the registration's
//     own sigma, because the scan matcher found "the same place" on the floor
//     below.
//
// This is a one-dimensional caricature written for this article, not
// StrataSLAM's solver (which optimises a pose graph per floor). It keeps the
// one thing that matters: a loop closure is a precise measurement, a
// transition is a sloppy one, and least squares believes the precise ones.

const TRUE_H = 3.0
const SIG_T = 0.15
const SIG_BARO = 0.05
const SAME_FLOOR_LOOPS = 6 // S04: 41 accepted loops, 35 of them across floors
const MAX_CROSS = 35
const LOOP_SIGMAS = [0.02, 0.05, 0.1] as const

const W = 440
const H = 250
const X0 = 70
const X1 = 410
const ZY = (z: number) => 205 - z * 45 // metres to px, floor 0 at y 205

const ACCENT = "oklch(0.62 0.17 250)"
const BAD = "oklch(0.64 0.2 25)"

export function FloorGate() {
  const [gate, setGate] = useState(false)
  const [cross, setCross] = useState(MAX_CROSS)
  const [sigL, setSigL] = useState<(typeof LOOP_SIGMAS)[number]>(0.05)
  const [baro, setBaro] = useState(false)

  const n = gate ? 0 : cross
  const wT = 1 / (SIG_T * SIG_T)
  const wB = baro ? 1 / (SIG_BARO * SIG_BARO) : 0
  const wL = 1 / (sigL * sigL)
  const wSum = wT + wB + n * wL
  const h = (wT * TRUE_H + wB * TRUE_H) / wSum
  const sigH = 1 / Math.sqrt(wSum)
  const stairSigmas = (TRUE_H - h) / SIG_T
  const accepted = n + SAME_FLOOR_LOOPS
  const collapse = n / accepted

  // keyframes along each floor, the same x on both floors (identical layouts)
  const kf = Array.from({ length: 9 }, (_, i) => X0 + 20 + i * 38)
  const shown = Math.min(n, kf.length)

  return (
    <figure className="my-8 overflow-hidden rounded-md border">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-3 py-2 font-mono text-xs text-muted-foreground">
        <span>two identical floors · one stair transition · least squares on h</span>
        <span className="tabular-nums">
          floor gate {gate ? "on" : "off"} · {n} cross-floor loops
        </span>
      </div>

      <div className="grid gap-4 p-4 md:grid-cols-[minmax(0,1fr)_210px]">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          role="img"
          aria-label={`Side view of a two-storey building. Floor 1 is really 3.0 metres above floor 0; the estimate puts it at ${h.toFixed(2)} metres, with ${n} cross-floor loop closures pulling it down.`}
          className="w-full"
        >
          {/* metre ticks */}
          {[0, 1, 2, 3].map((z) => (
            <g key={z}>
              <line x1={X0 - 6} x2={X0} y1={ZY(z)} y2={ZY(z)} stroke="var(--muted-foreground)" strokeWidth="1" />
              <text x={X0 - 10} y={ZY(z) + 4} textAnchor="end" fontFamily="monospace" fontSize="10" fill="var(--muted-foreground)">
                {z} m
              </text>
            </g>
          ))}
          <line x1={X0} x2={X0} y1={ZY(0)} y2={ZY(3.4)} stroke="var(--muted-foreground)" strokeWidth="1" />

          {/* floor 0 */}
          <rect x={X0 + 4} y={ZY(0)} width={X1 - X0 - 4} height="7" fill="var(--foreground)" opacity="0.75" />
          <text x={X1} y={ZY(0) + 22} textAnchor="end" fontFamily="monospace" fontSize="10" fill="var(--muted-foreground)">
            floor 0
          </text>

          {/* true floor 1, ghost */}
          <rect
            x={X0 + 4}
            y={ZY(TRUE_H)}
            width={X1 - X0 - 4}
            height="7"
            fill="none"
            stroke="var(--muted-foreground)"
            strokeDasharray="4 3"
          />
          <text x={X1} y={ZY(TRUE_H) - 6} textAnchor="end" fontFamily="monospace" fontSize="10" fill="var(--muted-foreground)">
            where floor 1 really is
          </text>

          {/* stairs on the left */}
          {Array.from({ length: 6 }, (_, i) => (
            <rect
              key={i}
              x={X0 + 6 + i * 4}
              y={ZY(((i + 1) * TRUE_H) / 6)}
              width="4"
              height={(ZY(0) - ZY(((i + 1) * TRUE_H) / 6)).toFixed(1)}
              fill="var(--muted-foreground)"
              opacity="0.25"
            />
          ))}

          {/* loop links from estimated floor 1 down to floor 0 */}
          {kf.slice(0, shown).map((x, i) => (
            <line
              key={i}
              x1={x}
              x2={x}
              y1={(ZY(h) + 7).toFixed(1)}
              y2={ZY(0)}
              stroke={BAD}
              strokeWidth="1.4"
              strokeDasharray="3 3"
            />
          ))}

          {/* estimated floor 1 */}
          <rect
            x={X0 + 4}
            y={ZY(h).toFixed(1)}
            width={X1 - X0 - 4}
            height="7"
            fill={h > 2.5 ? ACCENT : BAD}
            opacity="0.85"
          />
          {kf.map((x, i) => (
            <circle key={i} cx={x} cy={(ZY(h) + 3.5).toFixed(1)} r="3" fill="var(--background)" stroke="var(--foreground)" strokeWidth="1" />
          ))}
          <text x={X0 + 34} y={(ZY(h) - 6).toFixed(1)} fontFamily="monospace" fontSize="11" fill="var(--foreground)">
            floor 1 estimate: {h.toFixed(2)} m
          </text>
        </svg>

        <div className="flex flex-col gap-3 font-mono text-xs text-muted-foreground">
          <dl className="grid grid-cols-[1fr_auto] gap-x-2 gap-y-1 tabular-nums">
            <dt>floor 1 height</dt>
            <dd className="text-right text-foreground">{h.toFixed(2)} m</dd>
            <dt>its sigma</dt>
            <dd className="text-right text-foreground">{sigH.toFixed(3)} m</dd>
            <dt>stair residual</dt>
            <dd className={cn("text-right", stairSigmas > 3 ? "" : "text-foreground")} style={stairSigmas > 3 ? { color: BAD } : undefined}>
              {stairSigmas.toFixed(1)} σ
            </dd>
            <dt>loops accepted</dt>
            <dd className="text-right text-foreground">{accepted}</dd>
            <dt>collapse rate</dt>
            <dd className="text-right text-foreground">{collapse.toFixed(3)}</dd>
          </dl>
          <p className="leading-5">
            With the gate off and all 35 accepted, the collapse rate is 35 / 41 = 0.854, the figure StrataSLAM&apos;s negative
            control S04 reports. Its estimated floor 1 is gone: the robot has mapped one floor twice.
          </p>
        </div>
      </div>

      <div className="grid gap-3 border-t px-4 py-3 sm:grid-cols-2">
        <div>
          <div className="mb-1 flex items-center justify-between font-mono text-xs text-muted-foreground">
            <span>cross-floor matches proposed</span>
            <span className="tabular-nums text-foreground">{cross}</span>
          </div>
          <Range
            min={0}
            max={MAX_CROSS}
            step={1}
            value={cross}
            onChange={(e) => setCross(parseInt(e.target.value, 10))}
            className="w-full cursor-pointer"
            aria-label="number of cross-floor loop closures the place recognizer proposes"
            accent="var(--foreground)"
          />
        </div>
        <div className="flex flex-wrap items-end gap-2 font-mono text-xs">
          <button
            type="button"
            aria-pressed={gate}
            onClick={() => setGate((g) => !g)}
            className={cn(
              "cursor-pointer rounded border px-2 py-1 transition-colors",
              gate ? "border-transparent text-white" : "text-muted-foreground hover:text-foreground"
            )}
            style={gate ? { background: ACCENT } : undefined}
          >
            floor gate: {gate ? "on" : "off"}
          </button>
          <button
            type="button"
            aria-pressed={baro}
            onClick={() => setBaro((b) => !b)}
            className={cn(
              "cursor-pointer rounded border px-2 py-1 transition-colors",
              baro ? "border-foreground text-foreground" : "text-muted-foreground hover:text-foreground"
            )}
          >
            barometer: {baro ? "on" : "off"}
          </button>
          {LOOP_SIGMAS.map((s) => (
            <button
              key={s}
              type="button"
              aria-pressed={sigL === s}
              onClick={() => setSigL(s)}
              className={cn(
                "cursor-pointer rounded border px-2 py-1 transition-colors",
                sigL === s ? "border-foreground text-foreground" : "text-muted-foreground hover:text-foreground"
              )}
            >
              loop σ {s} m
            </button>
          ))}
        </div>
      </div>

      <figcaption className="border-t px-4 py-3 text-sm leading-6 text-muted-foreground">
        A one-number caricature, not StrataSLAM&apos;s solver: floor 1&apos;s height is the weighted mean of the stair
        transition (3.0 m, σ 0.15 m), an optional barometer (3.0 m, σ 0.05 m) and every accepted cross-floor loop, each of
        which claims the two floors are the same place (0 m). One false loop at σ 0.05 m already outweighs the stairs nine
        to one. The barometer slows the collapse but cannot stop it, because loops keep arriving and the barometer does not.
        Turning the gate on removes the loops from the problem, which is the only fix that does not depend on how many
        there are.
      </figcaption>
    </figure>
  )
}
