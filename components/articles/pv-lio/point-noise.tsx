"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"
import { Range } from "@/components/articles/ui/range"
import { mcos, msin } from "@/lib/dmath"

// PV-LIO's per-point noise model (calcBodyCov in include/voxel_map_util.hpp): a return at
// range r along unit direction d has variance ranging_cov^2 along d and (r * sin(angle_cov))^2
// in each direction across it. A point-to-plane residual only sees that covariance projected
// on the plane normal n: sigma_n^2 = sr^2 cos^2(theta) + (r sin(sb))^2 sin^2(theta), where
// theta is the angle between the beam and the normal. FAST-LIO2 instead gives every residual
// the same variance, LASER_POINT_COV = 0.001 m^2 (sigma 3.16 cm). PV-LIO adds the plane's own
// variance on top of this point term; this widget shows the point term only.

const CONFIGS = {
  hesai: { label: "hesai.yaml", sr: 0.01, sb: 0.1, note: "the repo's Hilti 2022 config" },
  velodyne: { label: "velodyne.yaml", sr: 0.04, sb: 0.1, note: "the repo's generic spinning-LiDAR config" },
} as const
type CfgKey = keyof typeof CONFIGS

const FASTLIO_VAR = 0.001
const W = 640
const H = 220
const DEG = Math.PI / 180

