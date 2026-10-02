"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// FAR-LIO as its two components and the stages inside them. The LiDAR Scan
// Pipeline runs on the GPU and registers each scan against a local map; the
// Sensor Fusion backend runs on the CPU and fuses that pose with the IMU. Click
// a stage to see what it does and why it is there. The order is the order data
// flows: scan in on the left, odometry out on the right, with the EKF's estimate
// fed back as the next scan's initial guess. Every fact here is also in the prose,
// so the static reader loses nothing.

type Stage = {
  key: string
  name: string
  lane: "gpu" | "cpu"
  what: string
  why: string
}

const STAGES: Stage[] = [
  {
    key: "pre",
    name: "Preprocess & undistort",
    lane: "gpu",
    what: "Fit a linear model to the recent linear and angular velocity, then project every raw point to the scan's final timestamp — all points in parallel in CUDA.",
    why: "A sweep is not an instant. At 250 km/h the sensor moves metres during one scan; registering the raw, sheared cloud would fight the car's own motion.",
  },
  {
    key: "cov",
    name: "Cov-calc (cuVoxelMap)",
    lane: "gpu",
    what: "For each point, estimate a 3×3 covariance from its k=10 nearest neighbours and regularise it with the Frobenius norm so GICP has a well-conditioned surface model.",
    why: "GICP aligns distributions, not points. The covariance captures that a point sits on a plane or an edge, which makes the fit tolerant of sparse, uneven returns.",
  },
  {
    key: "knn",
    name: "kNN search",
    lane: "gpu",
    what: "Hash the query point to its voxel and scan the 27 voxels around it (3×3×3) for the nearest map point. The map is a CUDA hash table (cuco::static_map), iVox-style, v=4 m voxels holding up to N=40 points.",
    why: "A flat hash table parallelises across thousands of GPU threads with no tree to descend or rebalance — the part a CPU k-d tree spends its scan budget on.",
  },
  {
    key: "gicp",
    name: "SA-GICP optimise",
    lane: "gpu",
    what: "Minimise the robust (Cauchy-kernelled) GICP residual r − T·s, rejecting correspondences past an adaptive threshold. Points too sparse for a covariance fall back to point-to-point. Iterate until ‖T‖₂ ≤ 5e-3 or the time budget (twice the LiDAR period) runs out.",
    why: "At speed, far-field returns are too sparse for a reliable covariance. The sparsity-aware fallback keeps those points in the solve instead of discarding them, which is what pulls down long-term drift.",
  },
  {
    key: "map",
    name: "Adaptive submap",
    lane: "gpu",
    what: "Insert the registered scan into the local submap, capping each voxel at a density (ASMD) set from the current scan's own point count, and drop voxels more than 1000 m away.",
    why: "Matching a dense racetrack scan against a sparse urban map (or the reverse) is what forces per-dataset tuning. Setting density from the live scan is how one parameter set spans both.",
  },
  {
    key: "delay",
    name: "Delay compensation",
    lane: "cpu",
    what: "The LiDAR pose arrives ~19 ms old. Project it to now with zₖ = zₛ + h(x_{k|k-1}) − h(xₛ), and upsample it so its correction is spread over several 100 Hz cycles.",
    why: "A stale pose applied as if it were current yanks the estimate backwards. Extrapolating it — and smearing it over cycles — keeps the output smooth enough for closed-loop control.",
  },
  {
    key: "ekf",
    name: "Kinematic EKF",
    lane: "cpu",
    what: "A 100 Hz EKF with a 9-state kinematic model [t, θ, v], taking IMU acceleration and angular velocity as control inputs and correcting on the LiDAR pose, velocity and reference angles. Its estimate is fed back as the next scan's initial guess.",
    why: "The IMU biases are calibrated once at standstill, not estimated online — fewer states to diverge under heavy vibration. The output is the odometry the car actually drives on.",
  },
]

export function FarLioPipeline() {
  const [sel, setSel] = useState("knn")
  const active = STAGES.find((s) => s.key === sel) ?? STAGES[0]

  return (
    <div className="my-8 rounded-md border bg-muted/30 p-4 sm:p-5">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-sm bg-[#4c9a2a]" /> GPU — LiDAR scan pipeline
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-sm bg-[#2563eb]" /> CPU — sensor fusion
        </span>
      </div>

      <div className="mt-3 flex items-stretch gap-1.5 overflow-x-auto pb-1">
        {STAGES.map((s, i) => (
          <div key={s.key} className="flex items-stretch gap-1.5">
            <button
              type="button"
              onClick={() => setSel(s.key)}
              aria-pressed={sel === s.key}
              className={cn(
                "min-w-[7.5rem] flex-1 rounded-md border px-2.5 py-2 text-left text-xs leading-tight transition-colors",
                s.lane === "gpu"
                  ? "border-[#4c9a2a]/40"
                  : "border-[#2563eb]/40",
                sel === s.key
                  ? s.lane === "gpu"
                    ? "bg-[#4c9a2a]/15 ring-1 ring-[#4c9a2a]/50"
                    : "bg-[#2563eb]/15 ring-1 ring-[#2563eb]/50"
                  : "bg-background hover:bg-muted"
              )}
            >
              <span className="font-mono text-[10px] text-muted-foreground">
                {String(i + 1).padStart(2, "0")}
              </span>
              <span className="mt-0.5 block font-medium">{s.name}</span>
            </button>
            {i < STAGES.length - 1 ? (
              <span className="self-center font-mono text-muted-foreground" aria-hidden>
                →
              </span>
            ) : null}
          </div>
        ))}
      </div>

      <div className="mt-2 flex items-center gap-2 font-mono text-[11px] text-muted-foreground">
        <span aria-hidden>↺</span>
        <span>the EKF estimate is fed back as the next scan&apos;s initial guess and for undistortion</span>
      </div>

      <div
        className={cn(
          "mt-4 rounded-md border-l-2 bg-background/60 py-3 pr-3 pl-4",
          active.lane === "gpu" ? "border-[#4c9a2a]" : "border-[#2563eb]"
        )}
      >
        <div className="flex items-center gap-2">
          <span className="font-heading text-base font-semibold">{active.name}</span>
          <span
            className={cn(
              "rounded px-1.5 py-0.5 font-mono text-[10px] uppercase",
              active.lane === "gpu"
                ? "bg-[#4c9a2a]/15 text-[#3f7f23]"
                : "bg-[#2563eb]/15 text-[#1d4ed8]"
            )}
          >
            {active.lane}
          </span>
        </div>
        <p className="mt-2 text-sm leading-6">
          <span className="font-mono text-xs text-muted-foreground">what&nbsp;·&nbsp;</span>
          {active.what}
        </p>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          <span className="font-mono text-xs">why&nbsp;·&nbsp;</span>
          {active.why}
        </p>
      </div>
    </div>
  )
}
