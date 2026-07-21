"use client"

import { useMemo, useState } from "react"

import { cn } from "@/lib/utils"
import {
  STYLO_SOURCE_URL,
  styloMax,
  styloMin,
  styloModels,
  styloValues,
} from "@/data/model-stylometry"

// A stylometric similarity heatmap: which models WRITE alike, judged from their
// prose alone. Each cell is the symmetric KL divergence (bits/trigram) between
// two models' character-trigram distributions — lower means more alike. Data and
// method are reproduced from Typebulb's "You're relatively right!" bulb. The
// colour ramp is theirs (blue = alike, fading to grey = distant); the widget is
// ours. Hover a cell for the pair; click to pin.

// Typebulb's ramp: vivid at similar, desaturating into grey at distant.
const RAMP = ["#4458cb", "#3e9bfe", "#18d6cb", "#46f884", "#a2fc3c", "#e1dd37", "#cfcb62", "#b5b285", "#9c9a90", "#878683"]

function rampColor(t: number): string {
  const x = Math.min(1, Math.max(0, t)) * (RAMP.length - 1)
  const i = Math.min(RAMP.length - 2, Math.floor(x))
  const f = x - i
  const hex = (c: string, k: number) => parseInt(c.slice(k, k + 2), 16)
  const ch = (k: number) => Math.round(hex(RAMP[i], k) + (hex(RAMP[i + 1], k) - hex(RAMP[i], k)) * f)
  return `rgb(${ch(1)}, ${ch(3)}, ${ch(5)})`
}

const span = styloMax - styloMin || 1

export function StylometryHeatmap() {
  const [sel, setSel] = useState<{ a: number; b: number } | null>(null)
  const [pin, setPin] = useState<{ a: number; b: number } | null>(null)
  const active = pin ?? sel

  const N = styloModels.length

  // closest cross-lab pair — the headline "these two write alike despite different labs"
  const surprise = useMemo(() => {
    let best: { a: number; b: number; v: number } | null = null
    for (let i = 0; i < N; i++)
      for (let j = 0; j < i; j++) {
        if (styloModels[i].lab === styloModels[j].lab) continue
        const v = styloValues[i][j]
        if (!best || v < best.v) best = { a: i, b: j, v }
      }
    return best
  }, [N])

  const pair =
    active && active.a !== active.b
      ? { a: styloModels[active.a], b: styloModels[active.b], v: styloValues[active.a][active.b] }
      : null

  // short label (drop the "Lab: " prefix for the axis)
  const short = (i: number) => styloModels[i].name

  return (
    <figure className="my-6 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          who writes alike · symmetric KL over char-trigrams · {N} models
        </span>
        <span className="font-mono text-[10px] text-muted-foreground">lower = more alike</span>
      </div>

      <div className="p-3 sm:p-4">
        <div className="overflow-x-auto">
          <div className="inline-block min-w-full">
            {/* the grid: N label column + N cells */}
            <div
              className="grid gap-[2px]"
              style={{ gridTemplateColumns: `minmax(96px, 150px) repeat(${N}, minmax(0, 1fr))` }}
              onMouseLeave={() => setSel(null)}
            >
              {styloModels.map((m, i) => (
                <div key={m.disp} className="contents">
                  {/* row label */}
                  <div className="flex items-center justify-end pr-1.5 font-mono text-[10px] text-muted-foreground">
                    <span className="truncate" title={m.disp}>{short(i)}</span>
                  </div>
                  {/* cells */}
                  {styloModels.map((_, j) => {
                    const t = (styloValues[i][j] - styloMin) / span
                    const on = active && ((active.a === i && active.b === j) || (active.a === j && active.b === i))
                    const isDiag = i === j
                    return (
                      <button
                        key={j}
                        type="button"
                        aria-label={`${styloModels[i].name} vs ${styloModels[j].name}: ${styloValues[i][j].toFixed(3)} bits`}
                        onMouseEnter={() => setSel({ a: i, b: j })}
                        onClick={() => setPin((p) => (p && p.a === i && p.b === j ? null : { a: i, b: j }))}
                        className={cn("aspect-square w-full min-w-[9px] rounded-[2px] transition-transform", on && "z-10 scale-[1.35] ring-2 ring-foreground")}
                        style={{ background: isDiag ? "var(--muted)" : rampColor(t) }}
                        title={isDiag ? m.disp : `${styloModels[i].name} ~ ${styloModels[j].name}: ${styloValues[i][j].toFixed(3)} bits`}
                      />
                    )
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ramp legend */}
        <div className="mt-3 flex items-center gap-2 font-mono text-[10px] text-muted-foreground">
          <span>alike</span>
          <span className="h-2.5 flex-1 rounded" style={{ background: `linear-gradient(to right, ${RAMP.join(",")})` }} />
          <span>distant</span>
          <span className="ml-2 tabular-nums">{styloMin.toFixed(2)}–{styloMax.toFixed(2)} bits</span>
        </div>

        {/* detail panel */}
        <div className="mt-3 min-h-[2.75rem] rounded-lg border bg-muted/20 px-3 py-2 font-mono text-xs">
          {pair ? (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="text-foreground">{pair.a.disp}</span>
              <span className="text-muted-foreground">vs</span>
              <span className="text-foreground">{pair.b.disp}</span>
              <span className="ml-auto tabular-nums" style={{ color: rampColor((pair.v - styloMin) / span) }}>
                {pair.v.toFixed(3)} bits{pair.a.lab === pair.b.lab ? " · same lab" : ""}
              </span>
              {pin ? <span className="w-full text-[10px] text-muted-foreground">pinned — click again to release</span> : null}
            </div>
          ) : (
            <span className="text-muted-foreground">
              {surprise ? (
                <>
                  Hover a cell for the pair. Closest across labs:{" "}
                  <span className="text-foreground">{styloModels[surprise.a].disp}</span> ~{" "}
                  <span className="text-foreground">{styloModels[surprise.b].disp}</span> at{" "}
                  <span className="tabular-nums">{surprise.v.toFixed(3)} bits</span>.
                </>
              ) : (
                "Hover a cell for the pair."
              )}
            </span>
          )}
        </div>

        <p className="mt-3 text-xs leading-5 text-muted-foreground">
          Prose only — each model answered eight fixed prompts; cells are the symmetric KL divergence
          between their character-trigram distributions (lower = writes more alike). Same-lab families
          cluster; the interesting cells are the low-divergence ones <em>across</em> labs. Data and method
          from{" "}
          <a href={STYLO_SOURCE_URL} className="underline decoration-foreground/30 underline-offset-4 hover:text-foreground">
            Typebulb&apos;s &ldquo;You&apos;re relatively right!&rdquo;
          </a>
          .
        </p>
      </div>
    </figure>
  )
}
