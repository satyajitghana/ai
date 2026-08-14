"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// Four measurements of the same repository at 47f9438 (2026-08-13).
//
// companions  219 workspace package dirs under packages/*/*, and exactly 219
//             src/invariant.ts files — verified as a set difference in both
//             directions, zero unmatched. 35 of those call fail(); the other
//             184 are empty installs, which scripts/package-invariants.ts
//             requires to carry a "No runtime invariant:" comment explaining
//             why. So the count that matters is not 219 checks, it is 219
//             decisions.
//
// notes       .agents/notes/{implemented,archived,proposed,rejected}. Every
//             note has a .zh.md twin, so the raw .md count double-counts:
//             these are the English-only figures (507/143/25/11 = 686).
//
// pulse       git log --format=%ad --date=short | sort | uniq -c, 65 active
//             days from 2026-06-10 to 2026-08-13, 12,293 commits.
//
// prs         merge-commit subjects matching "Merge pull request #N from
//             <owner>/<prefix>/...", grouped by prefix. 984 merged PRs total.

type View = "companions" | "notes" | "pulse" | "prs"

const ACCENT = "oklch(0.60 0.15 255)"
const WARM = "oklch(0.68 0.13 85)"
const MUT = "oklch(0.62 0.03 250)"

// commits per day, 2026-06-10 .. 2026-08-13
const PULSE = [
  2, 24, 3, 8, 30, 34, 48, 33, 41, 39, 87, 73, 39, 23, 3, 14, 21, 2, 6, 30, 21,
  39, 46, 53, 177, 74, 129, 100, 118, 137, 73, 50, 77, 104, 528, 374, 150, 114,
  94, 385, 365, 277, 396, 383, 264, 136, 348, 595, 539, 589, 887, 672, 89, 171,
  206, 221, 245, 319, 324, 304, 347, 396, 473, 181, 163,
]
const PEAK = 887

const NOTES = [
  { k: "implemented", n: 507, c: ACCENT },
  { k: "archived", n: 143, c: MUT },
  { k: "proposed", n: 25, c: WARM },
  { k: "rejected", n: 11, c: "oklch(0.58 0.19 25)" },
]

const PRS = [
  { k: "worktree/", n: 210 },
  { k: "codex/", n: 209 },
  { k: "feat/", n: 104 },
  { k: "fix/", n: 92 },
  { k: "xtr/", n: 22 },
  { k: "docs/", n: 22 },
  { k: "feature/", n: 16 },
  { k: "agent/", n: 15 },
]

const TABS: { id: View; label: string }[] = [
  { id: "companions", label: "invariant companions" },
  { id: "notes", label: "design notes" },
  { id: "pulse", label: "commit pulse" },
  { id: "prs", label: "merged PRs" },
]

