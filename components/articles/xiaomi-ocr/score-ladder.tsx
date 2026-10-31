"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

import { BENCH } from "./data"

type Key = keyof typeof BENCH

// The paper's own tables, REPORTED, restricted to systems of 1.3B parameters or fewer so the ladder stays readable.
// The ranks use every row of each table, not just the ones drawn here.
export function ScoreLadder() {
  const [key, setKey] = useState<Key>("omni16")
  const t = BENCH[key]
  const lo = Math.floor(Math.min(...t.rows.map((r) => r.overall)) - 1)
  const hi = Math.ceil(Math.max(...t.rows.map((r) => r.overall)))
  const ours = t.rows.find((r) => r.ours)
  const idx = t.rows.findIndex((r) => r.ours)
  const above = idx > 0 ? t.rows[idx - 1] : undefined
  const below = idx < t.rows.length - 1 ? t.rows[idx + 1] : undefined

  return (
    <figure className="my-8 overflow-hidden rounded-md border">
      <div className="border-b px-3 py-2 font-mono text-xs text-muted-foreground">
        the paper&apos;s tables · reported, not re-run · systems up to 1.3B parameters · Overall score
      </div>
      <div className="flex flex-wrap items-center gap-1.5 border-b px-4 py-2.5">
        {(Object.keys(BENCH) as Key[]).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setKey(k)}
            aria-pressed={k === key}
            className={cn(
              "rounded border px-2 py-0.5 font-mono text-[11px] transition-colors",
              k === key ? "border-foreground/40 bg-muted text-foreground" : "text-muted-foreground hover:bg-muted"
            )}
          >
            {BENCH[k].name}
          </button>
        ))}
      </div>
      <div className="space-y-1.5 px-4 py-3">
        {t.rows.map((r) => (
          <div key={r.m} className="grid grid-cols-[10rem_1fr_6rem] items-center gap-2 font-mono text-[11px]">
            <span className={cn("truncate", r.ours && "font-semibold text-foreground")}>
              {r.m === "Ours" ? "Xiaomi-OCR-0" : r.m} <span className="text-muted-foreground">{r.size}</span>
            </span>
            <div className="h-2.5 overflow-hidden rounded bg-muted">
              <div
                className="h-full"
                style={{
                  width: `${(((r.overall - lo) / (hi - lo)) * 100).toFixed(1)}%`,
                  background: r.ours ? "oklch(0.6 0.15 175)" : r.b < 1 ? "oklch(0.62 0.04 250)" : "oklch(0.75 0.03 250)",
                }}
              />
            </div>
            <span className="text-right tabular-nums">{r.overall.toFixed(2)}</span>
          </div>
        ))}
      </div>
      <p className="border-t px-4 py-2 text-[11px] leading-relaxed text-muted-foreground">
        Rank {t.rank} of {t.counted} rows overall, and {t.rankUnder1B} of {t.underCount} among the rows under 1B parameters.
        {ours && above && ` ${(above.overall - ours.overall).toFixed(2)} behind ${above.m} (${above.size}).`}
        {ours && below && ` ${(ours.overall - below.overall).toFixed(2)} ahead of ${below.m} (${below.size}).`} The bar axis starts at {lo}, not zero.
      </p>
    </figure>
  )
}
