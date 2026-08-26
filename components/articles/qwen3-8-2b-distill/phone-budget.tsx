"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { cn } from "@/lib/utils"

// What it actually costs to run empero-ai/Qwen3.8-2B-Distill-GGUF on a phone.
//
// Every fixed number below is measured, not estimated:
//
//   weights   exact byte sizes from the Hugging Face blob listing for
//             empero-ai/Qwen3.8-2B-Distill-GGUF (?blobs=true), cross-checked
//             against each file's own GGUF tensor table.
//
//   KV/token  derived from the shipped config.json:
//               num_key_value_heads = 2
//               head_dim            = 256
//               layer_types         = 18 x linear_attention + 6 x full_attention
//             so 2 (K and V) x 2 heads x 256 dims x 6 attention layers
//             = 6,144 elements per token. At f16 that is 12,288 B/token.
//             llama.cpp allocates the attention cache for non-recurrent layers
//             only -- src/llama-model.cpp, the filter_attn lambda for
//             LLM_ARCH_QWEN35 returns `il < n_layer && !hparams.is_recr(il)`
//             -- and sizes it to the full --ctx-size at load time, not lazily.
//
//   q8_0/q4_0 ggml block sizes: 34 bytes per 32 values, 18 bytes per 32 values.
//
//   recurrent the 18 Gated DeltaNet layers hold a fixed state that does not
//             grow with context: 16 heads x 128 x 128 floats (f32) plus a
//             6,144-channel x 3 conv window, per layer. 20.2 MB, constant.
//             llama.cpp pins these to GGML_TYPE_F32.
//
// The only guessed quantities are the runtime overhead and the fraction of
// physical RAM a phone will actually hand one process. Both are sliders, and
// both are labelled as assumptions, because they are.

const WEIGHTS = "oklch(0.60 0.15 255)"
const KV = "oklch(0.58 0.19 27)"
const REC = "oklch(0.55 0.16 155)"
const OVER = "oklch(0.62 0.03 250)"
const AMBER = "oklch(0.68 0.13 85)"

type Quant = { k: string; bytes: number; note: string }

const QUANTS: Quant[] = [
  { k: "Q4_K_M", bytes: 1312164224, note: "the repo's smallest file, and the one its card recommends" },
  { k: "Q5_K_M", bytes: 1454786944, note: "same Q6_K core, Q5_K everywhere else" },
  { k: "Q6_K", bytes: 1606323584, note: "every tensor at Q6_K — near-lossless" },
  { k: "Q8_0", bytes: 2076674432, note: "8-bit throughout" },
  { k: "BF16", bytes: 3897387392, note: "the unquantized reference" },
]

// 2 (K,V) x n_kv_head 2 x head_dim 256 x 6 full-attention layers = 6144 values
const KV_VALUES_PER_TOKEN = 2 * 2 * 256 * 6
const KV_TYPES = [
  { k: "f16", bytesPerToken: KV_VALUES_PER_TOKEN * 2, note: "llama.cpp's default" },
  { k: "q8_0", bytesPerToken: (KV_VALUES_PER_TOKEN * 34) / 32, note: "--cache-type-k q8_0 --cache-type-v q8_0" },
  { k: "q4_0", bytesPerToken: (KV_VALUES_PER_TOKEN * 18) / 32, note: "--cache-type-k q4_0 --cache-type-v q4_0" },
]

const RECURRENT = 18 * (16 * 128 * 128 * 4) + 18 * (6144 * 3 * 4) // 20,201,472 B

const CTX_STOPS = [
  2048, 4096, 8192, 12288, 16384, 24576, 32768, 49152, 65536, 98304, 131072, 163840, 196608, 262144,
]

const DEVICES = [
  { k: "4 GB", bytes: 4 * 1024 ** 3 },
  { k: "6 GB", bytes: 6 * 1024 ** 3 },
  { k: "8 GB", bytes: 8 * 1024 ** 3 },
  { k: "12 GB", bytes: 12 * 1024 ** 3 },
  { k: "16 GB", bytes: 16 * 1024 ** 3 },
]

const gb = (b: number) => `${(b / 1e9).toFixed(2)} GB`
const mb = (b: number) => `${(b / 1e6).toFixed(0)} MB`
const kt = (n: number) => (n >= 1000 ? `${Math.round(n / 1000)}k` : String(n))

