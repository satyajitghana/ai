"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"

import { LOD_COUNTS, SPZ_BYTES, SPLATS } from "./data"

// Price list x file size. Credits: 300 per recorded scan minute, 900 minimum
// (reported by SpAItial via Radiance Fields). Standard 7,500 credits a month,
// Pro 15,000. Bytes per splat: 119,247,965 / 7,276,512 measured on the level-0
// SPZ; the lower levels are that same figure applied to their counts, which is
// an estimate (reasoned), not a download.

const BPS = SPZ_BYTES / SPLATS
const mb = (b: number) => (b / 1e6).toFixed(0)

export function CreditMeter() {
  const [min, setMin] = useState(4)
  const credits = Math.max(900, 300 * min)
  const std = (credits / 7500) * 100
  const pro = (credits / 15000) * 100
  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">price list · reported, arithmetic mine</span>
        <span className="font-mono text-xs">
          {min} min → {credits.toLocaleString("en-US")} credits
        </span>
      </div>
      <div className="space-y-3 p-4">
        <label className="flex items-center gap-3 font-mono text-xs text-muted-foreground">
          <span className="whitespace-nowrap">scan minutes</span>
          <Range min={1} max={25} step={1} value={min} onChange={(e) => setMin(Number(e.target.value))} />
        </label>
        {[
          { n: "Standard (7,500 credits, non-commercial)", v: std },
          { n: "Pro (15,000 credits, commercial)", v: pro },
        ].map((r) => (
          <div key={r.n}>
            <div className="mb-1 flex justify-between font-mono text-xs">
              <span>{r.n}</span>
              <span>{r.v.toFixed(0)}% of a month</span>
            </div>
            <div className="h-2.5 rounded bg-muted">
              <div className="h-full rounded" style={{ width: `${Math.min(100, r.v)}%`, background: "oklch(0.62 0.16 35)" }} />
            </div>
          </div>
        ))}
        <table className="w-full font-mono text-xs">
          <thead>
            <tr className="text-left text-muted-foreground">
              <th className="py-1">LOD</th>
              <th>splats</th>
              <th>SPZ size at {BPS.toFixed(1)} B/splat</th>
            </tr>
          </thead>
          <tbody>
            {LOD_COUNTS.map((c, i) => (
              <tr key={i} className="border-t">
                <td className="py-1">{i}</td>
                <td>{c.toLocaleString("en-US")}</td>
                <td>
                  {i === 0 ? `${mb(SPZ_BYTES)} MB (measured)` : `~${mb(c * BPS)} MB (estimate)`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </figure>
  )
}
