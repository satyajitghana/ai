"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { cn } from "@/lib/utils"

// The loop gate, at the resolution it actually has.
//
// loop_test.py ships in both Whittle repos and is standard library only, so the
// section sizes are readable off the source:
//
//   P1     = [12 single-turn enumeration prompts]      x seeds (1, 2, 3)  = 36
//   STRUCT = [6 SQL / HTML / YAML / CSS prompts]       x seeds (1, 2, 3)  = 18
//   CONVOS = [2 scripts of 7 turns]                    x seeds (1, 2)     = 28
//   late   = turns 5, 6, 7 of those                                       = 12
//
// A generation is FAILED when any of rep4 > 0.15, duplicate lines > 0.20,
// repeated line openers > 0.40, or the answer is under the word floor (25 words
// single-turn, 60 structured). Sampler is fixed in the harness at temperature 0.7,
// top_p 0.8, top_k 20, and there is no repetition_penalty anywhere — so none of
// the published movement can be a sampler change.
//
// Published rates come from the model card's results table. Each is checked here
// against the counts the section can actually produce.

const FAIL = "oklch(0.58 0.19 27)"
const PASS = "oklch(0.55 0.16 155)"
const MARK = "oklch(0.68 0.13 85)"

type Section = {
  id: string
  name: string
  n: number
  shape: string
  floor: string
  marks: { label: string; pct: number }[]
}

const SECTIONS: Section[] = [
  {
    id: "single",
    name: "single turn",
    n: 36,
    shape: "12 prompts × 3 seeds",
    floor: "25-word floor",
    marks: [
      { label: "first release", pct: 69 },
      { label: "v2", pct: 11 },
      { label: "v2.1", pct: 8 },
    ],
  },
  {
    id: "struct",
    name: "structured output",
    n: 18,
    shape: "6 prompts × 3 seeds",
    floor: "60-word floor",
    marks: [
      { label: "baseline", pct: 75 },
      { label: "v2", pct: 39 },
      { label: "v2.1", pct: 22 },
    ],
  },
  {
    id: "multi",
    name: "multi turn, all turns",
    n: 28,
    shape: "2 conversations × 2 seeds × 7 turns",
    floor: "25-word floor",
    marks: [
      { label: "first release", pct: 64 },
      { label: "v2", pct: 7 },
      { label: "v2.1", pct: 7 },
    ],
  },
  {
    id: "late",
    name: "late turn, 5th onward",
    n: 12,
    shape: "3 turns × 2 conversations × 2 seeds",
    floor: "25-word floor",
    marks: [
      { label: "first release", pct: 56 },
      { label: "v2", pct: 17 },
      { label: "v2.1", pct: 8 },
    ],
  },
]

// nearest achievable count for a published percentage, and whether it lands on it
function snap(pct: number, n: number) {
  let best = 0
  for (let c = 0; c <= n; c++) {
    if (Math.abs((100 * c) / n - pct) < Math.abs((100 * best) / n - pct)) best = c
  }
  const exact = Math.round((100 * best) / n) === pct
  return { count: best, exact }
}

