"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { mcos, mexp, mlog10, msin } from "@/lib/dmath"
import { cn } from "@/lib/utils"

// Why a highlight turns into a floater, in a 2D world you can read in full.
//
// The scene is a side view: a flat, slightly shiny surface along y = 0 built
// from seven flattened, axis-aligned anisotropic Gaussians, a point light
// overhead at (0, 1.8), and a 1D camera of 64 pixels on an arc of radius 2.2
// that always looks at the origin. Each pixel is one ray. A Gaussian's opacity
// on a ray is its peak along that ray, o * exp(-m^2 / 2) with m the smallest
// Mahalanobis distance from the ray to its centre; hits are sorted by depth and
// alpha-composited front to back, C = sum_i c_i a_i T_i with
// T_i = prod_{j<i} (1 - a_j). That is the 3DGS compositing rule; evaluating
// the peak along the ray rather than a projected 2D footprint is the ray-traced
// variant of it, which is exact enough for a toy.
//
// Ground truth adds a real reflection: at the point where the ray meets the
// surface, reflect the view direction about the normal and read a lobe
// exp(kappa * (r . l - 1)) towards the light, kappa = 60, strength 0.55.
//
// Two fits of that scene, both hand-built here, neither a trained model:
//   - "floater": the surface Gaussians keep a view-independent diffuse colour,
//     and one extra bright, semi-transparent Gaussian hangs on the 0-degree
//     camera's ray to the highlight, 0.55 above the surface. Its width (0.088)
//     and opacity (0.80) were grid-searched to best match the 0-degree view
//     only. From that view any height fits equally well once the width is
//     rescaled: one image cannot tell depth along its own rays.
//   - "specular term": the same surface Gaussians plus a deferred specular
//     lobe evaluated at the surface along the reflection direction, with a
//     deliberately wrong shape (kappa 45, strength 0.50) to stand for a learned
//     one. It is wrong in width, but it is in the right place at every angle.
//
// PSNR is over the 64 pixels x 3 channels, values in [0, 1]. Every number on
// screen is computed by this file; none is a measurement of 3DGS or DAVINCI.
// Transcendentals go through lib/dmath so server and client agree.

type RGB = [number, number, number]
type Vec = [number, number]

type Gauss = {
  id: string
  mx: number
  my: number
  sx: number
  sy: number
  o: number
  c: RGB
  surface: boolean
}

type Mode = "floater" | "specular"

const DEG = Math.PI / 180
const RADIUS = 2.2
const LIGHT: Vec = [0, 1.8]
const PIXELS = 64
const TAN_H = 1.15 / RADIUS // the 0-degree view spans x in [-1.15, 1.15]
const SURFACE_HALF = 1.05

const BG: RGB = [0.08, 0.08, 0.1]
const DIFFUSE: RGB = [0.3, 0.38, 0.52]

const TRUE_KAPPA = 60
const TRUE_KS = 0.55
const FIT_KAPPA = 45
const FIT_KS = 0.5

const FLOATER: Gauss = {
  id: "floater",
  mx: 0,
  my: 0.55,
  sx: 0.088,
  sy: 0.28,
  o: 0.8,
  c: [1, 1, 1],
  surface: false,
}

const SURFACE: Gauss[] = [-3, -2, -1, 0, 1, 2, 3].map((k) => ({
  id: `surface ${k + 4}`,
  mx: k * 0.3,
  my: 0,
  sx: 0.17,
  sy: 0.02,
  o: 0.9,
  c: DIFFUSE,
  surface: true,
}))

type Cam = { o: Vec; f: Vec; r: Vec }

function camera(theta: number): Cam {
  const s = msin(theta * DEG)
  const c = mcos(theta * DEG)
  return { o: [RADIUS * s, RADIUS * c], f: [-s, -c], r: [c, -s] }
}

function rayDir(cam: Cam, i: number): Vec {
  const u = -1 + (2 * (i + 0.5)) / PIXELS
  const x = cam.f[0] + u * TAN_H * cam.r[0]
  const y = cam.f[1] + u * TAN_H * cam.r[1]
  const n = Math.sqrt(x * x + y * y)
  return [x / n, y / n]
}

