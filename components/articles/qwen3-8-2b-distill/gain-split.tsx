"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// Splitting the headline benchmark delta into the part a fixed extraction rule
// can see and the part that is the extraction rule changing its mind.
//
// Every number is copied off the three Empero model cards, which — to their
// credit — print both lm-eval filters:
//
//   empero-ai/Qwen3.8-2B  gsm8k_cot flex 0.330 -> 0.640 | strict 0.545 -> 0.640
//                         mmlu CoT  flex 0.283 -> 0.548 | strict 0.004 -> 0.225
//   empero-ai/Qwen3.8-4B  gsm8k_cot flex 0.850 -> 0.785 | strict 0.850 -> 0.785
//                         mmlu CoT  flex 0.354 -> 0.553 | strict 0.071 -> 0.233
//   empero-ai/Qwen3.8-9B  gsm8k_cot flex 0.885 -> 0.870 | strict 0.875 -> 0.850
//                         mmlu CoT  flex 0.546 -> 0.751 | strict 0.251 -> 0.511
//
// The decomposition is an identity, not a model. Write gap = flexible - strict
// for each model. Then
//
//   d_flexible = (strict_s + gap_s) - (strict_b + gap_b)
//              = (strict_s - strict_b) + (gap_s - gap_b)
//              =  d_strict            +  d_gap
//
// so the headline flexible delta is exactly the strict-filter delta plus the
// amount by which the extraction gap closed. No assumptions enter. What the two
// terms MEAN does depend on the task, and the widget says so per selection:
// on GSM8K the base's strict-match of 0.545 is a real solve rate, so d_strict
// is a real accuracy movement. On MMLU CoT the base's strict-match is 0.004,
// which is a regex miss rate rather than a knowledge measurement, so neither
// term isolates reasoning there.

const BASE = "oklch(0.62 0.03 250)"
const UP = "oklch(0.60 0.15 255)"
const GAP = "oklch(0.68 0.13 85)"
const DOWN = "oklch(0.58 0.19 27)"
const FINAL = "oklch(0.55 0.16 155)"

type Row = { strictB: number; strictS: number; flexB: number; flexS: number; verdict: string }

const DATA: Record<string, Record<string, Row>> = {
  gsm8k_cot: {
    "2B": {
      strictB: 0.545,
      strictS: 0.64,
      flexB: 0.33,
      flexS: 0.64,
      verdict:
        "The base already solves 54.5% of GSM8K by the harness's own strict rule. flexible-extract scores that same model at 33.0% because it grabs the last number in the output. Two thirds of the advertised +0.310 is that gap closing — the student stops talking once it has answered.",
    },
    "4B": {
      strictB: 0.85,
      strictS: 0.785,
      flexB: 0.85,
      flexS: 0.785,
      verdict:
        "The 4B base has no extraction gap at all: strict and flexible agree to three decimals. With nothing for output discipline to recover, the same distillation recipe costs 6.5 points of GSM8K under both filters.",
    },
    "9B": {
      strictB: 0.875,
      strictS: 0.85,
      flexB: 0.885,
      flexS: 0.87,
      verdict:
        "Same story at 9B, and here the gap runs the other way: the base scores one point better under the flexible filter than the strict one. Under a fixed rule the distillation costs 2.5 points.",
    },
  },
  "mmlu (CoT, 57 subjects)": {
    "2B": {
      strictB: 0.004,
      strictS: 0.225,
      flexB: 0.283,
      flexS: 0.548,
      verdict:
        "Careful here. Most of the movement lands in the strict column — but the base's strict-match is 0.004, which is a regex miss rate, not a knowledge measurement. The zero-shot CoT prompt never shows the base the required “The answer is (X).” sentence, so strict-match cannot see the base at all, and the split below cannot separate “learned the subject” from “learned the sentence”.",
    },
    "4B": {
      strictB: 0.071,
      strictS: 0.233,
      flexB: 0.354,
      flexS: 0.553,
      verdict:
        "Base strict-match 0.071. Same caveat as the 2B: with the base essentially unable to state an answer in the required form, neither column is a clean read on reasoning. The flexible gain of +0.199 is real as a harness result and is the only number either model can both be measured by.",
    },
    "9B": {
      strictB: 0.251,
      strictS: 0.511,
      flexB: 0.546,
      flexS: 0.751,
      verdict:
        "The only cell where the base's strict-match (0.251) is high enough to mean something. Here the strict delta is +0.260 and the extraction gap actually widens, so the flexible headline understates rather than overstates. This is what a gain that is not mostly formatting looks like.",
    },
  },
}

