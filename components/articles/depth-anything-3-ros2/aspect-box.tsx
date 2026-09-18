"use client"

import { useState } from "react"

// The node resizes every incoming frame to the engine's exact input size with a
// non-uniform scale (preprocess_gpu.cu:41), then recovers metric scale from the
// average of the two separately-scaled focal lengths
// (tensorrt_depth_anything.cpp:357–360):
//
//     sx = Ew / W          sy = Eh / H
//     focal = 0.5 * (fx*sx + fy*sy)        depth_m = depth_raw * focal / 300
//
// Depth Anything 3's own input pipeline does not do that. InputProcessor
// resizes the *longest side* to 504 with a single scale and then centre-crops to
// a multiple of 14 (utils/io/input_processor.py:324 and 351). One scale, so one
// focal, so no averaging.
//
// For fx = fy the ratio between the two answers collapses to a one-liner that
// depends only on the source aspect ratio a = W/H:
//
//     node / aspect-preserving = (1 + a * Eh / Ew) / 2
//
// It is exactly 1 when a == Ew/Eh == 1.8, and it falls away fast below that.
// This widget is that formula with real camera resolutions plugged in. Only the
// scale factor is computed here; what an anisotropically squashed image does to
// the network's prediction itself is not something source can tell you.

const EW = 504 // engine input width, fixed by the shipped ONNX
const EH = 280 // engine input height, fixed by the shipped ONNX
const PATCH = 14 // DINOv2 patch size: every side must be a multiple of it

interface Cam {
  w: number
  h: number
  note: string
}

const CAMS: Cam[] = [
  { w: 1920, h: 1080, note: "16:9 — the automotive front camera this node was built around" },
  { w: 1280, h: 720, note: "16:9 — the most common ROS 2 driver default" },
  { w: 1920, h: 1200, note: "16:10 — Basler / Allied Vision machine vision" },
  { w: 1440, h: 1080, note: "4:3 — Sekonix and other automotive 4:3 sensors" },
  { w: 640, h: 480, note: "4:3 — RealSense RGB, most USB webcams" },
  { w: 1280, h: 1024, note: "5:4 — older industrial sensors" },
]

// The engine height an aspect-matched export would use: keep the longest side at
// 504 and floor the other to a multiple of 14, the way DA3 itself does.
const matchedEh = (w: number, h: number) =>
  Math.floor(EW / (w / h) / PATCH) * PATCH

const pct = (r: number) => `${r >= 1 ? "+" : "−"}${(Math.abs(r - 1) * 100).toFixed(2)}%`