type Hit = { g: Gauss; t: number; a: number }

function hit(g: Gauss, o: Vec, d: Vec): Hit {
  const dx = g.mx - o[0]
  const dy = g.my - o[1]
  const ix = 1 / (g.sx * g.sx)
  const iy = 1 / (g.sy * g.sy)
  const a = d[0] * d[0] * ix + d[1] * d[1] * iy
  const b = d[0] * dx * ix + d[1] * dy * iy
  const cc = dx * dx * ix + dy * dy * iy
  const m2 = cc - (b * b) / a
  return { g, t: b / a, a: Math.min(0.99, g.o * mexp(-0.5 * m2)) }
}

// Reflection lobe at the point where the ray meets y = 0.
function lobe(o: Vec, d: Vec, kappa: number): number {
  if (d[1] >= 0) return 0
  const x = o[0] - (o[1] * d[0]) / d[1]
  if (Math.abs(x) > SURFACE_HALF) return 0
  const lx = LIGHT[0] - x
  const ly = LIGHT[1]
  const n = Math.sqrt(lx * lx + ly * ly)
  const dot = (d[0] * lx - d[1] * ly) / n // reflected ray (d.x, -d.y) . l
  return mexp(kappa * (dot - 1))
}

type Row = { label: string; t: number | null; a: number | null; T: number | null; adds: number }
type Pixel = { c: RGB; rows: Row[] }

const lum = (c: RGB) => (c[0] + c[1] + c[2]) / 3

function shade(theta: number, model: "truth" | "bare" | Mode, i: number): Pixel {
  const cam = camera(theta)
  const d = rayDir(cam, i)
  const scene = model === "floater" ? [...SURFACE, FLOATER] : SURFACE
  const hits = scene
    .map((g) => hit(g, cam.o, d))
    .filter((h) => h.t > 0 && h.a > 1 / 255)
    .sort((p, q) => p.t - q.t)

  const c: RGB = [0, 0, 0]
  const rows: Row[] = []
  let T = 1
  let Tsurf = 1
  for (const h of hits) {
    const add = T * h.a
    c[0] += add * h.g.c[0]
    c[1] += add * h.g.c[1]
    c[2] += add * h.g.c[2]
    rows.push({ label: h.g.id, t: h.t, a: h.a, T, adds: add * lum(h.g.c) })
    T *= 1 - h.a
    if (h.g.surface) Tsurf *= 1 - h.a
  }
  c[0] += T * BG[0]
  c[1] += T * BG[1]
  c[2] += T * BG[2]
  rows.push({ label: "background", t: null, a: null, T, adds: T * lum(BG) })

  const spec =
    model === "truth"
      ? TRUE_KS * lobe(cam.o, d, TRUE_KAPPA)
      : model === "specular"
        ? FIT_KS * lobe(cam.o, d, FIT_KAPPA)
        : 0
  if (spec > 0) {
    const add = (1 - Tsurf) * spec
    c[0] += add
    c[1] += add
    c[2] += add
    rows.push({ label: "specular term", t: null, a: null, T: null, adds: add })
  }
  return { c: [Math.min(1, c[0]), Math.min(1, c[1]), Math.min(1, c[2])], rows }
}

function image(theta: number, model: "truth" | "bare" | Mode): Pixel[] {
  return Array.from({ length: PIXELS }, (_, i) => shade(theta, model, i))
}

function psnr(a: Pixel[], b: Pixel[]): number {
  let mse = 0
  for (let i = 0; i < a.length; i++) {
    for (let k = 0; k < 3; k++) mse += (a[i].c[k] - b[i].c[k]) ** 2
  }
  mse /= a.length * 3
  return Math.min(60, 10 * mlog10(1 / Math.max(mse, 1e-12)))
}

// PSNR against the true image over the whole arc, computed once.
const SWEEP = Array.from({ length: 41 }, (_, k) => {
  const theta = -40 + 2 * k
  const truth = image(theta, "truth")
  return {
    theta,
    floater: psnr(image(theta, "floater"), truth),
    specular: psnr(image(theta, "specular"), truth),
    bare: psnr(image(theta, "bare"), truth),
  }
})

