"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"
import { DEPARTMENTS } from "./departments"
import { SKILLS } from "./skills-data"

// The tweet's six departments laid over the repository's actual skills. The
// grouping is ours (reasoned from each description); the dependence flags are
// measured (does model_run appear in the skill or its references).

const byName = new Map(SKILLS.map((s) => [s[0], s]))
const CORE = "oklch(0.70 0.15 235)"
const EXPERT = "oklch(0.74 0.16 55)"

export function DepartmentMap() {
  const [dep, setDep] = useState<string>("modeling")
  const mapped = new Set(DEPARTMENTS.flatMap((d) => d.skills))
  const coreAll = SKILLS.filter((s) => s[1] === "c")
  const expertAll = SKILLS.filter((s) => s[1] === "e")
  const coreMapped = coreAll.filter((s) => mapped.has(s[0])).length
  const expertMapped = expertAll.filter((s) => mapped.has(s[0])).length
  const d = DEPARTMENTS.find((x) => x.id === dep) ?? DEPARTMENTS[0]
  const rows = d.skills.map((n) => byName.get(n)).filter((r): r is NonNullable<typeof r> => !!r)

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex items-center justify-between border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>six departments, laid over the repository</span>
        <span className="text-muted-foreground/50">grouping reasoned, flags measured</span>
      </div>
      <div className="p-3 sm:p-4">
        <div className="mb-3 flex flex-wrap gap-1.5">
          {DEPARTMENTS.map((x) => (
            <button
              key={x.id}
              type="button"
              onClick={() => setDep(x.id)}
              className={cn(
                "rounded-md border px-2.5 py-1 font-mono text-xs transition-colors",
                dep === x.id ? "border-foreground/40 bg-muted text-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {x.label} <span className="opacity-60">{x.skills.length}</span>
            </button>
          ))}
        </div>
        <ul className="grid gap-1.5 sm:grid-cols-2">
          {rows.map((r) => (
            <li key={r[0]} className="flex items-center gap-2 rounded-md border bg-background px-2.5 py-1.5 font-mono text-[11px]">
              <span aria-hidden className="inline-block h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: r[1] === "c" ? CORE : EXPERT }} />
              <span className="min-w-0 flex-1 truncate text-foreground">{r[0]}</span>
              <span className="shrink-0 text-muted-foreground">
                {r[1] === "c" ? (r[5] ? "cloud, priced" : "local") : r[2]}
              </span>
            </li>
          ))}
        </ul>
        <div className="mt-3 font-mono text-[11px] text-muted-foreground">
          <span style={{ color: CORE }}>■</span> core, needs Scenario MCP · <span style={{ color: EXPERT }}>■</span> expert, drives an app on your machine.
          <br />
          Across all six departments: <span className="text-foreground">{coreMapped}</span> of {coreAll.length} core skills and{" "}
          <span className="text-foreground">{expertMapped}</span> of {expertAll.length} expert skills. The other{" "}
          <span className="text-foreground">{coreAll.length - coreMapped}</span> core skills are image, video, audio, brand and admin work.
        </div>
      </div>
    </figure>
  )
}
