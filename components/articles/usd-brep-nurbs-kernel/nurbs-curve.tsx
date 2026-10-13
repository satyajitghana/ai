"use client"

import { useRef, useState } from "react"
import type { PointerEvent as ReactPointerEvent } from "react"

import { Range } from "@/components/articles/ui/range"
import { cn } from "@/lib/utils"

// A rational B-spline (NURBS) curve you can push around.
//
//   C(u) = SUM_i N_i,p(u) w_i P_i  /  SUM_i N_i,p(u) w_i
//
// Basis functions are Cox-de Boor (The NURBS Book, algorithm A2.2), the same
// recursion NLib's N_Basis* routines implement in source/SMLib/src/NL_Basis*.cpp.
// Knot insertion is Boehm's algorithm on homogeneous points (w*x, w*y, w): it
// adds a control point and leaves the curve exactly where it was, which the
// widget measures by sampling the curve before and after.
//
// Everything here is + - * / and sqrt, which are exact in IEEE 754, so server
// and client render identical coordinates. No trig is needed: the circle preset
// is the standard nine-point square with weights 1 and sqrt(1/2).

type Pt = { x: number; y: number; w: number }
type Curve = { p: number; pts: Pt[]; knots: number[] }
type PresetId = "free" | "circle" | "circle-flat"

const S2 = Math.SQRT1_2

function preset(id: PresetId): Curve {
  if (id === "free") {
    const xs = [-1.6, -1.1, -0.35, 0.3, 1.0, 1.6]
    const ys = [-0.6, 0.8, -0.9, 0.95, -0.5, 0.55]
    return {
      p: 3,
      pts: xs.map((x, i) => ({ x, y: ys[i], w: 1 })),
      knots: [0, 0, 0, 0, 1 / 3, 2 / 3, 1, 1, 1, 1],
    }
  }
  const sq = [
    [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1], [1, 0],
  ]
  return {
    p: 2,
    pts: sq.map(([x, y], i) => ({ x, y, w: id === "circle" && i % 2 === 1 ? S2 : 1 })),
    knots: [0, 0, 0, 0.25, 0.25, 0.5, 0.5, 0.75, 0.75, 1, 1, 1],
  }
}

function findSpan(U: number[], p: number, n: number, u: number) {
  if (u >= U[n + 1]) {
    let k = n
    while (k > p && U[k] >= U[k + 1]) k--
    return k
  }
  for (let k = p; k <= n; k++) if (U[k] <= u && u < U[k + 1]) return k
  return p
}

// Cox-de Boor, The NURBS Book A2.2: the p+1 nonzero basis values at u.
function basisFuns(U: number[], p: number, k: number, u: number) {
  const N = new Array(p + 1).fill(0)
  const L = new Array(p + 1).fill(0)
  const R = new Array(p + 1).fill(0)
  N[0] = 1
  for (let j = 1; j <= p; j++) {
    L[j] = u - U[k + 1 - j]
    R[j] = U[k + j] - u
    let saved = 0
    for (let r = 0; r < j; r++) {
      const t = N[r] / (R[r + 1] + L[j - r])
      N[r] = saved + R[r + 1] * t
      saved = L[j - r] * t
    }
    N[j] = saved
  }
  return N
}

function evalCurve(c: Curve, u: number) {
  const n = c.pts.length - 1
  const k = findSpan(c.knots, c.p, n, u)
  const N = basisFuns(c.knots, c.p, k, u)
  let x = 0, y = 0, w = 0
  const R: number[] = new Array(n + 1).fill(0)
  for (let j = 0; j <= c.p; j++) {
    const i = k - c.p + j
    const nw = N[j] * c.pts[i].w
    x += nw * c.pts[i].x
    y += nw * c.pts[i].y
    w += nw
    R[i] = nw
  }
  return { x: x / w, y: y / w, R: R.map((v) => v / w) }
}

// Boehm single knot insertion in homogeneous coordinates.
function insertKnot(c: Curve, ub: number): Curve | null {
  const { p, knots: U, pts } = c
  const n = pts.length - 1
  if (ub <= U[p] || ub >= U[n + 1]) return null
  const k = findSpan(U, p, n, ub)
  const s = U.filter((v) => v === ub).length
  if (s >= p) return null
  const H = pts.map((q) => ({ X: q.x * q.w, Y: q.y * q.w, W: q.w }))
  const Q: { X: number; Y: number; W: number }[] = []
  for (let i = 0; i <= n + 1; i++) {
    if (i <= k - p) Q.push(H[i])
    else if (i >= k - s + 1) Q.push(H[i - 1])
    else {
      const a = (ub - U[i]) / (U[i + p] - U[i])
      Q.push({
        X: a * H[i].X + (1 - a) * H[i - 1].X,
        Y: a * H[i].Y + (1 - a) * H[i - 1].Y,
        W: a * H[i].W + (1 - a) * H[i - 1].W,
      })
    }
  }
  const knots = [...U.slice(0, k + 1), ub, ...U.slice(k + 1)]
  return { p, knots, pts: Q.map((q) => ({ x: q.X / q.W, y: q.Y / q.W, w: q.W })) }
}

