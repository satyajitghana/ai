"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { mlog2 } from "@/lib/dmath"
import { cn } from "@/lib/utils"

// The token budget of an RVQ-fronted autoregressive TTS stack, instantiated with
// Breeze TTS 2's real numbers.
//
// Codec, from BreezeBlue/Breeze-TTS-2 audio_tokenizer/config.json:
//   model_type "qwen3_tts_tokenizer_12hz", encode_downsample_rate 1920,
//   input/output_sample_rate 24000  ->  24000 / 1920 = 12.5 frames per second.
//   decoder_config.num_quantizers 16, codebook_size 2048, num_semantic_quantizers 1.
//   decode_upsample_rate 1920 -> one frame decodes to 1920 samples = 80 ms of audio.
//
// Who emits what, from models/fast_streaming.py iter_audio_chunks():
//   the Qwen3 backbone samples codebook 0 (`token`), then
//   `self._depth_decoder_graph.run(...)` returns codebooks 1..15, then
//   `frame = torch.cat([token.view(1), depth_tokens[0]], dim=0)` -> 16 codes,
//   then one codec decode. So one frame of audio costs 1 + 15 + 1 = 17 serial
//   model invocations, of which exactly one runs the 1.4 B-parameter backbone.
//
// The one measured constant: the model card claims "0.32 real-time factor ...
// with the warmed-up fast path on an NVIDIA H100". At 12.5 Hz a frame is 80 ms of
// audio, so 0.32 RTF = 25.6 ms of wall time per frame, spread over those 17 serial
// steps = 1.506 ms per step. Everything else here is that constant times the
// step count implied by (frame rate, depth). Holding mean step time fixed across
// depths is an approximation - batch-1 decode is launch- and bandwidth-bound, so
// it is a decent one, but it is an extrapolation and the widget says so.

const BLUE = "oklch(0.60 0.15 255)"
const AMBER = "oklch(0.68 0.13 85)"
const GREEN = "oklch(0.55 0.16 155)"
const RED = "oklch(0.58 0.19 27)"

const CODEBOOK_SIZE = 2048
const BITS = mlog2(CODEBOOK_SIZE) // 11, exactly
const MEASURED_RTF = 0.32
const MEASURED_HZ = 12.5
const MEASURED_DEPTH = 16
// 0.32 * (1000 / 12.5) / (16 + 1)
const STEP_MS = (MEASURED_RTF * (1000 / MEASURED_HZ)) / (MEASURED_DEPTH + 1)

const PRESETS = [
  { label: "Breeze TTS 2", hz: 12.5, n: 16, note: "audio_tokenizer/config.json" },
  { label: "Mimi, all 32", hz: 12.5, n: 32, note: "bundled codec_config" },
  { label: "half depth", hz: 12.5, n: 8, note: "hypothetical" },
  { label: "double rate", hz: 25, n: 16, note: "hypothetical" },
]

const HZ_STEPS = [6.25, 8, 10, 12.5, 16, 20, 25, 32, 40, 50]

