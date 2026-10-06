"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

import { PREV_OVERRIDE, RECORDS } from "./records-data"

// Each bar is one record's cut against the record before it: (prev - this) / prev, from the
// README's own times. CPLM is the pending PR #379; it has two honest numbers, the same-node
// comparison its rules require (36.009 s vs 40.575 s, both measured from the PR's logs) and
// the comparison against #92's published 39.9 s on a different node.

type Bar = { n: number | "CPLM"; date: string; desc: string; secs: number; cut: number }

const CPLM_SECS = 36.009
const SAME_NODE_92 = 40.575

const ACCENT = "oklch(0.62 0.17 45)"
const WARM = "oklch(0.60 0.13 255)"
const MUTED = "oklch(0.70 0.02 255)"

function buildBars(basis: "same" | "published"): Bar[] {
  const out: Bar[] = []
  for (let i = 1; i < RECORDS.length; i++) {
    const [n, min, date, desc] = RECORDS[i]
    const prevMin = PREV_OVERRIDE[n] ?? RECORDS[i - 1][1]
    out.push({ n, date, desc, secs: min * 60, cut: (100 * (prevMin - min)) / prevMin })
  }
  const last = RECORDS[RECORDS.length - 1][1] * 60
  const ref = basis === "same" ? SAME_NODE_92 : last
  out.push({
    n: "CPLM",
    date: "2026-10-02",
    desc: "Copy-sink pointer mixed into the output distribution (pending, PR #379)",
    secs: CPLM_SECS,
    cut: (100 * (ref - CPLM_SECS)) / ref,
  })
  return out
}

const LABELLED = new Set<number | "CPLM">([15, 19, 62, 90, 92, "CPLM"])

export function RecordJumps() {
  const [basis, setBasis] = useState<"same" | "published">("same")
  const [clip, setClip] = useState(true)
  const [sel, setSel] = useState<number | "CPLM">("CPLM")

  const bars = buildBars(basis)
  const cap = clip ? 12 : 42
  const chosen = bars.find((b) => b.n === sel) ?? bars[bars.length - 1]
  const cplm = bars[bars.length - 1]
  const bigger = bars.filter((b) => b.n !== "CPLM" && b.cut > cplm.cut)

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          track 1 records #13 to #92, cut vs the previous record
        </span>
        <span className="font-mono text-[10px]" style={{ color: ACCENT }}>
          CPLM: {cplm.cut.toFixed(2)}%
        </span>
      </div>

      <div className="p-3 sm:p-4">
        <div className="flex flex-wrap gap-1.5">
          {(
            [
              ["same", "CPLM vs #92 on the same node"],
              ["published", "CPLM vs #92's published 39.9 s"],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              type="button"
              onClick={() => setBasis(k)}
              aria-pressed={basis === k}
              className={cn(
                "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
                basis === k
                  ? "border-foreground/30 bg-muted/50 text-foreground"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setClip((c) => !c)}
            aria-pressed={clip}
            className={cn(
              "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
              clip ? "border-foreground/30 bg-muted/50 text-foreground" : "border-border text-muted-foreground hover:text-foreground",
            )}
          >
            {clip ? "axis clipped at 12%" : "full axis"}
          </button>
        </div>

        <div className="relative mt-4 h-44" role="group" aria-label="Record-to-record speedups">
          <div
            className="pointer-events-none absolute inset-x-0 border-t border-dashed"
            style={{ bottom: `${(cplm.cut / cap) * 100}%`, borderColor: ACCENT, opacity: 0.6 }}
          />
          <div className="flex h-full items-end gap-px">
            {bars.map((b) => {
              const isC = b.n === "CPLM"
              const h = Math.max(0.6, Math.min(100, (Math.max(0, b.cut) / cap) * 100))
              const over = b.cut > cap
              const color = isC ? ACCENT : b.n === 92 ? WARM : LABELLED.has(b.n) ? WARM : MUTED
              return (
                <button
                  key={String(b.n)}
                  type="button"
                  onClick={() => setSel(b.n)}
                  onMouseEnter={() => setSel(b.n)}
                  aria-label={`Record ${b.n}: ${b.cut.toFixed(2)} percent`}
                  aria-pressed={sel === b.n}
                  className="relative h-full flex-1 cursor-pointer"
                >
                  <span
                    className="absolute inset-x-0 bottom-0 rounded-t-[1px]"
                    style={{
                      height: `${h}%`,
                      background: color,
                      opacity: sel === b.n ? 1 : isC ? 0.95 : 0.75,
                      outline: sel === b.n ? "1px solid currentColor" : undefined,
                    }}
                  />
                  {over && (
                    <span className="absolute inset-x-0 top-0 text-center font-mono text-[8px] text-muted-foreground">
                      ↑
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </div>
        <div className="mt-1 flex justify-between font-mono text-[9px] text-muted-foreground">
          <span>#13 · Nov 2024</span>
          <span>0 to {cap}% per bar</span>
          <span>CPLM · Oct 2026</span>
        </div>

        <div className="mt-3 rounded-md border bg-muted/20 px-3 py-2 font-mono text-[11px] leading-5">
          <span className="text-foreground">
            {chosen.n === "CPLM" ? "CPLM (pending)" : `#${chosen.n}`}
          </span>{" "}
          <span className="text-muted-foreground">· {chosen.date} ·</span>{" "}
          <span className="text-foreground">{chosen.secs.toFixed(1)} s</span>{" "}
          <span className="text-muted-foreground">·</span>{" "}
          <span style={{ color: chosen.n === "CPLM" ? ACCENT : undefined }}>{chosen.cut.toFixed(2)}% faster</span>
          <div className="text-muted-foreground">{chosen.desc}</div>
        </div>

        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          {basis === "same" ? (
            <>
              Against #92 rerun on its own node, CPLM is{" "}
              <span className="text-foreground">{cplm.cut.toFixed(2)}%</span> faster. Records with a bigger single
              cut since #13:{" "}
              <span className="text-foreground">{bigger.map((b) => `#${b.n}`).join(", ") || "none"}</span>.
            </>
          ) : (
            <>
              Against #92&rsquo;s published 39.9 s, measured on a faster node, the same 36.009 s is only{" "}
              <span className="text-foreground">{cplm.cut.toFixed(2)}%</span> faster. The rules compare on the same
              hardware for exactly this reason. Bigger single cuts since #13:{" "}
              <span className="text-foreground">{bigger.map((b) => `#${b.n}`).join(", ") || "none"}</span>.
            </>
          )}
        </p>
      </div>
    </figure>
  )
}
