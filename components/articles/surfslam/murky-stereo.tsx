"use client"

import { useMemo, useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { mcos, mexp, mlog } from "@/lib/dmath"
import { cn } from "@/lib/utils"

// One scanline of an underwater stereo pair, rendered with the image-formation
// model SurfSLAM uses for its augmentations (paper, Eqs. 1-2):
//
//   I_c = J_c * t_c(z) + B_c * (1 - t_c(z)),   t_c(z) = exp(-beta_c * z)
//
// and matched with plain block matching (sum of absolute differences over a
// 7-pixel window, winner takes all). Open water has no surface at all, so its
// true disparity is zero and every disparity explains it equally badly. The
// "Occam" switch applies the paper's test as a per-pixel decision rule: keep
// the best disparity only if it beats zero disparity by a margin. The paper
// uses the same comparison as a training loss over whole images, not as an
// inference-time rule; this is the intuition, not their network.
//
// Everything here is a toy: the per-channel attenuation ratios, the veil
// colour, the albedo textures and the noise level are mine. The optics
// (focal length 1419.6 px, baseline 11.4 cm) come from the released
// calibration, downsampled eight times so the scanline is 160 pixels wide.

const W = 160
const F = 1419.6 / 8
const BASE = 0.114
const DMAX = 16
const HALF = 3
const NOISE = 0.012
const TAU = 0.008
const SAND_Z = 4.5
const BETA_RATIO = [2.2, 1.0, 1.4] as const // toy: red dies first, green last
const VEIL = [0.05, 0.42, 0.38] as const // toy veiling light B_inf
const HULL_TINT = [0.8, 0.6, 0.45] as const
const SAND_TINT = [0.9, 0.85, 0.7] as const

type Seg = { x0: number; x1: number; z: number; tex: number[]; tint: readonly number[]; kind: "hull" | "sand" }

function rng(seed: number) {
  let s = seed
  return () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff
    return s / 0x7fffffff
  }
}

function gaussFrom(r: () => number) {
  return () => Math.sqrt(-2 * mlog(Math.max(r(), 1e-9))) * mcos(2 * Math.PI * r())
}

// Albedo textures, fixed for every render (seeded), indexed by left-image pixel.
const HULL_TEX = (() => {
  const r = rng(7)
  const raw = Array.from({ length: W }, () => 0.15 + 0.7 * r())
  return raw.map((_, i) => (raw[Math.max(i - 1, 0)] + 2 * raw[i] + raw[Math.min(i + 1, W - 1)]) / 4)
})()
const SAND_TEX = (() => {
  const r = rng(11)
  return Array.from({ length: W }, () => 0.5 + 0.05 * (r() - 0.5))
})()

function scene(hullZ: number): Seg[] {
  return [
    { x0: 40, x1: 100, z: hullZ, tex: HULL_TEX, tint: HULL_TINT, kind: "hull" },
    { x0: 100, x1: 130, z: SAND_Z, tex: SAND_TEX, tint: SAND_TINT, kind: "sand" },
  ]
}

const disp = (z: number) => (F * BASE) / z

function sampleTex(tex: number[], x: number) {
  const i = Math.max(0, Math.min(W - 2, Math.floor(x)))
  const f = Math.min(1, Math.max(0, x - i))
  return tex[i] * (1 - f) + tex[i + 1] * f
}

// What surface does pixel x of this camera see? shift = 0 for the left image,
// and the disparity for the right one (a point at left pixel xl lands at xl - d).
function visible(segs: Seg[], x: number, right: boolean) {
  let best: { seg: Seg; xl: number } | null = null
  for (const seg of segs) {
    const xl = right ? x + disp(seg.z) : x
    if (xl >= seg.x0 && xl < seg.x1 && (!best || seg.z < best.seg.z)) best = { seg, xl }
  }
  return best
}

type Pixel = [number, number, number]

