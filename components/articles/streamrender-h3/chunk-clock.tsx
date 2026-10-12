"use client"

import { useMemo, useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { cn } from "@/lib/utils"

// The streaming clock of StreamRender-H3, rebuilt from its own code.
//
// - H3's video codec maps 17 RGB frames to 5 latents: the first latent of every
//   five is a single frame, the other four are 4 frames each.
//   (render/decoder/native/causal_vit_stream.py trims the block-start latent.)
// - Scheduling units merge that single-frame latent with the next one, so unit
//   spans repeat (2, 1, 1, 1) latents (minimax_h3/data/streaming.py,
//   _MERGED_SINGLE_FRAME_UNITS).
// - configs/runtime.json: bootstrap_size 7 units, chunk_size 2 units, 24 fps.
// - runtime/worker.py collects every engine frame of a chunk before it renders.
// - the causal decoder decodes latents in pairs (2k, 2k+1)
//   (render/decoder/causal_vit_codec.py), so an odd latent at the end of a
//   chunk waits for the next chunk.
// - runtime/server.py paces output at 24 fps from the first frame it sends and
//   never skips ahead: deadline = max(deadline + 1/24, now).
//
// The render cost per chunk is the only free parameter. 273 ms is the project's
// end-to-end p50; the bootstrap's own cost is not published, so it is a choice.

const FPS = 24
const BOOT_UNITS = 7
const CHUNK_UNITS = 2
const N_CHUNKS = 16

const latentFrames = (j: number) => (j % 5 === 0 ? 1 : 4)
const SPANS = [2, 1, 1, 1]
function unitBoundary(q: number): number {
  const full = Math.floor(q / 4)
  let b = full * 5
  for (let i = 0; i < q % 4; i++) b += SPANS[i]
  return b
}

type Chunk = { k: number; f0: number; f1: number; start: number; end: number; arrive: number }
type Sim = {
  chunks: Chunk[]
  ready: number[]
  shipped: number[]
  shippedLag: number
  resyncLag: number
  resyncPairless: number
  maxFrame: number
}

function simulate(renderMs: number, bootMult: number): Sim {
  const R = renderMs / 1000
  const stops: number[] = [unitBoundary(BOOT_UNITS)]
  for (let k = 1; k < N_CHUNKS; k++) stops.push(unitBoundary(BOOT_UNITS + CHUNK_UNITS * k))
  const nLat = stops[stops.length - 1]
  const startFrame: number[] = []
  let f = 0
  for (let j = 0; j < nLat; j++) {
    startFrame.push(f)
    f += latentFrames(j)
  }
  const chunkOf: number[] = []
  const chunks: Chunk[] = []
  let prev = 0
  let busyUntil = 0
  stops.forEach((stop, k) => {
    const f0 = startFrame[prev]
    const f1 = startFrame[stop - 1] + latentFrames(stop - 1)
    const arrive = (f1 - 1) / FPS
    const start = Math.max(arrive, busyUntil)
    const end = start + (k === 0 ? R * bootMult : R)
    busyUntil = end
    chunks.push({ k, f0, f1, start, end, arrive })
    for (let j = prev; j < stop; j++) chunkOf.push(k)
    prev = stop
  })
  // The last latent may have no partner yet; drop frames we cannot place.
  const lastPaired = nLat % 2 === 0 ? nLat : nLat - 1
  const maxFrame = startFrame[lastPaired - 1] + latentFrames(lastPaired - 1)
  const ready: number[] = []
  const readyNoPair: number[] = []
  for (let j = 0; j < lastPaired; j++) {
    const partner = j % 2 === 0 ? j + 1 : j - 1
    const t = chunks[chunkOf[Math.max(j, partner)]].end
    const tNoPair = chunks[chunkOf[j]].end
    for (let i = 0; i < latentFrames(j); i++) {
      ready.push(t)
      readyNoPair.push(tNoPair)
    }
  }
  const shipped: number[] = []
  ready.forEach((r, n) => {
    shipped.push(n === 0 ? r : Math.max(r, shipped[n - 1] + 1 / FPS))
  })
  // Steady-state lag over the last frames, as shipped.
  let shippedLag = 0
  for (let n = maxFrame - 17; n < maxFrame; n++) shippedLag = Math.max(shippedLag, shipped[n] - n / FPS)
  // A server that re-synced once after the bootstrap: the tightest fixed lag
  // that never underruns, measured over chunks 2 onward.
  const from = chunks[2].f0
  let resyncLag = 0
  let resyncPairless = 0
  for (let n = from; n < maxFrame; n++) {
    resyncLag = Math.max(resyncLag, ready[n] - n / FPS)
    resyncPairless = Math.max(resyncPairless, readyNoPair[n] - n / FPS)
  }
  return { chunks, ready, shipped, shippedLag, resyncLag, resyncPairless, maxFrame }
}

const W = 720
const X0 = 92
const X1 = 708
const T_MAX = 5
const x = (t: number) => X0 + (Math.min(t, T_MAX) / T_MAX) * (X1 - X0)

const C_A = "oklch(0.66 0.17 300)"
const C_B = "oklch(0.70 0.14 200)"
const C_GPU = "oklch(0.62 0.18 25)"
const C_LAG = "oklch(0.72 0.16 85)"

const BUDGET_MS = (17 / 2 / FPS) * 1000 // 354.17 ms of video per chunk, on average

export function ChunkClock() {
  const [renderMs, setRenderMs] = useState(273)
  const [bootMult, setBootMult] = useState(1)
  const [follow, setFollow] = useState(60)
  const sim = useMemo(() => simulate(renderMs, bootMult), [renderMs, bootMult])

  const behind = 2 * renderMs > (17 / FPS) * 1000
  const util = renderMs / BUDGET_MS
  const capacityFps = 17 / ((2 * renderMs) / 1000)
  const fi = Math.min(follow, sim.maxFrame - 1)
  const sendT = fi / FPS
  const showT = sim.shipped[fi]
  const lagMs = (showT - sendT) * 1000

  const rows = { send: 44, gpu: 98, screen: 152 }

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          engine frame → chunk → two-step render → paired decode → screen, from the runtime code
        </span>
        <div className="flex gap-1.5">
          {[1, 2, 3].map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setBootMult(m)}
              aria-pressed={bootMult === m}
              className={cn(
                "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
                bootMult === m
                  ? "border-foreground/30 bg-muted/50 text-foreground"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              bootstrap {m}×
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-3 p-3 sm:p-4">
        <label className="flex flex-wrap items-center gap-3 font-mono text-xs">
          <span className="w-44 text-muted-foreground">render per chunk: {renderMs} ms</span>
          <Range
            min={150}
            max={450}
            step={1}
            value={renderMs}
            onChange={(e) => setRenderMs(Number(e.target.value))}
            accent={C_GPU}
            className="min-w-[160px] flex-1"
            aria-label="Render time per chunk in milliseconds"
          />
        </label>
        <label className="flex flex-wrap items-center gap-3 font-mono text-xs">
          <span className="w-44 text-muted-foreground">follow engine frame #{fi}</span>
          <Range
            min={0}
            max={sim.maxFrame - 1}
            step={1}
            value={fi}
            onChange={(e) => setFollow(Number(e.target.value))}
            accent={C_LAG}
            className="min-w-[160px] flex-1"
            aria-label="Engine frame to follow"
          />
        </label>

        <div className="overflow-x-auto">
          <svg viewBox={`0 0 ${W} 196`} width={W} height={196} role="img" className="min-w-[620px] max-w-full">
            <title>
              {`Timeline of the first ${T_MAX} seconds. Engine frames arrive at 24 per second and are grouped into chunks of 9 and 8 frames after a 30-frame bootstrap. Each chunk renders for ${renderMs} milliseconds once its last frame has arrived. The screen lane shows frames played at 24 per second from the first frame the server sends. Frame ${fi} is sent at ${(sendT * 1000).toFixed(0)} milliseconds and shown at ${(showT * 1000).toFixed(0)} milliseconds, a lag of ${lagMs.toFixed(0)} milliseconds.`}
            </title>
            {[0, 1, 2, 3, 4, 5].map((t) => (
              <g key={t}>
                <line x1={x(t)} y1={24} x2={x(t)} y2={170} stroke="currentColor" strokeOpacity={0.08} />
                <text x={x(t)} y={186} fontSize={8} textAnchor="middle" fill="currentColor" fillOpacity={0.45} fontFamily="ui-monospace, monospace">
                  {t}s
                </text>
              </g>
            ))}
            {(
              [
                ["engine sends", rows.send],
                ["GPU renders", rows.gpu],
                ["screen shows", rows.screen],
              ] as const
            ).map(([label, y]) => (
              <text key={label} x={X0 - 8} y={y + 3} fontSize={8} textAnchor="end" fill="currentColor" fillOpacity={0.6} fontFamily="ui-monospace, monospace">
                {label}
              </text>
            ))}

            {sim.chunks.map((c) => {
              const col = c.k % 2 === 0 ? C_A : C_B
              const ticks = []
              for (let i = c.f0; i < c.f1; i++) {
                const t = i / FPS
                if (t > T_MAX) break
                ticks.push(<line key={`s${i}`} x1={x(t)} x2={x(t)} y1={rows.send - 9} y2={rows.send + 9} stroke={col} strokeWidth={1.6} />)
                if (i < sim.maxFrame && sim.shipped[i] <= T_MAX) {
                  ticks.push(
                    <line key={`d${i}`} x1={x(sim.shipped[i])} x2={x(sim.shipped[i])} y1={rows.screen - 9} y2={rows.screen + 9} stroke={col} strokeWidth={1.6} />,
                  )
                }
              }
              return (
                <g key={c.k}>
                  {ticks}
                  {c.start < T_MAX && (
                    <rect
                      x={x(c.start)}
                      y={rows.gpu - 10}
                      width={Math.max(1, x(c.end) - x(c.start) - 1)}
                      height={20}
                      rx={3}
                      fill={c.k === 0 ? C_GPU : col}
                      fillOpacity={c.k === 0 ? 0.55 : 0.75}
                    />
                  )}
                  {c.k === 0 && c.start < T_MAX && (
                    <text x={x(c.start) + 4} y={rows.gpu + 3} fontSize={7.5} fill="white" fontFamily="ui-monospace, monospace">
                      boot
                    </text>
                  )}
                </g>
              )
            })}

            {sendT <= T_MAX && (
              <g>
                <line x1={x(sendT)} y1={rows.send + 10} x2={x(Math.min(showT, T_MAX))} y2={rows.screen - 10} stroke={C_LAG} strokeWidth={1.6} strokeDasharray="3 2" />
                <circle cx={x(sendT)} cy={rows.send} r={4} fill="none" stroke={C_LAG} strokeWidth={1.6} />
                {showT <= T_MAX && <circle cx={x(showT)} cy={rows.screen} r={4} fill="none" stroke={C_LAG} strokeWidth={1.6} />}
                <text x={x(Math.min((sendT + showT) / 2, T_MAX)) + 6} y={(rows.gpu + rows.screen) / 2 + 12} fontSize={8} fill={C_LAG} fontFamily="ui-monospace, monospace">
                  {lagMs.toFixed(0)} ms
                </text>
              </g>
            )}
          </svg>
        </div>

        <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 font-mono text-xs sm:grid-cols-3">
          <div>
            <dt className="text-muted-foreground">video per chunk</dt>
            <dd>375 / 333 ms (avg {BUDGET_MS.toFixed(0)})</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">GPU busy</dt>
            <dd className={behind ? "text-red-500" : undefined}>{(util * 100).toFixed(0)}% of real time</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">render capacity</dt>
            <dd>{capacityFps.toFixed(1)} fps</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">lag, as shipped</dt>
            <dd style={{ color: C_LAG }}>{behind ? "grows every chunk" : `${(sim.shippedLag * 1000).toFixed(0)} ms`}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">lag, if re-synced once</dt>
            <dd>{behind ? "grows every chunk" : `${(sim.resyncLag * 1000).toFixed(0)} ms`}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">…and no decoder pairing</dt>
            <dd>{behind ? "grows every chunk" : `${(sim.resyncPairless * 1000).toFixed(0)} ms`}</dd>
          </div>
        </dl>

        <p className="text-sm leading-6 text-muted-foreground">
          The GPU needs every engine frame of a chunk before it starts, so the first frame of a chunk
          has already waited a third of a second when rendering begins. The server then plays frames
          at 24 per second from the first one it sends and never skips ahead, which turns the
          30-frame bootstrap into a lag that lasts the whole session. Push the render past{" "}
          {BUDGET_MS.toFixed(0)} ms and the chunks arrive slower than they play: the lag grows
          until the runtime&rsquo;s 48-frame input queue fills and the engine itself is told to
          wait. These are timings from the code&rsquo;s schedule with transport, JPEG encoding and
          the browser left out; the project publishes no input-to-screen measurement.
        </p>
      </div>
    </figure>
  )
}
