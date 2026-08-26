"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// The 0.9 in this repo is a gate, not a score.
//
// Every one of the six environment files ends with the same line — the whole
// run_tests function is byte-identical across all six (md5 392062ff…):
//
//   return passed >= round(0.9 * len(TEST_CASES)) and not critical_failures
//
// round(0.9 * 32) = 29, so the suite passes at 29/32 with zero critical
// failures. That is an acceptance threshold the author chose. No score is
// recorded anywhere in the repo, and `grep -c %` over every .py file and the
// README returns zero: there is not a single percentage in the repository.
//
// The category mix is identical in all six files — 18/4/3/3/2/2, 9 critical,
// 12 expecting no call — which is a template filled six times rather than six
// independently collected suites. The three "critical" categories (missing,
// negation, invalid) all expect an empty call list, so the degenerate model
// that always returns [] passes 12 of 32 and fails zero critical cases.

const PASS = "oklch(0.55 0.16 155)"
const REFUSE = "oklch(0.60 0.15 255)"
const CRIT = "oklch(0.68 0.13 85)"
const BAD = "oklch(0.58 0.19 27)"

type Cat = { k: string; n: number; expectsCall: boolean; critical: boolean }

const CATS: Cat[] = [
  { k: "positive", n: 18, expectsCall: true, critical: false },
  { k: "missing", n: 4, expectsCall: false, critical: true },
  { k: "irrelevant", n: 3, expectsCall: false, critical: false },
  { k: "negation", n: 3, expectsCall: false, critical: true },
  { k: "invalid", n: 2, expectsCall: false, critical: true },
  { k: "parallel", n: 2, expectsCall: true, critical: false },
]

const TOTAL = CATS.reduce((a, c) => a + c.n, 0)
const GATE = Math.round(0.9 * TOTAL)

type Model = "real" | "refuse" | "eager"

const MODELS: { k: Model; label: string; note: string }[] = [
  {
    k: "real",
    label: "a model that actually works",
    note: "gets the happy path and the refusals right",
  },
  {
    k: "refuse",
    label: "a model that always returns []",
    note: "never calls a tool, whatever you ask it — 12 lines of Python, no weights",
  },
  {
    k: "eager",
    label: "a model that always calls something",
    note: "never refuses, whatever you ask it",
  },
]

