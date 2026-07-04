"use client"

import { useEffect, useState } from "react"
import { PauseIcon, PlayIcon } from "@phosphor-icons/react/dist/ssr"

import { cn } from "@/lib/utils"

// The two phases of every generate() call, drawn as one composed scene. Prefill
// processes the whole prompt in a single parallel pass (compute-bound) and writes
// the KV cache in one shot; then decode emits one token per pass, each reading the
// ENTIRE cache for a tiny matmul (memory-bound). Watch the arrows flip: a fan-in
// of parallel writes during prefill, a fan-out of cache reads during decode. The
// bottleneck flips from compute to memory bandwidth. Illustrative; loops.

const PROMPT = ["Explain", "how", "LLM", "inference", "works"]
const GEN = ["It", "runs", "two", "phases", "on", "one", "GPU", "."]
const NSLOT = PROMPT.length + GEN.length // 13 cache slots

type Phase = "prefill" | "decode"
type State = { phase: Phase; step: number } // step = decode tokens emitted

const START: State = { phase: "prefill", step: 0 }

function next(s: State): State {
  if (s.phase === "prefill") return { phase: "decode", step: 1 }
  if (s.step >= GEN.length) return START
  return { phase: "decode", step: s.step + 1 }
}

const CY = "oklch(0.66 0.14 210)" // prefill / compute
const GR = "oklch(0.66 0.15 150)" // decode / memory

// scene geometry (viewBox units) — fixed, so nothing reflows across the animation
const W = 760
const H = 336
// prompt row
const PY = 40
const PH = 28
const PNW = 96
const PGAP = 14
const promptX = (i: number) => (W - (PROMPT.length * PNW + (PROMPT.length - 1) * PGAP)) / 2 + i * (PNW + PGAP)
// cache box
const CBX = 66
const CBW = 628
const CBY = 138
const CBH = 52
const TIX0 = CBX + 16
const TIW = (CBW - 32 - (NSLOT - 1) * 5) / NSLOT
const tickX = (j: number) => TIX0 + j * (TIW + 5)
const tickCx = (j: number) => tickX(j) + TIW / 2
const TIY = CBY + 11
const TIH = 30
// output row
const OY = 274
const OH = 28
const ONW = 74
const OGAP = 8
const outX = (i: number) => (W - (GEN.length * ONW + (GEN.length - 1) * OGAP)) / 2 + i * (ONW + OGAP)