export function RepoDiscipline() {
  const [view, setView] = useState<View>("companions")

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">deepseek-harness @ 47f9438</span>
        <div className="flex flex-wrap gap-1">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setView(t.id)}
              aria-pressed={view === t.id}
              className={cn(
                "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
                view === t.id
                  ? "border-foreground/30 bg-muted/50 text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="p-3 sm:p-4">
        {view === "companions" ? (
          <div>
            <div className="flex h-12 overflow-hidden rounded-lg border">
              <div
                className="flex items-center justify-center font-mono text-[10px] text-white"
                style={{ width: `${(35 / 219) * 100}%`, background: ACCENT }}
              >
                35
              </div>
              <div
                className="flex items-center justify-center font-mono text-[10px]"
                style={{ width: `${(184 / 219) * 100}%`, background: "var(--muted)" }}
              >
                184
              </div>
            </div>
            <div className="mt-2 grid gap-1.5 sm:grid-cols-2">
              <div className="rounded-lg border bg-muted/15 px-2.5 py-1.5">
                <div className="font-mono text-[10px] text-muted-foreground">packages that enforce a check</div>
                <div className="font-mono text-sm tabular-nums" style={{ color: ACCENT }}>
                  35 of 219
                </div>
              </div>
              <div className="rounded-lg border bg-muted/15 px-2.5 py-1.5">
                <div className="font-mono text-[10px] text-muted-foreground">
                  documented no-ops — CI requires the reason
                </div>
                <div className="font-mono text-sm tabular-nums text-foreground">184 of 219</div>
              </div>
            </div>
            <div className="mt-2 rounded-lg border bg-muted/20 px-3 py-2 font-mono text-[10px] leading-5 text-muted-foreground">
              every package dir has exactly one src/invariant.ts — checked both directions, zero unmatched
              <br />
              an empty install must carry a &ldquo;No runtime invariant:&rdquo; comment or the build fails
              <br />
              a non-empty install must actually use its bound failure reporter
            </div>
          </div>
        ) : null}

        {view === "notes" ? (
          <div>
            <div className="flex h-12 overflow-hidden rounded-lg border">
              {NOTES.map((n) => (
                <div
                  key={n.k}
                  title={`${n.k}: ${n.n}`}
                  className="flex items-center justify-center font-mono text-[10px] text-white"
                  style={{ width: `${(n.n / 686) * 100}%`, background: n.c }}
                >
                  {n.n >= 100 ? n.n : ""}
                </div>
              ))}
            </div>
            <div className="mt-2 grid gap-1.5 sm:grid-cols-4">
              {NOTES.map((n) => (
                <div key={n.k} className="rounded-lg border bg-muted/15 px-2.5 py-1.5">
                  <div className="flex items-center gap-1.5 font-mono text-[10px] text-muted-foreground">
                    <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: n.c }} />
                    <span className="truncate">{n.k}</span>
                  </div>
                  <div className="font-mono text-sm tabular-nums text-foreground">{n.n}</div>
                </div>
              ))}
            </div>
            <div className="mt-2 rounded-lg border bg-muted/20 px-3 py-2 font-mono text-[10px] leading-5 text-muted-foreground">
              686 design notes in a proposed → implemented / rejected → archived lifecycle
              <br />
              11 of the rejected ones are kept on purpose: the record of what was decided against
            </div>
          </div>
        ) : null}

        {view === "pulse" ? (
          <div>
            <div className="flex h-28 items-end gap-[2px]">
              {PULSE.map((n, i) => (
                <div
                  key={i}
                  title={`${n} commits`}
                  className="flex-1 rounded-t-[1px]"
                  style={{
                    height: `${Math.max(2, (n / PEAK) * 100)}%`,
                    background: n === PEAK ? WARM : ACCENT,
                    opacity: n === PEAK ? 1 : 0.75,
                  }}
                />
              ))}
            </div>
            <div className="mt-1 flex justify-between font-mono text-[9px] text-muted-foreground">
              <span>2026-06-10</span>
              <span>peak 887 on 07-30</span>
              <span>2026-08-13</span>
            </div>
            <div className="mt-2 rounded-lg border bg-muted/20 px-3 py-2 font-mono text-[10px] leading-5 text-muted-foreground">
              12,293 commits across 65 active days · 37 authors · first commit to npm release in 61 days
            </div>
          </div>
        ) : null}

        {view === "prs" ? (
          <div>
            <div className="space-y-1">
              {PRS.map((p) => (
                <div key={p.k} className="flex items-center gap-2">
                  <span className="w-20 shrink-0 truncate text-right font-mono text-[10px] text-muted-foreground">
                    {p.k}
                  </span>
                  <div className="h-3.5 flex-1 rounded-sm bg-muted/40">
                    <div
                      className="h-3.5 rounded-sm"
                      style={{
                        width: `${(p.n / 210) * 100}%`,
                        background: p.k === "codex/" ? WARM : ACCENT,
                        opacity: p.k === "codex/" ? 1 : 0.7,
                      }}
                    />
                  </div>
                  <span className="w-8 shrink-0 text-right font-mono text-[10px] tabular-nums text-foreground">
                    {p.n}
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-2 rounded-lg border bg-muted/20 px-3 py-2 font-mono text-[10px] leading-5 text-muted-foreground">
              984 merged pull requests, grouped by branch prefix
              <br />
              209 of them came off codex/ branches — a lower bound on agent-authored work, not a total
            </div>
          </div>
        ) : null}

        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          These four are the same fact from different angles. A codebase taking twelve thousand commits in nine
          weeks, a good deal of it machine-written, cannot be held together by review attention alone — so the
          review got moved into the build. Every package must state whether it has a runtime invariant and why
          not if it does not; every
          design decision leaves a note, including the rejected ones; and 27 separate{" "}
          <span className="font-mono text-foreground">verify-*</span>{" "}scripts check things most repositories
          leave to habit, from dead documentation links to whether the eleven generated catalogs still match the
          code they describe.
        </p>
      </div>
    </figure>
  )
}
