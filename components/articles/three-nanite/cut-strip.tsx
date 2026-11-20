"use client"

// The cut through a cluster hierarchy, in one dimension so all of it fits on screen.
// Top: the surface as drawn this frame, each piece coloured by its level. Bottom: the
// hierarchy itself, one row per level, with the clusters in the cut filled in. Move the
// camera and the threshold and the cut moves; switch the parent test from "shared" to
// "own bounds" and siblings start to disagree, which opens holes.

import { useMemo, useState } from "react"

import { Range } from "@/components/articles/ui/range"

import { LEAVES, LEVELS, SPAN, buildTree, selectCut, surface } from "./cut-model"
import { LEVEL_COLORS } from "./palette"

const TAUS = [0.5, 1, 2, 4, 8, 16]
const K = 40
const CAM_Y = 1.0
const W = 720
const X0 = 40, X1 = 680
const SY = 120, YS = 70 // surface baseline and px per unit
const sx = (x: number) => X0 + (x / SPAN) * (X1 - X0)
const sy = (y: number) => SY - y * YS
const f2 = (v: number) => v.toFixed(2)
const ROW_TOP = 222, ROW_H = 20

export function CutStrip() {
  const tree = useMemo(() => buildTree(), [])
  const fine = useMemo(() => {
    const pts: string[] = []
    for (let i = 0; i <= 256; i++) {
      const x = (i / 256) * SPAN
      pts.push(`${f2(sx(x))},${f2(sy(surface(x)))}`)
    }
    return pts.join(" ")
  }, [])
  const [tauI, setTauI] = useState(2)
  const [cam, setCam] = useState(25) // 0..100 along the strip
  const [shared, setShared] = useState(true)
  const camX = (cam / 100) * SPAN
  const tau = TAUS[tauI]
  const cut = useMemo(() => selectCut(tree, camX, CAM_Y, K, tau, shared), [tree, camX, tau, shared])
  const H = ROW_TOP + LEVELS * ROW_H + 30

  return (
    <figure className="not-prose my-8 rounded-xl border">
      <div className="px-3 pt-3 sm:px-4">
        <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={`A one-dimensional surface drawn from ${cut.clusters} clusters across ${LEVELS} levels; ${cut.holes.length} holes.`}>
          {/* camera and its view lines to the strip ends */}
          <line x1={f2(sx(camX))} y1={f2(sy(CAM_Y))} x2={X0} y2={f2(sy(0))} className="stroke-muted-foreground/25" strokeDasharray="3 4" />
          <line x1={f2(sx(camX))} y1={f2(sy(CAM_Y))} x2={X1} y2={f2(sy(0))} className="stroke-muted-foreground/25" strokeDasharray="3 4" />
          <g transform={`translate(${f2(sx(camX))},${f2(sy(CAM_Y))})`}>
            <rect x={-11} y={-9} width={22} height={14} rx={3} className="fill-foreground" />
            <circle cx={0} cy={-2} r={4} className="fill-background" />
            <text y={-15} textAnchor="middle" className="fill-muted-foreground font-mono text-[11px]">camera</text>
          </g>
          {/* the source curve, faint */}
          <polyline points={fine} fill="none" className="stroke-muted-foreground/30" strokeWidth={6} strokeLinecap="round" />
          {/* holes and overlaps, under the drawn pieces */}
          {cut.holes.map(([a, b]) => (
            <g key={`h${a}`}>
              <rect x={f2(sx(a))} y={SY - 70} width={f2(sx(b) - sx(a))} height={140} className="fill-red-500/15" />
              <text x={f2((sx(a) + sx(b)) / 2)} y={SY + 62} textAnchor="middle" className="fill-red-600 font-mono text-[11px] dark:fill-red-400">hole</text>
            </g>
          ))}
          {cut.overlaps.map(([a, b]) => (
            <rect key={`o${a}`} x={f2(sx(a))} y={SY - 70} width={f2(sx(b) - sx(a))} height={140} className="fill-amber-500/20" />
          ))}
          {tree.map((row, L) =>
            row.map((c, k) =>
              cut.drawn[L][k] ? (
                <g key={`${L}-${k}`}>
                  <polyline points={c.pts.map(([x, y]) => `${f2(sx(x))},${f2(sy(y))}`).join(" ")} fill="none" stroke={LEVEL_COLORS[L]} strokeWidth={3} strokeLinejoin="round" />
                  {c.pts.map(([x, y], i) => (
                    <circle key={i} cx={f2(sx(x))} cy={f2(sy(y))} r={i === 0 || i === c.pts.length - 1 ? 3.2 : 2} fill={LEVEL_COLORS[L]} />
                  ))}
                </g>
              ) : null,
            ),
          )}
          {/* the hierarchy: level 5 on top, the source clusters at the bottom */}
          <text x={X0} y={ROW_TOP - 8} className="fill-muted-foreground font-mono text-[11px]">the hierarchy, coarsest row on top; filled = in the cut</text>
          {tree.map((row, L) => {
            const y = ROW_TOP + (LEVELS - 1 - L) * ROW_H
            const w = (X1 - X0) / (LEAVES >> L)
            return (
              <g key={L}>
                <text x={X0 - 8} y={y + 14} textAnchor="end" className="fill-muted-foreground font-mono text-[10px]">{L}</text>
                {row.map((c, k) => (
                  <rect
                    key={k}
                    x={f2(X0 + k * w + 1)}
                    y={y + 2}
                    width={f2(w - 2)}
                    height={ROW_H - 4}
                    rx={2}
                    fill={cut.drawn[L][k] ? LEVEL_COLORS[L] : "none"}
                    className={cut.drawn[L][k] ? "" : "stroke-muted-foreground/30"}
                  />
                ))}
              </g>
            )
          })}
        </svg>
      </div>
      <div className="flex flex-col gap-2.5 border-t px-3 py-2.5 font-mono text-xs text-muted-foreground sm:px-4">
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          <label className="flex items-center gap-2">
            <span className="w-16 shrink-0">camera</span>
            <Range min={0} max={100} step={1} value={cam} onChange={(e) => setCam(Number(e.target.value))} aria-label="Camera position along the strip" className="min-w-0 flex-1" />
          </label>
          <label className="flex items-center gap-2">
            <span className="w-16 shrink-0">error τ</span>
            <Range min={0} max={TAUS.length - 1} step={1} value={tauI} onChange={(e) => setTauI(Number(e.target.value))} aria-label="Allowed error in pixels" aria-valuetext={`${tau} pixels`} className="min-w-0 flex-1" />
            <span className="w-10 shrink-0 text-right text-foreground">{tau} px</span>
          </label>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <div className="flex gap-1" role="group" aria-label="Parent test">
            <button type="button" aria-pressed={shared} onClick={() => setShared(true)} className={`rounded-md border px-2.5 py-1 transition-colors ${shared ? "bg-foreground text-background" : "hover:bg-muted"}`}>
              parent test: shared
            </button>
            <button type="button" aria-pressed={!shared} onClick={() => setShared(false)} className={`rounded-md border px-2.5 py-1 transition-colors ${!shared ? "bg-foreground text-background" : "hover:bg-muted"}`}>
              own bounds
            </button>
          </div>
          <span>
            <span className="text-foreground">{cut.segs}</span> of {LEAVES * 4} segments, <span className="text-foreground">{cut.clusters}</span> clusters,{" "}
            <span className={cut.holes.length ? "font-semibold text-red-600 dark:text-red-400" : "text-foreground"}>{cut.holes.length}</span> holes
          </span>
        </div>
      </div>
      <figcaption className="border-t px-4 py-3 text-sm text-muted-foreground">
        A toy hierarchy in one dimension: 32 clusters of 4 segments, paired and halved five times. A piece is drawn when its own error,
        projected from where it sits, is at most τ, and its parent&apos;s is above τ. With the shared test both siblings measure the parent
        from the parent&apos;s bounds and always agree. With own bounds each measures from its own, and wherever they disagree one half of
        the parent goes missing.
      </figcaption>
    </figure>
  )
}
