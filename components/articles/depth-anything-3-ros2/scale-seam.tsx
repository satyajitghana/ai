"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { matan } from "@/lib/dmath"

// The seam, drawn. A single camera ray bundle fixes the *shape* of the scene and
// nothing about its size: a 2.4 m post at 8 m and a 4.8 m post at 16 m land on
// exactly the same pixels. Monocular depth inherits that ambiguity, so a network
// that emits "depth" has to be emitting it in some assumed unit.
//
// Depth Anything 3's metric checkpoint assumes a focal length of 300 px in its
// own input grid — that is the `scale_factor: float = 300.0` in
// depth_anything_3/utils/alignment.py:118. The ROS node closes the loop by
// multiplying by the real camera's focal, scaled to that grid, over 300
// (tensorrt_depth_anything.cpp:360). Drag the focal and watch the published
// metres move while the picture does not.
//
// Geometry note: the cone half-angle is a fixed ratio of viewBox units, so every
// coordinate here is exact integer/rational arithmetic. The only transcendental
// is the horizontal field of view readout, which goes through lib/dmath.

const W = 720
const H = 300
const APEX_X = 70
const AXIS_Y = 150
const FAR_X = 690
const HALF_RISE = 96 // cone half-height at FAR_X
const SLOPE = HALF_RISE / (FAR_X - APEX_X)

// depth axis: metres -> svg x
const Z_MIN = 3
const Z_MAX = 26
const X_AT_ZMIN = 200
const X_AT_ZMAX = 660
const zToX = (z: number) =>
  X_AT_ZMIN + ((z - Z_MIN) / (Z_MAX - Z_MIN)) * (X_AT_ZMAX - X_AT_ZMIN)

// The model's raw output for this pixel, in its own focal-normalised unit.
// Unitless by construction: it only becomes metres once a focal is chosen.
const D_NORM = 8

const MODEL_W = 504 // the engine's input width, in pixels
const REF_FOCAL = 300 // DA3's scale_factor

const PRESETS = [
  { label: "300 px — DA3's own reference", f: 300 },
  { label: "261 px — 1920×1080, fx = 1000", f: 261 },
  { label: "434 px — 1920×1080, 60° lens", f: 434 },
  { label: "175 px — wide 1920×1080, fx = 670", f: 175 },
]

const fmt = (x: number, d = 2) => x.toFixed(d)

