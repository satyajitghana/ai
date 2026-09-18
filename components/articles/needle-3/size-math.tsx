"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// Three numbers for the same file, none of them invented.
//
//   claimed   — the ceiling Cactus states twice on the same live page: the
//               hero says "8-29 MB", the intelligence-ladders post says
//               "9 to 29 MB", and both anchor the top of that range to the
//               20-layer, 121M-parameter model.
//   naive     — the back-of-envelope a reader would do from the page's own
//               numbers: 121,021,910 parameters (config.json) at the CQ2 cost
//               Cactus itself publishes, 2.125 bits/weight (2 bits of index
//               plus a 16-bit norm shared over a 128-weight group: b + 1/8).
//   measured  — needle3.cact, downloaded from Cactus-Compute/needle3 on
//               Hugging Face on 2026-09-18: a real HTTP Content-Length of
//               35,335,380 bytes after the redirect resolves, not a git-lfs
//               pointer. That is 33.70 MiB, or 35.34 MB in the decimal units
//               the page itself uses.
//
// All three exceed nothing invented; only "claimed" is a marketing number.
// The gap between naive and measured is explained by config.json's own
// quantization.scheme: "embedding=4,mhc=4,default=2" — the embedding table and
// the multi-lane hyper-connection gates are stored at 4 bits, not the 2-bit
// default, which is why even the honest arithmetic undercounts the real file.

const CLAIMED_MB = 29
const NAIVE_BYTES = 121_021_910 * 2.125 / 8
const MEASURED_BYTES = 35_335_380

const ROWS = [
  {
    k: "claimed",
    label: "claimed on the page",
    sub: '"8-29 MB" (hero) · "9 to 29 MB" (intelligence-ladders post)',
    bytes: CLAIMED_MB * 1_000_000,
    color: "oklch(0.62 0.03 250)",
  },
  {
    k: "naive",
    label: "121,021,910 params × 2.125 bits",
    sub: "the honest back-of-envelope, all-CQ2, from Cactus's own bit-cost formula",
    bytes: NAIVE_BYTES,
    color: "oklch(0.68 0.13 85)",
  },
  {
    k: "measured",
    label: "needle3.cact, downloaded",
    sub: "HTTP Content-Length after redirect, Hugging Face, 2026-09-18",
    bytes: MEASURED_BYTES,
    color: "oklch(0.62 0.19 27)",
  },
]

function fmtMB(bytes: number) {
  return `${(bytes / 1_000_000).toFixed(2)} MB`
}
function fmtMiB(bytes: number) {
  return `${(bytes / 1_048_576).toFixed(2)} MiB`
}

export function SizeMath() {
  const [sel, setSel] = useState("measured")
  const r = ROWS.find((x) => x.k === sel) ?? ROWS[0]
  const max = Math.max(...ROWS.map((x) => x.bytes))

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          the 20-layer needle3.cact, three ways of sizing it
        </span>
        <span className="font-mono text-[10px]" style={{ color: "oklch(0.62 0.19 27)" }}>
          measured is +22% over claimed
        </span>
      </div>

      <div className="p-3 sm:p-4">
        <div className="space-y-1">
          {ROWS.map((x) => (
            <button
              key={x.k}
              type="button"
              onClick={() => setSel(x.k)}
              aria-pressed={x.k === sel}
              className={cn(
                "flex w-full cursor-pointer items-center gap-2 rounded-md border px-1.5 py-1 text-left transition-colors",
                x.k === sel ? "border-foreground/30 bg-muted/40" : "border-transparent hover:bg-muted/20",
              )}
            >
              <span className="w-40 shrink-0 truncate text-right font-mono text-[10px] text-foreground">
                {x.label}
              </span>
              <div className="h-4 flex-1 rounded-sm bg-muted/40">
                <div className="h-4 rounded-sm" style={{ width: `${(x.bytes / max) * 100}%`, background: x.color, opacity: 0.9 }} />
              </div>
              <span className="w-20 shrink-0 text-right font-mono text-[10px] tabular-nums" style={{ color: x.color }}>
                {fmtMB(x.bytes)}
              </span>
            </button>
          ))}
        </div>

        <div className="mt-3 rounded-lg border bg-muted/20 px-3 py-2.5">
          <div className="font-mono text-[11px]" style={{ color: r.color }}>
            {r.label} · {fmtMB(r.bytes)} · {fmtMiB(r.bytes)}
          </div>
          <div className="mt-1 text-sm leading-6 text-muted-foreground">{r.sub}</div>
        </div>

        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          Even the most generous honest estimate — every one of 121M parameters at a flat 2.125 bits, Cactus&rsquo;s
          own CQ2 cost formula, no other tensor stored more expensively — comes to 32.15 MB, already past the
          page&rsquo;s 29 MB ceiling. The file Hugging Face actually serves is bigger again: 35.34 MB, because{" "}
          <code className="rounded bg-secondary px-1 py-0.5 text-[0.85em]">config.json</code>&rsquo;s own{" "}
          <code className="rounded bg-secondary px-1 py-0.5 text-[0.85em]">quantization.scheme</code> reads{" "}
          <code className="rounded bg-secondary px-1 py-0.5 text-[0.85em]">
            &quot;embedding=4,mhc=4,default=2&quot;
          </code>{" "}
          — the tied embedding table and the multi-lane hyper-connection gates are stored at 4 bits, not the 2-bit
          default the marketing number implicitly assumes everything gets. &ldquo;CQ2-bit&rdquo; describes the
          dominant tensor format, not a uniform one, and the mix costs more than the label suggests.
        </p>
      </div>
    </figure>
  )
}
