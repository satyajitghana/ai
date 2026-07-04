"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// What the KV cache buys, drawn as the attention it saves. At decode step k the model
// needs K/V for every token 0..k. WITHOUT a cache it recomputes all of them every step
// (k+1 arrows → work grows 1,2,3,… → total quadratic). WITH a cache the earlier K/V are
// already stored and reused (faint reads), so only ONE new entry is computed (work is
// flat → total linear). Scrub the decode step, flip the mode. Below: that cache isn't
// free — it grows with context and competes with batch size for VRAM. Numbers use the
// ~1 MB/token of a 13B model from the article.

const N = 14 // decode steps
const GR = "oklch(0.66 0.15 150)" // cached / cheap
const RED = "oklch(0.63 0.19 25)" // recompute / costly

// scene geometry (fixed viewBox → stable height across the animation)
const W = 760
const H = 232
const MX = 24
const BW = 36
const STEP = (W - 2 * MX - BW) / (N - 1)
const tokX = (i: number) => MX + i * STEP
const tokCx = (i: number) => tokX(i) + BW / 2
const TY = 44
const TH = 30
const QW = 188
const QH = 42
const QY = 168
const QX = W / 2

const vcurve = (x1: number, y1: number, x2: number, y2: number) => {
  const my = (y1 + y2) / 2
  return `M ${x1} ${y1} C ${x1} ${my}, ${x2} ${my}, ${x2} ${y2}`
}

