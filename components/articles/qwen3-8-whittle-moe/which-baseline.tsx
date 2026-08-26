"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// Every published score on the 39-item knowledge battery, and the comparison the
// card does not make.
//
// The instrument is moe/q38_battery2.py in logic65/Qwen3.8-Whittle-dev: forty raw
// /completion prompts at temperature 0, top_k 1, seed 7, 40 tokens each, auto-scored
// by case-sensitive substring. One item (`story2`, a lighthouse continuation) carries
// an empty expectation list and is not scored, which is where the denominator of 39
// comes from.
//
// Scores, with their sources:
//   4/39   freshly carved            model card README, "Freshly carved, the model
//                                    was gibberish (4 of 39 on our knowledge battery)"
//   27/39  after router healing      README, and WHITTLE_FINDINGS.md: "The released
//                                    gen-2 MoE … passes 27/39 on the knowledge battery"
//   28/39  previous release          README results table, column "previous release"
//   27/39  v2 anti-loop              same table, column "v2"
//   28/39  v2.1 shipped              same table, column "v2.1"
//   36/39  Whittle-16B v1 heal       Qwen3.8-Whittle-dev README, "The ladder"; the
//          (16.8B, depth-pruned)     per-item run is research/q38_battery2_healed.json
//                                    in Qwen3.8-p44w75-16.8B-unrepaired (score "36/39")
//   ?      Qwen/Qwen3.8-27B          the parent. Not on either instrument, anywhere.
//
// Wilson 95% intervals and two-sided Fisher exact tests computed on n = 39.

const N = 39
const GOOD = "oklch(0.55 0.16 155)"
const WARN = "oklch(0.68 0.13 85)"
const BAD = "oklch(0.58 0.19 27)"
const BLUE = "oklch(0.60 0.15 255)"

type Row = { id: string; label: string; sub: string; score: number | null; colour: string }

const ROWS: Row[] = [
  { id: "carved", label: "freshly carved", sub: "before any training", score: 4, colour: BAD },
  { id: "heal", label: "after router healing", sub: "the gen-2 release", score: 27, colour: WARN },
  { id: "prev", label: "previous release", sub: "+ multi-turn SFT", score: 28, colour: WARN },
  { id: "v2", label: "v2, anti-loop round", sub: "1.03B params trained", score: 27, colour: WARN },
  { id: "v21", label: "v2.1, shipped", sub: "27B total, 17.86B active", score: 28, colour: GOOD },
  {
    id: "w16",
    label: "Whittle-16B v1 heal",
    sub: "16.8B, depth-pruned, same author",
    score: 36,
    colour: BLUE,
  },
  { id: "parent", label: "Qwen3.8-27B", sub: "the model it was carved from", score: null, colour: BAD },
]

type Cmp = { id: string; label: string; a: string; b: string; note: string }

const CMPS: Cmp[] = [
  {
    id: "headline",
    label: "the headline",
    a: "carved",
    b: "v21",
    note: "+24 of 39 · Fisher p = 3.7×10⁻⁸ — real, and it is the carve being undone",
  },
  {
    id: "routing",
    label: "what the routing round bought",
    a: "carved",
    b: "heal",
    note: "+23 of 39 · Fisher p = 1.3×10⁻⁷ — but 337.9M parameters moved, not 21.0M",
  },
  {
    id: "antiloop",
    label: "what v2 and v2.1 bought",
    a: "heal",
    b: "v21",
    note: "+1 of 39 · Fisher p = 1.00 — the card calls this “inside the measured noise floor”",
  },
  {
    id: "sibling",
    label: "against the author’s own 16.8B",
    a: "w16",
    b: "v21",
    note: "−8 of 39 · Fisher p = 0.036 — a smaller, cheaper model from the same lab scores higher",
  },
  {
    id: "parent",
    label: "against the parent",
    a: "parent",
    b: "v21",
    note: "no number exists — the control was never run on this instrument",
  },
]

