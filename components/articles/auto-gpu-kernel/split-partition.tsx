"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"

// The one structural idea in the winning sparse-attention kernel that a diagram
// explains better than prose: how the 2048-wide top-k axis is handed out to the
// NUM_SPLITS CTAs that share a token.
//
// It only works because of a property of the data, which the loop's own
// workload-inspector found and I re-counted from the contest trace set: the
// valid indices are a contiguous prefix followed by -1 padding (per-token
// contiguity p50 = 1.00), and the median token has 33 valid entries out of
// 2048. Under the obvious contiguous chunking, a prefix of V valid entries
// lands entirely inside the first few splits and the rest of the CTAs do
// nothing while the grid waits for the stragglers. Under the stride partition
// the kernel actually ships —
//
//     offs_split = s + tl.arange(0, SPLIT_SIZE) * NUM_SPLITS
//         — archive/.../solution/triton/sparse_fused.py
//
// — split s owns positions {s, s+S, s+2S, …}, so a prefix of length V spreads
// across every split as about V/S each.
//
// The per-split loop bound is computed in the kernel as
//     num_valid = tl.sum((idx_scan >= 0).to(tl.int32))
//     max_bn    = ceil(num_valid / BLOCK_N) * BLOCK_N
// with BLOCK_N = 128, so a split's cost is ceil(its valid count / 128)
// iterations and a split with nothing valid pays nearly nothing. Everything
// this widget computes is that integer arithmetic.

const BLOCK_N = 128
const TOPK = 2048

const BUSY = "oklch(0.60 0.15 255)"
const IDLE = "oklch(0.72 0.02 260)"

const ceilDiv = (a: number, b: number) => Math.ceil(a / b)

function contiguous(valid: number, splits: number): number[] {
  const size = TOPK / splits
  return Array.from({ length: splits }, (_, s) =>
    Math.max(0, Math.min(size, valid - s * size))
  )
}

function strided(valid: number, splits: number): number[] {
  return Array.from({ length: splits }, (_, s) =>
    valid > s ? ceilDiv(valid - s, splits) : 0
  )
}

function Strip({
  title,
  counts,
  note,
  peak,
}: {
  title: string
  counts: number[]
  note: string
  peak: number
}) {
  const iters = counts.map((v) => ceilDiv(v, BLOCK_N))
  const critical = Math.max(...iters)
  const idle = counts.filter((v) => v === 0).length

  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
        <span className="text-sm font-medium">{title}</span>
        <span className="font-mono text-xs tabular-nums">
          {critical} iter{critical === 1 ? "" : "s"} on the critical path
        </span>
      </div>

      <div
        className="mt-2 flex items-end gap-[3px]"
        style={{ height: 76 }}
        role="img"
        aria-label={`${title}: per-split valid counts ${counts.join(", ")}; the busiest split runs ${critical} inner-loop iterations and ${idle} of ${counts.length} splits have no valid work.`}
      >
        {counts.map((v, s) => (
          <div key={s} className="flex flex-1 flex-col justify-end">
            <div
              className="w-full rounded-t-[2px]"
              style={{
                height: `${Math.max(v === 0 ? 2 : 6, (v / peak) * 72).toFixed(1)}px`,
                background: v === 0 ? IDLE : BUSY,
                opacity: v === 0 ? 0.35 : 1,
              }}
            />
          </div>
        ))}
      </div>

      <div className="mt-1 flex items-baseline gap-[3px]">
        {counts.map((v, s) => (
          <span
            key={s}
            className="flex-1 text-center font-mono text-[9px] tabular-nums text-muted-foreground"
          >
            {v}
          </span>
        ))}
      </div>

      <p className="mt-1.5 font-mono text-[11px] leading-5 text-muted-foreground/80">
        {idle} of {counts.length} splits idle &middot; {note}
      </p>
    </div>
  )
}

export function SplitPartition() {
  const [valid, setValid] = useState(1002)
  const [splits, setSplits] = useState(8)

  const chunk = contiguous(valid, splits)
  const stride = strided(valid, splits)
  const chunkIters = Math.max(...chunk.map((v) => ceilDiv(v, BLOCK_N)))
  const strideIters = Math.max(...stride.map((v) => ceilDiv(v, BLOCK_N)))
  // One scale for both strips, or the balanced partition looks as tall as the
  // straggler it is there to remove.
  const peak = Math.max(1, ...chunk, ...stride)

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          handing 2048 top-k slots to NUM_SPLITS CTAs
        </span>
        <span className="font-mono text-[10px] text-muted-foreground/70">
          BLOCK_N = 128, valid entries are a prefix
        </span>
      </div>

      <div className="p-3 sm:p-5">
        <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
          <label className="block">
            <span className="flex items-baseline justify-between gap-2">
              <span className="font-mono text-[11px] text-muted-foreground">
                valid entries on the busiest token
              </span>
              <span className="font-mono text-xs tabular-nums">{valid}</span>
            </span>
            <Range
              min={1}
              max={TOPK}
              step={1}
              value={valid}
              accent={BUSY}
              onChange={(e) => setValid(Number(e.currentTarget.value))}
              aria-label="Number of valid top-k entries on the busiest token"
              className="mt-2 w-full"
            />
            <span className="mt-1 block font-mono text-[10px] text-muted-foreground/70">
              median token in the trace set: 33 &middot; workload 4c46a94b&rsquo;s worst
              token: 1002
            </span>
          </label>

          <div className="flex items-center gap-1.5">
            {[8, 16].map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSplits(s)}
                aria-pressed={splits === s}
                className={
                  "rounded-md border px-3 py-1.5 font-mono text-xs transition-colors " +
                  (splits === s
                    ? "border-foreground/40 bg-foreground/10 text-foreground"
                    : "text-muted-foreground hover:bg-muted")
                }
              >
                NUM_SPLITS={s}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-6 space-y-6">
          <Strip
            title="contiguous chunks — split s owns [s·2048/S, (s+1)·2048/S)"
            counts={chunk}
            peak={peak}
            note="the prefix piles into the first splits"
          />
          <Strip
            title="stride partition — split s owns {s, s+S, s+2S, …}"
            counts={stride}
            peak={peak}
            note="the prefix is spread across every split"
          />
        </div>

        <p className="mt-5 text-sm leading-6">
          {chunkIters === strideIters ? (
            <>
              At this valid count both schemes end on{" "}
              <span className="font-mono">{strideIters}</span> iteration
              {strideIters === 1 ? "" : "s"}, and the stride only buys occupancy:{" "}
              {chunk.filter((v) => v === 0).length} CTAs sit idle under chunking and{" "}
              {stride.filter((v) => v === 0).length} under striding.
            </>
          ) : (
            <>
              Chunking puts{" "}
              <span className="font-mono">{chunkIters}</span> iterations on the critical
              path; striding puts{" "}
              <span className="font-mono">{strideIters}</span>. Same work, same kernel,
              different index arithmetic.
            </>
          )}
        </p>
      </div>

      <figcaption className="border-t px-4 py-2.5 font-mono text-[11px] leading-5 text-muted-foreground">
        Integer arithmetic from the shipped kernel&rsquo;s own loop bound, not a
        measurement. Real per-token valid counts come from the contest trace set; the
        slider is there so you can walk the distribution.
      </figcaption>
    </figure>
  )
}
