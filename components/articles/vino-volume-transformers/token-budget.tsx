"use client"

import { useState } from "react"

import { mlog10 } from "@/lib/dmath"
import { cn } from "@/lib/utils"

// How many tokens a Volt-style tokenizer makes from one scene. Measured, not
// modelled: Pointcept's two demo scenes (sample1, an indoor room of 273,530
// points, 7.2 x 8.0 x 2.5 m; sample2_outdoor, one LiDAR sweep of 162,249 points,
// 149 x 148 m) voxelised at each grid size, then cut into P x P x P patches,
// one token per non-empty patch. numpy 2.5, my own script.

const PS = [1, 2, 3, 4, 5, 6, 8] as const

type Scene = { label: string; note: string; def: [number, number]; rows: Record<number, { voxels: number; tokens: number[] }> }

const SCENES: Record<"indoor" | "outdoor", Scene> = {
  indoor: {
    label: "indoor room",
    note: "VINO caps an indoor crop at 65,536 voxels",
    def: [2, 5],
    rows: {
      1: { voxels: 264982, tokens: [264982, 188299, 111324, 68840, 45785, 32267, 18460] },
      2: { voxels: 187899, tokens: [187899, 67751, 32807, 18595, 12092, 8338, 4763] },
      3: { voxels: 111992, tokens: [111992, 32956, 14820, 8444, 5396, 3741, 2075] },
      4: { voxels: 68945, tokens: [68945, 19242, 8482, 4829, 3064, 2080, 1155] },
      5: { voxels: 45093, tokens: [45093, 12222, 5419, 3042, 1915, 1314, 725] },
    },
  },
  outdoor: {
    label: "outdoor LiDAR sweep",
    note: "VINO caps an outdoor crop at 6,000 tokens",
    def: [5, 5],
    rows: {
      5: { voxels: 128469, tokens: [128469, 81520, 56402, 42419, 32700, 26879, 19204] },
      10: { voxels: 81671, tokens: [81671, 42442, 26935, 19221, 14361, 11569, 7970] },
      20: { voxels: 42442, tokens: [42442, 19221, 11569, 7970, 5624, 4513, 3004] },
    },
  },
}

const fmt = (n: number) => n.toLocaleString("en-US")
const W = 640
const H = 220
const L = 54
const R = 16
const T = 14
const B = 34
const LO = 2
const HI = 6
const Y = (v: number) => T + (1 - (mlog10(v) - LO) / (HI - LO)) * (H - T - B)
const bw = (W - L - R) / PS.length