export function KVCache() {
  const [cache, setCache] = useState(true)
  const [k, setK] = useState(N - 1) // current decode step (attends 0..k)
  const [ctxK, setCtxK] = useState(4) // context length in thousands of tokens

  const workNow = cache ? 1 : k + 1
  const cumWith = N // 1 per step
  const cumWithout = (N * (N + 1)) / 2 // 1+2+…+N
  const speedup = cumWithout / cumWith

  // cache memory: 13B ~ 1 MB/token; context in thousands → MB → GB
  const cacheGB = (ctxK * 1000 * 1) / 1024
  const reqsPer80 = Math.max(1, Math.floor(80 / Math.max(cacheGB, 0.1)))

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex items-center justify-between border-b px-4 py-2.5 font-mono text-xs">
        <span className="text-muted-foreground">KV cache · attention work per decode step</span>
        <div className="flex gap-1">
          {[
            { v: true, label: "with cache" },
            { v: false, label: "without cache" },
          ].map((o) => (
            <button
              key={o.label}
              type="button"
              onClick={() => setCache(o.v)}
              aria-pressed={cache === o.v}
              className={cn(
                "cursor-pointer rounded px-2 py-1 font-mono text-xs transition-colors",
                cache === o.v ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>

      <div className="p-3 sm:p-4">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`Decode step ${k}${cache ? " with cache: 1 new entry computed, the rest reused" : ` without cache: all ${k + 1} entries recomputed`}`}>
          <defs>
            <marker id="kv-arrow-gr" viewBox="0 -5 10 10" markerWidth="7" markerHeight="7" orient="auto" refX="6" refY="0">
              <path d="M0,-4L6,0L0,4" fill="none" stroke={GR} strokeWidth={1.5} />
            </marker>
            <marker id="kv-arrow-red" viewBox="0 -5 10 10" markerWidth="7" markerHeight="7" orient="auto" refX="6" refY="0">
              <path d="M0,-4L6,0L0,4" fill="none" stroke={RED} strokeWidth={1.5} />
            </marker>
            <filter id="kv-soft" x="-40%" y="-40%" width="180%" height="180%">
              <feDropShadow dx="0" dy="1" stdDeviation="1.4" floodOpacity="0.14" />
            </filter>
          </defs>

          <text x={MX} y={26} className="fill-muted-foreground font-mono" fontSize={11}>tokens 0…{k} · K/V needed this step</text>

          {/* connectors: query → every token it needs K/V for */}
          {Array.from({ length: N }).map((_, i) => {
            if (i > k) return null
            const isNew = i === k
            const col = cache ? GR : RED
            const bold = cache ? isNew : true
            return (
              <path
                key={i}
                d={vcurve(QX, QY, tokCx(i), TY + TH)}
                fill="none"
                stroke={col}
                strokeWidth={bold ? 1.7 : 1.1}
                markerEnd={bold ? `url(#${cache ? "kv-arrow-gr" : "kv-arrow-red"})` : undefined}
                opacity={bold ? 0.9 : 0.22}
              />
            )
          })}

          {/* token nodes */}
          {Array.from({ length: N }).map((_, i) => {
            const future = i > k
            const isNew = i === k
            let fill = "var(--muted)"
            let op = 0.22
            let stroke = "transparent"
            if (!future) {
              if (cache) {
                if (isNew) { fill = GR; op = 0.92; stroke = GR }
                else { fill = GR; op = 0.4 } // reused / stored
              } else {
                fill = RED; op = isNew ? 0.92 : 0.62; stroke = isNew ? RED : "transparent" // all recomputed
              }
            }
            return (
              <g key={i}>
                <rect x={tokX(i)} y={TY} width={BW} height={TH} rx={6} fill={fill} opacity={op} stroke={stroke} strokeWidth={1.5} filter={isNew && !future ? "url(#kv-soft)" : undefined} className="transition-all duration-300" />
                <text x={tokCx(i)} y={TY + TH / 2 + 4} textAnchor="middle" className={!future && (isNew || !cache) ? "fill-background font-mono" : "fill-muted-foreground font-mono"} fontSize={10}>{i}</text>
              </g>
            )
          })}

          {/* query node */}
          <g>
            <rect x={QX - QW / 2} y={QY} width={QW} height={QH} rx={9} fill="var(--background)" stroke={cache ? GR : RED} strokeWidth={1.5} filter="url(#kv-soft)" />
            <text x={QX} y={QY + 17} textAnchor="middle" className="fill-foreground font-mono" fontSize={11} fontWeight={600}>decode · step {k}</text>
            <text x={QX} y={QY + 32} textAnchor="middle" className="font-mono" fontSize={10} fill={cache ? GR : RED}>
              {cache ? "compute 1 new · reuse the rest" : `recompute all ${k + 1}`}
            </text>
          </g>
        </svg>

        {/* step scrubber */}
        <div className="mt-1">
          <div className="mb-1 font-mono text-[10px] text-muted-foreground">decode step (drag)</div>
          <input type="range" min={1} max={N - 1} value={k} onChange={(e) => setK(Number(e.target.value))} className="w-full cursor-pointer accent-[oklch(0.66_0.15_150)]" aria-label="decode step" />
        </div>

        {/* readout line */}
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[10px] text-muted-foreground">
          <span>work this step <span style={{ color: cache ? GR : RED }}>{workNow}</span></span>
          <span>total over {N} steps <span className="text-foreground">{cache ? `${cumWith} · linear` : `${cumWithout} · n²`}</span></span>
          <span className="ml-auto">cache speedup <span className="text-foreground">~{speedup.toFixed(1)}×</span></span>
        </div>

        {/* both captions overlaid so the region sizes to the taller text (no reflow) */}
        <div className="mt-2 grid">
          <p aria-hidden={!cache} className={cn("col-start-1 row-start-1 text-sm leading-6 text-muted-foreground transition-opacity duration-300", cache ? "opacity-100" : "pointer-events-none opacity-0")}>
            With the cache, each step appends one token&rsquo;s K/V and does O(1) new attention
            work — generation is linear in length. That&rsquo;s the ~5× (and more, for long outputs)
            speedup over recomputing.
          </p>
          <p aria-hidden={cache} className={cn("col-start-1 row-start-1 text-sm leading-6 text-muted-foreground transition-opacity duration-300", !cache ? "opacity-100" : "pointer-events-none opacity-0")}>
            Without a cache, every step recomputes attention over the whole growing sequence —
            work climbs 1, 2, 3, … and the total is quadratic. This is the cost the cache exists
            to erase.
          </p>
        </div>

        {/* the cost: memory competes with batch size for VRAM */}
        <div className="mt-4 rounded-lg border bg-muted/20 p-3">
          <div className="mb-1 flex items-center justify-between font-mono text-xs text-muted-foreground">
            <span>context length (13B, ~1 MB/token)</span>
            <span className="tabular-nums text-foreground">{ctxK}k tokens · {cacheGB.toFixed(1)} GB / request</span>
          </div>
          <input type="range" min={1} max={32} step={1} value={ctxK} onChange={(e) => setCtxK(parseInt(e.target.value))} className="w-full cursor-pointer accent-foreground" aria-label="context length in thousands of tokens" />

          {/* 80GB VRAM budget, partitioned into concurrent requests by cache size */}
          <svg viewBox="0 0 760 56" className="mt-2 w-full" role="img" aria-label={`An 80GB GPU fits about ${reqsPer80} concurrent requests at this cache size`}>
            <text x={0} y={12} className="fill-muted-foreground font-mono" fontSize={10}>80 GB GPU · one slot = one request&rsquo;s cache</text>
            <rect x={0} y={20} width={760} height={26} rx={6} fill="var(--muted)" opacity={0.5} stroke="var(--border)" strokeWidth={1} />
            {Array.from({ length: Math.min(reqsPer80, 80) }).map((_, r) => {
              const segW = (cacheGB / 80) * 760
              const x = r * segW
              if (segW < 1.5) return null
              return <rect key={r} x={x + 1.5} y={22} width={Math.max(segW - 3, 1)} height={22} rx={4} fill={GR} opacity={0.5} className="transition-all duration-300" />
            })}
          </svg>
          <div className="mt-1 font-mono text-[10px] text-muted-foreground">
            ≈ <span className="text-foreground tabular-nums">{reqsPer80}</span> concurrent requests fit on one 80GB GPU
          </div>

          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            The cache grows linearly with context and per layer, so long contexts get
            expensive fast — and every gigabyte spent on cache is a gigabyte not spent on
            batch size. Cache directly trades against concurrency, which is why the field
            quantizes it (INT8/INT4), windows it, shares it (GQA), and pages it
            (PagedAttention).
          </p>
        </div>
      </div>
    </figure>
  )
}
