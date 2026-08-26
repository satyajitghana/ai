"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// The critical path to the first audio sample, counted in serial transformer-layer
// evaluations. Every count here is read off the config or the code, not measured.
//
// text encoder — config.json text_encoder_config: 26 layers, hidden 1152, bidirectional
//   (models/t5gemma2_compat.py sets `self.is_causal = False`). It runs on the whole
//   text segment at once, so it is 1 pass. With CFG it runs on the negative prompt too:
//   models/fast_streaming.py `_build_branch_batch` calls `_merge_branch` twice when
//   `_fast_text_encoder` is off, and `_merge_cfg_branches` once (batch 2) when it is on.
//
// backbone — config.json: 28 layers, hidden 2048 (Qwen3-1.7B's layer stack). One
//   prefill pass over the merged prompt, then one pass per frame.
//
// depth decoder — config.json depth_decoder_config: 12 layers, hidden 1024.
//   models/cudagraph/depth_decoder_graph.py: "Step 0: prefill with 2 tokens ...
//   Steps 1..num_codebooks-2: decode 1 token at a time", i.e. 15 forward passes to
//   produce codebooks 1..15. 15 × 12 = 180 layer evaluations, per 80 ms frame,
//   captured as a single CUDA graph.
//
// codec — audio_tokenizer/config.json decoder_config: pre_transformer has 8 layers,
//   sliding_window 72. models/stream_runtime/stream/lane.py wraps 35 causal
//   convolutions with left-cache state. One pass per chunk.
//
// chunk size — models/fast_streaming.py: `self._codec_chunk_frames = 1 if self._fast_codec else 2`.
//   One frame = decode_upsample_rate 1920 samples = 80 ms at 24 kHz.
//
// The reordering is in the source as a comment:
//   "A complete codec frame can be decoded immediately. Emit it before computing the
//    next backbone token so that one full backbone decode step is no longer on the
//    TTFA critical path."

const GREEN = "oklch(0.55 0.16 155)"
const BLUE = "oklch(0.60 0.15 255)"
const AMBER = "oklch(0.68 0.13 85)"
const MUTED = "oklch(0.62 0.03 250)"

type Stage = { key: string; label: string; sub: string; layers: number; colour: string; batch?: boolean }

