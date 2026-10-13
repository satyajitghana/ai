"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { cn } from "@/lib/utils"

// The attention rule of one packed span, transcribed from the repo.
//
// - rtcwm/model/layout.py: one chunk = one 17-frame VAE clip = 5 latents;
//   SPAN_CHUNKS = 6; span_start(k) = max(0, k - 5).
// - rtcwm/model/masks.py df_allows():
//     static  -> static, and (only when the span starts the stream) proxy and video chunk 0
//     proxy p -> static, proxy chunks <= p
//     video c -> static, proxy chunks <= c, video chunks c-5 .. c
// - The span is packed [text | Picture 1 | proxy 0..5 | audio | video j..k];
//   text, Picture 1 and audio are the "static" rows.
// - rtcwm/model/sampler.py: chunks older than the span are dropped from the
//   cache; the survivors' keys are moved one chunk back by a RoPE rotation.
// The released CWM (code-world-model INFERENCE.md) instead denoises a 124-frame
// window bidirectionally: every row sees every other row of the window.

const SPAN = 6
const MAX_K = 13
const ROLES = ["S", "P", "P", "P", "P", "P", "P", "V", "V", "V", "V", "V", "V"] as const
type Role = (typeof ROLES)[number]
const STATIC = 0
const DUV = 1
const VIDEO = 2

function roleOf(i: number): [number, number] {
  if (i === 0) return [STATIC, -1]
  if (i <= SPAN) return [DUV, i - 1]
  return [VIDEO, i - 1 - SPAN]
}

function allows(q: number, k: number, startsStream: boolean): boolean {
  const [qr, qc] = roleOf(q)
  const [kr, kc] = roleOf(k)
  if (qr === STATIC) return kr === STATIC || (startsStream && kc === 0 && (kr === DUV || kr === VIDEO))
  if (qr === DUV) return kr === STATIC || (kr === DUV && kc <= qc)
  return kr === STATIC || (kr === DUV && kc <= qc) || (kr === VIDEO && qc - kc >= 0 && qc - kc < SPAN)
}

const C_S = "oklch(0.70 0.04 260)"
const C_P = "oklch(0.70 0.15 150)"
const C_V = "oklch(0.66 0.17 300)"
const C_Q = "oklch(0.72 0.16 85)"
const roleColor = (r: Role) => (r === "S" ? C_S : r === "P" ? C_P : C_V)

const CELL = 24
const LAB = 44
const N = ROLES.length