function render(segs: Seg[], beta: number, right: boolean, seed: number): Pixel[] {
  const g = gaussFrom(rng(seed))
  const out: Pixel[] = []
  for (let x = 0; x < W; x++) {
    const hit = visible(segs, x, right)
    const px: Pixel = [0, 0, 0]
    for (let c = 0; c < 3; c++) {
      let v: number = VEIL[c]
      if (hit) {
        const t = mexp(-beta * BETA_RATIO[c] * hit.seg.z)
        const j = sampleTex(hit.seg.tex, hit.xl) * hit.seg.tint[c]
        v = j * t + VEIL[c] * (1 - t)
      }
      px[c] = Math.min(1, Math.max(0, v + NOISE * g()))
    }
    out.push(px)
  }
  return out
}

const lum = (p: Pixel) => (p[0] + p[1] + p[2]) / 3

// Mean absolute difference over a 7-pixel window, for every disparity.
function costVolume(L: number[], R: number[]) {
  const vol: number[][] = []
  for (let x = 0; x < W; x++) {
    const row: number[] = []
    for (let d = 0; d <= DMAX; d++) {
      let s = 0
      let n = 0
      for (let k = -HALF; k <= HALF; k++) {
        const xl = x + k
        const xr = xl - d
        if (xl < 0 || xl >= W || xr < 0) continue
        s += Math.abs(L[xl] - R[xr])
        n++
      }
      row.push(n ? s / n : Infinity)
    }
    vol.push(row)
  }
  return vol
}

export type StereoResult = {
  left: Pixel[]
  right: Pixel[]
  truth: number[]
  kind: ("water" | "hidden" | "hull" | "sand")[]
  est: number[]
  vol: number[][]
  geomOk: number
  geomN: number
  waterZero: number
  waterN: number
  hullT: number
}

export function solveScanline(beta: number, hullZ: number, occam: boolean, tau = TAU): StereoResult {
  const segs = scene(hullZ)
  const left = render(segs, beta, false, 101)
  const right = render(segs, beta, true, 202)
  const vol = costVolume(left.map(lum), right.map(lum))
  const truth: number[] = []
  const kind: StereoResult["kind"] = []
  const est: number[] = []
  let geomOk = 0
  let geomN = 0
  let waterZero = 0
  let waterN = 0
  for (let x = 0; x < W; x++) {
    const hit = visible(segs, x, false)
    // Open water whose zero-disparity partner the right camera cannot see (the
    // hull is in front of it there) is a half-occlusion: no disparity is right.
    const hidden = !hit && visible(segs, x, true) !== null
    truth.push(hit ? disp(hit.seg.z) : 0)
    kind.push(hit ? hit.seg.kind : hidden ? "hidden" : "water")
    let best = 0
    for (let d = 1; d <= DMAX; d++) if (vol[x][d] < vol[x][best]) best = d
    if (occam && vol[x][0] - vol[x][best] < tau) best = 0
    est.push(best)
    // Score away from the image edges, where the window runs off the pair.
    if (x < DMAX + HALF || x >= W - HALF) continue
    if (hit) {
      geomN++
      if (Math.abs(best - truth[x]) <= 1) geomOk++
    } else if (!hidden) {
      waterN++
      if (best === 0) waterZero++
    }
  }
  const hullT = mexp(-beta * BETA_RATIO[1] * hullZ)
  return { left, right, truth, kind, est, vol, geomOk, geomN, waterZero, waterN, hullT }
}

const OK = "oklch(0.62 0.15 150)"
const BAD = "oklch(0.64 0.2 25)"
const TRUE = "var(--muted-foreground)"
const PX = 3
const SW = W * PX
const PROBE_WATER = 28
const PROBE_HULL = 70

const rgb = (p: Pixel) =>
  `rgb(${Math.round(p[0] * 255)},${Math.round(p[1] * 255)},${Math.round(p[2] * 255)})`

