"use client"

import { useEffect, useState } from "react"
import { PauseIcon, PlayIcon } from "@phosphor-icons/react/dist/ssr"

import { cn } from "@/lib/utils"

// The FAST-LIO2 cycle, one stage at a time — what each step does and why it has to
// be there. The loop runs at LiDAR rate; the IMU drives the predict between scans.
// Auto-advances; click a stage to inspect it.

const STAGES = [
  {
    key: "imu",
    name: "IMU in",
    what: "Read the next batch of 200–1000 Hz accelerometer + gyro samples.",
    why: "The IMU is the only thing fast enough to describe motion within a 100 ms LiDAR sweep.",
  },
  {
    key: "predict",
    name: "forward propagate",
    what: "Integrate each IMU sample to advance the state mean and inflate the covariance.",
    why: "Gives a good motion prior for this scan — and the per-sample poses needed to deskew.",
  },
  {
    key: "deskew",
    name: "backward deskew",
    what: "Transform every point from the pose it was sampled at into the scan-end frame.",
    why: "A moving sensor shears the scan; registering a sheared cloud would fight your own motion.",
  },
  {
    key: "downsample",
    name: "downsample",
    what: "Voxel-grid the scan down to a few hundred representative points.",
    why: "100k points per scan is overkill; a sparse, even set keeps the update real-time.",
  },
  {
    key: "associate",
    name: "associate (ikd-Tree)",
    what: "For each point, kNN-search the map and fit a local plane (normal, offset).",
    why: "This is the measurement: a point-to-plane residual, found directly on raw points — no features.",
  },
  {
    key: "update",
    name: "iterated EKF update",
    what: "Solve one Kalman step, relinearize, repeat until the correction is tiny.",
    why: "The point-to-plane fit is very nonlinear; iterating is what makes it converge to the right pose.",
  },
  {
    key: "map",
    name: "map update",
    what: "Transform the scan to the world and insert it into the ikd-Tree; trim the far window.",
    why: "Keeps the map current and bounded so the next association stays fast.",
  },
  {
    key: "out",
    name: "odometry out",
    what: "Emit the converged pose (and covariance) at 10–100 Hz; loop.",
    why: "That pose is the answer — and the prior the next cycle propagates from.",
  },
] as const

export function LioFlow() {
  const [i, setI] = useState(0)
  const [playing, setPlaying] = useState(true)

  useEffect(() => {
    if (!playing) return
    const id = setInterval(() => setI((x) => (x + 1) % STAGES.length), 2200)
    return () => clearInterval(id)
  }, [playing])

  const s = STAGES[i]

  return (
    <figure className="my-8 overflow-hidden rounded-md border">
      <div className="flex items-center justify-between border-b px-3 py-2 font-mono text-xs text-muted-foreground">
        <span>FAST-LIO2 cycle · one scan</span>
        <button type="button" onClick={() => setPlaying((p) => !p)} className="flex cursor-pointer items-center gap-1 transition-colors hover:text-foreground">
          {playing ? <PauseIcon size={12} weight="fill" /> : <PlayIcon size={12} weight="fill" />}
          {playing ? "pause" : "play"}
        </button>
      </div>

      <div className="p-4">
        {/* stage chips */}
        <div className="flex flex-wrap items-center gap-1.5">
          {STAGES.map((st, k) => (
            <span key={st.key} className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setI(k)}
                className={cn(
                  "cursor-pointer rounded-md border px-2 py-1 font-mono text-[11px] transition-all",
                  k === i ? "border-transparent text-background" : "text-muted-foreground hover:border-foreground/40"
                )}
                style={k === i ? { background: "oklch(0.72 0.15 195)" } : undefined}
              >
                {st.name}
              </button>
              {k < STAGES.length - 1 ? <span className="text-muted-foreground/40">→</span> : null}
            </span>
          ))}
          <span className="ml-1 font-mono text-[11px] text-muted-foreground/50">↻ loop</span>
        </div>

        {/* detail */}
        <div className="mt-4 rounded-md border-l-2 border-foreground/30 bg-muted/30 px-3 py-3">
          <div className="font-mono text-xs text-foreground">
            {i + 1}. {s.name}
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
      </div>
    </figure>
  )
}