function wilson(k: number, n: number): [number, number] {
  const z = 1.959963985
  const p = k / n
  const d = 1 + (z * z) / n
  const c = (p + (z * z) / (2 * n)) / d
  const h = (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / d
  return [Math.max(0, c - h) * n, Math.min(1, c + h) * n]
}

export function WhichBaseline() {
  const [sel, setSel] = useState("headline")
  const cmp = CMPS.find((c) => c.id === sel) ?? CMPS[0]
  const lit = new Set([cmp.a, cmp.b])

  const W = 700
  const LX = 176 // label column right edge
  const X0 = 190
  const XW = 452
  const RH = 21
  const TOP = 30
  const x = (v: number) => X0 + (v / N) * XW

  const a = ROWS.find((r) => r.id === cmp.a)!
  const b = ROWS.find((r) => r.id === cmp.b)!

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          the 39-item knowledge battery — every published score
        </span>
        <span className="font-mono text-[10px] text-foreground">{cmp.note}</span>
      </div>

      <div className="p-3 sm:p-4">
        <div className="flex flex-wrap gap-1.5">
          {CMPS.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setSel(c.id)}
              aria-pressed={sel === c.id}
              className={cn(
                "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
                sel === c.id
                  ? "border-foreground/30 bg-muted/50 text-foreground"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {c.label}
            </button>
          ))}
        </div>

        <div className="mt-3 overflow-x-auto">
          <svg
            viewBox={`0 0 ${W} ${TOP + ROWS.length * RH + 30}`}
            width={W}
            height={TOP + ROWS.length * RH + 30}
            role="img"
            className="min-w-[660px] max-w-full"
          >
            <title>
              {`Seven rows on a 0-to-39 axis. The comparison shown is ${a.label} against ${b.label}: ${cmp.note}.`}
            </title>

            {[0, 10, 20, 30, 39].map((t) => (
              <g key={t}>
                <line
                  x1={x(t)}
                  y1={TOP - 8}
                  x2={x(t)}
                  y2={TOP + ROWS.length * RH - 4}
                  stroke="currentColor"
                  strokeOpacity={0.1}
                />
                <text
                  x={x(t)}
                  y={TOP - 12}
                  fontSize={7.5}
                  textAnchor="middle"
                  fill="currentColor"
                  fillOpacity={0.45}
                  fontFamily="ui-monospace, monospace"
                >
                  {t}
                </text>
              </g>
            ))}

            {[a, b].map((r) =>
              r.score === null ? null : (
                <line
                  key={`v-${r.id}`}
                  x1={x(r.score)}
                  y1={TOP - 6}
                  x2={x(r.score)}
                  y2={TOP + ROWS.length * RH - 4}
                  stroke={r.colour}
                  strokeOpacity={0.55}
                  strokeDasharray="3 3"
                />
              ),
            )}

            {ROWS.map((r, i) => {
              const cy = TOP + i * RH + RH / 2
              const on = lit.has(r.id)
              const op = on ? 1 : 0.32
              if (r.score === null) {
                return (
                  <g key={r.id} opacity={op}>
                    <text
                      x={LX}
                      y={cy - 1}
                      fontSize={8.5}
                      textAnchor="end"
                      fill="currentColor"
                      fillOpacity={0.85}
                      fontFamily="ui-monospace, monospace"
                    >
                      {r.label}
                    </text>
                    <text
                      x={LX}
                      y={cy + 8}
                      fontSize={7}
                      textAnchor="end"
                      fill="currentColor"
                      fillOpacity={0.45}
                      fontFamily="ui-monospace, monospace"
                    >
                      {r.sub}
                    </text>
                    <rect
                      x={X0}
                      y={cy - 6}
                      width={XW}
                      height={12}
                      rx={2}
                      fill={BAD}
                      fillOpacity={0.06}
                      stroke={BAD}
                      strokeOpacity={0.4}
                      strokeDasharray="4 3"
                    />
                    <text
                      x={X0 + XW / 2}
                      y={cy + 3}
                      fontSize={8}
                      textAnchor="middle"
                      fill={BAD}
                      fontFamily="ui-monospace, monospace"
                    >
                      never measured on this battery
                    </text>
                    <text
                      x={W - 8}
                      y={cy + 3}
                      fontSize={9}
                      textAnchor="end"
                      fill={BAD}
                      fontFamily="ui-monospace, monospace"
                    >
                      —
                    </text>
                  </g>
                )
              }
              const [lo, hi] = wilson(r.score, N)
              return (
                <g key={r.id} opacity={op}>
                  <text
                    x={LX}
                    y={cy - 1}
                    fontSize={8.5}
                    textAnchor="end"
                    fill="currentColor"
                    fillOpacity={0.85}
                    fontFamily="ui-monospace, monospace"
                  >
                    {r.label}
                  </text>
                  <text
                    x={LX}
                    y={cy + 8}
                    fontSize={7}
                    textAnchor="end"
                    fill="currentColor"
                    fillOpacity={0.45}
                    fontFamily="ui-monospace, monospace"
                  >
                    {r.sub}
                  </text>
                  <line
                    x1={x(lo)}
                    y1={cy}
                    x2={x(hi)}
                    y2={cy}
                    stroke={r.colour}
                    strokeOpacity={0.35}
                    strokeWidth={6}
                    strokeLinecap="round"
                  />
                  <circle cx={x(r.score)} cy={cy} r={4} fill={r.colour} />
                  <text
                    x={W - 8}
                    y={cy + 3}
                    fontSize={9}
                    textAnchor="end"
                    fill={r.colour}
                    fontFamily="ui-monospace, monospace"
                    fontWeight={on ? 600 : 400}
                  >
                    {r.score}/39
                  </text>
                </g>
              )
            })}

            <text
              x={X0}
              y={TOP + ROWS.length * RH + 16}
              fontSize={7.5}
              fill="currentColor"
              fillOpacity={0.5}
              fontFamily="ui-monospace, monospace"
            >
              items passed, of 39 · bars are Wilson 95% intervals — one item is 2.6 points
            </text>
          </svg>
        </div>

        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          Four of these five comparisons use the same numbers and mean different things. The one the
          card leads with is real — going from 4 to 28 on a 39-item quiz is not noise. It is also a
          measurement of{" "}
          <span className="text-foreground">how much damage the splitting procedure did</span>, since
          the 4/39 model is an artefact the method produced and then repaired.
          <br />
          <br />
          The comparison that would settle what the MoE is worth — against{" "}
          <span className="font-mono text-[11px] text-foreground">Qwen/Qwen3.8-27B</span>, the dense
          model every one of these weights came out of — is the one row with no number in it. The
          nearest thing the project publishes is the row above it: a{" "}
          <span style={{ color: BLUE }}>16.8B depth-pruned model</span>{" "}from the same author, on the
          same instrument, eight items ahead.
        </p>
      </div>
    </figure>
  )
}
