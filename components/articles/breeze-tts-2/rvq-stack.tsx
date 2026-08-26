"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { mpow } from "@/lib/dmath"

// Residual vector quantisation as Breeze TTS 2's codec actually builds it.
//
// qwen_tts/core/tokenizer_12hz/modeling_qwen3_tts_tokenizer_v2.py:
//
//   self.quantizer = SplitResidualVectorQuantizer(
//       dimension=config.codebook_dim // 2,   # 512 // 2 = 256
//       n_q=config.num_quantizers,            # 16
//       n_q_semantic=1,
//       bins=config.codebook_size,            # 2048 for EVERY codebook, including
//                                             # the semantic one - decoder_config's
//                                             # semantic_codebook_size: 4096 is never read
//       input_dimension=config.codebook_dim,  # 512
//       output_dimension=config.codebook_dim, # 512
//   )
//
// SplitResidualVectorQuantizer.decode sums rvq_first (codebook 0) and rvq_rest
// (codebooks 1..15); ResidualVectorQuantization.decode is a plain running sum:
//
//   for idx, layer_codes in enumerate(codes):
//       quantized = quantized + self.layers[idx].decode(layer_codes)
//
// So every codebook adds one 256-d correction to the same 512-d frame vector.
// Codebook 0 is the one the Qwen3 backbone samples; 1..15 come out of the depth
// decoder's 15 unrolled steps (models/fast_streaming.py, iter_audio_chunks).
//
// The truncation the slider invites is NOT available in this implementation:
//   Qwen3TTSTokenizerV2Decoder.forward opens with
//     if codes.shape[1] != self.config.num_quantizers: raise ValueError(...)
//   and models/fast_streaming.py always stacks all 16 before calling it.
//
// The residual band is a schematic geometric decay - the codec's actual per-stage
// residual energies are not published anywhere in the repo or the checkpoint. The
// bit and parameter numbers beside it are exact.

const BLUE = "oklch(0.60 0.15 255)"
const GREEN = "oklch(0.55 0.16 155)"
const AMBER = "oklch(0.68 0.13 85)"

const N = 16
const BINS = 2048
const BITS = 11 // log2(2048)
const DIM = 256
const HZ = 12.5

