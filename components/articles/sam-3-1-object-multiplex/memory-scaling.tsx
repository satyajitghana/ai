"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"

// Why "~7× faster" is a statement about the *shape* of a curve, not a constant.
//
// SAM 3 runs the memory path once per tracked object: N memory banks, N forward
// passes, cost linear in N. Object Multiplex packs objects into buckets of 16
// slots and runs that path once per bucket — ceil(N/16) passes. Drag the object
// count and watch the pass counter on the two rails diverge, then watch the
// measured frame time follow it.
//
// Every FPS number here is Meta's own printed data label from the three-line
// efficiency figure shipped in RELEASE_SAM3p1.md, so the slider only stops on
// the eight object counts Meta actually measured. The frame times are 1000/fps
// from those labels. The one inferred quantity on screen is the dashed "frame
// backbone" floor — a least-squares intercept over those eight points, drawn as
// a marker rather than a bar segment because Meta never published the split.

const ACCENT = "oklch(0.58 0.16 250)" // multiplex
const MUTED = "oklch(0.62 0.03 260)" // per-object SAM 3

const N = [1, 2, 4, 8, 16, 32, 64, 128]
const NOV = [26.5, 23.8, 19.7, 14.6, 9.8, 5.8, 3.0, 1.6] // SAM 3, Nov 2025 release
const MUX = [33.8, 33.3, 32.5, 31.6, 30.2, 22.1, 15.1, 11.5] // SAM 3.1

const SLOTS = 16 // multiplex_count, the shipped default
// Least squares over the eight measured points puts the intercept at 30.9 ms for
// SAM 3 and 29.0 ms for SAM 3.1 — i.e. the same floor, the per-frame backbone,
// which both versions already shared. Drawn at the lower of the two so the
// marker never lands past a measured bar.
const FLOOR = 29

const W = 700
const COLS = 16
const CELL = 15
const GAP = 3
const GRID_X = 116
const GRID_Y = 34
const RAIL_X = 116
const RAIL_W = W - RAIL_X - 74

// Bar geometry: the slowest case on the slider sets the scale, so the bars
// shrink as the reader drags left instead of rescaling under them.
const MAX_MS = 1000 / NOV[NOV.length - 1]

