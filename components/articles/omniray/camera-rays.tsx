"use client"

// A camera is a map from pixels to rays. For every pixel we compute the angle
// theta between its ray and the optical axis, and plot theta against the pixel's
// distance r from the image centre (in half-diagonal units, the paper's unit).
// A lens that is symmetric about its axis puts every pixel on one curve
// theta(r): that is the "monotone radial profile" the OmniRay base assumes. A
// 2:1 equirectangular panorama does not: pixels at the same r have different
// angles, so no function theta(r) can describe it. The number under the plot is
// the size of that failure for this sampling: the RMS gap to a straight line fitted
// to theta against r inside each of 24 radius bins, the best any function of r
// alone could do. All four cameras are analytic models, not data.

import { useMemo, useState } from "react"

import { macos, matan, mcos, mhypot, mtan } from "@/lib/dmath"
import { cn } from "@/lib/utils"

type CamId = "pinhole" | "fisheye" | "catadioptric" | "equirect"
type Pt = { x: number; y: number; r: number; theta: number }

const DEG = 180 / Math.PI

const CAMS: { id: CamId; label: string; note: string }[] = [
  { id: "pinhole", label: "Pinhole, 90° FoV", note: "theta = atan(r_img): one angle per radius, and it never reaches 90°." },
  { id: "fisheye", label: "Equidistant fisheye, 180°", note: "theta = (π/2)·r_img inside the image circle: one angle per radius." },
  { id: "catadioptric", label: "Mirror camera, 40°–155°", note: "A paraboloid mirror images an annulus about the axis: still one angle per radius." },
  { id: "equirect", label: "2:1 panorama", note: "Longitude and latitude map to x and y. Same radius, different angle." },
]

function sample(id: CamId): Pt[] {
  const out: Pt[] = []
  if (id === "equirect") {
    const nx = 73
    const ny = 37
    const hd = mhypot(1, 0.5)
    for (let j = 0; j < ny; j++) {
      for (let i = 0; i < nx; i++) {
        const x = -1 + (2 * i) / (nx - 1)
        const y = -0.5 + (1 * j) / (ny - 1)
        const lon = Math.PI * x
        const lat = Math.PI * y
        out.push({ x, y: y * 2, r: mhypot(x, y) / hd, theta: macos(mcos(lat) * mcos(lon)) })
      }
    }
    return out
  }
  const n = 49
  const hd = Math.SQRT2
  const tRim = mtan((155 / 2) * (Math.PI / 180))
  const rIn = mtan((40 / 2) * (Math.PI / 180)) / tRim
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const x = -1 + (2 * i) / (n - 1)
      const y = -1 + (2 * j) / (n - 1)
      const rr = mhypot(x, y)
      let theta: number
      if (id === "pinhole") theta = matan(rr)
      else if (rr > 1) continue
      else if (id === "fisheye") theta = (Math.PI / 2) * rr
      else if (rr < rIn) continue
      else theta = 2 * matan(rr * tRim)
      out.push({ x, y, r: rr / hd, theta })
    }
  }
  return out
}

// RMS gap between each pixel's theta and a straight line fitted to theta against r inside its
// radius bin (24 bins over [0, 1]): the best any function of r alone can do on this sampling,
// to within the curvature inside one bin. Zero for a camera that is symmetric about its axis.
function radialSpread(pts: Pt[]): number {
  const B = 24
  const n = new Array(B).fill(0)
  const sr = new Array(B).fill(0)
  const st = new Array(B).fill(0)
  const srr = new Array(B).fill(0)
  const srt = new Array(B).fill(0)
  const stt = new Array(B).fill(0)
  for (const p of pts) {
    const b = Math.min(B - 1, Math.floor(p.r * B))
    n[b] += 1
    sr[b] += p.r
    st[b] += p.theta
    srr[b] += p.r * p.r
    srt[b] += p.r * p.theta
    stt[b] += p.theta * p.theta
  }
  let ss = 0
  let m = 0
  for (let b = 0; b < B; b++) {
    if (n[b] < 3) continue
    const rb = sr[b] / n[b]
    const tb = st[b] / n[b]
    const sxx = srr[b] - n[b] * rb * rb
    const sxy = srt[b] - n[b] * rb * tb
    const syy = stt[b] - n[b] * tb * tb
    ss += Math.max(syy - (sxx > 1e-12 ? (sxy * sxy) / sxx : 0), 0)
    m += n[b]
  }
  return Math.sqrt(ss / Math.max(m, 1)) * DEG
}

const hue = (theta: number) => 225 - (theta / Math.PI) * 225

