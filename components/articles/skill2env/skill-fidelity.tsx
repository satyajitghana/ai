"use client"

import { useState } from "react"

import { mlog10 } from "@/lib/dmath"
import { cn } from "@/lib/utils"

// Does a compiled task still carry its Skill?
//
// The paper's retrieval probe, Section 3.3: take a generated task, use its
// instruction and rubric as a TF-IDF query over the 3.4k original SKILL.md
// documents, and see whether the true source Skill comes back. Chance is
// 1/3400 = 0.029%.
//
//   instruction + rubric   73.2% top-1   94.6% top-10
//   rubric alone           68.5% top-1
//
// The second row is the load-bearing one. If the rubric were generic agent
// advice — "write tests", "check your work" — it would retrieve nothing in
// particular. At 68.5% it identifies its own Skill almost as well as the full
// task does, which means it carries Skill-specific methodology rather than
// boilerplate.
//
// The bars are log-scaled because chance and the measured rates differ by three
// and a half orders of magnitude and a linear axis renders chance as nothing.
// mlog10 comes from lib/dmath: Math.log10 is an implementation-dependent
// approximation and these widths are serialised into the DOM during SSR.

interface Row {
  k: string
  label: string
  sub: string
  pct: number
  color: string
}

const ROWS: Row[] = [
  {
    k: "chance",
    label: "chance",
    sub: "one of 3.4k SKILL.md documents, drawn at random",
    pct: 0.029,
    color: "oklch(0.62 0.03 250)",
  },
  {
    k: "rubric",
    label: "rubric alone, top-1",
    sub: "just tests/rubric.md as the query — no instruction, no environment",
    pct: 68.5,
    color: "oklch(0.68 0.13 85)",
  },
  {
    k: "top1",
    label: "instruction + rubric, top-1",
    sub: "the true source Skill is the single best TF-IDF match",
    pct: 73.2,
    color: "oklch(0.58 0.15 155)",
  },
  {
    k: "top10",
    label: "instruction + rubric, top-10",
    sub: "the true source Skill is somewhere in the ten nearest",
    pct: 94.6,
    color: "oklch(0.58 0.15 155)",
  },
]

// Map a percentage onto [0, 1] over four decades, 0.01% to 100%.
const LO = mlog10(0.01)
const HI = mlog10(100)
function width(pct: number) {
  return ((mlog10(pct) - LO) / (HI - LO)) * 100
}

export function SkillFidelity() {
  const [sel, setSel] = useState("rubric")
  const r = ROWS.find((x) => x.k === sel) ?? ROWS[0]

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          does a compiled task still point back at its Skill?
        </span>
        <span className="font-mono text-[10px] text-muted-foreground">log scale &middot; four decades</span>
      </div>

      <div className="p-3 sm:p-4">
        <div className="space-y-1">
          {ROWS.map((x) => (
            <button
              key={x.k}
              type="button"
              onClick={() => setSel(x.k)}
              aria-pressed={x.k === sel}
              className={cn(
                "flex w-full cursor-pointer items-center gap-2 rounded-md border px-1.5 py-1 text-left transition-colors",
                x.k === sel ? "border-foreground/30 bg-muted/40" : "border-transparent hover:bg-muted/20",
              )}
            >
              <span className="w-40 shrink-0 truncate text-right font-mono text-[10px] text-foreground">
                {x.label}
              </span>
              <div className="h-4 flex-1 rounded-sm bg-muted/40">
                <div
                  className="h-4 rounded-sm"
                  style={{ width: `${width(x.pct)}%`, background: x.color, opacity: 0.9 }}
                />
              </div>
              <span
                className="w-14 shrink-0 text-right font-mono text-[10px] tabular-nums"
                style={{ color: x.color }}
              >
                {x.pct < 1 ? `${x.pct}%` : `${x.pct.toFixed(1)}%`}
              </span>
            </button>
          ))}
        </div>

        <div className="mt-3 rounded-lg border bg-muted/20 px-3 py-2.5">
          <div className="font-mono text-[11px]" style={{ color: r.color }}>
            {r.label} &middot; {r.pct}%
          </div>
          <div className="mt-1 text-sm leading-6 text-muted-foreground">{r.sub}</div>
        </div>

        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          The row worth staring at is the second. If the rubric were generic agent advice, it would retrieve
          nothing in particular from 3.4k documents. At 68.5% top-1 it identifies its own Skill almost as well
          as the whole task does, which is the paper&rsquo;s evidence that the compiler carried the
          practitioner&rsquo;s methodology forward rather than paraphrasing it into boilerplate. TF-IDF is a
          lexical measure, so some of that is shared vocabulary rather than shared method &mdash; but shared
          vocabulary at 2,300x chance is still a signal that the rubric is about
          <em> this</em> job and not about jobs in general.
        </p>
      </div>
    </figure>
  )
}
