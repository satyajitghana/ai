"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { cn } from "@/lib/utils"

// Why 250 km/h breaks the usual LIO assumptions, made concrete. Slide the speed
// and watch three distances: how far the car moves during one LiDAR sweep (the
// scan the registration has to treat as one rigid cloud), between two IMU samples
// (the motion the undistortion model actually has to interpolate), and during the
// odometry's own latency (what the EKF has to extrapolate away). All three are
// just v * t — exact arithmetic, no transcendental functions, so no dmath needed
// and nothing to desync between server and client. The numbers that matter are
// also written out in the prose, so the static .md reader loses nothing.

// LiDAR sweep rates in the racing dataset: 10 Hz (yas_10, mon_20) and 20 Hz (yas_20).
const LIDAR = [
  { hz: 10, label: "10 Hz", note: "yas_10, mon_20" },
  { hz: 20, label: "20 Hz", note: "yas_20" },
] as const

const IMU_HZ = 800 // Vectornav VN-310 on the race cars
const FARLIO_DELAY_S = 0.01923 // FAR-LIO racing callback: 19.23 ms (reported)
const DIVERGE_LO_S = 0.06 // Fig. 5: APE stays stable up to 60–100 ms of delay
const DIVERGE_HI_S = 0.1

function meters(v: number) {
  // Human-friendly: cm below a metre, else metres.
  return v < 1 ? `${(v * 100).toFixed(1)} cm` : `${v.toFixed(2)} m`
}

export function SpeedGap() {
  const [kmh, setKmh] = useState(250)
  const [hz, setHz] = useState(10)

  const mps = kmh / 3.6
  const perSweep = mps / hz
  const perImu = mps / IMU_HZ
  const perDelay = mps * FARLIO_DELAY_S
  const divLo = mps * DIVERGE_LO_S
  const divHi = mps * DIVERGE_HI_S

  // Track is scaled so the divergence threshold (the worst case) fills ~92%.
  const scale = divHi > 0 ? 92 / divHi : 0
  const bar = (d: number) => Math.min(100, Math.max(0.4, d * scale))

  const rows = [
    {
      key: "sweep",
      title: "Per LiDAR sweep",
      sub: `one ${hz} Hz scan`,
      value: perSweep,
      accent: "#E0533A",
      why: "The whole scan is registered as if it were one rigid cloud. This much motion is baked into it — so every point must be deskewed first.",
    },
    {
      key: "imu",
      title: "Per IMU sample",
      sub: `${IMU_HZ} Hz`,
      value: perImu,
      accent: "#2E86C1",
      why: "The IMU still samples motion finely at speed, so a linear velocity model across the sweep stays accurate. It is the only thing fast enough to undistort the scan.",
    },
    {
      key: "delay",
      title: "During FAR-LIO's delay",
      sub: "19.23 ms callback",
      value: perDelay,
      accent: "#2FB8AC",
      why: "The registered pose is already this far in the past when it reaches the filter. Delay compensation projects it forward to now.",
    },
  ]

  return (
    <div className="my-8 rounded-md border bg-muted/30 p-4 sm:p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="font-mono text-xs tracking-wide text-muted-foreground uppercase">
            Distance travelled between measurements
          </div>
          <div className="mt-1 font-heading text-2xl font-semibold tabular-nums">
            {kmh} km/h
            <span className="ml-2 align-middle font-mono text-sm font-normal text-muted-foreground">
              = {mps.toFixed(1)} m/s
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1 self-start rounded-md border bg-background p-0.5 font-mono text-xs">
          {LIDAR.map((l) => (
            <button
              key={l.hz}
              type="button"
              onClick={() => setHz(l.hz)}
              className={cn(
                "rounded px-2.5 py-1 transition-colors",
                hz === l.hz
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:text-foreground"
              )}
              aria-pressed={hz === l.hz}
            >
              LiDAR {l.label}
            </button>
          ))}
        </div>
      </div>

      <Range
        className="mt-4"
        min={10}
        max={250}
        step={5}
        value={kmh}
        aria-label="Vehicle speed in km/h"
        onChange={(e) => setKmh(Number(e.target.value))}
      />
      <div className="mt-1 flex justify-between font-mono text-[11px] text-muted-foreground">
        <span>10 km/h</span>
        <span>city · 30</span>
        <span>250 km/h · A2RL</span>
      </div>

      <div className="mt-5 space-y-3">
        {rows.map((r) => (
          <div key={r.key}>
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-sm">
                <span className="font-medium">{r.title}</span>{" "}
                <span className="font-mono text-xs text-muted-foreground">
                  ({r.sub})
                </span>
              </span>
              <span
                className="font-mono text-sm font-semibold tabular-nums"
                style={{ color: r.accent }}
              >
                {meters(r.value)}
              </span>
            </div>
            <div className="mt-1 h-2.5 w-full overflow-hidden rounded-full bg-foreground/8">
              <div
                className="h-full rounded-full transition-[width] duration-150"
                style={{ width: `${bar(r.value)}%`, background: r.accent }}
              />
            </div>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">{r.why}</p>
          </div>
        ))}
      </div>

      <div className="mt-4 rounded-md border border-dashed bg-background/60 p-3 text-xs leading-5">
        <span className="font-mono text-muted-foreground">divergence threshold</span>{" "}
        — in simulation, the error stays flat until the odometry lags by{" "}
        <span className="font-mono">60–100 ms</span>, which at this speed is{" "}
        <span className="font-mono font-semibold tabular-nums">
          {meters(divLo)}–{meters(divHi)}
        </span>{" "}
        of travel. FAR-LIO&apos;s own{" "}
        <span className="font-mono">19.23 ms</span> ({meters(perDelay)}) leaves a wide
        margin; a baseline at <span className="font-mono">50 ms</span> does not.
      </div>
    </div>
  )
}
