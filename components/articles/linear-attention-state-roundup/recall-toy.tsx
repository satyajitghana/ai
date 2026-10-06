"use client"

import { useMemo, useState } from "react"

import { BETA, D, E, MEMORIES, recallAccuracy } from "./recall-sim"

// Four memories, one toy task. Write N random key/value pairs (16-dim sign
// vectors), optionally overwrite half the keys with new values, then query
// every key and score a hit when the readout lands nearest the latest value.
// The point: the delta rule fixes overwrites, and only a bigger key space
// (triadic or a plain wide key, same state size) fixes capacity.

const NS = [8, 16, 32, 64, 128]

const COLORS: Record<string, string> = {
  hebb: "oklch(0.62 0.03 260)",
  delta: "oklch(0.58 0.15 265)",
  triadic: "oklch(0.62 0.16 45)",
  wide: "oklch(0.6 0.12 160)",
}

const STATE: Record<string, string> = {
  hebb: `${D} × ${D} = ${D * D}`,
  delta: `${D} × ${D} = ${D * D}`,
  triadic: `${D} × ${E} × ${D} = ${D * E * D}`,
  wide: `${D * E} × ${D} = ${D * E * D}`,
}

export function RecallToy() {
  const [ni, setNi] = useState(2)
  const [rewrite, setRewrite] = useState(true)
  const n = NS[ni]
  const acc = useMemo(() => recallAccuracy(n, rewrite), [n, rewrite])

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">toy recall · {D}-dim keys and values · β = {BETA}</span>
        <div className="flex gap-1">
          {NS.map((v, i) => (
            <button
              key={v}
              type="button"
              onClick={() => setNi(i)}
              aria-pressed={i === ni}
              className={`cursor-pointer rounded-full border px-2 py-0.5 font-mono text-[11px] transition-colors ${
                i === ni ? "border-foreground/40 text-foreground" : "border-transparent text-muted-foreground hover:border-foreground/25"
              }`}
            >
              N={v}
            </button>
          ))}
        </div>
      </div>

      <div className="p-3 sm:p-4">
        <label className="mb-3 flex cursor-pointer items-center gap-2 font-mono text-xs text-muted-foreground">
          <input type="checkbox" checked={rewrite} onChange={(e) => setRewrite(e.target.checked)} />
          then rewrite half the keys with new values ({Math.floor(n / 2)} more writes)
        </label>

        <div className="space-y-2.5">
          {MEMORIES.map((m) => {
            const v = acc[m.id]
            return (
              <div key={m.id}>
                <div className="mb-1 flex items-baseline justify-between gap-2 font-mono text-[11px]">
                  <span className="text-foreground">{m.label}</span>
                  <span className="text-muted-foreground">
                    state {STATE[m.id]} ·{" "}
                    <span className="tabular-nums text-foreground">{(v * 100).toFixed(1)}%</span>
                  </span>
                </div>
                <div className="h-3 overflow-hidden rounded-full bg-muted/40">
                  <div className="h-full rounded-full" style={{ width: `${(v * 100).toFixed(1)}%`, background: COLORS[m.id] }} />
                </div>
              </div>
            )
          })}
        </div>

        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          Recall rate over every key, averaged across 12 seeds. With the rewrite on, the Hebbian sum keeps both the old
          and the new value under a key and returns a blend; the delta rule subtracts what it predicted before it
          writes, so it returns the newer one. Neither fixes capacity: past about {D} pairs a {D}-dim key space has
          run out of directions. The triadic joint key and a plain 64-wide key hold the same {D * E * D} numbers and
          score about the same, which is the honest reading of the triadic paper: the gain is the bigger key space,
          and the trick is getting it from two small projections.
        </p>
      </div>
    </figure>
  )
}
