"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { mlog10, mpow } from "@/lib/dmath"
import { cn } from "@/lib/utils"

// The one architectural change, drawn twice.
//
// GLiNER v1 and GLiNER2 locate an entity by enumerating candidate spans: every
// start position paired with every allowed width, each one scored against every
// query in the schema. That builds a (positions x widths) grid, which is why
// those models carry a `max_width` — the grid is the computation, and the grid
// has to end somewhere.
//
// GLiNER2.5 scores boundaries instead. For each query the model emits a start
// score and an end score over token boundaries plus an inside score over the
// tokens, then a sparse proposal stage takes the top-k starts and top-k ends and
// pairs them. There is no width axis, so there is no ceiling, and the per-query
// candidate count stops depending on document length entirely.
//
// The sentence below is the one from Fastino's own figure. The counting panel
// underneath is arithmetic, not a measurement: L x W - W(W-1)/2 against k^2.

const ACCENT = "oklch(0.60 0.15 255)"
const WARM = "oklch(0.68 0.13 85)"
const GOOD = "oklch(0.55 0.16 155)"
const DEAD = "oklch(0.62 0.03 250)"

const WORDS = [
  "Please", "ship", "the", "order", "to", "Rosa", "Winkler,", "Apartment",
  "4B,", "Unter", "den", "Linden", "77,", "10117", "Berlin,", "Germany",
  "by", "Friday.",
]
// the address the schema actually wants: words 5..15 inclusive, eleven long
const TARGET_START = 5
const TARGET_END = 15
const TARGET_WIDTH = TARGET_END - TARGET_START + 1

