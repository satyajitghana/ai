"use client"

import { memo, useState } from "react"

import { cn } from "@/lib/utils"
import { Range } from "@/components/articles/ui/range"

// A single model's J-lens CKA matrix: cell (i,j) = how similarly layers i and j
// arrange the 4,096 probe-token steering directions. Bright blocks along the
// diagonal are stretches of layers holding ONE geometry — the paper's
// sensory / workspace / motor regions. The block boundaries sit at nearly the
// same *relative* depth whatever the layer count, which is the whole point:
// switch the model and the layout barely moves.
//
// The CKA values here are a deterministic, structure-faithful reconstruction of
// what the explorer renders — NOT the measured matrix. First render is pure and
// bounded (no timers, no randomness), so it is SSR/prerender-safe.

// stage tints, shared with depth-reindex.tsx
const SENSORY = "oklch(0.56 0.13 285)"
const WORKSPACE = "oklch(0.64 0.13 195)"
const MOTOR = "oklch(0.74 0.14 80)"

// open-model means the explorer reports for the full 38-model selection
const SENS_END = 0.465
const MOTOR_START = 0.641

const MODELS = [
  { id: "llama3.1-8b", layers: 32 },
  { id: "gemma-3-12b", layers: 48 },
  { id: "qwen3-32b", layers: 64 },
] as const

function stageOf(x: number): "sensory" | "workspace" | "motor" {
  return x < SENS_END ? "sensory" : x >= MOTOR_START ? "motor" : "workspace"
}
const stageColor = { sensory: SENSORY, workspace: WORKSPACE, motor: MOTOR }

// viridis ramp (echoes the source colormap) — 5 fixed stops, bounded search
const STOPS: [number, [number, number, number]][] = [
  [0.0, [68, 1, 84]],
  [0.25, [59, 82, 139]],
  [0.5, [33, 145, 140]],
  [0.75, [94, 201, 98]],
  [1.0, [253, 231, 37]],
]
function viridis(t: number): string {
  const u = t < 0 ? 0 : t > 1 ? 1 : t
  let i = 0
  while (i < STOPS.length - 2 && u > STOPS[i + 1][0]) i++
  const [t0, c0] = STOPS[i]
  const [t1, c1] = STOPS[i + 1]
  const f = t1 === t0 ? 0 : (u - t0) / (t1 - t0)
  const r = Math.round(c0[0] + (c1[0] - c0[0]) * f)
  const g = Math.round(c0[1] + (c1[1] - c0[1]) * f)
  const b = Math.round(c0[2] + (c1[2] - c0[2]) * f)
  return `rgb(${r},${g},${b})`
}

// structure-faithful CKA between two relative depths a,b ∈ [0,1]
function cka(a: number, b: number): number {
  const prox = Math.exp(-(((a - b) / 0.085) ** 2)) // sharp diagonal
  const same = stageOf(a) === stageOf(b) ? 0.14 : 0 // within-stage block
  return Math.min(1, Math.max(0, 0.46 + 0.44 * prox + same))
}

// geometry
const W = 560
const H = 452
const PX = 62
const PY = 40
const PS = 372 // plot side (square)

const px = (rel: number) => PX + rel * PS
const py = (rel: number) => PY + rel * PS

// The heatmap depends only on `layers`, so memoize it — scrubbing depth never
// re-renders these up-to-4,096 cells.
const Heat = memo(function Heat({ layers }: { layers: number }) {
  const cell = PS / layers
  const cells: React.ReactNode[] = []
  for (let i = 0; i < layers; i++) {
    const a = i / (layers - 1)
    for (let j = 0; j < layers; j++) {
      const b = j / (layers - 1)
      cells.push(
        <rect
          key={i * layers + j}
          x={PX + j * cell}
          y={PY + i * cell}
          width={cell + 0.5}
          height={cell + 0.5}
          fill={viridis(cka(a, b))}
        />
      )
    }
  }
  return <g>{cells}</g>
})

