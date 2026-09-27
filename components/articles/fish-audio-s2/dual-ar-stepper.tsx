"use client"

import { useEffect, useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { cn } from "@/lib/utils"

// Fish Audio S2's Dual-AR decode loop, one micro-step at a time, plus the cost
// arithmetic that falls out of (frame rate x codebook depth).
//
// Shapes, measured from the safetensors headers of fishaudio/s2-pro at
// 1de9996b6be38b745688de084d87a5633f714e4e:
//   text_model.model.layers.*   36 layers, 2560 wide      3,633,509,376
//   text_model.model.embeddings [155776, 2560], tied head   398,786,560
//   audio_decoder.layers.*      4 layers, 2560 wide         403,722,240
//   audio_decoder.output        [4096, 2560]                 10,485,760
//
// Loop, from fish_speech/models/text2semantic/inference.py decode_one_token_ar():
//   one slow forward -> sample q0 (constrained to the 4,096 semantic ids + <|im_end|>)
//   forward_generate_fast(hidden, pos 0)            -> conditioning pass, logits unused
//   for codebook_idx in 1..N-1: forward_generate_fast(embed(prev), pos idx) -> q_idx
// so N codebooks cost 1 slow pass and N fast passes per frame.
//
// Codec, from fish_speech/configs/modded_dac_vq.yaml: 44.1 kHz, encoder rates
// [2,4,8,8] = 512x, quantizer downsample [2,2] = 4x, so hop 2048 -> 21.53 Hz.
// Semantic codebook 4,096 entries (12 bits), residual codebooks 1,024 (10 bits).
//
// The one timing constant is somebody else's measurement: SGLang-Omni's README
// reports 63.3 tok/s at batch size 1 on one H200 (RTF 0.34; 21.53 / 63.3 = 0.340,
// so a "tok" there is a frame). I assume batch-1 decode is bound by reading
// weights, count the weights each frame reads (both LM heads included, since the
// reference code computes full-vocabulary logits), and calibrate one
// seconds-per-weight constant to that point. Everything else is that constant
// times a count. It is an extrapolation and the widget says so.

const SAMPLE_RATE = 44100
const SLOW_READS = 3_633_509_376 + 398_786_560 + 2_560 // layers + tied head + norm
const FAST_READS = 403_722_240 + 10_485_760 + 2_560 // per fast pass
const SHIPPED_N = 10
const SHIPPED_HOP = 2048
const SGL_FRAMES_PER_S = 63.3
const SEC_PER_READ = 1 / (SGL_FRAMES_PER_S * (SLOW_READS + SHIPPED_N * FAST_READS))
const CONTEXT = 16_384 // the report's second pre-training stage

const HOPS = [4096, 3528, 2048, 1764, 1024, 512] // 10.77 .. 86.13 Hz at 44.1 kHz
const FRAMES_SHOWN = 6

const PRESETS = [
  { label: "S2 Pro, shipped", hop: 2048, n: 10 },
  { label: "without the extra 4x", hop: 512, n: 10 },
  { label: "12.5 Hz x 16", hop: 3528, n: 16 },
  { label: "semantic only", hop: 2048, n: 1 },
]

const SLOW = "oklch(0.58 0.14 300)"
const FAST = "oklch(0.66 0.12 250)"
const FUSE = "oklch(0.72 0.12 70)"
const GOOD = "oklch(0.56 0.15 155)"
const BAD = "oklch(0.58 0.19 27)"

const fmt = (v: number, d = 0) =>
  v.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d })