export function BoundaryVsEnumeration() {
  const [mode, setMode] = useState<"enumerate" | "boundary">("enumerate")
  const [maxWidth, setMaxWidth] = useState(8)
  const [topK, setTopK] = useState(8)
  const [logL, setLogL] = useState(12) // 2^12 = 4096 words

  const L = mpow(2, logL)
  const W = maxWidth
  // every start paired with every width that still fits inside the document
  const enumCount = Math.round(L * W - (W * (W - 1)) / 2)
  const boundCount = topK * topK
  const ratio = enumCount / boundCount

  const reachable = TARGET_WIDTH <= W

  const CW = 720
  const GRID_H = 13 * 8 // widths 1..13 shown
  const X0 = 46
  const tokW = (CW - X0 - 12) / WORDS.length

  // log bars for the counting panel
  const BAR_W = 640
  const barPx = (v: number) => Math.max(2, (mlog10(Math.max(v, 1)) / 7) * BAR_W)

  const fmt = (v: number) =>
    v >= 1e6 ? `${(v / 1e6).toFixed(1)}M` : v >= 1e3 ? `${(v / 1e3).toFixed(1)}k` : `${v}`

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          how a schema query finds &ldquo;Rosa Winkler … Germany&rdquo;
        </span>
        <span
          className="font-mono text-[10px]"
          style={{ color: mode === "enumerate" ? (reachable ? WARM : DEAD) : GOOD }}
        >
          {mode === "enumerate"
            ? reachable
              ? `reachable — width ${TARGET_WIDTH} ≤ max ${W}`
              : `invisible — width ${TARGET_WIDTH} > max ${W}`
            : `reachable — no width axis`}
        </span>
      </div>

      <div className="p-3 sm:p-4">
        <div className="flex flex-wrap gap-1.5">
          {(
            [
              ["enumerate", "enumerate spans (GLiNER2)"],
              ["boundary", "score boundaries (GLiNER2.5)"],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              type="button"
              onClick={() => setMode(k)}
              aria-pressed={mode === k}
              className={cn(
                "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
                mode === k
                  ? "border-foreground/30 bg-muted/50 text-foreground"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="mt-2 overflow-x-auto">
          <svg
            viewBox={`0 0 ${CW} ${GRID_H + 74}`}
            width={CW}
            height={GRID_H + 74}
            role="img"
            className="min-w-[680px] max-w-full"
          >
            <title>
              {mode === "enumerate"
                ? `A sentence of eighteen words with a grid beneath it: one row per allowed span width, one cell per start position. Widths above the maximum of ${W} are drawn as an empty band, and the eleven-word address the schema wants falls inside that empty band whenever the maximum is below eleven.`
                : `The same sentence with two score tracks beneath it: one spike where the address begins and one where it ends, plus a shaded inside score across the words between them. There is no grid and no width axis.`}
            </title>

            {/* the sentence */}
            {WORDS.map((w, i) => {
              const inside = i >= TARGET_START && i <= TARGET_END
              const lit = mode === "boundary" ? inside : inside && reachable
              return (
                <g key={w + String(i)}>
                  <rect
                    x={X0 + i * tokW + 1}
                    y={10}
                    width={tokW - 2}
                    height={19}
                    rx={3}
                    fill={lit ? (mode === "boundary" ? GOOD : WARM) : "currentColor"}
                    fillOpacity={lit ? 0.16 : 0.05}
                    stroke={lit ? (mode === "boundary" ? GOOD : WARM) : "transparent"}
                    strokeOpacity={0.4}
                  />
                  <text
                    x={X0 + i * tokW + tokW / 2}
                    y={23}
                    fontSize={7.5}
                    textAnchor="middle"
                    fill="currentColor"
                    fillOpacity={lit ? 0.95 : 0.5}
                    fontFamily="ui-monospace, monospace"
                  >
                    {w.length > 8 ? `${w.slice(0, 7)}…` : w}
                  </text>
                </g>
              )
            })}

            {mode === "enumerate" ? (
              <>
                <text
                  x={X0 - 6}
                  y={44}
                  fontSize={7.5}
                  textAnchor="end"
                  fill="currentColor"
                  fillOpacity={0.45}
                  fontFamily="ui-monospace, monospace"
                >
                  width
                </text>
                {Array.from({ length: 13 }, (_, r) => r + 1).map((w) => {
                  const y = 36 + (w - 1) * 8
                  const allowed = w <= W
                  return (
                    <g key={w}>
                      <text
                        x={X0 - 6}
                        y={y + 6}
                        fontSize={6.5}
                        textAnchor="end"
                        fill="currentColor"
                        fillOpacity={allowed ? 0.5 : 0.2}
                        fontFamily="ui-monospace, monospace"
                      >
                        {w}
                      </text>
                      {Array.from({ length: WORDS.length }, (_, s) => s).map((s) => {
                        if (s + w > WORDS.length) return null
                        const isTarget = s === TARGET_START && w === TARGET_WIDTH
                        return (
                          <rect
                            key={s}
                            x={X0 + s * tokW + 0.8}
                            y={y}
                            width={tokW * w - 1.6}
                            height={6.4}
                            rx={1.6}
                            fill={
                              isTarget ? (allowed ? WARM : DEAD) : allowed ? ACCENT : "currentColor"
                            }
                            fillOpacity={isTarget ? (allowed ? 0.85 : 0.22) : allowed ? 0.13 : 0.035}
                            stroke={isTarget ? (allowed ? WARM : DEAD) : "transparent"}
                            strokeOpacity={0.9}
                            strokeWidth={0.7}
                          />
                        )
                      })}
                    </g>
                  )
                })}
                <line
                  x1={X0}
                  y1={36 + W * 8 - 1}
                  x2={CW - 12}
                  y2={36 + W * 8 - 1}
                  stroke={DEAD}
                  strokeDasharray="3 3"
                />
                <text
                  x={CW - 14}
                  y={36 + W * 8 + 10}
                  fontSize={7.5}
                  textAnchor="end"
                  fill={DEAD}
                  fontFamily="ui-monospace, monospace"
                >
                  max_width = {W} — nothing below this line is ever scored
                </text>
              </>
            ) : (
              <>
                {/* start / end / inside tracks */}
                {(
                  [
                    ["start", TARGET_START, 44, GOOD],
                    ["end", TARGET_END, 74, ACCENT],
                  ] as const
                ).map(([label, at, y, colour]) => (
                  <g key={label}>
                    <text
                      x={X0 - 6}
                      y={y + 14}
                      fontSize={7}
                      textAnchor="end"
                      fill={colour}
                      fontFamily="ui-monospace, monospace"
                    >
                      {label}
                    </text>
                    <line
                      x1={X0}
                      y1={y + 18}
                      x2={CW - 12}
                      y2={y + 18}
                      stroke="currentColor"
                      strokeOpacity={0.15}
                    />
                    {WORDS.map((w, i) => {
                      const d = Math.abs(i - at)
                      const h = d === 0 ? 18 : d === 1 ? 5 : d === 2 ? 2.5 : 1.2
                      return (
                        <rect
                          key={w + String(i)}
                          x={X0 + i * tokW + tokW * 0.22}
                          y={y + 18 - h}
                          width={tokW * 0.56}
                          height={h}
                          rx={1}
                          fill={colour}
                          fillOpacity={d === 0 ? 0.9 : 0.3}
                        />
                      )
                    })}
                  </g>
                ))}
                <text
                  x={X0 - 6}
                  y={112}
                  fontSize={7}
                  textAnchor="end"
                  fill={WARM}
                  fontFamily="ui-monospace, monospace"
                >
                  inside
                </text>
                {WORDS.map((w, i) => {
                  const inside = i >= TARGET_START && i <= TARGET_END
                  return (
                    <rect
                      key={w + String(i)}
                      x={X0 + i * tokW + 0.8}
                      y={102}
                      width={tokW - 1.6}
                      height={12}
                      rx={2}
                      fill={WARM}
                      fillOpacity={inside ? 0.55 : 0.08}
                    />
                  )
                })}
                <text
                  x={CW - 14}
                  y={132}
                  fontSize={7.5}
                  textAnchor="end"
                  fill={GOOD}
                  fontFamily="ui-monospace, monospace"
                >
                  the pair (5, 15) is proposed directly — eleven words costs what two would
                </text>
              </>
            )}
          </svg>
        </div>

        <div className="mt-2 grid gap-x-5 gap-y-2 sm:grid-cols-2">
          <div className="flex items-center gap-2">
            <span className="w-24 shrink-0 whitespace-nowrap font-mono text-[10px] text-muted-foreground">
              max_width
            </span>
            <Range
              min={2}
              max={24}
              step={1}
              value={maxWidth}
              onChange={(e) => setMaxWidth(Number(e.target.value))}
              className="flex-1"
              aria-label="the longest span GLiNER2 is allowed to enumerate, in words"
              accent={WARM}
            />
            <span className="w-8 shrink-0 text-right font-mono text-[10px] tabular-nums text-foreground">
              {maxWidth}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-24 shrink-0 whitespace-nowrap font-mono text-[10px] text-muted-foreground">
              top-k boundaries
            </span>
            <Range
              min={2}
              max={24}
              step={1}
              value={topK}
              onChange={(e) => setTopK(Number(e.target.value))}
              className="flex-1"
              aria-label="how many start and end boundaries the sparse proposal stage keeps per query"
              accent={GOOD}
            />
            <span className="w-8 shrink-0 text-right font-mono text-[10px] tabular-nums text-foreground">
              {topK}
            </span>
          </div>
        </div>

        {/* the counting panel */}
        <div className="mt-4 rounded-lg border bg-muted/20 p-3">
          <div className="flex items-center gap-2">
            <span className="w-24 shrink-0 whitespace-nowrap font-mono text-[10px] text-muted-foreground">
              document, words
            </span>
            <Range
              min={5}
              max={16}
              step={1}
              value={logL}
              onChange={(e) => setLogL(Number(e.target.value))}
              className="flex-1"
              aria-label="document length in words, as a power of two"
              accent={ACCENT}
            />
            <span className="w-14 shrink-0 text-right font-mono text-[10px] tabular-nums text-foreground">
              {L.toLocaleString()}
            </span>
          </div>

          <div className="mt-3 overflow-x-auto">
            <svg
              viewBox={`0 0 ${BAR_W + 40} 62`}
              width={BAR_W + 40}
              height={62}
              role="img"
              className="min-w-[600px] max-w-full"
            >
              <title>
                {`Two logarithmic bars of candidates scored per schema query. Span enumeration scores ${fmt(enumCount)} candidates; boundary pairing scores ${fmt(boundCount)}.`}
              </title>
              {(
                [
                  [`enumerate  L×W − W(W−1)/2`, enumCount, WARM, 6],
                  [`boundary   k²`, boundCount, GOOD, 34],
                ] as const
              ).map(([label, v, colour, y]) => (
                <g key={label}>
                  <rect x={0} y={y} width={barPx(v)} height={18} rx={4} fill={colour} fillOpacity={0.75} />
                  <text
                    x={6}
                    y={y + 12.5}
                    fontSize={8.5}
                    fill="#fff"
                    fontFamily="ui-monospace, monospace"
                  >
                    {label}
                  </text>
                  <text
                    x={barPx(v) + 7}
                    y={y + 12.5}
                    fontSize={9}
                    fill={colour}
                    fontFamily="ui-monospace, monospace"
                  >
                    {fmt(v)}
                  </text>
                </g>
              ))}
            </svg>
          </div>
          <div className="mt-1 font-mono text-[9px] text-muted-foreground">
            candidates scored per schema query, log scale · enumeration is{" "}
            <span style={{ color: WARM }}>{ratio >= 1 ? `${Math.round(ratio).toLocaleString()}×` : `${(1 / ratio).toFixed(1)}× fewer`}</span>{" "}
            {ratio >= 1 ? "more" : ""} at this setting
          </div>
        </div>

        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          The old grid has two axes and the second one is the problem. Every allowed width is a row,
          so the cost of the model grows with the longest thing you are willing to find, and the row
          you did not pay for does not merely score badly —{" "}
          <span className="text-foreground">it is never scored at all</span>. Raising{" "}
          <span className="font-mono text-[11px] text-foreground">max_width</span>{" "}to catch an
          eleven-word address makes every query more expensive on every document, including the ones
          full of two-word names.
          <br />
          <br />
          Boundary prediction deletes the axis. The model says where entities start and where they
          end, a sparse stage keeps the best few of each, and pairing them is{" "}
          <span className="font-mono text-[11px] text-foreground">k²</span>{" "}regardless of how far
          apart the pair sits or how long the document is. Drag the length slider: the orange bar
          tracks the document and the green one does not move.
        </p>
      </div>
    </figure>
  )
}
