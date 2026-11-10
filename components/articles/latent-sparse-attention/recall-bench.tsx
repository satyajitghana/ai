"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// MEASURED on a 4-vCPU sandbox (numpy 2.5.3, 2 threads), with my numpy port of D-LSA (Flat) from
// Prefrontal-AI/latent-sparse-attention @5ebea73 (src/lsa/core/ward.py and reference.py): unit index keys of 64 dims,
// cluster blocks of 512, buckets of about 8 (cap 16), sink 4, window 512, top-p 512, top-k 2048, 64 queries at the
// last position, one seed. Each method selects 2,048 long-range keys:
//   lsa4  D-LSA (Flat) as shipped, pools of 4 consecutive keys   scores T/8 centroids
//   lsa1  the same with no pooling (pool_size 1)                  scores T/8 centroids
//   b4    block sparse, blocks of 4 keys, top 512 blocks          scores T/4 block keys
//   b8    block sparse, blocks of 8 keys, top 256 blocks          scores T/8 block keys (LSA's index cost)
// Columns: share of the exact top-64 keys found; attention mass captured at softmax temperature 0.1, over the exact
// top-2,048's; and, for the needle data, planted near-copies of the query found out of 64.
type Cell = { r: number; m: number; n?: number }
type Row = { T: string; lsa4: Cell; lsa1?: Cell; b4: Cell; b8: Cell; clu: number; clu1?: number }

const DATA: Record<string, Row[]> = {
  topical: [
    { T: "16k", lsa4: { r: 0.958, m: 0.854 }, lsa1: { r: 0.994, m: 0.912 }, b4: { r: 0.972, m: 0.869 }, b8: { r: 0.95, m: 0.843 }, clu: 0.113, clu1: 3.046 },
    { T: "64k", lsa4: { r: 0.998, m: 0.896 }, lsa1: { r: 1.0, m: 0.934 }, b4: { r: 0.998, m: 0.906 }, b8: { r: 0.998, m: 0.889 }, clu: 0.496, clu1: 12.237 },
    { T: "256k", lsa4: { r: 0.91, m: 0.816 }, lsa1: { r: 1.0, m: 0.941 }, b4: { r: 0.954, m: 0.847 }, b8: { r: 0.854, m: 0.77 }, clu: 2.052, clu1: 48.038 },
    { T: "1M", lsa4: { r: 0.512, m: 0.488 }, lsa1: { r: 0.991, m: 0.943 }, b4: { r: 0.607, m: 0.527 }, b8: { r: 0.418, m: 0.422 }, clu: 8.006, clu1: 215.751 },
  ],
  scattered: [
    { T: "16k", lsa4: { r: 0.723, m: 0.633 }, lsa1: { r: 0.996, m: 0.887 }, b4: { r: 0.859, m: 0.73 }, b8: { r: 0.621, m: 0.556 }, clu: 0.119, clu1: 3.035 },
    { T: "64k", lsa4: { r: 0.523, m: 0.405 }, lsa1: { r: 0.994, m: 0.905 }, b4: { r: 0.742, m: 0.54 }, b8: { r: 0.414, m: 0.322 }, clu: 0.595, clu1: 12.618 },
    { T: "256k", lsa4: { r: 0.308, m: 0.235 }, lsa1: { r: 0.838, m: 0.752 }, b4: { r: 0.5, m: 0.341 }, b8: { r: 0.226, m: 0.171 }, clu: 2.263, clu1: 49.007 },
    { T: "1M", lsa4: { r: 0.146, m: 0.134 }, lsa1: { r: 0.438, m: 0.412 }, b4: { r: 0.274, m: 0.2 }, b8: { r: 0.105, m: 0.092 }, clu: 8.68, clu1: 207.197 },
  ],
  random: [
    { T: "16k", lsa4: { r: 0.508, m: 0.478 }, b4: { r: 0.63, m: 0.553 }, b8: { r: 0.448, m: 0.443 }, clu: 0.131 },
    { T: "64k", lsa4: { r: 0.282, m: 0.323 }, b4: { r: 0.4, m: 0.398 }, b8: { r: 0.228, m: 0.289 }, clu: 0.57 },
    { T: "256k", lsa4: { r: 0.145, m: 0.232 }, b4: { r: 0.249, m: 0.303 }, b8: { r: 0.108, m: 0.203 }, clu: 2.318 },
    { T: "1M", lsa4: { r: 0.074, m: 0.174 }, b4: { r: 0.134, m: 0.236 }, b8: { r: 0.045, m: 0.149 }, clu: 9.348 },
  ],
  needle: [
    { T: "16k", lsa4: { r: 0.53, m: 0.629, n: 62 }, lsa1: { r: 0.684, m: 0.699, n: 63 }, b4: { r: 0.664, m: 0.683, n: 62 }, b8: { r: 0.459, m: 0.579, n: 57 }, clu: 0.131, clu1: 5.779 },
    { T: "64k", lsa4: { r: 0.286, m: 0.422, n: 56 }, lsa1: { r: 0.467, m: 0.527, n: 64 }, b4: { r: 0.404, m: 0.499, n: 62 }, b8: { r: 0.23, m: 0.377, n: 50 }, clu: 0.69, clu1: 22.126 },
    { T: "256k", lsa4: { r: 0.161, m: 0.29, n: 50 }, lsa1: { r: 0.281, m: 0.395, n: 62 }, b4: { r: 0.253, m: 0.371, n: 61 }, b8: { r: 0.114, m: 0.238, n: 34 }, clu: 2.268, clu1: 85.823 },
    { T: "1M", lsa4: { r: 0.082, m: 0.206, n: 38 }, lsa1: { r: 0.176, m: 0.308, n: 59 }, b4: { r: 0.153, m: 0.281, n: 54 }, b8: { r: 0.052, m: 0.163, n: 23 }, clu: 8.944, clu1: 357.987 },
  ],
}