export function MemoryScaling() {
  const [i, setI] = useState(4)

  const n = N[i]
  const buckets = Math.ceil(n / SLOTS)
  const rows = Math.ceil(n / COLS)
  const msNov = 1000 / NOV[i]
  const msMux = 1000 / MUX[i]
  const speed = MUX[i] / NOV[i]

  const gridH = rows * CELL + (rows - 1) * GAP
  const railNovY = GRID_Y + gridH + 46
  const railMuxY = railNovY + 40
  const barY = railMuxY + 44
  const H = barY + 92

  const barW = (ms: number) => Math.max(2, (ms / MAX_MS) * RAIL_W)

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/20 to-transparent">
      <div className="flex items-center justify-between border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>the memory path, once per object vs once per bucket</span>
        <span className="text-muted-foreground/60">
          single H100 · Meta&apos;s measured points
        </span>
      </div>

      <div className="p-4 sm:p-5">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
          <div>
            <div className="font-mono text-[10px] text-muted-foreground">
              objects tracked
            </div>
            <div className="font-mono text-2xl font-semibold tabular-nums text-foreground">
              {n}
            </div>
          </div>
          <div className="flex gap-5 text-right">
            <div>
              <div className="font-mono text-[10px]" style={{ color: MUTED }}>
                SAM 3
              </div>
              <div
                className="font-mono text-xl font-semibold tabular-nums"
                style={{ color: MUTED }}
              >
                {NOV[i].toFixed(1)}
                <span className="text-xs"> fps</span>
              </div>
            </div>
            <div>
              <div className="font-mono text-[10px]" style={{ color: ACCENT }}>
                SAM 3.1
              </div>
              <div
                className="font-mono text-xl font-semibold tabular-nums"
                style={{ color: ACCENT }}
              >
                {MUX[i].toFixed(1)}
                <span className="text-xs"> fps</span>
              </div>
            </div>
            <div>
              <div className="font-mono text-[10px] text-muted-foreground">
                multiplex is
              </div>
              <div className="font-mono text-xl font-semibold tabular-nums text-foreground">
                {speed >= 1
                  ? `${speed.toFixed(2)}×`
                  : `${(1 / speed).toFixed(2)}×`}
                <span className="text-xs text-muted-foreground">
                  {speed >= 1 ? " faster" : " slower"}
                </span>
              </div>
            </div>
          </div>
        </div>

        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full"
          role="img"
          aria-label={`At ${n} tracked objects, SAM 3 runs ${n} memory-path passes at ${msNov.toFixed(0)} milliseconds per frame, and SAM 3.1 runs ${buckets} bucket ${buckets === 1 ? "pass" : "passes"} at ${msMux.toFixed(0)} milliseconds per frame.`}
        >
          <defs>
            <filter
              id="ms-soft"
              x="-40%"
              y="-40%"
              width="180%"
              height="180%"
            >
              <feDropShadow
                dx="0"
                dy="1"
                stdDeviation="1.4"
                floodOpacity="0.14"
              />
            </filter>
          </defs>

          {/* ── the objects, laid out sixteen to a bucket ───────────────── */}
          <text
            x={GRID_X - 12}
            y={GRID_Y + 11}
            textAnchor="end"
            className="fill-muted-foreground font-mono"
            fontSize={10}
          >
            objects
          </text>
          {Array.from({ length: rows }, (_, r) => {
            const inRow = Math.min(COLS, n - r * COLS)
            const y = GRID_Y + r * (CELL + GAP)
            return (
              <g key={r}>
                <rect
                  x={GRID_X - 5}
                  y={y - 4}
                  width={COLS * CELL + (COLS - 1) * GAP + 10}
                  height={CELL + 8}
                  rx={6}
                  fill="none"
                  stroke={ACCENT}
                  strokeWidth={1.2}
                  opacity={0.5}
                  strokeDasharray="4 3"
                />
                {Array.from({ length: COLS }, (_, c) => (
                  <rect
                    key={c}
                    x={GRID_X + c * (CELL + GAP)}
                    y={y}
                    width={CELL}
                    height={CELL}
                    rx={3}
                    fill={c < inRow ? ACCENT : "var(--muted)"}
                    opacity={c < inRow ? 0.75 : 0.5}
                  />
                ))}
                <text
                  x={GRID_X + COLS * (CELL + GAP) + 12}
                  y={y + 11}
                  className="fill-muted-foreground font-mono"
                  fontSize={9}
                >
                  bucket {r + 1}
                </text>
              </g>
            )
          })}

          {/* ── rail 1: SAM 3, one memory-path pass per object ──────────── */}
          <Rail
            y={railNovY}
            label="SAM 3"
            sub="one bank per object"
            ticks={n}
            color={MUTED}
            count={`${n} pass${n === 1 ? "" : "es"}`}
          />
          {/* ── rail 2: SAM 3.1, one pass per bucket ────────────────────── */}
          <Rail
            y={railMuxY}
            label="SAM 3.1"
            sub="one bank per bucket"
            ticks={buckets}
            color={ACCENT}
            count={`${buckets} pass${buckets === 1 ? "" : "es"}`}
          />

          {/* ── measured frame time ─────────────────────────────────────── */}
          <text
            x={RAIL_X - 12}
            y={barY + 1}
            textAnchor="end"
            className="fill-muted-foreground font-mono"
            fontSize={10}
          >
            ms / frame
          </text>
          <rect
            x={RAIL_X}
            y={barY - 9}
            width={barW(msNov)}
            height={18}
            rx={4}
            fill={MUTED}
            opacity={0.55}
            filter="url(#ms-soft)"
          />
          <text
            x={RAIL_X + barW(msNov) + 8}
            y={barY + 4}
            className="fill-muted-foreground font-mono"
            fontSize={10}
          >
            {msNov.toFixed(0)}
          </text>
          <rect
            x={RAIL_X}
            y={barY + 19}
            width={barW(msMux)}
            height={18}
            rx={4}
            fill={ACCENT}
            opacity={0.8}
            filter="url(#ms-soft)"
          />
          <text
            x={RAIL_X + barW(msMux) + 8}
            y={barY + 32}
            className="fill-muted-foreground font-mono"
            fontSize={10}
          >
            {msMux.toFixed(0)}
          </text>

          {/* the shared floor: a fitted intercept, drawn as a marker */}
          <line
            x1={RAIL_X + barW(FLOOR)}
            x2={RAIL_X + barW(FLOOR)}
            y1={barY - 16}
            y2={barY + 44}
            stroke="currentColor"
            className="text-foreground/35"
            strokeWidth={1}
            strokeDasharray="3 3"
          />
          <text
            x={RAIL_X + barW(FLOOR) + 6}
            y={barY + 58}
            className="fill-muted-foreground font-mono"
            fontSize={9}
          >
            ≈29–31 ms frame backbone — shared in both, and already was
          </text>
          <text
            x={RAIL_X}
            y={barY + 76}
            className="fill-muted-foreground font-mono"
            fontSize={9}
          >
            everything right of that line is the memory path
          </text>
        </svg>

        <label className="mt-2 block">
          <span className="sr-only">number of tracked objects</span>
          <Range
            min={0}
            max={N.length - 1}
            step={1}
            value={i}
            onChange={(e) => setI(Number(e.target.value))}
            className="w-full cursor-pointer"
            accent={ACCENT}
          />
        </label>
        <div className="mt-1 flex justify-between font-mono text-[10px] text-muted-foreground">
          {N.map((v) => (
            <span key={v}>{v}</span>
          ))}
        </div>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          The slider stops only where Meta measured. Below sixteen objects
          everything fits in one bucket and SAM 3.1 barely moves — its frame time
          goes 29.6 ms to 33.1 ms across a sixteen-fold increase in objects,
          while SAM 3 goes 37.7 ms to 102.0 ms. Past sixteen a second bucket
          opens and the multiplex line starts to climb too, just eight times
          more slowly. That divergence is the whole result: the headline{" "}
          <span className="text-foreground">7×</span> is this gap read off at
          128 objects, and the <span className="text-foreground">2×</span> in
          Meta&apos;s blog post is the same gap read off at about seven.
        </p>
      </div>
    </figure>
  )
}

