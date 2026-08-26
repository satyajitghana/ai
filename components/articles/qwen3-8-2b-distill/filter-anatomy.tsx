"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// The two lm-evaluation-harness filters that produce the two columns on the
// Empero model cards, running for real on sample generations.
//
// Both regexes are copied verbatim out of
// lm_eval/tasks/gsm8k/gsm8k-cot.yaml (metadata version 3.0):
//
//   filter_list:
//   - filter:
//     - function: regex
//       regex_pattern: The answer is (\-?[0-9\.\,]+).
//     - function: take_first
//     name: strict-match
//   - filter:
//     - function: regex
//       group_select: -1
//       regex_pattern: (-?[$0-9.,]{2,})|(-?[0-9]+)
//     - function: take_first
//     name: flexible-extract
//
// The important line is `group_select: -1`. lm_eval's RegexFilter does
// `match = self.regex.findall(resp); match = match[self.group_select]`, so
// group_select -1 means "the LAST match anywhere in the generation". That is
// what "flexible" means here. It is not a superset of strict-match: strict-match
// looks for a specific sentence and takes the FIRST one (group_select defaults
// to 0), flexible-extract takes the last number in the output regardless of
// what the model was doing when it wrote it.
//
// `take_first` is a separate filter that picks the first of N sampled responses;
// with `repeats: 1` it is a no-op. It has nothing to do with which match wins.
//
// The comparison afterwards is exact_match with
//   regexes_to_ignore: [",", "\$", "(?s).*#### ", "\.$"]  and ignore_case: true
// which is why the normalise() below strips commas, dollar signs and a trailing
// period before comparing.
//
// The three sample generations are written by me to isolate the three regimes.
// The extraction you see is not annotated by hand: the regexes below run on the
// text at render time and the highlights are wherever they land.

const OK = "oklch(0.55 0.16 155)"
const BAD = "oklch(0.58 0.19 27)"
const STRICT = "oklch(0.60 0.15 255)"
const FLEX = "oklch(0.68 0.13 85)"
const MUTED = "oklch(0.62 0.03 250)"

const STRICT_SRC = "The answer is (\\-?[0-9\\.\\,]+)."
const FLEX_SRC = "(-?[$0-9.,]{2,})|(-?[0-9]+)"

type Sample = { k: string; label: string; gold: string; text: string; why: string }

const SAMPLES: Sample[] = [
  {
    k: "past",
    label: "talks past the answer",
    gold: "8",
    why: "The model is right, says so in the required sentence, and then keeps talking. strict-match takes the first “The answer is N”; flexible-extract takes the last number in the whole generation, which by then is a number from the sanity check.",
    text:
      "Olivia started with 23 dollars. Five bagels at 3 dollars each cost 5 * 3 = 15 dollars. " +
      "So 23 - 15 = 8. The answer is 8.\n" +
      "Checking that: 5 bagels at 3 dollars is 15 dollars of spending, and 23 - 15 leaves 8, " +
      "so she keeps roughly a third of the 23 she walked in with.",
  },
  {
    k: "clean",
    label: "stops at the answer",
    gold: "8",
    why: "The shape a distilled chat model produces: reason inside <think>, state the result once, stop. Both filters land on the same token, so both columns report the same score. This is what the student looks like on GSM8K, where strict and flexible are both 0.640 to three decimals.",
    text:
      "<think>\nOlivia starts with 23 dollars. Five bagels at 3 dollars each is 5 * 3 = 15. " +
      "23 - 15 = 8.\n</think>\n\nShe has 8 dollars left. The answer is 8.",
  },
  {
    k: "silent",
    label: "never says the magic sentence",
    gold: "8",
    why: "Correct arithmetic, correct conclusion, no “The answer is”. strict-match finds nothing and returns its fallback string, scoring zero. This is the failure mode that drags a base model's strict-match toward the floor — and on MMLU CoT it drags it to 0.004.",
    text:
      "Olivia had 23 dollars. The bagels cost 5 * 3 = 15 dollars in total. " +
      "Subtracting, 23 - 15 = 8 dollars remaining.",
  },
]