export function StreamTimeline() {
  const [firstChunk, setFirstChunk] = useState(true)
  const [cfg, setCfg] = useState(false)
  const [fast, setFast] = useState(true)

  const chunkFrames = fast ? 1 : 2
  const encoderPasses = cfg && !fast ? 2 : 1

  const stages: Stage[] = []
  if (firstChunk) {
    stages.push({
      key: "text",
      label: "Gemma-3-1B text encoder",
      sub: `26 layers × ${encoderPasses}${cfg && !fast ? " (run twice)" : ""}`,
      layers: 26 * encoderPasses,
      colour: GREEN,
      batch: cfg && fast,
    })
    stages.push({
      key: "prefill",
      label: "Qwen3 backbone prefill",
      sub: "28 layers",
      layers: 28,
      colour: BLUE,
      batch: cfg,
    })
  } else {
    stages.push({
      key: "decode",
      label: "Qwen3 backbone decode",
      sub: `28 layers × ${chunkFrames} frame${chunkFrames > 1 ? "s" : ""}`,
      layers: 28 * chunkFrames,
      colour: BLUE,
      batch: cfg,
    })
  }
  stages.push({
    key: "depth",
    label: "depth decoder",
    sub: `15 steps × 12 layers${firstChunk ? "" : ` × ${chunkFrames} frames`}`,
    layers: 180 * (firstChunk ? 1 : chunkFrames),
    colour: AMBER,
    batch: cfg,
  })
  stages.push({
    key: "codec",
    label: "codec decode",
    sub: "8 layers + 35 causal convs",
    layers: 8,
    colour: MUTED,
  })

  const total = stages.reduce((a, s) => a + s.layers, 0)
  const audioMs = 80 * chunkFrames
  const perSecond = 12.5 * (28 + 180) + 12.5 * 8 / chunkFrames

  const W = 700
  const H = 166
  const trackX = 6
  const trackW = 600
  const trackY = 14
  const trackH = 36

  let cursor = trackX
  const boxes = stages.map((s) => {
    const w = (trackW * s.layers) / total
    const box = { ...s, x: cursor, w }
    cursor += w
    return box
  })

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          the path to {firstChunk ? "the first" : "the next"} {audioMs} ms of audio
        </span>
        <span className="font-mono text-[10px]" style={{ color: AMBER }}>
          {total} serial transformer-layer evaluations
        </span>
      </div>

      <div className="p-3 sm:p-4">
        <div className="flex flex-wrap items-center gap-1.5">
          {(
            [
              [firstChunk ? "first chunk" : "steady state", () => setFirstChunk((v) => !v), true],
              [fast ? "--fast-all" : "eager (default)", () => setFast((v) => !v), fast],
              [cfg ? "--cfg-scale 4" : "--cfg-scale 1", () => setCfg((v) => !v), cfg],
            ] as const
          ).map(([label, onClick, on], i) => (
            <button
              key={i}
              type="button"
              onClick={onClick}
              aria-pressed={Boolean(on)}
              className={cn(
                "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
                on
                  ? "border-foreground/30 bg-muted/50 text-foreground"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {label}
            </button>
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
              {`The ${firstChunk ? "first-chunk" : "steady-state"} critical path with ${fast ? "the fast path enabled" : "eager execution"} and classifier-free guidance ${cfg ? "at 4" : "off"}. ${stages.map((s) => `${s.label}: ${s.layers} layer evaluations`).join("; ")}. Total ${total} serial layer evaluations to produce ${audioMs} milliseconds of audio.`}
            </title>

            {boxes.map((b) => (
              <g key={b.key}>
                <rect
                  x={b.x + 1}
                  y={trackY}
                  width={Math.max(2, b.w - 2)}
                  height={trackH}
                  rx={4}
                  fill={b.colour}
                  fillOpacity={0.22}
                  stroke={b.colour}
                  strokeOpacity={0.75}
                  strokeWidth={0.9}
                />
                {b.w > 104 ? (
                  <text
                    x={b.x + b.w / 2}
                    y={trackY + 15}
                    fontSize={8}
                    textAnchor="middle"
                    fill={b.colour}
                    fontFamily="ui-monospace, monospace"
                  >
                    {b.label}
                  </text>
                ) : null}
                {b.w > 40 ? (
                  <text
                    x={b.x + b.w / 2}
                    y={b.w > 104 ? trackY + 29 : trackY + 22}
                    fontSize={10}
                    textAnchor="middle"
                    fill={b.colour}
                    fontFamily="ui-monospace, monospace"
                  >
                    {b.layers}
                  </text>
                ) : null}
              </g>
            ))}

            {/* audio out */}
            <path
              d={`M${trackX + trackW + 4} ${trackY + trackH / 2} h14`}
              stroke="currentColor"
              strokeOpacity={0.35}
              strokeWidth={1.2}
            />
            <rect
              x={trackX + trackW + 20}
              y={trackY + 5}
              width={52}
              height={26}
              rx={4}
              fill={GREEN}
              fillOpacity={0.14}
              stroke={GREEN}
              strokeOpacity={0.6}
              strokeWidth={0.9}
            />
            <text
              x={trackX + trackW + 46}
              y={trackY + 22}
              fontSize={8.5}
              textAnchor="middle"
              fill={GREEN}
              fontFamily="ui-monospace, monospace"
            >
              {audioMs} ms
            </text>

            {/* sub-labels below the track, one line per stage, left-aligned in a column */}
            {boxes.map((b, i) => (
              <text
                key={`sub-${b.key}`}
                x={6}
                y={trackY + trackH + 20 + i * 13}
                fontSize={8}
                fill="currentColor"
                fillOpacity={0.5}
                fontFamily="ui-monospace, monospace"
              >
                <tspan fill={b.colour} fillOpacity={0.95}>
                  {"■ "}
                </tspan>
                {`${b.label} — ${b.sub} = ${b.layers}${b.batch ? "   ·   batch 2 under CFG" : ""}`}
              </text>
            ))}

            <line x1={0} y1={H - 44} x2={W} y2={H - 44} stroke="currentColor" strokeOpacity={0.1} />
            <text x={0} y={H - 26} fontSize={8.5} fill="currentColor" fillOpacity={0.7} fontFamily="ui-monospace, monospace">
              {`steady state costs ${Math.round(perSecond)} serial layer evaluations per second of speech — ${chunkFrames === 1 ? "one" : "two"} codec ${chunkFrames === 1 ? "frame" : "frames"} per chunk`}
            </text>
            <text x={0} y={H - 10} fontSize={8} fill={AMBER} fillOpacity={0.95} fontFamily="ui-monospace, monospace">
              iter_audio_chunks emits the chunk before the next backbone step — one decode off the TTFA path
            </text>
          </svg>
        </div>

        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          The backbone is the big model and it is not the long pole. Eighty milliseconds of speech
          costs <span className="text-foreground">28</span>{" "}layer evaluations on the 1.4 B-parameter
          Qwen3 stack and <span className="text-foreground">180</span>{" "}on the 12-layer depth decoder,
          because the depth decoder has to run fifteen times to fill one frame. At batch one those
          steps are launch- and bandwidth-bound rather than FLOP-bound, which is why the fast path
          spends its most aggressive trick — full-graph compilation with the whole fifteen-step loop
          captured as a single CUDA graph — on the smallest model in the stack.
        </p>
      </div>
    </figure>
  )
}
