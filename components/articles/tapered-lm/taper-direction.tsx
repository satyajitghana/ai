"use client"

import { useEffect, useState } from "react"
import { PauseIcon, PlayIcon } from "@phosphor-icons/react/dist/ssr"

import { cn } from "@/lib/utils"

// The paper's foundational experiment: split the stack into three blocks and move
// the extra capacity around — early, middle, or late — at a fixed budget. Front-
// loading wins; back-loading is worse than doing nothing. Real validation perplexity
// (440M Transformer, lower is better). The left panel shows where the width went for
// the selected option; the right compares all four. Auto-cycles; click to pin.

type Opt = { key: string; name: string; ppl: number; block: [number, number, number] }
// block = relative width of [early, middle, late] third
const OPTS: Opt[] = [
  { key: "early", name: "wider-early", ppl: 15.96, block: [1.5, 1.0, 0.5] },
  { key: "uniform", name: "uniform", ppl: 16.28, block: [1.0, 1.0, 1.0] },
  { key: "middle", name: "wider-middle", ppl: 16.61, block: [0.75, 1.5, 0.75] },
  { key: "late", name: "wider-late", ppl: 17.29, block: [0.5, 1.0, 1.5] },
]

const PPL_MIN = 15.5
const PPL_MAX = 17.5
const GREEN = "oklch(0.72 0.15 150)"
const VIOLET = "oklch(0.7 0.13 285)"

// scene geometry (viewBox units)
const W = 600
const H = 188
const DIVX = 178
// panel A (width profile)
const PA_BX = 44
const PA_BMAX = 122
const PA_ROWY = [66, 104, 142]
const BLOCKS = ["early", "mid", "late"]
// panel B (perplexity)
const PB_LABELX = 190
const PB_BX = 268
const PB_BMAX = 250
const PB_ROWY = [64, 94, 124, 154]

export function TaperDirection() {
  const [i, setI] = useState(0)
  const [playing, setPlaying] = useState(true)

  useEffect(() => {
    if (!playing) return
    const id = setInterval(() => setI((x) => (x + 1) % OPTS.length), 2200)
    return () => clearInterval(id)
  }, [playing])

  const o = OPTS[i]
  const isBest = o.key === "early"
  const ACCENT = isBest ? GREEN : VIOLET
  const delta = o.ppl - 16.28

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex items-center justify-between border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>where should the capacity go? · 440M, fixed budget</span>
        <button type="button" onClick={() => setPlaying((p) => !p)} className="flex cursor-pointer items-center gap-1 transition-colors hover:text-foreground">
          {playing ? <PauseIcon size={12} weight="fill" /> : <PlayIcon size={12} weight="fill" />}
          {playing ? "pause" : "play"}
        </button>
      </div>

      <div className="p-3 sm:p-4">
        {/* segmented control */}
        <div className="mb-3 flex flex-wrap gap-1.5">
          {OPTS.map((op, k) => {
            const c = op.key === "early" ? GREEN : VIOLET
            return (
              <button
                key={op.key}
                type="button"
                onClick={() => setI(k)}
                className="cursor-pointer rounded-md border px-2 py-1 font-mono text-[11px] transition-all"
                style={k === i ? { borderColor: c, background: c, color: "var(--background)" } : undefined}
              >
                {op.name}
              </button>
            )
          })}
        </div>

        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`Option ${o.name} places width ${o.block[0]}, ${o.block[1]}, ${o.block[2]} across early, middle, late thirds and reaches validation perplexity ${o.ppl.toFixed(2)}. Wider-early is best; wider-late is worst.`}>
          <defs>
            <filter id="td-soft" x="-40%" y="-40%" width="180%" height="180%">
              <feDropShadow dx="0" dy="1" stdDeviation="1.3" floodOpacity="0.16" />
            </filter>
          </defs>

          {/* panel A — width profile of the selected option */}
          <text x={8} y={30} className="fill-muted-foreground/70 font-mono" fontSize={10}>where the width goes</text>
          {o.block.map((v, r) => {
            const cy = PA_ROWY[r]
            const bw = (v / 1.5) * PA_BMAX
            return (
              <g key={r}>
                <text x={8} y={cy + 3.5} className="fill-muted-foreground font-mono" fontSize={10}>{BLOCKS[r]}</text>
                <rect x={PA_BX} y={cy - 8} width={PA_BMAX} height={16} rx={3} fill="var(--muted)" opacity={0.35} />
                <rect x={PA_BX} y={cy - 8} width={bw} height={16} rx={3} fill={ACCENT} opacity={0.9} filter="url(#td-soft)" className="transition-all duration-300" />
              </g>
            )
          })}

          {/* divider */}
          <line x1={DIVX} y1={20} x2={DIVX} y2={H - 12} stroke="currentColor" strokeOpacity="0.12" />

          {/* panel B — perplexity comparison (shorter = lower = better) */}
          <text x={PB_LABELX} y={30} className="fill-muted-foreground/70 font-mono" fontSize={10}>validation perplexity · shorter = better</text>
          {OPTS.map((op, k) => {
            const cy = PB_ROWY[k]
            const active = k === i
            const c = op.key === "early" ? GREEN : VIOLET
            const bw = Math.max(((op.ppl - PPL_MIN) / (PPL_MAX - PPL_MIN)) * PB_BMAX, 3)
            return (
              <g key={op.key} onClick={() => setI(k)} className="cursor-pointer">
                <rect x={0} y={cy - 14} width={W} height={28} fill="transparent" />
                <text x={PB_LABELX} y={cy + 3.5} className={cn("font-mono", active ? "fill-foreground" : "fill-muted-foreground/70")} fontSize={9.5} fontWeight={active ? 600 : 400}>{op.name}</text>
                <rect x={PB_BX} y={cy - 8} width={PB_BMAX} height={16} rx={4} fill="var(--muted)" opacity={0.3} />
                <rect x={PB_BX} y={cy - 8} width={bw} height={16} rx={4} fill={c} opacity={active ? 1 : 0.4} filter={active ? "url(#td-soft)" : undefined} className="transition-all duration-300" />
                <text x={W - 6} y={cy + 3.5} textAnchor="end" className={cn("font-mono tabular-nums", active ? "fill-foreground" : "fill-muted-foreground/70")} fontSize={10.5} fontWeight={active ? 600 : 400}>{op.ppl.toFixed(2)}</text>
              </g>
            )
          })}
        </svg>

        {/* readout for the selected option */}
        <div className="mt-2 font-mono text-[11px]" style={{ color: ACCENT }}>
          {o.key === "uniform"
            ? "the default baseline — 16.28"
            : isBest
              ? "best: −0.32 ppl vs uniform, same params"
              : `${delta > 0 ? "+" : ""}${delta.toFixed(2)} ppl vs uniform`}
        </div>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Same parameter budget every time — only the <em>placement</em> changes. Front-loading capacity
          helps; centering it is worse than uniform; and back-loading (wider-late) is the worst of
          all, +1.01 perplexity over doing nothing. Where you spend the width matters, and the
          direction is unambiguous.
        </p>
      </div>
    </figure>
  )
}
