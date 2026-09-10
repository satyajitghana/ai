"use client"

import { useMemo, useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { cn } from "@/lib/utils"

// AuK's rectified-flow backbone (src/auk/model/flux2_edit.py, config.yaml
// model.arch): 10 dual-stream MMDiT blocks, then 20 single-stream DiT blocks.
// Both block types are read directly from src/auk/model/modules.py:
//
//   MMDiTBlock: separate AdaLN + separate to_qkv/to_qkv_c + separate
//   to_out/to_out_c + separate SwiGLU FFN per stream (attn_norm_c/attn_norm_x,
//   ff_c/ff_x) -- but ONE joint attention call, because JointAttnProcessor
//   concatenates Q/K/V from both streams before a single scaled_dot_product_attention.
//
//   DiTBlock: one AdaLN, one to_qkv, one FFN, self-attention -- run on the
//   sequence flux2_edit.py already concatenated (`x = torch.cat([c, x], dim=1)`)
//   before the single-stream stack.
//
// Per-block parameter counts below are computed straight from config.yaml
// (dim=1536, heads=24, dim_head=64, ff_mult=2, so inner_dim==dim and
// context_dim==dim) using each nn.Linear's own in/out shapes in modules.py --
// not measured from the checkpoint. Because context_dim equals dim here, every
// doubled sub-module in MMDiTBlock is an exact duplicate of its DiT counterpart,
// so an MMDiT block costs *exactly* 2x a DiT block -- not roughly. With 10 dual
// blocks and 20 single blocks, that 2:1 param ratio times the 1:2 layer-count
// ratio lands the two stacks at precisely the same total: 755,284,480
// parameters each. It's a deliberately balanced depth allocation, not a
// coincidence of picking round numbers.
const DIM = 1536
const HEADS = 24
const DIM_HEAD = 64
const FF_MULT = 2
const INNER = DIM_HEAD * HEADS // 1536, equals DIM

const ffnParams = (d: number) => {
  const inner = d * FF_MULT
  return d * (inner * 2) + inner * d // linear_in (no bias) + linear_out (no bias)
}
const adaLNParams = (d: number) => d * (d * 6) + d * 6 // linear + bias
const attnSingleParams = () =>
  DIM * (3 * INNER) + 3 * INNER + INNER * DIM + DIM + 2 * DIM_HEAD // to_qkv + to_out + rms norms

const DIT_BLOCK_PARAMS = adaLNParams(DIM) + attnSingleParams() + ffnParams(DIM)
const MMDIT_BLOCK_PARAMS = 2 * DIT_BLOCK_PARAMS // exact, shown above

const N_DUAL = 10
const N_SINGLE = 20
const TOTAL = N_DUAL * MMDIT_BLOCK_PARAMS + N_SINGLE * DIT_BLOCK_PARAMS

const fmtM = (n: number) => `${(n / 1e6).toFixed(1)}M`
const fmtB = (n: number) => `${(n / 1e9).toFixed(2)}B`

const DUAL_COLOR = "oklch(0.62 0.15 255)"
const SINGLE_COLOR = "oklch(0.62 0.15 35)"

export function DualStreamFlow() {
  const [layer, setLayer] = useState(10) // default: the boundary

  const isDual = layer <= N_DUAL
  const cumParams = useMemo(() => {
    if (layer <= N_DUAL) return layer * MMDIT_BLOCK_PARAMS
    return N_DUAL * MMDIT_BLOCK_PARAMS + (layer - N_DUAL) * DIT_BLOCK_PARAMS
  }, [layer])
  const cumPct = (cumParams / TOTAL) * 100

  const W = 640
  const H = 150
  const stripY = 96
  const stripH = 20
  const stripX0 = 16
  const stripX1 = W - 16
  const slotW = (stripX1 - stripX0) / 30

  const laneTextY = 30
  const laneAudioY = 52
  const mergeX = stripX0 + N_DUAL * slotW

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          AuK backbone (config.yaml + src/auk/model/modules.py), 30 transformer blocks
        </span>
        <span className="font-mono text-[10px] text-muted-foreground">
          dim {DIM} &middot; {HEADS}&times;{DIM_HEAD} heads &middot; ff&times;{FF_MULT}
        </span>
      </div>

      <div className="p-3 sm:p-4">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          width={W}
          height={H}
          role="img"
          className="w-full"
          aria-label={`Text and audio streams run through ${N_DUAL} dual-stream MMDiT blocks with separate projections and feed-forward networks but one joint attention call, then concatenate into a single sequence for ${N_SINGLE} single-stream DiT blocks with shared self-attention. Currently viewing block ${layer} of 30, a ${isDual ? "dual-stream MMDiT" : "single-stream DiT"} block.`}
        >
          <defs>
            <marker id="auk-arrow" viewBox="0 -5 10 10" markerWidth="6" markerHeight="6" orient="auto" refX="7" refY="0">
              <path d="M0,-4L6,0L0,4" fill="none" stroke="currentColor" strokeOpacity={0.5} strokeWidth={1.4} />
            </marker>
            <filter id="auk-soft" x="-40%" y="-40%" width="180%" height="180%">
              <feDropShadow dx="0" dy="1" stdDeviation="1.2" floodOpacity="0.16" />
            </filter>
          </defs>

          {/* text / audio lanes, converging at the dual->single boundary */}
          <text x={stripX0} y={laneTextY - 8} fontSize={8.5} fill={DUAL_COLOR} fontFamily="ui-monospace, monospace">
            text stream
          </text>
          <path
            d={`M ${stripX0} ${laneTextY} L ${mergeX} ${laneTextY} C ${mergeX + 14} ${laneTextY}, ${mergeX + 14} ${(laneTextY + laneAudioY) / 2}, ${mergeX + 28} ${(laneTextY + laneAudioY) / 2}`}
            fill="none"
            stroke={DUAL_COLOR}
            strokeWidth={2}
          />
          <text x={stripX0} y={laneAudioY + 14} fontSize={8.5} fill={SINGLE_COLOR} fontFamily="ui-monospace, monospace">
            audio stream
          </text>
          <path
            d={`M ${stripX0} ${laneAudioY} L ${mergeX} ${laneAudioY} C ${mergeX + 14} ${laneAudioY}, ${mergeX + 14} ${(laneTextY + laneAudioY) / 2}, ${mergeX + 28} ${(laneTextY + laneAudioY) / 2}`}
            fill="none"
            stroke={SINGLE_COLOR}
            strokeWidth={2}
          />
          <circle cx={mergeX + 28} cy={(laneTextY + laneAudioY) / 2} r={4} fill="currentColor" fillOpacity={0.5} />
          <path
            d={`M ${mergeX + 32} ${(laneTextY + laneAudioY) / 2} L ${stripX1} ${(laneTextY + laneAudioY) / 2}`}
            fill="none"
            stroke="currentColor"
            strokeOpacity={0.35}
            strokeWidth={2}
            markerEnd="url(#auk-arrow)"
          />
          <text x={mergeX + 40} y={(laneTextY + laneAudioY) / 2 - 8} fontSize={8} fill="currentColor" fillOpacity={0.6} fontFamily="ui-monospace, monospace">
            concat -&gt; single sequence
          </text>

          {/* 30-slot conveyor */}
          {Array.from({ length: 30 }, (_, i) => i + 1).map((i) => {
            const dual = i <= N_DUAL
            const x = stripX0 + (i - 1) * slotW
            const active = i === layer
            return (
              <rect
                key={i}
                x={x + 1}
                y={stripY}
                width={slotW - 2}
                height={stripH}
                rx={3}
                fill={dual ? DUAL_COLOR : SINGLE_COLOR}
                fillOpacity={active ? 0.9 : 0.28}
                stroke={active ? (dual ? DUAL_COLOR : SINGLE_COLOR) : "none"}
                strokeWidth={active ? 1.5 : 0}
                filter={active ? "url(#auk-soft)" : undefined}
              />
            )
          })}
          <text x={stripX0} y={stripY + stripH + 14} fontSize={8} fill="currentColor" fillOpacity={0.5} fontFamily="ui-monospace, monospace">
            block 1
          </text>
          <text x={mergeX} y={stripY + stripH + 14} fontSize={8} fill="currentColor" fillOpacity={0.5} fontFamily="ui-monospace, monospace" textAnchor="middle">
            block {N_DUAL}/{N_DUAL + 1} boundary
          </text>
          <text x={stripX1} y={stripY + stripH + 14} fontSize={8} fill="currentColor" fillOpacity={0.5} fontFamily="ui-monospace, monospace" textAnchor="end">
            block 30
          </text>
        </svg>

        <div className="mt-3 flex items-center gap-3">
          <span className="w-16 shrink-0 font-mono text-[10.5px] text-muted-foreground">block {layer}/30</span>
          <Range
            min={1}
            max={30}
            step={1}
            value={layer}
            onChange={(e) => setLayer(Number(e.target.value))}
            accent={isDual ? DUAL_COLOR : SINGLE_COLOR}
            className="flex-1"
            aria-label="Transformer block index"
          />
        </div>

        <div
          className={cn(
            "mt-3 rounded-lg border p-3 font-mono text-[10.5px] leading-5",
            isDual ? "border-[oklch(0.62_0.15_255_/_0.3)]" : "border-[oklch(0.62_0.15_35_/_0.3)]"
          )}
        >
          {isDual ? (
            <>
              <span style={{ color: DUAL_COLOR }}>dual-stream MMDiT block {layer}</span> &mdash; separate AdaLN,
              separate to_qkv/to_qkv_c, separate output projection, separate SwiGLU FFN per stream. One joint
              attention call: Q/K/V from both streams are concatenated, then attended together. ~
              {fmtM(MMDIT_BLOCK_PARAMS)} params/block.
            </>
          ) : (
            <>
              <span style={{ color: SINGLE_COLOR }}>single-stream DiT block {layer}</span> &mdash; one AdaLN, one
              to_qkv, one output projection, one SwiGLU FFN, self-attention over the already-concatenated
              text+audio sequence. ~{fmtM(DIT_BLOCK_PARAMS)} params/block &mdash; exactly half an MMDiT block&rsquo;s.
            </>
          )}
        </div>

        <div className="mt-3">
          <div className="flex justify-between font-mono text-[10px] text-muted-foreground">
            <span>depth-parameters so far</span>
            <span>
              {fmtM(cumParams)} / {fmtB(TOTAL)}
            </span>
          </div>
          <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full"
              style={{ width: `${cumPct}%`, background: isDual ? DUAL_COLOR : SINGLE_COLOR }}
            />
          </div>
        </div>

        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          Because AuK sets <code className="font-mono text-xs">context_dim</code> equal to{" "}
          <code className="font-mono text-xs">dim</code>, every module MMDiT duplicates is an exact copy of its DiT
          counterpart &mdash; so a dual-stream block costs precisely 2&times; a single-stream block, computed from
          the same <code className="font-mono text-xs">config.yaml</code> shapes shown above:{" "}
          {fmtM(MMDIT_BLOCK_PARAMS)} against {fmtM(DIT_BLOCK_PARAMS)}. Ten of the first against twenty of the
          second lands both stacks at exactly {fmtM(N_DUAL * MMDIT_BLOCK_PARAMS)} each &mdash; the 10-then-20 layer
          split isn&rsquo;t a round number picked for its own sake, it&rsquo;s a 50/50 compute split between
          fusing the two modalities and refining the merged one.
        </p>
      </div>
    </figure>
  )
}
