"use client"

import { useEffect, useState } from "react"
import { PauseIcon, PlayIcon } from "@phosphor-icons/react/dist/ssr"

import { cn } from "@/lib/utils"

// Watch the KV cache grow, drawn as a composed scene. Prefill writes one entry per
// prompt token in a single pass (four write arrows at once); then every decode step
// appends exactly one entry and reuses all the rest (bright = written this step,
// faded = already cached and never recomputed). Read arrows fan out of the whole
// cache to emit the next token. The cache — and the memory — grows linearly with
// sequence length. Scrub the step or let it loop.

const PROMPT = ["The", "cat", "sat", "on"]
const STEPS = [
  { phase: "PREFILL", input: PROMPT, token: "the", note: "writes 4 entries in one pass" },
  { phase: "DECODE", input: ["the"], token: "mat", note: "append 1, reuse 4" },
  { phase: "DECODE", input: ["mat"], token: ".", note: "append 1, reuse 5" },
  { phase: "DECODE", input: ["."], token: "<EOS>", note: "append 1, reuse 6" },
]

// the cache tokens present after each step
const CACHE_AT = STEPS.reduce<string[][]>((acc, s, i) => {
  const prev = i === 0 ? [] : acc[i - 1]
  acc.push([...prev, ...(i === 0 ? PROMPT : [STEPS[i].input[0]])])
  return acc
}, [])
const NEW_AT = STEPS.map((_, i) => (i === 0 ? PROMPT.length : 1))
const MAXN = PROMPT.length + STEPS.length - 1 // 7 slots at most

const CY = "oklch(0.66 0.14 210)" // written this step
const GR = "oklch(0.66 0.15 150)" // output

// scene geometry (fixed viewBox → no reflow)
const W = 760
const H = 236
const NW = 72
const GAP = 10
const slotX = (j: number) => (W - (MAXN * NW + (MAXN - 1) * GAP)) / 2 + j * (NW + GAP)
const slotCx = (j: number) => slotX(j) + NW / 2
const IY = 34 // input row
const CY0 = 104 // cache row
const CH = 34
const OY = 190 // output row
const NH = 28

const vcurve = (x1: number, y1: number, x2: number, y2: number) => {
  const my = (y1 + y2) / 2
  return `M ${x1} ${y1} C ${x1} ${my}, ${x2} ${my}, ${x2} ${y2}`
}

