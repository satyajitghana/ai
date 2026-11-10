"use client"

import { useState } from "react"

import { mlog10 } from "@/lib/dmath"

import { SAMPLES_BASE, SAMPLES_EDITED, type Sample } from "./data"

// The 20 published sample generations per model from the edited model's
// Hugging Face repo (eval/samples_*_math500.jsonl): the first sample for each
// of the first 20 problems of the re-run's 25-problem smoke test, thinking on,
// 32,768-token cap. For each I measured the length in characters, how many
// times "wait" appears, whether </think> closed, whether a \boxed{} answer
// came after it and matched the reference, and the loop onset: the first
// character after which at least 90% of the non-empty lines in the next 3,000
// characters repeat a line already written. Length is on a log axis because
// two edited answers end in a run of more than three million whitespace
// characters.

const ACCENT = "oklch(0.62 0.16 35)"
const BLUE = "oklch(0.60 0.15 255)"
const GREEN = "oklch(0.60 0.14 150)"
const MONO = "ui-monospace, monospace"

const W = 640
const LX = 150
const RX = W - 70
const ROW = 15
const TOP = 26
const XMIN = 4 // 10^4 chars
const XMAX = 6.7

const sx = (chars: number) => LX + ((mlog10(Math.max(chars, 10000)) - XMIN) / (XMAX - XMIN)) * (RX - LX)

function summary(rows: Sample[]) {
  const closed = rows.filter((r) => r.closed).length
  const correct = rows.filter((r) => r.correct).length
  const looped = rows.filter((r) => r.onset !== null).length
  const waits = [...rows.map((r) => r.wait)].sort((a, b) => a - b)
  const med = (waits[9] + waits[10]) / 2
  return { closed, correct, looped, med }
}

export function LoopStrip() {
  const [which, setWhich] = useState<"base" | "edited">("base")
  const rows = which === "base" ? SAMPLES_BASE : SAMPLES_EDITED
  const s = summary(rows)
  const H = TOP + rows.length * ROW + 30

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">20 published MATH-500 answers · thinking on · measured</span>
        <div className="flex gap-1">
          {(["base", "edited"] as const).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setWhich(k)}
              aria-pressed={which === k}
              className={`rounded-md border px-2 py-0.5 font-mono text-xs ${which === k ? "bg-foreground text-background" : "text-muted-foreground"}`}
            >
              {k}
            </button>
          ))}
        </div>
      </div>
      <div className="p-3 sm:p-4">
        <svg viewBox={`0 0 ${W} ${H}`} role="img" className="h-auto w-full">
          <title>
            {`One bar per answer, length in characters on a log axis. The ${which} model closed its thinking in ${s.closed} of 20 answers, got ${s.correct} right, and fell into a repeating loop in ${s.looped}.`}
          </title>
          {[10000, 30000, 100000, 300000, 1000000, 3000000].map((t) => (
            <g key={t}>
              <line x1={sx(t)} x2={sx(t)} y1={TOP - 6} y2={H - 24} stroke="currentColor" strokeOpacity={0.08} />
              <text x={sx(t)} y={H - 10} fontSize={9} textAnchor="middle" fontFamily={MONO} fill="currentColor" fillOpacity={0.5}>
                {t >= 1000000 ? `${t / 1000000}M` : `${t / 1000}k`}
              </text>
            </g>
          ))}
          <text x={LX} y={12} fontSize={9} fontFamily={MONO} fill="currentColor" fillOpacity={0.55}>
            characters written (log)
          </text>
          <text x={RX + 6} y={12} fontSize={9} fontFamily={MONO} fill="currentColor" fillOpacity={0.55}>
            wait
          </text>
          {rows.map((r, i) => {
            const y = TOP + i * ROW
            const color = r.correct ? GREEN : r.closed ? BLUE : ACCENT
            return (
              <g key={r.id}>
                <text x={LX - 8} y={y + 9} fontSize={9} textAnchor="end" fontFamily={MONO} fill="currentColor" fillOpacity={0.7}>
                  {r.id}
                </text>
                <rect x={LX} y={y + 2} width={Math.max(sx(r.chars) - LX, 2)} height={ROW - 5} rx={2} fill={color} fillOpacity={0.75} />
                {r.onset !== null ? (
                  <line x1={sx(r.onset)} x2={sx(r.onset)} y1={y} y2={y + ROW - 1} stroke="currentColor" strokeWidth={2} />
                ) : null}
                <text x={RX + 6} y={y + 9} fontSize={9} fontFamily={MONO} fill="currentColor" fillOpacity={0.7}>
                  {r.wait}
                </text>
              </g>
            )
          })}
        </svg>
        <div className="mt-2 flex flex-wrap gap-3 font-mono text-[11px] text-muted-foreground">
          <span>
            <span className="inline-block h-2 w-3 rounded-sm align-middle" style={{ background: GREEN }} /> closed, right answer
          </span>
          <span>
            <span className="inline-block h-2 w-3 rounded-sm align-middle" style={{ background: BLUE }} /> closed, no or wrong answer
          </span>
          <span>
            <span className="inline-block h-2 w-3 rounded-sm align-middle" style={{ background: ACCENT }} /> never closed (hit 32,768 tokens)
          </span>
          <span>| black tick = loop onset</span>
        </div>
        <dl className="mt-3 grid grid-cols-2 gap-2 font-mono text-[11px] sm:grid-cols-4">
          {[
            ["closed </think>", `${s.closed} / 20`],
            ["right answer", `${s.correct} / 20`],
            ["fell into a loop", `${s.looped} / 20`],
            ['median "wait" count', String(s.med)],
          ].map(([k, v]) => (
            <div key={k} className="rounded-lg border px-2.5 py-1.5">
              <dt className="text-muted-foreground">{k}</dt>
              <dd className="mt-0.5 text-sm">{v}</dd>
            </div>
          ))}
        </dl>
      </div>
      <figcaption className="border-t px-4 py-2.5 text-xs leading-relaxed text-muted-foreground">
        One sample per problem, published by the re-run in the edited model&apos;s repository. Twenty answers are an
        illustration, not a benchmark: the full re-run scored 51.0% over 2,000 answers. The edited model still loops
        in some answers, and its two capped answers end in millions of spaces rather than repeated sentences.
      </figcaption>
    </figure>
  )
}