const KINDS = [
  { v: "topical", t: "topical", d: "64 topics x 8 subtopics; a document of 256 tokens keeps one topic" },
  { v: "scattered", t: "scattered", d: "the same topics, but every token draws its own: close in meaning, far apart in the cache" },
  { v: "random", t: "random", d: "keys uniform on the sphere: no structure for any index to find" },
  { v: "needle", t: "needle", d: "random keys plus one near-copy of each query planted at a random position" },
] as const

const METHODS = [
  { k: "lsa4", t: "D-LSA, pool 4", c: "oklch(0.6 0.14 150)" },
  { k: "lsa1", t: "D-LSA, no pool", c: "oklch(0.55 0.12 190)" },
  { k: "b4", t: "block of 4 (2x the index work)", c: "oklch(0.58 0.12 260)" },
  { k: "b8", t: "block of 8 (same index work)", c: "oklch(0.7 0.06 260)" },
] as const

export function RecallBench() {
  const [kind, setKind] = useState<keyof typeof DATA>("scattered")
  const [metric, setMetric] = useState<"r" | "m" | "n">("r")
  const rows = DATA[kind]
  const m = kind !== "needle" && metric === "n" ? "r" : metric
  const val = (c: Cell | undefined) => (c === undefined ? undefined : m === "n" ? (c.n ?? 0) / 64 : m === "r" ? c.r : c.m)
  const label = (c: Cell | undefined) =>
    c === undefined ? "not run" : m === "n" ? `${c.n} / 64` : `${((m === "r" ? c.r : c.m) * 100).toFixed(1)}%`

  return (
    <figure className="my-8 overflow-hidden rounded-md border">
      <div className="border-b px-3 py-2 font-mono text-xs text-muted-foreground">
        measured on CPU · my numpy port of the reference flat design · each method reads 2,048 long-range keys
      </div>
      <div className="flex flex-wrap items-center gap-1.5 border-b px-4 py-2.5">
        {KINDS.map((k) => (
          <button
            key={k.v}
            type="button"
            onClick={() => setKind(k.v)}
            className={cn(
              "rounded border px-2 py-0.5 font-mono text-[11px] transition-colors",
              kind === k.v ? "border-foreground/40 bg-muted text-foreground" : "text-muted-foreground hover:bg-muted"
            )}
          >
            {k.t}
          </button>
        ))}
        <span className="ml-3 font-mono text-[11px] text-muted-foreground">show</span>
        {[
          { v: "r" as const, t: "top-64 keys found" },
          { v: "m" as const, t: "attention mass" },
          ...(kind === "needle" ? [{ v: "n" as const, t: "needles found" }] : []),
        ].map((o) => (
          <button
            key={o.v}
            type="button"
            onClick={() => setMetric(o.v)}
            className={cn(
              "rounded border px-2 py-0.5 font-mono text-[11px] transition-colors",
              m === o.v ? "border-foreground/40 bg-muted text-foreground" : "text-muted-foreground hover:bg-muted"
            )}
          >
            {o.t}
          </button>
        ))}
      </div>
      <div className="border-b px-4 py-2 text-xs text-muted-foreground">{KINDS.find((k) => k.v === kind)?.d}</div>

      <div className="space-y-4 px-4 py-4">
        {rows.map((r) => (
          <div key={r.T} className="grid grid-cols-[3rem_1fr] items-start gap-3">
            <div className="pt-0.5 font-mono text-sm tabular-nums">{r.T}</div>
            <div className="space-y-1">
              {METHODS.filter((x) => x.k !== "lsa1" || DATA[kind].some((row) => row.lsa1)).map((x) => {
                const c = r[x.k as "lsa4"] as Cell | undefined
                const v = val(c)
                return (
                  <div key={x.k} className="flex items-center gap-2">
                    <div className="h-2.5 flex-1 rounded bg-muted" role="img" aria-label={`${x.t}: ${label(c)}`}>
                      {v !== undefined && <div className="h-full rounded" style={{ width: `${(v * 100).toFixed(1)}%`, background: x.c }} />}
                    </div>
                    <span className="w-16 shrink-0 text-right font-mono text-[11px] tabular-nums">{label(c)}</span>
                  </div>
                )
              })}
              <div className="font-mono text-[10px] text-muted-foreground">
                Ward clustering, whole cache: {r.clu.toFixed(2)} s with pools of 4
                {r.clu1 !== undefined && <>, {r.clu1.toFixed(1)} s without</>}
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 border-t px-4 py-3 font-mono text-[11px] text-muted-foreground">
        {METHODS.map((x) => (
          <span key={x.k}>
            <span style={{ color: x.c }}>■</span> {x.t}
          </span>
        ))}
      </div>
    </figure>
  )
}
