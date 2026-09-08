"use client"

import { useMemo, useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { cn } from "@/lib/utils"

// Reproduces a real report: an RTX 3060 (12 GB) running
// `llama-server -m MiniCPM5-2B-Q8_0.gguf -ngl 99 -c 131072 -fa on --jinja -np 1
//  -ctk f16 -ctv f16 -b 2048 -ub 1024 --temp 1.0 --top-p 0.95` measured
// Q4_K_M ~163 tok/s decode at 7.2 GB total VRAM and Q8_0 ~113 tok/s at 8.2 GB,
// both with f16 KV cache, claiming "most of that VRAM is the 131K KV cache."
//
// GGUF weight sizes are OpenBMB's own release table (docs/deployment/llama_cpp.md,
// OpenBMB/MiniCPM repo): F16 5.04 GB, Q8_0 2.68 GB, Q4_K_M 1.56 GB.
// KV cache bytes/token = layers(42) x kv_heads(2) x head_dim(128) x 2 (K+V) x
// dtype_bytes, from config.json. At f16 (2 B) and 131,072 tokens that is
// 5,637,144,576 B = 5.637 GB -- so Q4_K_M + f16 KV = 1.56 + 5.637 = 7.20 GB,
// matching the reported 7.2 GB exactly, and Q8_0 + f16 KV = 2.68 + 5.637 =
// 8.32 GB against a reported ~8.2 GB (consumer VRAM readouts round loosely).
// q8_0-quantized KV is approximated here at 1 byte/element (half of f16),
// the standard llama.cpp approximation -- not separately verified against a
// measured q8_0-KV run.

const LAYERS = 42
const KV_HEADS = 2
const HEAD_DIM = 128
const MAX_CTX = 131072
const MIN_CTX = 4096

type Quant = "q4" | "q8" | "f16"
const QUANTS: Record<Quant, { label: string; gb: number }> = {
  q4: { label: "Q4_K_M", gb: 1.56 },
  q8: { label: "Q8_0", gb: 2.68 },
  f16: { label: "F16", gb: 5.04 },
}

type KvDtype = "f16" | "q8_0"
const KV_DTYPES: Record<KvDtype, { label: string; bytes: number }> = {
  f16: { label: "f16 KV", bytes: 2 },
  q8_0: { label: "q8_0 KV", bytes: 1 },
}

const CARDS = [8, 12, 16, 24]

const WEIGHT = "oklch(0.60 0.15 255)"
const KV = "oklch(0.55 0.16 155)"
const OVER = "oklch(0.58 0.19 27)"

function kvBytesPerToken(dtypeBytes: number) {
  return LAYERS * KV_HEADS * HEAD_DIM * 2 * dtypeBytes
}

function fmtGB(gb: number) {
  return gb.toFixed(2)
}

export function VramBudgetExplorer() {
  const [quant, setQuant] = useState<Quant>("q8")
  const [kvDtype, setKvDtype] = useState<KvDtype>("f16")
  const [ctx, setCtx] = useState(131072)

  const weightGB = QUANTS[quant].gb
  const kvGB = (kvBytesPerToken(KV_DTYPES[kvDtype].bytes) * ctx) / 1e9
  const totalGB = weightGB + kvGB

  const maxScale = 24
  const W = 700
  const X0 = 10
  const BAR_W = 640
  const barGB = (gb: number) => Math.min(gb, maxScale)

  const fits = useMemo(() => CARDS.map((c) => ({ card: c, ok: totalGB <= c })), [totalGB])
  const smallestFit = fits.find((f) => f.ok)?.card

  function applyPreset(q: Quant, ctxVal: number, kv: KvDtype) {
    setQuant(q)
    setCtx(ctxVal)
    setKvDtype(kv)
  }

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">weights + KV cache vs. common GPU VRAM</span>
        <span className="font-mono text-[10px]" style={{ color: smallestFit ? KV : OVER }}>
          {smallestFit ? `fits an ${smallestFit} GB card` : "exceeds every card shown"}
        </span>
      </div>

      <div className="p-3 sm:p-4">
        <div className="flex flex-wrap gap-1.5">
          {(Object.keys(QUANTS) as Quant[]).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setQuant(k)}
              aria-pressed={quant === k}
              className={cn(
                "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
                quant === k
                  ? "border-foreground/30 bg-muted/50 text-foreground"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {QUANTS[k].label} · {QUANTS[k].gb} GB
            </button>
          ))}
          <span className="mx-1 self-center h-4 w-px bg-border" />
          {(Object.keys(KV_DTYPES) as KvDtype[]).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setKvDtype(k)}
              aria-pressed={kvDtype === k}
              className={cn(
                "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
                kvDtype === k
                  ? "border-foreground/30 bg-muted/50 text-foreground"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {KV_DTYPES[k].label}
            </button>
          ))}
        </div>

        <div className="mt-3 flex items-center gap-2">
          <span className="w-16 shrink-0 font-mono text-[10px] text-muted-foreground">context</span>
          <Range
            min={MIN_CTX}
            max={MAX_CTX}
            step={1024}
            value={ctx}
            onChange={(e) => setCtx(Number(e.target.value))}
            className="flex-1"
            accent={KV}
            aria-label="context length in tokens"
          />
          <span className="w-24 shrink-0 text-right font-mono text-[10px] tabular-nums text-foreground">
            {ctx.toLocaleString()} tok
          </span>
        </div>

        <div className="mt-4 overflow-x-auto">
          <svg viewBox={`0 0 ${W} 120`} width={W} height={120} role="img" className="min-w-[600px] max-w-full">
            <title>
              {`${QUANTS[quant].label} weights (${fmtGB(weightGB)} GB) plus ${ctx.toLocaleString()} tokens of ${KV_DTYPES[kvDtype].label} cache (${fmtGB(kvGB)} GB) totals ${fmtGB(totalGB)} GB. Reference lines at 8, 12, 16 and 24 GB.`}
            </title>
            {/* bar */}
            <rect x={X0} y={30} width={BAR_W} height={30} rx={4} fill="currentColor" fillOpacity={0.06} />
            <rect
              x={X0}
              y={30}
              width={(barGB(weightGB) / maxScale) * BAR_W}
              height={30}
              fill={WEIGHT}
              fillOpacity={0.85}
            />
            <rect
              x={X0 + (barGB(weightGB) / maxScale) * BAR_W}
              y={30}
              width={(barGB(totalGB - weightGB) / maxScale) * BAR_W}
              height={30}
              fill={totalGB > maxScale ? OVER : KV}
              fillOpacity={0.85}
            />
            {totalGB > maxScale ? (
              <text x={X0 + BAR_W - 4} y={50} fontSize={9} textAnchor="end" fill={OVER} fontFamily="ui-monospace, monospace">
                +{fmtGB(totalGB - maxScale)} GB off-chart →
              </text>
            ) : null}

            {/* reference lines */}
            {CARDS.map((c) => {
              const x = X0 + (c / maxScale) * BAR_W
              return (
                <g key={c}>
                  <line x1={x} y1={20} x2={x} y2={68} stroke="currentColor" strokeOpacity={0.3} strokeDasharray="2 2" />
                  <text x={x} y={16} fontSize={9} textAnchor="middle" fill="currentColor" fillOpacity={0.6} fontFamily="ui-monospace, monospace">
                    {c} GB
                  </text>
                </g>
              )
            })}

            <text x={X0} y={90} fontSize={10} fill={WEIGHT} fontFamily="ui-monospace, monospace">
              weights {fmtGB(weightGB)} GB
            </text>
            <text x={X0 + 140} y={90} fontSize={10} fill={totalGB > maxScale ? OVER : KV} fontFamily="ui-monospace, monospace">
              KV cache {fmtGB(kvGB)} GB
            </text>
            <text x={X0 + 300} y={90} fontSize={10} fontWeight={700} fill="currentColor" fontFamily="ui-monospace, monospace">
              total {fmtGB(totalGB)} GB
            </text>
          </svg>
        </div>

        <div className="mt-1 flex flex-wrap gap-2">
          {[
            ["reported: RTX 3060, Q4_K_M, f16 KV, 131K", "q4", 131072, "f16"] as const,
            ["reported: RTX 3060, Q8_0, f16 KV, 131K", "q8", 131072, "f16"] as const,
            ["drop to 32K: Q8_0 fits an 8 GB card", "q8", 32768, "f16"] as const,
          ].map(([label, q, c, kv]) => (
            <button
              key={label}
              type="button"
              onClick={() => applyPreset(q, c, kv)}
              className="cursor-pointer rounded-full border border-border px-2.5 py-1 font-mono text-[9.5px] text-muted-foreground transition-colors hover:text-foreground"
            >
              {label}
            </button>
          ))}
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          {fits.map(({ card, ok }) => (
            <span
              key={card}
              className="rounded-full border px-2 py-0.5 font-mono text-[10px]"
              style={{
                borderColor: ok ? "color-mix(in oklch, " + KV + " 40%, transparent)" : "var(--border)",
                color: ok ? KV : "var(--muted-foreground)",
                opacity: ok ? 1 : 0.5,
              }}
            >
              {card} GB {ok ? "✓" : "✗"}
            </span>
          ))}
        </div>

        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          The KV cache is <code>layers × kv_heads × head_dim × 2 × dtype_bytes</code> per token —
          for MiniCPM5-2B, <code>42 × 2 × 128 × 2 × 2 = 43,008 bytes</code> at f16, times however
          many tokens are in the window. At the model&rsquo;s native 131,072-token context that
          alone is <span style={{ color: KV }}>5.64 GB</span>, which is why a Q4_K_M run measures
          in at 7.2 GB total — 1.56 GB of weights plus that cache — and a Q8_0 run at 8.2 GB. The{" "}
          <span className="text-foreground">weights barely move the total</span>; the context
          window does essentially all of the work, which is exactly what &ldquo;most of that VRAM
          is the KV cache&rdquo; means once you do the arithmetic. Drag context down and the
          picture flips: at 32K tokens even the least-quantized Q8_0 build settles comfortably
          under 8 GB, because the cache shrinks linearly with the window while the weights
          don&rsquo;t move at all.
        </p>
      </div>
    </figure>
  )
}