export function AspectBox() {
  const [i, setI] = useState(0)
  const [matched, setMatched] = useState(false)

  const cam = CAMS[i]
  const eh = matched ? matchedEh(cam.w, cam.h) : EH
  const sx = EW / cam.w
  const sy = eh / cam.h
  const mean = (sx + sy) / 2
  const ratio = mean / sx // sx is exactly the aspect-preserving scale for a landscape frame
  const squash = sy / sx
  const aspect = cam.w / cam.h

  // preview geometry
  const boxW = 150
  const srcH = (boxW * cam.h) / cam.w
  const dstH = (boxW * eh) / EW

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          every frame is squeezed into {EW}&times;{eh}
        </span>
        <span
          className="font-mono text-[10px]"
          style={{
            color:
              Math.abs(ratio - 1) < 0.02
                ? "oklch(0.62 0.15 160)"
                : "oklch(0.62 0.19 27)",
          }}
        >
          published depth {pct(ratio)}
        </span>
      </div>

      <div className="p-3 sm:p-4">
        <div className="flex flex-wrap gap-1.5">
          {CAMS.map((c, k) => (
            <button
              key={`${c.w}x${c.h}`}
              type="button"
              onClick={() => setI(k)}
              aria-pressed={k === i}
              className={
                "cursor-pointer rounded-md border px-2 py-1 font-mono text-[10px] transition-colors " +
                (k === i
                  ? "border-foreground/30 bg-muted/50 text-foreground"
                  : "border-transparent text-muted-foreground hover:bg-muted/30")
              }
            >
              {c.w}&times;{c.h}
            </button>
          ))}
        </div>

        <p className="mt-2 text-[11px] leading-4 text-muted-foreground">{cam.note}</p>

        <div className="mt-4 flex flex-wrap items-center justify-center gap-4 sm:gap-6">
          <div className="text-center">
            <svg
              viewBox={`0 0 ${boxW} ${Math.max(srcH, 96)}`}
              width={boxW}
              className="mx-auto"
              role="img"
              aria-label={`Source frame ${cam.w} by ${cam.h} with a reference circle`}
            >
              <rect
                x={0.5}
                y={(Math.max(srcH, 96) - srcH) / 2 + 0.5}
                width={boxW - 1}
                height={srcH - 1}
                rx={3}
                fill="var(--muted-foreground)"
                fillOpacity={0.06}
                stroke="var(--border)"
                strokeWidth={1}
              />
              <circle
                cx={boxW / 2}
                cy={Math.max(srcH, 96) / 2}
                r={srcH / 2 - 8}
                fill="none"
                stroke="oklch(0.62 0.13 240)"
                strokeWidth={1.5}
              />
            </svg>
            <div className="mt-1 font-mono text-[10px] text-muted-foreground">
              {cam.w}&times;{cam.h} · {aspect.toFixed(3)}:1
            </div>
          </div>

          <div className="font-mono text-xs text-muted-foreground">&rarr;</div>

          <div className="text-center">
            <svg
              viewBox={`0 0 ${boxW} ${Math.max(dstH, 96)}`}
              width={boxW}
              className="mx-auto"
              role="img"
              aria-label={`The same frame stretched to ${EW} by ${eh}; the reference circle becomes an ellipse ${squash.toFixed(3)} as tall as it is wide`}
            >
              <rect
                x={0.5}
                y={(Math.max(dstH, 96) - dstH) / 2 + 0.5}
                width={boxW - 1}
                height={dstH - 1}
                rx={3}
                fill="var(--muted-foreground)"
                fillOpacity={0.06}
                stroke="var(--border)"
                strokeWidth={1}
              />
              <ellipse
                cx={boxW / 2}
                cy={Math.max(dstH, 96) / 2}
                rx={srcH / 2 - 8}
                ry={(srcH / 2 - 8) * squash}
                fill="none"
                stroke={
                  Math.abs(squash - 1) < 0.02
                    ? "oklch(0.62 0.15 160)"
                    : "oklch(0.62 0.19 27)"
                }
                strokeWidth={1.5}
              />
            </svg>
            <div className="mt-1 font-mono text-[10px] text-muted-foreground">
              {EW}&times;{eh} · circle &rarr; {squash.toFixed(3)} tall
            </div>
          </div>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <tbody className="font-mono text-[11px]">
              <tr className="border-t border-border/60">
                <td className="py-1.5 pr-2 text-muted-foreground">sx = {EW}/{cam.w}</td>
                <td className="py-1.5 text-right tabular-nums">{sx.toFixed(6)}</td>
                <td className="py-1.5 pl-3 text-muted-foreground">
                  also the aspect-preserving scale
                </td>
              </tr>
              <tr className="border-t border-border/60">
                <td className="py-1.5 pr-2 text-muted-foreground">sy = {eh}/{cam.h}</td>
                <td className="py-1.5 text-right tabular-nums">{sy.toFixed(6)}</td>
                <td className="py-1.5 pl-3 text-muted-foreground">
                  what the vertical squeeze actually is
                </td>
              </tr>
              <tr className="border-t border-border/60">
                <td className="py-1.5 pr-2 text-muted-foreground">0.5&middot;(sx + sy)</td>
                <td className="py-1.5 text-right tabular-nums">{mean.toFixed(6)}</td>
                <td className="py-1.5 pl-3 text-muted-foreground">
                  the factor the node applies to fx, fy
                </td>
              </tr>
              <tr className="border-t border-border/60">
                <td className="py-1.5 pr-2 text-foreground">focal ratio</td>
                <td
                  className="py-1.5 text-right tabular-nums"
                  style={{
                    color:
                      Math.abs(ratio - 1) < 0.02
                        ? "oklch(0.62 0.15 160)"
                        : "oklch(0.62 0.19 27)",
                  }}
                >
                  {ratio.toFixed(6)}
                </td>
                <td className="py-1.5 pl-3 text-muted-foreground">
                  every published metre, multiplied by this
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <label className="mt-4 flex cursor-pointer items-center gap-2 font-mono text-[11px] text-muted-foreground">
          <input
            type="checkbox"
            checked={matched}
            onChange={(e) => setMatched(e.target.checked)}
            className="cursor-pointer accent-[oklch(0.62_0.15_160)]"
          />
          re-export the engine at {EW}&times;{matchedEh(cam.w, cam.h)} to match this
          camera
        </label>

        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          The shipped engine is {EW}&times;{EH}, which is exactly what Depth
          Anything 3&rsquo;s own preprocessing produces for a 16:9 frame &mdash;
          resize the long side to 504, floor the short side to a multiple of 14,
          1080 &times; 504/1920 = 283.5, rounded to 284, floored to 280. So on
          16:9 the node lands within 0.62% of the reference recipe. On 4:3 the
          same code silently squeezes the frame to 74% of its correct height and
          shortens every published distance by 13.0%. Re-exporting
          the ONNX at a matching height fixes the arithmetic; it does not undo
          the fact that the image was stretched rather than cropped, and I have
          no way to bound that from source alone.
        </p>
      </div>
    </figure>
  )
}
