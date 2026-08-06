"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// The real commit history of PrimeIntellect-ai/prime-agent, measured from a full
// clone (not a shallow one). Every number here came out of `git log` on the
// repository itself:
//
//   git rev-list --count HEAD              -> 4473
//   git log --format='%an' | sort -u | wc  -> 231
//   git log --author=badlogic --oneline    -> 3099
//   git log --format='%ad' --date=format:'%Y-%m' | sort | uniq -c
//
// The point of drawing it: the repo is twelve months old and mostly written by
// one person (Mario Zechner, pi-mono) before Prime Intellect took stewardship in
// May 2026. A changelog alone cannot show you that.

const ZECH = "oklch(0.62 0.03 250)"
const REST = "oklch(0.60 0.15 255)"

type Month = { key: string; label: string; total: number; zechner: number }

const MONTHS: Month[] = [
  { key: "2025-08", label: "aug 25", total: 85, zechner: 85 },
  { key: "2025-09", label: "sep", total: 53, zechner: 53 },
  { key: "2025-10", label: "oct", total: 129, zechner: 129 },
  { key: "2025-11", label: "nov", total: 280, zechner: 259 },
  { key: "2025-12", label: "dec", total: 872, zechner: 764 },
  { key: "2026-01", label: "jan 26", total: 1224, zechner: 853 },
  { key: "2026-02", label: "feb", total: 377, zechner: 283 },
  { key: "2026-03", label: "mar", total: 418, zechner: 318 },
  { key: "2026-04", label: "apr", total: 456, zechner: 304 },
  { key: "2026-05", label: "may", total: 146, zechner: 51 },
  { key: "2026-06", label: "jun", total: 184, zechner: 0 },
  { key: "2026-07", label: "jul", total: 192, zechner: 0 },
  { key: "2026-08", label: "aug*", total: 57, zechner: 0 },
]

const MAX = 1224
const HANDOVER = "2026-05" // Zechner's last commit 2026-05-08; PI's first 2026-05-21

export function CommitHistory() {
  const [sel, setSel] = useState<string>("2026-01")

  const month = MONTHS.find((m) => m.key === sel)!
  const others = month.total - month.zechner

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          prime-agent · commits per month · full clone
        </span>
        <span className="font-mono text-[10px] text-muted-foreground">
          4,473 commits · 231 authors · 48 tags
        </span>
      </div>

      <div className="p-3 sm:p-4">
        <div className="mb-3 flex flex-wrap items-center gap-4 font-mono text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: ZECH }} /> Mario Zechner
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: REST }} /> everyone else
          </span>
        </div>

        <div className="flex items-end gap-1 sm:gap-1.5" style={{ height: 168 }}>
          {MONTHS.map((m) => {
            const on = m.key === sel
            const hZ = (m.zechner / MAX) * 150
            const hO = ((m.total - m.zechner) / MAX) * 150
            return (
              <button
                key={m.key}
                type="button"
                onClick={() => setSel(m.key)}
                aria-pressed={on}
                title={`${m.label}: ${m.total} commits`}
                className={cn(
                  "group flex h-full flex-1 cursor-pointer flex-col justify-end rounded-sm transition-opacity",
                  on ? "opacity-100" : "opacity-70 hover:opacity-100",
                )}
              >
                <div
                  className="w-full rounded-t-sm"
                  style={{ height: Math.max(hO, m.total > m.zechner ? 2 : 0), background: REST }}
                />
                <div
                  className={cn("w-full", hO > 0 ? "" : "rounded-t-sm")}
                  style={{ height: Math.max(hZ, m.zechner > 0 ? 2 : 0), background: ZECH }}
                />
                <div
                  className={cn(
                    "mt-1.5 h-px w-full",
                    on ? "bg-foreground/50" : "bg-transparent",
                    m.key === HANDOVER ? "bg-foreground/25" : "",
                  )}
                />
              </button>
            )
          })}
        </div>

        <div className="mt-1 flex gap-1 sm:gap-1.5">
          {MONTHS.map((m) => (
            <div
              key={m.key}
              className={cn(
                "flex-1 truncate text-center font-mono text-[9px]",
                m.key === sel ? "text-foreground" : "text-muted-foreground",
              )}
            >
              {m.label}
            </div>
          ))}
        </div>

        <div className="mt-3 rounded-lg border bg-muted/20 px-3 py-2.5 font-mono text-[11px]">
          <span className="text-foreground">{month.key}</span>
          <span className="text-muted-foreground">
            {" "}
            — {month.total.toLocaleString()} commits ·{" "}
          </span>
          <span style={{ color: ZECH }}>{month.zechner.toLocaleString()} Zechner</span>
          <span className="text-muted-foreground"> · </span>
          <span style={{ color: REST }}>{others.toLocaleString()} everyone else</span>
        </div>

        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          The repository is twelve months old, not three. Its first commit is Mario Zechner&rsquo;s monorepo setup on
          2025-08-09, and Zechner authored <span className="text-foreground">3,099 of the 4,473 commits</span>{" "}(69%)
          before his last one on 2026-05-08. Prime Intellect&rsquo;s first commit lands 2026-05-21. So the grey mass is{" "}
          <em>pi-mono</em>{" "}and the blue tail is Prime Agent: <span className="text-foreground">482 commits by 17
          authors</span>{" "}in the three months since the handover. Both readings of &ldquo;how mature is this&rdquo; are
          true, and they answer different questions. (*August 2026 is partial — measured through the 6th.)
        </p>
      </div>
    </figure>
  )
}