// ---- drawing ----------------------------------------------------------------

const W = 700
const H = 476
const S = 96
const SX = (x: number) => 16 + (x + 1.95) * S
const SY = (y: number) => 46 + (2.4 - y) * S

const FLOAT_C = "oklch(0.72 0.16 70)"
const SPEC_C = "oklch(0.62 0.15 250)"
const TRUE_C = "oklch(0.62 0.16 150)"
const ERR_C = "oklch(0.62 0.21 27)"

const rgb = (c: RGB) =>
  `rgb(${Math.round(c[0] * 255)},${Math.round(c[1] * 255)},${Math.round(c[2] * 255)})`

const CH_X = 432
const CH_W = 244
const CH_Y = 46
const CH_H = 118
const PMIN = 8
const PMAX = 40
const CX = (theta: number) => CH_X + ((theta + 40) / 80) * CH_W
const CY = (p: number) => CH_Y + CH_H - ((Math.min(PMAX, Math.max(PMIN, p)) - PMIN) / (PMAX - PMIN)) * CH_H

function line(key: "floater" | "specular" | "bare"): string {
  return SWEEP.map((s, i) => `${i ? "L" : "M"}${CX(s.theta).toFixed(1)},${CY(s[key]).toFixed(1)}`).join(" ")
}

const STRIP_X = 100
const CELL = 9

