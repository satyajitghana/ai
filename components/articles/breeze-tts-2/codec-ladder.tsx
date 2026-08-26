"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"

// One codec frame -> 1920 samples, and the streaming state that makes it possible
// to do that one frame at a time.
//
// Shapes from BreezeBlue/Breeze-TTS-2 audio_tokenizer/config.json decoder_config:
//   codebook_dim 512, latent_dim 1024, decoder_dim 1536,
//   upsampling_ratios [2, 2], upsample_rates [8, 5, 4, 3], sliding_window 72,
//   num_hidden_layers 8, num_key_value_heads 16, head_dim 64.
//   2 · 2 · 8 · 5 · 4 · 3 = 1920 = decode_upsample_rate. 1920 / 24000 = 80 ms.
//
// Left-cache lengths from models/stream_runtime/stream/lane.py:
//   _causal_conv_left_cache_len(conv) = conv.padding, and in qwen_tts's
//   Qwen3TTSTokenizerV2CausalConvNet, padding = (k-1)·dilation + 1 - stride.
//   _tconv_left_cache_len(conv)       = (kernel - 1) // stride.
//   ConvNeXt dwconv is k=7; each DecoderBlock's transposed conv is k=2·rate,
//   stride=rate; its three residual units are k=7 at dilations 1, 3, 9.
//
// Buffer sizes from models/stream_runtime/stream/runtime.py:
//   build_request_state_slot allocates (1, channels, left) per conv - persistent
//   across chunks - plus a StaticShiftKVCache of (1, h_kv, window, head_dim) per
//   layer. build_workspace_slot allocates (1, channels, left + step_len) scratch,
//   where step_len scales linearly with chunk_frames. Dtype is the tokenizer's:
//   every tensor in audio_tokenizer/model.safetensors is F32.
//
// Nothing here reads a future frame. Every convolution is causal with a left cache
// and the transformer's window is entirely backwards, so the algorithmic lookahead
// of the codec decoder is zero frames.

const BLUE = "oklch(0.60 0.15 255)"
const GREEN = "oklch(0.55 0.16 155)"
const AMBER = "oklch(0.68 0.13 85)"

type Row = {
  name: string
  lenIn: number
  lenOut: number
  cache: string
  kib: number
  kv?: boolean
}

// name, length multiplier in, out, left-cache description, persistent KiB (fp32)
const ROWS: Row[] = [
  { name: "quantizer.decode — 16 × 256-d", lenIn: 1, lenOut: 1, cache: "—", kib: 0 },
  { name: "pre_conv  k=3  512→1024", lenIn: 1, lenOut: 1, cache: "2 frames", kib: 4 },
  { name: "pre_transformer  8 layers", lenIn: 1, lenOut: 1, cache: "72-frame window", kib: 4608, kv: true },
  { name: "upsample 0  ×2 + ConvNeXt", lenIn: 1, lenOut: 2, cache: "0 / 6", kib: 24 },
  { name: "upsample 1  ×2 + ConvNeXt", lenIn: 2, lenOut: 4, cache: "0 / 6", kib: 24 },
  { name: "decoder_pre_conv  k=7", lenIn: 4, lenOut: 4, cache: "6", kib: 24 },
  { name: "block 0  ×8  dil 1/3/9", lenIn: 4, lenOut: 32, cache: "1 / 6·18·54", kib: 240 },
  { name: "block 1  ×5  dil 1/3/9", lenIn: 32, lenOut: 160, cache: "1 / 6·18·54", kib: 120 },
  { name: "block 2  ×4  dil 1/3/9", lenIn: 160, lenOut: 640, cache: "1 / 6·18·54", kib: 60 },
  { name: "block 3  ×3  dil 1/3/9", lenIn: 640, lenOut: 1920, cache: "1 / 6·18·54", kib: 30 },
  { name: "final_conv  k=7 → clamp", lenIn: 1920, lenOut: 1920, cache: "6", kib: 2.25 },
]

const CONV_STATE_KIB = 528.25 // Σ channels × left × 4 bytes
const KV_KIB = 4608 // 8 layers × 2 × 16 kv-heads × 72 × 64 × 4 bytes
const WS_BASE_EL = 135_232 // Σ channels × left
const WS_PER_FRAME_EL = 1_592_832 // Σ channels × step_len at chunk_frames = 1

