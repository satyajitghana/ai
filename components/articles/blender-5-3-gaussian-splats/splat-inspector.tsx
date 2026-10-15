"use client"

// One real Gaussian, as a 3DGS .ply stores it, and what Blender 5.3's PLY
// importer and its renderers turn it into. The raw numbers are vertex 542,403
// of the bonsai scene's point_cloud.ply (iteration 30,000) from the
// dylanebert/3dgs dataset on Hugging Face, read with an HTTP range request
// (MEASURED). Each toggle is one conversion the Blender source applies:
//
//   exp scale       io/common/IO_gsplat.hh  OriginalActivationFunctions::decode_scale
//   sigmoid opacity                         OriginalActivationFunctions::decode_opacity
//   normalize quat  io/ply/importer/ply_import_gsplat.cc  math::normalize(...)
//   DC to colour    cycles/kernel/geom/gsplat.h  0.2821 * dc + 0.5, then sRGB to linear
//   axes            PLY import Forward = Z, Up = -Y (an object matrix; the default is Y / Z)
//
// The preview is Blender's front view (X right, Z up) of the splat's 3D
// covariance R S S^T R^T, projected orthographically, drawn at 1, 2 and 3
// sigma, plus the bounding sphere Cycles puts in its BVH: radius
// max(scale) * sqrt(2 ln(opacity / 0.01)) (cycles/scene/pointcloud.cpp).
// Transcendentals go through lib/dmath so SSR and the browser agree.

import { useState } from "react"

import { cn } from "@/lib/utils"
import { matan2, mexp, mlog, mpow } from "@/lib/dmath"

const RAW = {
  pos: [-7.430241584777832, 5.856269359588623, 5.408324241638184],
  dc: [0.0863225981593132, 0.5849270224571228, 1.0180517435073853],
  opacity: 2.019695997238159,
  scale: [-4.929684638977051, -6.339308738708496, -4.769834041595459],
  rot: [0.8888447880744934, 0.29671257734298706, -0.3158950209617615, -0.36593785881996155], // w, x, y, z
} as const

const C0 = 0.28209479177387814
const ALPHA_MIN = 0.01 // Cycles: minimum response the bounding sphere must capture

type Key = "exp" | "sig" | "norm" | "dc" | "axes"
const TOGGLES: { k: Key; label: string }[] = [
  { k: "exp", label: "exp(scale)" },
  { k: "sig", label: "sigmoid(opacity)" },
  { k: "norm", label: "normalize rotation" },
  { k: "dc", label: "SH DC to colour" },
  { k: "axes", label: "Z fwd, -Y up" },
]

const f = (v: number, d = 4) => (Number.isFinite(v) ? v.toFixed(d) : "—")
const clamp01 = (v: number) => Math.min(1, Math.max(0, v))
const srgbToLinear = (c: number) => (c <= 0.04045 ? c / 12.92 : mpow((c + 0.055) / 1.055, 2.4))

type M3 = number[][]
const mul = (a: M3, b: M3): M3 => a.map((r) => [0, 1, 2].map((j) => r[0] * b[0][j] + r[1] * b[1][j] + r[2] * b[2][j]))
const tr = (a: M3): M3 => [0, 1, 2].map((i) => [a[0][i], a[1][i], a[2][i]])

// Quaternion (w, x, y, z) to matrix, the textbook formula that assumes |q| = 1.
// Fed an un-normalized q it is no longer a rotation, which is the point of the toggle.
function quatToMat(w: number, x: number, y: number, z: number): M3 {
  return [
    [1 - 2 * (y * y + z * z), 2 * (x * y - w * z), 2 * (x * z + w * y)],
    [2 * (x * y + w * z), 1 - 2 * (x * x + z * z), 2 * (y * z - w * x)],
    [2 * (x * z - w * y), 2 * (y * z + w * x), 1 - 2 * (x * x + y * y)],
  ]
}

// File axes to Blender axes for Forward = Z, Up = -Y: (x, y, z) -> (x, z, -y).
const AXES: M3 = [
  [1, 0, 0],
  [0, 0, 1],
  [0, -1, 0],
]
const ID: M3 = [
  [1, 0, 0],
  [0, 1, 0],
  [0, 0, 1],
]

const W = 300
const H = 300
const VIEW_M = 0.06 // the preview window is 6 cm across
const PX_PER_M = W / VIEW_M