export function PointNoise() {
  const [cfg, setCfg] = useState<CfgKey>("hesai")
  const [r, setR] = useState(5)
  const [inc, setInc] = useState(30)
  const c = CONFIGS[cfg]
  const across = r * msin(c.sb * DEG)
  const th = inc * DEG
  const varN = c.sr * c.sr * mcos(th) * mcos(th) + across * across * msin(th) * msin(th)
  const sN = Math.sqrt(varN)
  const ratio = FASTLIO_VAR / varN

  // drawing: sensor on the left, the return at a fixed spot, beam horizontal
  const sx = 40
  const sy = H / 2
  const px = 400
  const py = H / 2
  const mag = 46 / Math.max(c.sr, across)
  const rx = c.sr * mag
  const ry = across * mag
  // the surface through the point, its normal at `inc` degrees from the beam (facing the sensor)
  const nx = -mcos(th)
  const ny = -msin(th)
  const tx = -ny
  const ty = nx
  const L = 95
  const sNpx = sN * mag

  return (
    <figure className="my-8 overflow-hidden rounded-md border">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-3 py-2 font-mono text-xs">
        <span className="text-muted-foreground">one return, its noise, and what the residual sees</span>
        <div className="flex gap-1">
          {(Object.keys(CONFIGS) as CfgKey[]).map((k) => (
            <button key={k} type="button" onClick={() => setCfg(k)} aria-pressed={cfg === k}
              className={cn("cursor-pointer rounded px-2 py-1 transition-colors", cfg === k ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground")}>
              {CONFIGS[k].label}
            </button>
          ))}
        </div>
      </div>

      <div className="p-4">
        <svg viewBox={`0 0 ${W} ${H}`} role="img" className="w-full rounded-md border bg-muted/20"
          aria-label={`A LiDAR return at ${r} m with ${c.label}: ${(c.sr * 100).toFixed(1)} cm of range noise along the beam and ${(across * 100).toFixed(2)} cm across it. On a surface whose normal is ${inc} degrees off the beam the residual sees ${(sN * 100).toFixed(2)} cm.`}>
          <circle cx={sx} cy={sy} r={7} fill="var(--foreground)" />
          <text x={sx} y={sy + 22} textAnchor="middle" className="font-mono" fontSize="9" fill="var(--muted-foreground)">LiDAR</text>
          <line x1={sx + 8} y1={sy} x2={px} y2={py} stroke="var(--muted-foreground)" strokeDasharray="4 3" strokeWidth="1" />
          <text x={(sx + px) / 2} y={sy - 8} textAnchor="middle" className="font-mono" fontSize="9" fill="var(--muted-foreground)">{r} m</text>
          {/* the surface */}
          <line x1={px - tx * L} y1={py - ty * L} x2={px + tx * L} y2={py + ty * L} stroke="var(--foreground)" strokeWidth="2.5" opacity="0.55" />
          {/* the normal, and the 1-sigma band the residual sees along it */}
          <line x1={px} y1={py} x2={px + nx * 70} y2={py + ny * 70} stroke="oklch(0.62 0.17 255)" strokeWidth="1.6" markerEnd="url(#pn-arrow)" />
          <line x1={px - nx * sNpx} y1={py - ny * sNpx} x2={px + nx * sNpx} y2={py + ny * sNpx} stroke="oklch(0.66 0.18 25)" strokeWidth="5" strokeLinecap="round" opacity="0.8" />
          <ellipse cx={px} cy={py} rx={rx} ry={ry} fill="oklch(0.66 0.18 25 / 0.16)" stroke="oklch(0.66 0.18 25)" strokeWidth="1.2" />
          <circle cx={px} cy={py} r={2.6} fill="var(--foreground)" />
          <defs>
            <marker id="pn-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M0,0 L10,5 L0,10 z" fill="oklch(0.62 0.17 255)" />
            </marker>
          </defs>
          <text x={W - 12} y={20} textAnchor="end" className="font-mono" fontSize="9" fill="var(--muted-foreground)">ellipse drawn {mag.toFixed(0)}x life size</text>
          <text x={W - 12} y={34} textAnchor="end" className="font-mono" fontSize="9" fill="oklch(0.66 0.18 25)">red bar: 1 sigma along the normal</text>
          <text x={W - 12} y={48} textAnchor="end" className="font-mono" fontSize="9" fill="oklch(0.62 0.17 255)">blue: surface normal</text>
        </svg>

        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div>
            <div className="mb-1 flex items-center justify-between font-mono text-xs text-muted-foreground">
              <span>range</span><span className="tabular-nums text-foreground">{r} m</span>
            </div>
            <Range min={1} max={60} step={1} value={r} onChange={(e) => setR(parseInt(e.target.value))} className="w-full cursor-pointer" aria-label="range in metres" accent="var(--foreground)" />
          </div>
          <div>
            <div className="mb-1 flex items-center justify-between font-mono text-xs text-muted-foreground">
              <span>angle between beam and surface normal</span><span className="tabular-nums text-foreground">{inc}°</span>
            </div>
            <Range min={0} max={85} step={1} value={inc} onChange={(e) => setInc(parseInt(e.target.value))} className="w-full cursor-pointer" aria-label="incidence angle in degrees" accent="var(--foreground)" />
          </div>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-px overflow-hidden rounded-md border bg-border font-mono text-xs sm:grid-cols-4">
          <Stat label="along the beam" value={`${(c.sr * 100).toFixed(1)} cm`} />
          <Stat label="across the beam" value={`${(across * 100).toFixed(2)} cm`} />
          <Stat label="along the normal" value={`${(sN * 100).toFixed(2)} cm`} highlight />
          <Stat label="weight vs FAST-LIO2" value={ratio >= 1 ? `${ratio.toFixed(1)}x` : `1/${(1 / ratio).toFixed(1)}`} />
        </div>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          {c.label} is {c.note}: {(c.sr * 100).toFixed(0)} cm of range noise and {c.sb}° of bearing
          noise, as standard deviations (the code squares them). FAST-LIO2 gives every residual a
          variance of 0.001 m², a 3.16 cm standard deviation, whatever the range or angle. The
          last box is that variance over this point&apos;s variance along the normal. PV-LIO adds the
          fitted plane&apos;s own variance to this before it inverts it, so a real weight is lower
          than the box shows, by how much depends on the plane.
        </p>
      </div>
    </figure>
  )
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="bg-background px-3 py-2">
      <div className="text-[10px] text-muted-foreground">{label}</div>
      <div className={highlight ? "font-semibold text-foreground" : "font-medium text-foreground"}>{value}</div>
    </div>
  )
}
