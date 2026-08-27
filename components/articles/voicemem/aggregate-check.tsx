"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// Checking the abstract's own headline number against the source.
//
// arXiv's HTML abstract page, its og:description, and its citation_abstract
// meta tag (https://arxiv.org/abs/2608.26005) all read: "...improves the
// aggregate score by 4.29 points over the previous best system." The
// submitted PDF -- rendered from the same arXiv id -- prints a different
// number in the same sentence: "...improves the aggregate score by 1.89
// points over the previous best system." (page 1, Abstract, both checked by
// rendering the PDF to an image and reading the pixels directly.)
//
// Table 2 (persona memory, 11 sub-categories, LLM-judge avg.) resolves it:
//
//   MemOS (strongest baseline)                    72.27
//   VoiceMem, replies via GPT-4o-mini             74.16   (+1.89 over MemOS)
//   VoiceMem, replies via its own fine-tuned model 76.56   (+4.29 over MemOS)
//
// All baselines in Table 2 use GPT-4o-mini as the response model (the paper's
// own footnote). So 1.89 is the matched-generator delta -- the fair number,
// and the one the printed abstract states. 4.29 is real too, but it swaps in
// VoiceMem's own fine-tuned reply model against baselines that don't get one
// -- and it is the number that made it into arXiv's indexed abstract, which
// is what Semantic Scholar, Google Scholar, and social-card previews show.

const BASELINE = "oklch(0.62 0.03 250)"
const FAIR = "oklch(0.55 0.16 155)"
const UNFAIR = "oklch(0.68 0.13 85)"

type Mode = "fair" | "unfair"

const FLOOR = 70
const CEIL = 78

const W = 700
const H = 210
const BAR_W = 92
// 90 put adjacent bar centers 90px apart while each sub-label below them
// ("replies via GPT-4o-mini", "replies via its own model") runs to ~110px at
// this font size -- the two labels merged into one run of text. Widened
// enough that neighbouring sub-labels never come within a full character of
// each other at either bar's live value.
const GAP = 168
const X0 = 120
const BASE_Y = 158
const TOP_Y = 30

const val2y = (v: number) => BASE_Y - ((v - FLOOR) / (CEIL - FLOOR)) * (BASE_Y - TOP_Y)