export function SplatInspector() {
  const [on, setOn] = useState<Record<Key, boolean>>({ exp: true, sig: true, norm: true, dc: true, axes: true })
  const flip = (k: Key) => setOn((s) => ({ ...s, [k]: !s[k] }))

  const scale = RAW.scale.map((v) => (on.exp ? mexp(v) : v))
  const opacity = on.sig ? clamp01(1 / (1 + mexp(-RAW.opacity))) : RAW.opacity
  const qn = Math.sqrt(RAW.rot.reduce((a, v) => a + v * v, 0))
  const q = RAW.rot.map((v) => (on.norm ? v / qn : v))
  const srgb = RAW.dc.map((v) => (on.dc ? C0 * v + 0.5 : v))
  const lin = srgb.map((c) => srgbToLinear(clamp01(c)))
  const A = on.axes ? AXES : ID
  const pos = [0, 1, 2].map((i) => A[i][0] * RAW.pos[0] + A[i][1] * RAW.pos[1] + A[i][2] * RAW.pos[2])

  // Covariance in Blender space: A R S^2 R^T A^T.
  const R = quatToMat(q[0], q[1], q[2], q[3])
  const S2: M3 = [
    [scale[0] * scale[0], 0, 0],
    [0, scale[1] * scale[1], 0],
    [0, 0, scale[2] * scale[2]],
  ]
  const sigma = mul(mul(A, mul(mul(R, S2), tr(R))), tr(A))
  // Front view: screen x = X, screen up = Z.
  const a = sigma[0][0]
  const b = sigma[0][2]
  const c = sigma[2][2]
  const mid = (a + c) / 2
  const rad = Math.sqrt(((a - c) / 2) * ((a - c) / 2) + b * b)
  const l1 = mid + rad
  const l2 = Math.max(mid - rad, 0)
  const angle = (matan2(2 * b, a - c) / 2) * (180 / Math.PI)
  const r1 = Math.sqrt(l1) // 1-sigma semi-axes in metres
  const r2 = Math.sqrt(l2)

  const k = opacity > ALPHA_MIN ? Math.sqrt(2 * mlog(opacity / ALPHA_MIN)) : 0
  const bound = k * Math.max(...scale.map(Math.abs))
  const fill = `rgb(${srgb.map((v) => Math.round(clamp01(v) * 255)).join(",")})`
  const alpha = clamp01(opacity)
  const overflow = 3 * r1 * PX_PER_M > W

  const rows: { name: string; raw: string; out: string; note: string }[] = [
    {
      name: "position",
      raw: RAW.pos.map((v) => f(v, 3)).join(", "),
      out: pos.map((v) => f(v, 3)).join(", "),
      note: on.axes ? "object matrix: (x, z, -y)" : "default import: Y fwd, Z up, unchanged",
    },
    {
      name: "scale",
      raw: RAW.scale.map((v) => f(v, 3)).join(", "),
      out: scale.map((v) => (on.exp ? `${f(v * 1000, 2)} mm` : f(v, 3))).join(", "),
      note: on.exp ? "exp(): log-scale to metres" : "log values read as metres",
    },
    {
      name: "rotation",
      raw: RAW.rot.map((v) => f(v, 3)).join(", "),
      out: q.map((v) => f(v, 3)).join(", "),
      note: on.norm ? `divided by |q| = ${f(qn, 3)}` : `|q| = ${f(qn, 3)}, not a rotation`,
    },
    {
      name: "radiance:base.w",
      raw: f(RAW.opacity, 3),
      out: f(opacity, 3),
      note: on.sig ? "sigmoid(): logit to opacity" : "logit read as opacity",
    },
    {
      name: "radiance:base.rgb",
      raw: RAW.dc.map((v) => f(v, 3)).join(", "),
      out: srgb.map((v) => f(v, 3)).join(", "),
      note: on.dc ? `sRGB; linear ${lin.map((v) => f(v, 3)).join(", ")}` : "SH coefficients, not colours",
    },
  ]

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/20 to-transparent">
      <div className="flex items-center justify-between border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>one splat, PLY to Blender</span>
        <span className="text-muted-foreground/60">bonsai vertex 542,403, measured</span>
      </div>
      <div className="p-4 sm:p-5">
        <div className="flex flex-wrap gap-1.5">
          {TOGGLES.map(({ k: kk, label }) => (
            <button
              key={kk}
              type="button"
              onClick={() => flip(kk)}
              aria-pressed={on[kk]}
              className={cn(
                "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
                on[kk]
                  ? "border-foreground/30 bg-muted/50 text-foreground"
                  : "border-border text-muted-foreground line-through hover:text-foreground",
              )}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-[1fr_300px]">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[420px] border-collapse font-mono text-[11px]">
              <thead>
                <tr className="text-left text-muted-foreground">
                  <th className="py-1 pr-2 font-normal">attribute</th>
                  <th className="py-1 pr-2 font-normal">in the .ply</th>
                  <th className="py-1 font-normal">in Blender</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.name} className="border-t align-top">
                    <td className="py-1.5 pr-2 text-foreground">{r.name}</td>
                    <td className="py-1.5 pr-2 text-muted-foreground">{r.raw}</td>
                    <td className="py-1.5">
                      <div className="text-foreground">{r.out}</div>
                      <div className="text-[10px] text-muted-foreground/80">{r.note}</div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div>
            <svg viewBox={`0 0 ${W} ${H}`} className="w-full rounded-lg border bg-background" role="img">
              <title>
                {`Front view of the splat in a 6 cm window. One-sigma semi-axes ${f(r1 * 1000, 2)} mm and ${f(r2 * 1000, 2)} mm; Cycles bounding sphere radius ${f(bound * 1000, 1)} mm at ${f(k, 2)} sigma.`}
              </title>
              {[0.25, 0.5, 0.75].map((t) => (
                <g key={t} className="text-border">
                  <line x1={W * t} y1={0} x2={W * t} y2={H} stroke="currentColor" strokeOpacity={0.5} />
                  <line x1={0} y1={H * t} x2={W} y2={H * t} stroke="currentColor" strokeOpacity={0.5} />
                </g>
              ))}
              <g transform={`translate(${W / 2} ${H / 2}) rotate(${-angle})`}>
                {[3, 2, 1].map((s) => (
                  <ellipse
                    key={s}
                    rx={Math.max(r1 * s * PX_PER_M, 0.5)}
                    ry={Math.max(r2 * s * PX_PER_M, 0.5)}
                    fill={fill}
                    fillOpacity={alpha * (s === 1 ? 0.6 : s === 2 ? 0.3 : 0.12)}
                    stroke={fill}
                    strokeOpacity={0.9}
                    strokeWidth={0.8}
                  />
                ))}
              </g>
              <circle
                cx={W / 2}
                cy={H / 2}
                r={Math.max(bound * PX_PER_M, 0.5)}
                fill="none"
                className="stroke-foreground"
                strokeOpacity={0.55}
                strokeDasharray="4 3"
              />
              <text x={8} y={16} fontSize={10} className="fill-muted-foreground font-mono">
                front view (X right, Z up), 6 cm
              </text>
              <text x={8} y={H - 22} fontSize={10} className="fill-foreground font-mono">
                {`1σ: ${f(r1 * 1000, 2)} x ${f(r2 * 1000, 2)} mm`}
              </text>
              <text x={8} y={H - 8} fontSize={10} className="fill-muted-foreground font-mono">
                {`dashed: Cycles bound, ${f(k, 2)}σ = ${f(bound * 1000, 1)} mm`}
              </text>
              {overflow ? (
                <text x={W / 2} y={34} fontSize={10} textAnchor="middle" className="fill-foreground font-mono">
                  {`${f(r1, 2)} m semi-axis: fills the room`}
                </text>
              ) : null}
            </svg>
          </div>
        </div>

        <p className="mt-3 font-mono text-[11px] leading-relaxed text-muted-foreground">
          Untick a conversion to see what happens without it. Without{" "}
          <span className="text-foreground">exp</span> the stored log-scales read as metres and the
          splat swells from millimetres to metres. Without{" "}
          <span className="text-foreground">sigmoid</span> the opacity is a logit past 1. The
          rotation as stored has length {f(qn, 3)}, so it skews the splat until it is normalized.
          The raw f_dc values are spherical-harmonic coefficients, not colours: Blender multiplies by
          0.2821 and adds 0.5.
        </p>
      </div>
    </figure>
  )
}