export function FloaterToy() {
  const [theta, setTheta] = useState(20)
  const [mode, setMode] = useState<Mode>("floater")

  const truth = image(theta, "truth")
  const model = image(theta, mode)
  const score = psnr(model, truth)
  const bare = psnr(image(theta, "bare"), truth)

  const brightest = model.reduce((bi, p, i, arr) => (lum(p.c) > lum(arr[bi].c) ? i : bi), 0)
  const inspected = model[brightest]
  // Hits that add nothing visible (alpha under 0.01) are composited but not listed.
  const shown = inspected.rows.filter((r) => r.a === null || r.a >= 0.01)
  const truthThere = truth[brightest]

  const cam = camera(theta)
  // Where the real reflection is: the ray to the light's mirror image (0, -1.8).
  const xTrue = (cam.o[0] * LIGHT[1]) / (cam.o[1] + LIGHT[1])
  // Where the floater lands: the ray through its centre, continued to y = 0.
  const xFloat = (-cam.o[0] * FLOATER.my) / (cam.o[1] - FLOATER.my)

  const accent = mode === "floater" ? FLOAT_C : SPEC_C
  const camTip = (c: Cam, size: number) => {
    const p = [
      [c.o[0] + c.f[0] * size, c.o[1] + c.f[1] * size],
      [c.o[0] - c.r[0] * size * 0.6, c.o[1] - c.r[1] * size * 0.6],
      [c.o[0] + c.r[0] * size * 0.6, c.o[1] + c.r[1] * size * 0.6],
    ]
    return p.map(([x, y]) => `${SX(x).toFixed(1)},${SY(y).toFixed(1)}`).join(" ")
  }
  const fit = camera(0)
  const arcA = camera(-40).o
  const arcB = camera(40).o

  const desc =
    `Side view of a shiny surface made of seven flat Gaussians, a light overhead and a camera at ${theta} degrees. ` +
    `In ${mode === "floater" ? "floater" : "specular-term"} mode the 64-pixel render scores ${score.toFixed(1)} dB PSNR against the true image; ` +
    `drawing no highlight at all scores ${bare.toFixed(1)} dB. ` +
    (mode === "floater"
      ? `The floater was fitted at 0 degrees; at ${theta} degrees its bright spot lands at x ${xFloat.toFixed(2)} while the real reflection is at x ${xTrue.toFixed(2)}.`
      : `The specular term is read along the reflection direction, so its highlight sits at x ${xTrue.toFixed(2)}, where the real one is.`)

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/20 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>a highlight, explained two ways</span>
        <span className="text-muted-foreground/60">2D toy · all numbers computed here</span>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 pt-3">
        <label className="flex min-w-[220px] flex-1 items-center gap-3 font-mono text-[11px] text-muted-foreground">
          <span className="w-[74px] shrink-0">camera {theta > 0 ? "+" : ""}{theta}°</span>
          <Range
            min={-40}
            max={40}
            step={1}
            value={theta}
            onChange={(e) => setTheta(Number(e.target.value))}
            accent={accent}
            aria-label="Camera angle in degrees"
            className="flex-1"
          />
        </label>
        <div className="flex gap-1.5">
          {(
            [
              ["floater", "splats + floater"],
              ["specular", "splats + specular term"],
            ] as const
          ).map(([m, label]) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              aria-pressed={mode === m}
              className={cn(
                "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
                mode === m
                  ? "border-foreground/30 bg-muted/50 text-foreground"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto p-4 sm:p-5">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full min-w-[620px]" role="img" aria-label={desc}>
          {/* ---- side view ------------------------------------------------ */}
          <text x={16} y={22} className="fill-foreground font-mono" fontSize={10.5}>
            side view · one camera, 64 rays
          </text>

          <path
            d={`M${SX(arcA[0]).toFixed(1)},${SY(arcA[1]).toFixed(1)} A${(RADIUS * S).toFixed(1)},${(RADIUS * S).toFixed(1)} 0 0 1 ${SX(arcB[0]).toFixed(1)},${SY(arcB[1]).toFixed(1)}`}
            fill="none"
            stroke="currentColor"
            className="text-muted-foreground"
            strokeOpacity={0.35}
            strokeDasharray="3 4"
          />

          {/* the 0-degree view the floater was fitted to */}
          <polygon points={camTip(fit, 0.13)} fill="none" stroke="currentColor" className="text-muted-foreground" strokeOpacity={0.6} />
          <text x={SX(0) + 12} y={SY(RADIUS) - 4} className="fill-muted-foreground font-mono" fontSize={8.5}>
            fit view, 0°
          </text>

          {/* light and its mirror path to the true highlight */}
          <circle cx={SX(LIGHT[0])} cy={SY(LIGHT[1])} r={5} fill="oklch(0.9 0.14 95)" stroke="oklch(0.7 0.14 80)" />
          <text x={SX(LIGHT[0]) + 9} y={SY(LIGHT[1]) + 3} className="fill-muted-foreground font-mono" fontSize={8.5}>
            light
          </text>
          <line
            x1={SX(LIGHT[0])}
            y1={SY(LIGHT[1])}
            x2={SX(xTrue)}
            y2={SY(0)}
            stroke={TRUE_C}
            strokeOpacity={0.6}
            strokeDasharray="2 3"
          />
          <line
            x1={SX(cam.o[0])}
            y1={SY(cam.o[1])}
            x2={SX(xTrue)}
            y2={SY(0)}
            stroke={TRUE_C}
            strokeWidth={1.2}
            strokeDasharray="5 3"
          />

          {/* the model's brightest ray */}
          {mode === "floater" ? (
            <line
              x1={SX(cam.o[0])}
              y1={SY(cam.o[1])}
              x2={SX(xFloat)}
              y2={SY(0)}
              stroke={FLOAT_C}
              strokeWidth={1.4}
            />
          ) : null}

          {/* surface Gaussians, drawn at 2 sigma */}
          {SURFACE.map((g) => (
            <ellipse
              key={g.id}
              cx={SX(g.mx)}
              cy={SY(g.my)}
              rx={2 * g.sx * S}
              ry={Math.max(2.5, 2 * g.sy * S)}
              fill={rgb(DIFFUSE)}
              fillOpacity={0.55}
              stroke={rgb(DIFFUSE)}
              strokeOpacity={0.9}
            />
          ))}
          {mode === "floater" ? (
            <ellipse
              cx={SX(FLOATER.mx)}
              cy={SY(FLOATER.my)}
              rx={2 * FLOATER.sx * S}
              ry={2 * FLOATER.sy * S}
              fill="oklch(0.97 0.03 90)"
              fillOpacity={0.85}
              stroke={FLOAT_C}
              strokeWidth={1.2}
            />
          ) : null}
          {mode === "floater" ? (
            <text
              x={SX(FLOATER.mx) - 2 * FLOATER.sx * S - 6}
              y={SY(FLOATER.my) + 3}
              textAnchor="end"
              fill={FLOAT_C}
              className="font-mono"
              fontSize={9}
            >
              floater
            </text>
          ) : null}

          {/* markers on the surface */}
          <line x1={SX(xTrue)} x2={SX(xTrue)} y1={SY(0) + 6} y2={SY(0) + 16} stroke={TRUE_C} strokeWidth={2} />
          <text x={SX(xTrue)} y={SY(0) + 28} textAnchor="middle" fill={TRUE_C} className="font-mono" fontSize={8.5}>
            real reflection
          </text>
          {mode === "floater" && Math.abs(xFloat - xTrue) > 0.05 ? (
            <>
              <line x1={SX(xFloat)} x2={SX(xFloat)} y1={SY(0) + 6} y2={SY(0) + 16} stroke={FLOAT_C} strokeWidth={2} />
              <text x={SX(xFloat)} y={SY(0) + 40} textAnchor="middle" fill={FLOAT_C} className="font-mono" fontSize={8.5}>
                floater lands
              </text>
            </>
          ) : null}

          <polygon points={camTip(cam, 0.15)} fill={accent} stroke={accent} />
          <text
            x={SX(cam.o[0]) + (theta >= 0 ? 12 : -12)}
            y={SY(cam.o[1]) - 8}
            textAnchor={theta >= 0 ? "start" : "end"}
            className="fill-foreground font-mono"
            fontSize={9}
          >
            camera {theta}°
          </text>

          {/* ---- PSNR over the arc ---------------------------------------- */}
          <text x={CH_X - 12} y={22} className="fill-foreground font-mono" fontSize={10.5}>
            PSNR vs true image, every angle
          </text>
          {[10, 20, 30, 40].map((p) => (
            <g key={p}>
              <line x1={CH_X} x2={CH_X + CH_W} y1={CY(p)} y2={CY(p)} stroke="currentColor" className="text-border" />
              <text x={CH_X - 4} y={CY(p) + 3} textAnchor="end" className="fill-muted-foreground font-mono" fontSize={8}>
                {p}
              </text>
            </g>
          ))}
          {[-40, 0, 40].map((t) => (
            <text key={t} x={CX(t)} y={CH_Y + CH_H + 12} textAnchor="middle" className="fill-muted-foreground font-mono" fontSize={8}>
              {t}°
            </text>
          ))}
          <path d={line("bare")} fill="none" stroke="currentColor" className="text-muted-foreground" strokeDasharray="3 3" />
          <path d={line("floater")} fill="none" stroke={FLOAT_C} strokeWidth={mode === "floater" ? 2 : 1.2} />
          <path d={line("specular")} fill="none" stroke={SPEC_C} strokeWidth={mode === "specular" ? 2 : 1.2} />
          <line x1={CX(theta)} x2={CX(theta)} y1={CH_Y} y2={CH_Y + CH_H} stroke="currentColor" className="text-foreground" strokeOpacity={0.4} />
          <circle cx={CX(theta)} cy={CY(score)} r={3.5} fill={accent} />
          <text x={CH_X + CH_W} y={CY(SWEEP[40].specular) - 8} textAnchor="end" fill={SPEC_C} className="font-mono" fontSize={8.5}>
            specular term
          </text>
          <text x={CH_X + CH_W} y={CY(SWEEP[40].bare) - 5} textAnchor="end" className="fill-muted-foreground font-mono" fontSize={8.5}>
            no highlight
          </text>
          <text x={CH_X + CH_W} y={CY(SWEEP[40].floater) + 12} textAnchor="end" fill={FLOAT_C} className="font-mono" fontSize={8.5}>
            floater
          </text>

          {/* ---- one ray, composited ------------------------------------ */}
          <text x={CH_X - 12} y={CH_Y + CH_H + 36} className="fill-foreground font-mono" fontSize={10}>
            brightest pixel ({brightest}), front to back
          </text>
          {["hit", "depth", "α", "T", "adds"].map((h, k) => (
            <text
              key={h}
              x={[CH_X - 12, CH_X + 96, CH_X + 142, CH_X + 188, CH_X + CH_W][k]}
              y={CH_Y + CH_H + 52}
              textAnchor={k === 0 ? "start" : "end"}
              className="fill-muted-foreground font-mono"
              fontSize={8.5}
            >
              {h}
            </text>
          ))}
          {shown.slice(0, 6).map((r, k) => {
            const y = CH_Y + CH_H + 66 + k * 13
            const tone = r.label === "floater" ? FLOAT_C : r.label === "specular term" ? SPEC_C : undefined
            return (
              <g key={r.label} className="font-mono" fontSize={8.5}>
                <text x={CH_X - 12} y={y} fill={tone} className={tone ? undefined : "fill-foreground"}>
                  {r.label}
                </text>
                <text x={CH_X + 96} y={y} textAnchor="end" className="fill-muted-foreground">
                  {r.t === null ? "" : r.t.toFixed(2)}
                </text>
                <text x={CH_X + 142} y={y} textAnchor="end" className="fill-muted-foreground">
                  {r.a === null ? "" : r.a.toFixed(2)}
                </text>
                <text x={CH_X + 188} y={y} textAnchor="end" className="fill-muted-foreground">
                  {r.T === null ? "" : r.T.toFixed(2)}
                </text>
                <text x={CH_X + CH_W} y={y} textAnchor="end" fill={tone} className={tone ? undefined : "fill-foreground"}>
                  +{r.adds.toFixed(3)}
                </text>
              </g>
            )
          })}
          <text x={CH_X - 12} y={CH_Y + CH_H + 66 + 6 * 13 + 4} className="fill-muted-foreground font-mono" fontSize={8.5}>
            grey level {lum(inspected.c).toFixed(2)} here; truth is {lum(truthThere.c).toFixed(2)}
          </text>

          {/* ---- the images --------------------------------------------- */}
          {[
            { label: "true image", px: truth, y: 360 },
            { label: "splat render", px: model, y: 384 },
          ].map((row) => (
            <g key={row.label}>
              <text x={16} y={row.y + 11} className="fill-muted-foreground font-mono" fontSize={9}>
                {row.label}
              </text>
              {row.px.map((p, i) => (
                <rect key={i} x={STRIP_X + i * CELL} y={row.y} width={CELL} height={18} fill={rgb(p.c)} />
              ))}
            </g>
          ))}
          <text x={16} y={419} className="fill-muted-foreground font-mono" fontSize={9}>
            |error|
          </text>
          <rect x={STRIP_X} y={408} width={PIXELS * CELL} height={14} fill="currentColor" className="text-muted/40" />
          {model.map((p, i) => {
            const e = (Math.abs(p.c[0] - truth[i].c[0]) + Math.abs(p.c[1] - truth[i].c[1]) + Math.abs(p.c[2] - truth[i].c[2])) / 3
            return <rect key={i} x={STRIP_X + i * CELL} y={408} width={CELL} height={14} fill={ERR_C} fillOpacity={Math.min(1, e * 2.5)} />
          })}
          <rect
            x={STRIP_X + brightest * CELL}
            y={382}
            width={CELL}
            height={22}
            fill="none"
            stroke="currentColor"
            className="text-foreground"
            strokeWidth={1.2}
          />

          <text x={16} y={448} className="fill-foreground font-mono" fontSize={10}>
            {mode === "floater" ? "splats + floater" : "splats + specular term"}: {score.toFixed(1)} dB
          </text>
          <text x={250} y={448} className="fill-muted-foreground font-mono" fontSize={9}>
            no highlight at all: {bare.toFixed(1)} dB · toy numbers, not a benchmark
          </text>
          <text x={16} y={466} className="fill-muted-foreground font-mono" fontSize={8.5}>
            the floater was fitted to the 0° view only; the specular lobe is deliberately the wrong width (κ {FIT_KAPPA} vs {TRUE_KAPPA})
          </text>
        </svg>
      </div>
    </figure>
  )
}