export function PhoneBudget() {
  const [qi, setQi] = useState(0)
  const [kvi, setKvi] = useState(0)
  const [ci, setCi] = useState(9) // 98,304
  const [di, setDi] = useState(2) // 8 GB
  const [frac, setFrac] = useState(50) // percent of physical RAM the app may hold
  const [overMb, setOverMb] = useState(320) // compute buffers + runtime

  const quant = QUANTS[qi]
  const kvT = KV_TYPES[kvi]
  const ctx = CTX_STOPS[ci]
  const device = DEVICES[di]

  const kvBytes = ctx * kvT.bytesPerToken
  const overhead = overMb * 1e6
  const total = quant.bytes + kvBytes + RECURRENT + overhead
  const budget = (device.bytes * frac) / 100
  const fits = total <= budget

  // largest stop that still fits; -1 if even the smallest does not
  let maxStop = -1
  for (let i = 0; i < CTX_STOPS.length; i++) {
    const t = quant.bytes + CTX_STOPS[i] * kvT.bytesPerToken + RECURRENT + overhead
    if (t <= budget) maxStop = i
  }
  // and the exact token count the budget allows
  const spare = budget - quant.bytes - RECURRENT - overhead
  const maxTokens = spare > 0 ? Math.floor(spare / kvT.bytesPerToken) : 0

  const W = 700
  const PAD = 12
  const SPAN = W - PAD * 2
  const scaleMax = Math.max(device.bytes, total)
  const px = (b: number) => (b / scaleMax) * SPAN
  const budgetX = PAD + px(budget)

  // the two labels that can collide: the budget marker and the total readout
  const budgetLabelEnd = budgetX > W - 190
  const segs = [
    { c: WEIGHTS, b: quant.bytes },
    { c: KV, b: kvBytes },
    { c: REC, b: RECURRENT },
    { c: OVER, b: overhead },
  ]

  // context strip: linear, 0 .. 262,144
  const SW = 700
  const spx = (n: number) => 12 + (n / 262144) * (SW - 24)

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          what one llama.cpp process holds · {quant.k} · {kt(ctx)} ctx · KV {kvT.k}
        </span>
        <span
          className="font-mono text-[10px]"
          style={{ color: fits ? REC : KV }}
        >
          {gb(total)} against a {gb(budget)} budget — {fits ? "fits" : "does not fit"}
        </span>
      </div>

      <div className="p-3 sm:p-4">
        <div className="flex flex-wrap gap-1.5">
          {QUANTS.map((q, i) => (
            <button
              key={q.k}
              type="button"
              onClick={() => setQi(i)}
              aria-pressed={qi === i}
              className={cn(
                "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
                qi === i
                  ? "border-foreground/30 bg-muted/50 text-foreground"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {q.k}
            </button>
          ))}
          <span className="mx-1 self-center text-[10px] text-muted-foreground">·</span>
          {KV_TYPES.map((t, i) => (
            <button
              key={t.k}
              type="button"
              onClick={() => setKvi(i)}
              aria-pressed={kvi === i}
              className={cn(
                "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
                kvi === i
                  ? "border-foreground/30 bg-muted/50 text-foreground"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              KV {t.k}
            </button>
          ))}
          <span className="mx-1 self-center text-[10px] text-muted-foreground">·</span>
          {DEVICES.map((d, i) => (
            <button
              key={d.k}
              type="button"
              onClick={() => setDi(i)}
              aria-pressed={di === i}
              className={cn(
                "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
                di === i
                  ? "border-foreground/30 bg-muted/50 text-foreground"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {d.k}
            </button>
          ))}
        </div>

        <div className="mt-3 overflow-x-auto">
          <svg viewBox={`0 0 ${W} 104`} width={W} height={104} role="img" className="min-w-[660px] max-w-full">
            <title>
              {`A ${device.k} device with ${frac}% usable gives a ${gb(budget)} budget. ` +
                `${quant.k} weights take ${gb(quant.bytes)}, a ${kt(ctx)}-token ${kvT.k} KV cache takes ${gb(kvBytes)}, ` +
                `the Gated DeltaNet state ${mb(RECURRENT)} and runtime overhead ${mb(overhead)}, ` +
                `for ${gb(total)} total — which ${fits ? "fits inside" : "exceeds"} the budget.`}
            </title>

            {/* physical RAM rail */}
            <text x={PAD} y={11} fontSize={8.5} fill="currentColor" fillOpacity={0.5} fontFamily="ui-monospace, monospace">
              physical RAM · {device.k}
            </text>
            <rect x={PAD} y={16} width={px(device.bytes)} height={13} rx={3} fill="currentColor" fillOpacity={0.06} />
            <rect x={PAD} y={16} width={px(budget)} height={13} rx={3} fill="currentColor" fillOpacity={0.1} />
            <line x1={budgetX} y1={16} x2={budgetX} y2={78} stroke={AMBER} strokeWidth={1.4} strokeDasharray="3 3" />
            <text
              x={budgetLabelEnd ? budgetX - 5 : budgetX + 5}
              y={25}
              fontSize={8.5}
              textAnchor={budgetLabelEnd ? "end" : "start"}
              fill={AMBER}
              fontFamily="ui-monospace, monospace"
            >
              budget {gb(budget)} ({frac}%)
            </text>

            {/* the allocation */}
            <text x={PAD} y={49} fontSize={8.5} fill="currentColor" fillOpacity={0.5} fontFamily="ui-monospace, monospace">
              what llama.cpp allocates
            </text>
            <text
              x={PAD + SPAN}
              y={49}
              fontSize={9}
              textAnchor="end"
              fill={fits ? REC : KV}
              fontFamily="ui-monospace, monospace"
            >
              {gb(total)} total
            </text>
            <rect x={PAD} y={54} width={SPAN} height={24} rx={4} fill="currentColor" fillOpacity={0.04} />
            {segs.reduce<{ x: number; nodes: React.ReactNode[] }>(
              (acc, s, i) => {
                const w = px(s.b)
                acc.nodes.push(
                  <rect
                    key={i}
                    x={acc.x}
                    y={54}
                    width={Math.max(w, 0.6)}
                    height={24}
                    fill={s.c}
                    fillOpacity={0.85}
                    stroke="var(--background)"
                    strokeWidth={0.6}
                  />,
                )
                acc.x += w
                return acc
              },
              { x: PAD, nodes: [] },
            ).nodes}

            {/* legend */}
            {[
              { c: WEIGHTS, l: `weights ${gb(quant.bytes)}` },
              { c: KV, l: `KV cache ${gb(kvBytes)}` },
              { c: REC, l: `deltanet state ${mb(RECURRENT)}` },
              { c: OVER, l: `runtime ${mb(overhead)} (assumed)` },
            ].map((x, i) => (
              <g key={x.l} transform={`translate(${PAD + i * 176}, 92)`}>
                <rect x={0} y={-6} width={7} height={7} rx={1.5} fill={x.c} fillOpacity={0.85} />
                <text x={11} y={0} fontSize={8} fill="currentColor" fillOpacity={0.6} fontFamily="ui-monospace, monospace">
                  {x.l}
                </text>
              </g>
            ))}
          </svg>
        </div>

        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
              context ·{" "}
              <span className="text-foreground">{ctx.toLocaleString()}</span> tokens
            </span>
            <Range
              min={0}
              max={CTX_STOPS.length - 1}
              step={1}
              value={ci}
              onChange={(e) => setCi(Number(e.currentTarget.value))}
              accent={KV}
              className="mt-1 w-full"
              aria-label="context length"
            />
          </label>
          <label className="block">
            <span className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
              share of RAM the OS lets you hold ·{" "}
              <span className="text-foreground">{frac}%</span>{" "}
              <span className="normal-case">(assumption)</span>
            </span>
            <Range
              min={25}
              max={80}
              step={5}
              value={frac}
              onChange={(e) => setFrac(Number(e.currentTarget.value))}
              accent={AMBER}
              className="mt-1 w-full"
              aria-label="usable fraction of device RAM"
            />
          </label>
        </div>

        <div className="mt-2 overflow-x-auto">
          <svg viewBox={`0 0 ${SW} 46`} width={SW} height={46} role="img" className="min-w-[660px] max-w-full">
            <title>
              {`A strip from zero to 262,144 tokens. The supervised fine-tune used a max_length of 8,192, ` +
                `which is 3.1% of the strip. The cursor sits at ${ctx.toLocaleString()} tokens.`}
            </title>
            <rect x={12} y={14} width={SW - 24} height={12} rx={3} fill="currentColor" fillOpacity={0.06} />
            <rect x={12} y={14} width={spx(8192) - 12} height={12} rx={3} fill={AMBER} fillOpacity={0.75} />
            <rect x={12} y={14} width={spx(ctx) - 12} height={12} fill={KV} fillOpacity={0.18} />
            <line x1={spx(ctx)} y1={10} x2={spx(ctx)} y2={30} stroke={KV} strokeWidth={1.6} />
            <text x={12} y={9} fontSize={8} fill={AMBER} fontFamily="ui-monospace, monospace">
              8,192 — every token the reasoning fine-tune ever saw (3.1%)
            </text>
            <text x={SW - 12} y={9} fontSize={8} textAnchor="end" fill="currentColor" fillOpacity={0.55} fontFamily="ui-monospace, monospace">
              262,144 — the advertised window
            </text>
            <text
              x={spx(ctx) > SW - 120 ? spx(ctx) - 5 : spx(ctx) + 5}
              y={38}
              fontSize={8.5}
              textAnchor={spx(ctx) > SW - 120 ? "end" : "start"}
              fill={KV}
              fontFamily="ui-monospace, monospace"
            >
              you asked for {ctx.toLocaleString()} · {gb(kvBytes)} of KV
            </text>
          </svg>
        </div>

        <div className="mt-3 grid gap-2 sm:grid-cols-4">
          {[
            { l: "weights on disk", v: gb(quant.bytes), c: WEIGHTS },
            { l: `KV at ${kt(ctx)}`, v: gb(kvBytes), c: KV },
            { l: "KV per token", v: `${(kvT.bytesPerToken / 1024).toFixed(3)} KiB`, c: KV },
            {
              l: fits ? "headroom left" : "over budget by",
              v: gb(Math.abs(budget - total)),
              c: fits ? REC : KV,
            },
          ].map((x) => (
            <div key={x.l} className="rounded-lg border bg-muted/20 px-3 py-2">
              <div className="font-mono text-[9px] uppercase tracking-wide text-muted-foreground">{x.l}</div>
              <div className="font-mono text-sm tabular-nums" style={{ color: x.c }}>
                {x.v}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-2 rounded-lg border bg-muted/20 px-3 py-2">
          <div className="font-mono text-[9px] uppercase tracking-wide text-muted-foreground">
            longest context this configuration can hold
          </div>
          <div className="font-mono text-sm tabular-nums" style={{ color: maxTokens > 0 ? REC : KV }}>
            {maxTokens > 0
              ? `${maxTokens.toLocaleString()} tokens — ${((maxTokens / 262144) * 100).toFixed(1)}% of the advertised 262,144`
              : `0 tokens — the weights alone do not fit in ${gb(budget)}`}
            {maxStop >= 0 && maxTokens > 0 ? ` (largest round stop: ${CTX_STOPS[maxStop].toLocaleString()})` : ""}
          </div>
        </div>

        <label className="mt-3 block">
          <span className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
            compute buffers + runtime ·{" "}
            <span className="text-foreground">{overMb} MB</span>{" "}
            <span className="normal-case">(assumption — everything else on this panel is measured)</span>
          </span>
          <Range
            min={128}
            max={768}
            step={32}
            value={overMb}
            onChange={(e) => setOverMb(Number(e.currentTarget.value))}
            accent={OVER}
            className="mt-1 w-full"
            aria-label="runtime overhead in megabytes"
          />
        </label>

        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          The model card sells a 1.312 GB download and a 262,144-token window as if they were
          independent facts. They are not. llama.cpp sizes the attention cache to whatever you pass{" "}
          <span className="font-mono text-[11px] text-foreground">--ctx-size</span> and allocates all
          of it when the model loads, so the context length you ask for is a memory decision you make
          before the first token comes out.
          <br />
          <br />
          The per-token cost is fixed by the config:{" "}
          <span className="font-mono text-[11px] text-foreground">num_key_value_heads: 2</span>,{" "}
          <span className="font-mono text-[11px] text-foreground">head_dim: 256</span>, and six
          full-attention layers among twenty-four — 2 × 2 × 256 × 6 = 6,144 values per token, or{" "}
          <span style={{ color: KV }}>12 KiB at f16</span>. Multiply by 262,144 and the cache is{" "}
          <span style={{ color: KV }}>3.22 GB</span>, two and a half times the weights it serves.
          <br />
          <br />
          Push the context slider to the right on an 8 GB phone and watch the red segment eat the
          budget. Then set KV to{" "}
          <span className="font-mono text-[11px] text-foreground">q8_0</span> and watch it halve —
          that flag, not the quant you picked, is the one that decides whether long context is
          reachable on a handset. The eighteen Gated DeltaNet layers are the reason any of this is
          survivable: they keep a{" "}
          <span style={{ color: REC }}>fixed 20.2 MB</span> of recurrent state no matter how long the
          conversation gets. Had all twenty-four layers been full attention, 262k would want 12.9 GB
          of cache and no phone would be in this conversation at all.
        </p>
      </div>
    </figure>
  )
}
