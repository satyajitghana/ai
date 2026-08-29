"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// The README's own "Field notes -- what 2bit-lite is actually good for"
// section, surfaced rather than summarized. Two facts sit side by side there
// that the README never puts in the same sentence: the build is marketed at
// "128 GB Macs", but the verification paragraph that follows says "Verified
// on a single H200" -- an Nvidia data-center GPU, not a Mac at all. The three
// failure modes below (repetition loops, missing glue code, rewrite churn)
// are the README's own bullet list, verbatim in substance.

const GOOD = "oklch(0.55 0.16 155)"
const BAD = "oklch(0.58 0.19 27)"
const UNKNOWN = "oklch(0.62 0.03 250)"

type Cell = "good" | "bad" | "untested"

const COLS = ["multi-turn chat", "everyday Q&A / short text", "long code generation"] as const

const COVERAGE: { row: string; sub: string; cells: Cell[] }[] = [
  { row: "1× H200", sub: "where 2bit-lite was actually verified", cells: ["good", "good", "bad"] },
  { row: "128 GB MacBook Pro", sub: "the hardware it's marketed for", cells: ["untested", "untested", "untested"] },
]

const FAILURE_MODES = [
  { name: "Repetition loops", desc: "the model gets stuck emitting the same block over and over." },
  {
    name: "Missing glue code",
    desc: "overall structure is right, but load-bearing lines — imports, wiring, error handling — are silently dropped.",
  },
  { name: "Rewrite churn", desc: "it keeps restarting the answer and never commits to a final version." },
]

const cellColour = (c: Cell) => (c === "good" ? GOOD : c === "bad" ? BAD : UNKNOWN)
const cellLabel = (c: Cell) => (c === "good" ? "verified fine" : c === "bad" ? "verified unreliable" : "not tested")

export function FieldNotes() {
  const [view, setView] = useState<"coverage" | "failures">("coverage")

  const W = 700
  const LABEL_W = 190
  const COL_W = (W - LABEL_W - 10) / COLS.length
  const ROW_H = 44
  const H = COVERAGE.length * ROW_H + 30

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">2bit-lite, the README&rsquo;s own field notes</span>
        <span className="font-mono text-[10px]" style={{ color: BAD }}>
          verified on hardware it isn&rsquo;t marketed for
        </span>
      </div>

      <div className="p-3 sm:p-4">
        <div className="flex flex-wrap gap-1.5">
          {(
            [
              ["coverage", "what was actually tested"],
              ["failures", "the 3 coding failure modes"],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              type="button"
              onClick={() => setView(k)}
              aria-pressed={view === k}
              className={cn(
                "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
                view === k
                  ? "border-foreground/30 bg-muted/50 text-foreground"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {view === "coverage" ? (
          <div className="mt-3 overflow-x-auto">
            <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" className="min-w-[660px] max-w-full">
              <title>
                {`A two-row grid. On a single H200, multi-turn chat and short text are verified fine, and long code generation is verified unreliable with three reproducible failure modes. On a 128 gigabyte MacBook Pro -- the hardware this build is marketed for -- none of the three workloads were tested at all.`}
              </title>
              {COLS.map((label, c) => (
                <text
                  key={label}
                  x={LABEL_W + c * COL_W + COL_W / 2}
                  y={10}
                  fontSize={7.5}
                  textAnchor="middle"
                  fill="currentColor"
                  fillOpacity={0.5}
                  fontFamily="ui-monospace, monospace"
                >
                  {label}
                </text>
              ))}
              {COVERAGE.map((r, ri) => {
                const y = 18 + ri * ROW_H
                return (
                  <g key={r.row}>
                    <text x={0} y={y + 16} fontSize={9.5} fill="currentColor" fillOpacity={0.9} fontFamily="ui-monospace, monospace">
                      {r.row}
                    </text>
                    <text x={0} y={y + 27} fontSize={7} fill="currentColor" fillOpacity={0.4} fontFamily="ui-monospace, monospace">
                      {r.sub}
                    </text>
                    {r.cells.map((c, ci) => (
                      <g key={ci}>
                        <rect
                          x={LABEL_W + ci * COL_W + 3}
                          y={y}
                          width={COL_W - 6}
                          height={30}
                          rx={4}
                          fill={cellColour(c)}
                          fillOpacity={c === "untested" ? 0.12 : 0.8}
                          stroke={c === "untested" ? UNKNOWN : "none"}
                          strokeOpacity={0.4}
                          strokeDasharray={c === "untested" ? "3 2" : undefined}
                        />
                        <text
                          x={LABEL_W + ci * COL_W + COL_W / 2}
                          y={y + 18}
                          fontSize={7.5}
                          textAnchor="middle"
                          fill={c === "untested" ? UNKNOWN : "white"}
                          fontFamily="ui-monospace, monospace"
                        >
                          {cellLabel(c)}
                        </text>
                      </g>
                    ))}
                  </g>
                )
              })}
            </svg>
          </div>
        ) : (
          <div className="mt-3 space-y-2">
            {FAILURE_MODES.map((f) => (
              <div key={f.name} className="rounded-lg border-l-2 bg-muted/20 py-2 pl-3 pr-3" style={{ borderColor: BAD }}>
                <div className="font-mono text-xs font-bold" style={{ color: BAD }}>
                  {f.name}
                </div>
                <div className="mt-0.5 text-[13px] leading-5 text-muted-foreground">{f.desc}</div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <div className="rounded-lg border bg-muted/20 px-3 py-2">
            <div className="font-mono text-[9px] uppercase tracking-wide text-muted-foreground">multi-turn chat, on H200</div>
            <div className="font-mono text-sm tabular-nums" style={{ color: GOOD }}>
              stable, ~10 tok/s
            </div>
          </div>
          <div className="rounded-lg border bg-muted/20 px-3 py-2">
            <div className="font-mono text-[9px] uppercase tracking-wide text-muted-foreground">recommended for coding instead</div>
            <div className="font-mono text-sm tabular-nums text-foreground">2-bit or higher</div>
          </div>
        </div>

        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          The README verifies 2bit-lite on <span className="text-foreground">one Nvidia H200</span> —
          not a Mac, despite the entire point of this build being Mac fit. What that verification
          finds is a clean split: chat and short-form text are{" "}
          <span style={{ color: GOOD }}>fine</span>, and{" "}
          <span style={{ color: BAD }}>long code generation reproduces three separate failure modes</span>.
          The README&rsquo;s own recommendation follows directly from its own data — reach for 2bit-lite
          only when nothing larger fits, and reach for 2-bit or higher for coding and long-horizon
          agentic work. That is precisely the domain the base model is built and marketed to be
          strong at.
        </p>
      </div>
    </figure>
  )
}
