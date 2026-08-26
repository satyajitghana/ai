"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// Table 9: what 51B of N-gram embeddings actually bought.
//
// N-gram embedding looks up a table using the current token plus the two before
// it (`ngram_size: 3`), adding a very large number of parameters for almost no
// per-token compute — the lookups are deterministic and known in advance, so the
// table can live in host memory and be prefetched. Qwen add 51B of it on top of
// a 125B backbone and place it at layer 2, so the prefetch overlaps layer 1.
//
// The scaling study is the honest part. Vocabulary goes from none to 200× the
// base tokenizer vocabulary, with parameters added rather than traded against
// experts. Loss falls monotonically the whole way — 1.585 to 1.526. Downstream
// does not: most benchmarks peak between 20× and 100× and then decline, and
// only the two Chinese benchmarks improve all the way to the end.
//
// Qwen say this plainly: "Loss decreases monotonically as the N-gram vocabulary
// grows, while downstream performance does not follow the same trend."

const LOSS_C = "oklch(0.68 0.13 85)"
const BENCH_C = "oklch(0.55 0.16 155)"
const MUTED = "oklch(0.62 0.03 250)"

const SCALES = ["none", "20×", "50×", "100×", "200×"] as const
const LOSS = [1.585, 1.553, 1.541, 1.534, 1.526]

const GROUPS = [
  { k: "chinese", label: "Chinese", cols: { "C-Eval": [66.91, 71.75, 72.12, 73.75, 74.94], CMMLU: [68.1, 72.29, 72.48, 72.73, 73.24] } },
  { k: "stem", label: "maths", cols: { MATH: [32.52, 37.38, 37.32, 36.98, 35.34], GSM8K: [59.21, 65.09, 64.0, 63.08, 62.96] } },
  { k: "knowledge", label: "knowledge", cols: { MMLU: [62.78, 64.14, 64.71, 64.7, 64.85], "MMLU-Pro": [33.43, 34.46, 35.8, 35.87, 35.21] } },
  { k: "other", label: "reasoning + multilingual", cols: { BBH: [53.4, 57.13, 57.56, 56.03, 56.23], MMMLU: [54.06, 55.94, 56.64, 56.65, 55.82] } },
] as const

