"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { mlog10 } from "@/lib/dmath"
import { cn } from "@/lib/utils"

import { LAST, ROWS, XZ_ARCHIVE, type Row } from "./data"

// Bytes held after k snapshots, five ways, on a log axis from 10 MB to 10 GB. Every row is a byte count from the toy in
// public/articles/layerfs/toy_store.py over 157 commits of this site's own history; nothing here is LayerFS itself.
const LO = 7
const HI = 10

const SERIES: { key: keyof Row; name: string; note: string; color: string }[] = [
  { key: "plain", name: "plain copies", note: "every snapshot a full tree", color: "oklch(0.60 0.17 30)" },
  { key: "gzTar", name: "tar.gz each", note: "one compressed archive per snapshot", color: "oklch(0.62 0.12 70)" },
  { key: "hard", name: "hardlink farm", note: "identical files stored once, uncompressed", color: "oklch(0.62 0.12 200)" },
  { key: "toyFlat", name: "toy: chunks + flat dirs", note: "content-defined chunks, whole directory rewritten", color: "oklch(0.62 0.15 285)" },
  { key: "toyPaged", name: "toy: chunks + paged dirs", note: "directories split into pages of about 64 entries", color: "oklch(0.62 0.15 150)" },
]

function fmt(b: number): string {
  if (b >= 1e9) return `${(b / 1e9).toFixed(2)} GB`
  return `${(b / 1e6).toFixed(1)} MB`
}

function pos(b: number): number {
  return Math.min(100, Math.max(0, ((mlog10(b) - LO) / (HI - LO)) * 100))
}

export function SnapshotLedger() {
  const [i, setI] = useState(ROWS.length - 1)
  const row = ROWS[i]
  return (
    <figure className="my-8 overflow-hidden rounded-md border">
      <div className="border-b px-3 py-2 font-mono text-xs text-muted-foreground">
        bytes held after k snapshots · measured on a Python toy over this site&apos;s git history, not LayerFS
      </div>
      <div className="space-y-3 px-4 py-4">
        <label className="flex items-center gap-3 text-xs">
          <span className="w-28 shrink-0 font-mono text-muted-foreground">snapshots kept</span>
          <Range
            min={0}
            max={ROWS.length - 1}
            step={1}
            value={i}
            onChange={(e) => setI(Number(e.target.value))}
            aria-label="Number of snapshots kept"
            className="w-full"
          />
          <span className="w-12 shrink-0 text-right font-mono tabular-nums">{row.k}</span>
        </label>
        <div className="space-y-2.5">
          {SERIES.map((s) => {
            const v = row[s.key] as number
            return (
              <div key={s.key}>
                <div className="flex items-baseline justify-between font-mono text-[11px]">
                  <span>{s.name}</span>
                  <span className="tabular-nums">
                    {fmt(v)}
                    <span className="ml-2 text-muted-foreground">{(row.plain / v).toFixed(1)}x smaller</span>
                  </span>
                </div>
                <div
                  className="relative mt-0.5 h-3 overflow-hidden rounded bg-muted"
                  role="img"
                  aria-label={`${s.name}: ${fmt(v)} after ${row.k} snapshots`}
                >
                  <div className="h-full" style={{ width: `${pos(v).toFixed(2)}%`, background: s.color }} />
                </div>
                <div className="font-mono text-[10px] text-muted-foreground">{s.note}</div>
              </div>
            )
          })}
        </div>
        <div className="flex justify-between font-mono text-[10px] text-muted-foreground">
          <span>10 MB</span>
          <span>100 MB</span>
          <span>1 GB</span>
          <span>10 GB</span>
        </div>
      </div>
      <div className={cn("border-t px-4 py-3 font-mono text-[11px] text-muted-foreground")}>
        The axis is logarithmic, so equal distances are equal ratios. At 157 snapshots the logical size is {fmt(LAST.plain)}.
        One xz archive of the {`4,525`} distinct files is {fmt(XZ_ARCHIVE)}, smaller than every row here, and cannot be mounted.
        gzip and zlib stand in for zstd in every row.
      </div>
    </figure>
  )
}
