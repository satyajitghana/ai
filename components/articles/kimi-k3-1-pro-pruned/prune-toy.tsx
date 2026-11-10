"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// Results of toy3.py (measured, numpy 2.5.3, 8 seeds averaged): one MoE layer routed like Kimi K3's
// (sigmoid scores, top-4 chosen on score + balance bias, gates renormalised without the bias),
// 64 experts, prune to `keep`. err = squared error of the pruned layer's output on 6,000 held-out
// tokens over the squared size of the full layer's output, so 1.0 is as bad as outputting zero.
// ovl = how many of the kept experts the frequency ranking would also keep.
// share = fraction of all routing decisions the `keep` most-used experts held before pruning.

type Cell = { err: number; ovl: number }
type Row = { share: number; frequency: Cell; signed: Cell; l1: Cell; random: Cell }

const R = (share: number, f: number[], s: number[], l: number[], r: number[]): Row => ({
  share,
  frequency: { err: f[0], ovl: f[1] },
  signed: { err: s[0], ovl: s[1] },
  l1: { err: l[0], ovl: l[1] },
  random: { err: r[0], ovl: r[1] },
})

const DATA: Record<string, Record<number, Row>> = {
  "ones|unbalanced": {
    8: R(0.398, [1.14, 8], [1.145, 7.125], [1.656, 1.25], [1.665, 1.375]),
    16: R(0.606, [0.737, 16], [0.753, 14.5], [1.306, 5.375], [1.435, 4.375]),
    32: R(0.844, [0.289, 32], [0.316, 28.75], [0.791, 18.75], [0.944, 16.5]),
    48: R(0.96, [0.075, 48], [0.092, 45], [0.313, 39.25], [0.445, 37.25]),
  },
  "ones|balanced": {
    8: R(0.129, [1.725, 8], [1.711, 2.125], [1.723, 0.5], [1.729, 0.75]),
    16: R(0.257, [1.454, 16], [1.443, 5.875], [1.46, 4], [1.473, 4]),
    32: R(0.51, [0.962, 32], [0.934, 15.5], [0.964, 16.25], [0.978, 15.75]),
    48: R(0.757, [0.488, 48], [0.449, 34.75], [0.474, 36.125], [0.483, 35.125]),
  },
  "random|unbalanced": {
    8: R(0.416, [1.105, 8], [1.667, 1.125], [1.652, 1.25], [1.713, 0.75]),
    16: R(0.622, [0.711, 16], [1.445, 4.125], [1.35, 5.375], [1.437, 4.375]),
    32: R(0.853, [0.273, 32], [0.957, 16.5], [0.873, 17.5], [0.957, 16.25]),
    48: R(0.963, [0.07, 48], [0.518, 35.625], [0.383, 37.625], [0.472, 36.875]),
  },
  "random|balanced": {
    8: R(0.129, [1.736, 8], [1.715, 1], [1.722, 0.25], [1.727, 1.25]),
    16: R(0.257, [1.456, 16], [1.461, 2.875], [1.469, 3.875], [1.472, 5.125]),
    32: R(0.509, [0.966, 32], [0.974, 15.125], [0.962, 16], [0.981, 16.25]),
    48: R(0.756, [0.489, 48], [0.49, 36.75], [0.478, 36.5], [0.485, 36.25]),
  },
}

const CRIT = [
  { key: "frequency", label: "router frequency (needs data)", color: "oklch(0.58 0.15 150)" },
  { key: "signed", label: "signed row sum (shipped)", color: "oklch(0.62 0.15 250)" },
  { key: "l1", label: "row L1 (default)", color: "oklch(0.72 0.14 60)" },
  { key: "random", label: "random", color: "oklch(0.60 0.02 260)" },
] as const

const KEEPS = [8, 16, 32, 48]

export function PruneToy() {
  const [mean, setMean] = useState<"ones" | "random">("ones")
  const [bal, setBal] = useState<"unbalanced" | "balanced">("unbalanced")
  const [keep, setKeep] = useState(16)
  const row = DATA[`${mean}|${bal}`][keep]
  const max = 1.8
  const btn = (on: boolean) =>
    cn(
      "cursor-pointer rounded-md border px-2 py-1 font-mono text-[11px] transition-colors",
      on ? "border-foreground/40 text-foreground" : "text-muted-foreground hover:text-foreground"
    )
  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/20 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>toy MoE: 64 experts, top-4, prune to {keep}</span>
        <span className="text-muted-foreground/60">measured on a synthetic layer, 8 seeds</span>
      </div>
      <div className="space-y-4 p-3 sm:p-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">hidden-state offset</span>
          <button type="button" className={btn(mean === "ones")} aria-pressed={mean === "ones"} onClick={() => setMean("ones")}>
            along all-ones
          </button>
          <button type="button" className={btn(mean === "random")} aria-pressed={mean === "random"} onClick={() => setMean("random")}>
            random direction
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">load</span>
          <button type="button" className={btn(bal === "unbalanced")} aria-pressed={bal === "unbalanced"} onClick={() => setBal("unbalanced")}>
            skewed
          </button>
          <button type="button" className={btn(bal === "balanced")} aria-pressed={bal === "balanced"} onClick={() => setBal("balanced")}>
            balanced by bias
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">keep</span>
          {KEEPS.map((k) => (
            <button key={k} type="button" className={btn(keep === k)} aria-pressed={keep === k} onClick={() => setKeep(k)}>
              {k} of 64
            </button>
          ))}
        </div>

        <div className="space-y-2">
          {CRIT.map((c) => {
            const v = row[c.key]
            return (
              <div key={c.key}>
                <div className="mb-0.5 flex justify-between font-mono text-[11px]">
                  <span className="text-foreground">{c.label}</span>
                  <span className="text-muted-foreground">
                    error {v.err.toFixed(2)} · {v.ovl.toFixed(1)} of {keep} match frequency
                  </span>
                </div>
                <div className="relative h-4 w-full overflow-hidden rounded-md border bg-muted/30">
                  <div className="h-full transition-all duration-300" style={{ width: `${((Math.min(v.err, max) / max) * 100).toFixed(2)}%`, background: c.color }} />
                  <div className="absolute top-0 h-full border-l border-dashed border-foreground/60" style={{ left: `${((1 / max) * 100).toFixed(2)}%` }} />
                </div>
              </div>
            )
          })}
        </div>
        <p className="font-mono text-[10px] text-muted-foreground">
          The {keep} most-used experts held {(row.share * 100).toFixed(1)}% of routing decisions before pruning. Dashed line: error 1.0, the
          same as deleting the layer&apos;s routed output.
        </p>
      </div>
      <figcaption className="border-t px-4 py-2 text-xs text-muted-foreground">
        A synthetic layer, not Kimi. The signed row sum tracks router frequency only when the hidden states share an offset along the
        all-ones direction; with an offset anywhere else it is no better than random. Once a balance bias flattens the load, no ranking
        has much to find.
      </figcaption>
    </figure>
  )
}
