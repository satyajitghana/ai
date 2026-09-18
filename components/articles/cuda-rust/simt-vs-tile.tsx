"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// Same 16-element output, two ways of describing who owns which cell.
//
// SIMT (cuda-oxide): the grid is 16 threads, one per element. Each thread
// mints its own index (thread::index_1d()) and claims exactly one cell —
// you wrote that mapping, thread by thread.
//
// Tile (cutile-rs): the grid is a handful of "tile programs", each owning a
// contiguous span of cells as ONE logical thread. `.partition([tileWidth])`
// fixes how many tile programs exist and which span each one owns; nothing
// in the source says how many real hardware threads back a tile — that
// mapping is the compiler's, and it can change between architectures without
// touching the kernel. The dashed strip under each tile node is that hidden
// layer made visible: real threads exist, you just never name one.

const N = 16
const ACCENT = "oklch(0.60 0.15 255)"
const TILE_ACCENT = "oklch(0.62 0.14 195)"
const MUTED_LINE = "var(--border)"

const W = 760
const MX = 46
const CELL_Y = 214
const CELL_H = 28
const CELL_GAP = 3
const CELL_W = (W - 2 * MX - (N - 1) * CELL_GAP) / N
const cellX = (i: number) => MX + i * (CELL_W + CELL_GAP)
const cellCx = (i: number) => cellX(i) + CELL_W / 2

const NODE_Y = 34
const NODE_H = 30
const MAP_Y = NODE_Y + NODE_H + 14
const MAP_H = CELL_Y - MAP_Y - 10

type Mode = "simt" | "tile"

