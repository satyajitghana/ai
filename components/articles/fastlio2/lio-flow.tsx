"use client"

import { useEffect, useState } from "react"
import { PauseIcon, PlayIcon } from "@phosphor-icons/react/dist/ssr"

import { cn } from "@/lib/utils"

// The FAST-LIO2 cycle as a loop, one stage at a time — what each step does and why it has
// to be there. The loop runs at LiDAR rate; the IMU drives the predict between scans.
// Auto-advances around the ring; click a node to inspect it.

const STAGES = [
  {
    key: "imu",
    name: "IMU in",
    short: "IMU in",
    what: "Read the next batch of 200–1000 Hz accelerometer + gyro samples.",
    why: "The IMU is the only thing fast enough to describe motion within a 100 ms LiDAR sweep.",
  },
  {
    key: "predict",
    name: "forward propagate",
    short: "predict",
    what: "Integrate each IMU sample to advance the state mean and inflate the covariance.",
    why: "Gives a good motion prior for this scan — and the per-sample poses needed to deskew.",
  },
  {
    key: "deskew",
    name: "backward deskew",
    short: "deskew",
    what: "Transform every point from the pose it was sampled at into the scan-end frame.",
    why: "A moving sensor shears the scan; registering a sheared cloud would fight your own motion.",
  },
  {
    key: "downsample",
    name: "downsample",
    short: "downsample",
    what: "Voxel-grid the scan down to a few hundred representative points.",
    why: "100k points per scan is overkill; a sparse, even set keeps the update real-time.",
  },
  {
    key: "associate",
    name: "associate (ikd-Tree)",
    short: "associate",
    what: "For each point, kNN-search the map and fit a local plane (normal, offset).",
    why: "This is the measurement: a point-to-plane residual, found directly on raw points — no features.",
  },
  {
    key: "update",
    name: "iterated EKF update",
    short: "iEKF update",
    what: "Solve one Kalman step, relinearize, repeat until the correction is tiny.",
    why: "The point-to-plane fit is very nonlinear; iterating is what makes it converge to the right pose.",
  },
  {
    key: "map",
    name: "map update",
    short: "map update",
    what: "Transform the scan to the world and insert it into the ikd-Tree; trim the far window.",
    why: "Keeps the map current and bounded so the next association stays fast.",
  },
  {
    key: "out",
    name: "odometry out",
    short: "odom out",
    what: "Emit the converged pose (and covariance) at 10–100 Hz; loop.",
    why: "That pose is the answer — and the prior the next cycle propagates from.",
  },
] as const

const ACCENT = "oklch(0.62 0.15 195)"

// ring geometry (viewBox units)
const W = 720
const H = 360
const CX = W / 2
const CY = H / 2
const RX = 300
const RY = 128
const NW = 104 // node width
const NH = 30 // node height

const n = STAGES.length
const angle = (i: number) => -Math.PI / 2 + (i * 2 * Math.PI) / n // start at top, clockwise
const nodePos = (i: number) => ({ x: CX + RX * Math.cos(angle(i)), y: CY + RY * Math.sin(angle(i)) })

// curved connector from node i to node i+1, bowing outward along the ring
function edge(i: number) {
  const a = nodePos(i)
  const b = nodePos((i + 1) % n)
  const mx = (a.x + b.x) / 2
  const my = (a.y + b.y) / 2
  // push control point radially outward from centre
  const dx = mx - CX
  const dy = my - CY
  const len = Math.hypot(dx, dy) || 1
  const push = 26
  const cx = mx + (dx / len) * push
  const cy = my + (dy / len) * push
  return `M ${a.x} ${a.y} Q ${cx} ${cy} ${b.x} ${b.y}`
}