export function MurkyStereo() {
  const [beta, setBeta] = useState(0.1)
  const [hullZ, setHullZ] = useState(2.5)
  const [occam, setOccam] = useState(false)
  const r = useMemo(() => solveScanline(beta, hullZ, occam), [beta, hullZ, occam])

  const DH = 110 // disparity plot height
  const dy = (d: number) => DH - 8 - (d / DMAX) * (DH - 16)
  const truthPath = r.truth
    .map((d, x) => `${x ? "L" : "M"}${(x * PX + PX / 2).toFixed(1)},${dy(d).toFixed(1)}`)
    .join(" ")

  const geomPct = r.geomN ? (100 * r.geomOk) / r.geomN : 0
  const waterPct = r.waterN ? (100 * r.waterZero) / r.waterN : 0

  return (
    <figure className="my-8 overflow-hidden rounded-md border">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-3 py-2 font-mono text-xs text-muted-foreground">
        <span>one stereo scanline · block matching in your browser</span>
        <span className="tabular-nums">
          green light left on the hull: t = {r.hullT.toFixed(2)}
        </span>
      </div>

      <div className="grid gap-4 p-4 md:grid-cols-[minmax(0,1fr)_190px]">
        <div className="min-w-0">
          <svg
            viewBox={`0 0 ${SW} ${46 + DH}`}
            role="img"
            aria-label={`Left and right scanlines under attenuation ${beta.toFixed(2)} per metre with the hull at ${hullZ.toFixed(1)} m, and the disparity each pixel was matched to. ${geomPct.toFixed(0)} percent of geometry pixels are within one pixel of the truth; ${waterPct.toFixed(0)} percent of open-water pixels are at zero disparity.`}
            className="w-full"
          >
            {(["left", "right"] as const).map((side, row) => (
              <g key={side}>
                {(side === "left" ? r.left : r.right).map((p, x) => (
                  <rect key={x} x={x * PX} y={row * 16} width={PX + 0.4} height="13" fill={rgb(p)} />
                ))}
                <text x="4" y={row * 16 + 10} fontFamily="monospace" fontSize="9" fill="white" opacity="0.85">
                  {side}
                </text>
              </g>
            ))}

            <g transform="translate(0 40)">
              <line x1="0" y1={dy(0)} x2={SW} y2={dy(0)} stroke="var(--border)" strokeWidth="1" />
              <text x={SW - 4} y={dy(0) - 3} textAnchor="end" fontFamily="monospace" fontSize="9" fill="var(--muted-foreground)">
                disparity 0
              </text>
              <text x={SW - 4} y={dy(DMAX) + 8} textAnchor="end" fontFamily="monospace" fontSize="9" fill="var(--muted-foreground)">
                {DMAX} px
              </text>
              <path d={truthPath} fill="none" stroke={TRUE} strokeWidth="1.2" strokeDasharray="3 3" />
              {r.est.map((d, x) => {
                const k = r.kind[x]
                const good = k === "water" ? d === 0 : Math.abs(d - r.truth[x]) <= 1
                const fill = k === "hidden" ? "var(--muted-foreground)" : good ? OK : BAD
                return <circle key={x} cx={(x * PX + PX / 2).toFixed(1)} cy={dy(d).toFixed(1)} r="1.4" fill={fill} />
              })}
              {[
                { x: 20, label: "water" },
                { x: 70, label: "hull" },
                { x: 115, label: "sand" },
                { x: 145, label: "water" },
              ].map((l) => (
                <text key={l.x} x={l.x * PX} y={DH - 1} textAnchor="middle" fontFamily="monospace" fontSize="9" fill="var(--muted-foreground)">
                  {l.label}
                </text>
              ))}
            </g>
          </svg>
        </div>

        <div className="flex flex-col gap-3 font-mono text-xs text-muted-foreground">
          <dl className="grid grid-cols-[1fr_auto] gap-x-2 gap-y-1 tabular-nums">
            <dt>geometry, within 1 px</dt>
            <dd className="text-right text-foreground">{geomPct.toFixed(0)}%</dd>
            <dt>water column at 0</dt>
            <dd className="text-right text-foreground">{waterPct.toFixed(0)}%</dd>
            <dt>true hull disparity</dt>
            <dd className="text-right text-foreground">{disp(hullZ).toFixed(1)} px</dd>
          </dl>
          <CostCurve label="cost at a water pixel" costs={r.vol[PROBE_WATER]} truth={0} pick={r.est[PROBE_WATER]} />
          <CostCurve label="cost at a hull pixel" costs={r.vol[PROBE_HULL]} truth={r.truth[PROBE_HULL]} pick={r.est[PROBE_HULL]} />
        </div>
      </div>

      <div className="border-t px-4 py-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <div className="mb-1 flex items-center justify-between font-mono text-xs text-muted-foreground">
              <span>attenuation β (green, per metre)</span>
              <span className="tabular-nums text-foreground">{beta.toFixed(2)}</span>
            </div>
            <Range
              min={0}
              max={1.2}
              step={0.05}
              value={beta}
              onChange={(e) => setBeta(parseFloat(e.target.value))}
              className="w-full cursor-pointer"
              aria-label="attenuation coefficient per metre"
              accent="var(--foreground)"
            />
          </div>
          <div>
            <div className="mb-1 flex items-center justify-between font-mono text-xs text-muted-foreground">
              <span>hull distance</span>
              <span className="tabular-nums text-foreground">{hullZ.toFixed(1)} m</span>
            </div>
            <Range
              min={1.5}
              max={8}
              step={0.5}
              value={hullZ}
              onChange={(e) => setHullZ(parseFloat(e.target.value))}
              className="w-full cursor-pointer"
              aria-label="distance to the hull in metres"
              accent="var(--foreground)"
            />
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2 font-mono text-xs">
          <button
            type="button"
            aria-pressed={occam}
            onClick={() => setOccam((o) => !o)}
            className={cn(
              "cursor-pointer rounded border px-2 py-1 transition-colors",
              occam ? "border-transparent bg-foreground text-background" : "text-muted-foreground hover:text-foreground"
            )}
          >
            prefer zero unless it clearly loses: {occam ? "on" : "off"}
          </button>
        </div>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Dots are the disparity each pixel matched to: green when it is right, red when it is
          not; the dashed line is the truth. Raise{" "}
          <span className="text-foreground">β</span>{" "}or push the hull back and the hull&apos;s
          texture fades into the veil, so its cost curve flattens and its dots scatter. The
          open water was never matchable: its cost curve is flat at any turbidity, and plain
          matching picks whichever disparity the noise favours, inventing geometry. The switch
          keeps zero unless another disparity beats it by a margin. That cleans the water
          column, and on the nearly textureless sand it also zeroes real geometry. That trade is
          the one the paper&apos;s numbers show.
        </p>
      </div>
    </figure>
  )
}

