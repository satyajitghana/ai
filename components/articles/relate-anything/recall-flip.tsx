"use client"

import { useState } from "react"

import { FigureCard, Legend, MODEL, MUTED, Segmented } from "./shared"

// The paper's sharpest experiment, redrawn so the flip is the thing you see.
//
// `freq` (Zellers et al. 2018) is a lookup table: for a pair of ground-truth
// object categories it returns the most frequent training predicate. It reads
// no pixels at all. `ours` is RelateAnything's zero-shot tower, which reads
// pixels and boxes and is never told an object class.
//
// Every number here is Table 1 of arXiv 2609.12552v1 — per-edge top-1 accuracy
// over ground-truth pairs and boxes, on the three benchmarks' test splits.
// Nothing is interpolated, and the deltas are recomputed here from the two
// numbers beside them rather than copied, so a typo in one would show up as a
// disagreement with the paper's own printed delta (-15.6 / -15.0 / -15.5 and
// +85.7 / +52.4 / +28.9; the paper rounds from unrounded inputs, so a tenth of
// a point of drift in the macro column is expected).

interface Bench {
  name: string
  edges: number
  microFreq: number
  microOurs: number
  macroFreq: number
  macroOurs: number
  onlyOurs: number
  union: number
}

const DATA: Bench[] = [
  {
    name: "VG150",
    edges: 152535,
    microFreq: 68.4,
    microOurs: 57.7,
    macroFreq: 18.9,
    macroOurs: 35.1,
    onlyOurs: 6.9,
    union: 75.3,
  },
  {
    name: "PSG",
    edges: 13623,
    microFreq: 50.9,
    microOurs: 43.3,
    macroFreq: 20.7,
    macroOurs: 31.6,
    onlyOurs: 12.8,
    union: 63.7,
  },
  {
    name: "IndoorVG",
    edges: 29175,
    microFreq: 67.9,
    microOurs: 57.3,
    macroFreq: 29.8,
    macroOurs: 38.4,
    onlyOurs: 8.2,
    union: 76.2,
  },
]

type Mode = "micro" | "macro" | "join"

const MODES: Record<Mode, { label: string; blurb: string }> = {
  micro: {
    label: "micro (per edge)",
    blurb:
      "Average over edges. Head predicates dominate the average, so returning each category pair's majority string is close to optimal — and the table wins every benchmark by about 15%. This is the protocol leaderboards are ordered by.",
  },
  macro: {
    label: "macro (per predicate)",
    blurb:
      "Average over predicates, from the same predictions. Every predicate counts once regardless of how often it occurs, so the majority string stops paying — and the ordering inverts, by 29% to 86%.",
  },
  join: {
    label: "the edge-by-edge join",
    blurb:
      "The two systems joined per edge, as percentages of all edges. \u201conly ours\u201d is the share the model gets right and the table gets wrong, so pixels are demonstrably doing work; \u201coracle union\u201d is the best either could do together, which neither reaches alone.",
  },
}

const SCALE = 80 // % — a fixed axis so bars are comparable across modes

function Bar({
  label,
  value,
  color,
  sub,
}: {
  label: string
  value: number
  color: string
  sub?: string
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-[5.5rem] shrink-0 truncate font-mono text-[10px] text-muted-foreground sm:w-24">
        {label}
      </span>
      <div className="h-5 min-w-0 flex-1 overflow-hidden rounded-sm bg-muted/40">
        <div
          className="h-full rounded-sm transition-[width] duration-300 ease-out"
          style={{ width: `${(value / SCALE) * 100}%`, background: color }}
        />
      </div>
      <span
        className="w-20 shrink-0 text-right font-mono text-xs tabular-nums"
        style={{ color }}
      >
        {value.toFixed(1)}
        {sub ? <span className="text-muted-foreground"> {sub}</span> : null}
      </span>
    </div>
  )
}

export function RecallFlip() {
  const [mode, setMode] = useState<Mode>("micro")

  return (
    <FigureCard
      label="a pixel-free lookup table against the model, on the same predictions"
      right={<span className="font-mono">paper, Table 1</span>}
    >
      <div className="space-y-5">
        {DATA.map((b) => {
          const freq = mode === "macro" ? b.macroFreq : b.microFreq
          const ours = mode === "macro" ? b.macroOurs : b.microOurs
          const delta = (ours / freq - 1) * 100
          const leader = ours > freq ? "ours" : "freq"
          return (
            <div key={b.name}>
              <div className="mb-1.5 flex items-baseline justify-between gap-2">
                <span className="font-mono text-xs text-foreground">{b.name}</span>
                <span className="font-mono text-[10px] text-muted-foreground">
                  {b.edges.toLocaleString("en-US")} edges
                </span>
              </div>
              {mode === "join" ? (
                <div className="space-y-1.5">
                  <Bar label="only ours" value={b.onlyOurs} color={MODEL} sub="%" />
                  <Bar label="oracle union" value={b.union} color={MUTED} sub="%" />
                </div>
              ) : (
                <div className="space-y-1.5">
                  <Bar label="freq (no pixels)" value={freq} color={MUTED} />
                  <Bar label="RelateAnything" value={ours} color={MODEL} />
                  <p className="pl-[5.5rem] font-mono text-[10px] text-muted-foreground sm:pl-24">
                    {delta > 0 ? "+" : ""}
                    {delta.toFixed(1)}% for the model
                    {leader === "freq"
                      ? " — the table that reads no pixels is ahead"
                      : ""}
                  </p>
                </div>
              )}
            </div>
          )
        })}
      </div>

      <div className="mt-5">
        <Segmented
          label="scored by"
          value={mode}
          onChange={setMode}
          options={(Object.keys(MODES) as Mode[]).map((m) => ({
            value: m,
            label: MODES[m].label,
          }))}
        />
      </div>

      <p className="mt-3 text-xs leading-5 text-muted-foreground">
        {MODES[mode].blurb}
      </p>

      <Legend
        items={[
          { color: MUTED, label: "frequency table — oracle object labels, zero pixels" },
          { color: MODEL, label: "RelateAnything — pixels and boxes, no object labels" },
        ]}
      />
    </FigureCard>
  )
}