export function ThresholdNotResult() {
  const [m, setM] = useState<Model>("refuse")

  const scored = CATS.map((c) => {
    let pass = 0
    if (m === "real") pass = c.n
    else if (m === "refuse") pass = c.expectsCall ? 0 : c.n
    else pass = c.expectsCall ? c.n : 0
    return { ...c, pass }
  })

  const passed = scored.reduce((a, c) => a + c.pass, 0)
  const critFails = scored.filter((c) => c.critical).reduce((a, c) => a + (c.n - c.pass), 0)
  const gatePass = passed >= GATE && critFails === 0

  const W = 700
  const X0 = 96
  const BAR = W - X0 - 110

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          one environment · {TOTAL} cases · gate is {GATE}/{TOTAL} and zero critical failures
        </span>
        <span className="font-mono text-[10px]" style={{ color: gatePass ? PASS : BAD }}>
          {passed}/{TOTAL} = {((passed / TOTAL) * 100).toFixed(1)}% · {critFails} critical ·{" "}
          {gatePass ? "PASSES" : "fails"}
        </span>
      </div>

      <div className="p-3 sm:p-4">
        <div className="flex flex-wrap gap-1.5">
          {MODELS.map((x) => (
            <button
              key={x.k}
              type="button"
              onClick={() => setM(x.k)}
              aria-pressed={m === x.k}
              className={cn(
                "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
                m === x.k
                  ? "border-foreground/30 bg-muted/50 text-foreground"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {x.label}
            </button>
          ))}
        </div>

        <div className="mt-3 overflow-x-auto">
          <svg
            viewBox={`0 0 ${W} ${CATS.length * 21 + 46}`}
            width={W}
            height={CATS.length * 21 + 46}
            role="img"
            className="min-w-[660px] max-w-full"
          >
            <title>
              {`Six test categories totalling ${TOTAL} cases. The selected model passes ${passed} of them with ${critFails} critical failures, against a gate of ${GATE} and zero.`}
            </title>
            {scored.map((c, i) => {
              const y = 6 + i * 21
              const w = (c.n / TOTAL) * BAR
              const pw = (c.pass / TOTAL) * BAR
              return (
                <g key={c.k}>
                  <text
                    x={X0 - 10}
                    y={y + 11}
                    fontSize={8.5}
                    textAnchor="end"
                    fill={c.expectsCall ? PASS : REFUSE}
                    fontFamily="ui-monospace, monospace"
                  >
                    {c.k}
                  </text>
                  <rect x={X0} y={y} width={w} height={13} rx={2} fill="currentColor" fillOpacity={0.08} />
                  <rect
                    x={X0}
                    y={y}
                    width={Math.max(0, pw)}
                    height={13}
                    rx={2}
                    fill={c.pass === c.n ? PASS : BAD}
                    fillOpacity={0.75}
                  />
                  <text
                    x={W - 4}
                    y={y + 10}
                    fontSize={8}
                    textAnchor="end"
                    fill={c.critical ? CRIT : "currentColor"}
                    fillOpacity={c.critical ? 0.95 : 0.55}
                    fontFamily="ui-monospace, monospace"
                  >
                    {c.pass}/{c.n}
                    {c.critical ? " · critical" : ""}
                  </text>
                  {c.critical ? <rect x={X0 - 6} y={y} width={3} height={13} rx={1} fill={CRIT} /> : null}
                </g>
              )
            })}
            <line
              x1={X0 + (GATE / TOTAL) * BAR}
              y1={0}
              x2={X0 + (GATE / TOTAL) * BAR}
              y2={CATS.length * 21 + 4}
              stroke={CRIT}
              strokeDasharray="3 3"
              strokeOpacity={0.8}
            />
            <text
              x={X0 + (GATE / TOTAL) * BAR}
              y={CATS.length * 21 + 18}
              fontSize={7.5}
              textAnchor="middle"
              fill={CRIT}
              fontFamily="ui-monospace, monospace"
            >
              the 0.9 gate — {GATE}/{TOTAL}
            </text>
            <text
              x={X0}
              y={CATS.length * 21 + 34}
              fontSize={7.5}
              fill="currentColor"
              fillOpacity={0.4}
              fontFamily="ui-monospace, monospace"
            >
              {MODELS.find((x) => x.k === m)!.note}
            </text>
            <text
              x={X0}
              y={CATS.length * 21 + 44}
              fontSize={7.5}
              fill="currentColor"
              fillOpacity={0.4}
              fontFamily="ui-monospace, monospace"
            >
              the amber ticks mark the three critical categories — all three expect no call at all
            </text>
          </svg>
        </div>

        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          The number circulating about this release is &ldquo;90%+ on held-out production
          tasks.&rdquo; The only 0.9 in the repository is this line, byte-identical in all six
          files:
          <br />
          <br />
          <code className="font-mono text-[11px] text-foreground">
            return passed &gt;= round(0.9 * len(TEST_CASES)) and not critical_failures
          </code>
          <br />
          <br />
          That is <span className="text-foreground">an acceptance threshold, not a score</span>. No
          result is recorded anywhere in the repo — there is not one percent sign in any of the six
          files or the README — and neither the repo, the upstream README nor the model card
          contains an accuracy figure for these suites. If the claim traces here, a gate is being
          read as a measurement.
          <br />
          <br />
          Now select the always-refuse model. It passes{" "}
          <span style={{ color: REFUSE }}>12 of 32</span> — and because all three critical
          categories are refusal categories,{" "}
          <span className="text-foreground">it fails zero critical cases</span>. It is nowhere near
          the gate, which is the system working. But it clears the check that was supposed to be the
          strict one, which means the strict check carries no information about the thing the model
          is for. A suite whose severity is concentrated entirely on saying no cannot certify the
          ability to say yes.
        </p>
      </div>
    </figure>
  )
}