export function CameraRays() {
  const [id, setId] = useState<CamId>("fisheye")
  const pts = useMemo(() => sample(id), [id])
  const spread = useMemo(() => radialSpread(pts), [pts])
  const thetaMax = useMemo(() => Math.max(...pts.map((p) => p.theta)) * DEG, [pts])
  const cam = CAMS.find((c) => c.id === id)!
  const wide = id === "equirect"

  // left panel: the image
  const LW = wide ? 280 : 200
  const LH = wide ? 140 : 200
  // right panel: theta against r
  const PW = 300
  const PH = 200
  const px = (r: number) => 38 + r * (PW - 50)
  const py = (t: number) => PH - 26 - (t / Math.PI) * (PH - 44)

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/20 to-transparent">
      <div className="flex items-center justify-between border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>pixels to rays</span>
        <span className="text-muted-foreground/60">analytic camera models</span>
      </div>
      <div className="p-4 sm:p-5">
        <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Camera model">
          {CAMS.map((c) => (
            <button
              key={c.id}
              type="button"
              role="tab"
              aria-selected={c.id === id}
              onClick={() => setId(c.id)}
              className={cn(
                "cursor-pointer rounded-full border px-3 py-1 font-mono text-[11px] transition-colors",
                c.id === id ? "border-foreground bg-foreground text-background" : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {c.label}
            </button>
          ))}
        </div>

        <div className="mt-4 grid items-center gap-4 sm:grid-cols-[auto_1fr]">
          <div className="mx-auto">
            <svg viewBox={`0 0 ${LW} ${LH}`} width={LW} height={LH} role="img" className="max-w-full">
              <title>{`Image plane of a ${cam.label} camera. Each dot is a pixel, coloured by the angle of its ray from the optical axis: blue on the axis, red at 180 degrees.`}</title>
              <rect x={0.5} y={0.5} width={LW - 1} height={LH - 1} className="fill-muted/30 stroke-border" />
              {pts.map((p, k) => (
                <circle
                  key={k}
                  cx={wide ? ((p.x + 1) / 2) * (LW - 8) + 4 : ((p.x + 1) / 2) * (LW - 8) + 4}
                  cy={wide ? ((p.y + 1) / 2) * (LH - 8) + 4 : ((p.y + 1) / 2) * (LH - 8) + 4}
                  r={wide ? 1.9 : 2.1}
                  fill={`hsl(${hue(p.theta).toFixed(0)} 75% 50%)`}
                />
              ))}
              <circle cx={LW / 2} cy={LH / 2} r={2.5} className="fill-none stroke-foreground" />
            </svg>
            <div className="mt-1 text-center font-mono text-[10px] text-muted-foreground">colour = angle from the optical axis</div>
          </div>

          <div className="overflow-x-auto">
            <svg viewBox={`0 0 ${PW} ${PH}`} className="w-full min-w-[280px] max-w-[420px]" role="img">
              <title>{`Incidence angle against image radius for a ${cam.label} camera. ${spread < 0.5 ? "All pixels lie on one curve." : "Pixels at the same radius have different angles, so the points fill an area."}`}</title>
              <line x1={38} y1={PH - 26} x2={PW - 8} y2={PH - 26} className="stroke-muted-foreground" />
              <line x1={38} y1={14} x2={38} y2={PH - 26} className="stroke-muted-foreground" />
              {[0, 90, 180].map((a) => (
                <g key={a}>
                  <line x1={34} x2={PW - 8} y1={py((a * Math.PI) / 180)} y2={py((a * Math.PI) / 180)} className="stroke-border" strokeDasharray={a === 90 ? "4 3" : "1 4"} />
                  <text x={30} y={py((a * Math.PI) / 180) + 3} textAnchor="end" fontSize={9} className="fill-muted-foreground font-mono">{`${a}°`}</text>
                </g>
              ))}
              {[0, 0.5, 1].map((r) => (
                <text key={r} x={px(r)} y={PH - 12} textAnchor="middle" fontSize={9} className="fill-muted-foreground font-mono">{r}</text>
              ))}
              <text x={(38 + PW - 8) / 2} y={PH - 1} textAnchor="middle" fontSize={9} className="fill-muted-foreground font-mono">image radius r (half-diagonals)</text>
              {pts.map((p, k) => (
                <circle key={k} cx={px(p.r)} cy={py(p.theta)} r={1.6} fill={`hsl(${hue(p.theta).toFixed(0)} 75% 50%)`} fillOpacity={0.75} />
              ))}
            </svg>
            <div className="font-mono text-[10px] text-muted-foreground">angle from the axis, θ, against r</div>
          </div>
        </div>

        <p className="mt-3 font-mono text-[11px] leading-relaxed text-muted-foreground">{cam.note}</p>

        <div className="mt-3 grid grid-cols-3 gap-2 font-mono text-[11px]">
          {[
            ["largest θ", `${thetaMax.toFixed(0)}°`],
            ["spread at equal r", `${spread.toFixed(spread < 1 ? 2 : 1)}°`],
            ["one θ(r) fits?", spread < 0.5 ? "yes" : "no"],
          ].map(([k, v]) => (
            <div key={k} className="rounded-md border px-2 py-1.5">
              <div className="text-muted-foreground">{k}</div>
              <div className="text-sm text-foreground">{v}</div>
            </div>
          ))}
        </div>
        <p className="mt-2 font-mono text-[10px] leading-relaxed text-muted-foreground/80">
          Spread is the RMS gap between each pixel&apos;s θ and a straight line fitted to θ against r inside its radius bin (24 bins): the best any function of r alone can do on this
          sampling, to within the curvature inside one bin. It is zero for a camera that is symmetric about its axis.
        </p>
      </div>
    </figure>
  )
}
