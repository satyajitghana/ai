"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { mlog2, mpow } from "@/lib/dmath"
import { cn } from "@/lib/utils"

// The indexer, and the tax nobody budgets for.
//
// Sparse attention only reads a fixed number of blocks per query — index_topk is
// 2048 in GLM-5.3-Flash's config — so the attention itself stops growing with
// context. But something has to decide *which* 2048, and that something scores
// the query against every key in the sequence. The selector is O(L) even when
// the attention it feeds is O(1), which is why at a million tokens the indexer
// stops being a rounding error and becomes the thing you are paying for.
//
// IndexPool is GLM's answer: `index_kpool: 4` with `index_kpool_compress: true`
// in config.json, which weight-pools four indexer key vectors into one before
// scoring. The indexer then runs over L/4 entries and its cache shrinks by the
// same factor. `index_kpool_always_select_tail` keeps the most recent block
// unpooled, because the tokens you just wrote are the ones you can least afford
// to blur.
//
// Costs below are counted in key-vector reads per decoded token, from the
// published config constants. They are arithmetic on those constants, not a
// measurement of the kernel.

const ACCENT = "oklch(0.60 0.15 255)"
const WARM = "oklch(0.68 0.13 85)"
const GOOD = "oklch(0.55 0.16 155)"

const TOPK = 2048 // index_topk
const IDX_HEADS = 32 // index_n_heads
const IDX_DIM = 128 // index_head_dim
const POOL = 4 // index_kpool