export function LioFlow() {
  const [i, setI] = useState(0)
  const [playing, setPlaying] = useState(true)

  useEffect(() => {
    if (!playing) return
    const id = setInterval(() => setI((x) => (x + 1) % n), 2200)
    return () => clearInterval(id)
  }, [playing])

  const st = STAGES[i]

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex items-center justify-between border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>FAST-LIO2 cycle · one scan @ LiDAR rate</span>
        <button type="button" onClick={() => setPlaying((p) => !p)} className="flex cursor-pointer items-center gap-1 transition-colors hover:text-foreground">
          {playing ? <PauseIcon size={12} weight="fill" /> : <PlayIcon size={12} weight="fill" />}
          {playing ? "pause" : "play"}
        </button>
      </div>

      <div className="p-3 sm:p-4">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`FAST-LIO2 processing loop of ${n} stages; current stage: ${st.name}`}>
          <defs>
            <marker id="lio-arr" viewBox="0 -5 10 10" markerWidth="7" markerHeight="7" orient="auto" refX="6" refY="0">
              <path d="M0,-4L6,0L0,4" fill="none" stroke="var(--muted-foreground)" strokeWidth={1.5} />
            </marker>
            <marker id="lio-arr-on" viewBox="0 -5 10 10" markerWidth="7" markerHeight="7" orient="auto" refX="6" refY="0">
              <path d="M0,-4L6,0L0,4" fill="none" stroke={ACCENT} strokeWidth={1.5} />
            </marker>
            <filter id="lio-soft" x="-40%" y="-40%" width="180%" height="180%">
              <feDropShadow dx="0" dy="1" stdDeviation="1.4" floodOpacity="0.14" />
            </filter>
          </defs>

          {/* connectors (behind nodes) */}
          {STAGES.map((_, k) => {
            const on = k === i // edge leaving the current node
            return (
              <path
                key={k}
                d={edge(k)}
                fill="none"
                stroke={on ? ACCENT : "var(--border)"}
                strokeWidth={on ? 2 : 1.5}
                markerEnd={`url(#${on ? "lio-arr-on" : "lio-arr"})`}
                opacity={on ? 0.95 : 0.55}
                className="transition-all duration-300"
              />
            )
          })}

          {/* centre label */}
          <text x={CX} y={CY - 6} textAnchor="middle" className="fill-muted-foreground font-mono" fontSize={11}>↻ real-time loop</text>
          <text x={CX} y={CY + 12} textAnchor="middle" className="fill-muted-foreground/60 font-mono" fontSize={9}>IMU predict · LiDAR update</text>

          {/* nodes */}
          {STAGES.map((s, k) => {
            const p = nodePos(k)
            const on = k === i
            return (
              <g key={s.key} className="cursor-pointer" onClick={() => setI(k)}>
                <rect
                  x={p.x - NW / 2}
                  y={p.y - NH / 2}
                  width={NW}
                  height={NH}
                  rx={8}
                  fill={on ? ACCENT : "var(--background)"}
                  stroke={on ? ACCENT : "var(--border)"}
                  strokeWidth={1.5}
                  filter={on ? "url(#lio-soft)" : undefined}
                  className="transition-all duration-300"
                />
                <text
                  x={p.x}
                  y={p.y + 4}
                  textAnchor="middle"
                  className="font-mono"
                  fontSize={11}
                  fontWeight={on ? 600 : 400}
                  fill={on ? "var(--background)" : "var(--muted-foreground)"}
                >
                  {s.short}
                </text>
                {/* step index badge */}
                <circle cx={p.x - NW / 2 + 2} cy={p.y - NH / 2 + 2} r={8} fill="var(--background)" stroke={on ? ACCENT : "var(--border)"} strokeWidth={1} />
                <text x={p.x - NW / 2 + 2} y={p.y - NH / 2 + 5} textAnchor="middle" className="font-mono" fontSize={8} fill={on ? ACCENT : "var(--muted-foreground)"}>{k + 1}</text>
              </g>
            )
          })}
        </svg>

        {/* detail — every stage overlaid in one grid cell so the box always
            sizes to the tallest stage and nothing below reflows */}
        <div className="mt-3 grid">
          {STAGES.map((s, k) => (
            <div
              key={s.key}
              aria-hidden={k !== i}
              className={cn(
                "col-start-1 row-start-1 rounded-md bg-muted/40 px-3 py-3 transition-opacity duration-300",
                k === i ? "opacity-100" : "pointer-events-none opacity-0"
              )}
              style={{ borderColor: ACCENT }}
            >
              <div className="font-mono text-xs text-foreground">
                {k + 1}. {s.name}
              </div>
              <p className="mt-1.5 text-sm leading-6">
                <span className="font-medium text-foreground">What:</span>{" "}
                <span className="text-muted-foreground">{s.what}</span>
              </p>
              <p className="mt-1 text-sm leading-6">
                <span className="font-medium text-foreground">Why:</span>{" "}
                <span className="text-muted-foreground">{s.why}</span>
              </p>
            </div>
          ))}
        </div>
      </div>
    </figure>
  )
}
