"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { cn } from "@/lib/utils"

// Why "pixel-registered" is the property that matters for stitching.
//
// A toy, not a measurement. The model returns a full frame; the workflow then
// pastes the exact original pixels back over the kept rectangle (the card's
// Stitch Inpaint step). If the model moved the scene by d and rescaled it by s
// about the canvas centre c, a point p of the kept picture comes back at
// c + s (p - c) + d, so along the paste-back border the original and the
// generated frame disagree by |(s - 1)(p - c) + d|. That is linear in p, so the
// worst of it sits at a corner of the kept rectangle.
//
// Arithmetic is + - * / Math.abs Math.max and Math.sqrt only (exact), so no
// lib/dmath wrapper is needed.

const W = 480
const H = 320
const C = { x: W / 2, y: H / 2 }
const KEPT = { x: 96, y: 72, w: 288, h: 176 }

const PRESETS = [
  { label: "registered", dx: 0, dy: 0, s: 1 },
  { label: "shifted 6 px", dx: 6, dy: -3, s: 1 },
  { label: "rescaled 4 %", dx: 0, dy: 0, s: 0.96 },
  { label: "both", dx: -5, dy: 4, s: 1.04 },
] as const

function Scene() {
  return (
    <g>
      <rect x={0} y={0} width={W} height={H} fill="#f59e0b" />
      <rect x={0} y={0} width={W} height={120} fill="#fbbf24" opacity={0.6} />
      <circle cx={352} cy={128} r={52} fill="#fff7ed" />
      <rect x={0} y={214} width={W} height={H - 214} fill="#1f2937" />
      <line x1={0} y1={214} x2={W} y2={214} stroke="#111827" strokeWidth={3} />
      {/* launch tower and its guy wire */}
      <rect x={150} y={36} width={22} height={178} fill="#111827" />
      <line x1={161} y1={36} x2={24} y2={214} stroke="#111827" strokeWidth={2} />
      {/* lattice tower in front of the sun */}
      <line x1={340} y1={20} x2={322} y2={214} stroke="#111827" strokeWidth={4} />
      <line x1={340} y1={20} x2={372} y2={214} stroke="#111827" strokeWidth={4} />
      {[70, 110, 150, 190].map((yy) => (
        <line key={yy} x1={338 - (yy - 20) * 0.093} y1={yy} x2={342 + (yy - 20) * 0.165} y2={yy} stroke="#111827" strokeWidth={2} />
      ))}
    </g>
  )
}

export function SeamToy() {
  const [dx, setDx] = useState(6)
  const [dy, setDy] = useState(-3)
  const [s, setS] = useState(1)

  const corners = [
    [KEPT.x, KEPT.y],
    [KEPT.x + KEPT.w, KEPT.y],
    [KEPT.x, KEPT.y + KEPT.h],
    [KEPT.x + KEPT.w, KEPT.y + KEPT.h],
  ]
  const off = (px: number, py: number) => {
    const ex = (s - 1) * (px - C.x) + dx
    const ey = (s - 1) * (py - C.y) + dy
    return Math.sqrt(ex * ex + ey * ey)
  }
  const worst = Math.max(...corners.map(([a, b]) => off(a, b)))
  const centre = off(KEPT.x + KEPT.w / 2, KEPT.y + KEPT.h / 2)
  const clean = worst < 0.5

  // generated frame = scene moved by d and scaled by s about the centre
  const tx = C.x + dx - s * C.x
  const ty = C.y + dy - s * C.y

  return (
    <figure className="my-8 overflow-hidden rounded-md border" aria-label="Paste-back seam toy">
      <div className="flex flex-wrap gap-2 border-b px-4 py-3">
        {PRESETS.map((p) => {
          const on = p.dx === dx && p.dy === dy && p.s === s
          return (
            <button
              key={p.label}
              type="button"
              onClick={() => {
                setDx(p.dx)
                setDy(p.dy)
                setS(p.s)
              }}
              aria-pressed={on}
              className={cn(
                "rounded-sm border px-2.5 py-1 font-mono text-xs",
                on
                  ? "border-foreground/40 bg-foreground/10 text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {p.label}
            </button>
          )
        })}
      </div>

      <div className="grid gap-4 px-4 py-4 md:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role="img" aria-label="A sunrise scene with a launch tower, a lattice tower and a sun; the original pixels are pasted back inside a white rectangle over a generated frame that may be shifted or rescaled.">
          <defs>
            <clipPath id="seam-kept">
              <rect x={KEPT.x} y={KEPT.y} width={KEPT.w} height={KEPT.h} />
            </clipPath>
          </defs>
          <g transform={`translate(${tx} ${ty}) scale(${s})`}>
            <Scene />
          </g>
          <g clipPath="url(#seam-kept)">
            <Scene />
          </g>
          <rect
            x={KEPT.x}
            y={KEPT.y}
            width={KEPT.w}
            height={KEPT.h}
            fill="none"
            stroke="#fff"
            strokeWidth={1.5}
            strokeDasharray="6 4"
          />
        </svg>

        <div className="font-mono text-sm">
          <label className="block">
            <span className="text-xs text-muted-foreground">generated frame, shift x</span>
            <Range min={-12} max={12} step={1} value={dx} onChange={(e) => setDx(Number(e.target.value))} className="mt-1 w-full" aria-label="horizontal shift of the generated frame in pixels" />
            <span className="tabular-nums">{dx} px</span>
          </label>
          <label className="mt-3 block">
            <span className="text-xs text-muted-foreground">generated frame, shift y</span>
            <Range min={-12} max={12} step={1} value={dy} onChange={(e) => setDy(Number(e.target.value))} className="mt-1 w-full" aria-label="vertical shift of the generated frame in pixels" />
            <span className="tabular-nums">{dy} px</span>
          </label>
          <label className="mt-3 block">
            <span className="text-xs text-muted-foreground">generated frame, scale</span>
            <Range min={0.9} max={1.1} step={0.01} value={s} onChange={(e) => setS(Number(e.target.value))} className="mt-1 w-full" aria-label="scale of the generated frame about the canvas centre" />
            <span className="tabular-nums">{s.toFixed(2)}x</span>
          </label>
          <div className="mt-4 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
            <span className="text-muted-foreground">worst seam offset</span>
            <span className={cn("tabular-nums", clean ? "text-emerald-700 dark:text-emerald-400" : "text-red-700 dark:text-red-400")}>
              {worst.toFixed(1)} px
            </span>
            <span className="text-muted-foreground">at the centre</span>
            <span className="tabular-nums">{centre.toFixed(1)} px</span>
          </div>
        </div>
      </div>

      <figcaption className="border-t px-4 py-3 text-xs text-muted-foreground">
        A toy, not a render. The dashed box is where the exact original pixels go back. Outside
        it is the model&apos;s frame; if that frame moved the scene, every line that crosses the
        box breaks. The offset is (s &minus; 1)(p &minus; c) + d, linear in position, so a shift
        costs the same everywhere and a rescale costs most at the corners farthest from the
        centre. A feathered paste-back blends two copies across the ramp; it cannot move either
        one, so a broken line becomes a ghosted one.
      </figcaption>
    </figure>
  )
}