export function SpanMask() {
  const [k, setK] = useState(8)
  const [mode, setMode] = useState<"stream" | "released">("stream")
  const j = Math.max(0, k - (SPAN - 1))
  const c = k - j // local index of the chunk being generated
  const startsStream = j === 0
  const released = mode === "released"

  const label = (i: number) => {
    const [r, idx] = roleOf(i)
    if (r === STATIC) return "static"
    return `${r === DUV ? "P" : "V"}${released ? idx : j + idx}`
  }
  const present = (i: number) => {
    const [r, idx] = roleOf(i)
    return r !== VIDEO || idx <= c
  }
  const qRow = 1 + SPAN + c
  const seenProxy = released ? SPAN : c + 1
  const seenHist = released ? SPAN - 1 : c

  const W = LAB + N * CELL + 8
  const H = LAB + N * CELL + 8

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          who attends to whom inside one packed span, from rtcwm/model/masks.py
        </span>
        <div className="flex gap-1.5">
          {(
            [
              ["stream", "streaming"],
              ["released", "released CWM window"],
            ] as const
          ).map(([m, name]) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              aria-pressed={mode === m}
              className={cn(
                "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
                mode === m
                  ? "border-foreground/30 bg-muted/50 text-foreground"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {name}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-3 p-3 sm:p-4">
        <label className="flex flex-wrap items-center gap-3 font-mono text-xs">
          <span className="w-52 text-muted-foreground">
            generating stream chunk {k} ({((k * 17) / 24).toFixed(2)} s in)
          </span>
          <Range
            min={0}
            max={MAX_K}
            step={1}
            value={k}
            onChange={(e) => setK(Number(e.target.value))}
            accent={C_Q}
            className="min-w-[160px] flex-1"
            aria-label="Stream chunk being generated"
            disabled={released}
          />
        </label>

        {/* the stream, with the span bracket */}
        <div className="overflow-x-auto">
          <svg viewBox="0 0 640 58" width={640} height={58} role="img" className="min-w-[520px] max-w-full">
            <title>
              {released
                ? "The released model works on 124-frame windows that overlap by 34 frames; every frame of a window is denoised together."
                : `Stream chunks 0 to ${MAX_K}. Chunk ${k} is being generated inside the span of chunks ${j} to ${k}. Chunks before ${j} have left the cache.`}
            </title>
            {Array.from({ length: MAX_K + 1 }, (_, i) => {
              const x = 8 + i * 44
              const gone = !released && i < j
              const inSpan = !released && i >= j && i <= k
              const future = !released && i > k
              return (
                <g key={i}>
                  <rect
                    x={x}
                    y={10}
                    width={40}
                    height={22}
                    rx={4}
                    fill={released ? C_V : i === k ? C_Q : inSpan ? C_V : "transparent"}
                    fillOpacity={released ? 0.35 : i === k ? 0.85 : inSpan ? 0.45 : 0}
                    stroke="currentColor"
                    strokeOpacity={gone || future ? 0.2 : 0.5}
                    strokeDasharray={future ? "3 3" : undefined}
                  />
                  <text
                    x={x + 20}
                    y={25}
                    textAnchor="middle"
                    className="fill-current font-mono"
                    fontSize={10}
                    opacity={gone ? 0.3 : 0.9}
                  >
                    {i}
                  </text>
                  {inSpan && (
                    <text x={x + 20} y={48} textAnchor="middle" className="fill-current font-mono" fontSize={9} opacity={0.7}>
                      pos {i - j}
                    </text>
                  )}
                </g>
              )
            })}
            {released && (
              <>
                <rect x={8} y={36} width={(124 / 17) * 44 - 4} height={6} rx={3} fill={C_P} fillOpacity={0.6} />
                <text x={8 + (124 / 17) * 44 + 4} y={42} className="fill-current font-mono" fontSize={9} opacity={0.7}>
                  one 124-frame window, proxy for all of it up front
                </text>
              </>
            )}
          </svg>
        </div>

        <div className="flex flex-wrap items-start gap-4">
          <div className="overflow-x-auto">
            <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" className="max-w-full">
              <title>
                {released
                  ? "Released CWM: a dense mask, every row of the window attends to every other row, including proxy frames later than itself."
                  : `Block mask of the span for chunk ${k}. The highlighted query row, video chunk ${k}, sees the static rows, proxy chunks ${j} to ${k} and video chunks ${j} to ${k}.`}
              </title>
              {ROLES.map((r, i) => (
                <g key={`h${i}`}>
                  <text
                    x={LAB + i * CELL + CELL / 2}
                    y={LAB - 6}
                    textAnchor="end"
                    transform={`rotate(-60 ${LAB + i * CELL + CELL / 2} ${LAB - 6})`}
                    className="fill-current font-mono"
                    fontSize={9}
                    opacity={present(i) || released ? 0.85 : 0.3}
                  >
                    {label(i)}
                  </text>
                  <text
                    x={LAB - 4}
                    y={LAB + i * CELL + CELL / 2 + 3}
                    textAnchor="end"
                    className="fill-current font-mono"
                    fontSize={9}
                    fontWeight={!released && i === qRow ? 700 : 400}
                    opacity={present(i) || released ? 0.85 : 0.3}
                  >
                    {label(i)}
                  </text>
                  <rect x={LAB + i * CELL} y={LAB - 3} width={CELL - 2} height={2} fill={roleColor(r)} />
                  <rect x={LAB - 3} y={LAB + i * CELL} width={2} height={CELL - 2} fill={roleColor(r)} />
                </g>
              ))}
              {ROLES.map((_, q) =>
                ROLES.map((kr, kk) => {
                  const on = released ? true : present(q) && present(kk) && allows(q, kk, startsStream)
                  const isQ = !released && q === qRow
                  return (
                    <rect
                      key={`${q}-${kk}`}
                      x={LAB + kk * CELL}
                      y={LAB + q * CELL}
                      width={CELL - 2}
                      height={CELL - 2}
                      rx={3}
                      fill={on ? roleColor(kr) : "currentColor"}
                      fillOpacity={on ? (isQ ? 0.95 : 0.4) : 0.05}
                      stroke={isQ ? C_Q : "none"}
                      strokeWidth={isQ ? 1.5 : 0}
                    />
                  )
                }),
              )}
            </svg>
          </div>

          <div className="min-w-[200px] flex-1 space-y-2 font-mono text-xs">
            {released ? (
              <>
                <p>
                  <span className="text-muted-foreground">mask:</span> dense
                </p>
                <p>
                  <span className="text-muted-foreground">frame 0 sees proxy up to:</span> frame 123, 5.1 s ahead
                </p>
                <p>
                  <span className="text-muted-foreground">captions:</span> one per window, with the action timeline
                </p>
                <p className="text-muted-foreground">
                  Fine for offline video. A live game cannot hand over five seconds of proxy it has not computed yet.
                </p>
              </>
            ) : (
              <>
                <p>
                  <span className="text-muted-foreground">span:</span> chunks {j}..{k} (positions 0..{c})
                </p>
                <p>
                  <span className="text-muted-foreground">proxy seen:</span> {seenProxy} chunk{seenProxy === 1 ? "" : "s"},
                  none after {k}
                </p>
                <p>
                  <span className="text-muted-foreground">history seen:</span> {seenHist} chunk{seenHist === 1 ? "" : "s"} (
                  {((seenHist * 17) / 24).toFixed(2)} s)
                </p>
                <p>
                  <span className="text-muted-foreground">static rows see chunk 0:</span> {startsStream ? "yes" : "no"}
                </p>
                <p className="text-muted-foreground">
                  {j > 0
                    ? `Chunks before ${j} are gone. The rest keep their cached keys, rotated back ${j} chunk${j === 1 ? "" : "s"} so the span always starts at position 0.`
                    : "First span: the condition rows also see chunk 0, as the released model's conditions see its first frames."}
                </p>
              </>
            )}
          </div>
        </div>
        <p className="font-mono text-[10px] text-muted-foreground">
          S = caption, start image and silent audio rows. P = proxy chunk. V = video chunk. One chunk = 17 frames = 5
          latents.
        </p>
      </div>
    </figure>
  )
}
