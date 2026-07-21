"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"
import { Range } from "@/components/articles/ui/range"
import {
  ATT,
  FigureCard,
  GLOBAL,
  IDX,
  Legend,
  LOCAL,
  PlayPause,
  Segmented,
  useReducedMotion,
  useTicker,
} from "./shared"

// The shared AttentionMask primitive: a query × key matrix where a movable query
// cursor lights exactly the keys it is allowed to read under a chosen mask
// pattern. One grid, seven mechanisms — the reader learns the colours here and
// carries them through every later diagram. Patterns are pure functions of
// (query, key); the sweep just animates the cursor. Illustrative geometry; real
// windows/blocks are far larger (noted in the prose).

const N = 18 // sequence positions
const B = 3 // block size for block-structured patterns
const NBLK = N / B

type Pattern =
  | "full"
  | "causal"
  | "window"
  | "sink"
  | "dilated"
  | "block"
  | "selected"

type Cell = "no" | "att" | "local" | "global" | "sel"

const PATTERNS: { id: Pattern; label: string }[] = [
  { id: "full", label: "bidirectional" },
  { id: "causal", label: "causal" },
  { id: "window", label: "sliding-window" },
  { id: "sink", label: "sink + local" },
  { id: "dilated", label: "dilated" },
  { id: "block", label: "block-sparse" },
  { id: "selected", label: "block-selected" },
]

const NOTE: Record<Pattern, string> = {
  full: "Encoder / bidirectional attention: every query reads the whole sequence, both directions. Cost is the full O(N²) matrix — fine for short inputs, the thing every sparse variant below is trying to avoid.",
  causal: "Decoder attention: a query at position q reads positions 0…q only. The strict lower triangle. Still O(N²) work, but each token's future is hidden so the model can generate left-to-right.",
  window: "Sliding-window (Mistral): a query reads only the last w keys. Cost drops to O(N·w). Stacking L such layers compounds the receptive field to ~L·w, so depth buys back the reach a single layer gives up.",
  sink: "Attention sink + local window (StreamingLLM): keep the first few tokens forever — they soak up excess attention mass — plus a recent window. Lets a fixed-size cache stream unbounded text without the perplexity blow-up you get from evicting position 0.",
  dilated: "Dilated / strided (Sparse Transformer): read every d-th key plus a small local band. A single head skips across the sequence at stride d; combine strided + local heads and any position is reachable in a couple of hops. O(N·√N) in the fixed scheme.",
  block: "Block-sparse (BigBird): fixed structure at block granularity — the query's own block (local) + a global block every token sees + a random block for mixing. O(N) and, with the global/random blocks, still a universal sequence approximator.",
  selected: "Content-based block selection (NSA / MiniMax / LongCat): score the past in blocks, keep the top-k by relevance for this query, always add the local block. The read set is chosen per query from the content, not fixed by position.",
}

// deterministic content score for block-selection (no randomness at render time)
function blockScore(q: number, b: number) {
  const s = Math.sin((b + 1) * 1.9 + q * 0.6)
  const t = Math.cos((b + 1) * 0.5 + q * 0.33)
  return (s * 0.6 + t * 0.4 + 1) / 2
}

function selectedBlocks(q: number, k: number) {
  const bq = Math.floor(q / B)
  const past = Array.from({ length: bq }, (_, b) => b).sort(
    (a, c) => blockScore(q, c) - blockScore(q, a)
  )
  return new Set(past.slice(0, k))
}

function cellState(
  pattern: Pattern,
  q: number,
  k: number,
  p: { w: number; sink: number; dil: number; topk: number }
): Cell {
  if (pattern === "full") return "att"
  if (k > q) return "no" // everything below is causal
  switch (pattern) {
    case "causal":
      return "att"
    case "window":
      return q - k < p.w ? "local" : "no"
    case "sink":
      if (k < p.sink) return "global"
      return q - k < p.w ? "local" : "no"
    case "dilated":
      if (q - k < 2) return "local"
      return (q - k) % p.dil === 0 ? "att" : "no"
    case "block": {
      const bq = Math.floor(q / B)
      const bk = Math.floor(k / B)
      if (bk === bq) return "local"
      if (bk === 0) return "global"
      if (bk === ((bq * 2 + 1) % NBLK) && bk < bq) return "att"
      return "no"
    }
    case "selected": {
      const bq = Math.floor(q / B)
      const bk = Math.floor(k / B)
      if (bk === bq) return "local"
      return selectedBlocks(q, p.topk).has(bk) ? "sel" : "no"
    }
  }
}

const COLOR: Record<Cell, string> = {
  no: "var(--muted-foreground)",
  att: ATT,
  local: LOCAL,
  global: GLOBAL,
  sel: IDX,
}

// geometry
const GX = 90
const GY = 46
const CELL = 21
const GW = N * CELL
const W = GX + GW + 18
const H = GY + N * CELL + 30
const cx = (k: number) => GX + k * CELL
const cy = (q: number) => GY + q * CELL

