"use client"

// Where the 372 families sit, and how many of them come with any Lean at all.
// Counts are mine, from the release at commit adc7f1241: the discipline of each
// family is the \cataloguesection it sits under in overview.tex, the manuscript
// count is the number of PDF links under it in CONTENTS.md, and "Lean" means
// CONTENTS.md links a lean/docs/NNN.md page for the family. A Lean page can
// cover the headline theorem or only part of it; the article explains which.
//
// Dual-native: the prose next to this widget gives the totals and the two
// outliers (algebraic geometry and topology) the bars make visible.

import { useState } from "react"

type Row = { d: string; fam: number; mss: number; lean: number }

const ROWS: Row[] = [
  { d: "Theoretical computer science", fam: 40, mss: 73, lean: 32 },
  { d: "Combinatorics", fam: 37, mss: 50, lean: 33 },
  { d: "Algebraic and complex geometry", fam: 36, mss: 89, lean: 7 },
  { d: "Number theory", fam: 31, mss: 58, lean: 16 },
  { d: "Probability and statistical mechanics", fam: 29, mss: 105, lean: 19 },
  { d: "Differential geometry", fam: 29, mss: 49, lean: 15 },
  { d: "Mathematical physics", fam: 25, mss: 59, lean: 17 },
  { d: "Operator algebras", fam: 19, mss: 31, lean: 14 },
  { d: "Algebra", fam: 18, mss: 29, lean: 9 },
  { d: "Topology", fam: 18, mss: 26, lean: 3 },
  { d: "Real and complex analysis", fam: 16, mss: 26, lean: 9 },
  { d: "Partial differential equations", fam: 16, mss: 29, lean: 11 },
  { d: "Convex and metric geometry", fam: 15, mss: 30, lean: 13 },
  { d: "Group theory", fam: 14, mss: 22, lean: 12 },
  { d: "Dynamical systems and ergodic theory", fam: 12, mss: 19, lean: 9 },
  { d: "Functional analysis", fam: 11, mss: 19, lean: 10 },
  { d: "Mathematical logic", fam: 6, mss: 8, lean: 6 },
]

type Sort = "families" | "share"

export function ReleaseMap() {
  const [sort, setSort] = useState<Sort>("families")
  const rows = [...ROWS].sort((a, b) =>
    sort === "families" ? b.fam - a.fam : b.lean / b.fam - a.lean / a.fam,
  )
  const max = 40
  const total = ROWS.reduce((s, r) => s + r.fam, 0)
  const totalLean = ROWS.reduce((s, r) => s + r.lean, 0)

  return (
    <div className="my-8 rounded-lg border bg-muted/20 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="font-mono text-xs text-muted-foreground">
          families by discipline &middot; filled = has a Lean page
        </div>
        <div className="flex gap-1">
          {(["families", "share"] as Sort[]).map((s) => (
            <button
              key={s}
              type="button"
              aria-pressed={sort === s}
              onClick={() => setSort(s)}
              className={`rounded border px-2 py-0.5 font-mono text-[11px] ${
                sort === s ? "bg-foreground text-background" : "opacity-70 hover:opacity-100"
              }`}
            >
              sort by {s === "families" ? "size" : "Lean share"}
            </button>
          ))}
        </div>
      </div>

      <ul className="mt-3 space-y-1.5">
        {rows.map((r) => {
          const pct = Math.round((r.lean / r.fam) * 100)
          return (
            <li key={r.d} className="grid grid-cols-[minmax(0,11rem)_1fr_auto] items-center gap-2">
              <span className="truncate text-xs" title={r.d}>
                {r.d}
              </span>
              <span className="relative h-4 rounded-sm bg-muted" aria-hidden>
                <span
                  className="absolute inset-y-0 left-0 rounded-sm border border-emerald-600/50 bg-emerald-600/10"
                  style={{ width: `${(r.fam / max) * 100}%` }}
                />
                <span
                  className="absolute inset-y-0 left-0 rounded-sm bg-emerald-600/70"
                  style={{ width: `${(r.lean / max) * 100}%` }}
                />
              </span>
              <span className="w-28 text-right font-mono text-[11px] tabular-nums text-muted-foreground">
                {r.lean}/{r.fam} ({pct}%) &middot; {r.mss} mss
              </span>
            </li>
          )
        })}
      </ul>

      <p className="mt-3 text-xs leading-5 text-muted-foreground">
        {total} families in 722 manuscripts; {totalLean} families ({Math.round((totalLean / total) * 100)}%)
        link a Lean page. Algebraic and complex geometry (7 of 36) and topology (3 of 18) are
        the thin spots: mathlib has little of the machinery those proofs stand on.
      </p>
    </div>
  )
}
