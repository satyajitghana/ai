"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// MEASURED on a 4-vCPU sandbox (numpy 2.5.3, 2 threads), with my numpy port of Prefrontal-AI/latent-sparse-attention
// @6291aa6: reference.py (flat), hierarchy.py (tree, centroid scores) and shape.py (bucket shapes). Unit index keys of
// 64 dims; cluster blocks of 512, pools of 4, buckets of about 8 (cap 16); sink 4, window 512; top-p 1,024 and top-k
// 4,096 for every method (the GLM setting from 1M, and the tree's throughout); 64 queries at the last position, one
// seed. Tree: node buckets of 4 paired by Ward in node cluster blocks of 4,096, beam started at the lowest level of at
// most 32,768 node buckets, beam width as shown (2,048 ships). Shaped: flat, each bucket scored by centroid plus
// 2 standard deviations of its rank-2 sign-bit shape (shape.py defaults; not in the paper or any shipped config).
// r: share of the exact top-64 keys found. m: attention mass at softmax temperature 0.1, over what the exact top-4,096
// captures (both with the sink and window). s: vectors scored per query (a shaped bucket counts 3: centroid + rank 2).
type Cell = { r: number; m: number; s: number; n?: number }
type Row = { T: string; levels: number[]; flat: Cell; shaped: Cell; t256: Cell; t512: Cell; t1024: Cell; t2048: Cell }

const DATA: Record<string, Row[]> = {
  topical: [
    { T: "256k", levels: [7168, 1024], flat: { r: 0.999, m: 0.942, s: 32704 }, shaped: { r: 0.999, m: 0.936, s: 98112 }, t256: { r: 0.997, m: 0.94, s: 12224 }, t512: { r: 0.998, m: 0.941, s: 13248 }, t1024: { r: 0.998, m: 0.941, s: 15296 }, t2048: { r: 0.998, m: 0.942, s: 19392 } },
    { T: "1M", levels: [31744, 7168, 1024], flat: { r: 0.978, m: 0.847, s: 131008 }, shaped: { r: 0.964, m: 0.808, s: 393024 }, t256: { r: 0.971, m: 0.843, s: 36800 }, t512: { r: 0.977, m: 0.846, s: 37824 }, t1024: { r: 0.977, m: 0.846, s: 39872 }, t2048: { r: 0.978, m: 0.847, s: 43968 } },
    { T: "2M", levels: [64512, 15360, 3072], flat: { r: 0.946, m: 0.83, s: 262080 }, shaped: { r: 0.909, m: 0.773, s: 786240 }, t256: { r: 0.934, m: 0.825, s: 24512 }, t512: { r: 0.939, m: 0.828, s: 26560 }, t1024: { r: 0.942, m: 0.829, s: 30656 }, t2048: { r: 0.943, m: 0.829, s: 38848 } },
  ],
  scattered: [
    { T: "256k", levels: [7168, 1024], flat: { r: 0.385, m: 0.275, s: 32704 }, shaped: { r: 0.416, m: 0.285, s: 98112 }, t256: { r: 0.333, m: 0.256, s: 12224 }, t512: { r: 0.361, m: 0.266, s: 13248 }, t1024: { r: 0.378, m: 0.272, s: 15296 }, t2048: { r: 0.384, m: 0.274, s: 19392 } },
    { T: "1M", levels: [31744, 7168, 1024], flat: { r: 0.186, m: 0.167, s: 131008 }, shaped: { r: 0.204, m: 0.172, s: 393024 }, t256: { r: 0.142, m: 0.15, s: 36800 }, t512: { r: 0.167, m: 0.159, s: 37824 }, t1024: { r: 0.171, m: 0.163, s: 39872 }, t2048: { r: 0.179, m: 0.165, s: 43968 } },
    { T: "2M", levels: [64512, 15360, 3072], flat: { r: 0.133, m: 0.139, s: 262080 }, shaped: { r: 0.14, m: 0.141, s: 786240 }, t256: { r: 0.091, m: 0.121, s: 24512 }, t512: { r: 0.107, m: 0.128, s: 26560 }, t1024: { r: 0.114, m: 0.133, s: 30656 }, t2048: { r: 0.12, m: 0.136, s: 38848 } },
  ],
  random: [
    { T: "1M", levels: [31744, 7168, 1024], flat: { r: 0.114, m: 0.206, s: 131008 }, shaped: { r: 0.115, m: 0.193, s: 393024 }, t256: { r: 0.076, m: 0.174, s: 36800 }, t512: { r: 0.09, m: 0.186, s: 37824 }, t1024: { r: 0.102, m: 0.194, s: 39872 }, t2048: { r: 0.111, m: 0.2, s: 43968 } },
  ],
  needle: [
    { T: "1M", levels: [31744, 7168, 1024], flat: { r: 0.123, m: 0.24, s: 131008, n: 40 }, shaped: { r: 0.125, m: 0.239, s: 393024, n: 49 }, t256: { r: 0.08, m: 0.184, s: 36800, n: 19 }, t512: { r: 0.094, m: 0.205, s: 37824, n: 27 }, t1024: { r: 0.106, m: 0.219, s: 39872, n: 32 }, t2048: { r: 0.117, m: 0.233, s: 43968, n: 39 } },
  ],
}