export function PrefillDecode() {
  const [s, setS] = useState<State>(START)
  const [playing, setPlaying] = useState(true)

  useEffect(() => {
    if (!playing) return
    const id = setInterval(() => setS(next), s.phase === "prefill" ? 1300 : 720)
    return () => clearInterval(id)
  }, [playing, s.phase, s.step])

  const isPrefill = s.phase === "prefill"
  const filled = isPrefill ? PROMPT.length : PROMPT.length + s.step // slots written so far
  const curOut = isPrefill ? -1 : s.step - 1 // index of token emitted this step
  const cacheSize = filled

  const compute = isPrefill ? 0.95 : 0.28
  const memory = isPrefill ? 0.4 : 0.92

  // vertical S-curve between two points
  const vcurve = (x1: number, y1: number, x2: number, y2: number) => {
    const my = (y1 + y2) / 2
    return `M ${x1} ${y1} C ${x1} ${my}, ${x2} ${my}, ${x2} ${y2}`
  }

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex items-center justify-between border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>one generate() call · prefill → decode</span>
        <button
          type="button"
          onClick={() => setPlaying((p) => !p)}
          className="flex cursor-pointer items-center gap-1 transition-colors hover:text-foreground"
        >
          {playing ? <PauseIcon size={12} weight="fill" /> : <PlayIcon size={12} weight="fill" />}
          {playing ? "pause" : "play"}
        </button>
      </div>

      <div className="p-3 sm:p-4">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full"
          role="img"
          aria-label={`${isPrefill ? "Prefill: all prompt tokens written to the KV cache in one parallel pass" : `Decode step ${s.step}: reading the whole ${cacheSize}-slot cache to emit one token`}`}
        >
          <defs>
            <marker id="pd-arrow-cy" viewBox="0 -5 10 10" markerWidth="7" markerHeight="7" orient="auto" refX="6" refY="0">
              <path d="M0,-4L6,0L0,4" fill="none" stroke={CY} strokeWidth={1.5} />
            </marker>
            <marker id="pd-arrow-gr" viewBox="0 -5 10 10" markerWidth="7" markerHeight="7" orient="auto" refX="6" refY="0">
              <path d="M0,-4L6,0L0,4" fill="none" stroke={GR} strokeWidth={1.5} />
            </marker>
            <filter id="pd-soft" x="-40%" y="-40%" width="180%" height="180%">
              <feDropShadow dx="0" dy="1" stdDeviation="1.4" floodOpacity="0.14" />
            </filter>
          </defs>

          {/* row labels */}
          <text x={CBX} y={26} className="fill-muted-foreground font-mono" fontSize={11}>prompt</text>
          <text x={CBX} y={CBY - 6} className="fill-muted-foreground font-mono" fontSize={11}>KV cache · {cacheSize} tokens</text>
          <text x={CBX} y={OY - 8} className="fill-muted-foreground font-mono" fontSize={11}>output</text>

          {/* connectors (behind nodes) */}
          {isPrefill
            ? // parallel writes: every prompt token → cache, in one pass
              PROMPT.map((_, i) => (
                <path
                  key={i}
                  d={vcurve(promptX(i) + PNW / 2, PY + PH, 300 + (i - 2) * 42, CBY)}
                  fill="none"
                  stroke={CY}
                  strokeWidth={1.5}
                  markerEnd="url(#pd-arrow-cy)"
                  opacity={0.75}
                />
              ))
            : // decode: read the whole cache (fan-in), then emit one token
              curOut >= 0 && (
                <g>
                  {Array.from({ length: filled }).map((_, j) => (
                    <path
                      key={j}
                      d={vcurve(tickCx(j), TIY + TIH, outX(curOut) + ONW / 2, OY)}
                      fill="none"
                      stroke={GR}
                      strokeWidth={1.2}
                      opacity={0.22}
                    />
                  ))}
                  <path
                    d={vcurve(tickCx(filled - 1), CBY + CBH, outX(curOut) + ONW / 2, OY)}
                    fill="none"
                    stroke={GR}
                    strokeWidth={1.6}
                    markerEnd="url(#pd-arrow-gr)"
                    opacity={0.95}
                  />
                </g>
              )}

          {/* prompt token nodes */}
          {PROMPT.map((t, i) => (
            <g key={i}>
              <rect
                x={promptX(i)}
                y={PY}
                width={PNW}
                height={PH}
                rx={7}
                fill={isPrefill ? CY : "var(--muted)"}
                opacity={isPrefill ? 0.9 : 0.4}
                stroke={isPrefill ? CY : "var(--border)"}
                strokeWidth={1.5}
                filter={isPrefill ? "url(#pd-soft)" : undefined}
                className="transition-all duration-300"
              />
              <text
                x={promptX(i) + PNW / 2}
                y={PY + PH / 2 + 4}
                textAnchor="middle"
                className={isPrefill ? "fill-background font-mono" : "fill-muted-foreground font-mono"}
                fontSize={11}
              >
                {t}
              </text>
            </g>
          ))}

          {/* cache container + slot ticks */}
          <rect x={CBX} y={CBY} width={CBW} height={CBH} rx={9} fill="var(--background)" stroke="var(--border)" strokeWidth={1.5} filter="url(#pd-soft)" />
          {Array.from({ length: NSLOT }).map((_, j) => {
            const active = j < filled
            const fromPrompt = j < PROMPT.length
            const isNew = !isPrefill && j === filled - 1
            return (
              <rect
                key={j}
                x={tickX(j)}
                y={TIY}
                width={TIW}
                height={TIH}
                rx={4}
                fill={active ? (fromPrompt ? CY : GR) : "var(--muted)"}
                opacity={active ? (isNew ? 1 : 0.55) : 0.25}
                stroke={isNew ? GR : "transparent"}
                strokeWidth={1.5}
                className="transition-all duration-300"
              />
            )
          })}

          {/* output token nodes */}
          {GEN.map((t, i) => {
            const shown = !isPrefill && i < s.step
            const isCur = i === curOut
            return (
              <g key={i} className="transition-opacity duration-300" opacity={shown ? 1 : 0.14}>
                <rect
                  x={outX(i)}
                  y={OY}
                  width={ONW}
                  height={OH}
                  rx={7}
                  fill={isCur ? GR : "var(--background)"}
                  opacity={isCur ? 0.92 : 1}
                  stroke={shown ? (isCur ? GR : "var(--border)") : "var(--border)"}
                  strokeWidth={1.5}
                  filter={isCur ? "url(#pd-soft)" : undefined}
                  className="transition-all duration-300"
                />
                <text
                  x={outX(i) + ONW / 2}
                  y={OY + OH / 2 + 4}
                  textAnchor="middle"
                  className={isCur ? "fill-background font-mono" : "fill-foreground font-mono"}
                  fontSize={11}
                >
                  {t}
                </text>
              </g>
            )
          })}
        </svg>

        {/* bottleneck meters (SVG bars) */}
        <svg viewBox="0 0 760 60" className="mt-1 w-full" role="img" aria-label={`compute ${Math.round(compute * 100)} percent, memory bandwidth ${Math.round(memory * 100)} percent`}>
          {[
            { label: "compute", frac: compute, hot: isPrefill, y: 10, color: CY },
            { label: "memory bandwidth", frac: memory, hot: !isPrefill, y: 38, color: GR },
          ].map((m) => (
            <g key={m.label}>
              <text x={168} y={m.y + 8} textAnchor="end" className="fill-muted-foreground font-mono" fontSize={11}>{m.label}</text>
              <rect x={182} y={m.y} width={510} height={11} rx={5.5} fill="var(--muted)" />
              <rect x={182} y={m.y} width={510 * m.frac} height={11} rx={5.5} fill={m.hot ? m.color : "var(--muted-foreground)"} opacity={m.hot ? 0.95 : 0.4} className="transition-all duration-500" />
              <text x={702} y={m.y + 9} className="fill-muted-foreground font-mono tabular-nums" fontSize={11}>{Math.round(m.frac * 100)}%</text>
            </g>
          ))}
        </svg>

        {/* readout line */}
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[10px] text-muted-foreground">
          <span>bottleneck <span className="text-foreground">{isPrefill ? "compute" : "memory BW"}</span></span>
          <span>metric <span style={{ color: isPrefill ? CY : GR }}>{isPrefill ? "TTFT" : "ITL"}</span></span>
          <span>GPU util <span className="text-foreground">{isPrefill ? "~95%" : "~30%"}</span></span>
        </div>

        {/* both captions overlaid in one grid cell so the block sizes to the taller
            (decode) text and never reflows the prose below when the phase flips */}
        <div className="mt-3 grid">
          <p
            aria-hidden={!isPrefill}
            className={cn(
              "col-start-1 row-start-1 text-sm leading-6 text-muted-foreground transition-opacity duration-300",
              isPrefill ? "opacity-100" : "pointer-events-none opacity-0"
            )}
          >
            Prefill runs the whole prompt through every layer in parallel — a big
            matrix-matrix multiply that saturates the GPU&rsquo;s math units. Its latency is
            Time To First Token (TTFT), and it leaves behind the KV cache.
          </p>
          <p
            aria-hidden={isPrefill}
            className={cn(
              "col-start-1 row-start-1 text-sm leading-6 text-muted-foreground transition-opacity duration-300",
              !isPrefill ? "opacity-100" : "pointer-events-none opacity-0"
            )}
          >
            Decode emits one token per pass: compute Q for the new token, attend over the
            cached K/V, append. The arithmetic is tiny but the GPU still streams every
            weight and the whole cache from memory — so bandwidth, not compute, sets the
            Inter-Token Latency (ITL), and most of the math units sit idle.
          </p>
        </div>
      </div>
    </figure>
  )
}