export function RvqStack() {
  const [keep, setKeep] = useState(16)

  const bitsPerFrame = keep * BITS
  const kbps = (HZ * bitsPerFrame) / 1000
  const paramsKept = keep * BINS * DIM

  const W = 700
  const H = 236
  const left = 74
  const trackW = 598
  const colW = trackW / N
  const topY = 34
  const bandH = 74

  const residual = (k: number) => mpow(0.84, k)

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          16 residual codebooks, 2048 entries each, one 512-d frame vector
        </span>
        <span className="font-mono text-[10px]" style={{ color: keep === N ? GREEN : AMBER }}>
          {keep} / {N} kept · {kbps.toFixed(2)} kbit/s
        </span>
      </div>

      <div className="p-3 sm:p-4">
        <label className="block">
          <span className="font-mono text-[10px] text-muted-foreground">
            codebooks kept —{" "}
            <span className="text-foreground">
              {keep}
            </span>{" "}
            ({bitsPerFrame} bits per 80 ms frame, {(paramsKept / 1e6).toFixed(2)} M codebook parameters)
          </span>
          <Range
            min={1}
            max={N}
            step={1}
            value={keep}
            onChange={(e) => setKeep(Number(e.currentTarget.value))}
            accent={keep === N ? GREEN : AMBER}
            aria-label="codebooks kept"
            className="mt-1 w-full"
          />
        </label>

        <div className="mt-3 overflow-x-auto">
          <svg
            viewBox={`0 0 ${W} ${H}`}
            width={W}
            height={H}
            role="img"
            className="min-w-[660px] max-w-full"
          >
            <title>
              {`A residual vector quantiser sixteen codebooks deep. Codebook 0 is the semantic quantiser sampled by the Qwen3 backbone; codebooks 1 to 15 are acoustic refinements produced by the depth decoder's fifteen unrolled steps. ${keep} of the 16 are kept, which is ${bitsPerFrame} bits per 80-millisecond frame or ${kbps.toFixed(2)} kilobits per second. ${keep === N ? "This is the shipped configuration." : "The shipped decoder rejects any input that is not exactly 16 codebooks deep, so this truncation cannot actually be run."}`}
            </title>

            {/* residual band */}
            <text x={0} y={topY - 8} fontSize={8} fill="currentColor" fillOpacity={0.4} fontFamily="ui-monospace, monospace">
              residual left
            </text>
            <text x={0} y={topY + 3} fontSize={8} fill="currentColor" fillOpacity={0.28} fontFamily="ui-monospace, monospace">
              (schematic)
            </text>
            {Array.from({ length: N }, (_, k) => k).map((k) => {
              const on = k < keep
              const h = bandH * residual(k)
              const hNext = bandH * residual(k + 1)
              const x = left + colW * k
              return (
                <g key={`res-${k}`} opacity={on ? 1 : 0.18}>
                  <rect
                    x={x + 1}
                    y={topY + bandH - h}
                    width={colW - 2}
                    height={h}
                    fill="currentColor"
                    fillOpacity={0.1}
                  />
                  <rect
                    x={x + 1}
                    y={topY + bandH - h}
                    width={colW - 2}
                    height={h - hNext}
                    fill={k === 0 ? BLUE : GREEN}
                    fillOpacity={0.3}
                  />
                </g>
              )
            })}
            <line
              x1={left}
              y1={topY + bandH}
              x2={left + trackW}
              y2={topY + bandH}
              stroke="currentColor"
              strokeOpacity={0.2}
            />

            {/* the codebooks themselves */}
            {Array.from({ length: N }, (_, k) => k).map((k) => {
              const on = k < keep
              const colour = k === 0 ? BLUE : GREEN
              const x = left + colW * k
              return (
                <g key={`cb-${k}`} opacity={on ? 1 : 0.22}>
                  <rect
                    x={x + 1.5}
                    y={topY + bandH + 10}
                    width={colW - 3}
                    height={24}
                    rx={3}
                    fill={colour}
                    fillOpacity={on ? 0.22 : 0.08}
                    stroke={colour}
                    strokeOpacity={on ? 0.75 : 0.3}
                    strokeWidth={0.8}
                  />
                  <text
                    x={x + colW / 2}
                    y={topY + bandH + 26}
                    fontSize={9}
                    textAnchor="middle"
                    fill={colour}
                    fontFamily="ui-monospace, monospace"
                  >
                    {k}
                  </text>
                </g>
              )
            })}
            <text x={0} y={topY + bandH + 27} fontSize={8} fill="currentColor" fillOpacity={0.4} fontFamily="ui-monospace, monospace">
              codebook
            </text>

            {/* who predicts what */}
            <path
              d={`M${left + 2} ${topY + bandH + 44} v6 h${colW - 4} v-6`}
              fill="none"
              stroke={BLUE}
              strokeOpacity={0.6}
              strokeWidth={1.1}
            />
            <path
              d={`M${left + colW + 2} ${topY + bandH + 44} v6 h${colW * 15 - 4} v-6`}
              fill="none"
              stroke={AMBER}
              strokeOpacity={0.6}
              strokeWidth={1.1}
            />
            <text
              x={left + colW / 2}
              y={topY + bandH + 63}
              fontSize={7.5}
              textAnchor="middle"
              fill={BLUE}
              fontFamily="ui-monospace, monospace"
            >
              backbone
            </text>
            <text
              x={left + colW + (colW * 15) / 2}
              y={topY + bandH + 63}
              fontSize={7.5}
              textAnchor="middle"
              fill={AMBER}
              fontFamily="ui-monospace, monospace"
            >
              depth decoder — 15 unrolled steps, one CUDA graph
            </text>

            {/* the sum */}
            <text x={0} y={H - 26} fontSize={8.5} fill="currentColor" fillOpacity={0.55} fontFamily="ui-monospace, monospace">
              {`decode: sum of ${keep} × 256-d corrections → 512-d frame → 1920 samples (80 ms)`}
            </text>
            <text
              x={0}
              y={H - 10}
              fontSize={8.5}
              fill={keep === N ? GREEN : AMBER}
              fontFamily="ui-monospace, monospace"
            >
              {keep === N
                ? "16 codebooks × 11 bits × 12.5 Hz = 2.20 kbit/s — the shipped rate"
                : `Qwen3TTSTokenizerV2Decoder.forward raises unless codes.shape[1] == 16 — ${keep} is not runnable`}
            </text>
          </svg>
        </div>

        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          RVQ is a running sum: each codebook quantises what the previous ones left over, so depth
          buys fidelity at a linear cost in tokens. The usual pitch is that you can{" "}
          <em>truncate</em>{" "}— keep the first few codebooks for a cheap, coarse stream. Breeze
          cannot. The decoder&rsquo;s first statement is a shape check against{" "}
          <code>num_quantizers</code>, and the streaming runtime always stacks all sixteen before
          calling it. Depth here is a fixed property of the checkpoint, not a dial.
        </p>
      </div>
    </figure>
  )
}