function CostCurve({ label, costs, truth, pick }: { label: string; costs: number[]; truth: number; pick: number }) {
  const w = 180
  const h = 54
  const finite = costs.filter((c) => Number.isFinite(c))
  const hi = Math.max(...finite, 1e-6)
  const lo = Math.min(...finite)
  const span = Math.max(hi - lo, 0.02)
  const cx = (d: number) => 4 + (d / DMAX) * (w - 8)
  const cy = (c: number) => h - 6 - ((c - lo) / span) * (h - 14)
  const path = costs
    .map((c, d) => (Number.isFinite(c) ? `${d ? "L" : "M"}${cx(d).toFixed(1)},${cy(c).toFixed(1)}` : ""))
    .join(" ")
  return (
    <div>
      <div className="mb-1">{label}</div>
      <svg viewBox={`0 0 ${w} ${h}`} role="img" aria-label={`${label}: matching cost against disparity 0 to ${DMAX}; the minimum is at ${pick}, the truth at ${truth.toFixed(1)}.`} className="w-full border">
        <line x1={cx(truth)} y1="2" x2={cx(truth)} y2={h - 2} stroke={TRUE} strokeDasharray="2 2" strokeWidth="1" />
        <path d={path} fill="none" stroke="var(--foreground)" strokeWidth="1.2" />
        <circle cx={cx(pick).toFixed(1)} cy={cy(costs[pick]).toFixed(1)} r="2.6" fill={Math.abs(pick - truth) <= 1 ? OK : BAD} />
      </svg>
    </div>
  )
}