export function AggregateCheck() {
  const [mode, setMode] = useState<Mode>("fair")

  const memos = { x: X0, v: 72.27, label: "MemOS", sub: "strongest baseline", c: BASELINE }
  const fair = { x: X0 + GAP, v: 74.16, label: "VoiceMem", sub: "replies via GPT-4o-mini", c: FAIR }
  const unfair = { x: X0 + GAP * 2, v: 76.56, label: "VoiceMem‡", sub: "replies via its own model", c: UNFAIR }

  const active = mode === "fair" ? fair : unfair
  const delta = (active.v - memos.v).toFixed(2)

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">persona memory, avg. of 11 sub-categories</span>
        <div className="flex gap-1.5">
          <button
            type="button"
            onClick={() => setMode("fair")}
            aria-pressed={mode === "fair"}
            className={cn(
              "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
              mode === "fair"
                ? "border-foreground/30 bg-muted/50 text-foreground"
                : "border-border text-muted-foreground hover:text-foreground",
            )}
          >
            printed abstract: +1.89
          </button>
          <button
            type="button"
            onClick={() => setMode("unfair")}
            aria-pressed={mode === "unfair"}
            className={cn(
              "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
              mode === "unfair"
                ? "border-foreground/30 bg-muted/50 text-foreground"
                : "border-border text-muted-foreground hover:text-foreground",
            )}
          >
            arXiv abstract page: +4.29
          </button>
        </div>
      </div>

      <div className="p-3 sm:p-4">
        <div className="overflow-x-auto">
          <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" className="min-w-[660px] max-w-full">
            <title>
              {`Three bars on a y-axis running from 70 to 78, not zero. MemOS scores 72.27. VoiceMem replying through GPT-4o-mini, the same generator every baseline uses, scores 74.16, a gap of 1.89 -- the number the submitted PDF's abstract states. VoiceMem replying through its own fine-tuned model scores 76.56, a gap of 4.29 -- the number arXiv's own indexed abstract page shows instead. Currently highlighting the ${mode === "fair" ? "1.89" : "4.29"} comparison.`}
            </title>

            <text x={14} y={20} fontSize={7} fill="currentColor" fillOpacity={0.4} fontFamily="ui-monospace, monospace">
              axis runs 70-78, not 0 — for legibility, not to flatter
            </text>
            <line x1={X0 - 40} y1={BASE_Y} x2={X0 + GAP * 2 + BAR_W} y2={BASE_Y} stroke="currentColor" strokeOpacity={0.2} />

            {[memos, fair, unfair].map((b) => {
              const isActive = b === active || b === memos
              const y = val2y(b.v)
              const dim = mode === "fair" ? b === unfair : b === fair
              return (
                <g key={b.label} opacity={dim ? 0.28 : 1}>
                  <rect x={b.x} y={y} width={BAR_W} height={BASE_Y - y} rx={3} fill={b.c} fillOpacity={isActive ? 0.85 : 0.55} />
                  <text x={b.x + BAR_W / 2} y={y - 8} textAnchor="middle" fontSize={9} fill={b.c} fontFamily="ui-monospace, monospace">
                    {b.v.toFixed(2)}
                  </text>
                  <text
                    x={b.x + BAR_W / 2}
                    y={BASE_Y + 16}
                    textAnchor="middle"
                    fontSize={8}
                    fill="currentColor"
                    fillOpacity={0.75}
                    fontFamily="ui-monospace, monospace"
                  >
                    {b.label}
                  </text>
                  <text
                    x={b.x + BAR_W / 2}
                    y={BASE_Y + 27}
                    textAnchor="middle"
                    fontSize={6.5}
                    fill="currentColor"
                    fillOpacity={0.42}
                    fontFamily="ui-monospace, monospace"
                  >
                    {b.sub}
                  </text>
                </g>
              )
            })}

            {/* bracket from MemOS to the active bar */}
            {(() => {
              const y1 = val2y(memos.v) - 18
              const y2 = val2y(active.v) - 18
              const topY = Math.min(y1, y2) - 14
              const x1 = memos.x + BAR_W / 2
              const x2 = active.x + BAR_W / 2
              const c = mode === "fair" ? FAIR : UNFAIR
              return (
                <g>
                  <path
                    d={`M ${x1} ${y1} L ${x1} ${topY} L ${x2} ${topY} L ${x2} ${y2}`}
                    fill="none"
                    stroke={c}
                    strokeWidth={1.3}
                    strokeOpacity={0.85}
                  />
                  <text x={(x1 + x2) / 2} y={topY - 6} textAnchor="middle" fontSize={9} fill={c} fontFamily="ui-monospace, monospace">
                    +{delta}
                  </text>
                </g>
              )
            })()}
          </svg>
        </div>

        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          Both bars on the right are real rows in Table 2 — this isn&rsquo;t a rounding slip. The
          gap depends entirely on which generator answers with the retrieved memory.{" "}
          <span style={{ color: FAIR }}>+1.89</span>{" "}holds the generator fixed at GPT-4o-mini, the
          same model every baseline in the table uses — the fair reading, and the one the PDF&rsquo;s
          printed abstract states.{" "}
          <span style={{ color: UNFAIR }}>+4.29</span>{" "}swaps in VoiceMem&rsquo;s own fine-tuned
          reply model, which no baseline gets to use — real, footnoted with a{" "}
          <span className="font-mono">&#8225;</span>{" "}in the table, but not a memory-quality
          comparison on its own.
          <br />
          <br />
          The catch is that arXiv&rsquo;s indexed abstract — the text behind{" "}
          <code>citation_abstract</code>, the page&rsquo;s <code>og:description</code>, and what
          Semantic Scholar and social-card previews show — carries the second number, not the
          first. Anyone citing the abstract without opening the PDF is citing a different claim than
          the paper actually prints.
        </p>
      </div>
    </figure>
  )
}
