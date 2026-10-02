"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { mexp } from "@/lib/dmath"
import { cn } from "@/lib/utils"

// Bounded memory, drawn. The one idea both R3 and AMB3R-SLAM share is that a
// streaming reconstruction's state must not grow with the number of frames it
// has seen. A naive feed-forward model that keeps a pointmap (or a block of
// tokens) per frame has memory O(N): it climbs a straight line in the frame
// count and eventually crosses whatever the GPU has, at which point it OOMs. A
// bounded estimate keeps a fixed working set instead -- R3 a keyframe bank of
// at most K slots, AMB3R-SLAM a windowed submap plus a pose graph -- so its
// memory is O(K): flat in N, set by the cap, never by the sequence length.
//
// This widget is a SCHEMATIC of exactly that contrast, not a measurement.
// Only the 48 GiB line is the paper's (R3's long-sequence budget); the two
// curves are illustrative, calibrated to one real anchor -- StreamVGGT, a
// 1.26B per-frame model, runs out of that 48 GiB budget past 500 frames
// (R3, Table 4), so the naive line is drawn to cross 48 GiB at 500 frames.
// The measured numbers are in the tables in the prose.
//
// SSR-safe: deterministic initial state, no window/Date at module scope, and
// the one transcendental (the bank's saturating fill) goes through lib/dmath
// so the server and client serialize the same SVG.

const BASE = 6 // GiB of fixed overhead (weights, buffers) shared by both
const PER_FRAME = 0.084 // GiB added per frame by the naive per-frame store
const PER_SLOT = 0.1 // GiB per keyframe slot in the bounded bank
const BUDGET = 48 // GiB -- R3's long-sequence memory budget (Table 4)
const OOM_FRAME = Math.round((BUDGET - BASE) / PER_FRAME) // 500, by construction
const MAX_FRAMES = 1200
const TAU = 180 // frames: how fast novelty-gated admission fills the bank

const naiveMem = (f: number) => BASE + PER_FRAME * f
const boundedMem = (k: number) => BASE + PER_SLOT * k
const slotsUsed = (f: number, k: number) =>
  Math.min(k, Math.round(k * (1 - mexp(-f / TAU))))

// plot geometry (SVG user units)
const W = 680
const H = 300
const PADL = 48
const PADR = 16
const PADT = 16
const PADB = 34
const Y_MAX = 60 // GiB shown
const px = (f: number) => PADL + (f / MAX_FRAMES) * (W - PADL - PADR)
const py = (g: number) => PADT + (1 - g / Y_MAX) * (H - PADT - PADB)

