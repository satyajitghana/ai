"use client"

import { useMemo, useState } from "react"

import { cn } from "@/lib/utils"

import { EDGES, NODES, TOP_FAN_IN, TOP_FAN_OUT } from "./data"
import { Panel } from "./ui"

const short = (s: string) => s.replace(/^codex-/, "")
const INDEX = new Map(NODES.map((n, i) => [n[0] as string, i] as const))

function Bars({ rows, pick, onPick, tone }: { rows: readonly (readonly [string, number])[]; pick: string | null; onPick: (n: string) => void; tone: string }) {
  const max = rows[0][1]
  return (
    <ol className="space-y-1">
      {rows.map(([name, n]) => (
        <li key={name}>
          <button type="button" onClick={() => onPick(short(name))} className={cn("flex w-full items-center gap-2 rounded px-1.5 py-0.5 text-left text-[12px] hover:bg-muted", pick === short(name) && "bg-muted")}>
            <span className="w-32 shrink-0 truncate font-mono">{short(name)}</span>
            <span className="h-3 rounded-sm" style={{ width: `${(n / max) * 100}%`, maxWidth: "58%", minWidth: 6 }}><span className={cn("block h-full rounded-sm", tone)} /></span>
            <span className="tabular-nums text-muted-foreground">{n}</span>
          </button>
        </li>
      ))}
    </ol>
  )
}

export function DependencyHubs() {
  const [pick, setPick] = useState<string | null>("protocol")
  const info = useMemo(() => {
    if (!pick) return null
    const i = INDEX.get(pick)
    if (i === undefined) return null
    const dependants = EDGES.filter((e) => e[1] === i).map((e) => NODES[e[0]][0] as string)
    const deps = EDGES.filter((e) => e[0] === i).map((e) => NODES[e[1]][0] as string)
    return { dependants, deps }
  }, [pick])
  return (
    <Panel title="Hubs of the dependency graph" sub="584 edges between 117 crates, rebuilt from the Cargo.toml files">
      <div className="grid gap-5 md:grid-cols-2">
        <div>
          <div className="mb-1 text-sm font-medium">Used by the most crates (fan-in)</div>
          <Bars rows={TOP_FAN_IN} pick={pick} onPick={setPick} tone="bg-sky-500" />
        </div>
        <div>
          <div className="mb-1 text-sm font-medium">Depends on the most crates (fan-out)</div>
          <Bars rows={TOP_FAN_OUT} pick={pick} onPick={setPick} tone="bg-amber-500" />
        </div>
      </div>
      <div className="mt-4 rounded-lg border border-border bg-muted/40 p-3 text-[13px]">
        {info && pick ? (
          <>
            <div className="mb-1"><code className="font-mono font-medium">codex-{pick}</code>: {info.dependants.length} crates depend on it, and it depends on {info.deps.length}.</div>
            <div className="text-xs text-muted-foreground">
              <span className="font-medium text-foreground">Depended on by:</span> {info.dependants.slice(0, 24).join(", ")}{info.dependants.length > 24 ? `, and ${info.dependants.length - 24} more` : ""}
            </div>
            {info.deps.length ? (
              <div className="mt-1 text-xs text-muted-foreground"><span className="font-medium text-foreground">Depends on:</span> {info.deps.join(", ")}</div>
            ) : null}
          </>
        ) : (
          <span className="text-muted-foreground">Pick a crate in either list.</span>
        )}
      </div>
    </Panel>
  )
}