export function CodecLadder() {
  const [frames, setFrames] = useState(1)

  const audioMs = 80 * frames
  const wsKib = ((WS_BASE_EL + WS_PER_FRAME_EL * frames) * 4) / 1024
  const totalMib = (CONV_STATE_KIB + KV_KIB + wsKib) / 1024
  const shipped = frames === 1 ? "--fast-codec" : frames === 2 ? "eager default" : null

  const W = 700
  const H = 268
  const rowY = (i: number) => 34 + i * 17
  const barX = 400
  const barMax = 240
  const barScale = 178 / barMax

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          {frames} codec frame{frames > 1 ? "s" : ""} → {(1920 * frames).toLocaleString("en-US")} samples ={" "}
          {audioMs} ms at 24 kHz
        </span>
        <span className="font-mono text-[10px]" style={{ color: shipped ? GREEN : AMBER }}>
          {shipped ?? "not a shipped chunk size"}
        </span>
      </div>

      <div className="p-3 sm:p-4">
        <label className="block">
          <span className="font-mono text-[10px] text-muted-foreground">
            chunk_frames — <span className="text-foreground">{frames}</span> · persistent state{" "}
            <span className="text-foreground">{(CONV_STATE_KIB / 1024 + KV_KIB / 1024).toFixed(2)} MiB</span>{" "}
            · scratch workspace{" "}
            <span className="text-foreground">{(wsKib / 1024).toFixed(2)} MiB</span>{" "}
            · total <span className="text-foreground">{totalMib.toFixed(2)} MiB</span> per stream
          </span>
          <Range
            min={1}
            max={8}
            step={1}
            value={frames}
            onChange={(e) => setFrames(Number(e.currentTarget.value))}
            accent={shipped ? GREEN : AMBER}
            aria-label="codec chunk frames"
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
              {`The streaming codec decoder expanding ${frames} frame${frames > 1 ? "s" : ""} of 16 codes into ${(1920 * frames).toLocaleString("en-US")} audio samples, ${audioMs} milliseconds at 24 kilohertz. Eleven stages, each carrying a persistent left cache so no future frame is ever needed. Persistent state is ${(CONV_STATE_KIB / 1024 + KV_KIB / 1024).toFixed(2)} mebibytes and the scratch workspace is ${(wsKib / 1024).toFixed(2)} mebibytes, ${totalMib.toFixed(2)} mebibytes per concurrent stream.`}
            </title>

            {(
              [
                ["stage", 0],
                ["length in → out", 214],
                ["left cache", 306],
                ["persistent state (fp32)", barX],
              ] as const
            ).map(([label, x]) => (
              <text
                key={label}
                x={x}
                y={16}
                fontSize={7.5}
                fill="currentColor"
                fillOpacity={0.4}
                fontFamily="ui-monospace, monospace"
              >
                {label}
              </text>
            ))}
            <line x1={0} y1={22} x2={W} y2={22} stroke="currentColor" strokeOpacity={0.12} />

            {ROWS.map((r, i) => {
              const y = rowY(i)
              const colour = r.kv ? BLUE : i === 0 ? AMBER : GREEN
              const w = r.kv ? 178 : r.kib * barScale
              return (
                <g key={r.name}>
                  <text x={0} y={y} fontSize={8.5} fill="currentColor" fillOpacity={0.75} fontFamily="ui-monospace, monospace">
                    {r.name}
                  </text>
                  <text x={214} y={y} fontSize={8.5} fill="currentColor" fillOpacity={0.5} fontFamily="ui-monospace, monospace">
                    {`${r.lenIn * frames} → ${r.lenOut * frames}`}
                  </text>
                  <text x={306} y={y} fontSize={8.5} fill="currentColor" fillOpacity={0.5} fontFamily="ui-monospace, monospace">
                    {r.cache}
                  </text>
                  {r.kib > 0 ? (
                    <>
                      <rect
                        x={barX}
                        y={y - 7}
                        width={Math.max(1.5, w)}
                        height={9}
                        rx={2}
                        fill={colour}
                        fillOpacity={r.kv ? 0.3 : 0.45}
                        stroke={colour}
                        strokeOpacity={r.kv ? 0.6 : 0}
                        strokeWidth={0.8}
                        strokeDasharray={r.kv ? "3 2" : undefined}
                      />
                      <text
                        x={barX + Math.max(1.5, w) + 6}
                        y={y}
                        fontSize={8}
                        fill={colour}
                        fontFamily="ui-monospace, monospace"
                      >
                        {r.kv ? "4.50 MiB KV — off scale" : `${r.kib} KiB`}
                      </text>
                    </>
                  ) : null}
                </g>
              )
            })}

            <line x1={0} y1={rowY(ROWS.length) - 5} x2={W} y2={rowY(ROWS.length) - 5} stroke="currentColor" strokeOpacity={0.12} />
            <text x={0} y={rowY(ROWS.length) + 12} fontSize={8.5} fill="currentColor" fillOpacity={0.7} fontFamily="ui-monospace, monospace">
              {`528.25 KiB of conv state + 4.50 MiB of KV + ${(wsKib / 1024).toFixed(2)} MiB of scratch = ${totalMib.toFixed(2)} MiB per stream`}
            </text>
            <text x={0} y={rowY(ROWS.length) + 28} fontSize={8} fill={GREEN} fillOpacity={0.95} fontFamily="ui-monospace, monospace">
              every kernel is causal with a left cache — algorithmic lookahead is zero frames
            </text>
          </svg>
        </div>

        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          This is the part of the stack that decides whether streaming is real. A codec decoder that
          needs future frames imposes a floor on latency no amount of CUDA graphs can lift. Breeze&rsquo;s
          does not: <code>lane.py</code>{" "}rebuilds every convolution as a cached-left-context step,
          the transformer window looks only backwards over 72 frames (5.76 s of history), and the
          whole per-stream state is under 12 MiB. The cost is that this rewrite is hand-maintained
          against a specific upstream tokenizer — <code>compat.py</code>{" "}reaches into{" "}
          <code>qwen_tts</code>{" "}for six internal modelling classes by name.
        </p>
      </div>
    </figure>
  )
}
