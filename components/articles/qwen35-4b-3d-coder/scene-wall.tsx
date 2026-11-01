"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

import { OUTCOMES, SCENES } from "./scenes"

// One square per validation scene, one row per complexity level. Each scene's HTML was loaded in headless
// Chromium (SwiftShader WebGL) with three.js 0.160.0 served locally, left running for three seconds and
// screenshotted. "clean" means no uncaught error, no console error or warning, a canvas that is not blank;
// the other classes are in OUTCOMES. These are the teacher model's scenes, not the 4B model's.

const COLOR: Record<string, string> = {
  clean: "oklch(0.64 0.14 150)",
  warn: "oklch(0.76 0.15 85)",
  slow: "oklch(0.66 0.14 255)",
  error: "oklch(0.62 0.18 30)",
  fail: "oklch(0.35 0.02 260)",
}

const W = 640
const CELL = 22
const GAP = 4
const LABEL = 30
const TOP = 6
const LEVELS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
const H = TOP + LEVELS.length * (CELL + GAP) + 4

export function SceneWall() {
  const [sel, setSel] = useState<number>(() => SCENES.findIndex((s) => s.oc !== "clean"))
  const [only, setOnly] = useState<string | null>(null)
  const s = SCENES[Math.max(0, sel)]
  const counts: Record<string, number> = {}
  for (const x of SCENES) counts[x.oc] = (counts[x.oc] ?? 0) + 1

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          {SCENES.length} validation scenes · headless Chromium · three.js 0.160.0 · measured
        </span>
        <span className="font-mono text-xs">{s.id}</span>
      </div>
      <div className="p-3 sm:p-4">
        <svg viewBox={`0 0 ${W} ${H}`} role="img" className="h-auto w-full">
          <title>
            A grid of {SCENES.length} squares, one per validation scene, one row per complexity level 1 to 10.
            {" "}
            {OUTCOMES.map((o) => `${counts[o.id] ?? 0} ${o.label}`).join(", ")}.
          </title>
          {LEVELS.map((lv, r) => {
            const y = TOP + r * (CELL + GAP)
            return (
              <g key={lv}>
                <text
                  x={LABEL - 8}
                  y={y + CELL / 2 + 3}
                  textAnchor="end"
                  fontSize={10}
                  fontFamily="ui-monospace, monospace"
                  fill="currentColor"
                  fillOpacity={0.7}
                >
                  L{lv}
                </text>
                {SCENES.map((x, i) => ({ x, i }))
                  .filter(({ x }) => x.level === lv)
                  .map(({ x, i }, c) => (
                    <rect
                      key={x.id}
                      x={LABEL + c * (CELL + GAP)}
                      y={y}
                      width={CELL}
                      height={CELL}
                      rx={3}
                      fill={COLOR[x.oc]}
                      opacity={only && only !== x.oc ? 0.15 : 1}
                      stroke={i === sel ? "currentColor" : "none"}
                      strokeWidth={2}
                      style={{ cursor: "pointer" }}
                      onClick={() => setSel(i)}
                    />
                  ))}
              </g>
            )
          })}
        </svg>
        <div className="mt-2 flex flex-wrap gap-1.5" role="group" aria-label="Filter by outcome">
          {OUTCOMES.map((o) => (
            <button
              key={o.id}
              type="button"
              aria-pressed={only === o.id}
              onClick={() => setOnly(only === o.id ? null : o.id)}
              className={cn(
                "flex items-center gap-1.5 rounded-md border px-2 py-1 font-mono text-[11px]",
                only === o.id ? "bg-foreground text-background" : "bg-background hover:bg-muted",
              )}
            >
              <i className="inline-block h-2 w-2 rounded-sm" style={{ background: COLOR[o.id] }} />
              {o.label} {counts[o.id] ?? 0}
            </button>
          ))}
        </div>
        <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 font-mono text-xs sm:grid-cols-4">
          <div><dt className="text-muted-foreground">domain</dt><dd>{s.domain}</dd></div>
          <div><dt className="text-muted-foreground">level</dt><dd className="tabular-nums">{s.level}</dd></div>
          <div><dt className="text-muted-foreground">example tokens</dt><dd className="tabular-nums">{s.tokens.toLocaleString("en-US")}</dd></div>
          <div><dt className="text-muted-foreground">outcome</dt><dd>{OUTCOMES.find((o) => o.id === s.oc)?.label}</dd></div>
        </dl>
        {s.note ? <p className="mt-2 break-words font-mono text-[11px] text-muted-foreground">{s.note}</p> : null}
      </div>
    </figure>
  )
}
