"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// Selection against attention, per query, for one GLM-5.3-Flash-shaped sparse layer.
// COMPUTED multiply-adds, from GLM-5.3-Flash's config.json (64 heads, kv_lora_rank 512, index_n_heads 32,
// index_head_dim 128, index_kpool 4) and the D-LSA settings of the paper's Table 2 and the repository's configs
// (Prefrontal-AI/latent-sparse-attention @6291aa6: buckets of 8, 64-dim index, top-k 2,048 below 1M tokens and
// 4,096 from 1M for flat, 4,096 for tree; tree knobs node_bucket_size 4, node_cluster_block_size 4,096,
// beam_width 2,048, start_nodes 32,768).
//   GLM indexer   32 x 128 x T/4 = 1,024 T
//   D-LSA flat    64 x T/8       = 8 T
//   D-LSA tree    64 x (vectors the beam scores, replayed from the configs below)
//   attention     absorbed MLA: 64 heads x (512 + 512) per key read, over k + 516 keys (sink 4, window 512)
// MEASURED (cpu view): numpy 2.5.3, 2 threads on a shared 4-vCPU box, min of repeats, batches of 8 queries.
// REPORTED: the indexer's share of GLM's own sparse layer in prefill, the paper's Figure 2.

const CTX = [
  { t: "128k", T: 131072 },
  { t: "512k", T: 524288 },
  { t: "1M", T: 1048576 },
  { t: "2M", T: 2097152 },
  { t: "4M", T: 4194304 },
  { t: "10M", T: 10485760 },
  { t: "32M", T: 33554432 },
  { t: "100M", T: 104857600 },
] as const

const REPORTED: Record<string, number> = { "512k": 67, "1M": 79, "10M": 98 }

// MEASURED, ms per query: GLM-shaped indexer (score, ReLU, head-weighted sum, top 512 blocks) and LSA flat (score T/8
// centroids, top-p 1,024 by argpartition, sort, expand); attention gathers 2,564 or 4,612 latent rows and runs 64
// heads over them with scaled logits.
const CPU: Record<string, { glm: number; flat: number }> = {
  "128k": { glm: 4.29, flat: 0.234 },
  "512k": { glm: 16.08, flat: 0.632 },
  "1M": { glm: 43.82, flat: 1.395 },
  "2M": { glm: 73.64, flat: 2.862 },
  "4M": { glm: 166.28, flat: 5.706 },
}
const CPU_ATTN = { k2564: 4.48, k4612: 7.37 }

/** Vectors the shipped tree scores for a query at the end of a context of T tokens, as hierarchy.py's beam reads. */
export function treeScored(T: number): number {
  const n0 = Math.floor(T / 8)
  const made: number[] = []
  const covered: number[] = []
  let rows = n0
  for (let l = 0; l < 16; l++) {
    const c = Math.floor(rows / 4096) * 4096
    if (!c) break
    covered.push(c)
    made.push(c / 4)
    rows = c / 4
  }
  if (!made.length) return n0
  const L = made.length
  let start = L
  for (let l = 1; l <= L; l++) {
    if (made[l - 1] <= 32768) {
      start = l
      break
    }
  }
  let scored = made[start - 1]
  let carried = Math.min(2048, made[start - 1]) * 4
  for (let l = start - 1; l >= 1; l--) {
    const open = made[l - 1] - (covered[l] ?? 0)
    const cand = carried + open
    scored += cand
    carried = Math.min(2048, cand) * 4
  }
  return scored + carried + (n0 - covered[0])
}

function fmtMacs(x: number): string {
  if (x >= 1e9) return `${(x / 1e9).toFixed(x >= 1e10 ? 0 : 1)} G`
  if (x >= 1e6) return `${(x / 1e6).toFixed(x >= 1e8 ? 0 : 1)} M`
  return `${(x / 1e3).toFixed(0)} k`
}

const C_SEL = "oklch(0.62 0.15 40)"
const C_ATT = "oklch(0.58 0.11 250)"