export function MemoryStream() {
  const [frames, setFrames] = useState(640)
  const [k, setK] = useState(64)

  const naive = naiveMem(frames)
  const bounded = boundedMem(k)
  const used = slotsUsed(frames, k)
  const oom = naive > BUDGET

  // naive polyline, clipped to the plotted range
  const naivePts: string[] = []
  for (let f = 0; f <= MAX_FRAMES; f += 40) {
    naivePts.push(`${px(f).toFixed(1)},${py(Math.min(naiveMem(f), Y_MAX)).toFixed(1)}`)
  }

  const xticks = [0, 200, 400, 600, 800, 1000, 1200]
  const yticks = [0, 12, 24, 36, 48, 60]

  return (
    <figure className="my-8 rounded-md border bg-muted/20 p-4">
      <div className="grid gap-5 md:grid-cols-[1fr_15rem]">
        <div>
          <svg
            viewBox={`0 0 ${W} ${H}`}
            className="w-full"
            role="img"
            aria-label="Memory against frame count: the naive per-frame store climbs a straight line and crosses the 48 GiB budget at 500 frames, while the bounded keyframe bank stays flat."
          >
            {/* grid + y axis */}
            {yticks.map((g) => (
              <g key={g}>
                <line
                  x1={PADL}
                  y1={py(g)}
                  x2={W - PADR}
                  y2={py(g)}
                  className="stroke-foreground/10"
                  strokeWidth={1}
                />
                <text
                  x={PADL - 8}
                  y={py(g) + 3}
                  textAnchor="end"
                  className="fill-muted-foreground font-mono text-[10px]"
                >
                  {g}
                </text>
              </g>
            ))}
            {xticks.map((f) => (
              <text
                key={f}
                x={px(f)}
                y={H - PADB + 16}
                textAnchor="middle"
                className="fill-muted-foreground font-mono text-[10px]"
              >
                {f}
              </text>
            ))}
            <text
              x={(PADL + W - PADR) / 2}
              y={H - 2}
              textAnchor="middle"
              className="fill-muted-foreground font-mono text-[10px]"
            >
              frames seen
            </text>

            {/* 48 GiB budget */}
            <line
              x1={PADL}
              y1={py(BUDGET)}
              x2={W - PADR}
              y2={py(BUDGET)}
              className="stroke-destructive"
              strokeWidth={1.5}
              strokeDasharray="5 4"
            />
            <text
              x={W - PADR}
              y={py(BUDGET) - 5}
              textAnchor="end"
              className="fill-destructive font-mono text-[10px]"
            >
              48 GiB budget
            </text>

            {/* bounded (flat) */}
            <line
              x1={px(0)}
              y1={py(bounded)}
              x2={px(MAX_FRAMES)}
              y2={py(bounded)}
              className="stroke-sky-500"
              strokeWidth={2.5}
            />
            <text
              x={px(MAX_FRAMES)}
              y={py(bounded) - 6}
              textAnchor="end"
              className="fill-sky-500 font-mono text-[10px]"
            >
              bounded bank
            </text>

            {/* naive (linear) */}
            <polyline
              points={naivePts.join(" ")}
              fill="none"
              className="stroke-amber-500"
              strokeWidth={2.5}
            />
            {/* OOM marker where naive crosses the budget */}
            <circle cx={px(OOM_FRAME)} cy={py(BUDGET)} r={4} className="fill-amber-500" />
            <text
              x={px(OOM_FRAME)}
              y={py(BUDGET) + 16}
              textAnchor="middle"
              className="fill-amber-600 font-mono text-[10px]"
            >
              OOM @ 500
            </text>
            <text
              x={px(MAX_FRAMES / 2)}
              y={py(naiveMem(MAX_FRAMES / 2)) - 8}
              textAnchor="middle"
              className="fill-amber-600 font-mono text-[10px]"
            >
              naive per-frame store
            </text>

            {/* current frame cursor */}
            <line
              x1={px(frames)}
              y1={PADT}
              x2={px(frames)}
              y2={H - PADB}
              className="stroke-foreground/40"
              strokeWidth={1}
              strokeDasharray="2 3"
            />
            <circle cx={px(frames)} cy={py(bounded)} r={3.5} className="fill-sky-500" />
            <circle
              cx={px(frames)}
              cy={py(Math.min(naive, Y_MAX))}
              r={3.5}
              className="fill-amber-500"
            />
          </svg>
        </div>

        <div className="flex flex-col justify-center gap-4 text-sm">
          <div>
            <label className="mb-1 flex justify-between font-mono text-xs text-muted-foreground">
              <span>frames seen</span>
              <span className="text-foreground">{frames}</span>
            </label>
            <Range
              min={0}
              max={MAX_FRAMES}
              step={20}
              value={frames}
              accent="#64748b"
              onChange={(e) => setFrames(Number(e.target.value))}
              aria-label="frames seen"
            />
          </div>
          <div>
            <label className="mb-1 flex justify-between font-mono text-xs text-muted-foreground">
              <span>bank cap K</span>
              <span className="text-foreground">{k} slots</span>
            </label>
            <Range
              min={16}
              max={128}
              step={8}
              value={k}
              accent="#0ea5e9"
              onChange={(e) => setK(Number(e.target.value))}
              aria-label="keyframe bank cap"
            />
          </div>

          <dl className="grid grid-cols-2 gap-x-3 gap-y-1 border-t pt-3 font-mono text-xs">
            <dt className="text-amber-600">naive store</dt>
            <dd className="text-right tabular-nums">
              {naive.toFixed(1)} GiB{" "}
              <span className={cn(oom ? "text-destructive" : "text-muted-foreground")}>
                {oom ? "OOM" : "ok"}
              </span>
            </dd>
            <dt className="text-sky-600">bounded bank</dt>
            <dd className="text-right tabular-nums">{bounded.toFixed(1)} GiB ok</dd>
            <dt className="text-muted-foreground">bank fill</dt>
            <dd className="text-right tabular-nums">
              {used} / {k} slots
            </dd>
          </dl>
          <p className="text-xs leading-5 text-muted-foreground">
            {
              "Drag frames: the naive line climbs with N and OOMs; the bank is flat. Drag K: the bank moves up or down but never tilts. Schematic — only the 48 GiB line is R³'s; measured numbers are in the tables."
            }
          </p>
        </div>
      </div>
    </figure>
  )
}
