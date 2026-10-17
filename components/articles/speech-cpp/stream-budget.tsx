"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"

// How speech.cpp streams Qwen3-TTS, and when streaming is enough. The talker makes
// one 0.08 s frame (16 codes) at a time; the codec decoder is handed chunks of 1, 1,
// 2 and then 4 frames, fixed in advance (docs/adr/synthesis-passes-audio-in-chunks-
// fixed-for-qwen3-tts-and-sized-by-speed-for-irodori-tts.md, chunk_frames()). A
// player starts on the first chunk. Whether it then plays without a gap depends on
// one number: seconds spent per frame, against the 0.08 s each frame lasts.
//
// The model here ignores the codec's own time per call and the leading silence the
// 0.6B model often speaks first; it is the schedule and the arithmetic, nothing else.
// Presets: the README's RTFx for qwen3-tts-0.6b Q8_0 on an Apple M5 (3.7) and an RTX
// 2080 (5.2), with their p50 time to first audio (0.029 s, 0.024 s), reported; and
// our run of sample 1 on a shared 4-core VM with 2 threads: 95 frames in 28.80 s
// (0.303 s a frame), first audio at 0.876 s, measured.

const FRAME = 0.08
const FRAMES = 95 // sample 1: 7.60 s of audio

const PRESETS = [
  { id: "m5", label: "Apple M5, Metal", spf: 0.0216, ttfa: 0.029, tag: "reported" },
  { id: "2080", label: "RTX 2080, Vulkan", spf: 0.0154, ttfa: 0.024, tag: "reported" },
  { id: "vm", label: "our VM, 2 threads", spf: 0.303, ttfa: 0.876, tag: "measured" },
] as const

function chunks(n: number): number[] {
  const out: number[] = []
  const head = [1, 1, 2]
  let left = n
  for (let i = 0; left > 0; i++) {
    const c = Math.min(i < head.length ? head[i] : 4, left)
    out.push(c)
    left -= c
  }
  return out
}

type Seg = { made0: number; made1: number; play0: number; play1: number; stall: number; size: number }

function simulate(spf: number, ttfa: number) {
  const cs = chunks(FRAMES)
  const segs: Seg[] = []
  let framesDone = 0
  let playhead = 0
  let audioBefore = 0
  let wait = 0
  let stalls = 0
  let stallTotal = 0
  let start = 0
  cs.forEach((size, i) => {
    // Frame k is finished at ttfa + k * spf, so a chunk is made between the end of
    // the frame before it and the end of its own last frame.
    const made0 = Math.max(0, ttfa + (framesDone - 1) * spf)
    framesDone += size
    const made1 = ttfa + (framesDone - 1) * spf
    if (i === 0) {
      start = made1
      playhead = made1
    }
    // How long the player would have to wait up front for this chunk never to be late.
    wait = Math.max(wait, made1 - (start + audioBefore))
    let stall = 0
    if (made1 > playhead) {
      stall = made1 - playhead
      if (stall > 0.001) stalls++
      stallTotal += stall
      playhead = made1
    }
    const play0 = playhead
    playhead += size * FRAME
    audioBefore += size * FRAME
    segs.push({ made0, made1, play0, play1: playhead, stall, size })
  })
  return { segs, start, end: playhead, stalls, stallTotal, wait, nChunks: cs.length, made: ttfa + (FRAMES - 1) * spf }
}

const W = 640
const H = 120
const L = 64
const R = 12

