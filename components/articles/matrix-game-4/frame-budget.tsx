"use client"

import { useMemo, useState } from "react"
import type { ReactNode } from "react"

import { Range } from "@/components/articles/ui/range"
import { cn } from "@/lib/utils"

// Matrix-Game 4.0's frame budget, built from the release's own schedule.
//
// - One latent covers four RGB frames after startup (fps-egypt/inference.json:
//   following_rgb_frames 4), so the engine's frames reach the model in chunks of four.
// - Per chunk the RTX 5090 runtime encodes the four low-poly frames (TAEHV), runs the
//   DiT once per denoising step, decodes four RGB frames, starts the download, and only
//   then queues a second, "clean" DiT pass that writes the chunk's K/V into the cache
//   (matrix_game/inference/rtx5090/stream.py). The clean pass costs GPU time but the
//   frames are already on their way: it counts against throughput, not latency.
// - The server accepts a capture cadence of 1-60 fps; shooters need a divisor of 120
//   (matrix_game/server/app.py). When the model cannot keep up, the game slows down
//   rather than skipping frames (docs/architecture.md).
// - Preprocessing keeps one chunk of lookahead.
//
// The publisher reports 48 ms per chunk and 83.4 fps on one RTX 5090, and 112 ms from
// key press to the first reacting frame. It does not publish a per-stage split, so the
// stage times below are free parameters. Their defaults sum to 48 ms.

const FRAMES = 4
const RATES = [20, 24, 30, 40, 60] as const
const N_CHUNKS = 14

const C_ENGINE = "oklch(0.68 0.14 150)"
const C_DIT = "oklch(0.62 0.17 285)"
const C_CODEC = "oklch(0.72 0.13 60)"
const C_CLEAN = "oklch(0.62 0.05 285)"
const C_PRESS = "oklch(0.66 0.19 25)"

type Chunk = {
  frameT: number[]
  start: number
  encEnd: number
  ditEnd: number
  out: number
  end: number
}

type Sim = { chunks: Chunk[]; shown: number[]; frameT: number[] }

function simulate(p: number, enc: number, dit: number, steps: number, dec: number, early: boolean, net: number): Sim {
  const chunks: Chunk[] = []
  const frameT: number[] = []
  let nextFrame = 0
  let busy = 0
  for (let c = 0; c < N_CHUNKS; c++) {
    // One chunk of lookahead: the engine may not start chunk c+2 before the GPU starts chunk c+1.
    const gate = c >= 2 ? chunks[c - 1].start : 0
    let t = Math.max(nextFrame, gate)
    const ts: number[] = []
    for (let i = 0; i < FRAMES; i++) {
      ts.push(t)
      frameT.push(t)
      t += p
    }
    nextFrame = t
    const arrive = ts[FRAMES - 1] + p // the last frame is complete one frame period after it starts
    const start = Math.max(arrive, busy)
    const encEnd = start + enc
    const ditEnd = encEnd + steps * dit
    const out = early ? ditEnd + dec : ditEnd + dit + dec
    const end = early ? out + dit : out
    busy = end
    chunks.push({ frameT: ts, start, encEnd, ditEnd, out, end })
  }
  const shown: number[] = []
  chunks.forEach((ch) => {
    for (let i = 0; i < FRAMES; i++) {
      const ready = ch.out + net
      shown.push(shown.length === 0 ? ready : Math.max(ready, shown[shown.length - 1] + p))
    }
  })
  return { chunks, shown, frameT }
}

// Latency of a key press at time `tau`. A frame is a snapshot of the world at the end of its
// period, so the first frame whose period ends after the press carries the reaction; the
// press reaches the screen when that frame is shown.
function pressLatency(sim: Sim, p: number, tau: number): { frame: number; ms: number } {
  const i = sim.frameT.findIndex((t) => t + p >= tau)
  const f = i < 0 ? sim.frameT.length - 1 : i
  return { frame: f, ms: sim.shown[f] - tau }
}