const TASKS = Object.keys(DATA)
const SIZES = ["2B", "4B", "9B"]

const sgn = (v: number) => `${v >= 0 ? "+" : "\u2212"}${Math.abs(v).toFixed(3)}`

export function GainSplit() {
  const [ti, setTi] = useState(0)
  const [size, setSize] = useState("2B")
  const task = TASKS[ti]
  const d = DATA[task][size]

  const dStrict = d.strictS - d.strictB
  const gapB = d.flexB - d.strictB
  const gapS = d.flexS - d.strictS
  const dGap = gapS - gapB
  const dFlex = d.flexS - d.flexB
  const shareGap = dFlex !== 0 ? (dGap / dFlex) * 100 : 0

  const W = 700
  const H = 214
  const TOP = 26
  const BOT = 166
  const y = (v: number) => BOT - v * (BOT - TOP)
  const COLS = [64, 226, 388, 550]
  const BW = 86

  const p1 = d.flexB
  const p2 = d.flexB + dStrict
  const p3 = d.flexS

  const bars = [
    { x: COLS[0], lo: 0, hi: p1, c: BASE, label: d.flexB.toFixed(3), cap: "base, flexible-extract" },
    {
      x: COLS[1],
      lo: Math.min(p1, p2),
      hi: Math.max(p1, p2),
      c: dStrict >= 0 ? UP : DOWN,
      label: `${dStrict >= 0 ? "+" : "−"}${Math.abs(dStrict).toFixed(3)}`,
      cap: "Δ under strict-match",
    },
    {
      x: COLS[2],
      lo: Math.min(p2, p3),
      hi: Math.max(p2, p3),
      c: dGap >= 0 ? GAP : DOWN,
      label: `${dGap >= 0 ? "+" : "−"}${Math.abs(dGap).toFixed(3)}`,
      cap: "Δ from the extraction gap",
    },
    { x: COLS[3], lo: 0, hi: p3, c: FINAL, label: d.flexS.toFixed(3), cap: "student, flexible-extract" },
  ]

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          Qwen3.5-{size} → Qwen3.8-{size} · {task}
        </span>
        <span className="font-mono text-[10px]" style={{ color: dFlex >= 0 ? FINAL : DOWN }}>
          headline Δ {dFlex >= 0 ? "+" : "−"}
          {Math.abs(dFlex).toFixed(3)}
          {dFlex > 0 ? ` · ${shareGap.toFixed(0)}% of it is extraction` : ""}
        </span>
      </div>

      <div className="p-3 sm:p-4">
        <div className="flex flex-wrap gap-1.5">
          {TASKS.map((t, i) => (
            <button
              key={t}
              type="button"
              onClick={() => setTi(i)}
              aria-pressed={ti === i}
              className={cn(
                "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
                ti === i
                  ? "border-foreground/30 bg-muted/50 text-foreground"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {t}
            </button>
          ))}
          <span className="mx-1 self-center text-[10px] text-muted-foreground">·</span>
          {SIZES.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setSize(s)}
              aria-pressed={size === s}
              className={cn(
                "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
                size === s
                  ? "border-foreground/30 bg-muted/50 text-foreground"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {s}
            </button>
          ))}
        </div>

        <div className="mt-3 overflow-x-auto">
          <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" className="min-w-[660px] max-w-full">
            <title>
              {`A waterfall for Qwen3.5-${size} to Qwen3.8-${size} on ${task}. The base scores ${d.flexB.toFixed(3)} ` +
                `under flexible-extract. The strict-match filter moves ${dStrict >= 0 ? "up" : "down"} by ` +
                `${Math.abs(dStrict).toFixed(3)}, and the extraction gap closing adds ${dGap.toFixed(3)}, ` +
                `reaching ${d.flexS.toFixed(3)}.`}
            </title>

            {[0, 0.25, 0.5, 0.75, 1].map((g) => (
              <g key={g}>
                <line x1={44} y1={y(g)} x2={W - 8} y2={y(g)} stroke="currentColor" strokeOpacity={0.09} />
                <text
                  x={38}
                  y={y(g) + 3}
                  fontSize={8}
                  textAnchor="end"
                  fill="currentColor"
                  fillOpacity={0.4}
                  fontFamily="ui-monospace, monospace"
                >
                  {g.toFixed(2)}
                </text>
              </g>
            ))}

            {/* connectors between column tops */}
            {[
              [COLS[0] + BW, p1, COLS[1]],
              [COLS[1] + BW, p2, COLS[2]],
              [COLS[2] + BW, p3, COLS[3]],
            ].map(([x1, v, x2], i) => (
              <line
                key={i}
                x1={x1}
                y1={y(v)}
                x2={x2}
                y2={y(v)}
                stroke="currentColor"
                strokeOpacity={0.28}
                strokeDasharray="3 3"
              />
            ))}

            {bars.map((b) => {
              const top = y(b.hi)
              const h = Math.max(y(b.lo) - y(b.hi), 2)
              return (
                <g key={b.cap}>
                  <rect x={b.x} y={top} width={BW} height={h} rx={3} fill={b.c} fillOpacity={0.82} />
                  <text
                    x={b.x + BW / 2}
                    y={top - 7}
                    fontSize={10}
                    textAnchor="middle"
                    fill={b.c}
                    fontFamily="ui-monospace, monospace"
                  >
                    {b.label}
                  </text>
                  <text
                    x={b.x + BW / 2}
                    y={BOT + 15}
                    fontSize={8.2}
                    textAnchor="middle"
                    fill="currentColor"
                    fillOpacity={0.55}
                    fontFamily="ui-monospace, monospace"
                  >
                    {b.cap.length > 26 ? b.cap.slice(0, 25) : b.cap}
                  </text>
                </g>
              )
            })}

            <text x={44} y={BOT + 40} fontSize={8.4} fill="currentColor" fillOpacity={0.5} fontFamily="ui-monospace, monospace">
              {`Δflexible ${sgn(dFlex)}  =  Δstrict ${sgn(dStrict)}  +  Δgap ${sgn(dGap)}   — an identity, not a fit`}
            </text>
          </svg>
        </div>

        <div className="mt-3 grid gap-2 sm:grid-cols-4">
          {[
            { l: "base strict-match", v: d.strictB.toFixed(3), c: d.strictB < 0.1 ? DOWN : BASE },
            { l: "base extraction gap", v: `${gapB >= 0 ? "+" : "−"}${Math.abs(gapB).toFixed(3)}`, c: GAP },
            { l: "student extraction gap", v: `${gapS >= 0 ? "+" : "−"}${Math.abs(gapS).toFixed(3)}`, c: GAP },
            {
              l: "headline Δ",
              v: `${dFlex >= 0 ? "+" : "−"}${Math.abs(dFlex).toFixed(3)}`,
              c: dFlex >= 0 ? FINAL : DOWN,
            },
          ].map((x) => (
            <div key={x.l} className="rounded-lg border bg-muted/20 px-3 py-2">
              <div className="font-mono text-[9px] uppercase tracking-wide text-muted-foreground">{x.l}</div>
              <div className="font-mono text-sm tabular-nums" style={{ color: x.c }}>
                {x.v}
              </div>
            </div>
          ))}
        </div>

        <p className="mt-3 rounded-lg border-l-2 px-3 py-2 text-sm leading-6 text-muted-foreground" style={{ borderColor: GAP }}>
          {d.verdict}
        </p>

        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          The split is arithmetic, not interpretation. Define each model&rsquo;s{" "}
          <em>extraction gap</em>{" "}as flexible-extract minus strict-match on the same generations.
          Then the headline delta is the strict-filter delta plus the change in that gap, exactly,
          with nothing left over. The equation under the chart is that identity evaluated for the
          current selection.
          <br />
          <br />
          What the two terms mean is where judgement comes in, and it is not the same in every cell.
          Step through the six of them. On{" "}
          <span className="font-mono text-[11px] text-foreground">gsm8k_cot</span>{" "}the 2B is the only
          one of the three scales with a positive headline — and it is also the only one whose base
          model had a large extraction gap to give back. At 4B and 9B, where the base already stopped
          at its answer, the same recipe and the same teacher make the model{" "}
          <span style={{ color: DOWN }}>worse</span>. That is the shape of a change to output habits,
          not to capability.
        </p>
      </div>
    </figure>
  )
}
