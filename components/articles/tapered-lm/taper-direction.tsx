"use client"

import { useEffect, useState } from "react"
import { PauseIcon, PlayIcon } from "@phosphor-icons/react/dist/ssr"

import { cn } from "@/lib/utils"

// The paper's foundational experiment: split the stack into three blocks and move
// the extra capacity around — early, middle, or late — at a fixed budget. Front-
// loading wins; back-loading is worse than doing nothing. Real validation perplexity
// (440M Transformer, lower is better). Each option shows its width profile so you can
// see where the capacity went. Auto-cycles; click to pin. Static-friendly.

const L = 9 // 3 blocks × 3 layers, for the profile sketch

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

export function TaperDirection() {
  const [i, setI] = useState(0)
  const [playing, setPlaying] = useState(true)

  useEffect(() => {
    if (!playing) return
    const id = setInterval(() => setI((x) => (x + 1) % OPTS.length), 2200)
    return () => clearInterval(id)
  }, [playing])

  const o = OPTS[i]
  const best = OPTS[0] // wider-early
  const isBest = o.key === "early"
  const perLayer = (l: number) => o.block[Math.floor(l / 3)]
  const barPct = ((o.ppl - PPL_MIN) / (PPL_MAX - PPL_MIN)) * 100
  const ACCENT = isBest ? "oklch(0.72 0.15 150)" : "oklch(0.7 0.13 285)"

  return (
    <figure className="my-8 overflow-hidden rounded-md border">
      <div className="flex items-center justify-between border-b px-3 py-2 font-mono text-xs text-muted-foreground">
        <span>where should the capacity go? · 440M, fixed budget</span>
        <button type="button" onClick={() => setPlaying((p) => !p)} className="flex cursor-pointer items-center gap-1 transition-colors hover:text-foreground">
          {playing ? <PauseIcon size={12} weight="fill" /> : <PlayIcon size={12} weight="fill" />}
          {playing ? "pause" : "play"}
        </button>
      </div>

      <div className="p-4">
        <div className="flex flex-wrap gap-1.5">
          {OPTS.map((op, k) => (
            <button
              key={op.key}
              type="button"
              onClick={() => setI(k)}
              className="cursor-pointer rounded-md border px-2 py-1 font-mono text-[11px] transition-all"
              style={k === i ? { borderColor: ACCENT, background: ACCENT, color: "var(--background)" } : undefined}
            >
              {op.name}
            </button>
          ))}
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-[160px_1fr]">
          {/* width profile */}
          <div>
            <div className="mb-1 font-mono text-[10px] text-muted-foreground">width by depth</div>
            <div className="space-y-1">
              {Array.from({ length: L }).map((_, l) => (
                <div key={l} className="flex items-center gap-1">
                  <div
                    className="h-2.5 rounded-[2px] transition-all duration-300"
                    style={{ width: `${(perLayer(l) / 1.5) * 100}%`, background: ACCENT, opacity: 0.85 }}
                  />
                </div>
              ))}
            </div>
            <div className="mt-1 flex justify-between font-mono text-[9px] text-muted-foreground/60">
              <span>L0</span><span>L{L - 1}</span>
            </div>
          </div>

          {/* perplexity */}
          <div className="flex flex-col justify-center">
            <div className="mb-1 flex items-center justify-between font-mono text-xs">
              <span className="text-muted-foreground">validation perplexity (lower better)</span>
              <span className="tabular-nums text-foreground">{o.ppl.toFixed(2)}</span>
            </div>
            <div className="h-3 w-full overflow-hidden rounded bg-muted">
              <div className="h-full rounded transition-all duration-500" style={{ width: `${barPct}%`, background: ACCENT }} />
            </div>
            <div className="mt-2 grid">
              {OPTS.map((op, k) => {
                const opBest = op.key === "early"
                return (
                  <div
                    key={op.key}
                    aria-hidden={k !== i}
                    className={cn(
                      "col-start-1 row-start-1 font-mono text-[11px] transition-opacity duration-300",
                      k === i ? "opacity-100" : "pointer-events-none opacity-0"
                    )}
                    style={{ color: opBest ? "oklch(0.72 0.15 150)" : "oklch(0.7 0.13 285)" }}
                  >
                    {op.key === "uniform"
                      ? "the default baseline — 16.28"
                      : opBest
                        ? "best: −0.32 ppl vs uniform, same params"
                        : `${(op.ppl - 16.28 > 0 ? "+" : "")}${(op.ppl - 16.28).toFixed(2)} ppl vs uniform`}
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          Same parameter budget every time — only the *placement* changes. Front-loading capacity
          helps; centering it is worse than uniform; and back-loading (wider-late) is the worst of
          all, +1.01 perplexity over doing nothing. Where you spend the width matters, and the
          direction is unambiguous.
        </p>
      </div>
    </figure>
  )
}
