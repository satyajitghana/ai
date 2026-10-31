"use client"

import { useState } from "react"

import { matan2, mcos, msin } from "@/lib/dmath"

// A 2D cross-section of the cluster test in MeshletDrawingPipeline.js. A circle of radius 1 is cut into arcs
// (the "clusters"). Each arc gets a bounding circle (centre = mean of its sample points, radius = farthest
// point) and a normal cone (axis = outward normal at the arc's middle, cutoff = sin(half width), the
// meshoptimizer convention for mindp > 0). A cluster is culled when
//
//     dot(centre - camera, axis) >= cutoff * |centre - camera| + radius
//
// (the line in the shader that reads `cone.w.mul( length( toCluster ) ).add( chunkRadius )`), or when its
// bounding circle is wholly outside one frustum side. The "truth" column counts arcs whose every sample
// faces away from the camera. TOY: 2D, and the cone is exact for a circle, tighter than a real mesh gives.

const TAU = 6.283185307179586

type Arc = { cx: number; cy: number; r: number; ax: number; ay: number; cut: number; a0: number; a1: number }

function arcs(n: number): Arc[] {
  const out: Arc[] = []
  const w = TAU / n
  for (let i = 0; i < n; i++) {
    const a0 = i * w
    const a1 = a0 + w
    let sx = 0
    let sy = 0
    const K = 5
    const pts: [number, number][] = []
    for (let k = 0; k <= K; k++) {
      const a = a0 + (w * k) / K
      pts.push([mcos(a), msin(a)])
      sx += mcos(a)
      sy += msin(a)
    }
    const cx = sx / (K + 1)
    const cy = sy / (K + 1)
    let r = 0
    for (const [x, y] of pts) r = Math.max(r, Math.sqrt((x - cx) ** 2 + (y - cy) ** 2))
    const mid = a0 + w / 2
    out.push({ cx, cy, r, ax: mcos(mid), ay: msin(mid), cut: msin(w / 2), a0, a1 })
  }
  return out
}

const HALF_FOV = 0.5236 // 30 degrees