export function IndexPool() {
  const [logL, setLogL] = useState(20) // 2^20 ≈ 1M
  const [pooled, setPooled] = useState(true)

  const L = mpow(2, logL)
  const entries = pooled ? L / POOL : L

  // the indexer scores the query against every (pooled) key, per indexer head
  const indexerReads = entries * IDX_HEADS
  // the attention itself reads a fixed budget of selected positions
  const attnReads = Math.min(L, TOPK) * IDX_HEADS
  const total = indexerReads + attnReads
  const indexerShare = indexerReads / total

  // the indexer's own cache, in bytes at BF16
  const cacheBytes = entries * IDX_DIM * 2

  const unpooledTotal = L * IDX_HEADS + Math.min(L, TOPK) * IDX_HEADS
  const saving = unpooledTotal / total

  const W = 700
  const H = 150
  const X0 = 108
  const BAR = W - X0 - 96
  const px = (v: number, max: number) => Math.max(1, (v / max) * BAR)

  const fmt = (v: number) =>
    v >= 1e9 ? `${(v / 1e9).toFixed(2)}B` : v >= 1e6 ? `${(v / 1e6).toFixed(1)}M` : v >= 1e3 ? `${(v / 1e3).toFixed(1)}k` : v.toFixed(0)
  const fmtB = (v: number) =>
    v >= 2 ** 30 ? `${(v / 2 ** 30).toFixed(2)} GiB` : `${(v / 2 ** 20).toFixed(0)} MiB`

  const maxBar = Math.max(unpooledTotal, total)

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          one decoded token at {L.toLocaleString()} of context
        </span>
        <span className="font-mono text-[10px]" style={{ color: indexerShare > 0.5 ? WARM : GOOD }}>
          the selector is {(indexerShare * 100).toFixed(0)}% of the attention work
        </span>
      </div>

      <div className="p-3 sm:p-4">
        <button
          type="button"
          onClick={() => setPooled((v) => !v)}
          aria-pressed={pooled}
          className={cn(
            "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
            pooled
              ? "border-foreground/30 bg-muted/50 text-foreground"
              : "border-border text-muted-foreground hover:text-foreground",
          )}
        >
          IndexPool — 4 keys pooled into 1
        </button>

        <div className="mt-2 overflow-x-auto">
          <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" className="min-w-[660px] max-w-full">
            <title>
              {`Two stacked bars of key-vector reads per decoded token at ${L.toLocaleString()} tokens of context. The indexer scans ${fmt(entries)} entries while the sparse attention reads a fixed budget of ${TOPK}. With pooling on, the indexer scans a quarter as many.`}
            </title>

            {[
              { l: "indexer scan", v: indexerReads, c: WARM, sub: `${fmt(entries)} entries × ${IDX_HEADS} heads`, y: 10 },
              { l: `attention, top-${TOPK}`, v: attnReads, c: ACCENT, sub: "fixed budget — flat in context", y: 52 },
            ].map((b) => (
              <g key={b.l}>
                <text x={X0 - 10} y={b.y + 13} fontSize={8.5} textAnchor="end" fill={b.c} fontFamily="ui-monospace, monospace">
                  {b.l}
                </text>
                <text x={X0 - 10} y={b.y + 24} fontSize={7} textAnchor="end" fill="currentColor" fillOpacity={0.4} fontFamily="ui-monospace, monospace">
                  {b.sub}
                </text>
                <rect x={X0} y={b.y} width={px(b.v, maxBar)} height={20} rx={3} fill={b.c} fillOpacity={0.78} />
                <text x={X0 + px(b.v, maxBar) + 7} y={b.y + 14} fontSize={9} fill={b.c} fontFamily="ui-monospace, monospace">
                  {fmt(b.v)}
                </text>
              </g>
            ))}

            {pooled ? (
              <>
                <line x1={X0} y1={96} x2={X0 + px(unpooledTotal, maxBar)} y2={96} stroke="currentColor" strokeOpacity={0.25} strokeDasharray="3 3" />
                <text x={X0} y={110} fontSize={7.5} fill="currentColor" fillOpacity={0.45} fontFamily="ui-monospace, monospace">
                  without pooling this row would reach {fmt(unpooledTotal)} — {saving.toFixed(2)}× more
                </text>
              </>
            ) : null}

            <text x={X0} y={H - 8} fontSize={8} fill="currentColor" fillOpacity={0.45} fontFamily="ui-monospace, monospace">
              indexer cache at BF16: {fmtB(cacheBytes)} per layer
            </text>
          </svg>
        </div>

        <div className="mt-2 flex items-center gap-2">
          <span className="w-24 shrink-0 whitespace-nowrap font-mono text-[10px] text-muted-foreground">
            context
          </span>
          <Range
            min={12}
            max={20}
            step={1}
            value={logL}
            onChange={(e) => setLogL(Number(e.target.value))}
            className="flex-1"
            aria-label="context length as a power of two, up to about one million tokens"
            accent={ACCENT}
          />
          <span className="w-14 shrink-0 text-right font-mono text-[10px] tabular-nums text-foreground">
            2<sup>{logL}</sup>
          </span>
        </div>

        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          {[
            { l: "entries scanned", v: fmt(entries), c: WARM },
            { l: "indexer cache / layer", v: fmtB(cacheBytes), c: WARM },
            { l: "saved by pooling", v: pooled ? `${saving.toFixed(2)}×` : "—", c: GOOD },
          ].map((x) => (
            <div key={x.l} className="rounded-lg border bg-muted/20 px-3 py-2">
              <div className="font-mono text-[9px] uppercase tracking-wide text-muted-foreground">{x.l}</div>
              <div className="font-mono text-sm tabular-nums" style={{ color: x.c }}>
                {x.v}
              </div>
            </div>
          ))}
        </div>
        <div className="mt-1 font-mono text-[9px] text-muted-foreground">
          counted from the published constants — index_topk {TOPK}, index_n_heads {IDX_HEADS},
          index_head_dim {IDX_DIM}, index_kpool {POOL}
        </div>

        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          Sparse attention is usually sold as the part that stops growing, and the blue bar is exactly
          that: a fixed 2,048-position budget, flat from four thousand tokens to a million. Drag the
          slider and watch it not move.
          <br />
          <br />
          The orange bar is the part the pitch leaves out.{" "}
          <span className="text-foreground">
            Something has to choose which 2,048, and choosing means looking at all of them
          </span>
          . Below about 2<sup>{Math.round(mlog2(TOPK))}</sup>{" "}tokens the selector is free because
          everything is selected; past it the selector is the only term still growing, and by a
          million it dominates. IndexPool does not make the scan sublinear — it divides it by four,
          and divides the indexer&rsquo;s own cache by four with it. Turn the toggle off at the
          right-hand end of the slider to see the size of the bill it is paying down.
        </p>
      </div>
    </figure>
  )
}
