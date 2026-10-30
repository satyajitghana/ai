"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

import { NF_LAYERS, NF_ROWS, type NfRow, type Verdict } from "./data"

// Each dot is one of the 46 targets of neuron-finder's published run on Qwen3.5-4B: the confirmed #1 neuron, placed
// by its layer (x) and its confirmed hit rate out of 32 fresh replies (y). Recomputed from the repository's
// results/*/ranked.json (commit 38ae049). Reported by the repository, judged by an external LLM; not re-run here.

type Group = "all" | "read" | "write" | "both"

const COLOR: Record<Verdict, string> = {
  found: "oklch(0.62 0.16 35)",
  partial: "oklch(0.75 0.14 85)",
  "not found": "oklch(0.55 0.02 255)",
}

function group(src: string): Exclude<Group, "all"> {
  const parts = src.split("+")
  const read = parts.includes("read")
  const write = parts.some((p) => p.startsWith("write"))
  return read && write ? "both" : read ? "read" : "write"
}

const LABEL: Record<Group, string> = {
  all: "all 46",
  read: "read screen only",
  write: "write screens only",
  both: "both",
}

function row(r: NfRow) {
  const dose = `${r.dose > 0 ? "+" : "−"}${Math.abs(r.dose)}`
  return `${r.target} · layer ${r.layer} neuron ${r.neuron} · dose ${dose} · ${r.hits}/${r.of} hits · null 95th percentile ${r.nullP95.toFixed(2)} · ${r.verdict} · listed by ${r.src} · ${r.runtimeS} s`
}

export function ResultsMap() {
  const [g, setG] = useState<Group>("all")
  const [sel, setSel] = useState<number>(NF_ROWS.findIndex((r) => r.target === "calm"))
  const counts: Record<Group, number> = { all: NF_ROWS.length, read: 0, write: 0, both: 0 }
  for (const r of NF_ROWS) counts[group(r.src)] += 1

  const W = 600
  const H = 220
  const L = 40
  const R = 12
  const T = 10
  const B = 28
  const px = (layer: number) => L + (layer / (NF_LAYERS - 1)) * (W - L - R)
  const py = (rate: number) => T + (1 - rate) * (H - T - B)
  const cur = NF_ROWS[sel]

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">46 targets · best neuron each · Qwen3.5-4B · reported</span>
        <div className="flex flex-wrap gap-1" role="group" aria-label="Which screen listed the neuron">
          {(Object.keys(LABEL) as Group[]).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setG(k)}
              aria-pressed={g === k}
              className={cn(
                "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
                g === k ? "border-foreground/30 bg-muted/50 text-foreground" : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {LABEL[k]} · {counts[k]}
            </button>
          ))}
        </div>
      </div>
      <div className="p-3 sm:p-4">
        <svg viewBox={`0 0 ${W} ${H}`} role="img" className="h-auto w-full">
          <title>
            A scatter of 46 dots, one per target. The horizontal axis is the layer of the winning neuron, from 0 to 31; the vertical axis is
            its confirmed hit rate. Thirty-six dots are found, five partial and five not found. Twelve winners sit in layers 6 and 7.
          </title>
          {[0, 0.25, 0.5, 0.75, 1].map((t) => (
            <g key={t}>
              <line x1={L} x2={W - R} y1={py(t)} y2={py(t)} stroke="currentColor" strokeOpacity={0.12} />
              <text x={L - 6} y={py(t) + 3} textAnchor="end" fontSize={9} fontFamily="ui-monospace, monospace" fill="currentColor" fillOpacity={0.55}>
                {t.toFixed(2)}
              </text>
            </g>
          ))}
          {[0, 4, 8, 12, 16, 20, 24, 28, 31].map((t) => (
            <text key={t} x={px(t)} y={H - 10} textAnchor="middle" fontSize={9} fontFamily="ui-monospace, monospace" fill="currentColor" fillOpacity={0.55}>
              {t}
            </text>
          ))}
          <text x={L} y={H - 0} fontSize={9} fontFamily="ui-monospace, monospace" fill="currentColor" fillOpacity={0.5}>
            layer
          </text>
          <line x1={L} x2={W - R} y1={py(0.375)} y2={py(0.375)} stroke="currentColor" strokeOpacity={0.35} strokeDasharray="4 3" />
          <text x={W - R - 2} y={py(0.375) - 4} textAnchor="end" fontSize={9} fontFamily="ui-monospace, monospace" fill="currentColor" fillOpacity={0.6}>
            found needs 0.375 and a rate above the random neurons
          </text>
          {NF_ROWS.map((r, i) => {
            const on = g === "all" || group(r.src) === g
            const jitter = ((i * 37) % 9) - 4
            return (
              <circle
                key={r.target}
                cx={px(r.layer) + jitter * 1.1}
                cy={py(r.hits / r.of)}
                r={i === sel ? 6.5 : 4.5}
                fill={COLOR[r.verdict]}
                fillOpacity={on ? 0.9 : 0.12}
                stroke={i === sel ? "currentColor" : "none"}
                strokeWidth={1.5}
                tabIndex={on ? 0 : -1}
                role="button"
                aria-label={row(r)}
                onClick={() => setSel(i)}
                onFocus={() => setSel(i)}
                onMouseEnter={() => setSel(i)}
                className="cursor-pointer outline-none"
              />
            )
          })}
        </svg>
        <div className="mt-1 flex flex-wrap gap-3 font-mono text-[10px] text-muted-foreground">
          {(["found", "partial", "not found"] as Verdict[]).map((v) => (
            <span key={v} className="inline-flex items-center gap-1.5">
              <span className="inline-block size-2.5 rounded-full" style={{ background: COLOR[v] }} />
              {v} · {NF_ROWS.filter((r) => r.verdict === v).length}
            </span>
          ))}
        </div>
        <p className="mt-3 rounded-lg border bg-muted/20 p-3 font-mono text-xs leading-relaxed" aria-live="polite">
          {row(cur)}
        </p>
        <p className="mt-2 text-xs text-muted-foreground">
          The tool&apos;s two screens split the winners: the read screen alone listed 19 of them, the write screens alone 23, and 4 came from both.
          Winners cluster in early layers, 12 of the 46 at layers 6 and 7. Two targets, anime and cartoon mascot, share one neuron
          (layer 13, neuron 4810).
        </p>
      </div>
    </figure>
  )
}