export function CkaBlocks() {
  const [mi, setMi] = useState(0)
  const [depth, setDepth] = useState(0.55)
  const model = MODELS[mi]
  const layers = model.layers
  const layer = Math.round(depth * (layers - 1))
  const st = stageOf(depth)

  const blocks: [string, number, number][] = [
    ["sensory", 0, SENS_END],
    ["workspace", SENS_END, MOTOR_START],
    ["motor", MOTOR_START, 1],
  ]

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex items-center justify-between border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>within-model J-lens CKA · layer × layer</span>
        <span className="text-muted-foreground/50">illustrative</span>
      </div>

      <div className="p-3 sm:p-4">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full"
          role="img"
          aria-label={`CKA heatmap for ${model.id}: bright diagonal blocks for the sensory, workspace and motor regions, with the block boundaries at fixed relative depth.`}
        >
          {/* axis titles */}
          <text x={PX} y={22} className="fill-foreground font-mono" fontSize={11} fontWeight={600}>
            {model.id}
          </text>
          <text x={PX + PS} y={22} textAnchor="end" className="fill-muted-foreground font-mono" fontSize={10}>
            {layers} layers · CKA(i, j)
          </text>

          {/* stage strips along top (columns = layer j) and left (rows = layer i) */}
          {blocks.map(([name, s, e]) => (
            <g key={`top-${name}`}>
              <rect x={px(s)} y={PY - 12} width={(e - s) * PS} height={6} rx={2} fill={stageColor[name as keyof typeof stageColor]} opacity={0.8} />
              <rect x={PX - 12} y={py(s)} width={6} height={(e - s) * PS} rx={2} fill={stageColor[name as keyof typeof stageColor]} opacity={0.8} />
            </g>
          ))}

          {/* the heatmap */}
          <Heat layers={layers} />

          {/* diagonal stage blocks outlined */}
          {blocks.map(([name, s, e]) => (
            <rect
              key={`blk-${name}`}
              x={px(s)}
              y={py(s)}
              width={(e - s) * PS}
              height={(e - s) * PS}
              fill="none"
              stroke={stageColor[name as keyof typeof stageColor]}
              strokeWidth={1.5}
              opacity={0.9}
            />
          ))}

          {/* depth highlight: row + column band + diagonal marker */}
          <rect x={PX} y={py(depth) - 1.5} width={PS} height={3} fill="var(--foreground)" opacity={0.25} />
          <rect x={px(depth) - 1.5} y={PY} width={3} height={PS} fill="var(--foreground)" opacity={0.25} />
          <circle cx={px(depth)} cy={py(depth)} r={4.5} fill="none" stroke="var(--foreground)" strokeWidth={1.5} />

          {/* frame */}
          <rect x={PX} y={PY} width={PS} height={PS} fill="none" stroke="var(--border)" strokeWidth={1} />

          {/* readout under the plot */}
          <text x={PX} y={PY + PS + 26} className="fill-muted-foreground font-mono" fontSize={10}>
            depth <tspan className="fill-foreground">{Math.round(depth * 100)}%</tspan> · layer{" "}
            <tspan className="fill-foreground">{layer}</tspan>/{layers - 1}
          </text>
          <text x={PX + PS} y={PY + PS + 26} textAnchor="end" className="font-mono" fontSize={10} fill={stageColor[st]}>
            {st} region
          </text>
        </svg>

        {/* controls */}
        <div className="mt-1 flex flex-wrap items-center gap-x-5 gap-y-2">
          <div className="flex items-center gap-1.5">
            <span className="font-mono text-[10px] text-muted-foreground">model</span>
            {MODELS.map((m, i) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setMi(i)}
                aria-pressed={mi === i}
                className={cn(
                  "cursor-pointer rounded-md border px-2 py-1 font-mono text-[10px] transition-colors",
                  mi === i ? "border-foreground/40 text-foreground" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {m.id}
              </button>
            ))}
          </div>
          <div className="ml-auto flex items-center gap-3 font-mono text-[10px] text-muted-foreground">
            {(["sensory", "workspace", "motor"] as const).map((s) => (
              <span key={s} className="flex items-center gap-1.5">
                <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: stageColor[s] }} /> {s}
              </span>
            ))}
          </div>
        </div>

        <div className="mt-3">
          <div className="mb-1 font-mono text-[10px] text-muted-foreground">relative depth (drag)</div>
          <Range
            min={0}
            max={100}
            value={Math.round(depth * 100)}
            onChange={(e) => setDepth(Number(e.target.value) / 100)}
            className="w-full cursor-pointer " accent="oklch(0.64 0.13 195)" />
        </div>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Each cell is the CKA between two layers&rsquo; token geometries: <span className="text-foreground">bright yellow</span> on the diagonal
          (a layer is identical to itself), fading through teal to purple as two layers stop arranging the vocabulary the same way. The three
          outlined squares are the model&rsquo;s <span style={{ color: SENSORY }}>sensory</span>,{" "}
          <span style={{ color: WORKSPACE }}>workspace</span>, and <span style={{ color: MOTOR }}>motor</span> stretches — blocks of adjacent
          layers that share one geometry. Switch the model: the layer count changes from {MODELS[0].layers} to {MODELS[2].layers}, but the block
          boundaries stay pinned at roughly the same relative depth (~{Math.round(SENS_END * 100)}% and ~{Math.round(MOTOR_START * 100)}%).
        </p>
      </div>
    </figure>
  )
}