export function ConeCull() {
  const [n, setN] = useState(32)
  const [dist, setDist] = useState(3)
  const [look, setLook] = useState(0)
  const [camAng, setCamAng] = useState(0)

  const A = arcs(n)
  const camX = dist * mcos(camAng * 0.017453292519943295)
  const camY = dist * msin(camAng * 0.017453292519943295)
  const toOrigin = matan2(-camY, -camX)
  const lookA = toOrigin + look * 0.017453292519943295
  const fx = mcos(lookA)
  const fy = msin(lookA)
  // frustum side normals (inward), 2D
  const sides = [-HALF_FOV, HALF_FOV].map((h) => {
    const dx = mcos(lookA + h)
    const dy = msin(lookA + h)
    return h < 0 ? [-dy, dx] : [dy, -dx]
  })

  let cone = 0
  let fr = 0
  let both = 0
  let truth = 0
  const status = A.map((a) => {
    const tx = a.cx - camX
    const ty = a.cy - camY
    const len = Math.sqrt(tx * tx + ty * ty)
    const coneCull = tx * a.ax + ty * a.ay >= a.cut * len + a.r
    let outside = tx * fx + ty * fy < -a.r
    for (const [nx, ny] of sides) if (tx * nx + ty * ny < -a.r) outside = true
    // truth: all five samples back-facing
    let back = true
    for (let k = 0; k <= 4; k++) {
      const ang = a.a0 + ((a.a1 - a.a0) * k) / 4
      const px = mcos(ang)
      const py = msin(ang)
      if (px * (camX - px) + py * (camY - py) > 0) back = false
    }
    if (back) truth++
    if (coneCull) cone++
    if (outside) fr++
    if (coneCull || outside) both++
    return coneCull ? "cone" : outside ? "frustum" : "draw"
  })

  const S = 28
  const O = 150
  const p = (x: number, y: number) => `${(O + x * S).toFixed(2)},${(O - y * S).toFixed(2)}`
  const colour = (s: string) =>
    s === "cone" ? "oklch(0.62 0.2 25)" : s === "frustum" ? "oklch(0.6 0.02 250)" : "oklch(0.65 0.16 150)"

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/20 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>toy · 2D cross-section of the per-cluster cull</span>
        <span className="text-muted-foreground/60">formula from the shader, geometry simplified</span>
      </div>
      <div className="grid gap-4 p-4 sm:grid-cols-[minmax(0,1fr)_14rem] sm:p-5">
        <svg viewBox="0 0 300 300" role="img" aria-label="A circle cut into arcs with a camera and a view cone" className="mx-auto w-full max-w-[26rem]">
          <polygon
            points={`${p(camX, camY)} ${p(camX + 12 * mcos(lookA + HALF_FOV), camY + 12 * msin(lookA + HALF_FOV))} ${p(camX + 12 * mcos(lookA - HALF_FOV), camY + 12 * msin(lookA - HALF_FOV))}`}
            fill="currentColor"
            fillOpacity={0.05}
            stroke="currentColor"
            strokeOpacity={0.25}
            strokeDasharray="3 3"
          />
          {A.map((a, i) => {
            const steps = 6
            const d: string[] = []
            for (let k = 0; k <= steps; k++) {
              const ang = a.a0 + ((a.a1 - a.a0) * k) / steps
              d.push(`${k === 0 ? "M" : "L"}${p(mcos(ang), msin(ang))}`)
            }
            return <path key={i} d={d.join(" ")} fill="none" stroke={colour(status[i])} strokeWidth={4.5} strokeLinecap="butt" />
          })}
          <circle cx={O + camX * S} cy={O - camY * S} r={4.5} fill="currentColor" />
          <text x={O + camX * S + 7} y={O - camY * S - 7} fontSize={9} fill="currentColor" fillOpacity={0.7}>camera</text>
        </svg>
        <div className="space-y-3 text-sm">
          <label className="block">
            <span className="font-mono text-xs text-muted-foreground">clusters on the circle: {n}</span>
            <input type="range" min={8} max={96} step={4} value={n} onChange={(e) => setN(+e.target.value)} className="w-full" />
          </label>
          <label className="block">
            <span className="font-mono text-xs text-muted-foreground">camera distance: {dist.toFixed(1)}</span>
            <input type="range" min={1.2} max={12} step={0.1} value={dist} onChange={(e) => setDist(+e.target.value)} className="w-full" />
          </label>
          <label className="block">
            <span className="font-mono text-xs text-muted-foreground">camera angle: {camAng} deg</span>
            <input type="range" min={0} max={359} step={1} value={camAng} onChange={(e) => setCamAng(+e.target.value)} className="w-full" />
          </label>
          <label className="block">
            <span className="font-mono text-xs text-muted-foreground">look off-centre: {look} deg</span>
            <input type="range" min={-90} max={90} step={1} value={look} onChange={(e) => setLook(+e.target.value)} className="w-full" />
          </label>
          <dl className="grid grid-cols-2 gap-x-3 gap-y-1 font-mono text-xs">
            <dt className="text-muted-foreground">cone culled</dt>
            <dd>{cone} of {n}</dd>
            <dt className="text-muted-foreground">frustum culled</dt>
            <dd>{fr} of {n}</dd>
            <dt className="text-muted-foreground">either</dt>
            <dd>{both} of {n}</dd>
            <dt className="text-muted-foreground">truly back-facing</dt>
            <dd>{truth} of {n}</dd>
          </dl>
          <p className="text-xs text-muted-foreground">
            Red: cone test. Grey: frustum. Green: queued for the indirect draw. The cone test never culls more than
            the truth row, and it gives up more of that as the camera comes close and the bounding circle swallows
            the arc.
          </p>
        </div>
      </div>
    </figure>
  )
}