export function SimtVsTile() {
  const [mode, setMode] = useState<Mode>("simt")
  const [tileWidth, setTileWidth] = useState(4)

  const numTiles = Math.ceil(N / tileWidth)
  const accent = mode === "simt" ? ACCENT : TILE_ACCENT

  const curve = (x1: number, y1: number, x2: number, y2: number) => {
    const my = (y1 + y2) / 2
    return `M ${x1} ${y1} C ${x1} ${my}, ${x2} ${my}, ${x2} ${y2}`
  }

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          same 16-element output · who owns which cell
        </span>
        <span className="font-mono text-[10px]" style={{ color: accent }}>
          {mode === "simt" ? "16 threads, you indexed each one" : `${numTiles} tile program${numTiles > 1 ? "s" : ""}, compiler owns the rest`}
        </span>
      </div>

      <div className="p-3 sm:p-4">
        <div className="flex flex-wrap items-center gap-1.5">
          {(
            [
              ["simt", "SIMT — cuda-oxide"],
              ["tile", "Tile — cutile-rs"],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              type="button"
              onClick={() => setMode(k)}
              aria-pressed={mode === k}
              className={cn(
                "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
                mode === k
                  ? "border-foreground/30 bg-muted/50 text-foreground"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {label}
            </button>
          ))}
          {mode === "tile" ? (
            <>
              <span className="ml-2 font-mono text-[10px] text-muted-foreground">tile width</span>
              {[2, 4, 8].map((w) => (
                <button
                  key={w}
                  type="button"
                  onClick={() => setTileWidth(w)}
                  aria-pressed={tileWidth === w}
                  className={cn(
                    "cursor-pointer rounded-full border px-2 py-1 font-mono text-[10px] transition-colors",
                    tileWidth === w
                      ? "border-foreground/30 bg-muted/50 text-foreground"
                      : "border-border text-muted-foreground hover:text-foreground",
                  )}
                >
                  {w}
                </button>
              ))}
            </>
          ) : null}
        </div>

        <div className="mt-3 overflow-x-auto">
          <svg
            viewBox={`0 0 ${W} ${CELL_Y + CELL_H + 40}`}
            width={W}
            className="min-w-[640px] max-w-full"
            role="img"
            aria-label={
              mode === "simt"
                ? "Sixteen threads, each with its own index, each connected by a curved arrow to exactly one of sixteen output cells."
                : `${numTiles} tile programs, each owning a contiguous span of ${tileWidth} output cells, with a hidden strip of compiler-placed hardware threads shown underneath each tile.`
            }
          >
            <defs>
              <marker id="svt-arrow" viewBox="0 -5 10 10" markerWidth="6" markerHeight="6" orient="auto" refX="7" refY="0">
                <path d="M0,-4L6,0L0,4" fill="none" stroke={ACCENT} strokeWidth={1.5} />
              </marker>
              <filter id="svt-soft" x="-40%" y="-40%" width="180%" height="180%">
                <feDropShadow dx="0" dy="1" stdDeviation="1.3" floodOpacity="0.14" />
              </filter>
            </defs>

            {/* grouping label */}
            <text x={MX} y={18} fontSize={10.5} fontFamily="ui-monospace, monospace" fill="currentColor" opacity={0.65}>
              {mode === "simt" ? "block · blockDim.x = 16, one thread per cell" : "grid · partition([" + tileWidth + "]), one tile program per span"}
            </text>

            {mode === "simt" ? (
              <>
                {/* dashed block grouping */}
                <rect
                  x={MX - 10}
                  y={NODE_Y - 10}
                  width={W - 2 * (MX - 10)}
                  height={NODE_H + 20}
                  rx={10}
                  fill="none"
                  stroke={MUTED_LINE}
                  strokeDasharray="4 4"
                  opacity={0.6}
                />
                {Array.from({ length: N }, (_, i) => {
                  const x = cellCx(i)
                  const labelled = i === 0 || i === N - 1
                  return (
                    <g key={i}>
                      <rect
                        x={x - CELL_W / 2 + 2}
                        y={NODE_Y}
                        width={CELL_W - 4}
                        height={NODE_H}
                        rx={6}
                        fill="var(--background)"
                        stroke={ACCENT}
                        strokeWidth={1.3}
                        filter="url(#svt-soft)"
                      />
                      {labelled ? (
                        <text x={x} y={NODE_Y + NODE_H / 2 + 3} textAnchor="middle" fontSize={7} fontFamily="ui-monospace, monospace" fill="currentColor" opacity={0.75}>
                          {`t${i}`}
                        </text>
                      ) : null}
                      <path
                        d={curve(x, NODE_Y + NODE_H, cellCx(i), CELL_Y)}
                        fill="none"
                        stroke={ACCENT}
                        strokeWidth={1.3}
                        markerEnd="url(#svt-arrow)"
                        opacity={0.55}
                      />
                    </g>
                  )
                })}
              </>
            ) : (
              <>
                {Array.from({ length: numTiles }, (_, k) => {
                  const start = k * tileWidth
                  const width = Math.min(tileWidth, N - start)
                  const spanX0 = cellX(start)
                  const spanX1 = cellX(start + width - 1) + CELL_W
                  const nodeX0 = spanX0 + 3
                  const nodeX1 = spanX1 - 3
                  const nodeCx = (nodeX0 + nodeX1) / 2

                  return (
                    <g key={k}>
                      {/* funnel from tile node down to its cell span */}
                      <path
                        d={`M ${nodeX0} ${NODE_Y + NODE_H} C ${nodeX0} ${(NODE_Y + NODE_H + CELL_Y) / 2}, ${spanX0} ${(NODE_Y + NODE_H + CELL_Y) / 2}, ${spanX0} ${CELL_Y}
                            L ${spanX1} ${CELL_Y}
                            C ${spanX1} ${(NODE_Y + NODE_H + CELL_Y) / 2}, ${nodeX1} ${(NODE_Y + NODE_H + CELL_Y) / 2}, ${nodeX1} ${NODE_Y + NODE_H} Z`}
                        fill={TILE_ACCENT}
                        opacity={0.08}
                        stroke={TILE_ACCENT}
                        strokeOpacity={0.35}
                        strokeWidth={1}
                      />

                      {/* hidden hardware-thread strip */}
                      <rect
                        x={nodeX0}
                        y={MAP_Y}
                        width={nodeX1 - nodeX0}
                        height={MAP_H}
                        rx={5}
                        fill="none"
                        stroke={MUTED_LINE}
                        strokeDasharray="3 3"
                        opacity={0.7}
                      />
                      {Array.from({ length: width }, (_, j) => (
                        <line
                          key={j}
                          x1={nodeX0 + ((j + 0.5) * (nodeX1 - nodeX0)) / width}
                          x2={nodeX0 + ((j + 0.5) * (nodeX1 - nodeX0)) / width}
                          y1={MAP_Y + 5}
                          y2={MAP_Y + MAP_H - 5}
                          stroke="currentColor"
                          strokeOpacity={0.28}
                          strokeWidth={1.2}
                        />
                      ))}
                      <text
                        x={nodeCx}
                        y={MAP_Y + MAP_H / 2 + 3}
                        textAnchor="middle"
                        fontSize={6.5}
                        fontFamily="ui-monospace, monospace"
                        fill="currentColor"
                        opacity={0.5}
                      >
                        compiler-placed
                      </text>

                      {/* tile node */}
                      <rect
                        x={nodeX0}
                        y={NODE_Y}
                        width={nodeX1 - nodeX0}
                        height={NODE_H}
                        rx={7}
                        fill="var(--background)"
                        stroke={TILE_ACCENT}
                        strokeWidth={1.4}
                        filter="url(#svt-soft)"
                      />
                      <text x={nodeCx} y={NODE_Y + NODE_H / 2 + 3} textAnchor="middle" fontSize={8.5} fontFamily="ui-monospace, monospace" fill="currentColor">
                        {`pid=${k}`}
                      </text>
                    </g>
                  )
                })}
              </>
            )}

            {/* output cells */}
            {Array.from({ length: N }, (_, i) => (
              <rect
                key={i}
                x={cellX(i)}
                y={CELL_Y}
                width={CELL_W}
                height={CELL_H}
                rx={3}
                fill={accent}
                opacity={mode === "simt" ? 0.16 : 0.16 + 0.1 * (Math.floor(i / tileWidth) % 2)}
              />
            ))}
            <text x={MX} y={CELL_Y + CELL_H + 16} fontSize={9} fontFamily="ui-monospace, monospace" fill="currentColor" opacity={0.55}>
              global memory · c[0..16)
            </text>
          </svg>
        </div>

        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          {mode === "simt" ? (
            <>
              Sixteen threads, sixteen cells, one curved line each — the mapping is whatever{" "}
              <code className="font-mono text-[11px] text-foreground">thread::index_1d()</code>{" "}
              computes, and you wrote that formula. Change the block size and you are the one who
              re-derives which thread owns which cell.
            </>
          ) : (
            <>
              {numTiles} tile program{numTiles > 1 ? "s" : ""} claim the same sixteen cells as{" "}
              {numTiles > 1 ? "wide spans" : "one span"} instead of individual points. Inside each
              span a dashed strip marks real hardware threads that still exist and still do the
              work — the compiler places them, and the source never names one. Shrink the tile
              width and you get more, narrower spans over the same sixteen cells; grow it and you
              get fewer, wider ones. The kernel body does not change either way.
            </>
          )}
        </p>
      </div>
    </figure>
  )
}