// lm_eval RegexFilter, group_select = 0 -> first match, -1 -> last match.
function runRegex(text: string, source: string, groupSelect: number) {
  const re = new RegExp(source, "g")
  const hits: { value: string; start: number; end: number }[] = []
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) {
    if (m[0] === "") {
      re.lastIndex += 1
      continue
    }
    // findall on a multi-group pattern yields tuples; lm_eval takes the first
    // non-empty group. A single-group pattern yields that group directly.
    const groups = m.slice(1)
    const picked = groups.length ? groups.find((g) => g) : m[0]
    if (picked === undefined) continue
    const at = m[0].indexOf(picked)
    const start = m.index + (at >= 0 ? at : 0)
    hits.push({ value: picked.trim(), start, end: start + picked.length })
  }
  if (!hits.length) return null
  return hits[groupSelect < 0 ? hits.length + groupSelect : groupSelect]
}

// exact_match with regexes_to_ignore [",", "\$", "(?s).*#### ", "\.$"] + ignore_case
function normalise(s: string) {
  return s
    .replace(/,/g, "")
    .replace(/\$/g, "")
    .replace(/[\s\S]*#### /, "")
    .replace(/\.$/, "")
    .trim()
    .toLowerCase()
}

export function FilterAnatomy() {
  const [si, setSi] = useState(0)
  const s = SAMPLES[si]

  const strict = runRegex(s.text, STRICT_SRC, 0)
  const flex = runRegex(s.text, FLEX_SRC, -1)
  const strictVal = strict ? strict.value : "[invalid]"
  const flexVal = flex ? flex.value : "[invalid]"
  const strictOk = normalise(strictVal) === normalise(s.gold)
  const flexOk = normalise(flexVal) === normalise(s.gold)

  // merge the two capture ranges into non-overlapping marked segments
  const ranges = [
    strict ? { ...strict, kind: "s" as const } : null,
    flex ? { ...flex, kind: "f" as const } : null,
  ]
    .filter((r): r is NonNullable<typeof r> => r !== null)
    .sort((a, b) => a.start - b.start)

  const merged: { start: number; end: number; kind: "s" | "f" | "b" }[] = []
  for (const r of ranges) {
    const last = merged[merged.length - 1]
    if (last && r.start < last.end) {
      last.end = Math.max(last.end, r.end)
      last.kind = "b"
    } else {
      merged.push({ start: r.start, end: r.end, kind: r.kind })
    }
  }

  const parts: React.ReactNode[] = []
  let cursor = 0
  merged.forEach((r, i) => {
    if (r.start > cursor) parts.push(<span key={`t${i}`}>{s.text.slice(cursor, r.start)}</span>)
    const col = r.kind === "s" ? STRICT : r.kind === "f" ? FLEX : OK
    parts.push(
      <span
        key={`m${i}`}
        className="rounded px-0.5 font-semibold"
        style={{ color: col, backgroundColor: `color-mix(in oklch, ${col} 15%, transparent)` }}
      >
        {s.text.slice(r.start, r.end)}
      </span>,
    )
    cursor = r.end
  })
  if (cursor < s.text.length) parts.push(<span key="tail">{s.text.slice(cursor)}</span>)

  const W = 700
  const rows: {
    name: string
    src: string
    sel: string
    got: string
    ok: boolean
    col: string
  }[] = [
    { name: "strict-match", src: STRICT_SRC, sel: "group_select 0 · first", got: strictVal, ok: strictOk, col: STRICT },
    { name: "flexible-extract", src: FLEX_SRC, sel: "group_select -1 · last", got: flexVal, ok: flexOk, col: FLEX },
  ]

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          lm_eval · gsm8k_cot · both filters, run live · gold = {s.gold}
        </span>
        <span className="font-mono text-[10px]">
          <span style={{ color: strictOk ? OK : BAD }}>strict {strictOk ? "1" : "0"}</span>
          <span className="text-muted-foreground"> · </span>
          <span style={{ color: flexOk ? OK : BAD }}>flexible {flexOk ? "1" : "0"}</span>
        </span>
      </div>

      <div className="p-3 sm:p-4">
        <div className="flex flex-wrap gap-1.5">
          {SAMPLES.map((x, i) => (
            <button
              key={x.k}
              type="button"
              onClick={() => setSi(i)}
              aria-pressed={si === i}
              className={cn(
                "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
                si === i
                  ? "border-foreground/30 bg-muted/50 text-foreground"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {x.label}
            </button>
          ))}
        </div>

        <pre className="mt-3 overflow-x-auto whitespace-pre-wrap rounded-lg border bg-muted/25 px-3 py-2.5 font-mono text-[11.5px] leading-6 text-foreground">
          {parts}
        </pre>

        <div className="mt-3 overflow-x-auto">
          <svg viewBox={`0 0 ${W} 96`} width={W} height={96} role="img" className="min-w-[660px] max-w-full">
            <title>
              {`Two filter pipelines applied to the same generation. strict-match captures "${strictVal}" and scores ` +
                `${strictOk ? "1" : "0"}; flexible-extract captures "${flexVal}" and scores ${flexOk ? "1" : "0"}. ` +
                `The gold answer is ${s.gold}.`}
            </title>
            {rows.map((r, i) => {
              const y = 14 + i * 44
              return (
                <g key={r.name}>
                  <text x={12} y={y + 4} fontSize={8.5} fill={r.col} fontFamily="ui-monospace, monospace">
                    {r.name}
                  </text>
                  <rect x={12} y={y + 10} width={228} height={20} rx={3} fill="currentColor" fillOpacity={0.05} />
                  <text x={19} y={y + 23.5} fontSize={8} fill="currentColor" fillOpacity={0.75} fontFamily="ui-monospace, monospace">
                    {r.src}
                  </text>
                  <text x={250} y={y + 23.5} fontSize={8} fill={MUTED} fontFamily="ui-monospace, monospace">
                    →
                  </text>
                  <rect x={266} y={y + 10} width={132} height={20} rx={3} fill="currentColor" fillOpacity={0.05} />
                  <text x={273} y={y + 23.5} fontSize={8} fill="currentColor" fillOpacity={0.6} fontFamily="ui-monospace, monospace">
                    {r.sel}
                  </text>
                  <text x={408} y={y + 23.5} fontSize={8} fill={MUTED} fontFamily="ui-monospace, monospace">
                    →
                  </text>
                  <rect
                    x={424}
                    y={y + 10}
                    width={112}
                    height={20}
                    rx={3}
                    fill={r.col}
                    fillOpacity={r.got === "[invalid]" ? 0.06 : 0.16}
                  />
                  <text
                    x={480}
                    y={y + 23.5}
                    fontSize={9}
                    textAnchor="middle"
                    fill={r.got === "[invalid]" ? MUTED : r.col}
                    fontFamily="ui-monospace, monospace"
                  >
                    {r.got.length > 14 ? `${r.got.slice(0, 13)}…` : r.got}
                  </text>
                  <text x={548} y={y + 23.5} fontSize={8} fill={MUTED} fontFamily="ui-monospace, monospace">
                    vs {s.gold} →
                  </text>
                  <text
                    x={620}
                    y={y + 23.5}
                    fontSize={9}
                    fill={r.ok ? OK : BAD}
                    fontFamily="ui-monospace, monospace"
                  >
                    {r.ok ? "1  correct" : "0  wrong"}
                  </text>
                </g>
              )
            })}
          </svg>
        </div>

        <p className="mt-3 rounded-lg border-l-2 px-3 py-2 text-sm leading-6 text-muted-foreground" style={{ borderColor: MUTED }}>
          {s.why}
        </p>

        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          The word &ldquo;flexible&rdquo; makes it sound like a relaxed version of strict-match — same
          rule, more forgiving. It is not. They are two unrelated extraction rules that happen to be
          reported side by side.{" "}
          <span style={{ color: STRICT }}>strict-match</span> hunts for one specific sentence and takes
          the <em>first</em>{" "}one it finds anywhere in the generation.{" "}
          <span style={{ color: FLEX }}>flexible-extract</span> ignores sentences entirely and takes the{" "}
          <em>last</em>{" "}number-shaped substring in the output, because the task YAML sets{" "}
          <span className="font-mono text-[11px] text-foreground">group_select: -1</span>.
          <br />
          <br />
          So neither dominates the other, and which one flatters a model depends on how the model
          ends its answer rather than on whether it got the question right. A model that solves the
          problem and then talks for another sentence loses under flexible-extract. A model that
          solves the problem and never writes the sentence loses under strict-match. Distillation on
          chat traces fixes both habits at once — which is worth real money in production, and is not
          the same thing as having learned to reason.
        </p>
      </div>
    </figure>
  )
}
