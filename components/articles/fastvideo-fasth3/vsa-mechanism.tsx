"use client"

import { useMemo, useState } from "react"

import { Range } from "@/components/articles/ui/range"

// An original diagram of VSA-H3, built from FastVideo's actual source
// (fastvideo/attention/backends/video_sparse_attn_h3.py, main branch) and the
// VSA paper (arXiv:2505.13389) -- not shipped by FastVideo as a figure.
//
// What the code actually says, precisely:
// - H3 runs ONE joint bidirectional attention over a packed sequence:
//   [text | condition keyframes | audio | generated video].
// - The video portion is partitioned into 3D tiles over its own (t, h, w)
//   latent grid -- FastH3 uses the 64-token tile shape (4, 4, 4) (the other
//   supported shape is 256 tokens, (4, 8, 8)). A coarse stage pools each tile
//   to one score per query, a fine stage computes exact token-level attention
//   only inside the selected tiles.
// - "compute_topk" keeps ceil((1 - sparsity) * num_blocks) tiles -- FastH3's
//   trained default is 90% sparsity, so ~10% of tiles survive per query.
// - Non-video QUERIES (text, audio) are always dense. Non-video KEYS default
//   to "exempt": always included for every video query, never competing for a
//   top-k slot -- a separate, smaller "compete" mode exists but isn't the
//   FastH3 default.
// - `to_gate_compress` is a learned per-head gate on a pooled/compressed
//   attention signal, run alongside the fine top-k attention. The base H3
//   checkpoint doesn't carry it (the loader zero-initializes it, so untrained
//   inference is exactly plain sparse attention); FastH3's distilled students
//   ship *trained* gate weights, confirmed directly from the checkpoint's own
//   safetensors header: a [7168, 5376] to_gate_compress.weight tensor exists
//   in all 50 transformer blocks, ~1.93B parameters the base checkpoint does
//   not have.
//
// The tile grid below is illustrative -- a 10x6 layout standing in for
// whatever the video's real (t, h, w) tile count happens to be at a given
// resolution/duration. Tile *scores* are a fixed deterministic function of
// grid position (integer arithmetic only, no RNG), chosen to scatter a few
// high-ranked tiles away from the query so the picture doesn't look like a
// simple local window -- VSA's selection is content-scored, not proximity-only.

const COLS = 10
const ROWS = 6
const N = COLS * ROWS

function scoreOf(row: number, col: number): number {
  // deterministic pseudo-scatter, integer-only
  return (row * 7 + col * 13 + row * col * 3) % 60
}

const CELLS = Array.from({ length: N }, (_, i) => {
  const row = Math.floor(i / COLS)
  const col = i % COLS
  return { row, col, score: scoreOf(row, col) }
})

const SELECTED = "oklch(0.55 0.16 155)"
const SKIPPED = "oklch(0.55 0 0)"
const DENSE = "oklch(0.68 0.13 85)"
const GATE = "oklch(0.60 0.15 255)"

export function VsaMechanism() {
  const [keepPct, setKeepPct] = useState(10)

  const { selectedSet, k } = useMemo(() => {
    const kk = Math.max(1, Math.round((keepPct / 100) * N))
    const ranked = [...CELLS].sort((a, b) => b.score - a.score)
    const sel = new Set(ranked.slice(0, kk).map((c) => c.row * COLS + c.col))
    return { selectedSet: sel, k: kk }
  }, [keepPct])

  const cellW = 28
  const cellH = 24
  const gridX = 30
  const gridY = 20

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">VSA-H3, one query&rsquo;s tile selection (illustrative)</span>
        <span className="font-mono text-[10px]" style={{ color: SELECTED }}>
          64-token tiles (4×4×4) · trained default 90% sparsity
        </span>
      </div>

      <div className="p-3 sm:p-4">
        <div className="mb-3 flex items-center gap-3">
          <span className="font-mono text-[10px] text-muted-foreground shrink-0">tiles kept</span>
          <Range
            min={5}
            max={50}
            step={1}
            value={keepPct}
            onChange={(e) => setKeepPct(Number(e.target.value))}
            accent={SELECTED}
            className="max-w-[220px]"
          />
          <span className="font-mono text-[10px] tabular-nums" style={{ color: SELECTED }}>
            {keepPct}% ({k} of {N} tiles, {100 - keepPct}% sparse)
          </span>
        </div>

        <div className="overflow-x-auto">
          <svg
            viewBox={`0 0 700 ${gridY + ROWS * cellH + 60}`}
            width={700}
            height={gridY + ROWS * cellH + 60}
            role="img"
            className="min-w-[600px] max-w-full"
          >
            <title>
              {`A ${COLS} by ${ROWS} illustrative grid of video tiles for one query. At ${keepPct}% kept, ${k} of ${N} tiles are selected for exact fine-grained attention, scattered by content score rather than clustered only near the query. A separate always-dense row represents text and audio tokens, which are exempt from the top-k competition entirely.`}
            </title>

            {/* video tile grid */}
            {CELLS.map((c) => {
              const x = gridX + c.col * cellW
              const y = gridY + c.row * cellH
              const isSel = selectedSet.has(c.row * COLS + c.col)
              return (
                <rect
                  key={`${c.row}-${c.col}`}
                  x={x + 1}
                  y={y + 1}
                  width={cellW - 2}
                  height={cellH - 2}
                  rx={2}
                  fill={isSel ? SELECTED : SKIPPED}
                  fillOpacity={isSel ? 0.85 : 0.12}
                />
              )
            })}
            <text x={gridX} y={gridY - 6} fontSize={7.5} fill="currentColor" fillOpacity={0.5} fontFamily="ui-monospace, monospace">
              video tokens, tiled 4×4×4 (t,h,w) — {N} illustrative tiles, {k} selected for query
            </text>

            {/* dense text/audio row */}
            {Array.from({ length: 8 }, (_, i) => (
              <rect
                key={`ta-${i}`}
                x={gridX + i * cellW + 1}
                y={gridY + ROWS * cellH + 14}
                width={cellW - 2}
                height={16}
                rx={2}
                fill={DENSE}
                fillOpacity={0.8}
              />
            ))}
            <text
              x={gridX + 8 * cellW + 8}
              y={gridY + ROWS * cellH + 26}
              fontSize={7.5}
              fill={DENSE}
              fontFamily="ui-monospace, monospace"
            >
              text + audio keys — always exempt, never compete for top-k
            </text>
          </svg>
        </div>

        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          Every query still <em>sees</em> the whole sequence — a coarse pooling stage scores every
          tile cheaply first. What changes with the slider is how many{" "}
          <span style={{ color: SELECTED }}>video tiles</span> survive to the expensive, exact
          fine-grained attention step: at the trained default, 90% sparsity, only about 10% do. The{" "}
          <span style={{ color: DENSE }}>text and audio</span> row never shrinks — H3&rsquo;s packed
          sequence keeps non-video keys dense regardless of the slider, and non-video queries are
          dense too, so a text or audio token never loses information to sparsity at all. The
          learned <span style={{ color: GATE }}>compression gate</span> (<code>to_gate_compress</code>
          , verified as a real, trained ~1.93B-parameter weight in FastH3&rsquo;s own checkpoint,
          absent from base H3&rsquo;s) blends a pooled signal from the skipped tiles back in, so even
          the 90% that lose the top-k competition aren&rsquo;t discarded outright.
        </p>
      </div>
    </figure>
  )
}