export function SelectionShare() {
  const [i, setI] = useState(5)
  const [view, setView] = useState<"macs" | "cpu">("macs")
  const c = CTX[i]
  const T = c.T
  const kLsa = T >= 1048576 ? 4096 : 2048
  const rows =
    view === "macs"
      ? [
          { name: "GLM-5.3-Flash's own indexer", sel: 1024 * T, att: 65536 * (2048 + 516), unit: "MACs" },
          { name: "D-LSA (Flat)", sel: 8 * T, att: 65536 * (kLsa + 516), unit: "MACs" },
          { name: "D-LSA (Tree)", sel: 64 * treeScored(T), att: 65536 * (4096 + 516), unit: "MACs" },
        ]
      : CPU[c.t]
        ? [
            { name: "GLM-5.3-Flash's own indexer", sel: CPU[c.t].glm, att: CPU_ATTN.k2564, unit: "ms" },
            { name: "D-LSA (Flat)", sel: CPU[c.t].flat, att: kLsa === 4096 ? CPU_ATTN.k4612 : CPU_ATTN.k2564, unit: "ms" },
          ]
        : []
  const max = Math.max(...rows.map((r) => r.sel + r.att), 1)
  const show = (r: (typeof rows)[number], v: number) => (r.unit === "ms" ? `${v.toFixed(v < 1 ? 2 : 1)} ms` : fmtMacs(v))

  return (
    <figure className="my-8 overflow-hidden rounded-md border">
      <div className="border-b px-3 py-2 font-mono text-xs text-muted-foreground">
        one query, one sparse layer shaped like GLM-5.3-Flash&apos;s · selection against attention
      </div>
      <div className="flex flex-wrap items-center gap-3 border-b px-4 py-2.5">
        <div className="flex flex-wrap gap-1.5">
          {[
            { v: "macs" as const, t: "multiply-adds (computed)" },
            { v: "cpu" as const, t: "CPU time (measured, to 4M)" },
          ].map((o) => (
            <button
              key={o.v}
              type="button"
              onClick={() => setView(o.v)}
              className={cn(
                "rounded border px-2 py-0.5 font-mono text-[11px] transition-colors",
                view === o.v ? "border-foreground/40 bg-muted text-foreground" : "text-muted-foreground hover:bg-muted"
              )}
            >
              {o.t}
            </button>
          ))}
        </div>
        <label className="flex flex-1 items-center gap-2 font-mono text-[11px] text-muted-foreground">
          context
          <input
            type="range"
            min={0}
            max={CTX.length - 1}
            value={i}
            onChange={(e) => setI(+e.target.value)}
            className="min-w-[8rem] flex-1"
            aria-label="context length"
          />
          <span className="w-10 text-right text-sm text-foreground tabular-nums">{c.t}</span>
        </label>
      </div>

      <div className="space-y-3 px-4 py-4">
        {rows.length === 0 && (
          <div className="text-xs text-muted-foreground">
            Not measured at {c.t}: I stopped the CPU runs at 4M tokens. Switch to multiply-adds.
          </div>
        )}
        {rows.map((r) => {
          const share = (r.sel / (r.sel + r.att)) * 100
          return (
            <div key={r.name} className="space-y-1">
              <div className="flex items-baseline justify-between gap-2 text-xs">
                <span>{r.name}</span>
                <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
                  selection {share.toFixed(share < 10 ? 1 : 0)}%
                </span>
              </div>
              <div
                className="flex h-3 overflow-hidden rounded bg-muted"
                role="img"
                aria-label={`${r.name}: selection ${show(r, r.sel)}, attention ${show(r, r.att)}`}
              >
                <div style={{ width: `${((r.sel / max) * 100).toFixed(2)}%`, background: C_SEL }} />
                <div style={{ width: `${((r.att / max) * 100).toFixed(2)}%`, background: C_ATT }} />
              </div>
              <div className="font-mono text-[10px] tabular-nums text-muted-foreground">
                select {show(r, r.sel)} · attend {show(r, r.att)}
              </div>
            </div>
          )
        })}
        {REPORTED[c.t] !== undefined && (
          <div className="text-xs text-muted-foreground">
            Reported for GLM-5.3-Flash on an H200 at {c.t}: the indexer is {REPORTED[c.t]}% of its sparse layer&apos;s
            prefill time (paper, Figure 2).
          </div>
        )}
      </div>

      <div className="border-t px-4 py-3 font-mono text-[11px] text-muted-foreground">
        <span style={{ color: C_SEL }}>■</span> selecting keys · <span style={{ color: C_ATT }}>■</span> attending to
        them. Bars share one scale per context. D-LSA reads 2,048 long-range keys below 1M and 4,096 from 1M; GLM reads
        2,048 throughout. Clustering adds about 16k multiply-adds a key, which no bar can show.
      </div>
    </figure>
  )
}