export function CacheGrow() {
  const [k, setK] = useState(0)
  const [playing, setPlaying] = useState(true)

  useEffect(() => {
    if (!playing) return
    const id = setInterval(() => setK((x) => (x + 1) % STEPS.length), 1900)
    return () => clearInterval(id)
  }, [playing])

  const step = STEPS[k]
  const cache = CACHE_AT[k]
  const L = cache.length
  const newN = NEW_AT[k]
  const firstNew = L - newN

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex items-center justify-between border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>KV cache growth · prefill writes N, decode appends 1</span>
        <button type="button" onClick={() => setPlaying((p) => !p)} className="flex cursor-pointer items-center gap-1 transition-colors hover:text-foreground">
          {playing ? <PauseIcon size={12} weight="fill" /> : <PlayIcon size={12} weight="fill" />}
          {playing ? "pause" : "play"}
        </button>
      </div>

      <div className="p-3 sm:p-4">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`${step.phase} step ${k}: cache holds ${L} entries, ${newN} written this step, emits ${step.token}`}>
          <defs>
            <marker id="cg-arrow-cy" viewBox="0 -5 10 10" markerWidth="7" markerHeight="7" orient="auto" refX="6" refY="0">
              <path d="M0,-4L6,0L0,4" fill="none" stroke={CY} strokeWidth={1.5} />
            </marker>
            <marker id="cg-arrow-gr" viewBox="0 -5 10 10" markerWidth="7" markerHeight="7" orient="auto" refX="6" refY="0">
              <path d="M0,-4L6,0L0,4" fill="none" stroke={GR} strokeWidth={1.5} />
            </marker>
            <filter id="cg-soft" x="-40%" y="-40%" width="180%" height="180%">
              <feDropShadow dx="0" dy="1" stdDeviation="1.4" floodOpacity="0.14" />
            </filter>
          </defs>

          <text x={slotX(0)} y={20} className="fill-muted-foreground font-mono" fontSize={11}>input this step</text>
          <text x={slotX(0)} y={CY0 - 8} className="fill-muted-foreground font-mono" fontSize={11}>KV cache · {L} entries (+{newN})</text>
          <text x={slotX(0)} y={OY - 8} className="fill-muted-foreground font-mono" fontSize={11}>output</text>

          {/* write connectors: input(s) → new cache slot(s) */}
          {step.input.map((_, ii) => {
            const target = k === 0 ? ii : firstNew
            return (
              <path
                key={ii}
                d={vcurve(slotCx(target), IY + NH, slotCx(target), CY0)}
                fill="none"
                stroke={CY}
                strokeWidth={1.6}
                markerEnd="url(#cg-arrow-cy)"
                opacity={0.9}
              />
            )
          })}

          {/* read connectors: whole cache fans out to the emitted token */}
          {Array.from({ length: L }).map((_, j) => (
            <path
              key={j}
              d={vcurve(slotCx(j), CY0 + CH, slotCx(firstNew), OY)}
              fill="none"
              stroke={GR}
              strokeWidth={j >= firstNew ? 1.6 : 1.1}
              markerEnd={j === firstNew ? "url(#cg-arrow-gr)" : undefined}
              opacity={j >= firstNew ? 0.9 : 0.2}
            />
          ))}

          {/* input token nodes */}
          {step.input.map((t, ii) => {
            const target = k === 0 ? ii : firstNew
            return (
              <g key={ii}>
                <rect x={slotX(target)} y={IY} width={NW} height={NH} rx={7} fill={CY} opacity={0.9} stroke={CY} strokeWidth={1.5} filter="url(#cg-soft)" />
                <text x={slotCx(target)} y={IY + NH / 2 + 4} textAnchor="middle" className="fill-background font-mono" fontSize={11}>{t}</text>
              </g>
            )
          })}

          {/* cache slot nodes (all reserved; filled up to L) */}
          {Array.from({ length: MAXN }).map((_, j) => {
            const active = j < L
            const isNew = j >= firstNew
            return (
              <g key={j} className="transition-all duration-300">
                <rect
                  x={slotX(j)}
                  y={CY0}
                  width={NW}
                  height={CH}
                  rx={7}
                  fill={active ? (isNew ? CY : "var(--background)") : "var(--muted)"}
                  opacity={active ? (isNew ? 0.92 : 1) : 0.22}
                  stroke={active ? (isNew ? CY : "var(--border)") : "transparent"}
                  strokeWidth={1.5}
                  strokeDasharray={active && !isNew ? "3 3" : undefined}
                  filter={isNew ? "url(#cg-soft)" : undefined}
                />
                {active && (
                  <text x={slotCx(j)} y={CY0 + CH / 2 + 4} textAnchor="middle" className={isNew ? "fill-background font-mono" : "fill-muted-foreground font-mono"} fontSize={11}>{cache[j]}</text>
                )}
              </g>
            )
          })}

          {/* emitted token */}
          <g>
            <rect x={slotX(firstNew)} y={OY} width={NW} height={NH} rx={7} fill={GR} opacity={0.92} stroke={GR} strokeWidth={1.5} filter="url(#cg-soft)" />
            <text x={slotCx(firstNew)} y={OY + NH / 2 + 4} textAnchor="middle" className="fill-background font-mono" fontSize={11}>{step.token}</text>
          </g>
        </svg>

        {/* step scrubber */}
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2">
          <div className="flex items-center gap-1.5">
            <span className="font-mono text-[10px] text-muted-foreground">step</span>
            {STEPS.map((st, i) => (
              <button
                key={i}
                type="button"
                onClick={() => { setPlaying(false); setK(i) }}
                aria-pressed={k === i}
                className={cn(
                  "cursor-pointer rounded-md border px-2 py-1 font-mono text-[10px] transition-colors",
                  k === i ? "border-foreground/40 text-foreground" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {i} · {st.phase.toLowerCase()}
              </button>
            ))}
          </div>
          <span className="ml-auto font-mono text-[10px] text-muted-foreground">{step.note}</span>
        </div>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Prefill writes <span className="text-foreground">N</span> entries in one pass;
          each decode step adds exactly <span className="text-foreground">one</span> and
          recomputes nothing. The cache — and the memory it costs — grows linearly with the
          sequence, which is why long contexts crowd out batch size.
        </p>
      </div>
    </figure>
  )
}