export function ScaleSeam() {
  const [f, setF] = useState(300)

  const metres = (D_NORM * f) / REF_FOCAL
  const zClamped = Math.min(Math.max(metres, Z_MIN), Z_MAX)
  const objX = zToX(zClamped)
  const objHalf = SLOPE * (objX - APEX_X)
  const offScale = metres > Z_MAX || metres < Z_MIN

  // Physical height of the thing that fills the cone at this distance. The cone
  // is a fixed angular wedge, so height grows linearly with the distance you
  // decide the scene is at.
  const wedgeHalfAngleRatio = SLOPE // tan(half-angle), exactly
  const objectHeight = 2 * metres * wedgeHalfAngleRatio

  const hfovDeg = 2 * matan(MODEL_W / (2 * f)) * (180 / Math.PI)

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          one pixel, one ray, every scale
        </span>
        <span className="font-mono text-[10px] text-muted-foreground/70">
          model output fixed at {fmt(D_NORM, 1)} (unitless)
        </span>
      </div>

      <div className="p-3 sm:p-4">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full"
          role="img"
          aria-label={`A camera cone with an object at ${fmt(metres)} metres; assuming a focal length of ${f} pixels turns the model's unitless output of ${D_NORM} into ${fmt(metres)} metres.`}
        >
          {/* cone */}
          <path
            d={`M ${APEX_X} ${AXIS_Y} L ${FAR_X} ${AXIS_Y - HALF_RISE} L ${FAR_X} ${AXIS_Y + HALF_RISE} Z`}
            fill="var(--muted-foreground)"
            opacity={0.07}
          />
          <path
            d={`M ${APEX_X} ${AXIS_Y} L ${FAR_X} ${AXIS_Y - HALF_RISE}`}
            stroke="var(--border)"
            strokeWidth={1.5}
            fill="none"
          />
          <path
            d={`M ${APEX_X} ${AXIS_Y} L ${FAR_X} ${AXIS_Y + HALF_RISE}`}
            stroke="var(--border)"
            strokeWidth={1.5}
            fill="none"
          />
          <line
            x1={APEX_X}
            y1={AXIS_Y}
            x2={FAR_X}
            y2={AXIS_Y}
            stroke="var(--border)"
            strokeWidth={1}
            strokeDasharray="3 4"
          />

          {/* ghosts: the other scales that produce the identical image */}
          {[5, 10, 15, 20].map((z) => {
            const gx = zToX(z)
            const gh = SLOPE * (gx - APEX_X)
            return (
              <rect
                key={z}
                x={gx - 7}
                y={AXIS_Y - gh}
                width={14}
                height={gh * 2}
                rx={2}
                fill="none"
                stroke="var(--muted-foreground)"
                strokeWidth={1}
                strokeDasharray="2 3"
                opacity={0.5}
              />
            )
          })}

          {/* the object at the depth this focal implies */}
          <rect
            x={objX - 9}
            y={AXIS_Y - objHalf}
            width={18}
            height={objHalf * 2}
            rx={3}
            fill="oklch(0.62 0.15 195)"
            opacity={offScale ? 0.25 : 0.9}
            className="transition-all duration-200"
          />
          <text
            x={objX}
            y={AXIS_Y - objHalf - 8}
            textAnchor="middle"
            className="font-mono"
            fontSize={11}
            fill="oklch(0.62 0.15 195)"
          >
            {offScale ? "off scale" : `${fmt(metres)} m`}
          </text>

          {/* camera */}
          <rect
            x={APEX_X - 34}
            y={AXIS_Y - 17}
            width={34}
            height={34}
            rx={5}
            fill="var(--background)"
            stroke="var(--border)"
            strokeWidth={1.5}
          />
          <circle cx={APEX_X - 17} cy={AXIS_Y} r={7} fill="none" stroke="var(--border)" strokeWidth={1.5} />

          {/* image plane: the footprint that never changes */}
          <line
            x1={160}
            y1={AXIS_Y - SLOPE * (160 - APEX_X)}
            x2={160}
            y2={AXIS_Y + SLOPE * (160 - APEX_X)}
            stroke="oklch(0.68 0.13 85)"
            strokeWidth={3}
          />
          <text
            x={160}
            y={AXIS_Y + SLOPE * (160 - APEX_X) + 16}
            textAnchor="middle"
            className="font-mono"
            fontSize={10}
            fill="oklch(0.68 0.13 85)"
          >
            image: unchanged
          </text>

          {/* depth ruler */}
          {[5, 10, 15, 20, 25].map((z) => (
            <g key={z}>
              <line
                x1={zToX(z)}
                y1={AXIS_Y + HALF_RISE + 14}
                x2={zToX(z)}
                y2={AXIS_Y + HALF_RISE + 20}
                stroke="var(--border)"
                strokeWidth={1}
              />
              <text
                x={zToX(z)}
                y={AXIS_Y + HALF_RISE + 32}
                textAnchor="middle"
                className="fill-muted-foreground font-mono"
                fontSize={10}
              >
                {z} m
              </text>
            </g>
          ))}
        </svg>

        <div className="mt-3 rounded-lg border bg-muted/20 px-3 py-3">
          <label
            htmlFor="scale-seam-focal"
            className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 font-mono text-[11px] text-muted-foreground"
          >
            <span>
              focal length in the 504&times;280 grid ·{" "}
              <span className="text-foreground">{f} px</span>
            </span>
            <span>{fmt(hfovDeg, 1)}&deg; horizontal field of view</span>
          </label>
          <Range
            id="scale-seam-focal"
            accent="oklch(0.62 0.15 195)"
            min={120}
            max={700}
            step={1}
            value={f}
            onChange={(e) => setF(Number(e.target.value))}
            className="mt-2 w-full"
          />
          <div className="mt-2 flex flex-wrap gap-1.5">
            {PRESETS.map((p) => (
              <button
                key={p.f}
                type="button"
                onClick={() => setF(p.f)}
                aria-pressed={p.f === f}
                className={
                  "cursor-pointer rounded-md border px-2 py-1 font-mono text-[10px] transition-colors " +
                  (p.f === f
                    ? "border-foreground/30 bg-muted/50 text-foreground"
                    : "border-transparent text-muted-foreground hover:bg-muted/30")
                }
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          <div className="rounded-lg border bg-muted/10 px-3 py-2">
            <div className="font-mono text-[10px] text-muted-foreground">
              model output
            </div>
            <div className="mt-0.5 font-mono text-sm">{fmt(D_NORM, 2)}</div>
            <div className="mt-0.5 text-[11px] leading-4 text-muted-foreground">
              unitless; the same number for every camera
            </div>
          </div>
          <div className="rounded-lg border bg-muted/10 px-3 py-2">
            <div className="font-mono text-[10px] text-muted-foreground">
              &times; f / 300
            </div>
            <div className="mt-0.5 font-mono text-sm">
              &times; {fmt(f / REF_FOCAL, 4)}
            </div>
            <div className="mt-0.5 text-[11px] leading-4 text-muted-foreground">
              the wrapper&rsquo;s one line of scale recovery
            </div>
          </div>
          <div className="rounded-lg border bg-muted/10 px-3 py-2">
            <div className="font-mono text-[10px] text-muted-foreground">
              published depth
            </div>
            <div
              className="mt-0.5 font-mono text-sm"
              style={{ color: "oklch(0.62 0.15 195)" }}
            >
              {fmt(metres)} m
            </div>
            <div className="mt-0.5 text-[11px] leading-4 text-muted-foreground">
              the drawn wedge spans {fmt(objectHeight)} m there
            </div>
          </div>
        </div>

        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          Every dashed box projects to the same pixels. That is the whole problem
          with monocular depth, and no amount of network makes it go away — the
          scale has to come from somewhere outside the image. Here it is the{" "}
          <code className="rounded bg-secondary px-1 py-0.5 text-[0.85em]">CameraInfo</code>
          {" "}your driver publishes. Note where 300 px sits: that is an 80&deg; horizontal field of view
          at 504 px wide, which is roughly the automotive front camera the
          checkpoint was calibrated around. Feed it a 60&deg; lens and the same
          prediction comes out 45% further away.
        </p>
      </div>
    </figure>
  )
}