function Rail({
  y,
  label,
  sub,
  ticks,
  color,
  count,
}: {
  y: number
  label: string
  sub: string
  ticks: number
  color: string
  count: string
}) {
  // One slot per possible pass, so rail length reads as pass count: 128 passes
  // fills the rail, 8 fills a sixteenth of it. They crowd on purpose.
  const step = RAIL_W / 128
  return (
    <g>
      <text
        x={RAIL_X - 12}
        y={y - 2}
        textAnchor="end"
        className="font-mono"
        fontSize={10}
        fill={color}
      >
        {label}
      </text>
      <text
        x={RAIL_X - 12}
        y={y + 10}
        textAnchor="end"
        className="fill-muted-foreground font-mono"
        fontSize={8}
      >
        {sub}
      </text>
      <line
        x1={RAIL_X}
        x2={RAIL_X + RAIL_W}
        y1={y + 2}
        y2={y + 2}
        stroke="currentColor"
        className="text-border"
        strokeWidth={1}
      />
      {Array.from({ length: ticks }, (_, k) => (
        <rect
          key={k}
          x={RAIL_X + k * step + 0.6}
          y={y - 8}
          width={step - 1.2}
          height={20}
          rx={1}
          fill={color}
          opacity={0.75}
        />
      ))}
      <text
        x={RAIL_X + RAIL_W + 10}
        y={y + 6}
        className="fill-muted-foreground font-mono"
        fontSize={10}
      >
        {count}
      </text>
    </g>
  )
}