export function MaskExplorer() {
  const reduced = useReducedMotion()
  const [pattern, setPattern] = useState<Pattern>("window")
  const [q, setQ] = useState(N - 1)
  const [w, setW] = useState(5)
  const [playing, setPlaying] = useState(false)

  // sweep the query cursor down the sequence (a sliding window sweeping the past)
  useTicker(playing, reduced, 320, () => setQ((x) => (x + 1) % N))

  const params = { w, sink: 2, dil: 3, topk: 2 }

  // attended-key count for the active query row
  let reads = 0
  for (let k = 0; k < N; k++) if (cellState(pattern, q, k, params) !== "no") reads++

  const usesWindow = pattern === "window" || pattern === "sink"
  const complexity: Record<Pattern, string> = {
    full: "O(N²)",
    causal: "O(N²)",
    window: "O(N·w)",
    sink: "O(N·w)",
    dilated: "O(N·√N)",
    block: "O(N)",
    selected: "O(N·k)",
  }

  return (
    <FigureCard
      label="attention mask · one query, its allowed keys"
      right={<PlayPause playing={playing} onToggle={() => setPlaying((p) => !p)} hidden={reduced} />}
    >
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        role="img"
        aria-label={`${pattern} attention. Query at position ${q} reads ${reads} of ${q + 1} keys.`}
      >
        {/* axis labels */}
        <text x={GX} y={26} className="fill-muted-foreground font-mono" fontSize={11}>
          keys →
        </text>
        <text
          x={20}
          y={GY + 4}
          className="fill-muted-foreground font-mono"
          fontSize={11}
          transform={`rotate(-90 20 ${GY + 4})`}
        >
          queries ↓
        </text>

        {/* active-row highlight band */}
        <rect
          x={GX - 4}
          y={cy(q) - 1}
          width={GW + 8}
          height={CELL + 2}
          rx={4}
          fill="var(--foreground)"
          opacity={0.05}
        />

        {/* the matrix */}
        {Array.from({ length: N }, (_, qi) =>
          Array.from({ length: N }, (_, ki) => {
            const st = cellState(pattern, qi, ki, params)
            const active = qi === q
            let op = 0.045
            if (st !== "no") op = active ? 0.92 : 0.16
            else if (active) op = 0.07
            return (
              <rect
                key={`${qi}-${ki}`}
                x={cx(ki) + 1}
                y={cy(qi) + 1}
                width={CELL - 2}
                height={CELL - 2}
                rx={3}
                fill={COLOR[st]}
                opacity={op}
                className="transition-all duration-200"
              />
            )
          })
        )}

        {/* query cursor marker on the left */}
        <path
          d={`M ${GX - 10} ${cy(q) + CELL / 2 - 5} L ${GX - 3} ${cy(q) + CELL / 2} L ${GX - 10} ${cy(q) + CELL / 2 + 5} Z`}
          fill="var(--foreground)"
        />
        <text
          x={GX - 16}
          y={cy(q) + CELL / 2 + 3.5}
          textAnchor="end"
          className="fill-foreground font-mono"
          fontSize={10}
          fontWeight={600}
        >
          {q}
        </text>

        {/* readout pinned bottom-right */}
        <text
          x={W - 4}
          y={H - 8}
          textAnchor="end"
          className="fill-muted-foreground font-mono"
          fontSize={10}
        >
          reads {reads} / {q + 1} keys · {complexity[pattern]}
        </text>
      </svg>

      {/* pattern selector */}
      <div className="mt-2">
        <Segmented value={pattern} options={PATTERNS} onChange={setPattern} ariaLabel="mask pattern" />
      </div>

      {/* controls row */}
      <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-3">
        <label className="flex min-w-[180px] flex-1 flex-col gap-1">
          <span className="flex items-center justify-between font-mono text-[10px] text-muted-foreground">
            <span>query position</span>
            <span className="tabular-nums text-foreground">{q}</span>
          </span>
          <Range
            min={0}
            max={N - 1}
            value={q}
            onChange={(e) => setQ(Number(e.target.value))}
            className="w-full cursor-pointer"
            style={{ accentColor: ATT }}
          />
        </label>
        {usesWindow && (
          <label className="flex min-w-[140px] flex-1 flex-col gap-1">
            <span className="flex items-center justify-between font-mono text-[10px] text-muted-foreground">
              <span>window w</span>
              <span className="tabular-nums text-foreground">{w}</span>
            </span>
            <Range
              min={2}
              max={9}
              value={w}
              onChange={(e) => setW(Number(e.target.value))}
              className="w-full cursor-pointer"
              style={{ accentColor: LOCAL }}
            />
          </label>
        )}
      </div>

      <Legend
        items={[
          { color: ATT, label: "attended" },
          { color: LOCAL, label: "local window" },
          { color: GLOBAL, label: "global / sink" },
          { color: IDX, label: "content-selected" },
          { color: "var(--muted-foreground)", label: "masked out", op: 0.12 },
        ]}
      />

      <p className={cn("mt-3 text-sm leading-6 text-muted-foreground")}>{NOTE[pattern]}</p>
    </FigureCard>
  )
}
