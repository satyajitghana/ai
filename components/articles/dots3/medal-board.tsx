"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// IMO 2026 result, from dots' own write-up. Attribution matters here: the
// entrant was not dots3-note Preview as released but "an internal harness
// around a branch of dots3-note Preview" that generated proofs recursively and
// used tools to evaluate and improve them.
//
// Six problems, 7 points each, 42 total. The page counts are the ones listed
// in its "Solution overview" strip, and they are the most concrete thing on
// the page: they say how much writing each proof took, which is a proxy for
// how hard the model found it that no score out of 7 can show.
//
// Context numbers for the same competition: 666 contestants from 117
// countries, and seven human perfect scores.

type P = { id: string; pages: number; day: number; note?: string }

const PROBLEMS: P[] = [
  { id: "P1", pages: 3, day: 1 },
  { id: "P2", pages: 10, day: 1, note: "The longest proof by a wide margin — ten pages against a median of four and a half. Whatever P2 asked for, the model needed more than three times the writing it spent on P1 or P6 to make it airtight." },
  { id: "P3", pages: 6, day: 1, note: "The one the human graders singled out. A CMO gold medalist called the inductive approach \"remarkably ingenious and elegant,\" noting that contestants typically reduce it to a graph-connectivity argument instead." },
  { id: "P4", pages: 5, day: 2 },
  { id: "P5", pages: 4, day: 2 },
  { id: "P6", pages: 3, day: 2, note: "Traditionally the hardest slot of the competition, and one of the two shortest proofs here. Short does not mean easy — it means the model found a line of attack that did not need much writing." },
]

const TOTAL_PAGES = PROBLEMS.reduce((a, p) => a + p.pages, 0)
const MAXP = 10

const GOLD = "oklch(0.68 0.13 85)"
const ACCENT = "oklch(0.60 0.15 255)"

export function MedalBoard() {
  const [sel, setSel] = useState(1)
  const p = PROBLEMS[sel]

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">IMO 2026 · officially marked</span>
        <span className="font-mono text-[10px]" style={{ color: GOLD }}>
          42 / 42
        </span>
      </div>

      <div className="p-3 sm:p-4">
        <div className="grid grid-cols-6 gap-1.5">
          {PROBLEMS.map((x, i) => (
            <button
              key={x.id}
              type="button"
              onClick={() => setSel(i)}
              aria-pressed={i === sel}
              className={cn(
                "cursor-pointer rounded-lg border px-1.5 py-2 text-center transition-colors",
                i === sel ? "border-foreground/40 bg-muted/40" : "bg-muted/15 hover:border-foreground/20",
              )}
            >
              <div className="font-mono text-[11px] text-foreground">{x.id}</div>
              <div className="font-mono text-[10px]" style={{ color: GOLD }}>
                7/7
              </div>
              <div className="mt-1 flex h-10 items-end justify-center">
                <div
                  className="w-3 rounded-t-sm"
                  style={{ height: `${(x.pages / MAXP) * 100}%`, background: ACCENT }}
                />
              </div>
              <div className="font-mono text-[9px] text-muted-foreground">{x.pages}p</div>
            </button>
          ))}
        </div>

        <div className="mt-3 grid gap-1.5 sm:grid-cols-3">
          {[
            { k: "42 / 42", v: "perfect score, officially marked", c: GOLD },
            { k: "7 of 666", v: "humans who also scored 42", c: "var(--foreground)" },
            { k: `${TOTAL_PAGES} pages`, v: "of proof across six problems", c: ACCENT },
          ].map((s) => (
            <div key={s.v} className="rounded-lg border bg-muted/15 px-2.5 py-1.5">
              <div className="font-mono text-[10px] text-muted-foreground">{s.v}</div>
              <div className="font-mono text-sm tabular-nums" style={{ color: s.c }}>
                {s.k}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-2 rounded-lg border bg-muted/20 px-3 py-2.5">
          <div className="font-mono text-[11px] text-foreground">
            {p.id} · day {p.day} · {p.pages} pages · 7/7
          </div>
          <div className="mt-1 text-sm leading-6 text-muted-foreground">
            {p.note ??
              "Full marks, and a proof short enough that the model did not have to work hard to convince the graders."}
          </div>
        </div>

        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          666 contestants from 117 countries — records for both — and{" "}
          <span className="text-foreground">seven</span>{" "}of them scored 42. The page counts are the part of this
          worth staring at: these are proofs a human panel read and certified, not answers a checker compared
          against a key. Ten pages for P2 and three for P6 is a distribution of effort, and it does not match the
          usual difficulty ordering of the competition.
        </p>
      </div>
    </figure>
  )
}