export function GateResolution() {
  const [sid, setSid] = useState("single")
  const [failed, setFailed] = useState(3)

  const sec = SECTIONS.find((s) => s.id === sid) ?? SECTIONS[0]
  const n = sec.n
  const f = Math.min(failed, n)
  const rate = (100 * f) / n

  const W = 700
  const X0 = 44
  const XW = W - X0 - 22
  const cell = Math.min(24, XW / n)
  const cw = cell - 3
  const gridW = cell * n
  const gx = X0 + (XW - gridW) / 2
  const px = (p: number) => X0 + (p / 100) * XW

  // merge marks that land on the same count so labels cannot stack
  const grouped = new Map<number, { labels: string[]; pcts: number[]; exact: boolean }>()
  for (const m of sec.marks) {
    const s = snap(m.pct, n)
    const g = grouped.get(s.count) ?? { labels: [], pcts: [], exact: s.exact }
    g.labels.push(m.label)
    g.pcts.push(m.pct)
    g.exact = g.exact && s.exact
    grouped.set(s.count, g)
  }
  const marks = [...grouped.entries()]
    .map(([count, g]) => ({ count, ...g }))
    .sort((a, b) => a.count - b.count)

  const offLadder = marks.filter((m) => !m.exact)

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          loop_test.py · {sec.shape} = {n} generations
        </span>
        <span className="font-mono text-[10px]" style={{ color: f === 0 ? PASS : FAIL }}>
          {f} of {n} FAILED = {rate.toFixed(1)}% · one generation is{" "}
          {(100 / n).toFixed(1)} points
        </span>
      </div>

      <div className="p-3 sm:p-4">
        <div className="flex flex-wrap gap-1.5">
          {SECTIONS.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => {
                setSid(s.id)
                setFailed(Math.min(failed, s.n))
              }}
              aria-pressed={sid === s.id}
              className={cn(
                "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
                sid === s.id
                  ? "border-foreground/30 bg-muted/50 text-foreground"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {s.name}
            </button>
          ))}
        </div>

        <div className="mt-3 overflow-x-auto">
          <svg
            viewBox={`0 0 ${W} 150`}
            width={W}
            height={150}
            role="img"
            className="min-w-[660px] max-w-full"
          >
            <title>
              {`The ${sec.name} section holds ${n} generations, so its failure rate can only take ${n + 1} values. ${f} failures reads as ${rate.toFixed(1)} percent, and one generation moves the number by ${(100 / n).toFixed(1)} points.`}
            </title>

            {Array.from({ length: n }, (_, i) => (
              <rect
                key={i}
                x={gx + i * cell}
                y={12}
                width={cw}
                height={22}
                rx={2}
                fill={i < f ? FAIL : PASS}
                fillOpacity={i < f ? 0.85 : 0.32}
              />
            ))}
            <text
              x={gx}
              y={48}
              fontSize={7.5}
              fill="currentColor"
              fillOpacity={0.5}
              fontFamily="ui-monospace, monospace"
            >
              one square = one generation · {sec.floor} counts as a failure too
            </text>

            {/* the ladder of achievable rates */}
            <line x1={X0} y1={106} x2={X0 + XW} y2={106} stroke="currentColor" strokeOpacity={0.3} />
            {Array.from({ length: n + 1 }, (_, c) => (
              <line
                key={c}
                x1={px((100 * c) / n)}
                y1={106}
                x2={px((100 * c) / n)}
                y2={112}
                stroke="currentColor"
                strokeOpacity={0.3}
              />
            ))}
            <line
              x1={px(rate)}
              y1={100}
              x2={px(rate)}
              y2={118}
              stroke={FAIL}
              strokeWidth={1.6}
            />
            {[0, 25, 50, 75, 100].map((p) => (
              <text
                key={p}
                x={px(p)}
                y={128}
                fontSize={7.5}
                textAnchor="middle"
                fill="currentColor"
                fillOpacity={0.45}
                fontFamily="ui-monospace, monospace"
              >
                {p}%
              </text>
            ))}
            <text
              x={X0}
              y={142}
              fontSize={7.5}
              fill="currentColor"
              fillOpacity={0.5}
              fontFamily="ui-monospace, monospace"
            >
              every rate this section can report — {n + 1} of them, and nothing in between
            </text>

            {marks.map((m, i) => {
              const p = (100 * m.count) / n
              const ty = i % 2 === 0 ? 84 : 68
              const anchor = p < 12 ? "start" : p > 88 ? "end" : "middle"
              const tx = p < 12 ? px(p) - 4 : p > 88 ? px(p) + 4 : px(p)
              return (
                <g key={m.count}>
                  <line
                    x1={px(p)}
                    y1={ty + 4}
                    x2={px(p)}
                    y2={102}
                    stroke={m.exact ? MARK : FAIL}
                    strokeOpacity={0.6}
                    strokeDasharray={m.exact ? undefined : "3 2"}
                  />
                  <text
                    x={tx}
                    y={ty}
                    fontSize={8}
                    textAnchor={anchor}
                    fill={m.exact ? MARK : FAIL}
                    fontFamily="ui-monospace, monospace"
                    fontWeight={600}
                  >
                    {m.labels.join(" & ")} {m.pcts[0]}%
                    {m.exact ? ` = ${m.count}/${n}` : ` ✗ nearest ${m.count}/${n}`}
                  </text>
                </g>
              )
            })}
          </svg>
        </div>

        <div className="mt-2 flex items-center gap-2">
          <span className="w-28 shrink-0 whitespace-nowrap font-mono text-[10px] text-muted-foreground">
            failed generations
          </span>
          <Range
            min={0}
            max={n}
            step={1}
            value={f}
            onChange={(e) => setFailed(Number(e.target.value))}
            className="flex-1"
            aria-label="how many of this section's generations tripped the failure test"
            accent={FAIL}
          />
          <span className="w-16 shrink-0 text-right font-mono text-[10px] tabular-nums text-foreground">
            {f}/{n}
          </span>
        </div>

        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          The gate is public, the seeds are fixed, and the sampler is hard-coded at{" "}
          <span className="font-mono text-[11px] text-foreground">
            temperature 0.7, top_p 0.8, top_k 20
          </span>{" "}
          with no repetition penalty anywhere in it. So the reported movement is not a settings
          change — that whole line of suspicion is closed off by reading the file. What the file also
          shows is the resolution.{" "}
          <span className="text-foreground">
            &ldquo;69% → 8%&rdquo; is 25 of 36 generations becoming 3 of 36
          </span>
          , and &ldquo;11% → 8%&rdquo; between v2 and v2.1 is one generation.
          {offLadder.length ? (
            <>
              <br />
              <br />
              This section has a number that does not fit.{" "}
              <span style={{ color: FAIL }}>
                {offLadder[0].labels.join(" & ")} {offLadder[0].pcts[0]}%
              </span>{" "}
              is not one of the {n + 1} values {n} generations can produce — which means it was
              measured on a differently shaped run than the gate the repository ships.
            </>
          ) : null}
        </p>
      </div>
    </figure>
  )
}
