"use client"

import { useState } from "react"

import { MONTHS, AREAS, PER_DAY } from "./data"
import { Chip, Panel, fmt } from "./ui"

// Commits per month and per day are counted from the 6,300-commit window (git log, 2026-05-19 to 2026-10-31);
// areas are the top-level paths touched in the last 300 commits (a commit can touch several).
export function RepoTempo() {
  const [v, setV] = useState<"month" | "day" | "area">("month")
  const rows = v === "month" ? MONTHS.map(([a, b]) => [a, b] as const) : v === "day" ? PER_DAY.slice(1, 6).map(([a, b]) => [String(a).slice(5), b] as const) : AREAS.map(([a, b]) => [String(a).replace("codex-rs/", ""), b] as const)
  const max = Math.max(...rows.map((r) => r[1]))
  return (
    <Panel title="How fast the repository moves" sub="commits in the history I could read">
      <div className="mb-3 flex flex-wrap gap-1.5">
        <Chip active={v === "month"} onClick={() => setV("month")}>per month, May to October</Chip>
        <Chip active={v === "day"} onClick={() => setV("day")}>per day, 26 to 30 October</Chip>
        <Chip active={v === "area"} onClick={() => setV("area")}>by area, last 300 commits</Chip>
      </div>
      <ul className="space-y-1">
        {rows.map(([k, n]) => (
          <li key={k} className="flex items-center gap-2 text-[12.5px]"><span className="w-40 shrink-0 font-mono">{k}</span><span className="h-4 rounded-sm bg-sky-500/60" style={{ width: `${(n / max) * 62}%`, minWidth: 3 }} /><span className="tabular-nums text-muted-foreground">{fmt(n)}</span></li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-muted-foreground">
        {v === "month" ? "6,300 commits since 19 May; September is the peak at 1,617. October is a partial month." : v === "day" ? "Between 45 and 79 commits a day on a normal weekday, from 67 distinct authors in the last 300 commits; the median commit touches 7 files." : "A commit can touch several areas. The engine and the terminal UI take most of the traffic; Guardian work shows up as three separate areas."}
      </p>
    </Panel>
  )
}