export function TokenBudget() {
  const [scene, setScene] = useState<"indoor" | "outdoor">("indoor")
  const s = SCENES[scene]
  const [vox, setVox] = useState<number>(s.def[0])
  const [p, setP] = useState<number>(s.def[1])
  const row = s.rows[vox] ?? s.rows[s.def[0]]
  const v = s.rows[vox] ? vox : s.def[0]
  const pi = PS.indexOf(p as (typeof PS)[number])
  const t = row.tokens[pi]
  const fill = row.voxels / (t * p * p * p)
  const pairsRatio = (row.voxels / t) * (row.voxels / t)
  const isDefault = v === s.def[0] && p === s.def[1]

  const pick = (k: "indoor" | "outdoor") => {
    setScene(k)
    setVox(SCENES[k].def[0])
    setP(SCENES[k].def[1])
  }

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>tokens per scene · one per non-empty P³ patch · measured</span>
        <div className="flex gap-1.5">
          {(["indoor", "outdoor"] as const).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => pick(k)}
              aria-pressed={scene === k}
              className={cn(
                "cursor-pointer rounded-md border px-2 py-0.5 text-[11px] transition-colors",
                scene === k ? "border-foreground/40 bg-foreground/5 text-foreground" : "hover:text-foreground",
              )}
            >
              {SCENES[k].label}
            </button>
          ))}
        </div>
      </div>

      <div className="p-3 sm:p-4">
        <div className="mb-3 flex flex-wrap items-center gap-1.5 font-mono text-[11px]">
          <span className="mr-1 text-muted-foreground">voxel</span>
          {Object.keys(s.rows).map((k) => {
            const n = Number(k)
            return (
              <button
                key={k}
                type="button"
                onClick={() => setVox(n)}
                aria-pressed={v === n}
                className={cn(
                  "cursor-pointer rounded-md border px-2 py-0.5 transition-colors",
                  v === n ? "border-foreground/40 bg-foreground/5 text-foreground" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {n} cm
              </button>
            )
          })}
          <span className="ml-3 mr-1 text-muted-foreground">patch P</span>
          {PS.map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setP(n)}
              aria-pressed={p === n}
              className={cn(
                "cursor-pointer rounded-md border px-2 py-0.5 transition-colors",
                p === n ? "border-foreground/40 bg-foreground/5 text-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {n}
            </button>
          ))}
        </div>

        <div className="overflow-x-auto">
          <svg
            viewBox={`0 0 ${W} ${H}`}
            className="w-full min-w-[520px]"
            role="img"
            aria-label={`Tokens for the ${s.label} at a ${v} cm voxel, by patch size. At P=${p}: ${fmt(t)} tokens from ${fmt(row.voxels)} voxels.`}
          >
            {[100, 1000, 10000, 100000, 1000000].map((g) => (
              <g key={g}>
                <line x1={L} x2={W - R} y1={Y(g)} y2={Y(g)} stroke="currentColor" className="text-border" strokeWidth={1} />
                <text x={L - 6} y={Y(g) + 3} textAnchor="end" className="fill-muted-foreground font-mono" fontSize={9}>
                  {g >= 1000000 ? "1M" : g >= 1000 ? `${g / 1000}k` : g}
                </text>
              </g>
            ))}
            {scene === "outdoor" && (
              <g>
                <line x1={L} x2={W - R} y1={Y(6000)} y2={Y(6000)} stroke="oklch(0.62 0.17 32)" strokeDasharray="4 3" strokeWidth={1.2} />
                <text x={W - R - 2} y={Y(6000) - 4} textAnchor="end" className="font-mono" fill="oklch(0.62 0.17 32)" fontSize={9}>
                  6,000-token crop cap
                </text>
              </g>
            )}
            {row.tokens.map((n, i) => {
              const x = L + i * bw + 6
              const on = i === pi
              return (
                <g key={i} onClick={() => setP(PS[i])} className="cursor-pointer">
                  <rect
                    x={x}
                    y={Y(n)}
                    width={bw - 12}
                    height={H - B - Y(n)}
                    rx={3}
                    fill={on ? "oklch(0.62 0.17 32)" : "oklch(0.58 0.12 250)"}
                    fillOpacity={on ? 0.95 : 0.45}
                  />
                  <text x={x + (bw - 12) / 2} y={Y(n) - 4} textAnchor="middle" className="fill-foreground font-mono" fontSize={9}>
                    {n >= 10000 ? `${(n / 1000).toFixed(0)}k` : fmt(n)}
                  </text>
                  <text x={x + (bw - 12) / 2} y={H - B + 14} textAnchor="middle" className="fill-muted-foreground font-mono" fontSize={9.5}>
                    P={PS[i]}
                  </text>
                  <text x={x + (bw - 12) / 2} y={H - B + 26} textAnchor="middle" className="fill-muted-foreground font-mono" fontSize={8.5}>
                    {PS[i] * v} cm
                  </text>
                </g>
              )
            })}
          </svg>
        </div>

        <div className="mt-2 grid gap-2 font-mono text-[11px] sm:grid-cols-3">
          <div className="rounded-md border px-2.5 py-1.5">
            <div className="text-muted-foreground">tokens from voxels</div>
            <div className="text-foreground">
              {fmt(t)} from {fmt(row.voxels)}
            </div>
          </div>
          <div className="rounded-md border px-2.5 py-1.5">
            <div className="text-muted-foreground">mean fill of a token&apos;s {p * p * p} slots</div>
            <div className="text-foreground">{(fill * 100).toFixed(1)}%</div>
          </div>
          <div className="rounded-md border px-2.5 py-1.5">
            <div className="text-muted-foreground">attention pairs vs one token per voxel</div>
            <div className="text-foreground">{p === 1 ? "same" : `${pairsRatio >= 100 ? fmt(Math.round(pairsRatio)) : pairsRatio.toFixed(1)}x fewer`}</div>
          </div>
        </div>
        <p className="mt-2 font-mono text-[10.5px] text-muted-foreground">
          {isDefault ? "This is the setting Volt and VINO use. " : `Volt and VINO use ${s.def[0]} cm voxels and P=5. `}
          {s.note}. Log scale; click a bar to pick P. The scenes are Pointcept&apos;s two demo clouds, not a benchmark
          average.
        </p>
      </div>
    </figure>
  )
}