const SAMPLES = 240
const VW = 560
const VH = 300
const SCALE = 95
const X0 = VW / 2
const Y0 = 150
const sx = (x: number) => X0 + x * SCALE
const sy = (y: number) => Y0 - y * SCALE

const BW = 560
const BH = 90

const PALETTE = [
  "oklch(0.62 0.17 25)", "oklch(0.66 0.15 70)", "oklch(0.62 0.14 150)", "oklch(0.6 0.13 210)",
  "oklch(0.58 0.17 280)", "oklch(0.62 0.17 330)", "oklch(0.55 0.05 250)", "oklch(0.7 0.12 110)",
  "oklch(0.6 0.15 180)", "oklch(0.55 0.15 50)", "oklch(0.6 0.1 300)", "oklch(0.65 0.1 240)",
]

export function NurbsCurve() {
  const [presetId, setPresetId] = useState<PresetId>("free")
  const [curve, setCurve] = useState<Curve>(() => preset("free"))
  const [sel, setSel] = useState(2)
  const [insAt, setInsAt] = useState(0.5)
  const [lastShift, setLastShift] = useState<number | null>(null)
  const drag = useRef<number | null>(null)
  const svgRef = useRef<SVGSVGElement>(null)

  const n = curve.pts.length - 1
  const u0 = curve.knots[curve.p]
  const u1 = curve.knots[n + 1]
  const samples = Array.from({ length: SAMPLES + 1 }, (_, i) => evalCurve(curve, u0 + ((u1 - u0) * i) / SAMPLES))
  const path = samples.map((s, i) => `${i ? "L" : "M"}${sx(s.x).toFixed(2)},${sy(s.y).toFixed(2)}`).join(" ")
  const poly = curve.pts.map((q, i) => `${i ? "L" : "M"}${sx(q.x).toFixed(2)},${sy(q.y).toFixed(2)}`).join(" ")

  const isCircle = presetId !== "free"
  let radiusErr = 0
  if (isCircle) for (const s of samples) radiusErr = Math.max(radiusErr, Math.abs(Math.sqrt(s.x * s.x + s.y * s.y) - 1))

  const selIdx = Math.min(sel, n)
  const point = curve.pts[selIdx]

  const load = (id: PresetId) => {
    setPresetId(id)
    setCurve(preset(id))
    setSel(id === "free" ? 2 : 1)
    setLastShift(null)
  }

  const onInsert = () => {
    const next = insertKnot(curve, insAt)
    if (!next) return
    let shift = 0
    for (let i = 0; i <= 400; i++) {
      const u = u0 + ((u1 - u0) * i) / 400
      const a = evalCurve(curve, u)
      const b = evalCurve(next, u)
      shift = Math.max(shift, Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2))
    }
    setCurve(next)
    setLastShift(shift)
  }

  const toModel = (e: ReactPointerEvent) => {
    const r = svgRef.current?.getBoundingClientRect()
    if (!r) return null
    const vx = ((e.clientX - r.left) / r.width) * VW
    const vy = ((e.clientY - r.top) / r.height) * VH
    return { x: (vx - X0) / SCALE, y: (Y0 - vy) / SCALE }
  }

  const onMove = (e: ReactPointerEvent) => {
    if (drag.current === null) return
    const m = toModel(e)
    if (!m) return
    const i = drag.current
    setCurve((c) => ({
      ...c,
      pts: c.pts.map((q, j) => (j === i ? { ...q, x: Math.max(-2.8, Math.min(2.8, m.x)), y: Math.max(-1.5, Math.min(1.5, m.y)) } : q)),
    }))
    setLastShift(null)
  }

  const setWeight = (w: number) => {
    setCurve((c) => ({ ...c, pts: c.pts.map((q, j) => (j === selIdx ? { ...q, w } : q)) }))
    setLastShift(null)
  }

  // basis plot: R_i(u) for every control point
  const bx = (u: number) => 8 + ((u - u0) / (u1 - u0 || 1)) * (BW - 16)
  const by = (v: number) => BH - 8 - v * (BH - 18)
  const basisPaths = curve.pts.map((_, i) =>
    samples.map((s, k) => `${k ? "L" : "M"}${bx(u0 + ((u1 - u0) * k) / SAMPLES).toFixed(2)},${by(s.R[i]).toFixed(2)}`).join(" "),
  )

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">a NURBS curve · drag the control points</span>
        <div className="flex flex-wrap gap-1.5">
          {(
            [
              ["free", "cubic, 6 points"],
              ["circle", "circle, real weights"],
              ["circle-flat", "circle, weights = 1"],
            ] as [PresetId, string][]
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => load(id)}
              className={cn(
                "rounded-md border px-2 py-0.5 font-mono text-[11px] transition-colors",
                presetId === id ? "border-foreground/40 bg-foreground/10" : "text-muted-foreground hover:bg-muted",
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="p-3 sm:p-4">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${VW} ${VH}`}
          className="w-full touch-none select-none"
          role="img"
          aria-label="A NURBS curve with its control polygon. Control points can be dragged; the selected point's weight is set with the slider below."
          onPointerMove={onMove}
          onPointerUp={() => (drag.current = null)}
          onPointerLeave={() => (drag.current = null)}
        >
          {isCircle && (
            <circle cx={sx(0)} cy={sy(0)} r={SCALE} fill="none" stroke="currentColor" strokeOpacity={0.18} strokeDasharray="3 4" />
          )}
          <path d={poly} fill="none" stroke="currentColor" strokeOpacity={0.35} strokeDasharray="4 4" />
          <path d={path} fill="none" stroke="var(--hg-accent, oklch(0.6 0.16 250))" strokeWidth={2.6} />
          {curve.pts.map((q, i) => (
            <g key={i}>
              <circle
                cx={sx(q.x)}
                cy={sy(q.y)}
                r={i === selIdx ? 8 : 6}
                fill={PALETTE[i % PALETTE.length]}
                fillOpacity={i === selIdx ? 1 : 0.85}
                stroke={i === selIdx ? "currentColor" : "none"}
                strokeWidth={1.5}
                className="cursor-grab"
                onPointerDown={(e) => {
                  ;(e.target as Element).setPointerCapture?.(e.pointerId)
                  drag.current = i
                  setSel(i)
                }}
              />
              <text x={sx(q.x) + 9} y={sy(q.y) - 9} className="fill-muted-foreground font-mono" fontSize={10}>
                {`P${i}`}
              </text>
            </g>
          ))}
        </svg>

        <div className="mt-1">
          <div className="mb-1 font-mono text-[10px] text-muted-foreground">
            rational basis R_i(u): each control point only pulls on the curve where its own bump is nonzero
          </div>
          <svg viewBox={`0 0 ${BW} ${BH}`} className="w-full" role="img" aria-label="The rational basis functions of the curve, one per control point.">
            <line x1={8} x2={BW - 8} y1={by(0)} y2={by(0)} stroke="currentColor" strokeOpacity={0.25} />
            {basisPaths.map((d, i) => (
              <path
                key={i}
                d={d}
                fill="none"
                stroke={PALETTE[i % PALETTE.length]}
                strokeWidth={i === selIdx ? 2.6 : 1.2}
                strokeOpacity={i === selIdx ? 1 : 0.55}
              />
            ))}
            {curve.knots.map((k, i) => (
              <line key={i} x1={bx(k)} x2={bx(k)} y1={BH - 6} y2={BH - 1} stroke="currentColor" strokeOpacity={0.7} />
            ))}
          </svg>
        </div>

        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="font-mono text-[11px] text-muted-foreground">
              weight of P{selIdx}: <span className="text-foreground">{point.w.toFixed(3)}</span>
            </span>
            <Range min={0.1} max={4} step={0.01} value={point.w} onChange={(e) => setWeight(Number(e.target.value))} className="w-full" />
          </label>
          <div className="block">
            <span className="font-mono text-[11px] text-muted-foreground">
              insert a knot at u = <span className="text-foreground">{insAt.toFixed(2)}</span>
            </span>
            <div className="flex items-center gap-2">
              <Range min={0.02} max={0.98} step={0.01} value={insAt} onChange={(e) => setInsAt(Number(e.target.value))} className="w-full" />
              <button type="button" onClick={onInsert} className="shrink-0 rounded-md border px-2 py-0.5 font-mono text-[11px] hover:bg-muted">
                insert
              </button>
            </div>
          </div>
        </div>

        <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 font-mono text-[11px] sm:grid-cols-4">
          <div><dt className="text-muted-foreground">degree</dt><dd>{curve.p}</dd></div>
          <div><dt className="text-muted-foreground">control points</dt><dd>{curve.pts.length}</dd></div>
          <div><dt className="text-muted-foreground">knots</dt><dd>{curve.knots.length}</dd></div>
          <div>
            {isCircle ? (
              <>
                <dt className="text-muted-foreground">max |radius − 1|</dt>
                <dd>{radiusErr < 1e-9 ? radiusErr.toExponential(1) : radiusErr.toFixed(4)}</dd>
              </>
            ) : (
              <>
                <dt className="text-muted-foreground">last insert moved the curve</dt>
                <dd>{lastShift === null ? "—" : lastShift.toExponential(1)}</dd>
              </>
            )}
          </div>
        </dl>
        <div className="mt-2 break-all font-mono text-[10px] text-muted-foreground">
          U = [{curve.knots.map((k) => +k.toFixed(3)).join(", ")}]
          {isCircle && lastShift !== null ? ` · last insert moved the curve ${lastShift.toExponential(1)}` : ""}
        </div>
      </div>

      <figcaption className="border-t px-4 py-2.5 text-xs text-muted-foreground">
        Computed in your browser with Cox–de Boor and Boehm insertion. The circle preset is the textbook nine-point
        quadratic: with weights of 1 and √½ every sample sits on the unit circle to rounding error; set the weights to 1
        and it bulges about 6% at the diagonals. Inserting a knot adds a control point and moves the curve by rounding
        error only.
      </figcaption>
    </figure>
  )
}
