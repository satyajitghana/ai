"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { mpow } from "@/lib/dmath"

// What a recurrent checkpoint costs next to the KV it sits on, for GLM-5.3-Flash
// on one of the two B200s the paper serves it with.
//
// From the paper (Table 2, Appendix C): a vLLM block is 4,352 tokens of attention
// KV, the cache is 62.45 GiB in 2,531 blocks per GPU, and a recurrent checkpoint
// with its auxiliary state takes five blocks. From config.json (my arithmetic):
// 34 KDA layers x 64 heads x 128 x 128 fp32 state, plus a 4-tap short conv over
// q, k, v (3 cached positions x 3 x 64 x 128 bf16), halved by tensor parallelism.
//
// The question the slider asks: if you checkpoint every N tokens so a turn can
// resume anywhere, how much of the cache goes to checkpoints rather than KV?

const ACCENT = "oklch(0.60 0.15 255)"
const WARM = "oklch(0.68 0.13 85)"
const BAD = "oklch(0.60 0.19 25)"

const BLOCK_TOK = 4352
const BUDGET = 2531
const BLOCK_BYTES = (62.45 * 2 ** 30) / BUDGET // 26.49 MB
const CK_BLOCKS = 5
// config.json arithmetic, per GPU at TP=2
const KDA_LAYERS = 34
const STATE_PER_LAYER = (64 * 128 * 128 * 4 + 3 * 3 * 64 * 128 * 2) / 2
const RAW_STATE = KDA_LAYERS * STATE_PER_LAYER

const mb = (b: number) => `${(b / 1e6).toFixed(1)} MB`

export function StateLedger() {
  const [logCtx, setLogCtx] = useState(17.1) // ~142K, trace median prompt
  const [logEvery, setLogEvery] = useState(20) // "once per turn" end of the slider

  const ctx = Math.round(mpow(2, logCtx))
  const perTurn = logEvery >= 19.95
  const every = perTurn ? ctx : Math.round(mpow(2, logEvery))
  const kvBlocks = Math.ceil(ctx / BLOCK_TOK)
  const nCk = perTurn ? 1 : Math.max(1, Math.floor(ctx / every))
  const ckBlocks = nCk * CK_BLOCKS
  const total = kvBlocks + ckBlocks
  const fit = Math.floor(BUDGET / total)
  const share = ckBlocks / total

  const W = 700
  const H = 128
  const X0 = 130
  const BAR = W - X0 - 40
  const maxB = Math.max(total, 60)
  const px = (v: number) => (v / maxB) * BAR

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          one GLM-5.3-Flash conversation, per B200 (TP=2)
        </span>
        <span className="font-mono text-[10px]" style={{ color: share > 0.5 ? BAD : share > 0.2 ? WARM : ACCENT }}>
          {(share * 100).toFixed(0)}% of its cache is checkpoints · {fit} such conversations fit
        </span>
      </div>

      <div className="p-3 sm:p-4">
        <div className="overflow-x-auto">
          <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" className="min-w-[660px] max-w-full">
            <title>
              {`A ${ctx.toLocaleString()}-token context needs ${kvBlocks} blocks of attention KV. ${nCk} recurrent checkpoints at five blocks each add ${ckBlocks} blocks, so ${(share * 100).toFixed(0)} percent of the conversation's cache is checkpoints and ${fit} such conversations fit in 2,531 blocks.`}
            </title>
            <text x={X0 - 10} y={22} fontSize={8.5} textAnchor="end" fill={ACCENT} fontFamily="ui-monospace, monospace">
              attention KV
            </text>
            <text x={X0 - 10} y={33} fontSize={7} textAnchor="end" fill="currentColor" fillOpacity={0.45} fontFamily="ui-monospace, monospace">
              {`⌈${ctx.toLocaleString()} / 4,352⌉ blocks`}
            </text>
            <rect x={X0} y={12} width={px(kvBlocks)} height={20} rx={3} fill={ACCENT} fillOpacity={0.75} />
            <text x={X0 + px(kvBlocks) + 6} y={26} fontSize={9} fill={ACCENT} fontFamily="ui-monospace, monospace">
              {kvBlocks} blocks · {mb(kvBlocks * BLOCK_BYTES)}
            </text>

            <text x={X0 - 10} y={64} fontSize={8.5} textAnchor="end" fill={WARM} fontFamily="ui-monospace, monospace">
              checkpoints
            </text>
            <text x={X0 - 10} y={75} fontSize={7} textAnchor="end" fill="currentColor" fillOpacity={0.45} fontFamily="ui-monospace, monospace">
              {`${nCk} × 5 blocks`}
            </text>
            <rect x={X0} y={54} width={Math.min(BAR, px(ckBlocks))} height={20} rx={3} fill={WARM} fillOpacity={0.85} />
            <text x={Math.min(X0 + px(ckBlocks) + 6, W - 150)} y={68} fontSize={9} fill={WARM} fontFamily="ui-monospace, monospace">
              {ckBlocks} blocks · {mb(ckBlocks * BLOCK_BYTES)}
            </text>

            <text x={X0} y={98} fontSize={7.5} fill="currentColor" fillOpacity={0.5} fontFamily="ui-monospace, monospace">
              one checkpoint = 5 blocks = the KV of 21,760 tokens · raw KDA state from config.json: {mb(RAW_STATE)} per GPU
            </text>
            <text x={X0} y={112} fontSize={7.5} fill="currentColor" fillOpacity={0.5} fontFamily="ui-monospace, monospace">
              cache per GPU: 2,531 blocks of {mb(BLOCK_BYTES)} (62.45 GiB) · conversations that fit = ⌊2,531 / {total}⌋ = {fit}
            </text>
          </svg>
        </div>

        <div className="mt-2 grid gap-1.5">
          <label className="flex items-center gap-2">
            <span className="w-32 shrink-0 font-mono text-[10px] text-muted-foreground">context</span>
            <Range min={13} max={19.93} step={0.05} value={logCtx} onChange={(e) => setLogCtx(Number(e.target.value))} accent={ACCENT} aria-label="Context length" />
            <span className="w-20 shrink-0 text-right font-mono text-[10px]">{ctx.toLocaleString()}</span>
          </label>
          <label className="flex items-center gap-2">
            <span className="w-32 shrink-0 font-mono text-[10px] text-muted-foreground">checkpoint every</span>
            <Range min={8} max={20} step={0.05} value={logEvery} onChange={(e) => setLogEvery(Number(e.target.value))} accent={WARM} aria-label="Checkpoint interval in tokens" />
            <span className="w-20 shrink-0 text-right font-mono text-[10px]">{perTurn ? "turn end" : `${every.toLocaleString()} tok`}</span>
          </label>
        </div>
      </div>
      <figcaption className="border-t px-4 py-2 text-xs text-muted-foreground">
        Block size, budget and the five-block checkpoint are the paper&apos;s (Table 2, Appendix C). The raw state size is my arithmetic on <code>config.json</code>; the engine&apos;s five blocks hold more than that, for auxiliary state and page rounding I did not attribute. Slide the interval to the right end to keep one checkpoint per turn, which is what exact-end placement needs.
      </figcaption>
    </figure>
  )
}
