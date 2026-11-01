"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// Counted by the article's author from the 25 examples/*/scene.json files at commit 2a12a11 of rtmandreyev/construct.
// [scene, parts, parts verified, parts decorative, facts, facts verified, articulations]. Every other part is "inferred".
const ROWS: [string, number, number, number, number, number, number][] = [
  ["andromeda-galaxy", 153, 0, 0, 17, 10, 0],
  ["arturia-minifreak", 70, 1, 5, 27, 22, 0],
  ["aston-martin-db5", 105, 0, 1, 10, 9, 1],
  ["brass-orrery", 38, 0, 0, 20, 0, 0],
  ["duomo-di-milano", 174, 0, 2, 18, 14, 0],
  ["ferrari-f40", 118, 0, 0, 15, 11, 0],
  ["gothic-cathedral-nave", 72, 0, 2, 15, 0, 0],
  ["jackson-juggernaut-et7", 130, 0, 2, 41, 27, 4],
  ["leica-m3", 86, 0, 0, 31, 17, 2],
  ["netlogo-fire", 6, 3, 0, 15, 9, 0],
  ["netlogo-flocking", 6, 3, 0, 13, 7, 0],
  ["netlogo-viral-marketing", 83, 0, 0, 15, 0, 0],
  ["netlogo-wolf-sheep", 11, 7, 0, 13, 8, 0],
  ["neuschwanstein", 240, 0, 0, 10, 8, 0],
  ["omega-speedmaster-321", 64, 0, 0, 25, 14, 9],
  ["patek-philippe-5320g", 181, 0, 0, 57, 47, 0],
  ["revox-a77", 147, 15, 0, 28, 21, 0],
  ["sagrada-familia", 256, 0, 0, 15, 10, 0],
  ["sainte-chapelle", 183, 0, 0, 21, 18, 0],
  ["saturn", 127, 54, 0, 56, 49, 0],
  ["sydney-opera-house", 246, 0, 0, 5, 3, 0],
  ["tea-house", 108, 0, 5, 17, 0, 1],
  ["the-last-light", 67, 0, 6, 16, 0, 0],
  ["toyota-land-cruiser-fj62", 214, 0, 0, 9, 8, 1],
  ["yamaha-cfx", 31, 4, 0, 8, 7, 2],
]

type Sort = "parts" | "verified" | "name"

export function CertaintyLedger() {
  const [sort, setSort] = useState<Sort>("parts")
  const rows = [...ROWS].sort((a, b) =>
    sort === "name" ? a[0].localeCompare(b[0]) : sort === "parts" ? b[1] - a[1] : b[2] / b[1] - a[2] / a[1]
  )
  const P = ROWS.reduce((s, r) => s + r[1], 0)
  const PV = ROWS.reduce((s, r) => s + r[2], 0)
  const F = ROWS.reduce((s, r) => s + r[4], 0)
  const FV = ROWS.reduce((s, r) => s + r[5], 0)
  return (
    <figure className="my-8 overflow-hidden rounded-md border">
      <div className="border-b px-3 py-2 font-mono text-xs text-muted-foreground">
        what the shipped scenes claim · counted from 25 scene.json files
      </div>
      <div className="flex flex-wrap items-center gap-1.5 border-b px-4 py-2.5">
        <span className="font-mono text-[11px] text-muted-foreground">sort</span>
        {(["parts", "verified", "name"] as Sort[]).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setSort(s)}
            className={cn(
              "rounded border px-2 py-0.5 font-mono text-[11px] transition-colors",
              sort === s ? "border-foreground/40 bg-muted text-foreground" : "text-muted-foreground hover:bg-muted"
            )}
          >
            {s === "parts" ? "most parts" : s === "verified" ? "verified share" : "name"}
          </button>
        ))}
      </div>
      <div className="px-4 py-3">
        <div className="mb-2 grid grid-cols-[minmax(0,9rem)_1fr_3.5rem] gap-2 font-mono text-[11px] text-muted-foreground sm:grid-cols-[minmax(0,12rem)_1fr_4rem_4rem]">
          <span>scene</span>
          <span>parts: <span style={{ color: "oklch(0.62 0.15 150)" }}>verified</span> · inferred · <span style={{ color: "oklch(0.60 0.17 30)" }}>decorative</span></span>
          <span className="text-right">facts ok</span>
          <span className="hidden text-right sm:block">joints</span>
        </div>
        <div className="space-y-1">
          {rows.map((r) => (
            <div key={r[0]} className="grid grid-cols-[minmax(0,9rem)_1fr_3.5rem] items-center gap-2 font-mono text-[11px] sm:grid-cols-[minmax(0,12rem)_1fr_4rem_4rem]">
              <span className="truncate">{r[0]}</span>
              <div className="flex h-2.5 overflow-hidden rounded bg-muted" role="img" aria-label={`${r[0]}: ${r[1]} parts, ${r[2]} verified, ${r[3]} decorative`} style={{ width: `${(r[1] / 256) * 100}%`, minWidth: "0.5rem" }}>
                <div style={{ width: `${(r[2] / r[1]) * 100}%`, background: "oklch(0.62 0.15 150)" }} />
                <div style={{ width: `${((r[1] - r[2] - r[3]) / r[1]) * 100}%`, background: "oklch(0.62 0.15 285)", opacity: 0.55 }} />
                <div style={{ width: `${(r[3] / r[1]) * 100}%`, background: "oklch(0.60 0.17 30)" }} />
              </div>
              <span className="text-right tabular-nums">{r[5]}/{r[4]}</span>
              <span className="hidden text-right tabular-nums sm:block">{r[6] || "·"}</span>
            </div>
          ))}
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 border-t pt-2 font-mono text-xs">
          <div>
            <div className="text-[11px] text-muted-foreground">parts verified</div>
            <div className="tabular-nums">{PV} of {P} ({((PV / P) * 100).toFixed(1)}%)</div>
          </div>
          <div>
            <div className="text-[11px] text-muted-foreground">facts verified</div>
            <div className="tabular-nums">{FV} of {F} ({((FV / F) * 100).toFixed(1)}%)</div>
          </div>
        </div>
      </div>
    </figure>
  )
}