const KINDS = [
  { v: "topical", t: "topical", d: "64 topics x 8 subtopics; each 256-token document keeps one subtopic" },
  { v: "scattered", t: "scattered", d: "the same subtopics, drawn per token: close in meaning, far apart in the cache" },
  { v: "random", t: "random", d: "keys uniform on the sphere: nothing for any index to find" },
  { v: "needle", t: "needle", d: "random keys plus one near-copy of each query planted at a random position; the count is needles found of 64" },
] as const

const METHODS = [
  { k: "flat", t: "flat", c: "oklch(0.6 0.14 150)" },
  { k: "t2048", t: "tree, beam 2,048 (ships)", c: "oklch(0.58 0.12 260)" },
  { k: "t1024", t: "tree, beam 1,024", c: "oklch(0.66 0.09 260)" },
  { k: "t512", t: "tree, beam 512", c: "oklch(0.72 0.07 260)" },
  { k: "t256", t: "tree, beam 256", c: "oklch(0.78 0.05 260)" },
  { k: "shaped", t: "flat, shaped buckets (z = 2)", c: "oklch(0.64 0.14 60)" },
] as const

export function TreeBeam() {
  const [kind, setKind] = useState<string>("scattered")
  const [metric, setMetric] = useState<"r" | "m">("r")
  const rows = DATA[kind] ?? []

  return (
    <figure className="my-8 overflow-hidden rounded-md border">
      <div className="border-b px-3 py-2 font-mono text-xs text-muted-foreground">
        measured on CPU · my numpy port of the reference tree and flat reads · p = 1,024, k = 4,096
      </div>
      <div className="flex flex-wrap items-center gap-1.5 border-b px-4 py-2.5">
        {KINDS.filter((k) => DATA[k.v]).map((k) => (
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
        ].map((o) => (
          <button
            key={o.v}
            type="button"
            onClick={() => setMetric(o.v)}
            className={cn(
              "rounded border px-2 py-0.5 font-mono text-[11px] transition-colors",
              metric === o.v ? "border-foreground/40 bg-muted text-foreground" : "text-muted-foreground hover:bg-muted"
            )}
          >
            {o.t}
          </button>
        ))}
      </div>
      <div className="border-b px-4 py-2 text-xs text-muted-foreground">{KINDS.find((k) => k.v === kind)?.d}</div>

      <div className="space-y-5 px-4 py-4">
        {rows.map((r) => (
          <div key={r.T} className="grid grid-cols-[3rem_1fr] items-start gap-3">
            <div className="pt-0.5 font-mono text-sm tabular-nums">{r.T}</div>
            <div className="space-y-1">
              {METHODS.map((x) => {
                const c = r[x.k]
                const v = metric === "r" ? c.r : c.m
                return (
                  <div key={x.k} className="grid grid-cols-[1fr_5rem_5.5rem] items-center gap-2">
                    <div className="h-2.5 rounded bg-muted" role="img" aria-label={`${x.t}: ${(v * 100).toFixed(1)}%`}>
                      <div className="h-full rounded" style={{ width: `${(v * 100).toFixed(1)}%`, background: x.c }} />
                    </div>
                    <span className="text-right font-mono text-[11px] tabular-nums">
                      {(v * 100).toFixed(1)}%{c.n !== undefined && <> · {c.n}</>}
                    </span>
                    <span className="text-right font-mono text-[10px] tabular-nums text-muted-foreground">
                      {c.s.toLocaleString("en-US")} scored
                    </span>
                  </div>
                )
              })}
              <div className="font-mono text-[10px] text-muted-foreground">
                {r.flat.s.toLocaleString("en-US")} buckets; node levels{" "}
                {r.levels.map((n) => n.toLocaleString("en-US")).join(" / ")}
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
