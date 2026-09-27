"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"

// The DSPy recipe's shuffle, made visible. In the posted `to_kev()` the options
// are built as [correct, *distractors] and then shuffled with
// `random.Random(42).shuffle(options)` INSIDE the per-question loop. A fresh
// generator seeded with 42 produces the same permutation for every list of the
// same length, so the correct answer lands in the same slot for every question
// with that many options.
//
// SLOT[n] is where index 0 (the correct answer) lands for n options, computed
// with CPython 3.11's `random` (standard library only):
//   for n in range(3, 12):
//       o = list(range(n)); random.Random(42).shuffle(o); print(n, o.index(0))
// The recipe allows 2-10 distractors, so n runs from 3 to 11.

const SLOT: Record<number, number> = { 3: 1, 4: 3, 5: 4, 6: 4, 7: 5, 8: 6, 9: 7, 10: 8, 11: 8 }
const LETTERS = "ABCDEFGHIJK"
const ACCENT = "oklch(0.72 0.15 195)"

export function FixedSlot() {
  const [n, setN] = useState(4)
  const slot = SLOT[n]

  return (
    <figure className="my-8 overflow-hidden rounded-md border">
      <div className="border-b px-3 py-2 font-mono text-xs text-muted-foreground">
        random.Random(42).shuffle(options), re-seeded for every question
      </div>
      <div className="space-y-4 p-4">
        <label className="flex flex-wrap items-center gap-3 font-mono text-xs">
          <span className="text-muted-foreground">options in the question</span>
          <Range
            min={3}
            max={11}
            step={1}
            value={n}
            onChange={(e) => setN(Number(e.target.value))}
            accent={ACCENT}
            aria-label="Number of options in the question"
            className="w-40"
          />
          <span className="tabular-nums">
            {n} (1 correct + {n - 1} distractors)
          </span>
        </label>

        <div className="flex flex-wrap gap-1.5" aria-live="polite">
          {Array.from({ length: n }, (_, i) => (
            <div
              key={i}
              className="flex h-12 w-11 flex-col items-center justify-center rounded border font-mono text-xs"
              style={
                i === slot
                  ? { background: ACCENT, color: "var(--background)", borderColor: ACCENT }
                  : undefined
              }
            >
              <span className="font-semibold">{LETTERS[i]}</span>
              <span className="text-[9px] opacity-80">{i === slot ? "gold" : "wrong"}</span>
            </div>
          ))}
        </div>

        <p className="m-0 font-mono text-xs leading-5">
          Every generated question with {n} options has its correct answer at {LETTERS[slot]}, zero-based slot {slot}.
          Not usually: every time.
        </p>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[420px] border-collapse font-mono text-[11px]">
            <thead>
              <tr className="text-muted-foreground">
                <th className="py-1 pr-2 text-left font-normal">options</th>
                {Object.keys(SLOT).map((k) => (
                  <th key={k} className="px-1 py-1 text-center font-normal">
                    {k}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="py-1 pr-2 text-muted-foreground">gold slot</td>
                {Object.entries(SLOT).map(([k, v]) => (
                  <td
                    key={k}
                    className="px-1 py-1 text-center"
                    style={Number(k) === n ? { color: ACCENT, fontWeight: 700 } : undefined}
                  >
                    {LETTERS[v]}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </div>
      <figcaption className="border-t px-3 py-2 font-mono text-[11px] leading-5 text-muted-foreground">
        Slots computed with CPython 3.11&rsquo;s standard-library random. A model that sees option
        order can learn this table instead of the passage; one that scores each option in
        isolation cannot.
      </figcaption>
    </figure>
  )
}
