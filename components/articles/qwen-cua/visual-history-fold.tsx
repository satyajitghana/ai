"use client"

import { useMemo, useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { cn } from "@/lib/utils"

// Qwen-CUA's blockwise visual-history folding, made walkable turn by turn.
//
// The rule (paper §2.2): keep at most 20 screenshots active. The moment the
// active history would exceed that budget, advance the folded-prefix boundary
// by 10 screenshots AT ONCE (not one at a time). Folded screenshots become a
// fixed textual placeholder; everything after the boundary stays live pixels.
//
// The point of this widget is the CONTRAST between two ways to enforce the
// same 20-image budget:
//   - naive per-step folding: drop the oldest screenshot every turn once you
//     hit 20 — simple, but the folded-prefix boundary moves every step, so the
//     request prefix is different every time and the KV-cache can't be reused.
//   - Qwen-CUA's blockwise folding: the boundary only moves every 10 turns,
//     so steps 21-30 all extend the SAME prefix. That's what "cache reuse
//     economics" means in practice — most turns are a cache hit, not a miss.
//
// SSR-safety: initial turn is a fixed literal (25), no Date/Math.random. All
// layout is CSS flexbox with integer chip widths, no computed SVG coordinates.

const BUDGET = 20
const CHUNK = 10
const MAX_TURN = 45

type FoldState = { folded: number; activeFrom: number; activeCount: number }

// Qwen-CUA: boundary jumps by CHUNK whenever active history would exceed BUDGET.
function blockwiseFold(t: number): FoldState {
  let folded = 0
  while (t - folded > BUDGET) folded += CHUNK
  return { folded, activeFrom: folded + 1, activeCount: t - folded }
}

// Naive baseline: drop exactly one screenshot per turn once over budget, so
// the boundary advances by 1 every step past turn 20.
function naiveFold(t: number): FoldState {
  const folded = Math.max(0, t - BUDGET)
  return { folded, activeFrom: folded + 1, activeCount: t - folded }
}

// Was the prefix boundary the same at t-1 as at t? Same boundary = the whole
// folded-prefix + all-but-the-newest-screenshot request text is byte-identical
// to the previous turn's request = a KV-cache hit on that shared prefix.
function isCacheHit(fold: (t: number) => FoldState, t: number): boolean | null {
  if (t <= 1) return null // no previous turn to compare against
  return fold(t).folded === fold(t - 1).folded
}

// Hit ratio over the trailing window of turns ending at t (inclusive), used
// for the summary stat. Window is capped so it stays meaningful near turn 1.
function hitRatio(fold: (t: number) => FoldState, t: number, window = 10): number {
  const lo = Math.max(2, t - window + 1)
  if (t < lo) return 0
  let hits = 0
  let total = 0
  for (let k = lo; k <= t; k++) {
    total++
    if (isCacheHit(fold, k)) hits++
  }
  return total === 0 ? 0 : Math.round((hits / total) * 100)
}

const PRESETS = [
  { t: 20, label: "turn 20 · budget full" },
  { t: 21, label: "turn 21 · first fold" },
  { t: 30, label: "turn 30 · block ends" },
  { t: 31, label: "turn 31 · next fold" },
]

function Track({
  name,
  fold,
  t,
  accent,
}: {
  name: string
  fold: (t: number) => FoldState
  t: number
  accent: string
}) {
  const state = fold(t)
  const hit = isCacheHit(fold, t)
  const ratio = hitRatio(fold, t)
  const chips = Array.from({ length: state.activeCount }, (_, i) => state.activeFrom + i)

  return (
    <div className="rounded-lg border bg-muted/20 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-mono text-xs font-medium text-foreground">{name}</span>
        {hit === null ? (
          <span className="rounded px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">cold start</span>
        ) : hit ? (
          <span className="rounded px-1.5 py-0.5 font-mono text-[10px] text-white" style={{ background: "oklch(0.62 0.16 150)" }}>
            prefix unchanged · cache hit
          </span>
        ) : (
          <span className="rounded px-1.5 py-0.5 font-mono text-[10px] text-white" style={{ background: "oklch(0.62 0.18 30)" }}>
            prefix rewritten · cache miss
          </span>
        )}
      </div>

      <div className="mt-2 flex items-center gap-1.5 overflow-x-auto pb-1">
        {state.folded > 0 ? (
          <span
            className="shrink-0 rounded-md px-2 py-1.5 font-mono text-[10px] whitespace-nowrap text-white"
            style={{ background: "oklch(0.6 0.09 55)" }}
          >
            folded 1–{state.folded}
          </span>
        ) : (
          <span className="shrink-0 rounded-md border border-dashed px-2 py-1.5 font-mono text-[10px] whitespace-nowrap text-muted-foreground">
            nothing folded yet
          </span>
        )}
        <div className="flex shrink-0 items-center gap-[3px]">
          {chips.map((n, i) => (
            <span
              key={n}
              title={`turn ${n}`}
              className="h-5 w-5 shrink-0 rounded-[3px]"
              style={{
                background: i % 2 === 0 ? accent : "oklch(0.66 0.13 150)",
                opacity: n === t ? 1 : 0.55 + 0.35 * (i / Math.max(1, chips.length - 1)),
              }}
            />
          ))}
        </div>
      </div>

      <div className="mt-1.5 flex items-center justify-between font-mono text-[10px] text-muted-foreground">
        <span>
          active {state.activeFrom}–{t} ({state.activeCount} screenshots)
        </span>
        <span>
          cache-hit rate, last 10 turns: <span className="text-foreground">{ratio}%</span>
        </span>
      </div>
    </div>
  )
}

export function VisualHistoryFold() {
  const [t, setT] = useState(35)

  const blockwiseRatio = useMemo(() => hitRatio(blockwiseFold, t), [t])
  const naiveRatio = useMemo(() => hitRatio(naiveFold, t), [t])

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>blockwise visual-history folding · budget 20 · fold chunk 10</span>
        <span className="text-muted-foreground/50">turn {t}</span>
      </div>

      <div className="p-3 sm:p-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Track name="naive: fold one screenshot per turn" fold={naiveFold} t={t} accent="oklch(0.6 0.03 260)" />
          <Track name="Qwen-CUA: fold 10 screenshots at once" fold={blockwiseFold} t={t} accent="oklch(0.68 0.14 200)" />
        </div>

        <div className="mt-3">
          <div className="mb-1 flex items-center justify-between font-mono text-[11px] text-muted-foreground">
            <span>turn</span>
            <span className="tabular-nums text-foreground">{t} / {MAX_TURN}</span>
          </div>
          <Range
            min={1}
            max={MAX_TURN}
            step={1}
            value={t}
            onChange={(e) => setT(+e.target.value)}
            className="w-full"
            aria-label="turn number"
            accent="oklch(0.68 0.14 200)"
          />
        </div>

        <div className="mt-2 flex flex-wrap gap-1.5">
          {PRESETS.map((p) => (
            <button
              key={p.t}
              type="button"
              onClick={() => setT(p.t)}
              aria-pressed={t === p.t}
              className={cn(
                "cursor-pointer rounded-full border border-transparent px-2 py-0.5 font-mono text-[11px] text-muted-foreground transition-colors hover:border-foreground/25 hover:text-foreground",
                t === p.t && "border-foreground/25 text-foreground"
              )}
            >
              {p.label}
            </button>
          ))}
        </div>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Both tracks enforce the same rule — never more than 20 live screenshots. The naive track pays
          for that with a prefix that changes on <span className="text-foreground">every single turn</span>{" "}
          past turn 20 ({naiveRatio}% cache-hit rate here): a new oldest screenshot gets folded in on
          every step, so the serving engine can never reuse the KV-cache for the shared prefix. Qwen-CUA
          moves the fold boundary in blocks of 10 instead, so turns 21–30 all extend the identical prefix
          ({blockwiseRatio}% hit rate here) and only turn 21, 31, 41, and so on ever force a recompute.
          Same 20-screenshot budget, same information kept, but one version reuses the prefix nine times
          out of ten and the other never does.
        </p>
      </div>
    </figure>
  )
}
