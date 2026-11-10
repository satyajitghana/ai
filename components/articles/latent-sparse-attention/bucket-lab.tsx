"use client"

import { useMemo, useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { mcos, msin } from "@/lib/dmath"
import { cn } from "@/lib/utils"

// A toy of D-LSA (Flat), small enough to see. The index space is two-dimensional, so every unit-norm index key is a
// point on a circle and a key's angle is its meaning. 128 keys, two cluster blocks of 64. The steps are the ones in
// Prefrontal-AI/latent-sparse-attention src/lsa/core/ward.py and reference.py: pool n consecutive keys by summing,
// merge pools with Ward's criterion in rounds of mutual-cheapest pairs (cost a_b + a_b' - a_(b+b'), a = |key sum|,
// size cap 16) down to 8 buckets a block, centroid = normalised key sum; a query scores the 16 centroids, keeps the
// top p = 3 buckets and expands them best first until k = 16 keys. No sink and no window in the toy.

const N = 128
const BLOCK = 64
const PER_BLOCK = 8
const CAP = 16
const P = 3
const K = 16
const TOPICS = [20, 75, 140, 200, 255, 320] // degrees

function rng(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

type V = [number, number]
const rad = (deg: number) => (deg * Math.PI) / 180

function makeKeys(kind: "topical" | "scattered"): { v: V[]; topic: number[] } {
  const r = rng(7)
  const v: V[] = []
  const topic: number[] = []
  let cur = 0
  for (let i = 0; i < N; i++) {
    // topical: runs of 16 tokens share a topic, as a paragraph does; scattered: every token draws its own
    if (kind === "scattered" || i % 16 === 0) cur = Math.floor(r() * TOPICS.length)
    const noise = (r() + r() + r() - 1.5) * 22
    const a = rad(TOPICS[cur] + noise)
    v.push([mcos(a), msin(a)])
    topic.push(cur)
  }
  return { v, topic }
}

// Ward on one block's pools, as ward_rounds: returns the bucket label of every pool
function ward(sums: V[], sizes: number[], count: number): number[] {
  const n = sums.length
  const s = sums.map((x) => [x[0], x[1]] as V)
  const sz = sizes.slice()
  const alive = new Array(n).fill(true)
  const parent = Array.from({ length: n }, (_, i) => i)
  const norm = (x: V) => Math.sqrt(x[0] * x[0] + x[1] * x[1])
  for (let round = 0; round < 64; round++) {
    const left = alive.filter(Boolean).length - count
    if (left <= 0) break
    const best = new Array(n).fill(-1)
    const cost = new Array(n).fill(Infinity)
    for (let i = 0; i < n; i++) {
      if (!alive[i]) continue
      for (let j = 0; j < n; j++) {
        if (j === i || !alive[j] || sz[i] + sz[j] > CAP) continue
        const c = norm(s[i]) + norm(s[j]) - norm([s[i][0] + s[j][0], s[i][1] + s[j][1]])
        if (c < cost[i]) {
          cost[i] = c
          best[i] = j
        }
      }
    }
    const pairs: [number, number, number][] = []
    for (let i = 0; i < n; i++) if (best[i] > i && best[best[i]] === i) pairs.push([cost[i], i, best[i]])
    if (!pairs.length) break
    pairs.sort((a, b) => a[0] - b[0] || a[1] - b[1])
    for (const [, i, j] of pairs.slice(0, left)) {
      s[i] = [s[i][0] + s[j][0], s[i][1] + s[j][1]]
      sz[i] += sz[j]
      alive[j] = false
      parent[j] = i
    }
  }
  const root = (i: number): number => (parent[i] === i ? i : root(parent[i]))
  const ids = new Map<number, number>()
  return parent.map((_, i) => {
    const r0 = root(i)
    if (!ids.has(r0)) ids.set(r0, ids.size)
    return ids.get(r0) as number
  })
}

function build(v: V[], pool: number) {
  const bucket = new Array(N).fill(0)
  for (let b = 0; b < N / BLOCK; b++) {
    const sums: V[] = []
    for (let p = 0; p < BLOCK / pool; p++) {
      let x = 0
      let y = 0
      for (let q = 0; q < pool; q++) {
        const k = v[b * BLOCK + p * pool + q]
        x += k[0]
        y += k[1]
      }
      sums.push([x, y])
    }
    const lab = ward(sums, new Array(sums.length).fill(pool), PER_BLOCK)
    for (let i = 0; i < BLOCK; i++) bucket[b * BLOCK + i] = b * PER_BLOCK + lab[Math.floor(i / pool)]
  }
  const cent: V[] = Array.from({ length: (N / BLOCK) * PER_BLOCK }, () => [0, 0] as V)
  for (let i = 0; i < N; i++) {
    cent[bucket[i]][0] += v[i][0]
    cent[bucket[i]][1] += v[i][1]
  }
  return {
    bucket,
    cent: cent.map((c) => {
      const n = Math.sqrt(c[0] * c[0] + c[1] * c[1]) || 1
      return [c[0] / n, c[1] / n] as V
    }),
  }
}

const hue = (b: number) => `oklch(0.66 0.14 ${(b * 137.5) % 360})`

export function BucketLab({
  initialKind = "topical",
  initialPool = 4,
  initialAngle = 140,
}: {
  initialKind?: "topical" | "scattered"
  initialPool?: 1 | 4
  initialAngle?: number
}) {
  const [kind, setKind] = useState<"topical" | "scattered">(initialKind)
  const [pool, setPool] = useState<number>(initialPool)
  const [deg, setDeg] = useState(initialAngle)

  const keys = useMemo(() => makeKeys(kind), [kind])
  const bk = useMemo(() => build(keys.v, pool), [keys, pool])
  const q: V = [mcos(rad(deg)), msin(rad(deg))]
  const dot = (a: V) => a[0] * q[0] + a[1] * q[1]

  const ranked = bk.cent.map((c, b) => ({ b, s: dot(c) })).sort((a, b) => b.s - a.s || a.b - b.b)
  const picked = ranked.slice(0, P).map((r) => r.b)
  const sel: number[] = []
  for (const b of picked) for (let i = 0; i < N && sel.length < K; i++) if (bk.bucket[i] === b) sel.push(i)
  const exact = keys.v
    .map((k, i) => ({ i, s: dot(k) }))
    .sort((a, b) => b.s - a.s || a.i - b.i)
    .slice(0, K)
    .map((r) => r.i)
  const selSet = new Set(sel)
  const hit = exact.filter((i) => selSet.has(i)).length
  // purity: share of each bucket's keys that share its majority topic
  let pure = 0
  for (let b = 0; b < bk.cent.length; b++) {
    const t = new Array(TOPICS.length).fill(0)
    let n = 0
    for (let i = 0; i < N; i++)
      if (bk.bucket[i] === b) {
        t[keys.topic[i]]++
        n++
      }
    pure += Math.max(...t) / Math.max(n, 1)
  }
  pure /= bk.cent.length

  const R = 92
  const C = 120
  const px = (x: number, r: number) => (C + x * r).toFixed(2)
  const py = (y: number, r: number) => (C - y * r).toFixed(2)

  return (
    <figure className="my-8 overflow-hidden rounded-md border">
      <div className="border-b px-3 py-2 font-mono text-xs text-muted-foreground">
        a toy D-LSA (Flat) in a 2-D index space · 128 keys, 2 cluster blocks, buckets of about 8, top-p 3, k 16
      </div>
      <div className="flex flex-wrap items-center gap-1.5 border-b px-4 py-2.5">
        {(["topical", "scattered"] as const).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setKind(k)}
            className={cn(
              "rounded border px-2 py-0.5 font-mono text-[11px] transition-colors",
              kind === k ? "border-foreground/40 bg-muted text-foreground" : "text-muted-foreground hover:bg-muted"
            )}
          >
            {k === "topical" ? "topics in runs of 16 tokens" : "topic changes every token"}
          </button>
        ))}
        <span className="ml-3 font-mono text-[11px] text-muted-foreground">pool</span>
        {[4, 1].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => setPool(n)}
            className={cn(
              "rounded border px-2 py-0.5 font-mono text-[11px] transition-colors",
              pool === n ? "border-foreground/40 bg-muted text-foreground" : "text-muted-foreground hover:bg-muted"
            )}
          >
            {n === 4 ? "4 keys (paper)" : "1 key (no pooling)"}
          </button>
        ))}
      </div>

      <div className="grid gap-4 px-4 py-4 md:grid-cols-[240px_1fr]">
        <svg viewBox="0 0 240 240" className="mx-auto w-full max-w-[240px]" role="img" aria-label="Keys on a circle coloured by bucket, the query as an arrow, bucket centroids as triangles outside the circle.">
          <circle cx={C} cy={C} r={R} fill="none" stroke="currentColor" strokeOpacity={0.15} />
          {keys.v.map((k, i) => (
            <circle
              key={i}
              cx={px(k[0], R)}
              cy={py(k[1], R)}
              r={selSet.has(i) ? 4 : 2.6}
              fill={hue(bk.bucket[i])}
              stroke={selSet.has(i) ? "currentColor" : "none"}
              strokeWidth={1}
              opacity={selSet.has(i) ? 1 : 0.75}
            />
          ))}
          {bk.cent.map((c, b) => (
            <path
              key={b}
              d={`M ${px(c[0], R + 14)} ${(Number(py(c[1], R + 14)) - 4).toFixed(2)} l 4 7 l -8 0 z`}
              fill={hue(b)}
              stroke={picked.includes(b) ? "currentColor" : "none"}
            />
          ))}
          <line x1={C} y1={C} x2={px(q[0], R - 8)} y2={py(q[1], R - 8)} stroke="oklch(0.58 0.18 25)" strokeWidth={2} />
          <circle cx={px(q[0], R - 8)} cy={py(q[1], R - 8)} r={3.5} fill="oklch(0.58 0.18 25)" />
        </svg>

        <div className="space-y-3">
          <label className="flex items-center gap-3 text-xs">
            <span className="w-24 shrink-0 font-mono text-muted-foreground">query angle</span>
            <Range min={0} max={359} step={1} value={deg} onChange={(e) => setDeg(Number(e.target.value))} aria-label="query angle" className="w-full" />
            <span className="w-10 shrink-0 text-right font-mono tabular-nums">{deg}°</span>
          </label>
          <div>
            <div className="mb-1 font-mono text-[11px] text-muted-foreground">the KV cache, in position order: colour is the bucket</div>
            <div className="grid grid-cols-[repeat(64,minmax(0,1fr))] gap-px">
              {keys.v.map((_, i) => (
                <div
                  key={i}
                  className="h-4"
                  title={`key ${i}`}
                  style={{
                    background: hue(bk.bucket[i]),
                    opacity: selSet.has(i) ? 1 : 0.28,
                    boxShadow: exact.includes(i) ? "inset 0 -3px 0 currentColor" : undefined,
                  }}
                />
              ))}
            </div>
            <div className="mt-1 font-mono text-[10px] text-muted-foreground">
              bright: read by LSA · underline: in the exact top-16
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3 font-mono text-xs">
            <div>
              <div className="text-muted-foreground">exact top-16 found</div>
              <div className="text-xl tabular-nums">{hit} / 16</div>
            </div>
            <div>
              <div className="text-muted-foreground">vectors scored</div>
              <div className="text-xl tabular-nums">16 <span className="text-xs">not 128</span></div>
            </div>
            <div>
              <div className="text-muted-foreground">bucket purity</div>
              <div className="text-xl tabular-nums">{(pure * 100).toFixed(0)}%</div>
            </div>
          </div>
        </div>
      </div>
      <div className="border-t px-4 py-3 font-mono text-[11px] text-muted-foreground">
        Ward merges what is close on the circle, wherever it sits in the cache. With pooling on and the topic changing
        every token, each pool is already a blend of four meanings before Ward sees it, and the buckets inherit the
        blend. Purity is the share of a bucket&apos;s keys that share its most common topic.
      </div>
    </figure>
  )
}