export function DualArStepper() {
  const [hopIdx, setHopIdx] = useState(HOPS.indexOf(SHIPPED_HOP))
  const [n, setN] = useState(SHIPPED_N)
  const [chunk, setChunk] = useState(1)
  const [m, setM] = useState(0)
  const [playing, setPlaying] = useState(false)

  const total = FRAMES_SHOWN * n
  useEffect(() => {
    if (!playing) return
    const id = setInterval(() => setM((s) => (s >= total ? 0 : s + 1)), 240)
    return () => clearInterval(id)
  }, [playing, total])

  const hop = HOPS[hopIdx]
  const hz = SAMPLE_RATE / hop
  const frameMs = 1000 / hz
  const tokensPerSec = n * hz
  const bitsPerFrame = 12 + 10 * (n - 1)
  const kbps = (hz * bitsPerFrame) / 1000
  const fastPasses = n > 1 ? n : 0
  const readsPerFrame = SLOW_READS + fastPasses * FAST_READS
  const wallMs = readsPerFrame * SEC_PER_READ * 1000
  const rtf = wallMs / frameMs
  const rtfFlat = n * hz * SLOW_READS * SEC_PER_READ
  const firstMs = chunk * wallMs
  const firstAudioMs = chunk * frameMs
  const ctxDual = CONTEXT / hz / 60
  const ctxFlat = CONTEXT / tokensPerSec / 60
  const isShipped = hop === SHIPPED_HOP && n === SHIPPED_N
  const fastShare = (fastPasses * FAST_READS) / readsPerFrame

  // Where the animation is: micro-step mm covers frame f, codebook k.
  const mm = Math.min(m, total)
  const curF = mm >= total ? -1 : Math.floor(mm / n)
  const curK = mm >= total ? -1 : mm % n
  const filled = (f: number, k: number) => f * n + k < mm
  const doneFrames = Math.floor(mm / n)

  // Geometry.
  const W = 700
  const gridX = 150
  const colW = 72
  const gap = 12
  const gridTop = 30
  const gridH = 190
  const rows = n
  const cellH = Math.min(24, gridH / rows)
  const cellPad = cellH > 10 ? 2 : 0.6
  const slowY = gridTop + gridH + 26
  const H = slowY + 96

  const rowY = (k: number) => gridTop + gridH - (k + 1) * cellH
  const colX = (f: number) => gridX + f * (colW + gap)

  const phase =
    curF < 0
      ? `all ${FRAMES_SHOWN} frames done: ${FRAMES_SHOWN * n} codec tokens, ${FRAMES_SHOWN} slow passes, ${FRAMES_SHOWN * fastPasses} fast passes`
      : curK === 0
        ? `frame ${curF + 1}: the slow AR reads the fused frame ${curF === 0 ? "prompt" : curF} and samples q0 from 4,096 semantic ids`
        : `frame ${curF + 1}: fast pass ${curK + 1} of ${fastPasses} samples q${curK} from its 1,024-entry codebook`

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          Dual-AR: one slow pass per frame, one fast pass per codebook
        </span>
        <span className="font-mono text-[10px]" style={{ color: rtf < 1 ? GOOD : BAD }}>
          {rtf < 1 ? `est. RTF ${rtf.toFixed(2)}` : `est. RTF ${rtf.toFixed(2)}, slower than real time`}
        </span>
      </div>

      <div className="p-3 sm:p-4">
        <div className="flex flex-wrap gap-1.5">
          {PRESETS.map((p) => {
            const on = hop === p.hop && n === p.n
            return (
              <button
                key={p.label}
                type="button"
                aria-pressed={on}
                onClick={() => {
                  setHopIdx(HOPS.indexOf(p.hop))
                  setN(p.n)
                  setM(0)
                }}
                className={cn(
                  "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
                  on
                    ? "border-foreground/30 bg-muted/50 text-foreground"
                    : "border-border text-muted-foreground hover:text-foreground",
                )}
              >
                {p.label}
              </button>
            )
          })}
        </div>

        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <label className="block">
            <span className="font-mono text-[10px] text-muted-foreground">
              frame rate: <span className="text-foreground">{hz.toFixed(2)} Hz</span> (hop {hop})
            </span>
            <Range
              min={0}
              max={HOPS.length - 1}
              step={1}
              value={hopIdx}
              onChange={(e) => setHopIdx(Number(e.currentTarget.value))}
              accent={SLOW}
              aria-label="codec frame rate"
              className="mt-1 w-full"
            />
          </label>
          <label className="block">
            <span className="font-mono text-[10px] text-muted-foreground">
              codebooks per frame: <span className="text-foreground">{n}</span>
            </span>
            <Range
              min={1}
              max={16}
              step={1}
              value={n}
              onChange={(e) => {
                setN(Number(e.currentTarget.value))
                setM(0)
              }}
              accent={FAST}
              aria-label="codebooks per frame"
              className="mt-1 w-full"
            />
          </label>
          <label className="block">
            <span className="font-mono text-[10px] text-muted-foreground">
              frames in first chunk: <span className="text-foreground">{chunk}</span>
            </span>
            <Range
              min={1}
              max={12}
              step={1}
              value={chunk}
              onChange={(e) => setChunk(Number(e.currentTarget.value))}
              accent={FUSE}
              aria-label="frames in the first audio chunk"
              className="mt-1 w-full"
            />
          </label>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setPlaying((p) => !p)}
            className="cursor-pointer rounded-md border px-2.5 py-1 font-mono text-[11px] hover:bg-muted/40"
          >
            {playing ? "pause" : "play"}
          </button>
          <button
            type="button"
            onClick={() => setM((s) => (s >= total ? 0 : s + 1))}
            className="cursor-pointer rounded-md border px-2.5 py-1 font-mono text-[11px] hover:bg-muted/40"
          >
            step
          </button>
          <button
            type="button"
            onClick={() => {
              setPlaying(false)
              setM(0)
            }}
            className="cursor-pointer rounded-md border px-2.5 py-1 font-mono text-[11px] hover:bg-muted/40"
          >
            reset
          </button>
          <span className="font-mono text-[10px] text-muted-foreground">
            {mm === 0 ? "press step or play" : phase}
          </span>
        </div>

        <div className="mt-3 overflow-x-auto">
          <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" className="min-w-[640px] max-w-full">
            <title>
              {`${FRAMES_SHOWN} codec frames at ${hz.toFixed(2)} Hz, ${n} codebooks each. Every frame costs one slow-AR pass that samples the semantic token q0 and ${fastPasses} fast-AR passes that fill the remaining ${n - 1} codebooks; the ${n} tokens are then summed into one embedding and fed back to the slow AR as the next input.`}
            </title>

            {/* row labels */}
            <text x={0} y={rowY(0) + cellH / 2 + 3} fontSize={9} fill={SLOW} fontFamily="ui-monospace, monospace">
              q0 semantic, 4,096
            </text>
            {n > 1 && (
              <text x={0} y={rowY(n - 1) + Math.max(cellH / 2, 6) + 3} fontSize={9} fill={FAST} fontFamily="ui-monospace, monospace">
                {`q${n - 1} acoustic, 1,024`}
              </text>
            )}
            {n > 2 && (
              <text x={0} y={(rowY(1) + rowY(n - 1) + cellH) / 2 + 3} fontSize={8.5} fill="currentColor" fillOpacity={0.45} fontFamily="ui-monospace, monospace">
                {`q1..q${n - 2}: fast AR`}
              </text>
            )}

            {Array.from({ length: FRAMES_SHOWN }, (_, f) => (
              <g key={f}>
                <text x={colX(f) + colW / 2} y={gridTop - 10} fontSize={8.5} textAnchor="middle" fill="currentColor" fillOpacity={0.5} fontFamily="ui-monospace, monospace">
                  {`frame ${f + 1}`}
                </text>
                <rect x={colX(f) - 3} y={gridTop - 3} width={colW + 6} height={gridH + 6} rx={5} fill="currentColor" fillOpacity={f === curF ? 0.06 : 0.02} />
                {Array.from({ length: rows }, (_, k) => {
                  const on = filled(f, k)
                  const now = f === curF && k === curK
                  const colour = k === 0 ? SLOW : FAST
                  return (
                    <rect
                      key={k}
                      x={colX(f) + cellPad}
                      y={rowY(k) + cellPad}
                      width={colW - 2 * cellPad}
                      height={Math.max(0.8, cellH - 2 * cellPad)}
                      rx={cellH > 10 ? 3 : 0.8}
                      fill={colour}
                      fillOpacity={now ? 0.9 : on ? 0.45 : 0.06}
                      stroke={colour}
                      strokeOpacity={now ? 1 : on ? 0.5 : 0.18}
                      strokeWidth={now ? 1.6 : 0.6}
                    />
                  )
                })}
                {/* fused input for the next slow step */}
                <rect
                  x={colX(f) + colW / 2 - 13}
                  y={slowY - 18}
                  width={26}
                  height={12}
                  rx={2.5}
                  fill={FUSE}
                  fillOpacity={f < doneFrames ? 0.7 : 0.1}
                  stroke={FUSE}
                  strokeOpacity={0.6}
                  strokeWidth={0.6}
                />
              </g>
            ))}

            <text x={0} y={slowY - 9} fontSize={8.5} fill={FUSE} fontFamily="ui-monospace, monospace">
              fused: sum of {n + 1} embeddings
            </text>

            {/* the two models */}
            <rect x={gridX - 6} y={slowY} width={FRAMES_SHOWN * (colW + gap) - gap + 12} height={30} rx={6} fill={SLOW} fillOpacity={curK === 0 ? 0.28 : 0.1} stroke={SLOW} strokeOpacity={0.6} />
            <text x={gridX + 6} y={slowY + 19} fontSize={10.5} fill="currentColor" fontFamily="ui-monospace, monospace">
              slow AR: Qwen3-4B shape, 36 layers x 2560, one pass per frame
            </text>
            <text x={0} y={slowY + 19} fontSize={9} fill={SLOW} fontFamily="ui-monospace, monospace">
              time axis
            </text>
            <text x={0} y={slowY + 50} fontSize={9} fill={FAST} fontFamily="ui-monospace, monospace">
              depth axis
            </text>
            <rect x={gridX - 6} y={slowY + 36} width={FRAMES_SHOWN * (colW + gap) - gap + 12} height={24} rx={6} fill={FAST} fillOpacity={curK > 0 ? 0.28 : 0.08} stroke={FAST} strokeOpacity={0.6} />
            <text x={gridX + 6} y={slowY + 52} fontSize={10} fill="currentColor" fontFamily="ui-monospace, monospace">
              {fastPasses > 0
                ? `fast AR: 4 layers x 2560, ${fastPasses} passes per frame (1 conditioning + ${n - 1} codebooks)`
                : "fast AR: not needed with one codebook"}
            </text>
            <text x={0} y={slowY + 84} fontSize={8.5} fill="currentColor" fillOpacity={0.45} fontFamily="ui-monospace, monospace">
              {`weights read per frame: slow ${fmt(SLOW_READS / 1e9, 2)} B, fast ${fmt((fastPasses * FAST_READS) / 1e9, 2)} B (${(fastShare * 100).toFixed(0)}% of the total)`}
            </text>
          </svg>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {(
            [
              ["codec tokens / s of audio", fmt(tokensPerSec, 1), FAST],
              ["slow passes / s of audio", fmt(hz, 2), SLOW],
              ["bitrate", `${kbps.toFixed(2)} kbit/s`, "currentColor"],
              ["est. RTF, Dual-AR", rtf.toFixed(2), rtf < 1 ? GOOD : BAD],
              ["est. RTF, flattened", rtfFlat.toFixed(2), rtfFlat < 1 ? GOOD : BAD],
              ["decode to first chunk", `${firstMs.toFixed(1)} ms`, FUSE],
              ["audio in first chunk", `${firstAudioMs.toFixed(1)} ms`, "currentColor"],
              ["16,384 positions hold", `${ctxDual.toFixed(1)} vs ${ctxFlat.toFixed(1)} min`, "currentColor"],
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

        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          {isShipped ? (
            <>
              The shipped configuration: <span className="text-foreground">21.53 frames</span>{" "}
              a second, ten codebooks, <span className="text-foreground">215 codec tokens</span>{" "}
              per second of audio. Only 21.53 of those come out of the 4B slow model; the other
              193.8 come out of the four-layer fast model, which runs ten passes per frame. Flattened into one
              sequence, the same slow model would need ten times the positions and would fall
              behind real time.
            </>
          ) : (
            <>
              Not the shipped configuration. S2 Pro runs at 21.53 Hz with ten codebooks; this is{" "}
              {hz.toFixed(2)} Hz with {n}, so the slow model takes {hz.toFixed(2)} passes and the
              fast model {fmt(fastPasses * hz, 1)} passes per second of audio.
            </>
          )}{" "}
          The timing is an estimate: one seconds-per-weight constant fitted to SGLang-Omni&apos;s
          reported 63.3 frames per second at batch size 1 on an H200, then scaled by how many
          weights each frame reads. The first-chunk figure is decode compute only; prefill, the
          codec decode and the network are not in it.
        </p>
      </div>
    </figure>
  )
}
