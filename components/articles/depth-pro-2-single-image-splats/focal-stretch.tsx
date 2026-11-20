"use client"

// What a wrong focal length does to a back-projected photo. The depth network's real output is
// inverse depth normalised by the focal length, f / (W Z): how big things look, which is what a
// single photo can tell you. Metric depth is that number times f, so depth scales with the focal
// length you supply. Sideways position is X = (u - cx) Z / f = (u - cx) / (W x output): the f
// cancels. A wrong focal length therefore stretches the room along the camera's axis and leaves
// its width alone. Shown from above, on Depth Pro 2-H+'s depth for the viewer's four photos.

import { useEffect, useMemo, useRef, useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { mpow } from "@/lib/dmath"

import { GRIDS } from "./scene-grids"

const SCENES = [
  { id: "hall", label: "Court hall", f35: 27 },
  { id: "cabin", label: "Ship's cabin", f35: 26 },
  { id: "facade", label: "Painted facade", f35: 27 },
  { id: "courtyard", label: "Glass courtyard", f35: 27 },
] as const

const halfToFloat = (h: number) => {
  const s = h & 0x8000 ? -1 : 1
  const e = (h >> 10) & 0x1f
  const m = h & 0x3ff
  if (e === 0) return s * m * 2 ** -24
  if (e === 31) return m ? NaN : s * Infinity
  return s * (1 + m / 1024) * 2 ** (e - 15)
}

type Pts = { x: Float32Array; z: Float32Array; y: Float32Array; n: number; w: number; h: number; fExif: number; fPred: number }

const decode = (id: string): Pts => {
  const g = GRIDS[id]
  const bin = atob(g.depth)
  const n = g.w * g.h
  const x = new Float32Array(n)
  const y = new Float32Array(n)
  const z = new Float32Array(n)
  let k = 0
  for (let i = 0; i < n; i++) {
    const d = halfToFloat(bin.charCodeAt(2 * i) | (bin.charCodeAt(2 * i + 1) << 8))
    if (!(d > 0) || d > 80) continue
    const u = (i % g.w) + 0.5
    const v = Math.floor(i / g.w) + 0.5
    // the network's view of this pixel: lateral offset per metre of depth, at the EXIF focal length
    x[k] = ((u - g.w / 2) * d) / g.fExif
    y[k] = ((v - g.h / 2) * d) / g.fExif
    z[k] = d
    k++
  }
  return { x, y, z, n: k, w: g.w, h: g.h, fExif: g.fExif, fPred: g.fPred }
}

const median = (a: Float32Array, n: number) => {
  const s = Array.from(a.subarray(0, n)).sort((p, q) => p - q)
  return s[Math.floor(n / 2)] ?? 0
}

export function FocalStretch() {
  const [id, setId] = useState<(typeof SCENES)[number]["id"]>("hall")
  // slider in log2 units of the EXIF focal length: -1 is half, +1 is double
  const [lg, setLg] = useState(0)
  const ref = useRef<HTMLCanvasElement>(null)
  const pts = useMemo(() => decode(id), [id])
  const scene = SCENES.find((s) => s.id === id)!
  const k = mpow(2, lg)
  const diag = Math.sqrt(pts.w * pts.w + pts.h * pts.h)
  const f35 = (pts.fExif * k * 43.2666) / diag
  const zMed = median(pts.z, pts.n)
  // how wide the reconstruction is (5th to 95th percentile of X): unchanged by the focal length
  const width = useMemo(() => {
    const s = Array.from(pts.x.subarray(0, pts.n)).sort((p, q) => p - q)
    return (s[Math.floor(pts.n * 0.95)] ?? 0) - (s[Math.floor(pts.n * 0.05)] ?? 0)
  }, [pts])
  const predK = pts.fPred / pts.fExif
  const k30 = 30 / scene.f35

  useEffect(() => {
    const c = ref.current
    if (!c) return
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const W = c.clientWidth
    const H = c.clientHeight
    c.width = Math.round(W * dpr)
    c.height = Math.round(H * dpr)
    const g = c.getContext("2d")
    if (!g) return
    g.setTransform(dpr, 0, 0, dpr, 0, 0)
    const dark = document.documentElement.classList.contains("dark")
    g.fillStyle = dark ? "#0f0f10" : "#fafaf9"
    g.fillRect(0, 0, W, H)
    // fit the plan: camera at the bottom centre, depth up; scale so 2x the EXIF reconstruction fits
    let zMax = 0
    let xMax = 0
    for (let i = 0; i < pts.n; i++) {
      if (pts.z[i] > zMax) zMax = pts.z[i]
      if (Math.abs(pts.x[i]) > xMax) xMax = Math.abs(pts.x[i])
    }
    zMax = Math.min(zMax, zMed * 3)
    const s = Math.min((H - 36) / (zMax * 2), (W - 24) / (2 * xMax))
    const ox = W / 2
    const oy = H - 18
    // grid every metre (or five, for the outdoor scenes)
    const step = zMax * 2 > 40 ? 5 : 1
    g.strokeStyle = dark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.07)"
    g.lineWidth = 1
    for (let m = step; m * s < H; m += step) {
      g.beginPath()
      g.moveTo(0, oy - m * s)
      g.lineTo(W, oy - m * s)
      g.stroke()
    }
    // field of view wedge
    const half = (pts.w / 2 / pts.fExif) * (H * 2)
    g.strokeStyle = dark ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.2)"
    g.setLineDash([4, 4])
    g.beginPath()
    g.moveTo(ox - half * s, oy - H * 2 * s)
    g.lineTo(ox, oy)
    g.lineTo(ox + half * s, oy - H * 2 * s)
    g.stroke()
    g.setLineDash([])
    // the EXIF reconstruction, ghosted, then the one at the chosen focal length
    const draw = (kk: number, col: string, a: number) => {
      g.fillStyle = col
      g.globalAlpha = a
      for (let i = 0; i < pts.n; i += 1) {
        const px = ox + pts.x[i] * s
        const py = oy - pts.z[i] * kk * s
        if (py < -2) continue
        g.fillRect(px, py, 1.4, 1.4)
      }
      g.globalAlpha = 1
    }
    draw(1, dark ? "#9ca3af" : "#9ca3af", 0.18)
    draw(k, dark ? "#f59e0b" : "#c2410c", 0.35)
    // camera
    g.fillStyle = dark ? "#fafafa" : "#111"
    g.beginPath()
    g.moveTo(ox, oy - 6)
    g.lineTo(ox - 6, oy + 6)
    g.lineTo(ox + 6, oy + 6)
    g.fill()
    g.font = "11px ui-monospace, monospace"
    g.fillText(`${step} m grid`, 8, 14)
  }, [pts, k, zMed])

  return (
    <figure data-focal-stretch="" className="not-prose my-8 rounded-xl border p-4">
      <div className="mb-3 flex flex-wrap gap-1" role="group" aria-label="Scene">
        {SCENES.map((s) => (
          <button
            key={s.id}
            type="button"
            aria-pressed={s.id === id}
            onClick={() => setId(s.id)}
            className={`rounded-md border px-2.5 py-1 font-mono text-xs transition-colors ${s.id === id ? "" : "hover:bg-muted"} ${s.id === id ? "bg-foreground text-background hover:bg-foreground/90" : ""}`}
          >
            {s.label}
          </button>
        ))}
      </div>
      <canvas ref={ref} className="h-72 w-full rounded-md border sm:h-80" aria-label="Top-down plan of the back-projected photo: the camera at the bottom, depth upward. Grey is the reconstruction at the EXIF focal length, orange at the focal length chosen below." role="img" />
      <div className="mt-3 flex flex-col gap-2">
        <label className="flex items-center gap-3 font-mono text-xs">
          <span className="w-28 shrink-0">assumed focal</span>
          <Range min={-1} max={1} step={0.01} value={lg} onChange={(e) => setLg(Number(e.target.value))} aria-label="Assumed focal length, relative to the EXIF value" />
        </label>
        <div className="flex flex-wrap gap-1">
          {[
            { l: "EXIF", v: 0 },
            { l: "estimator", v: Math.log2(predK) },
            { l: "30 mm default", v: Math.log2(k30) },
          ].map((b) => (
            <button key={b.l} type="button" onClick={() => setLg(Number(b.v.toFixed(3)))} className="rounded-md border px-2 py-0.5 font-mono text-[11px] hover:bg-muted">
              {b.l}
            </button>
          ))}
        </div>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-1 font-mono text-xs sm:grid-cols-4">
          <div>
            <dt className="text-muted-foreground">focal (35 mm eq.)</dt>
            <dd>{f35.toFixed(1)} mm</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">vs EXIF</dt>
            <dd>{`${k >= 1 ? "+" : ""}${((k - 1) * 100).toFixed(0)}%`}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">median depth</dt>
            <dd>{(zMed * k).toFixed(2)} m</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">width (5 to 95%)</dt>
            <dd>{width.toFixed(2)} m</dd>
          </div>
        </dl>
      </div>
      <figcaption className="mt-3 text-sm text-muted-foreground">
        Every pixel of the photo placed in 3D and seen from above, camera at the bottom. Depth Pro 2 outputs how large things look; the focal length turns that into distance. Drag the focal length and the room stretches or squashes along the view, while its width across the frame stays put: the lateral position of a point does not depend on the focal length at all. The estimator and SHARP&apos;s 30 mm fallback buttons jump to the focal lengths each would have used for this photo.
      </figcaption>
    </figure>
  )
}