const W = 720
const X0 = 96
const X1 = 708

export function FrameBudget() {
  const [fps, setFps] = useState<number>(60)
  const [steps, setSteps] = useState(1)
  const [dit, setDit] = useState(21)
  const [codec, setCodec] = useState(6)
  const [net, setNet] = useState(0)
  const [early, setEarly] = useState(true)
  const [press, setPress] = useState(0.4)

  const p = 1000 / fps
  const enc = codec / 2
  const dec = codec / 2
  const sim = useMemo(() => simulate(p, enc, dit, steps, dec, early, net), [p, enc, dit, steps, dec, early, net])

  const gpuMs = codec + (steps + 1) * dit
  const toFrames = early ? codec + steps * dit : gpuMs
  const modelFps = (FRAMES * 1000) / gpuMs
  const delivered = Math.min(fps, modelFps)
  const busyPct = (gpuMs / (FRAMES * p)) * 100
  const blocked = gpuMs > FRAMES * p

  // Measure press latency in steady state: chunk 8 onward.
  const base = sim.chunks[8].frameT[0]
  const period = sim.chunks[9].frameT[0] - base
  const pressT = base + press * period
  const lat = pressLatency(sim, p, pressT)
  // Fastest: the press lands just before a frame's snapshot. Slowest: just after the previous one.
  let lo = Infinity
  let hi = 0
  for (let f = 8 * FRAMES; f < 9 * FRAMES; f++) {
    lo = Math.min(lo, sim.shown[f] - (sim.frameT[f] + p))
    hi = Math.max(hi, sim.shown[f] - (sim.frameT[f - 1] + p))
  }

  // The window shown: from chunk 7's first frame, 1.6 chunk periods ahead of the press chunk.
  const t0 = sim.chunks[7].frameT[0]
  const span = Math.max(260, (pressT - t0) + hi + 30)
  const x = (t: number) => X0 + ((t - t0) / span) * (X1 - X0)
  const inView = (t: number) => t >= t0 && t <= t0 + span
  const rows = { engine: 46, gpu: 100, screen: 154 }
  const ticks: number[] = []
  for (let t = 0; t <= span; t += 50) ticks.push(t)

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          key press → engine frame → 4-frame chunk → encode · DiT · decode → screen
        </span>
        <div className="flex flex-wrap gap-1.5">
          {RATES.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setFps(r)}
              aria-pressed={fps === r}
              className={cn(
                "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
                fps === r
                  ? "border-foreground/30 bg-muted/50 text-foreground"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {r} fps
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-3 p-3 sm:p-4">
        <div className="flex flex-wrap gap-1.5 font-mono text-[11px]">
          {[1, 2].map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setSteps(s)}
              aria-pressed={steps === s}
              className={cn(
                "cursor-pointer rounded-full border px-2.5 py-1 transition-colors",
                steps === s
                  ? "border-foreground/30 bg-muted/50 text-foreground"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {s === 1 ? "1 step (rtx5090 / realtime)" : "2 steps (quality)"}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setEarly((v) => !v)}
            aria-pressed={early}
            className={cn(
              "cursor-pointer rounded-full border px-2.5 py-1 transition-colors",
              early
                ? "border-foreground/30 bg-muted/50 text-foreground"
                : "border-border text-muted-foreground hover:text-foreground",
            )}
          >
            {early ? "clean K/V pass after hand-out" : "clean K/V pass before hand-out"}
          </button>
        </div>

        {(
          [
            ["DiT pass", dit, setDit, 5, 60, C_DIT, "Time for one DiT forward pass in milliseconds"],
            ["encode + decode", codec, setCodec, 0, 30, C_CODEC, "Time for the TAEHV encode and decode in milliseconds"],
            ["network + browser", net, setNet, 0, 80, C_ENGINE, "Extra milliseconds for video encoding, network and browser decode"],
          ] as const
        ).map(([label, v, set, min, max, col, aria]) => (
          <label key={label} className="flex flex-wrap items-center gap-3 font-mono text-xs">
            <span className="w-48 text-muted-foreground">
              {label}: {v} ms
            </span>
            <Range
              min={min}
              max={max}
              step={1}
              value={v}
              onChange={(e) => set(Number(e.target.value))}
              accent={col}
              className="min-w-[160px] flex-1"
              aria-label={aria}
            />
          </label>
        ))}
        <label className="flex flex-wrap items-center gap-3 font-mono text-xs">
          <span className="w-48 text-muted-foreground">key press: {Math.round(press * 100)}% into a chunk</span>
          <Range
            min={0}
            max={0.99}
            step={0.01}
            value={press}
            onChange={(e) => setPress(Number(e.target.value))}
            accent={C_PRESS}
            className="min-w-[160px] flex-1"
            aria-label="When the key is pressed, as a fraction of one chunk period"
          />
        </label>

        <div className="overflow-x-auto">
          <svg viewBox={`0 0 ${W} 196`} width={W} height={196} role="img" className="min-w-[620px] max-w-full">
            <title>
              {`Timeline at ${fps} frames per second with ${steps} denoising step${steps > 1 ? "s" : ""}. The engine draws a frame every ${p.toFixed(1)} milliseconds and hands the model four at a time. The GPU spends ${gpuMs.toFixed(0)} milliseconds per chunk and the first frames are out after ${toFrames.toFixed(0)}. A key press ${Math.round(press * 100)} percent into a chunk reaches the screen after ${lat.ms.toFixed(0)} milliseconds.`}
            </title>
            {ticks.map((t) => (
              <g key={t}>
                <line x1={x(t0 + t)} y1={22} x2={x(t0 + t)} y2={170} stroke="currentColor" strokeOpacity={0.08} />
                <text x={x(t0 + t)} y={186} fontSize={8} textAnchor="middle" fill="currentColor" fillOpacity={0.45} fontFamily="ui-monospace, monospace">
                  {t} ms
                </text>
              </g>
            ))}
            {(
              [
                ["engine draws", rows.engine],
                ["GPU", rows.gpu],
                ["screen shows", rows.screen],
              ] as const
            ).map(([label, y]) => (
              <text key={label} x={X0 - 8} y={y + 3} fontSize={8} textAnchor="end" fill="currentColor" fillOpacity={0.6} fontFamily="ui-monospace, monospace">
                {label}
              </text>
            ))}

            {sim.chunks.map((ch, c) => {
              const op = c % 2 === 0 ? 0.85 : 0.5
              const parts: ReactNode[] = []
              ch.frameT.forEach((ft, i) => {
                if (inView(ft) && inView(ft + p))
                  parts.push(
                    <rect key={`e${i}`} x={x(ft) + 0.5} y={rows.engine - 9} width={Math.max(1, x(ft + p) - x(ft) - 1)} height={18} rx={2} fill={C_ENGINE} fillOpacity={op} />,
                  )
                const s = sim.shown[c * FRAMES + i]
                if (inView(s) && inView(s + p))
                  parts.push(
                    <rect key={`s${i}`} x={x(s) + 0.5} y={rows.screen - 9} width={Math.max(1, x(s + p) - x(s) - 1)} height={18} rx={2} fill={C_ENGINE} fillOpacity={op} />,
                  )
              })
              const segs: [number, number, string][] = early
                ? [
                    [ch.start, ch.encEnd, C_CODEC],
                    [ch.encEnd, ch.ditEnd, C_DIT],
                    [ch.ditEnd, ch.out, C_CODEC],
                    [ch.out, ch.end, C_CLEAN],
                  ]
                : [
                    [ch.start, ch.encEnd, C_CODEC],
                    [ch.encEnd, ch.ditEnd, C_DIT],
                    [ch.ditEnd, ch.ditEnd + dit, C_CLEAN],
                    [ch.ditEnd + dit, ch.out, C_CODEC],
                  ]
              segs.forEach(([a, b, col], k) => {
                const aa = Math.max(a, t0)
                const bb = Math.min(b, t0 + span)
                if (bb > aa)
                  parts.push(<rect key={`g${k}`} x={x(aa)} y={rows.gpu - 10} width={Math.max(0.5, x(bb) - x(aa) - 0.5)} height={20} fill={col} fillOpacity={c % 2 === 0 ? 0.9 : 0.6} />)
              })
              return <g key={c}>{parts}</g>
            })}

            {inView(pressT) && (
              <g>
                <line x1={x(pressT)} y1={rows.engine - 18} x2={x(pressT)} y2={rows.engine + 12} stroke={C_PRESS} strokeWidth={1.6} />
                <text x={x(pressT) + 4} y={rows.engine - 12} fontSize={8} fill={C_PRESS} fontFamily="ui-monospace, monospace">
                  key
                </text>
                {inView(sim.shown[lat.frame]) && (
                  <>
                    <line x1={x(pressT)} y1={rows.engine + 12} x2={x(sim.shown[lat.frame])} y2={rows.screen - 12} stroke={C_PRESS} strokeWidth={1.4} strokeDasharray="3 2" />
                    <circle cx={x(sim.shown[lat.frame])} cy={rows.screen} r={4} fill="none" stroke={C_PRESS} strokeWidth={1.6} />
                    <text x={x(sim.shown[lat.frame]) + 7} y={rows.screen + 22} fontSize={8} fill={C_PRESS} fontFamily="ui-monospace, monospace">
                      {lat.ms.toFixed(0)} ms
                    </text>
                  </>
                )}
              </g>
            )}
          </svg>
        </div>

        <div className="flex flex-wrap gap-x-4 gap-y-1 font-mono text-[10px] text-muted-foreground">
          <span><span style={{ color: C_ENGINE }}>■</span> engine frame / shown frame</span>
          <span><span style={{ color: C_CODEC }}>■</span> TAEHV encode, decode</span>
          <span><span style={{ color: C_DIT }}>■</span> DiT denoising</span>
          <span><span style={{ color: C_CLEAN }}>■</span> clean K/V pass</span>
        </div>

        <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 font-mono text-xs sm:grid-cols-3">
          <div>
            <dt className="text-muted-foreground">GPU per chunk</dt>
            <dd>{gpuMs.toFixed(1)} ms</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">model throughput</dt>
            <dd>{modelFps.toFixed(1)} fps</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">delivered</dt>
            <dd className={blocked ? "text-red-500" : undefined}>
              {delivered.toFixed(1)} fps{blocked ? " (game slows)" : ""}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">GPU busy</dt>
            <dd className={blocked ? "text-red-500" : undefined}>{Math.min(100, busyPct).toFixed(0)}% of real time</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">this key press</dt>
            <dd style={{ color: C_PRESS }}>{lat.ms.toFixed(0)} ms to screen</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">any key press</dt>
            <dd>
              {lo.toFixed(0)} to {hi.toFixed(0)} ms
            </dd>
          </div>
        </dl>

        <p className="text-sm leading-6 text-muted-foreground">
          Throughput is four frames divided by everything the GPU does per chunk, the clean K/V pass
          included. Latency is a different sum: the rest of the engine frame the press lands in, three more
          frame periods while the chunk fills, then encode, denoise and decode. The clean pass runs after the
          frames are handed out, so it costs throughput and no latency. Frames are shown one period
          apart, so every frame of a chunk waits the same amount; where the press lands only changes the
          wait for the next frame. The stage split is mine: Skywork publishes only the 48 ms total,
          and these timings leave out the network and browser unless you add them.
        </p>
      </div>
    </figure>
  )
}
