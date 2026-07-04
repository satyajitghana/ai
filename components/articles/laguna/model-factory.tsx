"use client"

import { useEffect, useState } from "react"
import { PauseIcon, PlayIcon } from "@phosphor-icons/react/dist/ssr"

import { cn } from "@/lib/utils"

// The Model Factory as a flywheel — drawn as an actual cyclic diagram. Poolside's claim
// isn't a single architecture trick; it's that model development is an *industrial
// process*: a tightly-versioned loop where data, training, evaluation, and inference are
// one integrated system, and each turn of the loop makes the next one faster and more
// reproducible. Four nodes sit on a ring joined by curved arrows; the cycle auto-advances
// and the incoming arrow lights up. Click a stage to inspect it. The ↻ is the whole point.

const ACCENT = "oklch(0.72 0.15 195)"

const STAGES = [
  {
    key: "data",
    name: "versioned data",
    what: "Every dataset is content-addressed and versioned, so any model's exact inputs are reproducible.",
    why: "Reproducibility is the substrate of an industrial process — you can't iterate reliably on training data you can't pin down.",
  },
  {
    key: "train",
    name: "training",
    what: "Train the models from scratch, end-to-end, with runs tied to specific data versions.",
    why: "Because the data is pinned, a training run is a repeatable experiment, not a one-off — the thing that lets you improve systematically.",
  },
  {
    key: "eval",
    name: "evaluation",
    what: "Continuous, integrated evaluation — agentic software-engineering benchmarks gate progress, not just perplexity.",
    why: "For a coding model the target is resolving real tasks, so the eval has to run the agent, not score next-token loss. It's the fitness function of the whole loop.",
  },
  {
    key: "infer",
    name: "inference",
    what: "Serving and quantization — and the deployed model's real traces become signal.",
    why: "Inference isn't the end of the line; it feeds the next turn. What the model does in the wild versions the next round of data.",
  },
] as const

// scene geometry (viewBox units)
const W = 720
const H = 340
const CX = W / 2
const CY = H / 2 + 4
const RX = 246
const RY = 116
const NW = 152
const NH = 46
const ANG = [-90, 0, 90, 180] // data top · train right · eval bottom · infer left (clockwise)

const rad = (d: number) => (d * Math.PI) / 180
const ell = (deg: number, rx: number, ry: number): [number, number] => [
  CX + rx * Math.cos(rad(deg)),
  CY + ry * Math.sin(rad(deg)),
]

