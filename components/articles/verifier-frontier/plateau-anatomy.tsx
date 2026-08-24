"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// Why the plateau is flat.
//
// Two explanations are available for a curve that stops moving. Either every
// model on it fails a different slice of the data, and the rates happen to
// coincide; or they all fail the same examples. The project distinguishes them by
// taking six plateau models per task and counting, for each of the 1,200 test
// items, how many get it right.
//
// The answer is the second one, decisively. A pair of plateau models fails
// together 4.8x more often than independence predicts on Countdown, 4.6x on
// faithfulness, and 13x on Maze. The plateau's height is a property of the data,
// not of each model rolling its own dice — which is why buying more parameters
// stops paying.
//
// What differs by task is how much is still contested. On Maze only 3% of items
// are decided differently by different models, and a per-example oracle would
// reach 0.943 against a best single model of 0.932. On faithfulness 26% is
// contested and the oracle reaches 0.991 against 0.952 — real headroom that the
// whole ladder leaves on the table.
//
// The project does not publish Countdown's contested share, only that it sits
// between the two, so it is shown without one.

const ACCENT = "oklch(0.60 0.15 255)"
const WARM = "oklch(0.68 0.13 85)"
const GOOD = "oklch(0.55 0.16 155)"

type Task = {
  key: string
  label: string
  hard: number
  contested: number | null
  best: number | null
  oracle: number | null
  corr: number
  note: string
}

const TASKS: Task[] = [
  {
    key: "maze",
    label: "Maze",
    hard: 5.8,
    contested: 3,
    best: 0.932,
    oracle: 0.943,
    corr: 13,
    note: "Almost everything is already decided. Three per cent of the test set is contested, and an oracle picking the best model per example gains eleven thousandths over the best single model. No amount of size buys anything here — and a pair of plateau models fails together thirteen times more often than chance would predict.",
  },
  {
    key: "countdown",
    label: "Countdown",
    hard: 2.7,
    contested: null,
    best: null,
    oracle: null,
    corr: 4.8,
    note: "Between the two extremes, and the only task whose plateau is not really flat — accuracy does climb from about 0.83 at two million parameters to 0.934 at three billion. Calling that a plateau is generous; calling it a hundredfold-cheaper way to get within ten points is not.",
  },
  {
    key: "faithful",
    label: "Faithfulness",
    hard: 0.9,
    contested: 26,
    best: 0.952,
    oracle: 0.991,
    corr: 4.6,
    note: "The opposite case. A quarter of the test set is contested, and the per-example oracle reaches 0.991 against a best single model of 0.952 — four points of headroom that no rung on the ladder claims. If any task rewards a smarter verifier rather than a bigger one, it is this one.",
  },
]

export function PlateauAnatomy() {
  const [sel, setSel] = useState("faithful")
  const t = TASKS.find((x) => x.key === sel) ?? TASKS[0]
  const easy = t.contested == null ? null : 100 - t.hard - t.contested

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          six plateau models · the same 1,200 test examples · how many get each one right
        </span>
        <span className="font-mono text-[10px]" style={{ color: WARM }}>
          {t.corr}× more joint failures than chance
        </span>
      </div>

      <div className="p-3 sm:p-4">
        <div className="flex flex-wrap gap-1.5">
          {TASKS.map((x) => (
            <button
              key={x.key}
              type="button"
              onClick={() => setSel(x.key)}
              aria-pressed={sel === x.key}
              className={cn(
                "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
                sel === x.key
                  ? "border-foreground/30 bg-muted/50 text-foreground"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {x.label}
            </button>
          ))}
        </div>

        {easy != null ? (
          <div className="mt-3">
            <div className="flex h-10 overflow-hidden rounded-md">
              <div
                className="flex items-center justify-center"
                style={{ width: `${easy}%`, background: GOOD, opacity: 0.85 }}
                title={`easy core — all six models correct: ${easy.toFixed(1)}%`}
              >
                <span className="font-mono text-[10px] text-[#0c0a09]">easy core {easy.toFixed(1)}%</span>
              </div>
              <div
                className="flex items-center justify-center"
                style={{ width: `${t.contested}%`, background: ACCENT, opacity: 0.9 }}
                title={`contested — models disagree: ${t.contested}%`}
              >
                {(t.contested as number) > 8 ? (
                  <span className="font-mono text-[10px] text-[#0c0a09]">contested {t.contested}%</span>
                ) : null}
              </div>
              <div
                className="flex items-center justify-center"
                style={{ width: `${t.hard}%`, background: WARM, opacity: 0.9 }}
                title={`hard core — every model wrong: ${t.hard}%`}
              />
            </div>
            <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1">
              {(
                [
                  ["all six correct", GOOD],
                  [`contested — ${t.contested}%`, ACCENT],
                  [`every model wrong — ${t.hard}%`, WARM],
                ] as const
              ).map(([l, c]) => (
                <span key={l} className="flex items-center gap-1 font-mono text-[9px] text-muted-foreground">
                  <span className="inline-block h-2 w-3 rounded-sm" style={{ background: c }} />
                  {l}
                </span>
              ))}
            </div>
          </div>
        ) : (
          <div className="mt-3 rounded-lg border border-dashed bg-muted/10 px-3 py-4 text-center font-mono text-[10px] text-muted-foreground">
            the contested share is not published for Countdown — only that it sits between the other two, with a
            {" "}{t.hard}% core that resists every size
          </div>
        )}

        {t.best != null && t.oracle != null ? (
          <div className="mt-3 space-y-1">
            {[
              { l: "best single model on the ladder", v: t.best, c: ACCENT },
              { l: "oracle picking the best model per example", v: t.oracle, c: GOOD },
            ].map((x) => (
              <div key={x.l} className="flex items-center gap-2">
                <span className="w-64 shrink-0 truncate text-right font-mono text-[10px] text-foreground">{x.l}</span>
                <div className="h-4 flex-1 rounded-sm bg-muted/40">
                  <div className="h-4 rounded-sm" style={{ width: `${((x.v - 0.85) / 0.15) * 100}%`, background: x.c }} />
                </div>
                <span className="w-12 shrink-0 text-right font-mono text-[10px] tabular-nums" style={{ color: x.c }}>
                  {x.v.toFixed(3)}
                </span>
              </div>
            ))}
            <div className="pl-2 font-mono text-[9px] text-muted-foreground">
              headroom an ensemble of the existing ladder could claim: {((t.oracle - t.best) * 100).toFixed(1)} points
            </div>
          </div>
        ) : null}

        <div className="mt-2 rounded-lg border bg-muted/20 px-3 py-2.5 text-sm leading-6 text-muted-foreground">
          {t.note}
        </div>

        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          The flat plateau could have meant two very different things: every model failing a different slice, with
          the rates coinciding by accident, or every model failing{" "}
          <span className="text-foreground">the same examples</span>. Counting how many of six plateau models get
          each item right settles it — joint failures run 4.6× to 13× above what independence predicts.
          <br />
          <br />
          Which reframes the plateau entirely. It is not that bigger verifiers stop improving; it is that{" "}
          <span className="text-foreground">the residual difficulty lives in the data, not in the model</span>. On
          Maze there is almost nothing left to win and a two-million-parameter verifier is genuinely finished. On
          faithfulness there are four points sitting in a contested quarter of the set, and the entire ladder from
          1M to 7B walks past them — which is an argument for a different verifier, not a larger one.
        </p>
      </div>
    </figure>
  )
}