export function StreamBudget() {
  const [spf, setSpf] = useState<number>(PRESETS[2].spf)
  const [ttfa, setTtfa] = useState<number>(PRESETS[2].ttfa)
  const sim = simulate(spf, ttfa)
  const tMax = Math.max(sim.end, sim.made) * 1.02
  const x = (t: number) => L + ((W - L - R) * t) / tMax
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((k) => k * tMax)
  const rtf = spf / FRAME
  const preset = PRESETS.find((p) => p.spf === spf && p.ttfa === ttfa)

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center gap-1 border-b px-4 py-2.5 font-mono text-[11px]">
        <span className="mr-2 text-muted-foreground">machine</span>
        {PRESETS.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => {
              setSpf(p.spf)
              setTtfa(p.ttfa)
            }}
            aria-pressed={preset?.id === p.id}
            className={`rounded-md border px-2 py-0.5 ${preset?.id === p.id ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"}`}
          >
            {p.label} <span className="opacity-70">({p.tag})</span>
          </button>
        ))}
      </div>
      <div className="p-3 sm:p-4">
        <label className="block font-mono text-[11px]">
          <span className="text-muted-foreground">seconds to make one 0.08 s frame:</span> {spf.toFixed(4)} s{" "}
          <span className="text-muted-foreground">(RTF {rtf.toFixed(2)})</span>
          <Range
            min={0.01}
            max={0.4}
            step={0.001}
            value={spf}
            onChange={(e) => setSpf(Number(e.target.value))}
            className="mt-1 w-full"
            aria-label="Seconds to make one frame"
          />
        </label>
        <svg viewBox={`0 0 ${W} ${H}`} className="mt-3 w-full" role="img" aria-label="Chunks made against chunks played over time">
          <text x={4} y={34} className="fill-muted-foreground" fontSize={11} fontFamily="monospace">
            made
          </text>
          <text x={4} y={74} className="fill-muted-foreground" fontSize={11} fontFamily="monospace">
            played
          </text>
          {sim.segs.map((s, i) => (
            <g key={i}>
              <rect
                x={x(s.made0)}
                y={22}
                width={Math.max(0.6, x(s.made1) - x(s.made0))}
                height={16}
                fill={i % 2 ? "oklch(0.62 0.12 250)" : "oklch(0.52 0.14 250)"}
              />
              {s.stall > 0.001 ? (
                <rect x={x(s.play0 - s.stall)} y={62} width={Math.max(0.6, x(s.play0) - x(s.play0 - s.stall))} height={16} fill="oklch(0.62 0.2 25)" />
              ) : null}
              <rect
                x={x(s.play0)}
                y={62}
                width={Math.max(0.6, x(s.play1) - x(s.play0))}
                height={16}
                fill={i % 2 ? "oklch(0.68 0.13 155)" : "oklch(0.58 0.15 155)"}
              />
            </g>
          ))}
          <line x1={L} x2={W - R} y1={92} y2={92} stroke="currentColor" strokeOpacity={0.3} />
          {ticks.map((t, i) => (
            <g key={i}>
              <line x1={x(t)} x2={x(t)} y1={92} y2={96} stroke="currentColor" strokeOpacity={0.4} />
              <text x={x(t)} y={110} textAnchor="middle" fontSize={10} fontFamily="monospace" className="fill-muted-foreground">
                {t.toFixed(t < 1 ? 2 : 1)} s
              </text>
            </g>
          ))}
        </svg>
        <dl className="mt-2 grid grid-cols-1 gap-x-4 gap-y-0.5 font-mono text-[11px] sm:grid-cols-2">
          <div>
            <dt className="inline text-muted-foreground">first audio after </dt>
            <dd className="inline">{sim.start.toFixed(3)} s</dd>
          </div>
          <div>
            <dt className="inline text-muted-foreground">all {FRAMES} frames made after </dt>
            <dd className="inline">{sim.made.toFixed(2)} s</dd>
          </div>
          <div>
            <dt className="inline text-muted-foreground">gaps while playing </dt>
            <dd className="inline">
              {sim.stalls} of {sim.nChunks - 1} chunk boundaries, {sim.stallTotal.toFixed(2)} s in all
            </dd>
          </div>
          <div>
            <dt className="inline text-muted-foreground">wait up front for no gap </dt>
            <dd className="inline">{Math.max(0, sim.wait).toFixed(2)} s</dd>
          </div>
        </dl>
        <p className="mt-2 text-[12px] leading-relaxed text-muted-foreground">
          Blue bars are chunks leaving the talker (1, 1, 2, then 4 frames); green is the same audio playing, red is
          the player waiting. Below 0.08 s a frame the first chunk is all a player needs. Above it, streaming still
          gives a fast first sound, but the rest arrives slower than it plays.
        </p>
      </div>
      <figcaption className="border-t px-4 py-2.5 font-mono text-[10px] leading-relaxed text-muted-foreground">
        The 95 frames of sample 1 (7.60 s). Presets: the README&apos;s qwen3-tts-0.6b Q8_0 RTFx and p50 first audio
        (reported), and our run on a shared 4-core CPU VM, 17 Oct 2026 (measured). The codec&apos;s time per call and
        the model&apos;s leading silence are left out.
      </figcaption>
    </figure>
  )
}