export function ModelFactory() {
  const [i, setI] = useState(0)
  const [playing, setPlaying] = useState(true)

  useEffect(() => {
    if (!playing) return
    const id = setInterval(() => setI((x) => (x + 1) % STAGES.length), 2600)
    return () => clearInterval(id)
  }, [playing])

  const s = STAGES[i]
  // the edge whose arrow points INTO the active node
  const activeEdge = (i + STAGES.length - 1) % STAGES.length

  const centers = ANG.map((a) => ell(a, RX, RY))

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex items-center justify-between border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>the Model Factory · development as a flywheel</span>
        <button type="button" onClick={() => setPlaying((p) => !p)} className="flex cursor-pointer items-center gap-1 transition-colors hover:text-foreground">
          {playing ? <PauseIcon size={12} weight="fill" /> : <PlayIcon size={12} weight="fill" />}
          {playing ? "pause" : "play"}
        </button>
      </div>

      <div className="p-3 sm:p-4">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`A four-stage development loop — versioned data, training, evaluation, inference — cycling back on itself; currently highlighting ${s.name}`}>
          <defs>
            <marker id="mf-arrow" viewBox="0 -5 10 10" markerWidth="7" markerHeight="7" orient="auto" refX="6" refY="0">
              <path d="M0,-4L6,0L0,4" fill="none" stroke={ACCENT} strokeWidth={1.5} />
            </marker>
            <marker id="mf-arrow-muted" viewBox="0 -5 10 10" markerWidth="7" markerHeight="7" orient="auto" refX="6" refY="0">
              <path d="M0,-4L6,0L0,4" fill="none" stroke="var(--muted-foreground)" strokeWidth={1.5} />
            </marker>
            <filter id="mf-soft" x="-40%" y="-40%" width="180%" height="180%">
              <feDropShadow dx="0" dy="1" stdDeviation="1.4" floodOpacity="0.16" />
            </filter>
          </defs>

          {/* curved connectors, clockwise around the ring (behind nodes) */}
          {ANG.map((a, e) => {
            const b = a + 90
            const [x0, y0] = ell(a + 26, RX * 1.04, RY * 1.06)
            const [cx1, cy1] = ell(a + 40, RX * 1.18, RY * 1.36)
            const [cx2, cy2] = ell(b - 40, RX * 1.18, RY * 1.36)
            const [x3, y3] = ell(b - 26, RX * 1.04, RY * 1.06)
            const on = e === activeEdge
            return (
              <path
                key={e}
                d={`M ${x0} ${y0} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${x3} ${y3}`}
                fill="none"
                stroke={on ? ACCENT : "var(--muted-foreground)"}
                strokeWidth={on ? 2 : 1.5}
                strokeLinecap="round"
                opacity={on ? 0.95 : 0.3}
                markerEnd={`url(#${on ? "mf-arrow" : "mf-arrow-muted"})`}
                className="transition-all duration-500"
              />
            )
          })}

          {/* center loop glyph */}
          <text x={CX} y={CY - 4} textAnchor="middle" className="fill-muted-foreground font-mono" fontSize={54} opacity={0.16}>↻</text>
          <text x={CX} y={CY + 30} textAnchor="middle" className="fill-muted-foreground font-mono" fontSize={11} opacity={0.7}>one integrated loop</text>
          <text x={CX} y={CY + 46} textAnchor="middle" className="fill-muted-foreground font-mono" fontSize={9} opacity={0.5}>each turn versions the next</text>

          {/* stage nodes */}
          {STAGES.map((st, k) => {
            const [nx, ny] = centers[k]
            const on = k === i
            return (
              <g key={st.key} className="cursor-pointer" onClick={() => { setPlaying(false); setI(k) }}>
                <rect
                  x={nx - NW / 2}
                  y={ny - NH / 2}
                  width={NW}
                  height={NH}
                  rx={11}
                  fill={on ? ACCENT : "var(--background)"}
                  stroke={on ? ACCENT : "var(--border)"}
                  strokeWidth={1.5}
                  opacity={on ? 1 : 0.96}
                  filter={on ? "url(#mf-soft)" : undefined}
                  className="transition-all duration-300"
                />
                <circle cx={nx - NW / 2 + 16} cy={ny} r={9} fill={on ? "var(--background)" : "var(--muted)"} opacity={on ? 0.28 : 0.7} />
                <text x={nx - NW / 2 + 16} y={ny + 3.5} textAnchor="middle" className="font-mono" fontSize={10} fontWeight={600} fill={on ? "var(--background)" : "var(--muted-foreground)"}>{k + 1}</text>
                <text x={nx + 8} y={ny + 4} textAnchor="middle" className="font-mono" fontSize={12} fontWeight={600} fill={on ? "var(--background)" : "var(--foreground)"}>{st.name}</text>
              </g>
            )
          })}
        </svg>

        {/* inspector — grid-stack all stages in one cell so height = tallest stage (no layout shift) */}
        <div className="mt-2 grid">
          {STAGES.map((st, k) => (
            <div
              key={st.key}
              aria-hidden={k !== i}
              className={cn(
                "col-start-1 row-start-1 rounded-md bg-muted/40 px-3 py-3 transition-opacity duration-300",
                k === i ? "opacity-100" : "pointer-events-none opacity-0",
              )}
              style={{ borderColor: ACCENT }}
            >
              <div className="font-mono text-xs" style={{ color: ACCENT }}>{k + 1}. {st.name}</div>
              <p className="mt-1.5 text-sm leading-6">
                <span className="font-medium text-foreground">What:</span> <span className="text-muted-foreground">{st.what}</span>
              </p>
              <p className="mt-1 text-sm leading-6">
                <span className="font-medium text-foreground">Why:</span> <span className="text-muted-foreground">{st.why}</span>
              </p>
            </div>
          ))}
        </div>

        <p className="mt-3 font-mono text-[10px] text-muted-foreground/60">auto-advancing · click any stage to hold it</p>
      </div>
    </figure>
  )
}