export function TokenBudget() {
  const [hzIdx, setHzIdx] = useState(3)
  const [depth, setDepth] = useState(16)

  const hz = HZ_STEPS[hzIdx]
  const tokensPerSec = hz * depth
  const kbps = (tokensPerSec * BITS) / 1000
  const frameMs = 1000 / hz
  const stepsPerFrame = depth + 1
  const stepsPerSec = stepsPerFrame * hz
  const frameWallMs = stepsPerFrame * STEP_MS
  const rtf = frameWallMs / frameMs
  const realtime = rtf < 1

  const isBreeze = hz === MEASURED_HZ && depth === MEASURED_DEPTH

  const W = 700
  const H = 244
  const barX = 118
  const barW = 520

  // Row B — the inside of one frame, one cell per serial model invocation.
  const cellW = barW / stepsPerFrame
  const cells = Array.from({ length: stepsPerFrame }, (_, i) => i)
  // Draw a visible gap only while the cells are wide enough to survive it.
  const gap = cellW > 6 ? 1.2 : 0

  // Row C — real-time factor. 1.0x sits at 62% of the track so slower-than-real-time
  // still has somewhere to go.
  const rtfTrackW = 520
  const rtfOne = barX + rtfTrackW * 0.62
  const rtfX = rtf <= 1 ? barX + rtfTrackW * 0.62 * rtf : Math.min(barX + rtfTrackW, rtfOne + (rtfTrackW * 0.38 * (rtf - 1)) / 2)

  const fmt = (v: number, d = 0) =>
    v.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d })

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          frame rate × codebook depth → what the LM has to emit per second
        </span>
        <span
          className="font-mono text-[10px]"
          style={{ color: realtime ? GREEN : RED }}
        >
          {realtime ? `${(1 / rtf).toFixed(2)}× real time` : `${rtf.toFixed(2)}× too slow`}
        </span>
      </div>

      <div className="p-3 sm:p-4">
        <div className="flex flex-wrap gap-1.5">
          {PRESETS.map((p) => {
            const on = hz === p.hz && depth === p.n
            return (
              <button
                key={p.label}
                type="button"
                onClick={() => {
                  setHzIdx(HZ_STEPS.indexOf(p.hz))
                  setDepth(p.n)
                }}
                aria-pressed={on}
                className={cn(
                  "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
                  on
                    ? "border-foreground/30 bg-muted/50 text-foreground"
                    : "border-border text-muted-foreground hover:text-foreground",
                )}
              >
                {p.label} · {p.hz} Hz × {p.n}
              </button>
            )
          })}
        </div>

        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="font-mono text-[10px] text-muted-foreground">
              codec frame rate — <span className="text-foreground">{hz} Hz</span> ({frameMs.toFixed(1)} ms of audio per frame)
            </span>
            <Range
              min={0}
              max={HZ_STEPS.length - 1}
              step={1}
              value={hzIdx}
              onChange={(e) => setHzIdx(Number(e.currentTarget.value))}
              accent={BLUE}
              aria-label="codec frame rate"
              className="mt-1 w-full"
            />
          </label>
          <label className="block">
            <span className="font-mono text-[10px] text-muted-foreground">
              codebooks per frame — <span className="text-foreground">{depth}</span> ({depth - 1} on the depth decoder)
            </span>
            <Range
              min={1}
              max={32}
              step={1}
              value={depth}
              onChange={(e) => setDepth(Number(e.currentTarget.value))}
              accent={AMBER}
              aria-label="codebooks per frame"
              className="mt-1 w-full"
            />
          </label>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {(
            [
              ["codec tokens / s", fmt(tokensPerSec), AMBER],
              ["bitrate", `${kbps.toFixed(2)} kbit/s`, GREEN],
              ["serial steps / s", fmt(stepsPerSec, 1), BLUE],
              ["real-time factor", rtf.toFixed(3), realtime ? GREEN : RED],
            ] as const
          ).map(([label, value, colour]) => (
            <div key={label} className="rounded-lg border bg-background/40 px-2.5 py-1.5">
              <div className="font-mono text-[9.5px] text-muted-foreground">{label}</div>
              <div className="font-mono text-sm" style={{ color: colour }}>
                {value}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-3 overflow-x-auto">
          <svg
            viewBox={`0 0 ${W} ${H}`}
            width={W}
            height={H}
            role="img"
            className="min-w-[660px] max-w-full"
          >
            <title>
              {`At ${hz} frames per second with ${depth} codebooks, the language model emits ${fmt(tokensPerSec)} codec tokens per second — ${kbps.toFixed(2)} kilobits per second. One frame carries ${frameMs.toFixed(1)} milliseconds of audio and costs ${stepsPerFrame} serial model invocations: one backbone step, ${depth - 1} depth-decoder steps and one codec decode. At the measured mean of ${STEP_MS.toFixed(2)} milliseconds per step that is ${frameWallMs.toFixed(1)} milliseconds of wall time, a real-time factor of ${rtf.toFixed(3)} — ${realtime ? `${(1 / rtf).toFixed(2)} times faster than real time` : "too slow for real-time playback"}.`}
            </title>

            {/* Row A — one second of audio, cut into frames */}
            <text x={0} y={16} fontSize={9} fill="currentColor" fillOpacity={0.5} fontFamily="ui-monospace, monospace">
              1 s of audio
            </text>
            <rect x={barX} y={6} width={barW} height={16} rx={3} fill={BLUE} fillOpacity={0.08} stroke={BLUE} strokeOpacity={0.3} />
            {Array.from({ length: Math.round(hz) }, (_, i) => i).map((i) => (
              <line
                key={i}
                x1={barX + (barW * i) / hz}
                y1={6}
                x2={barX + (barW * i) / hz}
                y2={22}
                stroke={BLUE}
                strokeOpacity={0.45}
                strokeWidth={0.9}
              />
            ))}
            <text x={barX + barW} y={16} fontSize={9} textAnchor="end" fill={BLUE} fontFamily="ui-monospace, monospace">
              {hz} frames
            </text>

            {/* Row B — inside one frame */}
            <text x={0} y={56} fontSize={9} fill="currentColor" fillOpacity={0.5} fontFamily="ui-monospace, monospace">
              1 frame
            </text>
            <text x={0} y={68} fontSize={8} fill="currentColor" fillOpacity={0.35} fontFamily="ui-monospace, monospace">
              {frameMs.toFixed(1)} ms audio
            </text>
            {cells.map((i) => {
              const kind = i === 0 ? "backbone" : i === stepsPerFrame - 1 ? "codec" : "depth"
              const colour = kind === "backbone" ? BLUE : kind === "codec" ? GREEN : AMBER
              return (
                <rect
                  key={i}
                  x={barX + cellW * i + gap / 2}
                  y={46}
                  width={Math.max(1, cellW - gap)}
                  height={26}
                  rx={cellW > 8 ? 2.5 : 1}
                  fill={colour}
                  fillOpacity={kind === "depth" ? 0.35 : 0.6}
                  stroke={colour}
                  strokeOpacity={0.7}
                  strokeWidth={0.7}
                />
              )
            })}

            {/* Row B legend, on its own line so nothing lands on a cell */}
            {(
              [
                ["1 × backbone step — Qwen3, 28 layers, 2048 wide", BLUE, 0],
                [`${depth - 1} × depth step — 12 layers, 1024 wide`, AMBER, 268],
                ["1 × codec decode", GREEN, 486],
              ] as const
            ).map(([label, colour, dx]) => (
              <g key={label}>
                <rect x={barX + dx} y={82} width={8} height={8} rx={1.5} fill={colour} fillOpacity={0.7} />
                <text x={barX + dx + 12} y={89} fontSize={7.5} fill="currentColor" fillOpacity={0.55} fontFamily="ui-monospace, monospace">
                  {label}
                </text>
              </g>
            ))}

            {/* Row C — the arithmetic, written out */}
            <line x1={0} y1={108} x2={W} y2={108} stroke="currentColor" strokeOpacity={0.1} />
            <text x={0} y={128} fontSize={9.5} fill="currentColor" fillOpacity={0.8} fontFamily="ui-monospace, monospace">
              {`${stepsPerFrame} serial steps × ${STEP_MS.toFixed(2)} ms = ${frameWallMs.toFixed(1)} ms of compute per ${frameMs.toFixed(1)} ms of audio`}
            </text>
            <text x={0} y={143} fontSize={8} fill="currentColor" fillOpacity={0.4} fontFamily="ui-monospace, monospace">
              {`step time pinned to the model card's 0.32 RTF at 12.5 Hz × 16, then held fixed`}
            </text>

            {/* Row D — RTF track */}
            <text x={0} y={182} fontSize={9} fill="currentColor" fillOpacity={0.5} fontFamily="ui-monospace, monospace">
              RTF
            </text>
            <rect x={barX} y={172} width={rtfTrackW} height={14} rx={7} fill="currentColor" fillOpacity={0.05} />
            <rect
              x={barX}
              y={172}
              width={Math.max(2, rtfX - barX)}
              height={14}
              rx={7}
              fill={realtime ? GREEN : RED}
              fillOpacity={0.4}
            />
            <line x1={rtfOne} y1={168} x2={rtfOne} y2={192} stroke="currentColor" strokeOpacity={0.45} strokeWidth={1.2} strokeDasharray="3 2" />
            <text x={rtfOne} y={204} fontSize={8} textAnchor="middle" fill="currentColor" fillOpacity={0.5} fontFamily="ui-monospace, monospace">
              1.00 — real time
            </text>
            <text
              x={barX + rtfTrackW}
              y={161}
              fontSize={9.5}
              textAnchor="end"
              fill={realtime ? GREEN : RED}
              fontFamily="ui-monospace, monospace"
            >
              {realtime ? `${rtf.toFixed(3)} · ${(1 / rtf).toFixed(2)}× faster than real time` : `${rtf.toFixed(3)} · drops out`}
            </text>

            <text
              x={0}
              y={230}
              fontSize={8.5}
              fill={isBreeze ? GREEN : "currentColor"}
              fillOpacity={isBreeze ? 1 : 0.4}
              fontFamily="ui-monospace, monospace"
            >
              {isBreeze
                ? "shipped configuration — 12.5 Hz × 16 codebooks × 2048 entries = 2.20 kbit/s"
                : `${hz} Hz × ${depth} × 2048 entries = ${kbps.toFixed(2)} kbit/s — not the shipped configuration`}
            </text>
          </svg>
        </div>

        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          The frame rate is the number everyone quotes, and on its own it is misleading. Breeze runs
          the same <span className="text-foreground">12.5 Hz</span>{" "}frame rate as a single-stream
          supervised tokenizer, but each frame carries{" "}
          <span className="text-foreground">16</span>{" "}residual codebooks, so the model emits{" "}
          <span className="text-foreground">200 tokens per second of speech</span>, not 12.5. What
          saves it is that only <span className="text-foreground">12.5</span>{" "}of those touch the
          1.4 B-parameter backbone — the other 187.5 go through a 12-layer, 1024-wide depth decoder
          whose entire 15-step loop is captured as one CUDA graph.
        </p>
      </div>
    </figure>
  )
}
