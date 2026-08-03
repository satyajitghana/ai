"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"

// The paper's free lunch, made clickable. A handful of cells are "user-authored" — a
// path of blocks placed by hand, exactly like the paper's seeded spirals and
// waterfalls. Under MD4 (masked discrete diffusion), those cells are simply never
// selected by the forward masking process — their color at step 0 is their color
// forever. Every other cell starts as [MASK] and resolves over steps, nearest to the
// fixed path first. Nothing here is a trained model; the reveal order and final blocks
// are hand-picked so the one true point stays visible: fixed cells never move.

const COLS = 10
const ROWS = 6
const STEPS = 10

type Block = "grass" | "water" | "sand" | "rock" | "path"

const COLOR: Record<Block, string> = {
  grass: "oklch(0.62 0.14 145)",
  water: "oklch(0.62 0.12 235)",
  sand: "oklch(0.78 0.09 85)",
  rock: "oklch(0.55 0.02 260)",
  path: "oklch(0.68 0.16 55)",
}

// hand-authored final scene, row-major
const ROWS_DATA: Block[][] = [
  ["grass", "grass", "grass", "grass", "sand", "sand", "sand", "grass", "path", "grass"],
  ["grass", "grass", "water", "water", "sand", "grass", "path", "path", "rock", "grass"],
  ["grass", "water", "water", "water", "path", "path", "grass", "rock", "rock", "grass"],
  ["grass", "grass", "path", "path", "grass", "grass", "grass", "grass", "grass", "grass"],
  ["sand", "path", "grass", "grass", "grass", "grass", "grass", "grass", "grass", "sand"],
  ["sand", "sand", "sand", "grass", "grass", "grass", "grass", "grass", "grass", "sand"],
]

const FIXED: boolean[][] = ROWS_DATA.map((row) => row.map((b) => b === "path"))

// reveal order for the free (non-fixed) cells: nearest to a fixed path cell first,
// Manhattan distance, ties broken row-major — deterministic, no randomness.
const fixedCoords: { x: number; y: number }[] = []
for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) if (FIXED[y][x]) fixedCoords.push({ x, y })

const freeCells: { x: number; y: number; dist: number }[] = []
for (let y = 0; y < ROWS; y++) {
  for (let x = 0; x < COLS; x++) {
    if (FIXED[y][x]) continue
    let dist = Infinity
    for (const f of fixedCoords) dist = Math.min(dist, Math.abs(f.x - x) + Math.abs(f.y - y))
    freeCells.push({ x, y, dist })
  }
}
freeCells.sort((a, b) => a.dist - b.dist || a.y - b.y || a.x - b.x)

const CELL = 34
const GAP = 3
const W = COLS * (CELL + GAP) - GAP
const H = ROWS * (CELL + GAP) - GAP

export function MaskGrid() {
  const [step, setStep] = useState(4)
  const revealedCount = Math.round((step / STEPS) * freeCells.length)
  const revealed = new Set(freeCells.slice(0, revealedCount).map((c) => `${c.x},${c.y}`))

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        masked diffusion inpainting — fixed blocks vs. resolving blocks
      </div>

      <div className="p-3 sm:p-4">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="mx-auto w-full max-w-[480px]"
          role="img"
          aria-label={`Block grid, step ${step} of ${STEPS}. ${fixedCoords.length} user-fixed blocks stay unchanged; ${revealedCount} of ${freeCells.length} generated blocks have resolved so far.`}
        >
          {ROWS_DATA.map((row, y) =>
            row.map((block, x) => {
              const fixed = FIXED[y][x]
              const shown = fixed || revealed.has(`${x},${y}`)
              const rx = x * (CELL + GAP)
              const ry = y * (CELL + GAP)
              return (
                <g key={`${x}-${y}`}>
                  <rect
                    x={rx}
                    y={ry}
                    width={CELL}
                    height={CELL}
                    rx={5}
                    fill={shown ? COLOR[block] : "var(--muted)"}
                    fillOpacity={shown ? 0.95 : 0.5}
                    stroke={fixed ? "var(--foreground)" : "var(--border)"}
                    strokeWidth={fixed ? 2 : 1}
                    strokeDasharray={!shown ? "2 2" : undefined}
                    className="transition-all duration-300"
                  />
                  {!shown ? (
                    <text
                      x={rx + CELL / 2}
                      y={ry + CELL / 2 + 3}
                      textAnchor="middle"
                      className="fill-muted-foreground font-mono"
                      fontSize={8}
                    >
                      ·
                    </text>
                  ) : null}
                </g>
              )
            })
          )}
        </svg>

        <div className="mt-4">
          <div className="mb-1 flex items-center justify-between font-mono text-xs text-muted-foreground">
            <span>denoising step</span>
            <span className="tabular-nums text-foreground">
              {step} / {STEPS}
            </span>
          </div>
          <Range
            min={0}
            max={STEPS}
            step={1}
            value={step}
            onChange={(e) => setStep(parseInt(e.target.value, 10))}
            className="w-full cursor-pointer"
            aria-label="denoising step"
            accent="oklch(0.68 0.16 55)"
          />
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-1 font-mono text-[11px] text-muted-foreground">
          <span>
            user-fixed blocks <span className="text-foreground">{fixedCoords.length}</span>{" "}
            — never masked
          </span>
          <span>
            generated blocks resolved{" "}
            <span className="text-foreground">
              {revealedCount}/{freeCells.length}
            </span>
          </span>
        </div>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          The path cells (thick outline) were never part of the corruption process — MD4
          masks each voxel independently, and a user-fixed voxel simply is never sampled
          for masking, at any step. So it holds its true block from step 0 through step{" "}
          {STEPS}, no re-noising, no clamping, no extra machinery. Drag the step slider:
          the dotted cells are still <code>[MASK]</code>{" "}and resolve nearest the fixed
          path first, but the path itself never so much as flickers.
        </p>
      </div>
    </figure>
  )
}