export function NgramScaling() {
  const [gk, setGk] = useState<string>("stem")
  const g = GROUPS.find((x) => x.k === gk)!
  const cols = Object.entries(g.cols) as [string, number[]][]

  // where each series peaks
  const peaks = cols.map(([name, xs]) => ({ name, at: xs.indexOf(Math.max(...xs)) }))
  const lossBest = LOSS.indexOf(Math.min(...LOSS))

  const W = 700
  const H = 210
  const X0 = 56
  const X1 = 640
  const Y0 = 22
  const Y1 = 152
  const PX = (i: number) => X0 + (i / (SCALES.length - 1)) * (X1 - X0)

  const lo = Math.min(...LOSS)
  const hi = Math.max(...LOSS)
  const PYL = (v: number) => Y1 - ((v - lo) / (hi - lo)) * (Y1 - Y0)

  const allB = cols.flatMap(([, xs]) => xs)
  const bLo = Math.min(...allB) - 1
  const bHi = Math.max(...allB) + 1
  const PYB = (v: number) => Y1 - ((v - bLo) / (bHi - bLo)) * (Y1 - Y0)

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          N-gram vocabulary scaling, parameters added not traded
        </span>
        <span className="font-mono text-[10px]" style={{ color: LOSS_C }}>
          loss is best at {SCALES[lossBest]} · {g.label} peaks at{" "}
          {peaks.map((p) => SCALES[p.at]).join(" / ")}
        </span>
      </div>

      <div className="p-3 sm:p-4">
        <div className="flex flex-wrap gap-1.5">
          {GROUPS.map((x) => (
            <button
              key={x.k}
              type="button"
              onClick={() => setGk(x.k)}
              aria-pressed={gk === x.k}
              className={cn(
                "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
                gk === x.k
                  ? "border-foreground/30 bg-muted/50 text-foreground"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {x.label}
            </button>
          ))}
        </div>

        <div className="mt-2 overflow-x-auto">
          <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" className="min-w-[660px] max-w-full">
            <title>
              {`Training loss falls monotonically as the N-gram vocabulary grows from none to 200 times the base vocabulary, reaching its minimum at 200 times. The ${g.label} benchmarks peak earlier, at ${peaks.map((p) => SCALES[p.at]).join(" and ")}, and decline after that.`}
            </title>

            <line x1={X0} y1={Y1} x2={X1} y2={Y1} stroke="currentColor" strokeOpacity={0.25} />
            {SCALES.map((s, i) => (
              <text key={s} x={PX(i)} y={Y1 + 15} fontSize={8.5} textAnchor="middle" fill="currentColor" fillOpacity={0.45} fontFamily="ui-monospace, monospace">
                {s}
              </text>
            ))}
            <text x={(X0 + X1) / 2} y={H - 22} fontSize={8.5} textAnchor="middle" fill="currentColor" fillOpacity={0.45} fontFamily="ui-monospace, monospace">
              N-gram vocabulary, relative to the 250K base tokenizer vocabulary
            </text>

            {/* loss */}
            <path
              d={LOSS.map((v, i) => `${i === 0 ? "M" : "L"} ${PX(i).toFixed(2)} ${PYL(v).toFixed(2)}`).join(" ")}
              fill="none"
              stroke={LOSS_C}
              strokeWidth={2.6}
            />
            {LOSS.map((v, i) => (
              <circle key={i} cx={PX(i)} cy={PYL(v)} r={i === lossBest ? 5 : 3} fill={LOSS_C} />
            ))}
            <text x={X0 + 4} y={PYL(LOSS[0]) - 9} fontSize={8.5} fill={LOSS_C} fontFamily="ui-monospace, monospace">
              training loss — falls all the way
            </text>

            {/* benchmarks */}
            {cols.map(([name, xs], ci) => (
              <g key={name}>
                <path
                  d={xs.map((v, i) => `${i === 0 ? "M" : "L"} ${PX(i).toFixed(2)} ${PYB(v).toFixed(2)}`).join(" ")}
                  fill="none"
                  stroke={BENCH_C}
                  strokeWidth={2}
                  strokeOpacity={ci === 0 ? 0.95 : 0.5}
                  strokeDasharray={ci === 0 ? undefined : "5 3"}
                />
                {xs.map((v, i) => (
                  <circle
                    key={i}
                    cx={PX(i)}
                    cy={PYB(v)}
                    r={i === peaks[ci].at ? 5 : 2.6}
                    fill={BENCH_C}
                    fillOpacity={ci === 0 ? 0.95 : 0.55}
                  />
                ))}
                <text
                  x={PX(SCALES.length - 1) + 6}
                  y={PYB(xs[xs.length - 1]) + 3}
                  fontSize={8}
                  fill={BENCH_C}
                  fillOpacity={ci === 0 ? 0.95 : 0.6}
                  fontFamily="ui-monospace, monospace"
                >
                  {name}
                </text>
              </g>
            ))}

            {/* the disagreement */}
            {peaks[0].at !== lossBest ? (
              <>
                <line x1={PX(peaks[0].at)} y1={Y0 - 6} x2={PX(peaks[0].at)} y2={Y1} stroke={BENCH_C} strokeDasharray="2 3" strokeOpacity={0.5} />
                <line x1={PX(lossBest)} y1={Y0 - 6} x2={PX(lossBest)} y2={Y1} stroke={LOSS_C} strokeDasharray="2 3" strokeOpacity={0.5} />
                <text x={(PX(peaks[0].at) + PX(lossBest)) / 2} y={Y0 - 10} fontSize={8} textAnchor="middle" fill={MUTED} fontFamily="ui-monospace, monospace">
                  the two metrics disagree by {Math.abs(peaks[0].at - lossBest)} step
                  {Math.abs(peaks[0].at - lossBest) > 1 ? "s" : ""}
                </text>
              </>
            ) : (
              <text x={(X0 + X1) / 2} y={Y0 - 10} fontSize={8} textAnchor="middle" fill={MUTED} fontFamily="ui-monospace, monospace">
                here the two metrics agree
              </text>
            )}
          </svg>
        </div>
        <div className="mt-1 font-mono text-[9px] text-muted-foreground">
          Table 9, Qwen3.8-Flash-Next technical report · the two axes are scaled independently, so
          only the shapes are comparable
        </div>

        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          Start on maths. Loss falls at every step, all the way to 200×. MATH peaks at 20× and then
          gives back two of the five points it gained; GSM8K does the same.{" "}
          <span className="text-foreground">
            Past 20× you are buying loss and paying for it in arithmetic
          </span>
          .
          <br />
          <br />
          Then switch to Chinese, which is the one group that tracks the loss curve: C-Eval climbs
          from 66.91 to 74.94 without ever turning over, CMMLU likewise. That is a coherent story
          rather than a fluke — a table indexed by trigrams is a memory for frequent local
          character patterns, and it should help most where the tokenizer is under the most
          pressure.
          <br />
          <br />
          Qwen report all of this rather than picking the flattering slice, including a separate
          study where N-gram embeddings are traded against MoE experts under a fixed budget and{" "}
          <span style={{ color: MUTED }}>show no clear downstream improvement over MoE alone</span>,
          and a paragraph listing parameter-efficiency tricks they tried that produced no consistent
          gain. The 51B in the shipped model is defensible on loss and on Chinese. That it is
          51B <em>well spent</em>{" "}versus more experts is, on their own evidence, not shown.
        </p>
      </div>
    </figure>
  )
}
