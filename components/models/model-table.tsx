"use client"

import { useMemo, useState } from "react"

import { cn } from "@/lib/utils"
import { blendedPrice, type ModelRecord } from "@/data/models"

// The workhorse: a sortable, filterable table over every model in the snapshot.
// Click a column header to sort (numeric columns default high→low, then toggle);
// filter by origin and license. Missing values render as "—" and sort last.

type Col = {
  key: string
  label: string
  num?: boolean
  get: (m: ModelRecord) => number | string | null
  fmt?: (m: ModelRecord) => string
}

const COLS: Col[] = [
  { key: "name", label: "Model", get: (m) => m.name },
  { key: "provider", label: "Provider", get: (m) => m.provider },
  { key: "origin", label: "Origin", get: (m) => m.origin },
  { key: "license", label: "Weights", get: (m) => (m.openWeights ? "open" : "closed") },
  { key: "intelligence", label: "AAI", num: true, get: (m) => m.intelligence },
  { key: "priceIn", label: "$/M in", num: true, get: (m) => m.priceIn, fmt: (m) => (m.priceIn == null ? "—" : `$${m.priceIn}`) },
  { key: "priceOut", label: "$/M out", num: true, get: (m) => m.priceOut, fmt: (m) => (m.priceOut == null ? "—" : `$${m.priceOut}`) },
  { key: "blended", label: "$/M blend", num: true, get: (m) => blendedPrice(m), fmt: (m) => { const b = blendedPrice(m); return b == null ? "—" : `$${b}` } },
  { key: "speedTps", label: "tok/s", num: true, get: (m) => m.speedTps, fmt: (m) => (m.speedTps == null ? "—" : `${Math.round(m.speedTps)}`) },
  { key: "latencyS", label: "TTFT", num: true, get: (m) => m.latencyS, fmt: (m) => (m.latencyS == null ? "—" : `${m.latencyS}s`) },
  { key: "contextK", label: "Context", num: true, get: (m) => m.contextK, fmt: (m) => (m.contextK == null ? "—" : m.contextK >= 1000 ? `${m.contextK / 1000}M` : `${m.contextK}K`) },
  { key: "sizeB", label: "Size", num: true, get: (m) => m.sizeB, fmt: (m) => (m.sizeB == null ? "—" : m.sizeB >= 1000 ? `${(m.sizeB / 1000).toFixed(1)}T` : `${m.sizeB}B`) },
  { key: "released", label: "Released", get: (m) => m.released, fmt: (m) => m.released ?? "—" },
]

const ORIGIN_COLOR: Record<string, string> = {
  US: "oklch(0.6 0.16 255)",
  China: "oklch(0.62 0.19 20)",
}

export function ModelTable({ models }: { models: ModelRecord[] }) {
  const [sortKey, setSortKey] = useState("intelligence")
  const [asc, setAsc] = useState(false)
  const [origin, setOrigin] = useState<"all" | "US" | "China">("all")
  const [license, setLicense] = useState<"all" | "open" | "closed">("all")

  const col = COLS.find((c) => c.key === sortKey) ?? COLS[4]

  const rows = useMemo(() => {
    const filtered = models
      .filter((m) => origin === "all" || m.origin === origin)
      .filter((m) => license === "all" || (license === "open") === m.openWeights)
    return [...filtered].sort((a, b) => {
      const va = col.get(a)
      const vb = col.get(b)
      if (va == null && vb == null) return 0
      if (va == null) return 1 // nulls last
      if (vb == null) return -1
      if (typeof va === "number" && typeof vb === "number") return asc ? va - vb : vb - va
      return asc ? String(va).localeCompare(String(vb)) : String(vb).localeCompare(String(va))
    })
  }, [models, col, asc, origin, license])

  const setSort = (key: string, num?: boolean) => {
    if (key === sortKey) setAsc((v) => !v)
    else {
      setSortKey(key)
      setAsc(!num) // text asc, numbers desc by default
    }
  }

  const chip = (active: boolean) =>
    cn(
      "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-xs transition-colors",
      active ? "border-foreground/30 bg-muted/50 text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
    )

  return (
    <figure className="my-6 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">origin</span>
        {(["all", "US", "China"] as const).map((o) => (
          <button key={o} type="button" onClick={() => setOrigin(o)} className={chip(origin === o)}>{o}</button>
        ))}
        <span className="ml-1 font-mono text-xs text-muted-foreground">license</span>
        {(["all", "open", "closed"] as const).map((l) => (
          <button key={l} type="button" onClick={() => setLicense(l)} className={chip(license === l)}>{l}</button>
        ))}
        <span className="ml-auto font-mono text-[10px] text-muted-foreground tabular-nums">{rows.length} rows</span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse font-mono text-xs">
          <thead>
            <tr className="border-b text-muted-foreground">
              {COLS.map((c) => (
                <th
                  key={c.key}
                  onClick={() => setSort(c.key, c.num)}
                  className={cn("cursor-pointer select-none whitespace-nowrap px-2.5 py-2 font-normal hover:text-foreground", c.num ? "text-right" : "text-left")}
                >
                  {c.label}
                  {sortKey === c.key ? <span className="text-foreground">{asc ? " ↑" : " ↓"}</span> : null}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((m) => (
              <tr key={`${m.provider}-${m.name}`} className="border-b border-border/50 last:border-0 hover:bg-muted/20">
                {COLS.map((c) => {
                  const raw = c.fmt ? c.fmt(m) : (c.get(m) ?? "—")
                  if (c.key === "name")
                    return (
                      <td key={c.key} className="whitespace-nowrap px-2.5 py-1.5 font-medium text-foreground">
                        {m.article ? (
                          <a href={`/articles/${m.article}`} className="underline decoration-foreground/25 underline-offset-2 hover:decoration-foreground" title="Read the article">
                            {String(raw)}
                          </a>
                        ) : (
                          String(raw)
                        )}
                      </td>
                    )
                  if (c.key === "origin")
                    return (
                      <td key={c.key} className="whitespace-nowrap px-2.5 py-1.5">
                        <span style={{ color: ORIGIN_COLOR[m.origin] ?? "var(--muted-foreground)" }}>{m.origin}</span>
                      </td>
                    )
                  return (
                    <td key={c.key} className={cn("whitespace-nowrap px-2.5 py-1.5", c.num ? "text-right tabular-nums" : "", String(raw) === "—" ? "text-muted-foreground/40" : "text-muted-foreground")}>
                      {String(raw)}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </figure>
  )
}
